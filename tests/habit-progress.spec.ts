import { describe, expect, it } from 'vitest';
import {
  countHabitsCompletedOnDate,
  getLatestHabitEntryForDate,
  isHabitCompletedOnDate,
  type HabitCompletionLike,
} from '@/utils/habit-progress';

const TODAY = '2026-03-31';

const buildHabit = (overrides: Partial<HabitCompletionLike> = {}): HabitCompletionLike => ({
  status: 'todo',
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
