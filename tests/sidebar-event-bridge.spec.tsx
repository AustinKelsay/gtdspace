// @vitest-environment jsdom
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitContentSaved, emitMetadataChange } from '@/utils/content-event-bus';
import { useGTDWorkspaceSidebar } from '@/hooks/useGTDWorkspaceSidebar';
import type { GTDProject, GTDSpace, MarkdownFile } from '@/types';

const safeInvokeMock = vi.fn();
const readFileTextMock = vi.fn();
const useGTDSpaceMock = vi.fn();

vi.mock('@/hooks/useGTDSpace', () => ({
  useGTDSpace: () => useGTDSpaceMock(),
}));

vi.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: () => ({
    reportError: vi.fn(),
    withErrorHandling: async <T,>(operation: () => Promise<T>) => operation(),
  }),
}));

vi.mock('@/utils/safe-invoke', () => ({
  safeInvoke: (...args: unknown[]) => safeInvokeMock(...args),
}));

vi.mock('@/hooks/useFileManager', () => ({
  readFileText: (...args: unknown[]) => readFileTextMock(...args),
}));

const rootPath = '/tmp/gtd-space';
const projectPath = `${rootPath}/Projects/Project Alpha`;
const actionPath = `${projectPath}/Write spec.md`;
const nestedActionPath = `${projectPath}/Docs/Write spec.md`;
const sectionFilePath = `${rootPath}/Habits/Morning Run.md`;

const gtdSpace: GTDSpace = {
  root_path: rootPath,
  is_initialized: true,
  isGTDSpace: true,
  projects: [],
  total_actions: 0,
};

let latestSidebar: ReturnType<typeof useGTDWorkspaceSidebar> | null = null;

function SidebarHookHarness({
  loadProjects = vi.fn().mockResolvedValue([]),
}: {
  loadProjects?: (path: string) => Promise<unknown>;
}) {
  const sidebar = useGTDWorkspaceSidebar({
    currentFolder: null,
    onFolderSelect: vi.fn(),
    onFileSelect: vi.fn(),
    onRefresh: vi.fn(),
    gtdSpace,
    checkGTDSpace: vi.fn().mockResolvedValue(true),
    loadProjects: loadProjects as (path: string) => Promise<GTDProject[]>,
    activeFilePath: null,
  });

  React.useLayoutEffect(() => {
    latestSidebar = sidebar;
  }, [sidebar]);

  return null;
}

function listenForEvent<T>(eventName: string) {
  const details: T[] = [];
  const listener = (event: Event) => {
    details.push((event as CustomEvent<T>).detail);
  };

  window.addEventListener(eventName, listener as EventListener);

  return {
    details,
    dispose: () => window.removeEventListener(eventName, listener as EventListener),
  };
}

