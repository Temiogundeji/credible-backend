import type { ContributionImportError, ContributionImportRowInput } from '../domain/contribution-import-types';
import type { ContributionPaymentMethod } from '../domain/contribution-types';

const HEADERS = ['contributorReferenceNumber', 'collectionDate', 'amountMinor', 'currency', 'paymentMethod', 'bookEntryReference'] as const;
const PAYMENT_METHODS = new Set<ContributionPaymentMethod>(['cash', 'bank_transfer', 'mobile_money']);

export function parseContributionCsv(content: string): { readonly rows: readonly ContributionImportRowInput[]; readonly errors: readonly ContributionImportError[] } {
  if (Buffer.byteLength(content, 'utf8') > 5 * 1024 * 1024) throw new Error('CSV file exceeds the 5 MB limit.');
  const records = parseCsv(content);
  if (records.length === 0) throw new Error('CSV file is empty.');
  const header = records[0];
  if (HEADERS.some((value, index) => header[index] !== value) || header.length !== HEADERS.length) throw new Error(`CSV headers must be: ${HEADERS.join(',')}`);
  if (records.length - 1 > 5000) throw new Error('CSV file cannot contain more than 5,000 savings rows.');

  const errors: ContributionImportError[] = [];
  const rows: ContributionImportRowInput[] = [];
  const references = new Set<string>();
  records.slice(1).forEach((record, index) => {
    const rowNumber = index + 2;
    const raw = Object.fromEntries(HEADERS.map((key, position) => [key, (record[position] ?? '').trim()]));
    const reference = raw.contributorReferenceNumber;
    const amount = raw.amountMinor;
    const date = new Date(`${raw.collectionDate}T00:00:00.000Z`);
    const rowError = (code: string, message: string): void => { errors.push({ rowNumber, code, message }); };
    if (!reference) rowError('missing_contributor', 'Contributor reference number is required.');
    if (!raw.bookEntryReference || raw.bookEntryReference.length > 150) rowError('invalid_book_reference', 'A book entry reference of 1 to 150 characters is required.');
    if (references.has(raw.bookEntryReference)) rowError('duplicate_book_reference', 'Book entry reference is duplicated in this file.');
    references.add(raw.bookEntryReference);
    if (!/^\d+$/.test(amount) || BigInt(amount || '0') <= 0n) rowError('invalid_amount', 'Amount must be a positive integer in minor currency units.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.collectionDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw.collectionDate) rowError('invalid_date', 'Collection date must be YYYY-MM-DD.');
    if (!/^[A-Z]{3}$/.test(raw.currency)) rowError('invalid_currency', 'Currency must be a three-letter uppercase code.');
    if (!PAYMENT_METHODS.has(raw.paymentMethod as ContributionPaymentMethod)) rowError('invalid_payment_method', 'Payment method is not supported.');
    if (!errors.some((error) => error.rowNumber === rowNumber)) {
      rows.push({ rowNumber, contributorReference: reference, collectionDate: date, amountMinor: BigInt(amount || '0'), currency: raw.currency, paymentMethod: raw.paymentMethod as ContributionPaymentMethod, bookEntryReference: raw.bookEntryReference, raw });
    }
  });
  return { rows, errors };
}

function parseCsv(content: string): string[][] {
  const records: string[][] = [[]]; let field = ''; let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '"') { if (quoted && content[index + 1] === '"') { field += '"'; index += 1; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { records[records.length - 1].push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && content[index + 1] === '\n') index += 1; records[records.length - 1].push(field); field = ''; if (index < content.length - 1) records.push([]); }
    else field += char;
  }
  if (field || records[records.length - 1].length > 0) records[records.length - 1].push(field);
  return records.filter((record) => record.some((value) => value.trim() !== ''));
}
