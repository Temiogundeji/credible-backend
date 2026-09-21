import { parseContributionCsv } from '../src/modules/thrift/application/contribution-import-parser';

describe('contribution import parser', () => {
  it('parses the collector book-register format', () => {
    const result = parseContributionCsv([
      'contributorReferenceNumber,collectionDate,amountMinor,currency,paymentMethod,bookEntryReference',
      'C-001,2026-09-21,100000,NGN,cash,BOOK-001',
    ].join('\n'));
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({ contributorReference: 'C-001', amountMinor: 100000n, currency: 'NGN' });
  });

  it('rejects duplicate book references and invalid amounts', () => {
    const result = parseContributionCsv([
      'contributorReferenceNumber,collectionDate,amountMinor,currency,paymentMethod,bookEntryReference',
      'C-001,2026-09-21,0,NGN,cash,BOOK-001',
      'C-002,2026-09-21,100,NGN,cash,BOOK-001',
    ].join('\n'));
    expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining(['invalid_amount', 'duplicate_book_reference']));
  });

  it('rejects a header that could cause column confusion', () => {
    expect(() => parseContributionCsv('reference,amount\nC-001,100')).toThrow('CSV headers must be');
  });
});