describe('sidebar event bridge', () => {
  beforeEach(() => {
    latestSidebar = null;
    vi.clearAllMocks();
    useGTDSpaceMock.mockReturnValue({
      gtdSpace: null,
      isLoading: false,
      checkGTDSpace: vi.fn().mockResolvedValue(false),
      loadProjects: vi.fn().mockResolvedValue([]),
    });
    readFileTextMock.mockResolvedValue('# Action');
  });

  it('updates project and action overlays from metadata events', async () => {
    render(<SidebarHookHarness />);

    act(() => {
      emitMetadataChange({
        filePath: `${projectPath}/README.markdown`,
        fileName: 'README.markdown',
        content: '# Project Alpha',
        metadata: {
          projectStatus: 'completed',
          due_date: '2026-04-15',
        } as never,
        changedFields: {
          projectStatus: 'completed',
          due_date: '2026-04-15',
        } as never,
      });
    });

    await waitFor(() => {
      expect(latestSidebar?.projectMetadata[projectPath]).toMatchObject({
        status: 'completed',
        due_date: '2026-04-15',
      });
    });

    act(() => {
      emitMetadataChange({
        filePath: actionPath,
        fileName: 'Write spec.md',
        content: '# Write spec',
        metadata: {
          status: 'waiting_for',
          due_date: '2026-04-16',
        } as never,
        changedFields: {
          status: 'waiting_for',
          due_date: '2026-04-16',
        } as never,
      });
    });

    await waitFor(() => {
      expect(latestSidebar?.actionStatuses[actionPath]).toBe('waiting_for');
      expect(latestSidebar?.actionMetadata[actionPath]).toMatchObject({
        status: 'waiting_for',
        due_date: '2026-04-16',
      });
    });
  });

  it('maps datetime metadata fields into due-date overlays', async () => {
    render(<SidebarHookHarness />);

    act(() => {
      emitMetadataChange({
        filePath: `${projectPath}/README.markdown`,
        fileName: 'README.markdown',
        content: '# Project Alpha',
        metadata: {
          datetime: '2026-04-30',
        } as never,
        changedFields: {
          datetime: '2026-04-30',
        } as never,
      });
    });

    act(() => {
      emitMetadataChange({
        filePath: actionPath,
        fileName: 'Write spec.md',
        content: '# Write spec',
        metadata: {
          date_time: '2026-05-01',
        } as never,
        changedFields: {
          datetime: '2026-05-01',
        } as never,
      });
    });

    await waitFor(() => {
      expect(latestSidebar?.projectMetadata[projectPath]).toMatchObject({
        due_date: '2026-04-30',
      });
      expect(latestSidebar?.actionMetadata[actionPath]).toMatchObject({
        due_date: '2026-05-01',
      });
    });
  });
  it('dispatches project rename events with normalized paths', async () => {
    const loadProjects = vi.fn().mockResolvedValue([]);
    const projectRenamed = listenForEvent<{
      oldPath: string;
      newPath: string;
      newName: string;
    }>('project-renamed');

    safeInvokeMock.mockImplementation(async (command: string, _args?: unknown, fallback?: unknown) => {
      if (command === 'rename_gtd_project') {
        return `${rootPath}/Projects/Project Beta`;
      }
      return fallback ?? null;
    });

    render(<SidebarHookHarness loadProjects={loadProjects} />);

    act(() => {
      emitContentSaved({
        filePath: `${projectPath}/README.markdown`,
        fileName: 'README.markdown',
        content: '# Project Alpha',
        metadata: {
          title: 'Project Beta',
          due_date: '2026-04-20',
        } as never,
      });
    });

    await waitFor(() => {
      expect(projectRenamed.details).toEqual([
        {
          oldPath: projectPath,
          newPath: `${rootPath}/Projects/Project Beta`,
          newName: 'Project Beta',
        },
      ]);
    });

    expect(loadProjects).toHaveBeenCalledTimes(1);
    expect(loadProjects).toHaveBeenCalledWith(rootPath);
    projectRenamed.dispose();
  });

  it('dispatches action rename and file rename events', async () => {
    const actionRenamed = listenForEvent<{
      oldPath: string;
      newPath: string;
      newName: string;
    }>('action-renamed');
    const fileRenamed = listenForEvent<{ oldPath: string; newPath: string }>('file-renamed');

    safeInvokeMock.mockImplementation(async (command: string, args?: { path?: string }, fallback?: unknown) => {
      if (command === 'rename_gtd_action') {
        return `${projectPath}/Write spec updated.md`;
      }
      if (command === 'list_project_actions') {
        return [];
      }
      if (command === 'list_markdown_files') {
        return [];
      }
      return args?.path ?? fallback ?? null;
    });

    render(<SidebarHookHarness />);

    act(() => {
      emitContentSaved({
        filePath: actionPath,
        fileName: 'Write spec.md',
        content: '# Write spec',
        metadata: {
          title: 'Write spec updated',
        } as never,
      });
    });

    await waitFor(() => {
      expect(actionRenamed.details).toEqual([
        {
          oldPath: actionPath,
          newPath: `${projectPath}/Write spec updated.md`,
          newName: 'Write spec updated',
        },
      ]);
      expect(fileRenamed.details).toContainEqual({
        oldPath: actionPath,
        newPath: `${projectPath}/Write spec updated.md`,
      });
    });

    actionRenamed.dispose();
    fileRenamed.dispose();
  });

  it('dispatches section file rename events', async () => {
    const sectionFileRenamed = listenForEvent<{
      oldPath: string;
      newPath: string;
      newName: string;
    }>('section-file-renamed');
    const fileRenamed = listenForEvent<{ oldPath: string; newPath: string }>('file-renamed');

    safeInvokeMock.mockImplementation(async (command: string, args?: { path?: string }, fallback?: unknown) => {
      if (command === 'rename_file') {
        return {
          success: true,
          path: `${rootPath}/Habits/Habit Renamed.md`,
        };
      }
      if (command === 'check_directory_exists') {
        return true;
      }
      if (command === 'list_markdown_files') {
        return [];
      }
      return args?.path ?? fallback ?? null;
    });

    render(<SidebarHookHarness />);

    act(() => {
      emitContentSaved({
        filePath: sectionFilePath,
        fileName: 'Morning Run.md',
        content: '# Morning Run',
        metadata: {
          title: 'Habit Renamed',
        } as never,
      });
    });

    await waitFor(() => {
      expect(sectionFileRenamed.details).toEqual([
        {
          oldPath: sectionFilePath,
          newPath: `${rootPath}/Habits/Habit Renamed.md`,
          newName: 'Habit Renamed',
        },
      ]);
      expect(fileRenamed.details).toContainEqual({
        oldPath: sectionFilePath,
        newPath: `${rootPath}/Habits/Habit Renamed.md`,
      });
    });

    sectionFileRenamed.dispose();
    fileRenamed.dispose();
  });

  it('dispatches file deleted events from the controller delete flow', async () => {
    const fileDeleted = listenForEvent<{ path: string }>('file-deleted');

    safeInvokeMock.mockImplementation(async (command: string, _args?: { path?: string }, fallback?: unknown) => {
      if (command === 'delete_file') {
        return { success: true, path: sectionFilePath };
      }
      if (command === 'check_directory_exists') {
        return true;
      }
      if (command === 'list_markdown_files') {
        return [];
      }
      return fallback ?? null;
    });

    render(<SidebarHookHarness />);

    await act(async () => {
      latestSidebar?.setDeleteItem({
        type: 'file',
        path: sectionFilePath,
        name: 'Morning Run',
      });
    });

    await waitFor(() => {
      expect(latestSidebar?.deleteItem).toMatchObject({
        type: 'file',
        path: sectionFilePath,
      });
    });

    await act(async () => {
      await latestSidebar?.handleDelete();
    });

    await waitFor(() => {
      expect(fileDeleted.details).toEqual([{ path: sectionFilePath }]);
    });

    fileDeleted.dispose();
  });

  it('reloads deleted actions against the project root path', async () => {
    safeInvokeMock.mockImplementation(
      async (
        command: string,
        args?: { path?: string; projectPath?: string },
        fallback?: unknown
      ) => {
        if (command === 'delete_file') {
          return { success: true, path: nestedActionPath };
        }
        if (command === 'list_project_actions') {
          return [];
        }
        if (command === 'list_markdown_files') {
          return [];
        }
        if (command === 'check_directory_exists') {
          return true;
        }
        return args?.path ?? fallback ?? null;
      }
    );

    render(<SidebarHookHarness />);

    await act(async () => {
      latestSidebar?.setDeleteItem({
        type: 'action',
        path: nestedActionPath,
        name: 'Write spec',
      });
    });

    await act(async () => {
      await latestSidebar?.handleDelete();
    });

    await waitFor(() => {
      expect(safeInvokeMock).toHaveBeenCalledWith(
        'list_project_actions',
        { projectPath },
        null
      );
    });
  });

  it('forces deleted action reloads past an in-flight project load', async () => {
    let resolveFirstLoad: ((value: MarkdownFile[]) => void) | null = null;
    let projectActionLoads = 0;

    safeInvokeMock.mockImplementation(
      async (
        command: string,
        args?: { path?: string; projectPath?: string },
        fallback?: unknown
      ) => {
        if (command === 'delete_file') {
          return { success: true, path: actionPath };
        }
        if (command === 'list_project_actions') {
          projectActionLoads += 1;
          if (projectActionLoads === 1) {
            return new Promise<MarkdownFile[]>((resolve) => {
              resolveFirstLoad = resolve;
            });
          }
          return [];
        }
        if (command === 'list_markdown_files') {
          return [];
        }
        if (command === 'check_directory_exists') {
          return true;
        }
        return args?.path ?? fallback ?? null;
      }
    );

    render(<SidebarHookHarness />);

    let initialLoadPromise: Promise<void> | undefined;
    await act(async () => {
      initialLoadPromise = latestSidebar?.loadProjectActions(projectPath);
    });

    await waitFor(() => {
      expect(projectActionLoads).toBe(1);
      expect(latestSidebar?.projectLoading[projectPath]).toBe(true);
    });

    await act(async () => {
      latestSidebar?.setDeleteItem({
        type: 'action',
        path: actionPath,
        name: 'Write spec',
      });
    });

    await act(async () => {
      await latestSidebar?.handleDelete();
    });

    await waitFor(() => {
      expect(projectActionLoads).toBe(2);
    });

    await act(async () => {
      resolveFirstLoad?.([
        {
          name: 'Write spec.md',
          path: actionPath,
          last_modified: 1,
        } as MarkdownFile,
      ]);
      await initialLoadPromise;
    });

    await waitFor(() => {
      expect(latestSidebar?.projectActions[projectPath]).toEqual([]);
      expect(latestSidebar?.projectLoading[projectPath]).toBeUndefined();
    });
  });
});
