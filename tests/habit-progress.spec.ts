import { describe, expect, it } from 'vitest';
import {
  countHabitsEligibleOnDate,
  countHabitsCompletedOnDate,
  getLatestHabitEntryForDate,
  isHabitCompletedOnDate,
  isHabitEligibleOnDate,
  summarizeHabitProgressOnDate,
  type HabitCompletionLike,
} from '@/utils/habit-progress';

const TODAY = '2026-03-31';
const SUNDAY = '2026-04-12';
const MONDAY = '2026-04-13';

const buildHabit = (overrides: Partial<HabitCompletionLike> = {}): HabitCompletionLike => ({
  status: 'todo',
  frequency: 'daily',
  createdDateTime: '2026-01-01T08:00:00Z',
  history: [],
  periodHistory: [],
  ...overrides,
});

describe('habit progress helpers', () => {
  it('prefers period history for date completion when available', () => {
    const habit = buildHabit({
      status: 'todo',
      history: [{ date: TODAY, time: '09:00 AM', completed: false }],
      periodHistory: [{ date: TODAY, time: '09:30 AM', completed: true, action: 'Manual' }],
    });

    expect(isHabitCompletedOnDate(habit, TODAY, TODAY)).toBe(true);
  });

  it('falls back to the current status when today has no history row', () => {
    const habit = buildHabit({
      status: 'completed',
      periodHistory: [{ date: '2026-03-30', time: '08:00 AM', completed: true }],
    });

    expect(isHabitCompletedOnDate(habit, TODAY, TODAY)).toBe(true);
  });

  it('uses the latest entry for the day before falling back to current status', () => {
    const habit = buildHabit({
      status: 'completed',
      periodHistory: [
        { date: TODAY, time: '08:00 AM', completed: true },
        { date: TODAY, time: '09:00 AM', completed: false },
      ],
    });

    expect(isHabitCompletedOnDate(habit, TODAY, TODAY)).toBe(false);
  });

  it('counts completed habits with the same completion rule used by the dashboard', () => {
    const habits = [
      buildHabit({ status: 'completed' }),
      buildHabit({
        periodHistory: [{ date: TODAY, time: '07:30 AM', completed: true }],
      }),
      buildHabit({
        status: 'completed',
        periodHistory: [{ date: TODAY, time: '10:00 AM', completed: false }],
      }),
    ];

    expect(countHabitsCompletedOnDate(habits, TODAY, TODAY)).toBe(2);
  });

  it('treats weekday habits as ineligible on Sunday and eligible on Monday', () => {
    const habit = buildHabit({ frequency: 'weekdays' });

    expect(isHabitEligibleOnDate(habit, SUNDAY)).toBe(false);
    expect(isHabitEligibleOnDate(habit, MONDAY)).toBe(true);
  });

  it('respects anchored periodic cadences beyond weekdays', () => {
    expect(
      isHabitEligibleOnDate(
        buildHabit({
          frequency: 'every-other-day',
          createdDateTime: '2026-04-01T08:00:00Z',
        }),
        '2026-04-03'
      )
    ).toBe(true);
    expect(
      isHabitEligibleOnDate(
        buildHabit({
          frequency: 'every-other-day',
          createdDateTime: '2026-04-01T08:00:00Z',
        }),
        '2026-04-04'
      )
    ).toBe(false);

    expect(
      isHabitEligibleOnDate(
        buildHabit({
          frequency: 'twice-weekly',
          createdDateTime: '2026-04-01T08:00:00Z',
        }),
        '2026-04-04'
      )
    ).toBe(true);

    expect(
      isHabitEligibleOnDate(
        buildHabit({
          frequency: 'weekly',
          createdDateTime: '2026-04-01T08:00:00Z',
        }),
        '2026-04-08'
      )
    ).toBe(true);
    expect(
      isHabitEligibleOnDate(
        buildHabit({
          frequency: 'weekly',
          createdDateTime: '2026-04-01T08:00:00Z',
        }),
        '2026-04-09'
      )
    ).toBe(false);

    expect(
      isHabitEligibleOnDate(
        buildHabit({
          frequency: 'biweekly',
          createdDateTime: '2026-04-01T08:00:00Z',
        }),
        '2026-04-15'
      )
    ).toBe(true);
    expect(
      isHabitEligibleOnDate(
        buildHabit({
          frequency: 'biweekly',
          createdDateTime: '2026-04-01T08:00:00Z',
        }),
        '2026-04-08'
      )
    ).toBe(false);

    expect(
      isHabitEligibleOnDate(
        buildHabit({
          frequency: 'monthly',
          createdDateTime: '2026-01-31T08:00:00Z',
        }),
        '2026-02-28'
      )
    ).toBe(true);
  });

  it('excludes habits created after the target date from today eligibility', () => {
    const habits = [
      buildHabit({ status: 'completed' }),
      buildHabit({
        frequency: 'weekdays',
        createdDateTime: '2026-04-14T08:00:00Z',
        status: 'completed',
      }),
    ];

    expect(countHabitsEligibleOnDate(habits, MONDAY)).toBe(1);
  });

  it('summarizes progress with a cadence-aware denominator', () => {
    const habits = [
      buildHabit({ status: 'completed' }),
      buildHabit({ status: 'completed' }),
      buildHabit({ status: 'completed' }),
      buildHabit({ status: 'completed' }),
      buildHabit({ status: 'completed' }),
      buildHabit({ frequency: 'weekdays', createdDateTime: '2026-01-01T08:00:00Z' }),
      buildHabit({
        frequency: 'weekdays',
        createdDateTime: '2026-01-01T08:00:00Z',
      }),
    ];

    expect(summarizeHabitProgressOnDate(habits, SUNDAY, SUNDAY)).toEqual({
      totalCount: 7,
      eligibleCount: 5,
      completedCount: 5,
      completionRate: 100,
    });
    expect(summarizeHabitProgressOnDate(habits, MONDAY, MONDAY)).toEqual({
      totalCount: 7,
      eligibleCount: 7,
      completedCount: 5,
      completionRate: 71,
    });
  });

  it('returns a null completion rate when no habits are eligible that day', () => {
    const habits = [
      buildHabit({ frequency: 'weekdays' }),
      buildHabit({ frequency: 'weekdays' }),
    ];

    expect(summarizeHabitProgressOnDate(habits, SUNDAY, SUNDAY)).toEqual({
      totalCount: 2,
      eligibleCount: 0,
      completedCount: 0,
      completionRate: null,
    });
  });

  it('preserves source order when timestamps cannot be parsed', () => {
    const habit = buildHabit({
      history: [
        { date: 'not-a-date', time: '12:00 PM', completed: false },
        { date: 'not-a-date', time: '01:00 AM', completed: true },
      ],
    });

    expect(getLatestHabitEntryForDate(habit, 'not-a-date')).toEqual(habit.history?.[0]);
  });
});
