// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GTDDashboard from '@/components/gtd/GTDDashboard';
import { emitContentSaved, emitMetadataChange } from '@/utils/content-event-bus';

const mocks = vi.hoisted(() => ({
  action: {
    id: '/mock/workspace/Projects/Alpha/Actions/review.md',
    name: 'Review launch plan',
    path: '/mock/workspace/Projects/Alpha/Actions/review.md',
    projectName: 'Alpha',
    projectPath: '/mock/workspace/Projects/Alpha',
    status: 'todo',
    createdDate: '2026-03-30T08:00:00.000Z',
    modifiedDate: '2026-03-31T08:00:00.000Z',
  },
  project: {
    id: '/mock/workspace/Projects/Alpha',
    name: 'Alpha',
    path: '/mock/workspace/Projects/Alpha',
    status: 'in-progress',
    description: 'Alpha project',
    createdDateTime: '2026-03-28T08:00:00.000Z',
    modifiedDate: '2026-03-31T07:00:00.000Z',
    completionPercentage: 40,
  },
  habit: {
    name: 'Stretch',
    frequency: 'daily',
    status: 'todo',
    path: '/mock/workspace/Habits/stretch.md',
    createdDateTime: '2026-03-25T08:00:00.000Z',
    last_updated: '2026-03-31T06:00:00.000Z',
    history: [],
    periodHistory: [],
    currentStreak: 0,
    bestStreak: 0,
    averageStreak: 0,
    successRate: 0,
    totalCompletions: 0,
    totalAttempts: 0,
    recentTrend: 'stable',
    linkedProjects: [],
    linkedAreas: [],
    linkedGoals: [],
    linkedVision: [],
    linkedPurpose: [],
  },
  goal: {
    id: '/mock/workspace/Goals/North Star.md',
    name: 'North Star.md',
    path: '/mock/workspace/Goals/North Star.md',
    size: 0,
    last_modified: Math.floor(Date.parse('2026-03-30T08:00:00.000Z') / 1000),
    extension: 'md',
    horizonLevel: 'Goals',
    linkedTo: [],
    linkedFrom: [],
    createdDateTime: '2026-03-29T08:00:00.000Z',
  },
  loadProjects: vi.fn(async () => []),
  loadProjectsData: vi.fn(async () => []),
  loadHabits: vi.fn(async () => undefined),
  refreshHabits: vi.fn(async () => undefined),
  updateHabitStatus: vi.fn(async () => undefined),
  loadActions: vi.fn(async () => undefined),
  updateActionStatus: vi.fn(async () => undefined),
  updateProject: vi.fn(async () => undefined),
  loadHorizons: vi.fn(async () => undefined),
  toast: vi.fn(),
  safeInvoke: vi.fn(),
  findRelated: vi.fn(() => ({ parents: [], children: [], siblings: [] })),
  lastOverviewProps: null as any,
  lastHabitsProps: null as any,
  lastHorizonsProps: null as any,
  lastCreateHabitDialogProps: null as any,
  lastCreatePageDialogProps: null as any,
}));

vi.mock('@/hooks/useGTDSpace', () => ({
  useGTDSpace: () => ({
    isLoading: false,
    loadProjects: mocks.loadProjects,
  }),
}));

vi.mock('@/hooks/useActionsData', () => ({
  useActionsData: () => ({
    actions: [mocks.action],
    isLoading: false,
    summary: {
      total: 1,
      inProgress: 1,
      completed: 0,
      waiting: 0,
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 1,
    },
    loadActions: mocks.loadActions,
    updateActionStatus: mocks.updateActionStatus,
  }),
}));

vi.mock('@/hooks/useProjectsData', () => ({
  useProjectsData: () => ({
    projects: [mocks.project],
    isLoading: false,
    loadProjects: mocks.loadProjectsData,
    updateProject: mocks.updateProject,
  }),
}));

