import type { AgentEventWriter, AgentRepository } from '../domain/agent-ports';
import type { Agent, AgentAssignment, AgentStatus } from '../domain/agent-types';
import { AgentApplicationError } from './agent-errors';

export interface AgentManagementDependencies {
  readonly agents: AgentRepository;
  readonly events: AgentEventWriter;
  readonly now: () => Date;
}

export interface CreateAgentCommand {
  readonly agencyId: string;
  readonly actorUserId: string;
  readonly identifier: string;
  readonly displayName: string;
  readonly userId?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly territory?: string;
}

export interface UpdateAgentCommand {
  readonly agencyId: string;
  readonly actorUserId: string;
  readonly agentId: string;
  readonly expectedVersion: number;
  readonly displayName?: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly territory?: string | null;
}

export class AgentManagementService {
  constructor(private readonly dependencies: AgentManagementDependencies) {}

  list(input: { agencyId: string; status?: AgentStatus; search?: string }): Promise<readonly Agent[]> {
    return this.dependencies.agents.list(input);
  }

  async get(input: { agencyId: string; agentId: string }): Promise<Agent> {
    const agent = await this.dependencies.agents.findById(input);
    if (!agent) throw new AgentApplicationError('agent_not_found', 'Agent was not found');
    return agent;
  }

  async create(command: CreateAgentCommand): Promise<Agent> {
    const agent = await this.dependencies.agents.create({ ...command, now: this.dependencies.now() });
    await this.record(command.agencyId, command.actorUserId, 'agent_created', agent.id);
    return agent;
  }

  async update(command: UpdateAgentCommand): Promise<Agent> {
    const current = await this.get(command);
    if (current.status === 'inactive') throw new AgentApplicationError('agent_inactive', 'Inactive agents cannot be updated');
    const updated = await this.dependencies.agents.update({ ...command, now: this.dependencies.now() });
    if (!updated) throw new AgentApplicationError('agent_conflict', 'The agent was changed by another request');
    await this.record(command.agencyId, command.actorUserId, 'agent_updated', updated.id, { version: updated.version });
    return updated;
  }

  async deactivate(input: { agencyId: string; actorUserId: string; agentId: string; expectedVersion: number }): Promise<Agent> {
    const current = await this.get(input);
    if (current.status === 'inactive') return current;
    const agent = await this.dependencies.agents.deactivate({ ...input, now: this.dependencies.now() });
    if (!agent) throw new AgentApplicationError('agent_conflict', 'The agent was changed by another request');
    await this.record(input.agencyId, input.actorUserId, 'agent_deactivated', agent.id);
    return agent;
  }

  async assignments(input: { agencyId: string; agentId: string }): Promise<readonly AgentAssignment[]> {
    await this.get(input);
    return this.dependencies.agents.listAssignments(input);
  }

  async assignTerritory(input: {
    agencyId: string;
    actorUserId: string;
    agentId: string;
    territory: string;
    effectiveFrom: Date;
  }): Promise<AgentAssignment> {
    const agent = await this.get(input);
    if (agent.status === 'inactive') throw new AgentApplicationError('agent_inactive', 'Inactive agents cannot receive assignments');
    const assignment = await this.dependencies.agents.assignTerritory({ ...input, now: this.dependencies.now() });
    await this.record(input.agencyId, input.actorUserId, 'agent_territory_assigned', input.agentId, {
      assignmentId: assignment.id,
      territory: assignment.territory,
    });
    return assignment;
  }

  private record(
    agencyId: string,
    actorUserId: string,
    type: string,
    agentId: string,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    return this.dependencies.events.write({ agencyId, actorUserId, type, agentId, occurredAt: this.dependencies.now(), metadata });
  }
}
