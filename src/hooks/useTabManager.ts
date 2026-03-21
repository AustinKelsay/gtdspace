/**
 * @fileoverview Tab management hook for Phase 2 multi-file editing
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Tab management and multi-file state
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import debounce from 'lodash.debounce';
import type {
  FileTab,
  MarkdownFile,
  TabAction,
  TabManagerConfig,
  TabManagerState,
} from '@/types';
import { extractMetadata, getMetadataChanges } from '@/utils/metadata-extractor';
import { emitContentChange, emitMetadataChange } from '@/utils/content-event-bus';
import { createScopedLogger } from '@/utils/logger';
import {
  clearPersistedTabs as clearPersistedTabStorage,
  createInitialTabState,
  DEFAULT_MAX_TABS,
  emitReloadedTabContent,
  loadTabForOpen,
  pathsEqual,
  persistTabState,
  readTabFile,
  restoreTabStateFromStorage,
  saveTabFile,
  tabHasExternalConflict,
  tabStateReducer,
  takeMostRecentlyClosedFile,
  useTabManagerSubscriptions,
} from '@/hooks/tab-runtime';

const log = createScopedLogger('useTabManager');

function sanitizeMaxTabs(maxTabs?: number | null): number {
  return typeof maxTabs === 'number' && maxTabs > 0 ? maxTabs : DEFAULT_MAX_TABS;
}

function buildReferenceFile(path: string): MarkdownFile {
  return {
    id: path,
    name: path.split('/').pop() || 'Unknown.md',
    path,
    size: 0,
    last_modified: Math.floor(Date.now() / 1000),
    extension: 'md',
  };
}

export const useTabManager = (config: TabManagerConfig = {}) => {
  const resolvedMaxTabs = sanitizeMaxTabs(config.maxTabs);
  const workspacePath = config.workspacePath ?? null;
  const restoreTabs = config.restoreTabs === true;

  const [tabState, dispatch] = useReducer(
    tabStateReducer,
    resolvedMaxTabs,
    createInitialTabState,
  );

  const tabStateRef = useRef<TabManagerState>(tabState);
  const metadataProcessingRef = useRef<Map<string, ReturnType<typeof debounce>>>(new Map());
  const debouncedStateUpdateRef = useRef<Map<string, ReturnType<typeof debounce>>>(new Map());
  const pendingContentRef = useRef<Map<string, string>>(new Map());
  const restoredWorkspaceRef = useRef<string | null>(null);
  const restoringWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    tabStateRef.current = tabState;
  }, [tabState]);

  useEffect(() => {
    dispatch({ type: 'set-max-tabs', maxTabs: resolvedMaxTabs });
  }, [resolvedMaxTabs]);

  const cleanupTabResources = useCallback((tabId: string) => {
    metadataProcessingRef.current.get(tabId)?.cancel();
    metadataProcessingRef.current.delete(tabId);

    debouncedStateUpdateRef.current.get(tabId)?.cancel();
    debouncedStateUpdateRef.current.delete(tabId);

    pendingContentRef.current.delete(tabId);
  }, []);

  const generateTabId = useCallback((file: MarkdownFile): string => {
    return `tab-${file.id}-${Date.now()}`;
  }, []);

  const findTabById = useCallback((tabId: string): FileTab | null => {
    return tabStateRef.current.openTabs.find((tab) => tab.id === tabId) || null;
  }, []);

  const findTabByFile = useCallback((file: MarkdownFile): FileTab | null => {
    return tabStateRef.current.openTabs.find((tab) => pathsEqual(tab.file.path, file.path)) || null;
  }, []);

  const processMetadataDebounced = useCallback(
    (tabId: string, filePath: string, fileName: string, oldContent: string, newContent: string) => {
      if (filePath === '::calendar::') {
        return;
      }

      let debouncedFn = metadataProcessingRef.current.get(tabId);
      if (!debouncedFn) {
        debouncedFn = debounce((oldC: string, newC: string, currentPath: string, currentName: string) => {
          const oldMetadata = extractMetadata(oldC);
          const newMetadata = extractMetadata(newC);
          const metadataChanges = getMetadataChanges(oldMetadata, newMetadata);

          if (Object.keys(metadataChanges).length > 0) {
            emitMetadataChange({
              filePath: currentPath,
              fileName: currentName,
              content: newC,
              metadata: newMetadata,
              changedFields: metadataChanges,
            });
          } else {
            emitContentChange({
              filePath: currentPath,
              fileName: currentName,
              content: newC,
              metadata: newMetadata,
              changedFields: metadataChanges,
            });
          }
        }, 500);

        metadataProcessingRef.current.set(tabId, debouncedFn);
      }

      debouncedFn(oldContent, newContent, filePath, fileName);
    },
    [],
  );

  const openTab = useCallback(async (file: MarkdownFile): Promise<string> => {
    const existingTab = findTabByFile(file);
    if (existingTab) {
      dispatch({ type: 'activate-tab', tabId: existingTab.id });
      return existingTab.id;
    }

    try {
      const loadedTab = await loadTabForOpen(file);
      const currentExistingTab = findTabByFile(file);
      if (currentExistingTab) {
        dispatch({ type: 'activate-tab', tabId: currentExistingTab.id });
        return currentExistingTab.id;
      }

      const tabId = generateTabId(file);
      dispatch({
        type: 'open-tab',
        tab: {
          id: tabId,
          file,
          content: loadedTab.content,
          originalContent: loadedTab.originalContent,
          hasUnsavedChanges: false,
          isActive: true,
          cursorPosition: 0,
          scrollPosition: 0,
        },
      });

      return tabId;
    } catch (error) {
      log.error('Failed to load file for tab', error);
      throw new Error(`Failed to open file: ${error}`);
    }
  }, [findTabByFile, generateTabId]);

  const activateTab = useCallback((tabId: string) => {
    dispatch({ type: 'activate-tab', tabId });
  }, []);

  const closeTab = useCallback(async (tabId: string): Promise<boolean> => {
    const tab = findTabById(tabId);
    if (!tab) {
      return false;
    }

    if (tab.hasUnsavedChanges || pendingContentRef.current.has(tabId)) {
      log.warn('Closing tab with unsaved changes', tab.file.name);
    }

    cleanupTabResources(tabId);
    dispatch({ type: 'close-tab', tabId });
    return true;
  }, [cleanupTabResources, findTabById]);

  const updateTabContent = useCallback((tabId: string, content: string) => {
    const currentTab = findTabById(tabId);
    if (!currentTab) {
      return;
    }

    const previousContent = pendingContentRef.current.get(tabId) ?? currentTab.content ?? '';
    pendingContentRef.current.set(tabId, content);
    processMetadataDebounced(tabId, currentTab.file.path, currentTab.file.name, previousContent, content);

    let debouncedUpdate = debouncedStateUpdateRef.current.get(tabId);
    if (!debouncedUpdate) {
      debouncedUpdate = debounce((newContent: string) => {
        dispatch({ type: 'update-tab-content', tabId, content: newContent });
        if (pendingContentRef.current.get(tabId) === newContent) {
          pendingContentRef.current.delete(tabId);
        }
      }, 150);

      debouncedStateUpdateRef.current.set(tabId, debouncedUpdate);
    }

    debouncedUpdate(content);
  }, [findTabById, processMetadataDebounced]);

  const saveTab = useCallback(async (tabId: string): Promise<boolean> => {
    const tab = findTabById(tabId);
    if (!tab || tab.file.path === '::calendar::') {
      return false;
    }

    const contentToSave = pendingContentRef.current.get(tabId) ?? tab.content;
    const originalContent = tab.originalContent ?? tab.content;
    if (contentToSave === originalContent) {
      return false;
    }

    try {
      await saveTabFile(tab.file, contentToSave);
      pendingContentRef.current.delete(tabId);
      dispatch({
        type: 'replace-tab-content',
        tabId,
        content: contentToSave,
        originalContent: contentToSave,
        hasUnsavedChanges: false,
      });
      return true;
    } catch (error) {
      log.error('Failed to save tab', error);
      throw new Error(`Failed to save file: ${error}`);
    }
  }, [findTabById]);

  const checkForConflicts = useCallback(async (tabId: string): Promise<boolean> => {
    const tab = findTabById(tabId);
    if (!tab) {
      return false;
    }

    const currentContent = pendingContentRef.current.get(tabId) ?? tab.content;
    const originalContent = tab.originalContent ?? tab.content;
    if (currentContent === originalContent) {
      return false;
    }

    try {
      return await tabHasExternalConflict({
        ...tab,
        content: currentContent,
        hasUnsavedChanges: true,
      });
    } catch (error) {
      log.error('Failed to check for conflicts', error);
      return false;
    }
  }, [findTabById]);

  const getExternalContent = useCallback(async (tabId: string): Promise<string | null> => {
    const tab = findTabById(tabId);
    if (!tab) {
      return null;
    }

    try {
      return await readTabFile(tab.file.path);
    } catch (error) {
      log.error('Failed to read external content', error);
      return null;
    }
  }, [findTabById]);

  const reloadTabFromDisk = useCallback(async (tabId: string): Promise<boolean> => {
    const currentTab = findTabById(tabId);
    if (!currentTab || currentTab.file.path === '::calendar::') {
      return false;
    }

    const pendingContent = pendingContentRef.current.get(tabId);
    const isDirty =
      (pendingContent ?? currentTab.content) !== (currentTab.originalContent ?? currentTab.content);

    if (isDirty) {
      log.warn('Refusing to reload tab with unsaved changes', { tabId, path: currentTab.file.path });
      return false;
    }

    try {
      const content = await readTabFile(currentTab.file.path);
      if (content === null || content === undefined) {
        throw new Error('Failed to read file');
      }

      pendingContentRef.current.delete(tabId);
      dispatch({
        type: 'replace-tab-content',
        tabId,
        content,
        originalContent: content,
        hasUnsavedChanges: false,
      });
      await emitReloadedTabContent(currentTab.file, content);
      return true;
    } catch (error) {
      log.error('Failed to reload tab from disk', error);
      return false;
    }
  }, [findTabById]);

  const resolveConflict = useCallback(
    async (tabId: string, resolution: { action: string; content?: string }): Promise<boolean> => {
      const tab = findTabById(tabId);
      if (!tab) {
        return false;
      }

      try {
        switch (resolution.action) {
          case 'keep-local': {
            const contentToSave = pendingContentRef.current.get(tabId) ?? tab.content;
            await saveTabFile(tab.file, contentToSave);
            pendingContentRef.current.delete(tabId);
            dispatch({
              type: 'replace-tab-content',
              tabId,
              content: contentToSave,
              originalContent: contentToSave,
              hasUnsavedChanges: false,
            });
            return true;
          }

          case 'manual-merge': {
            const contentToSave = resolution.content ?? '';
            await saveTabFile(tab.file, contentToSave);
            pendingContentRef.current.delete(tabId);
            dispatch({
              type: 'replace-tab-content',
              tabId,
              content: contentToSave,
              originalContent: contentToSave,
              hasUnsavedChanges: false,
            });
            return true;
          }

          case 'use-external': {
            const externalContent = await getExternalContent(tabId);
            if (externalContent === null) {
              return false;
            }

            pendingContentRef.current.delete(tabId);
            dispatch({
              type: 'replace-tab-content',
              tabId,
              content: externalContent,
              originalContent: externalContent,
              hasUnsavedChanges: false,
            });
            await emitReloadedTabContent(tab.file, externalContent);
            return true;
          }

          default:
            return false;
        }
      } catch (error) {
        log.error('Failed to resolve conflict', error);
        return false;
      }
    },
    [findTabById, getExternalContent],
  );

  const closeTabIds = useCallback((tabIds: string[]) => {
    tabIds.forEach((tabId) => {
      cleanupTabResources(tabId);
      dispatch({ type: 'close-tab', tabId });
    });
  }, [cleanupTabResources]);

  const handleTabAction = useCallback(async (tabId: string, action: TabAction) => {
    const currentState = tabStateRef.current;

    switch (action) {
      case 'close':
        await closeTab(tabId);
        break;

      case 'close-others':
        closeTabIds(currentState.openTabs.filter((tab) => tab.id !== tabId).map((tab) => tab.id));
        break;

      case 'close-all':
        closeTabIds(currentState.openTabs.map((tab) => tab.id));
        break;

      case 'close-to-right': {
        const tabIndex = currentState.openTabs.findIndex((tab) => tab.id === tabId);
        if (tabIndex >= 0) {
          closeTabIds(currentState.openTabs.slice(tabIndex + 1).map((tab) => tab.id));
        }
        break;
      }

      case 'copy-path': {
        const tab = findTabById(tabId);
        if (tab) {
          log.info('Copy path', tab.file.path);
        }
        break;
      }

      case 'reveal-in-folder':
        log.debug('Reveal in folder', tabId);
        break;
    }
  }, [closeTab, closeTabIds, findTabById]);

  const reopenLastClosedTab = useCallback(async () => {
    const lastClosed = takeMostRecentlyClosedFile(tabStateRef.current);
    if (!lastClosed) {
      return null;
    }

    try {
      const reopenedTabId = await openTab(lastClosed.file);
      dispatch({ type: 'remove-recently-closed-head' });
      return reopenedTabId;
    } catch (error) {
      log.error('Failed to reopen tab', error);
      return null;
    }
  }, [openTab]);

  const closeAllTabs = useCallback(async () => {
    metadataProcessingRef.current.forEach((fn) => fn.cancel());
    metadataProcessingRef.current.clear();
    debouncedStateUpdateRef.current.forEach((fn) => fn.cancel());
    debouncedStateUpdateRef.current.clear();
    pendingContentRef.current.clear();
    dispatch({ type: 'clear-all' });
  }, []);

  const saveAllTabs = useCallback(async (): Promise<boolean> => {
    const candidateTabIds = new Set(
      tabStateRef.current.openTabs
        .filter((tab) => tab.hasUnsavedChanges)
        .map((tab) => tab.id),
    );

    pendingContentRef.current.forEach((_content, tabId) => {
      candidateTabIds.add(tabId);
    });

    try {
      for (const tabId of candidateTabIds) {
        await saveTab(tabId);
      }
      return true;
    } catch (error) {
      log.error('Failed to save all tabs', error);
      return false;
    }
  }, [saveTab]);

  const reorderTabs = useCallback((newTabs: FileTab[]) => {
    dispatch({ type: 'reorder-tabs', openTabs: newTabs });
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (tabStateRef.current.openTabs.length > 0) {
        persistTabState(tabStateRef.current, workspacePath);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [workspacePath]);

  useEffect(() => {
    if (!restoreTabs || !workspacePath) {
      restoredWorkspaceRef.current = null;
      restoringWorkspaceRef.current = null;
      return;
    }

    if (
      restoredWorkspaceRef.current === workspacePath ||
      restoringWorkspaceRef.current === workspacePath
    ) {
      return;
    }

    restoringWorkspaceRef.current = workspacePath;

    const restoreTabsForWorkspace = async () => {
      if (tabStateRef.current.openTabs.length > 0) {
        restoringWorkspaceRef.current = null;
        restoredWorkspaceRef.current = workspacePath;
        return;
      }

      try {
        const restoredState = await restoreTabStateFromStorage({
          workspacePath,
          maxTabs: resolvedMaxTabs,
          readFile: readTabFile,
        });

        if (restoredState && tabStateRef.current.openTabs.length === 0) {
          dispatch({ type: 'restore-state', state: restoredState });
        }
      } catch (error) {
        log.warn('Failed to initialize tabs from storage', error);
      } finally {
        restoringWorkspaceRef.current = null;
        restoredWorkspaceRef.current = workspacePath;
      }
    };

    void restoreTabsForWorkspace();
  }, [resolvedMaxTabs, restoreTabs, workspacePath]);

  useEffect(() => {
    if (tabState.openTabs.length > 0) {
      persistTabState(tabState, workspacePath);
    } else if (
      restoreTabs &&
      workspacePath &&
      restoringWorkspaceRef.current === workspacePath
    ) {
      return;
    } else {
      clearPersistedTabStorage();
    }
  }, [restoreTabs, tabState, workspacePath]);

  useTabManagerSubscriptions({
    onRename: useCallback((detail, mode) => {
      dispatch({
        type: 'rename-paths',
        oldPath: detail.oldPath,
        newPath: detail.newPath,
        mode,
      });
    }, []),
    onDelete: useCallback((detail) => {
      dispatch({ type: 'remove-deleted-path', path: detail.path });
    }, []),
    onOpenReference: useCallback((detail) => {
      if (!detail.path) {
        log.error('No path provided for reference file');
        return;
      }

      void openTab(buildReferenceFile(detail.path));
    }, [openTab]),
  });

  const activeTab = useMemo(() => {
    return tabState.openTabs.find((tab) => tab.id === tabState.activeTabId) || null;
  }, [tabState.activeTabId, tabState.openTabs]);

  return {
    tabState,
    activeTab,
    hasUnsavedChanges: tabState.openTabs.some((tab) => tab.hasUnsavedChanges),
    openTab,
    activateTab,
    closeTab,
    updateTabContent,
    saveTab,
    handleTabAction,
    reopenLastClosedTab,
    closeAllTabs,
    saveAllTabs,
    reorderTabs,
    checkForConflicts,
    getExternalContent,
    resolveConflict,
    reloadTabFromDisk,
    findTabByFile,
    clearPersistedTabs: clearPersistedTabStorage,
  };
};

export default useTabManager;
