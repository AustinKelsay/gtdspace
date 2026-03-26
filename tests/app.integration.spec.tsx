// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { emitContentSaved } from '@/utils/content-event-bus';

const mocks = vi.hoisted(() => {
  const sidebarFile = {
    id: 'file-1',
    name: 'Task.md',
    path: '/mock/workspace/Projects/Alpha/Actions/Task.md',
    size: 100,
    last_modified: 1700000000,
    extension: 'md',
  };

  return {
    sidebarFile,
    safeInvoke: vi.fn(),
    waitForTauriReady: vi.fn(),
    showFileModified: vi.fn(),
    showFileReloaded: vi.fn(),
    showFileDeleted: vi.fn(),
    showFileCreated: vi.fn(),
    showWarning: vi.fn(),
    fileManager: {
      state: {
        currentFolder: null as string | null,
        files: [] as unknown[],
      },
      selectFolder: vi.fn(),
      loadFolder: vi.fn(),
    },
    tabManager: {
      tabState: {
        openTabs: [] as Array<{
          id: string;
          file: { path: string; name: string };
          filePath: string;
          content: string;
          hasUnsavedChanges: boolean;
        }>,
        activeTabId: null as string | null,
      },
      activeTab: null as null | {
        id: string;
        file: { path: string; name: string };
        filePath: string;
        content: string;
        hasUnsavedChanges: boolean;
      },
      hasUnsavedChanges: false,
      openTab: vi.fn(),
      activateTab: vi.fn(),
      closeTab: vi.fn(),
      updateTabContent: vi.fn(),
      saveTab: vi.fn(),
      handleTabAction: vi.fn(),
      saveAllTabs: vi.fn(),
      reorderTabs: vi.fn(),
      reloadTabFromDisk: vi.fn(),
    },
    fileWatcher: {
      state: {
        recentEvents: [] as Array<{
          timestamp: number;
          file_path: string;
          file_name: string;
          event_type: 'created' | 'deleted' | 'modified';
        }>,
      },
      startWatching: vi.fn(),
    },
    settings: {
      settings: {
        theme: 'dark',
        editor_mode: 'edit',
        last_folder: '',
        default_space_path: null,
        git_sync_workspace_path: null,
        git_sync_enabled: false,
        git_sync_repo_path: null,
        git_sync_remote_url: null,
        git_sync_branch: null,
        git_sync_last_push: null,
        git_sync_last_pull: null,
      },
      setTheme: vi.fn(),
      setLastFolder: vi.fn(),
      isLoading: false,
    },
    gitSync: {
      status: {
        enabled: false,
        configured: false,
        encryptionConfigured: false,
        hasPendingCommits: false,
        hasRemote: false,
        message: 'disabled',
      },
      isPreviewing: false,
      isPushing: false,
      isPulling: false,
      operation: null as 'push' | 'pull' | null,
      refreshStatus: vi.fn(),
      previewPush: vi.fn(),
      push: vi.fn(),
      pull: vi.fn(),
    },
    modalManager: {
      isModalOpen: vi.fn(() => false),
      openModal: vi.fn(),
      closeModal: vi.fn(),
    },
    keyboardShortcuts: vi.fn(),
    withErrorHandling: vi.fn(
      async <T,>(operation: () => Promise<T>, _message?: string): Promise<T | null> => {
        try {
          return await operation();
        } catch {
          return null;
        }
      }
    ),
    gtdSpace: {
      gtdSpace: null as null | { root_path: string; isGTDSpace: boolean; projects: unknown[] },
      isLoading: false,
      checkGTDSpace: vi.fn(async () => false),
      loadProjects: vi.fn(),
      initializeGTDSpace: vi.fn(),
      initializeDefaultSpaceIfNeeded: vi.fn(async () => null),
      refreshSpace: vi.fn(),
    },
  };
});

vi.mock('@/utils/resize-observer-fix', () => ({}));

