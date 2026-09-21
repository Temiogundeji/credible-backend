import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../identity/presentation/access-token.guard';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard';
import { RecordContributionService } from '../application/record-contribution.service';
import type { ContributionResult } from '../domain/contribution-types';
import { RecordContributionDto } from './dto/record-contribution.dto';
import { ContributionImportService } from '../application/contribution-import.service';

@Controller({ path: 'contributors', version: '1' })
@UseGuards(AccessTokenGuard)
@ApiTags('Contributions')
@ApiBearerAuth('access-token')
export class ContributionController {
  constructor(private readonly contributions: RecordContributionService) {}

  @Post(':contributorId/contributions')
  @ApiOperation({ summary: 'Record one collector savings entry atomically' })
  @ApiResponse({ status: 201, description: 'Contribution posted and allocated.' })
  record(@Req() request: AuthenticatedRequest, @Param('contributorId') contributorId: string, @Headers('idempotency-key') idempotencyKey: string | undefined, @Body() body: RecordContributionDto): Promise<ContributionResult> {
    const user = this.user(request);
    this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    const amountMinor = parseMinor(body.amountMinor);
    const businessDate = parseBusinessDate(body.businessDate);
    return this.contributions.record({ agencyId: user.agencyId, actorUserId: user.id, agentId: body.agentId, contributorId, obligationId: body.obligationId, amountMinor, currency: body.currency.trim().toUpperCase(), paymentMethod: body.paymentMethod, businessDate, idempotencyKey: idempotencyKey ?? '', correlationId: request.header('x-correlation-id') });
  }

  private user(request: AuthenticatedRequest): NonNullable<AuthenticatedRequest['user']> { if (!request.user) throw new ForbiddenException('Authentication is required.'); return request.user; }
  private requireAnyRole(roles: readonly string[], allowed: readonly string[]): void { if (!roles.some((role) => allowed.includes(role))) throw new ForbiddenException('You do not have permission to record contributions.'); }
}

@Controller({ path: 'contributions/imports', version: '1' })
@UseGuards(AccessTokenGuard)
@ApiTags('Contribution imports')
@ApiBearerAuth('access-token')
export class ContributionImportController {
  constructor(private readonly imports: ContributionImportService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Stage a collector daily book-register CSV' })
  stage(@Req() request: AuthenticatedRequest, @UploadedFile() file: { readonly originalname: string; readonly buffer: Buffer } | undefined, @Headers('x-agent-id') agentId: string | undefined): Promise<{ id: string; status: string; errors: readonly unknown[] }> {
    const user = this.user(request); this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    if (!file || !agentId) throw new BadRequestException('A CSV file and X-Agent-Id are required.');
    return this.imports.stage({ agencyId: user.agencyId, actorUserId: user.id, agentId, filename: file.originalname, content: file.buffer });
  }

  @Post(':batchId/commit')
  @ApiOperation({ summary: 'Commit a fully validated contribution import' })
  @ApiResponse({ status: 204, description: 'Import committed.' })
  async commit(@Req() request: AuthenticatedRequest, @Param('batchId') batchId: string): Promise<void> {
    const user = this.user(request); this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    await this.imports.commit({ agencyId: user.agencyId, actorUserId: user.id, batchId, correlationId: request.header('x-correlation-id') });
  }

  @Get(':batchId')
  @ApiOperation({ summary: 'Get contribution import status and validation errors' })
  async get(@Req() request: AuthenticatedRequest, @Param('batchId') batchId: string): Promise<{ id: string; status: string; errors: readonly unknown[] }> {
    const user = this.user(request); this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    const result = await this.imports.get({ agencyId: user.agencyId, batchId });
    if (!result) throw new NotFoundException('Contribution import was not found.');
    return result;
  }

  private user(request: AuthenticatedRequest): NonNullable<AuthenticatedRequest['user']> { if (!request.user) throw new ForbiddenException('Authentication is required.'); return request.user; }
  private requireAnyRole(roles: readonly string[], allowed: readonly string[]): void { if (!roles.some((role) => allowed.includes(role))) throw new ForbiddenException('You do not have permission to manage contribution imports.'); }
}

function parseMinor(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new BadRequestException('amountMinor must be a non-negative decimal string');
  const amount = BigInt(value);
  if (amount <= 0n) throw new BadRequestException('amountMinor must be greater than zero');
  return amount;
}

function parseBusinessDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('businessDate must be a valid YYYY-MM-DD date');
  return date;
}
