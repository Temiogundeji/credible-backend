import type { ContributorEmailService, ContributorEventWriter, ContributorRepository, ContributorTokenGenerator } from '../domain/contributor-ports';
import type { Contributor, ContributorAssignment, ContributorPlan, ContributorStatus, PlanFrequency } from '../domain/contributor-types';
import { ContributorApplicationError } from './contributor-errors';
import type { BusinessDatePolicy } from '../../../shared/domain/time/business-date-policy';

export interface ContributorManagementDependencies {
  readonly repository: ContributorRepository;
  readonly events: ContributorEventWriter;
  readonly now: () => Date;
  readonly tokenGenerator: ContributorTokenGenerator;
  readonly email: ContributorEmailService;
  readonly frontendUrl: string;
  readonly businessDatePolicy: BusinessDatePolicy;
}

export class ContributorManagementService {
  constructor(private readonly dependencies: ContributorManagementDependencies) {}

  list(input: { agencyId: string; status?: ContributorStatus; search?: string; agentId?: string }): Promise<readonly Contributor[]> {
    return this.dependencies.repository.list(input);
  }

  async get(input: { agencyId: string; contributorId: string }): Promise<Contributor> {
    const contributor = await this.dependencies.repository.findById(input);
    if (!contributor) throw new ContributorApplicationError('contributor_not_found', 'Contributor was not found');
    return contributor;
  }

  async acceptInvitation(token: string): Promise<Contributor> {
    const contributor = await this.dependencies.repository.consumeInvitation({ tokenHash: this.dependencies.tokenGenerator.hash(token), now: this.dependencies.now() });
    if (!contributor) throw new ContributorApplicationError('contributor_not_found', 'Invitation is invalid or expired');
    return contributor;
  }

  async create(input: {
    agencyId: string; actorUserId: string; referenceNumber: string; fullName: string; email?: string; phone?: string;
    address?: string; nextOfKin?: Readonly<Record<string, unknown>>; kycReference?: string;
  }): Promise<Contributor> {
    const contributor = await this.dependencies.repository.create({ ...input, now: this.dependencies.now() });
    await this.record(input.agencyId, input.actorUserId, contributor.id, 'contributor_created');
    if (contributor.email) {
      const token = this.dependencies.tokenGenerator.generate();
      await this.dependencies.repository.issueInvitation({
        agencyId: input.agencyId,
        contributorId: contributor.id,
        email: contributor.email,
        tokenHash: this.dependencies.tokenGenerator.hash(token),
        expiresAt: new Date(this.dependencies.now().getTime() + 24 * 60 * 60 * 1000),
        now: this.dependencies.now(),
      });
      await this.dependencies.email.sendContributorInvitationEmail({ recipient: contributor.email, token, invitationUrl: `${this.dependencies.frontendUrl}/contributor-invite` });
      await this.record(input.agencyId, input.actorUserId, contributor.id, 'contributor_invited');
    }
    return contributor;
  }

  async createBatch(input: { agencyId: string; actorUserId: string; rows: readonly { referenceNumber: string; fullName: string; email?: string; phone?: string; address?: string }[] }): Promise<readonly Contributor[]> {
    const errors = new Map<string, string>();
    const references = new Set<string>();
    input.rows.forEach((row, index) => {
      const reference = row.referenceNumber.trim().toLowerCase();
      if (reference.length < 2) errors.set(`${index + 1}.referenceNumber`, 'reference_required');
      if (references.has(reference)) errors.set(`${index + 1}.referenceNumber`, 'duplicate_batch_reference');
      references.add(reference);
      if (row.fullName.trim().length < 2) errors.set(`${index + 1}.fullName`, 'full_name_required');
    });
    if (errors.size > 0) throw new ContributorApplicationError('plan_invalid', JSON.stringify([...errors.entries()]));
    const contributors = await this.dependencies.repository.createBatch({ agencyId: input.agencyId, rows: input.rows, now: this.dependencies.now() });
    for (const contributor of contributors) {
      await this.record(input.agencyId, input.actorUserId, contributor.id, 'contributor_created');
    }
    return contributors;
  }