vi.mock('@/utils/tauri-ready', () => ({
  waitForTauriReady: mocks.waitForTauriReady,
}));

vi.mock('@/utils/safe-invoke', () => ({
  safeInvoke: mocks.safeInvoke,
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    showFileModified: mocks.showFileModified,
    showFileReloaded: mocks.showFileReloaded,
    showFileDeleted: mocks.showFileDeleted,
    showFileCreated: mocks.showFileCreated,
    showWarning: mocks.showWarning,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFileManager', () => ({
  useFileManager: () => mocks.fileManager,
}));

vi.mock('@/hooks/useTabManager', () => ({
  useTabManager: () => mocks.tabManager,
}));

vi.mock('@/hooks/useFileWatcher', () => ({
  useFileWatcher: () => mocks.fileWatcher,
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => mocks.settings,
}));

vi.mock('@/hooks/useGitSync', () => ({
  useGitSync: () => mocks.gitSync,
}));

vi.mock('@/hooks/useModalManager', () => ({
  useModalManager: () => mocks.modalManager,
}));

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: (...args: unknown[]) => mocks.keyboardShortcuts(...args),
}));

vi.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({
    withErrorHandling: mocks.withErrorHandling,
  }),
}));

vi.mock('@/hooks/useGTDSpace', () => ({
  useGTDSpace: () => mocks.gtdSpace,
}));

vi.mock('@/components/error-handling', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/app', () => ({
  AppHeader: ({
    onSaveActiveFile,
    onSaveAllFiles,
    onGitPush,
    onGitPull,
  }: {
    onSaveActiveFile: () => Promise<void>;
    onSaveAllFiles: () => Promise<void>;
    onGitPush?: () => Promise<void>;
    onGitPull?: () => Promise<void>;
  }) => (
    <div data-testid="app-header">
      Header
      <button type="button" onClick={() => void onSaveActiveFile()}>
        Save Active (Header)
      </button>
      <button type="button" onClick={() => void onSaveAllFiles()}>
        Save All (Header)
      </button>
      <button type="button" onClick={() => void onGitPush?.()}>
        Git Push (Header)
      </button>
      <button type="button" onClick={() => void onGitPull?.()}>
        Git Pull (Header)
      </button>
    </div>
  ),
  AppLoadingScreen: () => <div data-testid="app-loading">Loading...</div>,
}));

vi.mock('@/components/gtd', () => ({
  GTDWorkspaceSidebar: ({
    onFileSelect,
  }: {
    onFileSelect: (file: typeof mocks.sidebarFile) => void;
  }) => (
    <div data-testid="workspace-sidebar">
      <button type="button" onClick={() => onFileSelect(mocks.sidebarFile)}>
        Open Sidebar File
      </button>
    </div>
  ),
  GTDDashboard: () => <div data-testid="gtd-dashboard">Dashboard</div>,
  GTDQuickActions: () => null,
  GTDInitDialog: () => null,
}));

vi.mock('@/components/editor/EnhancedTextEditor', () => ({
  EnhancedTextEditor: ({ content }: { content: string }) => (
    <div data-testid="enhanced-editor">{content}</div>
  ),
}));

vi.mock('@/components/gtd/ActionPage', () => ({
  ActionPage: ({ content }: { content: string }) => <div data-testid="action-page">{content}</div>,
}));

vi.mock('@/components/gtd/ProjectPage', () => ({
  default: ({ content }: { content: string }) => <div data-testid="project-page">{content}</div>,
}));

vi.mock('@/components/gtd/AreaPage', () => ({
  default: ({ content }: { content: string }) => <div data-testid="area-page">{content}</div>,
}));

vi.mock('@/components/gtd/GoalPage', () => ({
  default: ({ content }: { content: string }) => <div data-testid="goal-page">{content}</div>,
}));

vi.mock('@/components/gtd/VisionPage', () => ({
  default: ({ content }: { content: string }) => <div data-testid="vision-page">{content}</div>,
}));

