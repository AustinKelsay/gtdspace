// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import type { MarkdownFile } from '@/types';
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

function renderTabManagerHook() {
  let current: ReturnType<typeof useTabManager> | null = null;

  const Harness = () => {
    current = useTabManager();
    return null;
  };

  render(<Harness />);

  return {
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
    delete window.onTabFileSaved;

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

  it('evicts the oldest inactive unsaved-false tab when max tab count is exceeded', async () => {
    const { getCurrent } = renderTabManagerHook();

    for (let i = 1; i <= 11; i += 1) {
      const file = buildFile(`f-${i}`, `/mock/workspace/notes-${i}.md`);
      await act(async () => {
        await getCurrent().openTab(file);
      });
    }

    await waitFor(() => {
      expect(getCurrent().tabState.openTabs).toHaveLength(10);
    });

    const remainingPaths = getCurrent().tabState.openTabs.map((tab) => tab.file.path);
    expect(remainingPaths).not.toContain('/mock/workspace/notes-1.md');
    expect(getCurrent().tabState.recentlyClosed[0]?.file.path).toBe('/mock/workspace/notes-1.md');
  });

  it('saves an edited tab and calls window.onTabFileSaved callback', async () => {
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

    const onSaved = vi.fn();
    window.onTabFileSaved = onSaved;

    let saved = false;
    await act(async () => {
      saved = await getCurrent().saveTab(tabId);
    });

    expect(saved).toBe(true);
    expect(mocks.safeInvoke).toHaveBeenCalledWith(
      'save_file',
      { path: '/mock/workspace/Projects/Alpha/Task.md', content: '# changed' },
      null
    );
    expect(onSaved).toHaveBeenCalledWith('/mock/workspace/Projects/Alpha/Task.md');

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

  it('persists tabs to localStorage and clears storage when last tab closes', async () => {
    const { getCurrent } = renderTabManagerHook();
    const file = buildFile('f-storage', '/mock/workspace/storage.md');

    let tabId = '';
    await act(async () => {
      tabId = await getCurrent().openTab(file);
    });

    await waitFor(() => {
      const persisted = localStorage.getItem('gtdspace-tabs');
      expect(persisted).toContain('/mock/workspace/storage.md');
    });

    await act(async () => {
      await getCurrent().closeTab(tabId);
    });

    await waitFor(() => {
      expect(localStorage.getItem('gtdspace-tabs')).toBeNull();
    });
  });
});
