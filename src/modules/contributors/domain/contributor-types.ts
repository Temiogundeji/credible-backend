export type ContributorStatus = 'invited' | 'pending_verification' | 'active' | 'suspended' | 'deactivated';
export type PlanFrequency = 'daily' | 'weekly';
export type PlanStatus = 'draft' | 'active' | 'suspended' | 'superseded';
export type ObligationStatus = 'scheduled' | 'overdue' | 'partial' | 'paid' | 'credited';

export interface Contributor {
  readonly id: string;
  readonly agencyId: string;
  readonly referenceNumber: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly nextOfKin: Readonly<Record<string, unknown>> | null;
  readonly kycReference: string | null;
  readonly status: ContributorStatus;
  readonly version: number;
  readonly deactivatedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ContributorAssignment {
  readonly id: string;
  readonly agencyId: string;
  readonly contributorId: string;
  readonly agentId: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
}

export interface ContributorPlan {
  readonly id: string;
  readonly agencyId: string;
  readonly contributorId: string;
  readonly frequency: PlanFrequency;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly targetMinor: bigint | null;
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly status: PlanStatus;
  readonly version: number;
}

export interface ContributorObligation {
  readonly id: string;
  readonly agencyId: string;
  readonly contributorId: string;
  readonly planId: string;
  readonly dueDate: Date;
  readonly expectedAmountMinor: bigint;
  readonly paidAmountMinor: bigint;
  readonly outstandingMinor: bigint;
  readonly currency: string;
  readonly status: ObligationStatus;
  readonly policyVersion: string;
}