vi.mock('@/components/gtd/PurposePage', () => ({
  default: ({ content }: { content: string }) => <div data-testid="purpose-page">{content}</div>,
}));

vi.mock('@/components/gtd/HorizonOverviewPage', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="horizon-overview-page">{content}</div>
  ),
}));

vi.mock('@/components/gtd/HabitPage', () => ({
  HabitPage: ({ content }: { content: string }) => <div data-testid="habit-page">{content}</div>,
}));

vi.mock('@/components/calendar/CalendarView', () => ({
  CalendarView: () => <div data-testid="calendar-view">Calendar</div>,
}));

vi.mock('@/components/calendar/GoogleCalendarAutoSyncManager', () => ({
  GoogleCalendarAutoSyncManager: () => null,
}));

vi.mock('@/components/tabs', () => ({
  TabManager: () => <div data-testid="tab-manager">Tabs</div>,
}));

vi.mock('@/components/lazy', () => ({
  SettingsManagerLazy: () => null,
  GlobalSearchLazy: () => null,
  KeyboardShortcutsReferenceLazy: () => null,
}));

vi.mock('@/components/git-sync/GitSyncDiffReviewDialog', () => ({
  GitSyncDiffReviewDialog: ({
    open,
    preview,
    onConfirm,
  }: {
    open: boolean;
    preview: { summary?: { totalEntries?: number } } | null;
    onConfirm: () => Promise<void>;
  }) => (
    open ? (
      <div data-testid="git-sync-review">
        Review {preview?.summary?.totalEntries ?? 0}
        <button type="button" onClick={() => void onConfirm()}>
          Confirm Git Push
        </button>
      </div>
    ) : null
  ),
}));

import App from '@/App';

const getKeyboardHandlers = () => {
  const calls = mocks.keyboardShortcuts.mock.calls;
  const handlers = calls[calls.length - 1]?.[0];
  if (!handlers) {
    throw new Error('Expected keyboard shortcuts handlers to be registered');
  }
  return handlers as {
    onSaveActive?: () => Promise<void>;
    onSaveAll?: () => Promise<void>;
  };
};

