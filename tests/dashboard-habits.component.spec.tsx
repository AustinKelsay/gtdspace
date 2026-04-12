// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
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
  });
});
