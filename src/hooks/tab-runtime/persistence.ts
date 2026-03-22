import type { FileTab, MarkdownFile, TabManagerState } from '@/types';
import { createInitialTabState, DEFAULT_MAX_TABS, isSameOrDescendantPath, pathKey } from './state';

export const TAB_STORAGE_KEY = 'gtdspace-tabs';
const TAB_SNAPSHOT_VERSION = 2;

type CanonicalPersistedTab = {
  id: string;
  filePath: string;
  fileName: string;
  hasUnsavedChanges: boolean;
  isActive: boolean;
  draftContent?: string;
};

type CanonicalPersistedTabSnapshot = {
  version: 2;
  workspacePath: string | null;
  activeTabId: string | null;
  maxTabs: number;
  openTabs: CanonicalPersistedTab[];
};

type LegacyPersistedTab = {
  id?: string;
  filePath?: string;
  fileName?: string;
  path?: string;
  name?: string;
  hasUnsavedChanges?: boolean;
  isActive?: boolean;
  draftContent?: string;
};

type LegacyPersistedTabSnapshot = {
  version?: number;
  workspacePath?: string | null;
  activeTabId?: string | null;
  maxTabs?: number;
  openTabs?: LegacyPersistedTab[];
};

export type PersistedTabSnapshot = CanonicalPersistedTabSnapshot;

function normalizeWorkspacePath(path?: string | null): string | null {
  const normalized = pathKey(path);
  return normalized || null;
}

function normalizeOpenTabs(snapshot: LegacyPersistedTabSnapshot): CanonicalPersistedTab[] {
  return (snapshot.openTabs ?? [])
    .map((tab): CanonicalPersistedTab | null => {
      const filePath = tab.filePath ?? tab.path;
      if (!filePath) return null;

      return {
        id: tab.id ?? filePath,
        filePath,
        fileName:
          tab.fileName ??
          tab.name ??
          filePath.split(/[/\\]/).filter(Boolean).pop() ??
          'Untitled.md',
        hasUnsavedChanges: Boolean(tab.hasUnsavedChanges),
        isActive: Boolean(tab.isActive),
        draftContent: typeof tab.draftContent === 'string' ? tab.draftContent : undefined,
      };
    })
    .filter((tab): tab is CanonicalPersistedTab => tab !== null);
}

export function serializeTabState(
  state: TabManagerState,
  workspacePath?: string | null,
): PersistedTabSnapshot {
  return {
    version: TAB_SNAPSHOT_VERSION,
    workspacePath: normalizeWorkspacePath(workspacePath),
    activeTabId: state.activeTabId,
    maxTabs: state.maxTabs,
    openTabs: state.openTabs.map((tab) => ({
      id: tab.id,
      filePath: tab.file.path,
      fileName: tab.file.name,
      hasUnsavedChanges: tab.hasUnsavedChanges,
      isActive: tab.id === state.activeTabId,
      draftContent: tab.hasUnsavedChanges ? tab.content : undefined,
    })),
  };
}

export function persistTabState(state: TabManagerState, workspacePath?: string | null): void {
  try {
    const snapshot = serializeTabState(state, workspacePath);
    localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('Failed to persist tab state', error);
  }
}

export function clearPersistedTabs(): void {
  localStorage.removeItem(TAB_STORAGE_KEY);
}

export function parsePersistedTabSnapshot(raw: string | null): PersistedTabSnapshot | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as LegacyPersistedTabSnapshot;
    return {
      version: TAB_SNAPSHOT_VERSION,
      workspacePath: normalizeWorkspacePath(parsed.workspacePath),
      activeTabId: parsed.activeTabId ?? null,
      maxTabs:
        typeof parsed.maxTabs === 'number' && parsed.maxTabs > 0
          ? parsed.maxTabs
          : DEFAULT_MAX_TABS,
      openTabs: normalizeOpenTabs(parsed),
    };
  } catch {
    return null;
  }
}

