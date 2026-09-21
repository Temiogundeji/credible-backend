import type { LedgerJournalDraft } from './ledger-types';

export interface LedgerAccountRef {
  readonly id: string;
  readonly code: string;
  readonly currency?: string;
}

export interface LedgerRepository {
  ensureDefaultAccounts(input: { agencyId: string }): Promise<void>;
  findAccountsByCodes(input: { agencyId: string; codes: readonly string[] }): Promise<ReadonlyMap<string, LedgerAccountRef>>;
  createPostedJournal(input: {
    agencyId: string;
    sourceType: string;
    sourceId: string;
    commandType: string;
    idempotencyKey: string;
    actorId: string;
    correlationId?: string;
    journal: LedgerJournalDraft;
  }): Promise<{ readonly id: string }>;
}

export const LEDGER_PORTS = { Repository: Symbol('ledger.repository') } as const;
