import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ContributionImportError, ContributionImportRowInput, ContributionImportStore } from '../../modules/thrift/domain/contribution-import-types';
import type { ContributionResult } from '../../modules/thrift/domain/contribution-types';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaContributionImportRepository implements ContributionImportStore {
  constructor(private readonly prisma: PrismaService) {}

  async stage(input: { agencyId: string; uploadedByUserId: string; agentId: string; originalFilename: string; contentHash: string; rows: readonly ContributionImportRowInput[]; errors: readonly ContributionImportError[] }): Promise<{ id: string; status: 'ready' | 'rejected'; errors: readonly ContributionImportError[] }> {
    return this.prisma.runInTransaction(async () => {
      const executor = this.prisma.currentExecutor();
      const agent = await executor.agent.findFirst({ where: { id: input.agentId, agencyId: input.agencyId, status: 'active' } });
      const errors: ContributionImportError[] = [...input.errors];
      if (!agent) errors.push({ rowNumber: 0, code: 'agent_not_found', message: 'The collecting agent is not active in this agency.' });
      const validated = [] as { row: ContributionImportRowInput; contributorId: string }[];
      for (const row of input.rows) {
        const contributor = await executor.contributor.findFirst({ where: { agencyId: input.agencyId, referenceNumber: row.contributorReference, status: { not: 'deactivated' } } });
        if (!contributor) { errors.push({ rowNumber: row.rowNumber, code: 'contributor_not_found', message: 'Contributor reference does not belong to this agency.' }); continue; }
        const assignment = await executor.contributorAssignment.findFirst({ where: { agencyId: input.agencyId, contributorId: contributor.id, agentId: input.agentId, effectiveFrom: { lte: row.collectionDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: row.collectionDate } }] } });
        if (!assignment) { errors.push({ rowNumber: row.rowNumber, code: 'assignment_required', message: 'Contributor was not assigned to this agent on the collection date.' }); continue; }
        validated.push({ row, contributorId: contributor.id });
      }
      const batch = await executor.contributionImportBatch.create({ data: { agencyId: input.agencyId, uploadedByUserId: input.uploadedByUserId, agentId: input.agentId, originalFilename: input.originalFilename.slice(0, 255), contentHash: input.contentHash, status: errors.length ? 'rejected' : 'ready', totalRows: input.rows.length, validRows: errors.length ? 0 : input.rows.length, invalidRows: errors.length, validationErrors: errors as unknown as Prisma.InputJsonValue } });
      await executor.contributionImportRow.createMany({ data: input.rows.map((row) => { const rowError = errors.find((error) => error.rowNumber === row.rowNumber); return { batchId: batch.id, rowNumber: row.rowNumber, contributorReference: row.contributorReference, collectionDate: row.collectionDate, amountMinor: row.amountMinor, currency: row.currency, paymentMethod: row.paymentMethod, bookEntryReference: row.bookEntryReference, status: rowError ? 'invalid' : 'valid', errorCode: rowError?.code, errorMessage: rowError?.message, raw: row.raw as Prisma.InputJsonValue }; }) });
      void validated;
      return { id: batch.id, status: batch.status as 'ready' | 'rejected', errors };
    });
  }

  async get(input: { agencyId: string; batchId: string }): Promise<{ id: string; status: string; errors: readonly ContributionImportError[] } | null> {
    const batch = await this.prisma.currentExecutor().contributionImportBatch.findFirst({ where: { id: input.batchId, agencyId: input.agencyId }, include: { rows: { where: { status: 'invalid' }, orderBy: { rowNumber: 'asc' } } } });
    const storedErrors = Array.isArray(batch?.validationErrors) ? batch.validationErrors as unknown as ContributionImportError[] : [];
    return batch ? { id: batch.id, status: batch.status, errors: [...storedErrors, ...batch.rows.map((row) => ({ rowNumber: row.rowNumber, code: row.errorCode ?? 'invalid_row', message: row.errorMessage ?? 'Row is invalid.' }))] } : null;
  }

  async commit(input: { agencyId: string; batchId: string; post: (row: ContributionImportRowInput & { contributorId: string; agentId: string }) => Promise<ContributionResult> }): Promise<void> {
    await this.prisma.runInTransaction(async () => {
      const executor = this.prisma.currentExecutor();
      const batch = await executor.contributionImportBatch.findFirst({ where: { id: input.batchId, agencyId: input.agencyId, status: 'ready' }, include: { rows: true } });
      if (!batch) throw new Error('Import batch is not ready for commit.');
      for (const row of batch.rows) {
        const contributor = await executor.contributor.findFirst({ where: { agencyId: input.agencyId, referenceNumber: row.contributorReference } });
        if (!contributor) throw new Error(`Contributor for import row ${row.rowNumber} no longer exists.`);
        const result = await input.post({ rowNumber: row.rowNumber, contributorReference: row.contributorReference, collectionDate: row.collectionDate, amountMinor: row.amountMinor, currency: row.currency, paymentMethod: row.paymentMethod, bookEntryReference: row.bookEntryReference, raw: row.raw as Record<string, string>, contributorId: contributor.id, agentId: batch.agentId });
        await executor.contributionImportRow.update({ where: { id: row.id }, data: { status: 'committed', contributionId: result.id } });
      }
      await executor.contributionImportBatch.update({ where: { id: batch.id }, data: { status: 'committed', committedAt: new Date() } });
    });
  }
}