function snapshotMatchesWorkspace(
  snapshot: PersistedTabSnapshot,
  workspacePath?: string | null,
): boolean {
  const normalizedWorkspacePath = normalizeWorkspacePath(workspacePath);
  if (!normalizedWorkspacePath) {
    return false;
  }

  if (snapshot.workspacePath) {
    return pathKey(snapshot.workspacePath) === pathKey(normalizedWorkspacePath);
  }

  return snapshot.openTabs.every((tab) =>
    isSameOrDescendantPath(tab.filePath, normalizedWorkspacePath),
  );
}

function createRestoredFile(filePath: string, fileName: string, content: string): MarkdownFile {
  const lastDotIndex = fileName.lastIndexOf('.');
  const extension = lastDotIndex >= 0 ? fileName.slice(lastDotIndex) || '.md' : '.md';
  return {
    id: filePath,
    name: fileName,
    path: filePath,
    size: content.length,
    last_modified: Math.floor(Date.now() / 1000),
    extension,
  };
}

export async function restoreTabStateFromStorage(
  options: {
    workspacePath?: string | null;
    maxTabs?: number;
    readFile: (filePath: string) => Promise<string | null>;
  },
): Promise<TabManagerState | null> {
  const snapshot = parsePersistedTabSnapshot(localStorage.getItem(TAB_STORAGE_KEY));
  if (!snapshot || !snapshotMatchesWorkspace(snapshot, options.workspacePath)) {
    return null;
  }

  const validTabs: FileTab[] = [];

  for (const persistedTab of snapshot.openTabs) {
    const fileContent = await options.readFile(persistedTab.filePath);
    if (fileContent == null && persistedTab.draftContent == null) {
      continue;
    }

    const restoredContent = persistedTab.draftContent ?? fileContent ?? '';
    const originalContent = fileContent ?? '';

    validTabs.push({
      id: persistedTab.id,
      file: createRestoredFile(persistedTab.filePath, persistedTab.fileName, restoredContent),
      content: restoredContent,
      originalContent,
      hasUnsavedChanges: typeof persistedTab.draftContent === 'string',
      isActive: persistedTab.id === snapshot.activeTabId,
      cursorPosition: 0,
      scrollPosition: 0,
    });
  }

  if (validTabs.length === 0) {
    return null;
  }

  const maxTabs =
    typeof options.maxTabs === 'number' && options.maxTabs > 0
      ? options.maxTabs
      : snapshot.maxTabs;

  const initialState = createInitialTabState(maxTabs);
  const activeTabId = validTabs.some((tab) => tab.id === snapshot.activeTabId)
    ? snapshot.activeTabId
    : validTabs[0].id;
  const activeTab = validTabs.find((tab) => tab.id === activeTabId) ?? validTabs[0];
  const trimmedValidTabs = validTabs.slice(0, maxTabs);
  if (!trimmedValidTabs.some((tab) => tab.id === activeTabId)) {
    if (trimmedValidTabs.length === 0) {
      trimmedValidTabs.push(activeTab);
    } else {
      trimmedValidTabs[trimmedValidTabs.length - 1] = activeTab;
    }
  }

  return {
    ...initialState,
    openTabs: trimmedValidTabs.map((tab) => ({
      ...tab,
      isActive: tab.id === activeTabId,
    })),
    activeTabId,
  };
}

export function getPersistedActiveTabFilePath(workspacePath?: string | null): string | null {
  const snapshot = parsePersistedTabSnapshot(localStorage.getItem(TAB_STORAGE_KEY));
  if (!snapshot || snapshot.openTabs.length === 0) {
    return null;
  }
  if (!snapshotMatchesWorkspace(snapshot, workspacePath)) {
    return null;
  }

  const activeTab =
    snapshot.openTabs.find((tab) => tab.id === snapshot.activeTabId) ?? snapshot.openTabs[0];

  return activeTab?.filePath ?? null;
}
