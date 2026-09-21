export type AgentId = string;
export type AgentStatus = 'active' | 'inactive';

export interface Agent {
  readonly id: AgentId;
  readonly agencyId: string;
  readonly userId: string | null;
  readonly identifier: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly territory: string | null;
  readonly status: AgentStatus;
  readonly version: number;
  readonly deactivatedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AgentAssignment {
  readonly id: string;
  readonly agencyId: string;
  readonly agentId: AgentId;
  readonly territory: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
