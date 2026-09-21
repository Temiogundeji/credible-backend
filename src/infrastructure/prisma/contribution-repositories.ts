import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { assertBalancedJournal } from '../../modules/ledger/domain/ledger-types';
import type { ContributionStore } from '../../modules/thrift/domain/contribution-ports';
import type { ContributionResult, RecordContributionCommand } from '../../modules/thrift/domain/contribution-types';
import { ContributionApplicationError } from '../../modules/thrift/application/contribution-errors';
import { PrismaService } from './prisma.service';

const DEFAULT_ACCOUNTS = [
  { code: '1010', name: 'Agency Cash Collections', type: 'asset' as const },
  { code: '1020', name: 'Agency Bank Account', type: 'asset' as const },
  { code: '2010', name: 'Contributor Thrift Liability', type: 'liability' as const },
  { code: '2020', name: 'Contributor Overpayment Credit', type: 'liability' as const },
  { code: '3010', name: 'Agency Opening Equity', type: 'equity' as const },
  { code: '4010', name: 'Thrift Agency Entitlement Revenue', type: 'revenue' as const },
  { code: '9990', name: 'Ledger Suspense - Restricted', type: 'liability' as const },
];

type Executor = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class PrismaContributionStore implements ContributionStore {
  constructor(private readonly prisma: PrismaService) {}

  async record(command: RecordContributionCommand): Promise<ContributionResult> {
    return this.prisma.runInTransaction(async () => {
      const executor = this.prisma.currentExecutor();
      const existing = await executor.contribution.findFirst({
        where: { agencyId: command.agencyId, idempotencyKey: command.idempotencyKey },
        include: { allocations: true },
      });
      if (existing) return mapResult(existing);

      await this.ensureDefaultAccounts(executor, command.agencyId);
      await this.assertCollectorScope(executor, command);

      const contributor = await executor.contributor.findFirst({ where: { id: command.contributorId, agencyId: command.agencyId } });
      if (!contributor || contributor.status === 'deactivated') throw new ContributionApplicationError('contributor_not_found', 'Contributor was not found in this agency.');

      const obligation = command.obligationId
        ? await executor.contributorObligation.findFirst({ where: { id: command.obligationId, agencyId: command.agencyId, contributorId: command.contributorId } })
        : await executor.contributorObligation.findFirst({
          where: { agencyId: command.agencyId, contributorId: command.contributorId, currency: command.currency, outstandingMinor: { gt: 0n }, dueDate: { lte: command.businessDate } },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        });
      if (command.obligationId && !obligation) throw new ContributionApplicationError('obligation_not_found', 'The obligation does not belong to this contributor and agency.');
      if (obligation && obligation.currency !== command.currency) throw new ContributionApplicationError('currency_mismatch', 'Contribution currency does not match the obligation.');

      const allocated = obligation ? min(command.amountMinor, obligation.outstandingMinor) : 0n;
      const credited = command.amountMinor - allocated;
      const contributionId = randomUUID();
      const journalId = randomUUID();
      const accounts = await this.accountsByCode(executor, command.agencyId, ['1010', '2010', '2020']);
      const cash = accounts.get('1010');
      const liability = accounts.get('2010');
      const creditAccount = accounts.get('2020');
      if (!cash || !liability || (credited > 0n && !creditAccount)) throw new ContributionApplicationError('ledger_not_configured', 'The agency ledger accounts are not configured.');

      const lines = [
        { accountId: cash.id, direction: 'debit' as const, amountMinor: command.amountMinor },
        ...(allocated > 0n ? [{ accountId: liability.id, direction: 'credit' as const, amountMinor: allocated }] : []),
        ...(credited > 0n ? [{ accountId: creditAccount!.id, direction: 'credit' as const, amountMinor: credited }] : []),
      ];
      assertBalancedJournal({ currency: command.currency, lines: lines.map((line) => ({ accountCode: line.accountId, direction: line.direction, amountMinor: line.amountMinor })) });

      await executor.ledgerJournal.create({
        data: {
          id: journalId, agencyId: command.agencyId, sourceType: 'CONTRIBUTION', sourceId: contributionId,
          commandType: 'RECORD_CONTRIBUTION', idempotencyKey: command.idempotencyKey, currency: command.currency,
          status: 'posted', actorId: command.actorUserId, correlationId: command.correlationId, postedAt: new Date(),
          lines: { create: lines },
        },
      });
      await executor.contribution.create({
        data: {
          id: contributionId, agencyId: command.agencyId, contributorId: command.contributorId, obligationId: obligation?.id,
          agentId: command.agentId, amountMinor: command.amountMinor, currency: command.currency, paymentMethod: command.paymentMethod,
          businessDate: command.businessDate, status: 'posted', idempotencyKey: command.idempotencyKey, journalId,
        },
      });

      if (obligation && allocated > 0n) {
        const updated = await executor.contributorObligation.updateMany({
          where: { id: obligation.id, version: obligation.version, outstandingMinor: { gte: allocated } },
          data: { paidAmountMinor: { increment: allocated }, outstandingMinor: { decrement: allocated }, version: { increment: 1 }, status: allocated === obligation.outstandingMinor ? 'paid' : 'partial' },
        });
        if (updated.count !== 1) throw new ContributionApplicationError('concurrent_update', 'The obligation changed while the contribution was being posted. Please retry.');
        await executor.contributionAllocation.create({ data: { agencyId: command.agencyId, contributionId, obligationId: obligation.id, amountMinor: allocated, allocationType: 'obligation' } });
      }
      if (credited > 0n) {
        const credit = await executor.contributorCredit.create({ data: { agencyId: command.agencyId, contributorId: command.contributorId, sourceContributionId: contributionId, originalAmountMinor: credited, remainingAmountMinor: credited, currency: command.currency, status: 'available' } });
        await executor.contributionAllocation.create({ data: { agencyId: command.agencyId, contributionId, creditId: credit.id, amountMinor: credited, allocationType: 'overpayment_credit' } });
      }
      return { id: contributionId, amountMinor: command.amountMinor, allocatedToObligationMinor: allocated, creditedMinor: credited, status: 'posted' };
    });
  }

  private async ensureDefaultAccounts(executor: Executor, agencyId: string): Promise<void> {
    await executor.ledgerAccount.createMany({ data: DEFAULT_ACCOUNTS.map((account) => ({ agencyId, ...account, status: 'active' as const })), skipDuplicates: true });
  }

  private async accountsByCode(executor: Executor, agencyId: string, codes: readonly string[]): Promise<Map<string, { id: string }>> {
    const rows = await executor.ledgerAccount.findMany({ where: { agencyId, code: { in: [...codes] }, status: 'active' }, select: { id: true, code: true } });
    return new Map(rows.map((row) => [row.code, { id: row.id }]));
  }

  private async assertCollectorScope(executor: Executor, command: RecordContributionCommand): Promise<void> {
    const agent = await executor.agent.findFirst({ where: { id: command.agentId, agencyId: command.agencyId, status: 'active' } });
    if (!agent) throw new ContributionApplicationError('agent_not_found', 'The collecting agent is not active in this agency.');
    const actingAgent = await executor.agent.findFirst({ where: { agencyId: command.agencyId, userId: command.actorUserId, status: 'active' } });
    if (actingAgent && actingAgent.id !== command.agentId) throw new ContributionApplicationError('agent_scope_violation', 'An agent may only record contributions for their own collector account.');
    const assignment = await executor.contributorAssignment.findFirst({
      where: { agencyId: command.agencyId, contributorId: command.contributorId, agentId: command.agentId, effectiveFrom: { lte: command.businessDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: command.businessDate } }] },
    });
    if (!assignment) throw new ContributionApplicationError('assignment_required', 'The contributor is not assigned to this collecting agent for the business date.');
  }
}

function min(left: bigint, right: bigint): bigint { return left < right ? left : right; }

function mapResult(value: { id: string; amountMinor: bigint; status: 'posted' | 'reversed'; allocations: readonly { allocationType: 'obligation' | 'overpayment_credit'; amountMinor: bigint }[] }): ContributionResult {
  return {
    id: value.id,
    amountMinor: value.amountMinor,
    allocatedToObligationMinor: value.allocations.filter((allocation) => allocation.allocationType === 'obligation').reduce((sum, allocation) => sum + allocation.amountMinor, 0n),
    creditedMinor: value.allocations.filter((allocation) => allocation.allocationType === 'overpayment_credit').reduce((sum, allocation) => sum + allocation.amountMinor, 0n),
    status: value.status,
  };
}
