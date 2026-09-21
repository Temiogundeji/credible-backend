export type ContributorErrorCode =
  | 'contributor_not_found'
  | 'contributor_conflict'
  | 'contributor_identifier_exists'
  | 'contributor_inactive'
  | 'agent_inactive'
  | 'assignment_conflict'
  | 'plan_invalid'
  | 'plan_overlap';

export class ContributorApplicationError extends Error {
  constructor(readonly code: ContributorErrorCode, message: string) {
    super(message);
    this.name = 'ContributorApplicationError';
  }
}
