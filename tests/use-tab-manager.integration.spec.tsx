// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import type { FileTab, MarkdownFile, TabManagerConfig } from '@/types';
import { useTabManager } from '@/hooks/useTabManager';

const mocks = vi.hoisted(() => ({
  safeInvoke: vi.fn(),
  emitContentChange: vi.fn(),
  emitContentSaved: vi.fn(),
  emitMetadataChange: vi.fn(),
  extractMetadata: vi.fn(() => ({})),
  getMetadataChanges: vi.fn(() => ({})),
  needsMigration: vi.fn(() => false),
  migrateMarkdownContent: vi.fn((content: string) => `migrated::${content}`),
}));

vi.mock('@/utils/safe-invoke', () => ({
  safeInvoke: mocks.safeInvoke,
}));

vi.mock('@/utils/content-event-bus', () => ({
  emitContentChange: mocks.emitContentChange,
  emitContentSaved: mocks.emitContentSaved,
  emitMetadataChange: mocks.emitMetadataChange,
}));

vi.mock('@/utils/metadata-extractor', () => ({
  extractMetadata: mocks.extractMetadata,
  getMetadataChanges: mocks.getMetadataChanges,
}));

vi.mock('@/utils/data-migration', () => ({
  needsMigration: mocks.needsMigration,
  migrateMarkdownContent: mocks.migrateMarkdownContent,
}));

vi.mock('lodash.debounce', () => ({
  default: <T extends (...args: any[]) => any>(fn: T) => {
    const wrapped = ((...args: Parameters<T>) => fn(...args)) as T & {
      cancel: ReturnType<typeof vi.fn>;
    };
    wrapped.cancel = vi.fn();
    return wrapped;
  },
}));

vi.mock('@/utils/logger', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    warnOnce: vi.fn(),
    error: vi.fn(),
  }),
}));

function buildFile(id: string, path: string): MarkdownFile {
  return {
    id,
    name: path.split('/').pop() || `${id}.md`,
    path,
    size: 42,
    last_modified: 1700000000,
    extension: 'md',
  };
}

function renderTabManagerHook(config: TabManagerConfig = {}) {
  let current: ReturnType<typeof useTabManager> | null = null;

  const Harness = () => {
    current = useTabManager(config);
    return null;
  };

  const rendered = render(<Harness />);

  return {
    ...rendered,
    getCurrent: () => {
      if (!current) {
        throw new Error('Hook state not initialized yet');
      }
      return current;
    },
  };
}

