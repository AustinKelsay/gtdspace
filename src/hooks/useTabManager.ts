/**
 * @fileoverview Tab management hook for Phase 2 multi-file editing
 * @author Development Team  
 * @created 2024-01-XX
 * @phase 2 - Tab management and multi-file state
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import debounce from 'lodash.debounce';
// Memory leak prevention removed during simplification
import type { 
  MarkdownFile, 
  FileTab, 
  TabManagerState, 
  TabAction
} from '@/types';
import { extractMetadata, getMetadataChanges } from '@/utils/metadata-extractor';
import { emitContentChange, emitContentSaved, emitMetadataChange } from '@/utils/content-event-bus';
import { migrateMarkdownContent, needsMigration } from '@/utils/data-migration';

// Extend the global Window interface to include our custom callback
declare global {
  interface Window {
    onTabFileSaved?: (path: string) => Promise<void>;
  }
}

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

  // Store for debounced metadata processing
  const metadataProcessingRef = useRef<Map<string, ReturnType<typeof debounce>>>(new Map());
  
  // Remove auto-save activity tracking refs - manual save only now
  
  // Debounced state update for content changes
  const debouncedStateUpdateRef = useRef<Map<string, ReturnType<typeof debounce>>>(new Map());

  // === MANUAL SAVE ONLY - NO AUTO-SAVE ===
  // Auto-save removed - users now have full control over when content is saved
  // GTD fields still auto-save immediately when changed via emitMetadataChange()

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
          const fileContent = await safeInvoke<string>('read_file', { path: tabInfo.filePath }, null);
          if (!fileContent) continue;
          
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
            filePath: tabInfo.filePath,
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
    console.log('useTabManager: openTab called for:', file.path);
    // Check if file is already open
    const existingTab = findTabByFile(file);
    if (existingTab) {
      console.log('useTabManager: File already open in tab:', existingTab.id);
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
      // Check if this is a special tab (like Calendar)
      let content = '';
      let originalContent = '';
      
      if (file.path === '::calendar::') {
        // Special calendar tab - no file content to load
        content = ''; // Calendar view doesn't need content
        originalContent = '';
      } else {
        // Normal file - load content
        console.log('Loading file content for new tab:', file.path);
        content = await safeInvoke<string>('read_file', { path: file.path }, '') || '';
        
        // Apply migrations if needed
        if (needsMigration(content)) {
          console.log('useTabManager: Applying data migrations to file:', file.path);
          let migrationApplied = false;
          try {
            const migratedContent = migrateMarkdownContent(content);
            // Create a backup before auto-saving migrated content
            await safeInvoke<void>('save_file', { path: `${file.path}.backup`, content }, null);
            await safeInvoke<void>('save_file', { path: file.path, content: migratedContent }, null);
            content = migratedContent;
            migrationApplied = true;
          } catch (migrationError) {
            console.error('Migration failed:', migrationError);
            // Continue with original content without emitting saved events
          }
          
          if (migrationApplied) {
            // Emit events to update UI with migrated content
            const newMetadata = extractMetadata(content);
            emitContentSaved({
              filePath: file.path,
              fileName: file.name,
              content: content,
              metadata: newMetadata
            });
            emitMetadataChange({
              filePath: file.path,
              fileName: file.name,
              content: content,
              metadata: newMetadata
            });
          }
        }
        
        originalContent = content;
        console.log('useTabManager: File content loaded, length:', content.length);
      }

      // Create new tab
      const tabId = generateTabId(file);
      const newTab: FileTab = {
        id: tabId,
        file,
        content,
        originalContent,
        hasUnsavedChanges: false,
        isActive: true,
        filePath: file.path,
        cursorPosition: 0,
        scrollPosition: 0,
      };

      setTabState(prev => {
        console.log('TabState updater: prev.openTabs=', prev.openTabs.length);
        const newTabs = [...prev.openTabs, newTab];
        
        // Enforce max tabs limit
        if (newTabs.length > prev.maxTabs) {
          // Close the oldest non-active tab
          const oldestInactiveTab = newTabs.find(tab => !tab.isActive && !tab.hasUnsavedChanges);
          if (oldestInactiveTab) {
            // Add to recently closed tabs
            const newRecentlyClosed = [oldestInactiveTab, ...prev.recentlyClosed].slice(0, 10);
            
            return {
              ...prev,
              openTabs: newTabs
                .filter(tab => tab.id !== oldestInactiveTab.id)
                .map(tab => ({ ...tab, isActive: tab.id === tabId })),
              activeTabId: tabId,
              recentlyClosed: newRecentlyClosed,
            };
          }
        }

        const nextState = {
          ...prev,
          openTabs: newTabs.map(tab => ({ ...tab, isActive: tab.id === tabId })),
          activeTabId: tabId,
        };
        console.log('TabState updater: next.openTabs=', nextState.openTabs.length, 'activeTabId=', nextState.activeTabId);
        return nextState;
      });

      console.log('Opened new tab:', tabId, 'for file:', file.name);
      console.log('openTab post-setTabState: tabs count will be updated');
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

    // Clean up debounced functions for this tab
    const debouncedFn = metadataProcessingRef.current.get(tabId);
    if (debouncedFn) {
      debouncedFn.cancel();
      metadataProcessingRef.current.delete(tabId);
    }
    
    const debouncedStateUpdate = debouncedStateUpdateRef.current.get(tabId);
    if (debouncedStateUpdate) {
      debouncedStateUpdate.cancel();
      debouncedStateUpdateRef.current.delete(tabId);
    }

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
   * Process metadata changes with debouncing to avoid performance issues
   */
  const processMetadataDebounced = useCallback((tabId: string, filePath: string, fileName: string, oldContent: string, newContent: string) => {
    // Skip for special tabs
    if (filePath === '::calendar::') {
      return;
    }
    
    // Get or create debounced function for this tab
    let debouncedFn = metadataProcessingRef.current.get(tabId);
    if (!debouncedFn) {
      debouncedFn = debounce((oldC: string, newC: string, fp: string, fnm: string) => {
        // Extract metadata from old and new content
        const oldMetadata = extractMetadata(oldC);
        const newMetadata = extractMetadata(newC);
        const metadataChanges = getMetadataChanges(oldMetadata, newMetadata);
        
        // Only emit specific events based on what actually changed
        if (Object.keys(metadataChanges).length > 0) {
          console.log('[TabManager] Metadata changed:', metadataChanges, 'for file:', fp);
          // Emit metadata change event (which will also trigger content:changed via the event bus)
          emitMetadataChange({
            filePath: fp,
            fileName: fnm,
            content: newC,
            metadata: newMetadata,
            changedFields: metadataChanges
          });
        } else {
          // Only content changed, not metadata
          emitContentChange({
            filePath: fp,
            fileName: fnm,
            content: newC,
            metadata: newMetadata,
            changedFields: metadataChanges
          });
        }
      }, 500); // 500ms debounce for metadata processing
      
      metadataProcessingRef.current.set(tabId, debouncedFn);
    }
    
    // Pass current filePath and fileName as parameters to avoid stale closure
    debouncedFn(oldContent, newContent, filePath, fileName);
  }, []);

  /**
   * Update content for a specific tab with debounced state updates
   * Now manual save only - no auto-save interference with typing
   */
  const updateTabContent = useCallback((tabId: string, content: string) => {
    // Get the current tab to process metadata
    const currentTab = tabState.openTabs.find(t => t.id === tabId);
    
    if (currentTab) {
      // Process metadata changes with debouncing (GTD fields still auto-save)
      processMetadataDebounced(tabId, currentTab.file.path, currentTab.file.name, currentTab.content || '', content);
    }
    
    // Get or create debounced function for this tab
    let debouncedUpdate = debouncedStateUpdateRef.current.get(tabId);
    if (!debouncedUpdate) {
      debouncedUpdate = debounce((newContent: string) => {
        setTabState(prev => ({
          ...prev,
          openTabs: prev.openTabs.map(tab => 
            tab.id === tabId
              ? { 
                  ...tab, 
                  content: newContent,
                  hasUnsavedChanges: (tab.originalContent ?? tab.content) !== newContent,
                }
              : tab
          ),
        }));
      }, 150); // 150ms debounce for state updates
      
      debouncedStateUpdateRef.current.set(tabId, debouncedUpdate);
    }
    
    // Apply debounced state update (tracks unsaved changes automatically)
    debouncedUpdate(content);
    
    // No auto-save - user must manually save (Cmd+S) or GTD field changes will auto-save
  }, [tabState.openTabs, processMetadataDebounced]);


  /**
   * Save content for a specific tab
   */
  const saveTab = useCallback(async (tabId: string): Promise<boolean> => {
    const tab = tabState.openTabs.find(t => t.id === tabId);
    if (!tab || !tab.hasUnsavedChanges) return false;

    // Skip saving for special tabs
    if (tab.file.path === '::calendar::') {
      return false;
    }

    try {
      console.log('Saving tab content:', tab.file.path);
      const result = await safeInvoke<string>('save_file', {
        path: tab.file.path,
        content: tab.content,
      }, null);
      if (result === null) {
        throw new Error('Failed to save file');
      }

      // Mark tab as saved and update originalContent
      setTabState(prev => ({
        ...prev,
        openTabs: prev.openTabs.map(t => 
          t.id === tabId
            ? { ...t, originalContent: t.content, hasUnsavedChanges: false }
            : t
        ),
      }));

      console.log('Tab saved successfully:', tabId);
      
      // Emit content saved event for sidebar updates
      const metadata = extractMetadata(tab.content);
      emitContentSaved({
        filePath: tab.file.path,
        fileName: tab.file.name,
        content: tab.content,
        metadata
      });
      
      // Notify parent component that a file was saved
      // This will be used to reload projects when a README is saved
      if (typeof window !== 'undefined' && typeof window.onTabFileSaved === 'function') {
        try {
          window.onTabFileSaved(tab.file.path);
        } catch (error) {
          console.warn('Error calling onTabFileSaved callback:', error);
        }
      }
      
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
      const currentFileContent = await safeInvoke<string>('read_file', { 
        path: tab.file.path 
      }, null);
      if (!currentFileContent) {
        throw new Error('Failed to read file');
      }

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
      const content = await safeInvoke<string>('read_file', { path: tab.file.path }, null);
      if (!content) {
        throw new Error('Failed to read file');
      }
      return content;
    } catch (error) {
      console.error('Failed to read external content:', error);
      return null;
    }
  }, [tabState.openTabs]);

  /**
   * Resolve conflict by applying chosen resolution
   */
  const resolveConflict = useCallback(async (tabId: string, resolution: {action: string, content?: string}): Promise<boolean> => {
    const tab = tabState.openTabs.find(t => t.id === tabId);
    if (!tab) return false;

    try {
      let contentToUse: string;
      
      switch (resolution.action) {
        case 'keep-local':
          contentToUse = tab.content;
          break;
        case 'use-external': {
          const externalContent = await getExternalContent(tabId);
          if (externalContent === null) return false;
          contentToUse = externalContent;
          break;
        }
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

      case 'close-others': {
        const tabsToClose = tabState.openTabs.filter(t => t.id !== tabId);
        for (const tab of tabsToClose) {
          await closeTab(tab.id);
        }
        break;
      }

      case 'close-all':
        for (const tab of tabState.openTabs) {
          await closeTab(tab.id);
        }
        break;

      case 'close-to-right': {
        const tabIndex = tabState.openTabs.findIndex(t => t.id === tabId);
        const tabsToRight = tabState.openTabs.slice(tabIndex + 1);
        for (const tab of tabsToRight) {
          await closeTab(tab.id);
        }
        break;
      }

      case 'copy-path': {
        const tab = tabState.openTabs.find(t => t.id === tabId);
        if (tab) {
          // Copy path to clipboard (will implement when we add clipboard support)
          console.log('Copy path:', tab.file.path);
        }
        break;
      }

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
    // Cancel all debounced functions
    metadataProcessingRef.current.forEach(fn => fn.cancel());
    metadataProcessingRef.current.clear();
    
    debouncedStateUpdateRef.current.forEach(fn => fn.cancel());
    debouncedStateUpdateRef.current.clear();
    
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
    const ENABLE_TAB_RESTORE = false;
    const initializeTabs = async () => {
      if (!ENABLE_TAB_RESTORE) return;
      try {
        const restoredState = await loadTabsFromStorage();
        if (restoredState && restoredState.openTabs.length > 0) {
          setTabState(prev => (prev.openTabs.length === 0 ? restoredState : prev));
          console.log(`Restored ${restoredState.openTabs.length} tabs from previous session`);
        }
      } catch (error) {
        console.warn('Failed to initialize tabs from storage:', error);
      }
    };

    initializeTabs();
  }, [loadTabsFromStorage]); // Only run on mount

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
   * Typing-aware auto-save system - triggers only when user becomes idle
   */
  // Removed idle detection - no more auto-save on idle

  // Removed pending auto-save processing - manual save only now

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

  /**
   * Handle project rename events
   */
  useEffect(() => {
    const handleProjectRename = (event: CustomEvent) => {
      const { oldPath, newPath } = event.detail;
      
      setTabState(prev => {
        const updatedTabs = prev.openTabs.map(tab => {
          // Check if this tab's file is within the renamed project
          if (tab.file.path.startsWith(oldPath)) {
            // Update the file path
            const relativePath = tab.file.path.substring(oldPath.length);
            const newFilePath = newPath + relativePath;
            
            // Update the tab with new path
            return {
              ...tab,
              file: {
                ...tab.file,
                path: newFilePath,
                id: newFilePath, // Update ID as well since it's based on path
              }
            };
          }
          return tab;
        });
        
        return {
          ...prev,
          openTabs: updatedTabs
        };
      });
      
      console.log(`Updated tab paths for project rename: ${oldPath} -> ${newPath}`);
    };
    
    window.addEventListener('project-renamed', handleProjectRename as EventListener);
    
    return () => {
      window.removeEventListener('project-renamed', handleProjectRename as EventListener);
    };
  }, []);

  /**
   * Handle action rename events
   */
  useEffect(() => {
    const handleActionRename = (event: CustomEvent) => {
      const { oldPath, newPath } = event.detail;
      
      setTabState(prev => {
        const updatedTabs = prev.openTabs.map(tab => {
          // Check if this tab is the renamed action
          if (tab.file.path === oldPath) {
            // Update the tab with new path
            return {
              ...tab,
              file: {
                ...tab.file,
                path: newPath,
                name: newPath.split('/').pop() || tab.file.name,
                id: newPath, // Update ID as well since it's based on path
              }
            };
          }
          return tab;
        });
        
        return {
          ...prev,
          openTabs: updatedTabs
        };
      });
      
      console.log(`Updated tab path for action rename: ${oldPath} -> ${newPath}`);
    };
    
    window.addEventListener('action-renamed', handleActionRename as EventListener);
    
    return () => {
      window.removeEventListener('action-renamed', handleActionRename as EventListener);
    };
  }, []);

  /**
   * Handle section file rename events (Someday Maybe, Cabinet)
   */
  useEffect(() => {
    const handleSectionFileRename = (event: CustomEvent) => {
      const { oldPath, newPath } = event.detail;
      
      setTabState(prev => {
        const updatedTabs = prev.openTabs.map(tab => {
          // Check if this tab is the renamed file
          if (tab.file.path === oldPath) {
            // Update the tab with new path
            return {
              ...tab,
              file: {
                ...tab.file,
                path: newPath,
                name: newPath.split('/').pop() || tab.file.name,
                id: newPath, // Update ID as well since it's based on path
              }
            };
          }
          return tab;
        });
        
        return {
          ...prev,
          openTabs: updatedTabs
        };
      });
      
      console.log(`Updated tab path for section file rename: ${oldPath} -> ${newPath}`);
    };
    
    window.addEventListener('section-file-renamed', handleSectionFileRename as EventListener);
    
    return () => {
      window.removeEventListener('section-file-renamed', handleSectionFileRename as EventListener);
    };
  }, []);

  /**
   * Handle file/folder deletion events
   */
  useEffect(() => {
    const handleFileDeleted = (event: CustomEvent<{ path: string }>) => {
      const { path } = event.detail;
      console.log('[TabManager] File/folder deleted event:', path);
      
      // Close any tabs that match the deleted path or are within a deleted folder
      setTabState(prev => {
        const updatedTabs = prev.openTabs.filter(tab => {
          // Check if this tab's file was deleted or is within a deleted folder
          const shouldRemove = tab.filePath === path || tab.filePath.startsWith(path + '/');
          if (shouldRemove) {
            console.log('[TabManager] Closing tab due to deletion:', tab.filePath);
          }
          return !shouldRemove;
        });
        
        // If the active tab was closed, activate the last remaining tab
        let newActiveTabId = prev.activeTabId;
        if (prev.activeTabId && !updatedTabs.find(t => t.id === prev.activeTabId)) {
          newActiveTabId = updatedTabs.length > 0 ? updatedTabs[updatedTabs.length - 1].id : null;
        }
        
        return {
          ...prev,
          openTabs: updatedTabs,
          activeTabId: newActiveTabId
        };
      });
    };
    
    window.addEventListener('file-deleted', handleFileDeleted as EventListener);
    
    return () => {
      window.removeEventListener('file-deleted', handleFileDeleted as EventListener);
    };
  }, []);

  /**
   * Handle open-reference-file events from ReferencesBlock
   */
  useEffect(() => {
    const handleOpenReference = async (event: CustomEvent) => {
      const { path } = event.detail;
      
      if (!path) {
        console.error('No path provided for reference file');
        return;
      }
      
      try {
        // Create a MarkdownFile object from the path
        const fileName = path.split('/').pop() || 'Unknown';
        const referenceFile: MarkdownFile = {
          id: path,
          name: fileName,
          path: path,
          size: 0, // Size doesn't matter for opening
          last_modified: Date.now(),
          extension: 'md'
        };
        
        // Open the reference file in a new tab
        await openTab(referenceFile);
        console.log(`Opened reference file: ${path}`);
      } catch (error) {
        console.error('Failed to open reference file:', error);
      }
    };
    
    window.addEventListener('open-reference-file', handleOpenReference as EventListener);
    
    return () => {
      window.removeEventListener('open-reference-file', handleOpenReference as EventListener);
    };
  }, [openTab]);

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
    
    // Auto-save functions removed - manual save only now
    
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