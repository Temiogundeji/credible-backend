import { ContributorApplicationError } from '../application/contributor-errors';

export interface ContributorCsvRow {
  readonly referenceNumber: string;
  readonly fullName: string;
  readonly email?: string;
  readonly phone?: string;
  readonly address?: string;
}

export function parseContributorCsv(value: string): readonly ContributorCsvRow[] {
  const lines = value.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new ContributorApplicationError('plan_invalid', 'CSV must contain a header and at least one data row');
  if (lines.length > 501) throw new ContributorApplicationError('plan_invalid', 'CSV cannot contain more than 500 contributors');
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const required = ['referencenumber', 'fullname'];
  if (!required.every((header) => headers.includes(header))) throw new ContributorApplicationError('plan_invalid', 'CSV must contain referenceNumber and fullName columns');
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) throw new ContributorApplicationError('plan_invalid', `CSV row ${index + 2} has an invalid number of columns`);
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? '']));
    return { referenceNumber: row.referencenumber ?? '', fullName: row.fullname ?? '', email: row.email || undefined, phone: row.phone || undefined, address: row.address || undefined };
  });
}

function parseCsvLine(line: string): readonly string[] {
  const result: string[] = []; let current = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) { current += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === ',' && !quoted) { result.push(current); current = ''; continue; }
    current += character;
  }
  if (quoted) throw new ContributorApplicationError('plan_invalid', 'CSV contains an unterminated quoted value');
  result.push(current);
  return result;
}
