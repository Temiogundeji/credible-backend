import { ContributionApplicationError } from './contribution-errors';
import type { ContributionStore } from '../domain/contribution-ports';
import type { ContributionResult, RecordContributionCommand } from '../domain/contribution-types';

export class RecordContributionService {
  constructor(private readonly store: ContributionStore) {}

  record(command: RecordContributionCommand): Promise<ContributionResult> {
    if (!command.agencyId || !command.actorUserId || !command.agentId || !command.contributorId) {
      throw new ContributionApplicationError('invalid_context', 'Agency, actor, agent, and contributor are required.');
    }
    if (command.amountMinor <= 0n) throw new ContributionApplicationError('invalid_amount', 'Contribution amount must be greater than zero.');
    if (!/^[A-Z]{3}$/.test(command.currency)) throw new ContributionApplicationError('invalid_currency', 'Currency must be a three-letter uppercase code.');
    if (!command.idempotencyKey.trim()) throw new ContributionApplicationError('missing_idempotency_key', 'Idempotency-Key is required.');
    if (!['cash', 'bank_transfer', 'mobile_money'].includes(command.paymentMethod)) throw new ContributionApplicationError('invalid_payment_method', 'Payment method is not supported.');
    return this.store.record({ ...command, currency: command.currency.toUpperCase(), idempotencyKey: command.idempotencyKey.trim() });
  }
}