  async update(input: {
    agencyId: string; actorUserId: string; contributorId: string; expectedVersion: number; fullName?: string;
    email?: string | null; phone?: string | null; address?: string | null; nextOfKin?: Readonly<Record<string, unknown>> | null;
  }): Promise<Contributor> {
    const current = await this.get(input);
    if (current.status === 'deactivated') throw new ContributorApplicationError('contributor_inactive', 'Deactivated contributors cannot be updated');
    const updated = await this.dependencies.repository.update({ ...input, now: this.dependencies.now() });
    if (!updated) throw new ContributorApplicationError('contributor_conflict', 'The contributor was changed by another request');
    await this.record(input.agencyId, input.actorUserId, updated.id, 'contributor_updated', { version: updated.version });
    return updated;
  }

  async changeStatus(input: { agencyId: string; actorUserId: string; contributorId: string; expectedVersion: number; status: ContributorStatus }): Promise<Contributor> {
    const current = await this.get(input);
    if (current.status === 'deactivated') return current;
    const updated = await this.dependencies.repository.changeStatus({ ...input, now: this.dependencies.now() });
    if (!updated) throw new ContributorApplicationError('contributor_conflict', 'The contributor was changed by another request');
    await this.record(input.agencyId, input.actorUserId, updated.id, `contributor_${input.status}`);
    return updated;
  }

  async assignments(input: { agencyId: string; contributorId: string }): Promise<readonly ContributorAssignment[]> {
    await this.get(input);
    return this.dependencies.repository.listAssignments(input);
  }

  async assign(input: { agencyId: string; actorUserId: string; contributorId: string; agentId: string; effectiveFrom: Date }): Promise<ContributorAssignment> {
    const contributor = await this.get(input);
    if (contributor.status === 'deactivated') throw new ContributorApplicationError('contributor_inactive', 'Deactivated contributors cannot be assigned');
    const assignment = await this.dependencies.repository.assign({ ...input, now: this.dependencies.now() });
    await this.record(input.agencyId, input.actorUserId, input.contributorId, 'contributor_assignment_created', { agentId: input.agentId });
    return assignment;
  }

  async plans(input: { agencyId: string; contributorId: string }): Promise<readonly ContributorPlan[]> {
    await this.get(input);
    return this.dependencies.repository.listPlans(input);
  }

  async createPlan(input: {
    agencyId: string; actorUserId: string; contributorId: string; frequency: PlanFrequency; amountMinor: bigint;
    currency: string; targetMinor?: bigint; startDate: Date; endDate?: Date;
  }): Promise<ContributorPlan> {
    const contributor = await this.get(input);
    if (contributor.status === 'deactivated') throw new ContributorApplicationError('contributor_inactive', 'Deactivated contributors cannot receive plans');
    if (input.amountMinor <= 0n || (input.targetMinor !== undefined && input.targetMinor <= 0n) || (input.endDate && input.endDate < input.startDate)) {
      throw new ContributorApplicationError('plan_invalid', 'Plan amount and date range are invalid');
    }
    try {
      const timezone = 'Africa/Lagos';
      const today = this.dependencies.businessDatePolicy.businessDateAt({ instant: this.dependencies.now(), timezone });
      this.dependencies.businessDatePolicy.assertStartDate({ startDate: formatDate(input.startDate), today, timezone });
    } catch (error) {
      if (error instanceof Error && error.message === 'past_date') throw new ContributorApplicationError('plan_invalid', 'Plan start date cannot be in the past');
      throw new ContributorApplicationError('plan_invalid', 'Plan start date is not valid');
    }
    const plan = await this.dependencies.repository.createPlan({ ...input, now: this.dependencies.now() });
    await this.record(input.agencyId, input.actorUserId, input.contributorId, 'contributor_plan_created', { planId: plan.id, frequency: input.frequency });
    return plan;
  }

  private record(agencyId: string, actorUserId: string, contributorId: string, type: string, metadata?: Readonly<Record<string, unknown>>): Promise<void> {
    return this.dependencies.events.write({ agencyId, actorUserId, contributorId, type, occurredAt: this.dependencies.now(), metadata });
  }
}

function formatDate(value: Date): string { return value.toISOString().slice(0, 10); }
