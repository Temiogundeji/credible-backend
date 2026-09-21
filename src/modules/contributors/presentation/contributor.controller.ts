import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../identity/presentation/access-token.guard';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard';
import type { Contributor, ContributorAssignment, ContributorObligation, ContributorPlan } from '../domain/contributor-types';
import { ContributorManagementService } from '../application/contributor-management.service';
import { AssignContributorDto } from './dto/assign-contributor.dto';
import { CreateContributorDto } from './dto/create-contributor.dto';
import { CreateContributorPlanDto } from './dto/create-plan.dto';
import { UpdateContributorDto } from './dto/update-contributor.dto';
import { VerifyEmailDto } from '../../identity/presentation/dto/verify-email.dto';
import { parseContributorCsv } from './parse-contributor-csv';
import { ObligationGenerationService } from '../application/obligation-generation.service';

@Controller({ path: 'contributors', version: '1' })
@UseGuards(AccessTokenGuard)
@ApiTags('Contributors')
@ApiBearerAuth('access-token')
export class ContributorController {
  constructor(private readonly contributors: ContributorManagementService, private readonly obligations: ObligationGenerationService) {}

  @Get()
  @ApiOperation({ summary: 'List tenant contributors' })
  @ApiQuery({ name: 'status', required: false, enum: ['invited', 'pending_verification', 'active', 'suspended', 'deactivated'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'agentId', required: false, format: 'uuid' })
  list(@Req() request: AuthenticatedRequest, @Query('status') status?: Contributor['status'], @Query('search') search?: string, @Query('agentId') agentId?: string): Promise<readonly Contributor[]> {
    const user = this.user(request); this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    return this.contributors.list({ agencyId: user.agencyId, status, search, agentId });
  }

  @Post()
  @ApiOperation({ summary: 'Register a contributor and optionally send an invitation' })
  @ApiResponse({ status: 201, description: 'Contributor registered.' })
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateContributorDto): Promise<Contributor> {
    const user = this.user(request); this.requireAnyRole(user.roles, ['admin', 'agent']);
    return this.contributors.create({ ...body, agencyId: user.agencyId, actorUserId: user.id });
  }

  @Post('imports')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a CSV and atomically register contributors' })
  @ApiResponse({ status: 201, description: 'All valid rows committed; invalid batches are rejected before persistence.' })
  createBatch(@Req() request: AuthenticatedRequest, @UploadedFile() file?: { readonly mimetype: string; readonly size: number; readonly buffer: Buffer }): Promise<readonly Contributor[]> {
    const user = this.user(request); this.requireRole(user.roles, 'admin');
    if (!file || !['text/csv', 'application/vnd.ms-excel'].includes(file.mimetype)) throw new ForbiddenException('A CSV file is required');
    return this.contributors.createBatch({ agencyId: user.agencyId, actorUserId: user.id, rows: parseContributorCsv(file.buffer.toString('utf8')) });
  }

  @Get(':contributorId')
  @ApiOperation({ summary: 'Get a contributor' })
  get(@Req() request: AuthenticatedRequest, @Param('contributorId') contributorId: string): Promise<Contributor> {
    const user = this.user(request); this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    return this.contributors.get({ agencyId: user.agencyId, contributorId });
  }

  @Patch(':contributorId')
  @ApiOperation({ summary: 'Update a contributor with optimistic concurrency' })
  @ApiResponse({ status: 409, description: 'Contributor version conflict.' })
  update(@Req() request: AuthenticatedRequest, @Param('contributorId') contributorId: string, @Body() body: UpdateContributorDto): Promise<Contributor> {
    const user = this.user(request); this.requireAnyRole(user.roles, ['admin', 'agent']);
    return this.contributors.update({ ...body, agencyId: user.agencyId, actorUserId: user.id, contributorId });
  }

  @Post(':contributorId/:status')
  @ApiOperation({ summary: 'Change contributor status' })
  changeStatus(@Req() request: AuthenticatedRequest, @Param('contributorId') contributorId: string, @Param('status') status: 'suspended' | 'deactivated', @Query('expectedVersion', ParseIntPipe) expectedVersion: number): Promise<Contributor> {
    const user = this.user(request); this.requireRole(user.roles, 'admin');
    if (!['suspended', 'deactivated'].includes(status)) throw new ForbiddenException();
    return this.contributors.changeStatus({ agencyId: user.agencyId, actorUserId: user.id, contributorId, status, expectedVersion });
  }

