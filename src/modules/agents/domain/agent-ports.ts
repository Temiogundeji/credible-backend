import type { Agent, AgentAssignment, AgentId, AgentStatus } from './agent-types';

export interface AgentRepository {
  list(input: { agencyId: string; status?: AgentStatus; search?: string }): Promise<readonly Agent[]>;
  findById(input: { agencyId: string; agentId: AgentId }): Promise<Agent | null>;
  create(input: {
    agencyId: string;
    userId?: string;
    identifier: string;
    displayName: string;
    email?: string;
    phone?: string;
    territory?: string;
    now: Date;
  }): Promise<Agent>;
  update(input: {
    agencyId: string;
    agentId: AgentId;
    expectedVersion: number;
    displayName?: string;
    email?: string | null;
    phone?: string | null;
    territory?: string | null;
    now: Date;
  }): Promise<Agent | null>;
  deactivate(input: { agencyId: string; agentId: AgentId; expectedVersion: number; now: Date }): Promise<Agent | null>;
  listAssignments(input: { agencyId: string; agentId: AgentId }): Promise<readonly AgentAssignment[]>;
  assignTerritory(input: {
    agencyId: string;
    agentId: AgentId;
    territory: string;
    effectiveFrom: Date;
    now: Date;
  }): Promise<AgentAssignment>;
}

export interface AgentEventWriter {
  write(input: {
    agencyId: string;
    actorUserId: string;
    type: string;
    agentId: AgentId;
    occurredAt: Date;
    metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void>;
}

export const AGENT_PORTS = {
  AgentRepository: Symbol('AgentRepository'),
  AgentEventWriter: Symbol('AgentEventWriter'),
} as const;
