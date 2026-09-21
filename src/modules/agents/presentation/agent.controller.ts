import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../identity/presentation/access-token.guard';
import { AccessTokenGuard } from '../../identity/presentation/access-token.guard';
import { AgentManagementService } from '../application/agent-management.service';
import type { Agent, AgentAssignment } from '../domain/agent-types';
import { AssignTerritoryDto } from './dto/assign-territory.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Controller({ path: 'agents', version: '1' })
@UseGuards(AccessTokenGuard)
@ApiTags('Agents')
@ApiBearerAuth('access-token')
export class AgentController {
  constructor(private readonly agents: AgentManagementService) {}

  @Get()
  @ApiOperation({ summary: 'List agency agents' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Tenant-scoped agent list.' })
  list(@Req() request: AuthenticatedRequest, @Query('status') status?: 'active' | 'inactive', @Query('search') search?: string): Promise<readonly Agent[]> {
    const user = this.requireUser(request);
    this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    return this.agents.list({ agencyId: user.agencyId, status, search });
  }

  @Get(':agentId')
  @ApiOperation({ summary: 'Get an agency agent' })
  get(@Req() request: AuthenticatedRequest, @Param('agentId') agentId: string): Promise<Agent> {
    const user = this.requireUser(request);
    this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    return this.agents.get({ agencyId: user.agencyId, agentId });
  }

  @Post()
  @ApiOperation({ summary: 'Create an agent profile' })
  @ApiResponse({ status: 201, description: 'Agent created.' })
  @ApiResponse({ status: 403, description: 'Only agency administrators may create agents.' })
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateAgentDto): Promise<Agent> {
    const user = this.requireUser(request);
    this.requireRole(user.roles, 'admin');
    return this.agents.create({ ...body, agencyId: user.agencyId, actorUserId: user.id });
  }

  @Patch(':agentId')
  @ApiOperation({ summary: 'Update an active agent profile' })
  @ApiResponse({ status: 409, description: 'Optimistic-concurrency conflict.' })
  update(@Req() request: AuthenticatedRequest, @Param('agentId') agentId: string, @Body() body: UpdateAgentDto): Promise<Agent> {
    const user = this.requireUser(request);
    this.requireRole(user.roles, 'admin');
    return this.agents.update({ ...body, agencyId: user.agencyId, actorUserId: user.id, agentId });
  }

  @Delete(':agentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate an agent without deleting history' })
  @ApiResponse({ status: 204, description: 'Agent deactivated.' })
  @ApiResponse({ status: 409, description: 'Optimistic-concurrency conflict.' })
  async deactivate(@Req() request: AuthenticatedRequest, @Param('agentId') agentId: string, @Query('expectedVersion', ParseIntPipe) expectedVersion: number): Promise<void> {
    const user = this.requireUser(request);
    this.requireRole(user.roles, 'admin');
    await this.agents.deactivate({ agencyId: user.agencyId, actorUserId: user.id, agentId, expectedVersion });
  }

  @Get(':agentId/assignments')
  @ApiOperation({ summary: 'List effective-dated territory assignments' })
  assignments(@Req() request: AuthenticatedRequest, @Param('agentId') agentId: string): Promise<readonly AgentAssignment[]> {
    const user = this.requireUser(request);
    this.requireAnyRole(user.roles, ['admin', 'finance_reviewer', 'agent']);
    return this.agents.assignments({ agencyId: user.agencyId, agentId });
  }

  @Post(':agentId/assignments')
  @ApiOperation({ summary: 'Assign a territory to an active agent' })
  @ApiResponse({ status: 201, description: 'Territory assignment created.' })
  assignTerritory(@Req() request: AuthenticatedRequest, @Param('agentId') agentId: string, @Body() body: AssignTerritoryDto): Promise<AgentAssignment> {
    const user = this.requireUser(request);
    this.requireRole(user.roles, 'admin');
    return this.agents.assignTerritory({
      agencyId: user.agencyId,
      actorUserId: user.id,
      agentId,
      territory: body.territory,
      effectiveFrom: new Date(body.effectiveFrom),
    });
  }

  private requireUser(request: AuthenticatedRequest): NonNullable<AuthenticatedRequest['user']> {
    if (!request.user) throw new ForbiddenException();
    return request.user;
  }

  private requireRole(roles: readonly string[], role: string): void {
    if (!roles.includes(role)) throw new ForbiddenException();
  }

  private requireAnyRole(roles: readonly string[], allowed: readonly string[]): void {
    if (!allowed.some((role) => roles.includes(role))) throw new ForbiddenException();
  }
}
