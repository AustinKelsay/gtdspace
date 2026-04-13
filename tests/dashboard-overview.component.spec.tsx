// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import type { HabitWithHistory } from '@/hooks/useHabitsHistory';
import type { GTDSpace } from '@/types';
import type { DashboardActivityItem } from '@/utils/dashboard-activity';

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

const gtdSpace: GTDSpace = {
  root_path: '/space',
  is_initialized: true,
};

const buildRecentActivity = (overrides: Partial<DashboardActivityItem> = {}): DashboardActivityItem => ({
  id: 'project:/space/Projects/Alpha',
  entityType: 'project',
  activityType: 'updated',
  title: 'Alpha',
  path: '/space/Projects/Alpha',
  timestamp: '2026-03-31T09:00:00.000Z',
  context: 'Project',
  ...overrides,
});

function renderOverview(
  overrides: Partial<React.ComponentProps<typeof DashboardOverview>> = {}
) {
  return render(
    <DashboardOverview
      gtdSpace={gtdSpace}
      projects={[]}
      habits={[]}
      actions={[]}
      actionSummary={{
        total: 0,
        inProgress: 0,
        completed: 0,
        waiting: 0,
      }}
      horizonCounts={{}}
      recentActivity={[]}
      {...overrides}
    />
  );
}

describe('DashboardOverview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows today completion progress instead of an unrelated success-rate label', () => {
    renderOverview({
      habits: [
        buildHabit({ name: 'Habit 1', status: 'completed' }),
        buildHabit({ name: 'Habit 2', status: 'completed', path: '/space/Habits/2.md' }),
        buildHabit({ name: 'Habit 3', status: 'completed', path: '/space/Habits/3.md' }),
        buildHabit({ name: 'Habit 4', status: 'completed', path: '/space/Habits/4.md' }),
        buildHabit({ name: 'Habit 5', status: 'todo', path: '/space/Habits/5.md' }),
      ],
    });

    expect(screen.getByText("Today's Habits")).toBeInTheDocument();
    expect(screen.getByText('4/5')).toBeInTheDocument();
    expect(screen.getByText('80% completed today')).toBeInTheDocument();
    expect(screen.queryByText('100% success rate')).not.toBeInTheDocument();
  });

  it('uses the cadence-aware denominator for weekend weekday habits and restores it on Monday', () => {
    vi.setSystemTime(new Date('2026-04-12T12:00:00'));

    const habits = [
      buildHabit({ name: 'Habit 1', status: 'completed' }),
      buildHabit({ name: 'Habit 2', status: 'completed', path: '/space/Habits/2.md' }),
      buildHabit({ name: 'Habit 3', status: 'completed', path: '/space/Habits/3.md' }),
      buildHabit({ name: 'Habit 4', status: 'completed', path: '/space/Habits/4.md' }),
      buildHabit({ name: 'Habit 5', status: 'completed', path: '/space/Habits/5.md' }),
      buildHabit({
        name: 'Weekday Habit 1',
        frequency: 'weekdays',
        status: 'todo',
        path: '/space/Habits/weekday-1.md',
      }),
      buildHabit({
        name: 'Weekday Habit 2',
        frequency: 'weekdays',
        status: 'todo',
        path: '/space/Habits/weekday-2.md',
      }),
    ];

    const { rerender } = renderOverview({ habits });

    expect(screen.getByText('5/5')).toBeInTheDocument();
    expect(screen.getByText('100% completed today')).toBeInTheDocument();

    vi.setSystemTime(new Date('2026-04-13T09:00:00'));
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
        recentActivity={[]}
      />
    );

    expect(screen.getByText('5/7')).toBeInTheDocument();
    expect(screen.getByText('71% completed today')).toBeInTheDocument();
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

    const { rerender } = renderOverview({ habits });

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
        recentActivity={[]}
      />
    );

    expect(screen.getByText('0/2')).toBeInTheDocument();
    expect(screen.getByText('0% completed today')).toBeInTheDocument();
  });

  it('counts today completions from period history even when analytics history excludes reset rows', () => {
    renderOverview({
      habits: [
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
      ],
    });

    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('50% completed today')).toBeInTheDocument();
  });

  it('renders recent activity rows and forwards clicks', () => {
    const onSelectActivity = vi.fn();

    renderOverview({
      recentActivity: [
        buildRecentActivity(),
        buildRecentActivity({
          id: 'habit:/space/Habits/stretch.md',
          entityType: 'habit',
          activityType: 'completed',
          title: 'Stretch',
          path: '/space/Habits/stretch.md',
          timestamp: '2026-03-31T10:00:00.000Z',
          context: 'Habit',
        }),
      ],
      onSelectActivity,
    });

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Stretch'));

    expect(onSelectActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'habit:/space/Habits/stretch.md',
        entityType: 'habit',
        activityType: 'completed',
      })
    );
  });

  it('shows only core GTD horizons and forwards horizon clicks', () => {
    const onSelectHorizon = vi.fn();

    renderOverview({
      horizonCounts: {
        'Someday Maybe': 7,
        'Goals': 2,
        'Areas of Focus': 4,
        'Purpose & Principles': 1,
      },
      onSelectHorizon,
    });

    expect(screen.queryByText('Someday Maybe')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Goals'));

    expect(onSelectHorizon).toHaveBeenCalledWith('Goals');
  });
});
