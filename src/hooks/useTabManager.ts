/**
 * @fileoverview Tab management hook for Phase 2 multi-file editing
 * @author Development Team  
 * @created 2024-01-XX
 * @phase 2 - Tab management and multi-file state
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { 
  MarkdownFile, 
  FileTab, 
  TabManagerState, 
  TabAction
} from '@/types';

/**
 * Tab manager hook for handling multiple open files
 * 
 * Provides functionality for tab creation, activation, closing, and state management.
 * Maintains content for each open tab and handles switching between files.
 * 
 * @returns Tab manager state and operations
 */
export const useTabManager = () => {
  // === TAB STATE ===
  
  const [tabState, setTabState] = useState<TabManagerState>({
    openTabs: [],
    activeTabId: null,
    maxTabs: 10,
    recentlyClosed: [],
  });

  // === UTILITY FUNCTIONS ===

  /**
   * Generate unique tab ID
   */
  const generateTabId = useCallback((file: MarkdownFile): string => {
    return `tab-${file.id}-${Date.now()}`;
  }, []);

  /**
   * Get the currently active tab
   */
  const getActiveTab = useCallback((): FileTab | null => {
    return tabState.openTabs.find(tab => tab.id === tabState.activeTabId) || null;
  }, [tabState.openTabs, tabState.activeTabId]);

  /**
   * Check if a file is already open in a tab
   */
  const findTabByFile = useCallback((file: MarkdownFile): FileTab | null => {
    return tabState.openTabs.find(tab => tab.file.path === file.path) || null;
  }, [tabState.openTabs]);

  // === TAB PERSISTENCE ===

  /**
   * Save current tab state to localStorage
   */
  const saveTabsToStorage = useCallback((state: TabManagerState) => {
    try {
      const persistedState = {
        openTabs: state.openTabs.map(tab => ({
          id: tab.id,
          filePath: tab.file.path,
          fileName: tab.file.name,
          hasUnsavedChanges: tab.hasUnsavedChanges,
          isActive: tab.isActive,
          // Don't persist the actual content, we'll reload it
        })),
        activeTabId: state.activeTabId,
        maxTabs: state.maxTabs,
      };
      localStorage.setItem('gtdspace-tabs', JSON.stringify(persistedState));
    } catch (error) {
      console.warn('Failed to save tabs to localStorage:', error);
    }
  }, []);

  /**
   * Load tab state from localStorage
   */
  const loadTabsFromStorage = useCallback(async (): Promise<TabManagerState | null> => {
    try {
      const stored = localStorage.getItem('gtdspace-tabs');
      if (!stored) return null;

      const persistedState = JSON.parse(stored);
      const validTabs: FileTab[] = [];

      // Validate and restore each tab
      for (const tabInfo of persistedState.openTabs || []) {
        try {
          // Check if file still exists and get updated metadata
          const fileContent = await invoke<string>('read_file', { path: tabInfo.filePath });
          
          // Create a minimal MarkdownFile object (we might not have all metadata)
          const file: MarkdownFile = {
            id: tabInfo.filePath,
            name: tabInfo.fileName,
            path: tabInfo.filePath,
            size: fileContent.length,
            last_modified: Date.now(), // We don't have the real timestamp
            extension: tabInfo.fileName.split('.').pop() || 'md',
          };

          const tab: FileTab = {
            id: tabInfo.id,
            file,
            content: fileContent,
            hasUnsavedChanges: false, // Reset unsaved changes on restore
            isActive: tabInfo.id === persistedState.activeTabId,
          };

          validTabs.push(tab);
        } catch (error) {
          console.warn(`Failed to restore tab for file: ${tabInfo.filePath}`, error);
          // Skip this tab if file no longer exists or can't be read
        }
      }

      return {
        openTabs: validTabs,
        activeTabId: validTabs.length > 0 ? (persistedState.activeTabId || validTabs[0].id) : null,
        maxTabs: persistedState.maxTabs || 10,
        recentlyClosed: [],
      };
    } catch (error) {
      console.warn('Failed to load tabs from localStorage:', error);
      return null;
    }
  }, []);

  /**
   * Clear persisted tab state
   */
  const clearPersistedTabs = useCallback(() => {
    try {
      localStorage.removeItem('gtdspace-tabs');
    } catch (error) {
      console.warn('Failed to clear persisted tabs:', error);
    }
  }, []);

  // === TAB OPERATIONS ===

  /**
   * Open a file in a new tab or activate existing tab
   */
  const openTab = useCallback(async (file: MarkdownFile): Promise<string> => {
    // Check if file is already open
    const existingTab = findTabByFile(file);
    if (existingTab) {
      // Activate existing tab
      setTabState(prev => ({
        ...prev,
        activeTabId: existingTab.id,
        openTabs: prev.openTabs.map(tab => ({
          ...tab,
          isActive: tab.id === existingTab.id,
        })),
      }));
      return existingTab.id;
    }

    try {
      // Load file content
      console.log('Loading file content for new tab:', file.path);
      const content = await invoke<string>('read_file', { path: file.path });

      // Create new tab
      const tabId = generateTabId(file);
      const newTab: FileTab = {
        id: tabId,
        file,
        content,
        originalContent: content,
        hasUnsavedChanges: false,
        isActive: true,
        cursorPosition: 0,
        scrollPosition: 0,
      };

      setTabState(prev => {
        const newTabs = [...prev.openTabs, newTab];
        
        // Enforce max tabs limit
        if (newTabs.length > prev.maxTabs) {
          // Close the oldest non-active tab
          const oldestInactiveTab = newTabs.find(tab => !tab.isActive && !tab.hasUnsavedChanges);
          if (oldestInactiveTab) {
            return {
              ...prev,
              openTabs: newTabs
                .filter(tab => tab.id !== oldestInactiveTab.id)
                .map(tab => ({ ...tab, isActive: tab.id === tabId })),
              activeTabId: tabId,
              recentlyClosed: [oldestInactiveTab, ...prev.recentlyClosed].slice(0, 10),
            };
          }
        }

        return {
          ...prev,
          openTabs: newTabs.map(tab => ({ ...tab, isActive: tab.id === tabId })),
          activeTabId: tabId,
        };
      });

      console.log('Opened new tab:', tabId, 'for file:', file.name);
      return tabId;

    } catch (error) {
      console.error('Failed to load file for tab:', error);
      throw new Error(`Failed to open file: ${error}`);
    }
  }, [findTabByFile, generateTabId]);

  /**
   * Activate a specific tab
   */
  const activateTab = useCallback((tabId: string) => {
    setTabState(prev => ({
      ...prev,
      activeTabId: tabId,
      openTabs: prev.openTabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId,
      })),
    }));
  }, []);

  /**
   * Close a specific tab
   */
  const closeTab = useCallback(async (tabId: string): Promise<boolean> => {
    const tab = tabState.openTabs.find(t => t.id === tabId);
    if (!tab) return false;

    // If tab has unsaved changes, we should ask for confirmation
    // For now, we'll just close it (confirmation can be added later)
    if (tab.hasUnsavedChanges) {
      console.warn('Closing tab with unsaved changes:', tab.file.name);
    }

    setTabState(prev => {
      const remainingTabs = prev.openTabs.filter(t => t.id !== tabId);
      
      // If we're closing the active tab, activate another tab
      let newActiveTabId = prev.activeTabId;
      if (prev.activeTabId === tabId) {
        if (remainingTabs.length > 0) {
          // Activate the tab to the right, or the last tab if we're closing the rightmost
          const closingTabIndex = prev.openTabs.findIndex(t => t.id === tabId);
          const nextTab = remainingTabs[Math.min(closingTabIndex, remainingTabs.length - 1)];
          newActiveTabId = nextTab.id;
        } else {
          newActiveTabId = null;
        }
      }

      return {
        ...prev,
        openTabs: remainingTabs.map(tab => ({
          ...tab,
          isActive: tab.id === newActiveTabId,
        })),
        activeTabId: newActiveTabId,
        recentlyClosed: [tab, ...prev.recentlyClosed].slice(0, 10),
      };
    });

    console.log('Closed tab:', tabId);
    return true;
  }, [tabState.openTabs]);

  /**
   * Update content for a specific tab
   */
  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabState(prev => ({
      ...prev,
      openTabs: prev.openTabs.map(tab => 
        tab.id === tabId
          ? { 
              ...tab, 
              content,
              hasUnsavedChanges: (tab.originalContent || tab.content) !== content,
            }
          : tab
      ),
    }));
  }, []);


  /**
   * Save content for a specific tab
   */
  const saveTab = useCallback(async (tabId: string): Promise<boolean> => {
    const tab = tabState.openTabs.find(t => t.id === tabId);
    if (!tab || !tab.hasUnsavedChanges) return false;

    try {
      console.log('Saving tab content:', tab.file.path);
      await invoke<string>('save_file', {
        path: tab.file.path,
        content: tab.content,
      });

      // Mark tab as saved
      setTabState(prev => ({
        ...prev,
        openTabs: prev.openTabs.map(t => 
          t.id === tabId
            ? { ...t, hasUnsavedChanges: false }
            : t
        ),
      }));

      console.log('Tab saved successfully:', tabId);
      return true;

    } catch (error) {
      console.error('Failed to save tab:', error);
      throw new Error(`Failed to save file: ${error}`);
    }
  }, [tabState.openTabs]);

  /**
   * Check if a tab has conflicts with external file changes
   */
  const checkForConflicts = useCallback(async (tabId: string): Promise<boolean> => {
    const tab = tabState.openTabs.find(t => t.id === tabId);
    if (!tab || !tab.hasUnsavedChanges) return false;

    try {
      // Read the current file content from disk
      const currentFileContent = await invoke<string>('read_file', { 
        path: tab.file.path 
      });

      // Compare with original content when the tab was opened
      const originalContent = tab.originalContent || tab.content;
      return currentFileContent !== originalContent;
    } catch (error) {
      console.error('Failed to check for conflicts:', error);
      return false;
    }
  }, [tabState.openTabs]);

  /**
   * Get external file content for conflict resolution
   */
  const getExternalContent = useCallback(async (tabId: string): Promise<string | null> => {
    const tab = tabState.openTabs.find(t => t.id === tabId);
    if (!tab) return null;

    try {
      return await invoke<string>('read_file', { path: tab.file.path });
    } catch (error) {
      console.error('Failed to read external content:', error);
      return null;
    }
  }, [tabState.openTabs]);

  /**
   * Resolve conflict by applying chosen resolution
   */
  const resolveConflict = useCallback(async (tabId: string, resolution: any): Promise<boolean> => {
    const tab = tabState.openTabs.find(t => t.id === tabId);
    if (!tab) return false;

    try {
      let contentToUse: string;
      
      switch (resolution.action) {
        case 'keep-local':
          contentToUse = tab.content;
          break;
        case 'use-external':
          const externalContent = await getExternalContent(tabId);
          if (externalContent === null) return false;
          contentToUse = externalContent;
          break;
        case 'manual-merge':
          contentToUse = resolution.content;
          break;
        default:
          return false;
      }

      // Update the tab with resolved content
      setTabState(prev => ({
        ...prev,
        openTabs: prev.openTabs.map(t =>
          t.id === tabId
            ? {
                ...t,
                content: contentToUse,
                originalContent: contentToUse,
                hasUnsavedChanges: false,
              }
            : t
        ),
      }));

      // Save the resolved content to file
      await saveTab(tabId);
      return true;
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      return false;
    }
  }, [tabState.openTabs, getExternalContent, saveTab]);

  /**
   * Handle tab context menu actions
   */
  const handleTabAction = useCallback(async (tabId: string, action: TabAction) => {
    switch (action) {
      case 'close':
        await closeTab(tabId);
        break;

      case 'close-others':
        const tabsToClose = tabState.openTabs.filter(t => t.id !== tabId);
        for (const tab of tabsToClose) {
          await closeTab(tab.id);
        }
        break;

      case 'close-all':
        for (const tab of tabState.openTabs) {
          await closeTab(tab.id);
        }
        break;

      case 'close-to-right':
        const tabIndex = tabState.openTabs.findIndex(t => t.id === tabId);
        const tabsToRight = tabState.openTabs.slice(tabIndex + 1);
        for (const tab of tabsToRight) {
          await closeTab(tab.id);
        }
        break;

      case 'copy-path':
        const tab = tabState.openTabs.find(t => t.id === tabId);
        if (tab) {
          // Copy path to clipboard (will implement when we add clipboard support)
          console.log('Copy path:', tab.file.path);
        }
        break;

      case 'reveal-in-folder':
        // Will implement when we add file system integration
        console.log('Reveal in folder:', tabId);
        break;
    }
  }, [tabState.openTabs, closeTab]);

  /**
   * Reopen the most recently closed tab
   */
  const reopenLastClosedTab = useCallback(async () => {
    if (tabState.recentlyClosed.length === 0) return null;

    const lastClosed = tabState.recentlyClosed[0];
    
    try {
      const tabId = await openTab(lastClosed.file);
      
      // Remove from recently closed
      setTabState(prev => ({
        ...prev,
        recentlyClosed: prev.recentlyClosed.slice(1),
      }));

      return tabId;
    } catch (error) {
      console.error('Failed to reopen tab:', error);
      return null;
    }
  }, [tabState.recentlyClosed, openTab]);

  /**
   * Close all tabs
   */
  const closeAllTabs = useCallback(async () => {
    for (const tab of tabState.openTabs) {
      await closeTab(tab.id);
    }
  }, [tabState.openTabs, closeTab]);

  /**
   * Save all tabs with unsaved changes
   */
  const saveAllTabs = useCallback(async (): Promise<boolean> => {
    const unsavedTabs = tabState.openTabs.filter(tab => tab.hasUnsavedChanges);
    
    try {
      for (const tab of unsavedTabs) {
        await saveTab(tab.id);
      }
      return true;
    } catch (error) {
      console.error('Failed to save all tabs:', error);
      return false;
    }
  }, [tabState.openTabs, saveTab]);

  /**
   * Reorder tabs based on new order
   */
  const reorderTabs = useCallback((newTabs: FileTab[]) => {
    setTabState(prev => ({
      ...prev,
      openTabs: newTabs,
    }));
    console.log('Tabs reordered');
  }, []);

  // === PERSISTENCE EFFECTS ===

  /**
   * Initialize tabs from localStorage on mount
   */
  useEffect(() => {
    const initializeTabs = async () => {
      try {
        const restoredState = await loadTabsFromStorage();
        if (restoredState && restoredState.openTabs.length > 0) {
          setTabState(restoredState);
          console.log(`Restored ${restoredState.openTabs.length} tabs from previous session`);
        }
      } catch (error) {
        console.warn('Failed to initialize tabs from storage:', error);
      }
    };

    initializeTabs();
  }, []); // Only run on mount

  /**
   * Save tabs to localStorage whenever tab state changes
   */
  useEffect(() => {
    // Only save if we have tabs to save
    if (tabState.openTabs.length > 0) {
      saveTabsToStorage(tabState);
    } else {
      // Clear storage if no tabs are open
      clearPersistedTabs();
    }
  }, [tabState, saveTabsToStorage, clearPersistedTabs]);

  /**
   * Save tabs before page unload
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (tabState.openTabs.length > 0) {
        saveTabsToStorage(tabState);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tabState, saveTabsToStorage]);

  // === RETURN STATE AND OPERATIONS ===

  return {
    // State
    tabState,
    activeTab: getActiveTab(),
    hasUnsavedChanges: tabState.openTabs.some(tab => tab.hasUnsavedChanges),
    
    // Operations
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
    
    // Conflict resolution
    checkForConflicts,
    getExternalContent,
    resolveConflict,
    
    // Utilities
    findTabByFile,
    
    // Persistence
    clearPersistedTabs,
  };
};

export default useTabManager;