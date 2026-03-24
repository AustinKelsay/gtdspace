import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatCompactDate,
  formatRelativeDate,
  isDateInRange,
  isDateOverdue,
  isDateToday,
} from '@/utils/date-formatting';

describe('date-formatting helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T15:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('treats date-only strings as local calendar days for overdue checks', () => {
    expect(isDateOverdue('2026-03-23')).toBe(true);
    expect(isDateOverdue('2026-03-24')).toBe(false);
    expect(isDateOverdue('2026-03-25')).toBe(false);
  });

  it('identifies today consistently across helper functions', () => {
    expect(isDateToday('2026-03-24')).toBe(true);
    expect(formatRelativeDate('2026-03-24')).toBe('Today');
    expect(formatCompactDate('2026-03-24')).toBe('Today');
  });

  it('keeps range checks inclusive of the end date', () => {
    const start = new Date('2026-03-24T02:00:00Z');
    const end = new Date('2026-03-31T23:59:00Z');

    expect(isDateInRange('2026-03-24', start, end)).toBe(true);
    expect(isDateInRange('2026-03-31', start, end)).toBe(true);
    expect(isDateInRange('2026-04-01', start, end)).toBe(false);
  });
});
