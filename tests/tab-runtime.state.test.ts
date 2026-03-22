import { describe, expect, it } from 'vitest';
import type { FileTab, MarkdownFile } from '@/types';
import {
  createInitialTabState,
  tabStateReducer,
  takeMostRecentlyClosedFile,
} from '@/hooks/tab-runtime';

function buildFile(path: string): MarkdownFile {
  return {
    id: path,
    name: path.split('/').pop() || 'Untitled.md',
    path,
    size: 42,
    last_modified: 1700000000,
    extension: 'md',
  };
}

function buildTab(id: string, path: string, options: Partial<FileTab> = {}): FileTab {
  const hasOriginalContentOverride = Object.prototype.hasOwnProperty.call(options, 'originalContent');
  return {
    id,
    file: buildFile(path),
    content: options.content ?? '# content',
    originalContent: hasOriginalContentOverride ? options.originalContent : '# content',
    hasUnsavedChanges: options.hasUnsavedChanges ?? false,
    isActive: options.isActive ?? false,
    cursorPosition: 0,
    scrollPosition: 0,
  };
}

describe('tab-runtime state reducer', () => {
  it('opens, activates, and reorders tabs while preserving the active tab', () => {
    let state = createInitialTabState(3);

    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-1', '/mock/workspace/One.md', { isActive: true }),
    });
    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-2', '/mock/workspace/Two.md', { isActive: true }),
    });

    expect(state.activeTabId).toBe('tab-2');
    expect(state.openTabs[1]?.isActive).toBe(true);

    state = tabStateReducer(state, {
      type: 'activate-tab',
      tabId: 'tab-1',
    });

    expect(state.activeTabId).toBe('tab-1');
    expect(state.openTabs[0]?.isActive).toBe(true);

    state = tabStateReducer(state, {
      type: 'reorder-tabs',
      openTabs: [state.openTabs[1], state.openTabs[0]],
    });

    expect(state.openTabs.map((tab) => tab.id)).toEqual(['tab-2', 'tab-1']);
    expect(state.openTabs[1]?.isActive).toBe(true);
  });

  it('closes the active tab and falls back to the next available tab', () => {
    let state = createInitialTabState(3);

    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-1', '/mock/workspace/One.md', { isActive: true }),
    });
    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-2', '/mock/workspace/Two.md', { isActive: true }),
    });
    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-3', '/mock/workspace/Three.md', { isActive: true }),
    });

    state = tabStateReducer(state, {
      type: 'close-tab',
      tabId: 'tab-2',
    });

    expect(state.openTabs.map((tab) => tab.id)).toEqual(['tab-1', 'tab-3']);
    expect(state.activeTabId).toBe('tab-3');
    expect(takeMostRecentlyClosedFile(state)?.id).toBe('tab-2');
  });

  it('evicts the oldest inactive clean tab when max tabs are exceeded', () => {
    let state = createInitialTabState(2);

    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-1', '/mock/workspace/One.md', { isActive: true }),
    });
    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-2', '/mock/workspace/Two.md', { isActive: true }),
    });
    state = tabStateReducer(state, {
      type: 'activate-tab',
      tabId: 'tab-1',
    });

    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-3', '/mock/workspace/Three.md', { isActive: true }),
    });

    expect(state.activeTabId).toBe('tab-3');
    expect(state.openTabs.map((tab) => tab.id)).toEqual(['tab-2', 'tab-3']);
    expect(takeMostRecentlyClosedFile(state)?.id).toBe('tab-1');
  });

  it('supports the reopen-last-closed flow through recentlyClosed state', () => {
    let state = createInitialTabState(3);

    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-1', '/mock/workspace/One.md', { isActive: true }),
    });
    state = tabStateReducer(state, {
      type: 'close-tab',
      tabId: 'tab-1',
    });

    const lastClosed = takeMostRecentlyClosedFile(state);
    expect(lastClosed?.file.path).toBe('/mock/workspace/One.md');

    state = tabStateReducer(state, { type: 'remove-recently-closed-head' });
    expect(state.recentlyClosed).toHaveLength(0);
  });

  it('seeds missing original content when restoring tabs', () => {
    const restoredTab = buildTab('tab-1', '/mock/workspace/One.md', {
      content: '# restored',
      originalContent: undefined,
      isActive: true,
    });

    const state = tabStateReducer(createInitialTabState(3), {
      type: 'restore-state',
      state: {
        openTabs: [restoredTab],
        activeTabId: 'tab-1',
        maxTabs: 3,
        recentlyClosed: [],
      },
    });

    expect(state.openTabs[0]?.originalContent).toBe('# restored');
  });

  it('removes deleted paths from recently closed history as well as open tabs', () => {
    let state = createInitialTabState(3);

    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-1', '/mock/workspace/Projects/Alpha/README.md', { isActive: true }),
    });
    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-2', '/mock/workspace/Cabinet/Reference.md', { isActive: true }),
    });
    state = tabStateReducer(state, {
      type: 'close-tab',
      tabId: 'tab-1',
    });

    expect(takeMostRecentlyClosedFile(state)?.file.path).toBe(
      '/mock/workspace/Projects/Alpha/README.md',
    );

    state = tabStateReducer(state, {
      type: 'remove-deleted-path',
      path: '/mock/workspace/Projects/Alpha',
    });

    expect(state.openTabs.map((tab) => tab.file.path)).toEqual([
      '/mock/workspace/Cabinet/Reference.md',
    ]);
    expect(state.recentlyClosed).toHaveLength(0);
  });

  it('clears recently closed tabs when clearing all state', () => {
    let state = createInitialTabState(3);

    state = tabStateReducer(state, {
      type: 'open-tab',
      tab: buildTab('tab-1', '/mock/workspace/One.md', { isActive: true }),
    });
    state = tabStateReducer(state, {
      type: 'close-tab',
      tabId: 'tab-1',
    });

    state = tabStateReducer(state, { type: 'clear-all' });

    expect(state.openTabs).toHaveLength(0);
    expect(state.recentlyClosed).toHaveLength(0);
  });
});
