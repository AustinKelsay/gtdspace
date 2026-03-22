import type { FileTab, TabManagerState } from '@/types';
import { norm } from '@/utils/path';

export const DEFAULT_MAX_TABS = 10;

export type RenameMode = 'exact' | 'prefix';

export type TabStateAction =
  | { type: 'set-max-tabs'; maxTabs: number }
  | { type: 'restore-state'; state: TabManagerState }
  | { type: 'open-tab'; tab: FileTab }
  | { type: 'activate-tab'; tabId: string }
  | { type: 'close-tab'; tabId: string }
  | { type: 'update-tab-content'; tabId: string; content: string }
  | {
      type: 'replace-tab-content';
      tabId: string;
      content: string;
      originalContent?: string;
      hasUnsavedChanges: boolean;
    }
  | { type: 'reorder-tabs'; openTabs: FileTab[] }
  | { type: 'rename-paths'; oldPath: string; newPath: string; mode: RenameMode }
  | { type: 'remove-deleted-path'; path: string }
  | { type: 'remove-recently-closed-head' }
  | { type: 'clear-all' };

export function createInitialTabState(maxTabs = DEFAULT_MAX_TABS): TabManagerState {
  return {
    openTabs: [],
    activeTabId: null,
    maxTabs,
    recentlyClosed: [],
  };
}

export function pathKey(path?: string | null): string {
  return norm(path)?.replace(/\/+$/, '') ?? '';
}

export function pathsEqual(a?: string | null, b?: string | null): boolean {
  return pathKey(a) === pathKey(b);
}

export function isSameOrDescendantPath(candidate?: string | null, root?: string | null): boolean {
  const candidateKey = pathKey(candidate);
  const rootKey = pathKey(root);
  if (!candidateKey || !rootKey) return false;
  return candidateKey === rootKey || candidateKey.startsWith(`${rootKey}/`);
}

function applyActiveState(openTabs: FileTab[], activeTabId: string | null): FileTab[] {
  return openTabs.map((tab) => ({
    ...tab,
    isActive: tab.id === activeTabId,
  }));
}

function enforceMaxTabs(
  openTabs: FileTab[],
  activeTabId: string | null,
  recentlyClosed: FileTab[],
  maxTabs: number,
): Pick<TabManagerState, 'openTabs' | 'recentlyClosed'> {
  let nextTabs = [...openTabs];
  let nextRecentlyClosed = [...recentlyClosed];

  while (nextTabs.length > maxTabs) {
    const oldestInactiveCleanTab = nextTabs.find(
      (tab) => tab.id !== activeTabId && !tab.hasUnsavedChanges,
    );

    if (!oldestInactiveCleanTab) {
      break;
    }

    nextTabs = nextTabs.filter((tab) => tab.id !== oldestInactiveCleanTab.id);
    nextRecentlyClosed = [oldestInactiveCleanTab, ...nextRecentlyClosed].slice(0, 10);
  }

  return {
    openTabs: applyActiveState(nextTabs, activeTabId),
    recentlyClosed: nextRecentlyClosed,
  };
}

function updateActiveTabAfterRemoval(
  state: TabManagerState,
  remainingTabs: FileTab[],
  removedTabId: string,
): string | null {
  let nextActiveTabId = state.activeTabId;

  if (state.activeTabId === removedTabId) {
    if (remainingTabs.length > 0) {
      const closingTabIndex = state.openTabs.findIndex((tab) => tab.id === removedTabId);
      const nextTab = remainingTabs[Math.min(closingTabIndex, remainingTabs.length - 1)];
      nextActiveTabId = nextTab.id;
    } else {
      nextActiveTabId = null;
    }
  }

  return nextActiveTabId;
}

function remapPath(currentPath: string, oldPath: string, newPath: string, mode: RenameMode): string | null {
  if (mode === 'exact') {
    return pathsEqual(currentPath, oldPath) ? newPath : null;
  }

  if (!isSameOrDescendantPath(currentPath, oldPath)) {
    return null;
  }

  const normalizedCurrent = currentPath.replace(/\\/g, '/');
  const normalizedOld = oldPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedNew = newPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const relativePath = normalizedCurrent.slice(normalizedOld.length);
  return `${normalizedNew}${relativePath}`;
}

function updateTabFilePath(tab: FileTab, nextPath: string): FileTab {
  return {
    ...tab,
    file: {
      ...tab.file,
      id: nextPath,
      path: nextPath,
      name: nextPath.split('/').pop() || tab.file.name,
    },
  };
}

export function takeMostRecentlyClosedFile(state: TabManagerState): FileTab | null {
  return state.recentlyClosed[0] ?? null;
}

