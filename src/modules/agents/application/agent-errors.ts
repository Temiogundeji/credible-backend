export type AgentErrorCode =
  | 'agent_not_found'
  | 'agent_inactive'
  | 'agent_conflict'
  | 'agent_identifier_exists'
  | 'agent_assignment_conflict';

export class AgentApplicationError extends Error {
  constructor(readonly code: AgentErrorCode, message: string) {
    super(message);
    this.name = 'AgentApplicationError';
  }
}