describe('App integration workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.waitForTauriReady.mockResolvedValue(undefined);
    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'ping') return 'pong';
      if (command === 'check_permissions') return { status: 'ok' };
      if (command === 'check_and_reset_habits') return [];
      if (command === 'check_is_gtd_space') return false;
      if (command === 'read_file') return '# Loaded content';
      return null;
    });

    mocks.fileManager.state.currentFolder = null;
    mocks.fileManager.state.files = [];
    mocks.fileManager.selectFolder.mockResolvedValue(undefined);
    mocks.fileManager.loadFolder.mockResolvedValue(undefined);

    mocks.tabManager.tabState.openTabs = [];
    mocks.tabManager.tabState.activeTabId = null;
    mocks.tabManager.activeTab = null;
    mocks.tabManager.hasUnsavedChanges = false;
    mocks.tabManager.openTab.mockResolvedValue('tab-1');
    mocks.tabManager.activateTab.mockResolvedValue(undefined);
    mocks.tabManager.closeTab.mockResolvedValue(undefined);
    mocks.tabManager.reloadTabFromDisk.mockResolvedValue(false);
    mocks.tabManager.saveTab.mockResolvedValue(false);
    mocks.tabManager.saveAllTabs.mockResolvedValue(undefined);

    mocks.fileWatcher.state.recentEvents = [];
    mocks.fileWatcher.startWatching.mockResolvedValue(undefined);

    mocks.settings.settings.theme = 'light';
    mocks.settings.settings.last_folder = '';
    mocks.settings.isLoading = false;
    mocks.settings.setTheme.mockResolvedValue(undefined);
    mocks.settings.setLastFolder.mockResolvedValue(undefined);

    mocks.gitSync.status = {
      enabled: false,
      configured: false,
      encryptionConfigured: false,
      hasPendingCommits: false,
      hasRemote: false,
      message: 'disabled',
    };
    mocks.gitSync.isPreviewing = false;
    mocks.gitSync.isPushing = false;
    mocks.gitSync.isPulling = false;
    mocks.gitSync.operation = null;

    mocks.gtdSpace.gtdSpace = null;
    mocks.gtdSpace.isLoading = false;
    mocks.gtdSpace.initializeDefaultSpaceIfNeeded.mockResolvedValue(null);
    mocks.gtdSpace.checkGTDSpace.mockResolvedValue(false);
    mocks.gtdSpace.loadProjects.mockResolvedValue(undefined);
    mocks.gtdSpace.initializeGTDSpace.mockResolvedValue(undefined);
    mocks.gtdSpace.refreshSpace.mockResolvedValue(undefined);

    mocks.modalManager.isModalOpen.mockReturnValue(false);
  });

  it('lets the user trigger folder selection from the welcome screen', async () => {
    render(<App />);

    await screen.findByText('Welcome to GTD Space');
    fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));

    expect(mocks.fileManager.selectFolder).toHaveBeenCalledTimes(1);
  });

  it('opens and activates a tab when a sidebar file is selected', async () => {
    mocks.fileManager.state.currentFolder = '/mock/workspace';
    mocks.fileManager.state.files = [mocks.sidebarFile];

    render(<App />);

    const openButton = await screen.findByRole('button', { name: 'Open Sidebar File' });
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(mocks.tabManager.openTab).toHaveBeenCalledWith(mocks.sidebarFile);
    });
    expect(mocks.tabManager.activateTab).toHaveBeenCalledWith('tab-1');
  });

  it('handles deleted file watcher events by closing matching tabs and refreshing files', async () => {
    mocks.fileManager.state.currentFolder = '/mock/workspace';
    mocks.tabManager.tabState.openTabs = [
      {
        id: 'tab-abc',
        file: { path: '/mock/workspace/Notes.md', name: 'Notes.md' },
        filePath: '/mock/workspace/Notes.md',
        content: '# Notes',
        hasUnsavedChanges: false,
      },
    ];
    mocks.fileWatcher.state.recentEvents = [
      {
        timestamp: 1700000001,
        file_path: '/mock/workspace/Notes.md',
        file_name: 'Notes.md',
        event_type: 'deleted',
      },
    ];

    render(<App />);

    await waitFor(() => {
      expect(mocks.showFileDeleted).toHaveBeenCalledWith('Notes.md');
      expect(mocks.tabManager.closeTab).toHaveBeenCalledWith('tab-abc');
      expect(mocks.fileManager.loadFolder).toHaveBeenCalledWith('/mock/workspace', {
        saveToSettings: false,
      });
    });
  });

  it('runs keyboard save-active workflow and reloads projects when a project markdown file is saved', async () => {
    const activeProjectTab = {
      id: 'tab-project',
      file: {
        path: '/mock/workspace/Projects/Alpha/README.md',
        name: 'README.md',
      },
      filePath: '/mock/workspace/Projects/Alpha/README.md',
      content: '# Alpha',
      hasUnsavedChanges: true,
    };

    mocks.gtdSpace.gtdSpace = {
      root_path: '/mock/workspace',
      isGTDSpace: true,
      projects: [],
    };
    mocks.tabManager.tabState.openTabs = [activeProjectTab];
    mocks.tabManager.tabState.activeTabId = activeProjectTab.id;
    mocks.tabManager.activeTab = activeProjectTab;
    mocks.tabManager.saveTab.mockImplementation(async () => {
      emitContentSaved({
        filePath: '/mock/workspace/Projects/Alpha/README.md',
        fileName: 'README.md',
        content: '# Alpha',
        metadata: {},
      });
      return true;
    });

    render(<App />);

    await waitFor(() => {
      expect(mocks.keyboardShortcuts).toHaveBeenCalled();
    });

    const handlers = getKeyboardHandlers();
    await handlers.onSaveActive?.();

    expect(mocks.tabManager.saveTab).toHaveBeenCalledWith('tab-project');
    await waitFor(() => {
      expect(mocks.gtdSpace.loadProjects).toHaveBeenCalledWith('/mock/workspace');
    });
  });

  it('runs keyboard save-all workflow and reloads projects when unsaved project files exist', async () => {
    mocks.gtdSpace.gtdSpace = {
      root_path: '/mock/workspace',
      isGTDSpace: true,
      projects: [],
    };
    mocks.tabManager.tabState.openTabs = [
      {
        id: 'tab-project-unsaved',
        file: {
          path: '/mock/workspace/Projects/Alpha/Notes.md',
          name: 'Notes.md',
        },
        filePath: '/mock/workspace/Projects/Alpha/Notes.md',
        content: '# unsaved',
        hasUnsavedChanges: true,
      },
      {
        id: 'tab-non-project',
        file: {
          path: '/mock/workspace/Cabinet/Ref.md',
          name: 'Ref.md',
        },
        filePath: '/mock/workspace/Cabinet/Ref.md',
        content: '# ref',
        hasUnsavedChanges: true,
      },
    ];

    mocks.tabManager.saveAllTabs.mockImplementation(async () => {
      emitContentSaved({
        filePath: '/mock/workspace/Projects/Alpha/Notes.md',
        fileName: 'Notes.md',
        content: '# unsaved',
        metadata: {},
      });
      return true;
    });

    render(<App />);

    await waitFor(() => {
      expect(mocks.keyboardShortcuts).toHaveBeenCalled();
    });

    const handlers = getKeyboardHandlers();
    await handlers.onSaveAll?.();

    expect(mocks.tabManager.saveAllTabs).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mocks.gtdSpace.loadProjects).toHaveBeenCalledWith('/mock/workspace');
    });
  });

  it('saves all tabs before opening the git backup review and confirms push from the review dialog', async () => {
    mocks.settings.settings.git_sync_enabled = true;
    mocks.gitSync.status = {
      enabled: true,
      configured: true,
      encryptionConfigured: true,
      hasPendingCommits: false,
      hasRemote: true,
      message: null,
    };
    mocks.tabManager.saveAllTabs.mockResolvedValue(true);
    mocks.gitSync.previewPush.mockResolvedValue({
      hasBaseline: true,
      baselineBackupFile: 'backup-1.tar.gz.enc',
      baselineTimestamp: '2026-03-25T12:00:00Z',
      summary: {
        totalEntries: 1,
        added: 0,
        modified: 1,
        deleted: 0,
        renamed: 0,
        unchangedExcluded: 0,
        textDiffs: 1,
        binaryDiffs: 0,
        beforeBytes: 10,
        afterBytes: 12,
      },
      entries: [],
      truncated: false,
      warnings: null,
    });
    mocks.gitSync.push.mockResolvedValue(true);

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Git Push (Header)' }));

    await waitFor(() => {
      expect(mocks.tabManager.saveAllTabs).toHaveBeenCalledTimes(1);
      expect(mocks.gitSync.previewPush).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByTestId('git-sync-review')).toHaveTextContent('Review 1');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Git Push' }));

    await waitFor(() => {
      expect(mocks.gitSync.push).toHaveBeenCalledTimes(1);
    });
  });

  it('recovers a corrupted last_folder subfolder path and initializes the workspace from root', async () => {
    mocks.settings.settings.last_folder = '/mock/workspace/Projects';
    mocks.gtdSpace.checkGTDSpace.mockResolvedValue(true);
    mocks.safeInvoke.mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'ping') return 'pong';
      if (command === 'check_permissions') return { status: 'ok' };
      if (command === 'check_and_reset_habits') return [];
      if (command === 'check_is_gtd_space') {
        const path = (args as { path?: string } | undefined)?.path;
        return path === '/mock/workspace';
      }
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(mocks.settings.setLastFolder).toHaveBeenCalledWith('/mock/workspace');
      expect(mocks.fileManager.loadFolder).toHaveBeenCalledWith('/mock/workspace');
      expect(mocks.fileWatcher.startWatching).toHaveBeenCalledWith('/mock/workspace');
      expect(mocks.gtdSpace.checkGTDSpace).toHaveBeenCalledWith('/mock/workspace');
      expect(mocks.gtdSpace.loadProjects).toHaveBeenCalledWith('/mock/workspace');
    });
  });

  it('routes project action files to ActionPage', async () => {
    const actionTab = {
      id: 'tab-action',
      file: {
        path: '/mock/workspace/Projects/Alpha/Actions/Next.md',
        name: 'Next.md',
      },
      filePath: '/mock/workspace/Projects/Alpha/Actions/Next.md',
      content: '[!singleselect:status:in-progress]',
      hasUnsavedChanges: false,
    };

    mocks.gtdSpace.gtdSpace = {
      root_path: '/mock/workspace',
      isGTDSpace: true,
      projects: [],
    };
    mocks.tabManager.tabState.openTabs = [actionTab];
    mocks.tabManager.tabState.activeTabId = actionTab.id;
    mocks.tabManager.activeTab = actionTab;

    render(<App />);

    expect(await screen.findByTestId('action-page')).toBeInTheDocument();
    expect(screen.queryByTestId('project-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('enhanced-editor')).not.toBeInTheDocument();
  });

  it('routes project README files to ProjectPage', async () => {
    const projectTab = {
      id: 'tab-project-readme',
      file: {
        path: '/mock/workspace/Projects/Alpha/README.md',
        name: 'README.md',
      },
      filePath: '/mock/workspace/Projects/Alpha/README.md',
      content: '# Alpha',
      hasUnsavedChanges: false,
    };

    mocks.gtdSpace.gtdSpace = {
      root_path: '/mock/workspace',
      isGTDSpace: true,
      projects: [],
    };
    mocks.tabManager.tabState.openTabs = [projectTab];
    mocks.tabManager.tabState.activeTabId = projectTab.id;
    mocks.tabManager.activeTab = projectTab;

    render(<App />);

    expect(await screen.findByTestId('project-page')).toBeInTheDocument();
    expect(screen.queryByTestId('action-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('enhanced-editor')).not.toBeInTheDocument();
  });

  it('routes non-action project markdown files to default editor', async () => {
    const regularTab = {
      id: 'tab-regular',
      file: {
        path: '/mock/workspace/Projects/Alpha/Notes.md',
        name: 'Notes.md',
      },
      filePath: '/mock/workspace/Projects/Alpha/Notes.md',
      content: '# Plain notes',
      hasUnsavedChanges: false,
    };

    mocks.gtdSpace.gtdSpace = {
      root_path: '/mock/workspace',
      isGTDSpace: true,
      projects: [],
    };
    mocks.tabManager.tabState.openTabs = [regularTab];
    mocks.tabManager.tabState.activeTabId = regularTab.id;
    mocks.tabManager.activeTab = regularTab;

    render(<App />);

    expect(await screen.findByTestId('enhanced-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('action-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('project-page')).not.toBeInTheDocument();
  });

  it('auto-reloads externally modified clean tabs and shows a passive toast', async () => {
    mocks.fileManager.state.currentFolder = '/mock/workspace';
    mocks.tabManager.tabState.openTabs = [
      {
        id: 'tab-clean',
        file: { path: '/mock/workspace/Notes.md', name: 'Notes.md' },
        filePath: '/mock/workspace/Notes.md',
        content: '# Notes',
        hasUnsavedChanges: false,
      },
    ];
    mocks.fileWatcher.state.recentEvents = [
      {
        timestamp: 1700000200,
        file_path: '/mock/workspace/Notes.md',
        file_name: 'Notes.md',
        event_type: 'modified',
      },
    ];
    mocks.tabManager.reloadTabFromDisk.mockResolvedValue(true);

    render(<App />);

    await waitFor(() => {
      expect(mocks.tabManager.reloadTabFromDisk).toHaveBeenCalledWith('tab-clean');
    });
    await waitFor(() => {
      expect(mocks.showFileReloaded).toHaveBeenCalledWith('Notes.md');
    });
    expect(mocks.showFileModified).not.toHaveBeenCalled();
  });

  it('shows modified warning without reload action for dirty tabs', async () => {
    mocks.fileManager.state.currentFolder = '/mock/workspace';
    mocks.tabManager.tabState.openTabs = [
      {
        id: 'tab-dirty',
        file: { path: '/mock/workspace/Notes.md', name: 'Notes.md' },
        filePath: '/mock/workspace/Notes.md',
        content: '# Notes',
        hasUnsavedChanges: true,
      },
    ];
    mocks.fileWatcher.state.recentEvents = [
      {
        timestamp: 1700000201,
        file_path: '/mock/workspace/Notes.md',
        file_name: 'Notes.md',
        event_type: 'modified',
      },
    ];

    render(<App />);

    await waitFor(() => {
      expect(mocks.showFileModified).toHaveBeenCalledTimes(1);
    });

    const call = mocks.showFileModified.mock.calls[0];
    expect(call?.[0]).toBe('Notes.md');
    expect(call).toHaveLength(1);
    expect(mocks.tabManager.reloadTabFromDisk).not.toHaveBeenCalled();
    expect(mocks.showFileReloaded).not.toHaveBeenCalled();
  });

  it('falls back to modified warning with reload action when clean-tab auto-reload fails', async () => {
    mocks.fileManager.state.currentFolder = '/mock/workspace';
    mocks.tabManager.tabState.openTabs = [
      {
        id: 'tab-clean-fallback',
        file: { path: '/mock/workspace/Notes.md', name: 'Notes.md' },
        filePath: '/mock/workspace/Notes.md',
        content: '# Notes',
        hasUnsavedChanges: false,
      },
    ];
    mocks.fileWatcher.state.recentEvents = [
      {
        timestamp: 1700000202,
        file_path: '/mock/workspace/Notes.md',
        file_name: 'Notes.md',
        event_type: 'modified',
      },
    ];
    mocks.tabManager.reloadTabFromDisk.mockResolvedValue(false);

    render(<App />);

    await waitFor(() => {
      expect(mocks.tabManager.reloadTabFromDisk).toHaveBeenCalledWith('tab-clean-fallback');
    });
    await waitFor(() => {
      expect(mocks.showFileModified).toHaveBeenCalledTimes(1);
    });

    const call = mocks.showFileModified.mock.calls[0];
    expect(call?.[0]).toBe('Notes.md');
    expect(call?.[1]).toMatchObject({
      onReload: expect.any(Function),
    });
    expect(mocks.showFileReloaded).not.toHaveBeenCalled();
  });

  it('ignores modified events for files that are not open in a tab', async () => {
    mocks.fileManager.state.currentFolder = '/mock/workspace';
    mocks.tabManager.tabState.openTabs = [
      {
        id: 'tab-other',
        file: { path: '/mock/workspace/Other.md', name: 'Other.md' },
        filePath: '/mock/workspace/Other.md',
        content: '# Other',
        hasUnsavedChanges: false,
      },
    ];
    mocks.fileWatcher.state.recentEvents = [
      {
        timestamp: 1700000203,
        file_path: '/mock/workspace/Notes.md',
        file_name: 'Notes.md',
        event_type: 'modified',
      },
    ];

    render(<App />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.tabManager.reloadTabFromDisk).not.toHaveBeenCalled();
    expect(mocks.showFileModified).not.toHaveBeenCalled();
    expect(mocks.showFileReloaded).not.toHaveBeenCalled();
  });

  it('reloads project data when a project markdown content-saved event fires', async () => {
    mocks.gtdSpace.gtdSpace = {
      root_path: '/mock/workspace',
      isGTDSpace: true,
      projects: [],
    };

    render(<App />);

    act(() => {
      emitContentSaved({
        filePath: '/mock/workspace/Projects/Alpha/README.md',
        fileName: 'README.md',
        content: '# Alpha',
        metadata: {},
      });
    });

    await waitFor(() => {
      expect(mocks.gtdSpace.loadProjects).toHaveBeenCalledWith('/mock/workspace');
    });

    mocks.gtdSpace.loadProjects.mockClear();
    act(() => {
      emitContentSaved({
        filePath: '/mock/workspace/Cabinet/Ref.md',
        fileName: 'Ref.md',
        content: '# Ref',
        metadata: {},
      });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 75));
    });

    await waitFor(() => {
      expect(mocks.gtdSpace.loadProjects).not.toHaveBeenCalled();
    });
  });

  it('reacts to habit status/content events by reloading active habit tab content', async () => {
    const habitPath = '/mock/workspace/Habits/Daily.md';
    const activeHabitTab = {
      id: 'tab-habit',
      file: { path: habitPath, name: 'Daily.md' },
      filePath: habitPath,
      content: '# Daily',
      hasUnsavedChanges: false,
    };

    mocks.gtdSpace.gtdSpace = {
      root_path: '/mock/workspace',
      isGTDSpace: true,
      projects: [],
    };
    mocks.tabManager.tabState.openTabs = [activeHabitTab];
    mocks.tabManager.tabState.activeTabId = activeHabitTab.id;
    mocks.tabManager.activeTab = activeHabitTab;

    mocks.safeInvoke.mockImplementation(async (command: string, args?: unknown) => {
      if (command === 'ping') return 'pong';
      if (command === 'check_permissions') return { status: 'ok' };
      if (command === 'check_and_reset_habits') return [];
      if (command === 'check_is_gtd_space') return false;
      if (command === 'read_file') {
        const path = (args as { path?: string } | undefined)?.path;
        if (path === habitPath) return '# Refreshed habit content';
        return '# Loaded content';
      }
      return null;
    });

    render(<App />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('habit-status-updated', { detail: { habitPath } })
      );
    });

    await waitFor(() => {
      expect(mocks.tabManager.reloadTabFromDisk).toHaveBeenCalledWith('tab-habit');
      expect(mocks.gtdSpace.refreshSpace).toHaveBeenCalledTimes(1);
    });

    mocks.tabManager.reloadTabFromDisk.mockClear();
    act(() => {
      window.dispatchEvent(
        new CustomEvent('habit-content-changed', { detail: { filePath: habitPath } })
      );
    });

    await waitFor(() => {
      expect(mocks.tabManager.reloadTabFromDisk).toHaveBeenCalledWith('tab-habit');
    });
  });

  it('refreshes files and projects after a successful git pull', async () => {
    mocks.gtdSpace.gtdSpace = {
      root_path: '/mock/workspace',
      isGTDSpace: true,
      projects: [],
    };
    mocks.fileManager.state.currentFolder = '/mock/workspace';
    mocks.gitSync.pull.mockResolvedValue(true);
    mocks.gitSync.previewPush.mockResolvedValue(null);
    mocks.gitSync.push.mockResolvedValue(true);

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Git Pull (Header)' }));

    await waitFor(() => {
      expect(mocks.gitSync.pull).toHaveBeenCalledTimes(1);
      expect(mocks.fileManager.loadFolder).toHaveBeenCalledWith('/mock/workspace', {
        saveToSettings: false,
      });
      expect(mocks.gtdSpace.loadProjects).toHaveBeenCalledWith('/mock/workspace');
    });
  });
});
