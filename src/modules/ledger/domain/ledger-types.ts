export type LedgerDirection = 'debit' | 'credit';

export interface LedgerLineDraft {
  readonly accountCode: string;
  readonly direction: LedgerDirection;
  readonly amountMinor: bigint;
  readonly memo?: string;
}

export interface LedgerJournalDraft {
  readonly currency: string;
  readonly lines: readonly LedgerLineDraft[];
}

export function assertBalancedJournal(journal: LedgerJournalDraft): void {
  if (!/^[A-Z]{3}$/.test(journal.currency)) throw new Error('Ledger currency must be a three-letter uppercase code');
  if (journal.lines.length < 2) throw new Error('A journal must contain at least two lines');

  let debits = 0n;
  let credits = 0n;
  for (const line of journal.lines) {
    if (line.amountMinor <= 0n) throw new Error('Ledger line amounts must be positive');
    if (line.direction === 'debit') debits += line.amountMinor;
    else credits += line.amountMinor;
  }
  if (debits !== credits) throw new Error('Ledger journal is not balanced');
}