  @Get(':contributorId/assignments')
  @ApiOperation({ summary: 'List contributor assignment history' })
  assignments(@Req() request: AuthenticatedRequest, @Param('contributorId') contributorId: string): Promise<readonly ContributorAssignment[]> {
    const user = this.user(request); this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    return this.contributors.assignments({ agencyId: user.agencyId, contributorId });
  }

  @Post(':contributorId/assignments')
  @ApiOperation({ summary: 'Assign a contributor to an agent' })
  assign(@Req() request: AuthenticatedRequest, @Param('contributorId') contributorId: string, @Body() body: AssignContributorDto): Promise<ContributorAssignment> {
    const user = this.user(request); this.requireRole(user.roles, 'admin');
    return this.contributors.assign({ agencyId: user.agencyId, actorUserId: user.id, contributorId, agentId: body.agentId, effectiveFrom: new Date(body.effectiveFrom) });
  }

  @Get(':contributorId/plans')
  @ApiOperation({ summary: 'List contributor thrift plans' })
  plans(@Req() request: AuthenticatedRequest, @Param('contributorId') contributorId: string): Promise<readonly Record<string, unknown>[]> {
    const user = this.user(request); this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    return this.contributors.plans({ agencyId: user.agencyId, contributorId }).then((plans) => plans.map(serializePlan));
  }

  @Post(':contributorId/plans')
  @ApiOperation({ summary: 'Create a daily or weekly thrift plan' })
  createPlan(@Req() request: AuthenticatedRequest, @Param('contributorId') contributorId: string, @Body() body: CreateContributorPlanDto): Promise<Record<string, unknown>> {
    const user = this.user(request); this.requireAnyRole(user.roles, ['admin', 'agent']);
    const amountMinor = parseMinor(body.amountMinor); const targetMinor = body.targetMinor ? parseMinor(body.targetMinor) : undefined;
    return this.contributors.createPlan({ agencyId: user.agencyId, actorUserId: user.id, contributorId, frequency: body.frequency, amountMinor, targetMinor, currency: body.currency, startDate: new Date(body.startDate), endDate: body.endDate ? new Date(body.endDate) : undefined }).then(serializePlan);
  }

  @Get(':contributorId/obligations')
  @ApiOperation({ summary: 'List contributor obligations' })
  obligationsList(@Req() request: AuthenticatedRequest, @Param('contributorId') contributorId: string): Promise<readonly Record<string, unknown>[]> {
    const user = this.user(request); this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    return this.obligations.list({ agencyId: user.agencyId, contributorId }).then((items) => items.map(serializeObligation));
  }

  @Post(':contributorId/plans/:planId/obligations/generate')
  @ApiOperation({ summary: 'Generate contributor obligations through a business date' })
  generateObligations(@Req() request: AuthenticatedRequest, @Param('contributorId') contributorId: string, @Param('planId') planId: string, @Query('throughDate') throughDate: string): Promise<readonly Record<string, unknown>[]> {
    const user = this.user(request); this.requireRole(user.roles, 'admin');
    return this.obligations.generate({ agencyId: user.agencyId, contributorId, planId, throughDate, actorUserId: user.id }).then((items) => items.map(serializeObligation));
  }

  private user(request: AuthenticatedRequest): NonNullable<AuthenticatedRequest['user']> { if (!request.user) throw new ForbiddenException(); return request.user; }
  private requireRole(roles: readonly string[], role: string): void { if (!roles.includes(role)) throw new ForbiddenException(); }
  private requireAnyRole(roles: readonly string[], allowed: readonly string[]): void { if (!allowed.some((role) => roles.includes(role))) throw new ForbiddenException(); }
}

@Controller({ path: 'contributors', version: '1' })
@ApiTags('Contributors')
export class ContributorInvitationController {
  constructor(private readonly contributors: ContributorManagementService) {}

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a contributor invitation' })
  acceptInvitation(@Body() body: VerifyEmailDto): Promise<Contributor> { return this.contributors.acceptInvitation(body.token); }
}

function parseMinor(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new ForbiddenException('Money must be a non-negative minor-unit integer');
  return BigInt(value);
}

function serializePlan(plan: ContributorPlan): Record<string, unknown> {
  return { ...plan, amountMinor: plan.amountMinor.toString(), targetMinor: plan.targetMinor?.toString() ?? null };
}

function serializeObligation(obligation: ContributorObligation): Record<string, unknown> {
  return { ...obligation, expectedAmountMinor: obligation.expectedAmountMinor.toString(), paidAmountMinor: obligation.paidAmountMinor.toString(), outstandingMinor: obligation.outstandingMinor.toString() };
}
