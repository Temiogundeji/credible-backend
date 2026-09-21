import type { ContributionPaymentMethod, ContributionResult } from './contribution-types';

export interface ContributionImportRowInput {
  readonly rowNumber: number;
  readonly contributorReference: string;
  readonly collectionDate: Date;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly paymentMethod: ContributionPaymentMethod;
  readonly bookEntryReference: string;
  readonly raw: Readonly<Record<string, string>>;
}

export interface ContributionImportError {
  readonly rowNumber: number;
  readonly code: string;
  readonly message: string;
}

export interface ContributionImportStore {
  stage(input: { agencyId: string; uploadedByUserId: string; agentId: string; originalFilename: string; contentHash: string; rows: readonly ContributionImportRowInput[]; errors: readonly ContributionImportError[] }): Promise<{ readonly id: string; readonly status: 'ready' | 'rejected'; readonly errors: readonly ContributionImportError[] }>;
  get(input: { agencyId: string; batchId: string }): Promise<{ readonly id: string; readonly status: string; readonly errors: readonly ContributionImportError[] } | null>;
  commit(input: { agencyId: string; batchId: string; post: (row: ContributionImportRowInput & { readonly contributorId: string; readonly agentId: string }) => Promise<ContributionResult> }): Promise<void>;
}

export const CONTRIBUTION_IMPORT_PORTS = { Store: Symbol('contribution-import.store') } as const;
