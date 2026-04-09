// @vitest-environment jsdom
import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GTDDashboard from '@/components/gtd/GTDDashboard';
import { emitContentSaved, emitMetadataChange } from '@/utils/content-event-bus';

const mocks = vi.hoisted(() => ({
  loadProjects: vi.fn(async () => []),
  loadProjectsData: vi.fn(async () => []),
  loadHabits: vi.fn(async () => undefined),
  refreshHabits: vi.fn(async () => undefined),
  updateHabitStatus: vi.fn(async () => undefined),
  loadActions: vi.fn(async () => undefined),
  updateActionStatus: vi.fn(async () => undefined),
  updateProject: vi.fn(async () => undefined),
  loadHorizons: vi.fn(async () => undefined),
  withErrorHandling: vi.fn(async <T,>(operation: () => Promise<T>) => operation()),
  toast: vi.fn(),
}));

vi.mock('@/hooks/useGTDSpace', () => ({
  useGTDSpace: () => ({
    isLoading: false,
    loadProjects: mocks.loadProjects,
  }),
}));

vi.mock('@/hooks/useActionsData', () => ({
  useActionsData: () => ({
    actions: [],
    isLoading: false,
    summary: {
      total: 0,
      inProgress: 0,
      completed: 0,
      waiting: 0,
    },
    loadActions: mocks.loadActions,
    updateActionStatus: mocks.updateActionStatus,
  }),
}));

vi.mock('@/hooks/useProjectsData', () => ({
  useProjectsData: () => ({
    projects: [],
    isLoading: false,
    loadProjects: mocks.loadProjectsData,
    updateProject: mocks.updateProject,
  }),
}));

vi.mock('@/hooks/useHabitsHistory', () => ({
  useHabitsHistory: () => ({
    habits: [],
    isLoading: false,
    summary: {
      total: 0,
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
    horizons: {},
    relationships: {},
    isLoading: false,
    loadHorizons: mocks.loadHorizons,
    findRelated: vi.fn(),
  }),
}));

vi.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({
    withErrorHandling: mocks.withErrorHandling,
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
  DashboardOverview: () => <div data-testid="dashboard-overview" />,
  DashboardActions: () => <div data-testid="dashboard-actions" />,
  DashboardProjects: () => <div data-testid="dashboard-projects" />,
  DashboardHabits: () => <div data-testid="dashboard-habits" />,
  DashboardHorizons: () => <div data-testid="dashboard-horizons" />,
}));

vi.mock('@/components/gtd', () => ({
  GTDProjectDialog: () => null,
  GTDActionDialog: () => null,
}));

vi.mock('@/utils/safe-invoke', () => ({
  safeInvoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('GTDDashboard habit refresh subscriptions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  function renderDashboard() {
    return render(
      <GTDDashboard
        currentFolder="/mock/workspace"
        gtdSpace={{
          root_path: '/mock/workspace',
          isGTDSpace: true,
          projects: [],
        } as any}
        onSelectProject={vi.fn()}
        onSelectFile={vi.fn()}
      />
    );
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
});
