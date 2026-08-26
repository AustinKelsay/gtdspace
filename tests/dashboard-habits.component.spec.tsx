// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardHabits from '@/components/dashboard/DashboardHabits';
import type { HabitWithHistory } from '@/hooks/useHabitsHistory';

const buildHabit = (overrides: Partial<HabitWithHistory> = {}): HabitWithHistory => ({
  name: 'Default Habit',
  frequency: 'daily',
  status: 'todo',
  path: '/space/Habits/default.md',
  createdDateTime: '2026-01-01T08:00:00Z',
  last_updated: '2026-03-31T08:00:00Z',
  history: [],
  periodHistory: [],
  currentStreak: 1,
  bestStreak: 2,
  averageStreak: 1,
  successRate: 75,
  totalCompletions: 3,
  totalAttempts: 4,
  recentTrend: 'stable',
  linkedProjects: [],
  linkedAreas: [],
  linkedGoals: [],
  linkedVision: [],
  linkedPurpose: [],
  ...overrides,
});

describe('DashboardHabits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the 5-minute frequency label on habit cards', () => {
    render(
      <DashboardHabits
        habits={[
          buildHabit({
            name: 'Stretch',
            frequency: '5-minute',
            path: '/space/Habits/stretch.md',
          }),
        ]}
        onCreateHabit={vi.fn()}
      />
    );

    expect(screen.getByText('Every 5 Minutes')).toBeInTheDocument();
  });

  it('keeps the history tab and frequency filter available for 5-minute habits', () => {
    render(
      <DashboardHabits
        habits={[
          buildHabit({
            name: 'Stretch',
            frequency: '5-minute',
            path: '/space/Habits/stretch.md',
          }),
          buildHabit({
            name: 'Read',
            frequency: 'daily',
            path: '/space/Habits/read.md',
          }),
        ]}
        onCreateHabit={vi.fn()}
      />
    );

    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByText('Stretch')).toBeInTheDocument();
    expect(screen.getByText('Reset: 5m')).toBeInTheDocument();
  });

  it('uses the cadence-aware denominator for the completed today header', () => {
    vi.setSystemTime(new Date('2026-04-12T12:00:00.000Z'));

    render(
      <DashboardHabits
        habits={[
          buildHabit({ name: 'Habit 1', status: 'completed' }),
          buildHabit({ name: 'Habit 2', status: 'completed', path: '/space/Habits/2.md' }),
          buildHabit({ name: 'Habit 3', status: 'completed', path: '/space/Habits/3.md' }),
          buildHabit({ name: 'Habit 4', status: 'completed', path: '/space/Habits/4.md' }),
          buildHabit({ name: 'Habit 5', status: 'completed', path: '/space/Habits/5.md' }),
          buildHabit({
            name: 'Weekday Habit 1',
            frequency: 'weekdays',
            path: '/space/Habits/weekday-1.md',
          }),
          buildHabit({
            name: 'Weekday Habit 2',
            frequency: 'weekdays',
            path: '/space/Habits/weekday-2.md',
          }),
        ]}
        onCreateHabit={vi.fn()}
      />
    );

    expect(screen.getByText('5/5')).toBeInTheDocument();
  });

  it('renders a no-denominator state when no habits are due today', () => {
    vi.setSystemTime(new Date('2026-04-12T12:00:00.000Z'));

    render(
      <DashboardHabits
        habits={[
          buildHabit({
            name: 'Weekday Habit 1',
            frequency: 'weekdays',
            path: '/space/Habits/weekday-1.md',
          }),
          buildHabit({
            name: 'Weekday Habit 2',
            frequency: 'weekdays',
            path: '/space/Habits/weekday-2.md',
          }),
        ]}
        onCreateHabit={vi.fn()}
      />
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('No habits due today')).toBeInTheDocument();
  });

  it('excludes ineligible weekend weekday habits from completed and pending filters', () => {
    vi.setSystemTime(new Date('2026-04-12T12:00:00.000Z'));

    const habits = [
      buildHabit({ name: 'Daily Completed', status: 'completed', path: '/space/Habits/daily-completed.md' }),
      buildHabit({ name: 'Daily Pending', status: 'todo', path: '/space/Habits/daily-pending.md' }),
      buildHabit({
        name: 'Weekday Completed',
        frequency: 'weekdays',
        status: 'completed',
        path: '/space/Habits/weekday-completed.md',
      }),
      buildHabit({
        name: 'Weekday Pending',
        frequency: 'weekdays',
        status: 'todo',
        path: '/space/Habits/weekday-pending.md',
      }),
    ];

    const { unmount } = render(
      <DashboardHabits
        habits={habits}
        initialStatusFilter="pending"
        onCreateHabit={vi.fn()}
      />
    );

    expect(screen.getByText('Daily Pending')).toBeInTheDocument();
    expect(screen.queryByText('Daily Completed')).not.toBeInTheDocument();
    expect(screen.queryByText('Weekday Completed')).not.toBeInTheDocument();
    expect(screen.queryByText('Weekday Pending')).not.toBeInTheDocument();

    unmount();

    render(
      <DashboardHabits
        habits={habits}
        initialStatusFilter="completed"
        onCreateHabit={vi.fn()}
      />
    );

    expect(screen.getByText('Daily Completed')).toBeInTheDocument();
    expect(screen.queryByText('Daily Pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Weekday Completed')).not.toBeInTheDocument();
    expect(screen.queryByText('Weekday Pending')).not.toBeInTheDocument();
  });
});
