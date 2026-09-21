export type CurrencyCode = string;

export interface MoneyInput {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

export class Money {
  private constructor(
    readonly amountMinor: bigint,
    readonly currency: CurrencyCode,
  ) {}

  static from(input: MoneyInput): Money {
    const currency = input.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be an ISO 4217 code');
    return new Money(input.amountMinor, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.from({ amountMinor: this.amountMinor + other.amountMinor, currency: this.currency });
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.from({ amountMinor: this.amountMinor - other.amountMinor, currency: this.currency });
  }

  isNegative(): boolean {
    return this.amountMinor < 0n;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) throw new Error('Cannot combine different currencies');
  }
}
