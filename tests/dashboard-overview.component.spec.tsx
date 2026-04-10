// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import type { HabitWithHistory } from '@/hooks/useHabitsHistory';
import type { GTDSpace } from '@/types';

const buildHabit = (overrides: Partial<HabitWithHistory> = {}): HabitWithHistory => ({
  name: 'Default Habit',
  frequency: 'daily',
  status: 'todo',
  path: '/space/Habits/default.md',
  createdDateTime: '2026-01-01T08:00:00Z',
  last_updated: '2026-03-31T08:00:00Z',
  history: [],
  periodHistory: [],
  currentStreak: 0,
  bestStreak: 0,
  averageStreak: 0,
  successRate: 100,
  totalCompletions: 10,
  totalAttempts: 10,
  recentTrend: 'stable',
  linkedProjects: [],
  linkedAreas: [],
  linkedGoals: [],
  linkedVision: [],
  linkedPurpose: [],
  ...overrides,
});

describe('DashboardOverview habits stat', () => {
  const gtdSpace: GTDSpace = {
    root_path: '/space',
    is_initialized: true,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows today completion progress instead of an unrelated success-rate label', () => {
    render(
      <DashboardOverview
        gtdSpace={gtdSpace}
        projects={[]}
        habits={[
          buildHabit({ name: 'Habit 1', status: 'completed' }),
          buildHabit({ name: 'Habit 2', status: 'completed', path: '/space/Habits/2.md' }),
          buildHabit({ name: 'Habit 3', status: 'completed', path: '/space/Habits/3.md' }),
          buildHabit({ name: 'Habit 4', status: 'completed', path: '/space/Habits/4.md' }),
          buildHabit({ name: 'Habit 5', status: 'todo', path: '/space/Habits/5.md' }),
        ]}
        actions={[]}
        actionSummary={{
          total: 0,
          inProgress: 0,
          completed: 0,
          waiting: 0,
        }}
        horizonCounts={{}}
      />
    );

    expect(screen.getByText("Today's Habits")).toBeInTheDocument();
    expect(screen.getByText('4/5')).toBeInTheDocument();
    expect(screen.getByText('80% completed today')).toBeInTheDocument();
    expect(screen.queryByText('100% success rate')).not.toBeInTheDocument();
  });

  it('recomputes today habit stats after midnight when the component rerenders', () => {
    const habits = [
      buildHabit({
        name: 'Habit 1',
        status: 'todo',
        periodHistory: [{ date: '2026-03-31', time: '08:00', completed: true }],
      }),
      buildHabit({
        name: 'Habit 2',
        path: '/space/Habits/2.md',
        status: 'todo',
      }),
    ];

    const { rerender } = render(
      <DashboardOverview
        gtdSpace={gtdSpace}
        projects={[]}
        habits={habits}
        actions={[]}
        actionSummary={{
          total: 0,
          inProgress: 0,
          completed: 0,
          waiting: 0,
        }}
        horizonCounts={{}}
      />
    );

    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('50% completed today')).toBeInTheDocument();

    vi.setSystemTime(new Date('2026-04-01T00:05:00'));
    rerender(
      <DashboardOverview
        gtdSpace={gtdSpace}
        projects={[]}
        habits={habits}
        actions={[]}
        actionSummary={{
          total: 0,
          inProgress: 0,
          completed: 0,
          waiting: 0,
        }}
        horizonCounts={{}}
      />
    );

    expect(screen.getByText('0/2')).toBeInTheDocument();
    expect(screen.getByText('0% completed today')).toBeInTheDocument();
  });

  it('counts today completions from period history even when analytics history excludes reset rows', () => {
    render(
      <DashboardOverview
        gtdSpace={gtdSpace}
        projects={[]}
        habits={[
          buildHabit({
            name: 'Reset-derived Habit',
            status: 'todo',
            history: [],
            periodHistory: [{ date: '2026-03-31', time: '12:00 AM', completed: true, action: 'Manual' }],
          }),
          buildHabit({
            name: 'Pending Habit',
            path: '/space/Habits/2.md',
            status: 'todo',
            history: [],
            periodHistory: [{ date: '2026-03-31', time: '12:00 AM', completed: false, action: 'Auto-Reset' }],
          }),
        ]}
        actions={[]}
        actionSummary={{
          total: 0,
          inProgress: 0,
          completed: 0,
          waiting: 0,
        }}
        horizonCounts={{}}
      />
    );

    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('50% completed today')).toBeInTheDocument();
  });
});
