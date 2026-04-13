import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatAbsoluteDate,
  formatAbsoluteTime,
  formatCalendarViewTitle,
  formatCompactDate,
  formatRelativeDate,
  isDateInRange,
  isDateOverdue,
  isDateToday,
} from '@/utils/date-formatting';

describe('date-formatting helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 24, 12));
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
    const start = new Date(2026, 2, 24, 2);
    const end = new Date(2026, 2, 31, 23, 59);

    expect(isDateInRange('2026-03-24', start, end)).toBe(true);
    expect(isDateInRange('2026-03-31', start, end)).toBe(true);
    expect(isDateInRange('2026-04-01', start, end)).toBe(false);
  });

  it('formats absolute calendar labels through shared helpers', () => {
    const sample = new Date(2026, 3, 15, 10, 30);

    expect(formatAbsoluteDate(sample, 'EEEE, MMM d, yyyy')).toBe('Wednesday, Apr 15, 2026');
    expect(formatAbsoluteDate(sample, 'MMM d, yyyy')).toBe('Apr 15, 2026');
    expect(formatAbsoluteDate(sample, 'MMMM yyyy')).toBe('April 2026');
    expect(formatAbsoluteDate(sample, 'EEEE')).toBe('Wednesday');
    expect(formatAbsoluteDate(sample, 'EEE')).toBe('Wed');
    expect(formatAbsoluteDate(sample, 'd')).toBe('15');
    expect(formatAbsoluteTime(sample, 'h:mm a')).toBe('10:30 AM');
    expect(formatAbsoluteTime(sample, 'ha')).toBe('10AM');
  });

  it('formats day-of-month with the provided locale', () => {
    const sample = new Date(2026, 3, 15, 10, 30);
    const expected = new Intl.DateTimeFormat('ar-EG', { day: 'numeric' }).format(sample);

    expect(formatAbsoluteDate(sample, 'd', 'ar-EG')).toBe(expected);
  });

  it('builds calendar view titles through the shared formatter', () => {
    const sample = new Date(2026, 3, 15, 10, 30);

    expect(formatCalendarViewTitle(sample, 'day')).toBe('Wednesday, Apr 15, 2026');
    expect(formatCalendarViewTitle(sample, 'week')).toBe('Week of Apr 12, 2026');
    expect(formatCalendarViewTitle(sample, 'month')).toBe('April 2026');
  });
});
