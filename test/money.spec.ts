import { Money } from '../src/shared/domain/money';

describe('Money', () => {
  it('adds same-currency minor units without floating point arithmetic', () => {
    const total = Money.from({ amountMinor: 100n, currency: 'ngn' }).add(
      Money.from({ amountMinor: 250n, currency: 'NGN' }),
    );

    expect(total.amountMinor).toBe(350n);
    expect(total.currency).toBe('NGN');
  });

  it('rejects cross-currency arithmetic', () => {
    expect(() =>
      Money.from({ amountMinor: 100n, currency: 'NGN' }).add(
        Money.from({ amountMinor: 100n, currency: 'USD' }),
      ),
    ).toThrow('different currencies');
  });
});
