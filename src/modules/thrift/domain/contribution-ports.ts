import type { RecordContributionCommand, ContributionResult } from './contribution-types';

export interface ContributionStore {
  record(command: RecordContributionCommand): Promise<ContributionResult>;
}

export const THRIFT_PORTS = { ContributionStore: Symbol('thrift.contribution-store') } as const;
