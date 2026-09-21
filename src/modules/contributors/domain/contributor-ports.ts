import type { Contributor, ContributorAssignment, ContributorObligation, ContributorPlan, ContributorStatus, PlanFrequency } from './contributor-types';

export interface ContributorRepository {
  list(input: { agencyId: string; status?: ContributorStatus; search?: string; agentId?: string }): Promise<readonly Contributor[]>;
  findById(input: { agencyId: string; contributorId: string }): Promise<Contributor | null>;
  create(input: {
    agencyId: string; referenceNumber: string; fullName: string; email?: string; phone?: string; address?: string;
    nextOfKin?: Readonly<Record<string, unknown>>; kycReference?: string; now: Date;
  }): Promise<Contributor>;
  createBatch(input: { agencyId: string; rows: readonly { referenceNumber: string; fullName: string; email?: string; phone?: string; address?: string }[]; now: Date }): Promise<readonly Contributor[]>;
  update(input: {
    agencyId: string; contributorId: string; expectedVersion: number; fullName?: string; email?: string | null;
    phone?: string | null; address?: string | null; nextOfKin?: Readonly<Record<string, unknown>> | null; now: Date;
  }): Promise<Contributor | null>;
  changeStatus(input: { agencyId: string; contributorId: string; expectedVersion: number; status: ContributorStatus; now: Date }): Promise<Contributor | null>;
  listAssignments(input: { agencyId: string; contributorId: string }): Promise<readonly ContributorAssignment[]>;
  assign(input: { agencyId: string; contributorId: string; agentId: string; effectiveFrom: Date; now: Date }): Promise<ContributorAssignment>;
  listPlans(input: { agencyId: string; contributorId: string }): Promise<readonly ContributorPlan[]>;
  createPlan(input: {
    agencyId: string; contributorId: string; frequency: PlanFrequency; amountMinor: bigint; currency: string;
    targetMinor?: bigint; startDate: Date; endDate?: Date; now: Date;
  }): Promise<ContributorPlan>;
  listObligations(input: { agencyId: string; contributorId: string; from?: Date; to?: Date }): Promise<readonly ContributorObligation[]>;
  createObligations(input: { agencyId: string; contributorId: string; planId: string; obligations: readonly { dueDate: Date; expectedAmountMinor: bigint; currency: string; policyVersion: string }[]; now: Date }): Promise<readonly ContributorObligation[]>;
  issueInvitation(input: { agencyId: string; contributorId: string; email: string; tokenHash: string; expiresAt: Date; now: Date }): Promise<void>;
  consumeInvitation(input: { tokenHash: string; now: Date }): Promise<Contributor | null>;
}

export interface ContributorEventWriter {
  write(input: { agencyId: string; actorUserId: string; contributorId: string; type: string; occurredAt: Date; metadata?: Readonly<Record<string, unknown>> }): Promise<void>;
}

export interface ContributorEmailService {
  sendContributorInvitationEmail(input: { recipient: string; token: string; invitationUrl: string }): Promise<void>;
}

export interface ContributorTokenGenerator {
  generate(): string;
  hash(token: string): string;
}

export const CONTRIBUTOR_PORTS = {
  Repository: Symbol('contributor.repository'),
  EventWriter: Symbol('contributor.event-writer'),
  Email: Symbol('contributor.email'),
  TokenGenerator: Symbol('contributor.token-generator'),
} as const;
