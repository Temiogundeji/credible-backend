import { ApprovedBusinessDatePolicy, BusinessDatePolicyError } from '../src/shared/domain/time/business-date-policy';

describe('ApprovedBusinessDatePolicy', () => {
  const policy = new ApprovedBusinessDatePolicy();

  it('derives an Africa/Lagos business date from a UTC instant', () => {
    expect(policy.businessDateAt({ instant: new Date('2026-09-21T23:30:00.000Z'), timezone: 'Africa/Lagos' })).toBe('2026-09-22');
  });

  it('advances daily and weekly due dates', () => {
    expect(policy.nextDueDate({ frequency: 'daily', dueDate: '2026-09-21', timezone: 'Africa/Lagos' })).toBe('2026-09-22');
    expect(policy.nextDueDate({ frequency: 'weekly', dueDate: '2026-09-21', timezone: 'Africa/Lagos' })).toBe('2026-09-28');
  });

  it('rejects a start date in the past', () => {
    expect(() => policy.assertStartDate({ startDate: '2026-09-20', today: '2026-09-21', timezone: 'Africa/Lagos' })).toThrow(new BusinessDatePolicyError('past_date'));
  });

  it('adds business days while skipping weekends', () => {
    expect(policy.addBusinessDays({ date: '2026-09-25', days: 3, timezone: 'Africa/Lagos' })).toBe('2026-09-30');
  });
});