export function tabStateReducer(state: TabManagerState, action: TabStateAction): TabManagerState {
  switch (action.type) {
    case 'set-max-tabs': {
      const nextMaxTabs = action.maxTabs > 0 ? action.maxTabs : DEFAULT_MAX_TABS;
      const enforced = enforceMaxTabs(state.openTabs, state.activeTabId, state.recentlyClosed, nextMaxTabs);
      return {
        ...state,
        maxTabs: nextMaxTabs,
        ...enforced,
      };
    }

    case 'restore-state':
      return {
        ...action.state,
        ...enforceMaxTabs(
          action.state.openTabs,
          action.state.activeTabId,
          action.state.recentlyClosed,
          action.state.maxTabs,
        ),
      };

    case 'open-tab': {
      const existingTab = state.openTabs.find((tab) => pathsEqual(tab.file.path, action.tab.file.path));
      const activeTabId = existingTab?.id ?? action.tab.id;
      const nextTabs = existingTab ? state.openTabs : [...state.openTabs, action.tab];
      const enforced = enforceMaxTabs(nextTabs, activeTabId, state.recentlyClosed, state.maxTabs);
      return {
        ...state,
        activeTabId,
        ...enforced,
      };
    }

    case 'activate-tab':
      return {
        ...state,
        activeTabId: action.tabId,
        openTabs: applyActiveState(state.openTabs, action.tabId),
      };

    case 'close-tab': {
      const closingTab = state.openTabs.find((tab) => tab.id === action.tabId);
      if (!closingTab) {
        return state;
      }

      const remainingTabs = state.openTabs.filter((tab) => tab.id !== action.tabId);
      const nextActiveTabId = updateActiveTabAfterRemoval(state, remainingTabs, action.tabId);

      return {
        ...state,
        activeTabId: nextActiveTabId,
        openTabs: applyActiveState(remainingTabs, nextActiveTabId),
        recentlyClosed: [closingTab, ...state.recentlyClosed].slice(0, 10),
      };
    }

    case 'update-tab-content':
      return {
        ...state,
        openTabs: state.openTabs.map((tab) =>
          tab.id === action.tabId
            ? {
                ...tab,
                content: action.content,
                hasUnsavedChanges: (tab.originalContent ?? tab.content) !== action.content,
              }
            : tab,
        ),
      };

    case 'replace-tab-content':
      return {
        ...state,
        openTabs: state.openTabs.map((tab) =>
          tab.id === action.tabId
            ? {
                ...tab,
                content: action.content,
                originalContent: action.originalContent ?? action.content,
                hasUnsavedChanges: action.hasUnsavedChanges,
              }
            : tab,
        ),
      };

    case 'reorder-tabs':
      return {
        ...state,
        openTabs: applyActiveState(action.openTabs, state.activeTabId),
      };

    case 'rename-paths':
      return {
        ...state,
        openTabs: state.openTabs.map((tab) => {
          const nextPath = remapPath(tab.file.path, action.oldPath, action.newPath, action.mode);
          return nextPath ? updateTabFilePath(tab, nextPath) : tab;
        }),
        recentlyClosed: state.recentlyClosed.map((tab) => {
          const nextPath = remapPath(tab.file.path, action.oldPath, action.newPath, action.mode);
          return nextPath ? updateTabFilePath(tab, nextPath) : tab;
        }),
      };

    case 'remove-deleted-path': {
      const nextTabs = state.openTabs.filter(
        (tab) => !isSameOrDescendantPath(tab.file.path, action.path),
      );
      const nextRecentlyClosed = state.recentlyClosed.filter(
        (tab) => !isSameOrDescendantPath(tab.file.path, action.path),
      );

      if (
        nextTabs.length === state.openTabs.length &&
        nextRecentlyClosed.length === state.recentlyClosed.length
      ) {
        return state;
      }

      const activeTabWasRemoved =
        state.activeTabId !== null && !nextTabs.some((tab) => tab.id === state.activeTabId);
      const nextActiveTabId = activeTabWasRemoved
        ? updateActiveTabAfterRemoval(state, nextTabs, state.activeTabId!)
        : state.activeTabId;

      return {
        ...state,
        activeTabId: nextActiveTabId,
        openTabs: applyActiveState(nextTabs, nextActiveTabId),
        recentlyClosed: nextRecentlyClosed,
      };
    }

    case 'remove-recently-closed-head':
      return {
        ...state,
        recentlyClosed: state.recentlyClosed.slice(1),
      };

    case 'clear-all':
      return {
        ...state,
        openTabs: [],
        activeTabId: null,
      };

    default:
      return state;
  }
}
