export type ContributionPaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money';
export type ContributionStatus = 'posted' | 'reversed';

export interface RecordContributionCommand {
  readonly agencyId: string;
  readonly actorUserId: string;
  readonly agentId: string;
  readonly contributorId: string;
  readonly obligationId?: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly paymentMethod: ContributionPaymentMethod;
  readonly businessDate: Date;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
}

export interface ContributionResult {
  readonly id: string;
  readonly amountMinor: bigint;
  readonly allocatedToObligationMinor: bigint;
  readonly creditedMinor: bigint;
  readonly status: ContributionStatus;
}
