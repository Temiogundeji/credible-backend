import type { ContributorEventWriter, ContributorRepository } from '../domain/contributor-ports';
import type { ContributorObligation } from '../domain/contributor-types';
import type { BusinessDatePolicy } from '../../../shared/domain/time/business-date-policy';
import { ContributorApplicationError } from './contributor-errors';

export class ObligationGenerationService {
  constructor(private readonly repository: ContributorRepository, private readonly events: ContributorEventWriter, private readonly policy: BusinessDatePolicy, private readonly now: () => Date) {}

  list(input: { agencyId: string; contributorId: string }): Promise<readonly ContributorObligation[]> { return this.repository.listObligations(input); }

  async generate(input: { agencyId: string; contributorId: string; planId: string; throughDate: string; actorUserId: string }): Promise<readonly ContributorObligation[]> {
    const plans = await this.repository.listPlans({ agencyId: input.agencyId, contributorId: input.contributorId });
    const plan = plans.find((item) => item.id === input.planId);
    if (!plan) throw new ContributorApplicationError('contributor_not_found', 'Contributor plan was not found');
    const timezone = 'Africa/Lagos';
    assertDate(input.throughDate);
    const through = input.throughDate;
    const first = formatDate(plan.startDate);
    if (through < first) return [];
    const dates: string[] = [];
    for (let due = first; due <= through; due = this.policy.nextDueDate({ frequency: plan.frequency, dueDate: due, timezone })) {
      if (plan.endDate && due > formatDate(plan.endDate)) break;
      dates.push(due);
    }
    const created = await this.repository.createObligations({ agencyId: input.agencyId, contributorId: input.contributorId, planId: plan.id, obligations: dates.map((dueDate) => ({ dueDate: parseDate(dueDate), expectedAmountMinor: plan.amountMinor, currency: plan.currency, policyVersion: this.policy.version })), now: this.now() });
    await this.events.write({ agencyId: input.agencyId, actorUserId: input.actorUserId, contributorId: input.contributorId, type: 'contributor_obligations_generated', occurredAt: this.now(), metadata: { planId: plan.id, throughDate: input.throughDate, count: created.length, policyVersion: this.policy.version } });
    return created;
  }
}

function parseDate(value: string): Date { assertDate(value); return new Date(`${value}T00:00:00.000Z`); }
function assertDate(value: string): void { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) throw new ContributorApplicationError('plan_invalid', 'Date must use YYYY-MM-DD'); }
function formatDate(value: Date): string { return value.toISOString().slice(0, 10); }
