import { ContributionApplicationError } from './contribution-errors';
import { createHash } from 'node:crypto';
import { parseContributionCsv } from './contribution-import-parser';
import type { ContributionImportStore } from '../domain/contribution-import-types';
import type { ContributionPaymentMethod, ContributionResult } from '../domain/contribution-types';

export class ContributionImportService {
  constructor(private readonly imports: ContributionImportStore, private readonly postContribution: (input: { agencyId: string; actorUserId: string; agentId: string; contributorId: string; amountMinor: bigint; currency: string; paymentMethod: ContributionPaymentMethod; businessDate: Date; idempotencyKey: string; correlationId?: string }) => Promise<ContributionResult>) {}

  async stage(input: { agencyId: string; actorUserId: string; agentId: string; filename: string; content: Buffer }): Promise<{ id: string; status: string; errors: readonly unknown[] }> {
    let parsed;
    try { parsed = parseContributionCsv(input.content.toString('utf8')); } catch (error) { throw new ContributionApplicationError('invalid_import', error instanceof Error ? error.message : 'CSV file is invalid.'); }
    const contentHash = createHash('sha256').update(input.content).digest('hex');
    const result = await this.imports.stage({ agencyId: input.agencyId, uploadedByUserId: input.actorUserId, agentId: input.agentId, originalFilename: input.filename, contentHash, rows: parsed.rows, errors: parsed.errors });
    return result;
  }

  get(input: { agencyId: string; batchId: string }): Promise<{ id: string; status: string; errors: readonly unknown[] } | null> { return this.imports.get(input); }

  commit(input: { agencyId: string; actorUserId: string; batchId: string; correlationId?: string }): Promise<void> {
    return this.imports.commit({ agencyId: input.agencyId, batchId: input.batchId, post: (row) => this.postContribution({ agencyId: input.agencyId, actorUserId: input.actorUserId, agentId: row.agentId, contributorId: row.contributorId, amountMinor: row.amountMinor, currency: row.currency, paymentMethod: row.paymentMethod, businessDate: row.collectionDate, idempotencyKey: `IMPORT:${input.batchId}:${row.bookEntryReference}`, correlationId: input.correlationId }) });
  }
}
