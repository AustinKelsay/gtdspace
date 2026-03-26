// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  getPersistedActiveTabFilePath,
  restoreTabStateFromStorage,
  serializeTabState,
  TAB_STORAGE_KEY,
} from '@/hooks/tab-runtime/persistence';
import { createInitialTabState } from '@/hooks/tab-runtime/state';

describe('tab runtime persistence helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when the persisted workspace does not match the current workspace', () => {
    const state = createInitialTabState(5);
    state.openTabs = [
      {
        id: 'tab-1',
        file: {
          id: '/mock/workspace/Notes.md',
          name: 'Notes.md',
          path: '/mock/workspace/Notes.md',
          size: 1,
          last_modified: 1,
          extension: 'md',
        },
        content: '# notes',
        originalContent: '# notes',
        hasUnsavedChanges: false,
        isActive: true,
        cursorPosition: 0,
        scrollPosition: 0,
      },
    ];
    state.activeTabId = 'tab-1';

    localStorage.setItem(
      TAB_STORAGE_KEY,
      JSON.stringify(serializeTabState(state, '/mock/workspace'))
    );

    expect(getPersistedActiveTabFilePath('/different/workspace')).toBeNull();
    expect(getPersistedActiveTabFilePath('/mock/workspace')).toBe('/mock/workspace/Notes.md');
  });

  it('caps restored tabs to maxTabs while preserving the active tab', async () => {
    const state = createInitialTabState(5);
    state.openTabs = [
      {
        id: 'tab-1',
        file: {
          id: '/mock/workspace/One.md',
          name: 'One.md',
          path: '/mock/workspace/One.md',
          size: 1,
          last_modified: 1,
          extension: 'md',
        },
        content: '# one',
        originalContent: '# one',
        hasUnsavedChanges: false,
        isActive: false,
        cursorPosition: 0,
        scrollPosition: 0,
      },
      {
        id: 'tab-2',
        file: {
          id: '/mock/workspace/Two.md',
          name: 'Two.md',
          path: '/mock/workspace/Two.md',
          size: 1,
          last_modified: 1,
          extension: 'md',
        },
        content: '# two',
        originalContent: '# two',
        hasUnsavedChanges: false,
        isActive: false,
        cursorPosition: 0,
        scrollPosition: 0,
      },
      {
        id: 'tab-3',
        file: {
          id: '/mock/workspace/Three.md',
          name: 'Three.md',
          path: '/mock/workspace/Three.md',
          size: 1,
          last_modified: 1,
          extension: 'md',
        },
        content: '# three',
        originalContent: '# three',
        hasUnsavedChanges: false,
        isActive: true,
        cursorPosition: 0,
        scrollPosition: 0,
      },
    ];
    state.activeTabId = 'tab-3';

    localStorage.setItem(
      TAB_STORAGE_KEY,
      JSON.stringify(serializeTabState(state, '/mock/workspace'))
    );

    const restored = await restoreTabStateFromStorage({
      workspacePath: '/mock/workspace',
      maxTabs: 2,
      readFile: async (filePath) => `content for ${filePath}`,
    });

    expect(restored).not.toBeNull();
    expect(restored?.openTabs).toHaveLength(2);
    expect(restored?.activeTabId).toBe('tab-3');
    expect(restored!.openTabs.some((tab) => tab.id === 'tab-3')).toBe(true);
  });

  it('restores persisted draft content as the active unsaved buffer', async () => {
    localStorage.setItem(
      TAB_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        workspacePath: '/mock/workspace',
        activeTabId: 'tab-1',
        maxTabs: 5,
        openTabs: [
          {
            id: 'tab-1',
            filePath: '/mock/workspace/Notes.md',
            fileName: 'Notes.md',
            hasUnsavedChanges: true,
            isActive: true,
            draftContent: '# local draft',
          },
        ],
      }),
    );

    const restored = await restoreTabStateFromStorage({
      workspacePath: '/mock/workspace',
      maxTabs: 5,
      readFile: async () => '# on disk',
    });

    expect(restored?.openTabs[0]).toMatchObject({
      content: '# local draft',
      originalContent: '# on disk',
      hasUnsavedChanges: true,
      isActive: true,
    });
  });

  it('canonicalizes legacy purpose section aliases when restoring persisted tabs', async () => {
    localStorage.setItem(
      TAB_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        workspacePath: '/mock/workspace',
        activeTabId: 'tab-1',
        maxTabs: 5,
        openTabs: [
          {
            id: 'tab-1',
            filePath: '/mock/workspace/Purpose and Principles/Mission.md',
            fileName: 'Mission.md',
            hasUnsavedChanges: false,
            isActive: true,
          },
        ],
      }),
    );

    expect(getPersistedActiveTabFilePath('/mock/workspace')).toBe(
      '/mock/workspace/Purpose & Principles/Mission.md',
    );

    const restored = await restoreTabStateFromStorage({
      workspacePath: '/mock/workspace',
      maxTabs: 5,
      readFile: async (filePath) => `content for ${filePath}`,
    });

    expect(restored?.openTabs[0]?.file.path).toBe(
      '/mock/workspace/Purpose & Principles/Mission.md',
    );
    expect(restored?.openTabs[0]?.originalContent).toBe(
      'content for /mock/workspace/Purpose & Principles/Mission.md',
    );
  });
});
