// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  getPersistedActiveTabFilePath,
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
});