describe('useTabManager integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mocks.needsMigration.mockReturnValue(false);
    mocks.migrateMarkdownContent.mockImplementation((content: string) => `migrated::${content}`);
    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'read_file') return '# file content';
      if (command === 'save_file') return 'ok';
      return null;
    });
  });

  it('applies migration on open and persists migrated content with backup', async () => {
    const legacyContent = '[!datetime:created_date:2026-02-20T09:30:00Z]';
    mocks.needsMigration.mockReturnValue(true);
    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'read_file') return legacyContent;
      if (command === 'save_file') return 'ok';
      return null;
    });

    const { getCurrent } = renderTabManagerHook();
    const file = buildFile('f-1', '/mock/workspace/Projects/Alpha/README.md');

    let tabId = '';
    await act(async () => {
      tabId = await getCurrent().openTab(file);
    });

    await waitFor(() => {
      expect(getCurrent().tabState.openTabs).toHaveLength(1);
      expect(getCurrent().activeTab?.id).toBe(tabId);
    });

    const saveCalls = mocks.safeInvoke.mock.calls.filter(([command]) => command === 'save_file');
    expect(saveCalls).toHaveLength(2);
    expect(saveCalls[0]?.[1]).toMatchObject({
      path: '/mock/workspace/Projects/Alpha/README.md.backup',
      content: legacyContent,
    });
    expect(saveCalls[1]?.[1]).toMatchObject({
      path: '/mock/workspace/Projects/Alpha/README.md',
      content: `migrated::${legacyContent}`,
    });

    expect(mocks.emitContentSaved).toHaveBeenCalled();
    expect(mocks.emitMetadataChange).toHaveBeenCalled();
  });

  it('honors configured max tabs and evicts the oldest inactive clean tab when exceeded', async () => {
    const { getCurrent } = renderTabManagerHook({ maxTabs: 2 });

    const firstFile = buildFile('f-1', '/mock/workspace/notes-1.md');
    const secondFile = buildFile('f-2', '/mock/workspace/notes-2.md');
    const thirdFile = buildFile('f-3', '/mock/workspace/notes-3.md');

    await act(async () => {
      await getCurrent().openTab(firstFile);
      await getCurrent().openTab(secondFile);
    });

    act(() => {
      getCurrent().activateTab(getCurrent().tabState.openTabs[0].id);
    });

    await act(async () => {
      await getCurrent().openTab(thirdFile);
    });

    await waitFor(() => {
      expect(getCurrent().tabState.openTabs).toHaveLength(2);
    });

    const remainingPaths = getCurrent().tabState.openTabs.map((tab) => tab.file.path);
    expect(remainingPaths).toEqual([
      '/mock/workspace/notes-1.md',
      '/mock/workspace/notes-3.md',
    ]);
    expect(getCurrent().tabState.recentlyClosed[0]?.file.path).toBe('/mock/workspace/notes-2.md');
  });

  it('saves an edited tab and emits content-saved updates', async () => {
    const { getCurrent } = renderTabManagerHook();
    const file = buildFile('f-save', '/mock/workspace/Projects/Alpha/Task.md');

    let tabId = '';
    await act(async () => {
      tabId = await getCurrent().openTab(file);
    });

    act(() => {
      getCurrent().updateTabContent(tabId, '# changed');
    });

    await waitFor(() => {
      expect(getCurrent().tabState.openTabs[0]?.hasUnsavedChanges).toBe(true);
    });

    let saved = false;
    await act(async () => {
      saved = await getCurrent().saveTab(tabId);
    });

    expect(saved).toBe(true);
    expect(mocks.safeInvoke).toHaveBeenCalledWith(
      'save_file',
      { path: '/mock/workspace/Projects/Alpha/Task.md', content: '# changed' },
      null,
    );
    expect(mocks.emitContentSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/mock/workspace/Projects/Alpha/Task.md',
        content: '# changed',
      }),
    );

    await waitFor(() => {
      expect(getCurrent().tabState.openTabs[0]?.hasUnsavedChanges).toBe(false);
    });
  });

  it('throws when save_file invoke returns null for a dirty tab', async () => {
    const { getCurrent } = renderTabManagerHook();
    const file = buildFile('f-fail', '/mock/workspace/Projects/Alpha/Fail.md');

    let tabId = '';
    await act(async () => {
      tabId = await getCurrent().openTab(file);
    });
    act(() => {
      getCurrent().updateTabContent(tabId, '# changed');
    });
    await waitFor(() => {
      expect(getCurrent().tabState.openTabs[0]?.hasUnsavedChanges).toBe(true);
    });

    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'read_file') return '# file content';
      if (command === 'save_file') return null;
      return null;
    });

    await expect(getCurrent().saveTab(tabId)).rejects.toThrow(/Failed to save file/);
  });

  it('reloads tab content from disk only when tab has no unsaved changes', async () => {
    const { getCurrent } = renderTabManagerHook();
    const file = buildFile('f-reload', '/mock/workspace/Projects/Alpha/Reload.md');

    let tabId = '';
    await act(async () => {
      tabId = await getCurrent().openTab(file);
    });

    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'read_file') return '# from disk';
      if (command === 'save_file') return 'ok';
      return null;
    });

    let reloaded = false;
    await act(async () => {
      reloaded = await getCurrent().reloadTabFromDisk(tabId);
    });
    expect(reloaded).toBe(true);

    await waitFor(() => {
      expect(getCurrent().tabState.openTabs[0]?.content).toBe('# from disk');
      expect(getCurrent().tabState.openTabs[0]?.hasUnsavedChanges).toBe(false);
    });

    act(() => {
      getCurrent().updateTabContent(tabId, '# local edits');
    });
    await waitFor(() => {
      expect(getCurrent().tabState.openTabs[0]?.hasUnsavedChanges).toBe(true);
    });

    await act(async () => {
      reloaded = await getCurrent().reloadTabFromDisk(tabId);
    });
    expect(reloaded).toBe(false);
  });

  it('saves keep-local conflict resolution using the dirty editor content', async () => {
    const { getCurrent } = renderTabManagerHook();
    const file = buildFile('f-conflict', '/mock/workspace/Projects/Alpha/Conflict.md');

    let tabId = '';
    await act(async () => {
      tabId = await getCurrent().openTab(file);
    });

    act(() => {
      getCurrent().updateTabContent(tabId, '# keep local');
    });

    await waitFor(() => {
      expect(getCurrent().tabState.openTabs[0]?.hasUnsavedChanges).toBe(true);
    });

    mocks.safeInvoke.mockClear();

    let resolved = false;
    await act(async () => {
      resolved = await getCurrent().resolveConflict(tabId, { action: 'keep-local' });
    });

    expect(resolved).toBe(true);
    expect(mocks.safeInvoke).toHaveBeenCalledWith(
      'save_file',
      { path: '/mock/workspace/Projects/Alpha/Conflict.md', content: '# keep local' },
      null,
    );
    expect(getCurrent().tabState.openTabs[0]?.hasUnsavedChanges).toBe(false);
  });

  it('saves manual-merge conflict resolution with merged content', async () => {
    const { getCurrent } = renderTabManagerHook();
    const file = buildFile('f-merge', '/mock/workspace/Projects/Alpha/Merge.md');

    let tabId = '';
    await act(async () => {
      tabId = await getCurrent().openTab(file);
    });

    mocks.safeInvoke.mockClear();

    let resolved = false;
    await act(async () => {
      resolved = await getCurrent().resolveConflict(tabId, {
        action: 'manual-merge',
        content: '# merged',
      });
    });

    expect(resolved).toBe(true);
    expect(mocks.safeInvoke).toHaveBeenCalledWith(
      'save_file',
      { path: '/mock/workspace/Projects/Alpha/Merge.md', content: '# merged' },
      null,
    );
    expect(getCurrent().tabState.openTabs[0]?.content).toBe('# merged');
    expect(getCurrent().tabState.openTabs[0]?.hasUnsavedChanges).toBe(false);
  });

  it('uses external content for conflict resolution without writing back to disk', async () => {
    const { getCurrent } = renderTabManagerHook();
    const file = buildFile('f-external', '/mock/workspace/Projects/Alpha/External.md');

    let tabId = '';
    await act(async () => {
      tabId = await getCurrent().openTab(file);
    });

    act(() => {
      getCurrent().updateTabContent(tabId, '# local');
    });

    await waitFor(() => {
      expect(getCurrent().tabState.openTabs[0]?.hasUnsavedChanges).toBe(true);
    });

    mocks.safeInvoke.mockClear();
    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'read_file') return '# external';
      if (command === 'save_file') return 'ok';
      return null;
    });

    let resolved = false;
    await act(async () => {
      resolved = await getCurrent().resolveConflict(tabId, { action: 'use-external' });
    });

    expect(resolved).toBe(true);
    expect(mocks.safeInvoke).toHaveBeenCalledWith(
      'read_file',
      { path: '/mock/workspace/Projects/Alpha/External.md' },
      null,
    );
    expect(
      mocks.safeInvoke.mock.calls.some(([command]) => command === 'save_file'),
    ).toBe(false);
    expect(getCurrent().tabState.openTabs[0]?.content).toBe('# external');
    expect(getCurrent().tabState.openTabs[0]?.hasUnsavedChanges).toBe(false);
    expect(mocks.emitMetadataChange).toHaveBeenCalled();
  });

  it('persists tabs to localStorage and clears storage when last tab closes', async () => {
    const { getCurrent } = renderTabManagerHook({ workspacePath: '/mock/workspace' });
    const file = buildFile('f-storage', '/mock/workspace/storage.md');

    let tabId = '';
    await act(async () => {
      tabId = await getCurrent().openTab(file);
    });

    await waitFor(() => {
      const persisted = localStorage.getItem('gtdspace-tabs');
      expect(persisted).toContain('/mock/workspace/storage.md');
      expect(persisted).toContain('"workspacePath":"/mock/workspace"');
    });

    await act(async () => {
      await getCurrent().closeTab(tabId);
    });

    await waitFor(() => {
      expect(localStorage.getItem('gtdspace-tabs')).toBeNull();
    });
  });

  it('restores persisted tabs only when restore is enabled for the matching workspace', async () => {
    localStorage.setItem(
      'gtdspace-tabs',
      JSON.stringify({
        version: 2,
        workspacePath: '/mock/workspace',
        activeTabId: 'restored-tab',
        maxTabs: 10,
        openTabs: [
          {
            id: 'restored-tab',
            filePath: '/mock/workspace/Projects/Alpha/README.md',
            fileName: 'README.md',
            hasUnsavedChanges: true,
            isActive: true,
          },
        ],
      }),
    );

    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'read_file') return '# restored';
      if (command === 'save_file') return 'ok';
      return null;
    });

    const { getCurrent } = renderTabManagerHook({
      workspacePath: '/mock/workspace',
      restoreTabs: true,
      maxTabs: 4,
    });

    await waitFor(() => {
      expect(getCurrent().tabState.openTabs).toHaveLength(1);
    });

    expect(getCurrent().tabState.maxTabs).toBe(4);
    expect(getCurrent().activeTab?.file.path).toBe('/mock/workspace/Projects/Alpha/README.md');
    expect(getCurrent().activeTab?.hasUnsavedChanges).toBe(false);
  });

  it('does not restore tabs when restore is disabled or the workspace does not match', async () => {
    localStorage.setItem(
      'gtdspace-tabs',
      JSON.stringify({
        version: 2,
        workspacePath: '/mock/other-workspace',
        activeTabId: 'restored-tab',
        maxTabs: 10,
        openTabs: [
          {
            id: 'restored-tab',
            filePath: '/mock/other-workspace/Notes.md',
            fileName: 'Notes.md',
            hasUnsavedChanges: false,
            isActive: true,
          },
        ],
      }),
    );

    const { getCurrent: getDisabled } = renderTabManagerHook({
      workspacePath: '/mock/workspace',
      restoreTabs: false,
    });

    expect(getDisabled().tabState.openTabs).toHaveLength(0);

    const { getCurrent: getMismatched } = renderTabManagerHook({
      workspacePath: '/mock/workspace',
      restoreTabs: true,
    });

    expect(getMismatched().tabState.openTabs).toHaveLength(0);
  });

  it('updates tab paths from rename events without leaving duplicate filePath state behind', async () => {
    const { getCurrent } = renderTabManagerHook();

    await act(async () => {
      await getCurrent().openTab(buildFile('proj', '/mock/workspace/Projects/Alpha/README.md'));
      await getCurrent().openTab(buildFile('action', '/mock/workspace/Projects/Alpha/Actions/Next.md'));
      await getCurrent().openTab(buildFile('section', '/mock/workspace/Cabinet/Reference.md'));
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('project-renamed', {
          detail: {
            oldPath: '/mock/workspace/Projects/Alpha',
            newPath: '/mock/workspace/Projects/Beta',
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent('action-renamed', {
          detail: {
            oldPath: '/mock/workspace/Projects/Beta/Actions/Next.md',
            newPath: '/mock/workspace/Projects/Beta/Actions/Next Step.md',
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent('section-file-renamed', {
          detail: {
            oldPath: '/mock/workspace/Cabinet/Reference.md',
            newPath: '/mock/workspace/Cabinet/Reference Updated.md',
          },
        }),
      );
    });

    await waitFor(() => {
      const paths = getCurrent().tabState.openTabs.map((tab) => tab.file.path);
      expect(paths).toContain('/mock/workspace/Projects/Beta/README.md');
      expect(paths).toContain('/mock/workspace/Projects/Beta/Actions/Next Step.md');
      expect(paths).toContain('/mock/workspace/Cabinet/Reference Updated.md');
    });

    getCurrent().tabState.openTabs.forEach((tab) => {
      expect((tab as FileTab & { filePath?: string }).filePath).toBeUndefined();
    });
  });

  it('closes deleted tabs and opens referenced files from DOM events', async () => {
    const { getCurrent } = renderTabManagerHook();

    await act(async () => {
      await getCurrent().openTab(buildFile('a', '/mock/workspace/Projects/Alpha/README.md'));
      await getCurrent().openTab(buildFile('b', '/mock/workspace/Cabinet/Keep.md'));
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('file-deleted', {
          detail: { path: '/mock/workspace/Projects/Alpha' },
        }),
      );
    });

    await waitFor(() => {
      expect(getCurrent().tabState.openTabs).toHaveLength(1);
      expect(getCurrent().tabState.openTabs[0]?.file.path).toBe('/mock/workspace/Cabinet/Keep.md');
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('open-reference-file', {
          detail: { path: '/mock/workspace/Cabinet/Reference.md' },
        }),
      );
    });

    await waitFor(() => {
      const paths = getCurrent().tabState.openTabs.map((tab) => tab.file.path);
      expect(paths).toContain('/mock/workspace/Cabinet/Reference.md');
    });
  });
});
