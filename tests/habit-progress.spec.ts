import { describe, expect, it } from 'vitest';
import {
  countHabitsCompletedOnDate,
  isHabitCompletedOnDate,
  type HabitCompletionLike,
} from '@/utils/habit-progress';

const TODAY = '2026-03-31';

const buildHabit = (overrides: Partial<HabitCompletionLike> = {}): HabitCompletionLike => ({
  status: 'todo',
  history: [],
  ...overrides,
});

describe('habit progress helpers', () => {
  it('falls back to the current status when today has no history row', () => {
    const habit = buildHabit({
      status: 'completed',
      history: [{ date: '2026-03-30', time: '08:00 AM', completed: true }],
    });

    expect(isHabitCompletedOnDate(habit, TODAY, TODAY)).toBe(true);
  });

  it('uses the latest entry for the day before falling back to current status', () => {
    const habit = buildHabit({
      status: 'completed',
      history: [
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
        history: [{ date: TODAY, time: '07:30 AM', completed: true }],
      }),
      buildHabit({
        status: 'completed',
        history: [{ date: TODAY, time: '10:00 AM', completed: false }],
      }),
    ];

    expect(countHabitsCompletedOnDate(habits, TODAY, TODAY)).toBe(2);
  });
});
