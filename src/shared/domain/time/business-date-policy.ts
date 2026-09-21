export type PlanFrequency = 'daily' | 'weekly';

export class BusinessDatePolicyError extends Error {
  constructor(readonly code: 'invalid_timezone' | 'invalid_date' | 'past_date' | 'future_date') {
    super(code);
    this.name = 'BusinessDatePolicyError';
  }
}

export interface BusinessDatePolicy {
  readonly version: string;
  businessDateAt(input: { instant: Date; timezone: string }): string;
  assertStartDate(input: { startDate: string; today: string; timezone: string }): void;
  nextDueDate(input: { frequency: PlanFrequency; dueDate: string; timezone: string }): string;
  addBusinessDays(input: { date: string; days: number; timezone: string }): string;
}

export class ApprovedBusinessDatePolicy implements BusinessDatePolicy {
  readonly version = 'DEC-TIME-001-v1';

  businessDateAt(input: { instant: Date; timezone: string }): string {
    this.assertTimezone(input.timezone);
    if (Number.isNaN(input.instant.getTime())) throw new BusinessDatePolicyError('invalid_date');
    return new Intl.DateTimeFormat('en-CA', { timeZone: input.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(input.instant);
  }

  assertStartDate(input: { startDate: string; today: string; timezone: string }): void {
    this.assertTimezone(input.timezone);
    this.assertDate(input.startDate);
    this.assertDate(input.today);
    if (input.startDate < input.today) throw new BusinessDatePolicyError('past_date');
  }

  nextDueDate(input: { frequency: PlanFrequency; dueDate: string; timezone: string }): string {
    this.assertTimezone(input.timezone);
    this.assertDate(input.dueDate);
    return addCalendarDays(input.dueDate, input.frequency === 'daily' ? 1 : 7);
  }

  addBusinessDays(input: { date: string; days: number; timezone: string }): string {
    this.assertTimezone(input.timezone);
    this.assertDate(input.date);
    if (!Number.isInteger(input.days) || input.days < 0) throw new BusinessDatePolicyError('invalid_date');
    let result = input.date;
    let remaining = input.days;
    while (remaining > 0) {
      result = addCalendarDays(result, 1);
      const weekday = new Date(`${result}T00:00:00Z`).getUTCDay();
      if (weekday !== 0 && weekday !== 6) remaining -= 1;
    }
    return result;
  }

  private assertTimezone(timezone: string): void { if (timezone !== 'Africa/Lagos') throw new BusinessDatePolicyError('invalid_timezone'); }
  private assertDate(value: string): void { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) throw new BusinessDatePolicyError('invalid_date'); }
}

function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