vi.mock('@/hooks/useHabitsHistory', () => ({
  useHabitsHistory: () => ({
    habits: [mocks.habit],
    isLoading: false,
    summary: {
      total: 1,
      eligibleToday: 1,
      completedToday: 0,
      streaksActive: 0,
      averageSuccessRate: 0,
      needingAttention: [],
    },
    analytics: {},
    loadHabits: mocks.loadHabits,
    updateHabitStatus: mocks.updateHabitStatus,
    refresh: mocks.refreshHabits,
  }),
}));

vi.mock('@/hooks/useHorizonsRelationships', () => ({
  useHorizonsRelationships: () => ({
    horizons: {
      Goals: {
        name: 'Goals',
        altitude: '30,000 ft',
        files: [mocks.goal],
        linkedCount: 0,
        unlinkedCount: 1,
      },
    },
    relationships: [],
    graph: { nodes: [], edges: [] },
    isLoading: false,
    loadHorizons: mocks.loadHorizons,
    findRelated: mocks.findRelated,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  ACTION_TOAST_DURATION_MS: 5000,
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock('@/components/ui/toast', () => ({
  ToastAction: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/dashboard', () => ({
  DashboardOverview: (props: any) => {
    mocks.lastOverviewProps = props;
    return (
      <div data-testid="dashboard-overview">
        <button type="button" onClick={() => props.onSelectHorizon?.('Goals')}>Jump Goals</button>
        <button type="button" onClick={() => props.onSelectActivity?.(props.recentActivity[0])}>Open Activity</button>
        <button type="button" onClick={() => props.onSelectProject?.('/mock/workspace/Projects/Alpha')}>Open Project</button>
        <div data-testid="recent-activity-count">{props.recentActivity.length}</div>
      </div>
    );
  },
  DashboardActions: () => <div data-testid="dashboard-actions" />,
  DashboardProjects: () => <div data-testid="dashboard-projects" />,
  DashboardHabits: (props: any) => {
    mocks.lastHabitsProps = props;
    return (
      <div data-testid="dashboard-habits">
        <button type="button" onClick={() => props.onCreateHabit?.()}>Create Habit</button>
      </div>
    );
  },
  DashboardHorizons: (props: any) => {
    mocks.lastHorizonsProps = props;
    return (
      <div data-testid="dashboard-horizons">
        <div>Selected level: {props.selectedLevel}</div>
        <button type="button" onClick={() => props.onCreateFile?.('Goals')}>Create Goal</button>
      </div>
    );
  },
}));

vi.mock('@/components/gtd', () => ({
  GTDProjectDialog: () => null,
  GTDActionDialog: () => null,
  CreateHabitDialog: (props: any) => {
    mocks.lastCreateHabitDialogProps = props;
    if (!props.isOpen) return null;
    return (
      <button type="button" onClick={() => props.onSuccess?.('/mock/workspace/Habits/New Habit.md')}>
        Confirm Habit
      </button>
    );
  },
  CreatePageDialog: (props: any) => {
    mocks.lastCreatePageDialogProps = props;
    if (!props.isOpen) return null;
    return (
      <div>
        <div data-testid="page-section">{props.sectionId}</div>
        <button type="button" onClick={() => props.onSuccess?.('/mock/workspace/Goals/New Goal.md')}>
          Confirm Page
        </button>
      </div>
    );
  },
}));

vi.mock('@/utils/safe-invoke', () => ({
  safeInvoke: (...args: unknown[]) => mocks.safeInvoke(...args),
}));

vi.mock('@/utils/logger', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('GTDDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'check_file_exists') {
        return true;
      }
      return null;
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  function renderDashboard(overrides: Partial<React.ComponentProps<typeof GTDDashboard>> = {}) {
    const onSelectProject = vi.fn();
    const onSelectFile = vi.fn();

    render(
      <GTDDashboard
        currentFolder="/mock/workspace"
        gtdSpace={{
          root_path: '/mock/workspace',
          isGTDSpace: true,
          projects: [],
        } as any}
        onSelectProject={onSelectProject}
        onSelectFile={onSelectFile}
        {...overrides}
      />
    );

    return { onSelectProject, onSelectFile };
  }

  it('refreshes habits when a habit file is saved through the content event bus', async () => {
    renderDashboard();

    expect(mocks.loadHabits).toHaveBeenCalledWith('/mock/workspace');

    mocks.refreshHabits.mockClear();

    act(() => {
      emitContentSaved({
        filePath: '/mock/workspace/Habits/Daily.md',
        fileName: 'Daily.md',
        content: '# Daily',
        metadata: {},
      });
      vi.advanceTimersByTime(150);
    });

    expect(mocks.refreshHabits).toHaveBeenCalledTimes(1);
  });

  it('ignores content-saved events for non-habit files', async () => {
    renderDashboard();

    expect(mocks.loadHabits).toHaveBeenCalledWith('/mock/workspace');

    mocks.refreshHabits.mockClear();

    act(() => {
      emitContentSaved({
        filePath: '/mock/workspace/Projects/Alpha/README.md',
        fileName: 'README.md',
        content: '# Alpha',
        metadata: {},
      });
      vi.advanceTimersByTime(150);
    });

    expect(mocks.refreshHabits).not.toHaveBeenCalled();
  });

  it('refreshes habits for habit metadata and custom content-change events', async () => {
    renderDashboard();

    expect(mocks.loadHabits).toHaveBeenCalledWith('/mock/workspace');

    mocks.refreshHabits.mockClear();

    act(() => {
      emitMetadataChange({
        filePath: '/mock/workspace/Habits/Daily.md',
        fileName: 'Daily.md',
        content: '',
        metadata: { habitStatus: 'completed' },
        changedFields: { habitStatus: 'completed' },
      });
      vi.advanceTimersByTime(150);
    });

    expect(mocks.refreshHabits).toHaveBeenCalledTimes(1);

    mocks.refreshHabits.mockClear();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('habit-content-changed', {
          detail: { filePath: '/mock/workspace/Habits/Daily.md' },
        })
      );
      vi.advanceTimersByTime(150);
    });

    expect(mocks.refreshHabits).toHaveBeenCalledTimes(1);
  });

  it('opens the canonical habit dialog and reloads habits plus the created file on success', async () => {
    const { onSelectFile } = renderDashboard();

    mocks.loadHabits.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Habit' }));
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Confirm Habit' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Habit' }));
      await Promise.resolve();
    });

    expect(mocks.loadHabits).toHaveBeenCalledWith('/mock/workspace');
    expect(onSelectFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/mock/workspace/Habits/New Habit.md',
        name: 'New Habit.md',
      })
    );
  });

  it('opens the canonical page dialog for goals and reloads horizons plus the created file on success', async () => {
    const { onSelectFile } = renderDashboard();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Goal' }));
      await Promise.resolve();
    });

    expect(screen.getByTestId('page-section')).toHaveTextContent('goals');

    mocks.loadHorizons.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Page' }));
      await Promise.resolve();
    });

    expect(mocks.loadHorizons).toHaveBeenCalledWith('/mock/workspace', []);
    expect(onSelectFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/mock/workspace/Goals/New Goal.md',
        name: 'New Goal.md',
      })
    );
  });

  it('deep-links Overview horizon selection into the Horizons tab state and computes recent activity', async () => {
    renderDashboard();

    expect(screen.getByTestId('recent-activity-count')).toHaveTextContent('4');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Jump Goals' }));
      await Promise.resolve();
    });

    expect(screen.getByText('Selected level: Goals')).toBeInTheDocument();
    expect(mocks.lastHorizonsProps.selectedLevel).toBe('Goals');
  });

  it('uses shared open helpers for activity rows and project readmes', async () => {
    const { onSelectProject, onSelectFile } = renderDashboard();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open Activity' }));
      await Promise.resolve();
    });

    expect(onSelectFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: mocks.action.path,
        name: 'review.md',
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open Project' }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSelectProject).toHaveBeenCalledWith('/mock/workspace/Projects/Alpha');
    expect(onSelectFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/mock/workspace/Projects/Alpha/README.md',
        name: 'README.md',
      })
    );
  });
});
