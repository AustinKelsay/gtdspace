/**
 * @fileoverview Main App component for Phase 2 - Tabbed Interface
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Enhanced multi-file editing with tabbed interface
 */

import React, { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Menu, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/app/AppHeader';
import { FileBrowserSidebar } from '@/components/file-browser/FileBrowserSidebar';
import { FileChangeManager } from '@/components/file-browser/FileChangeManager';
import { EnhancedTextEditor } from '@/components/editor/EnhancedTextEditor';
import { TabManager } from '@/components/tabs';
import { SettingsManager } from '@/components/settings';
import { GlobalSearch } from '@/components/search';
import { CommandPalette } from '@/components/command-palette';
import { WritingMode } from '@/components/editor/WritingMode';
import { useFileManager } from '@/hooks/useFileManager';
import { useTabManager } from '@/hooks/useTabManager';
import { useFileWatcher } from '@/hooks/useFileWatcher';
import { useCommands } from '@/hooks/useCommands';
import { useSettings } from '@/hooks/useSettings';
import { useModalManager } from '@/hooks/useModalManager';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { PermissionStatus, Theme, MarkdownFile, FileOperation } from '@/types';
import './styles/globals.css';

/**
 * Main application component for Phase 2
 * 
 * Enhances Phase 1 with tabbed multi-file editing, improved workflow,
 * and better state management for complex editing scenarios.
 * 
 * Phase 2 Features:
 * - Tabbed interface for multiple open files
 * - Enhanced keyboard shortcuts (Ctrl+Tab, Ctrl+W, etc.)
 * - Improved auto-save with per-tab state
 * - Better file management integration
 * - Tab context menus and actions
 * 
 * @returns Enhanced Phase 2 application
 */
export const AppPhase2: React.FC = () => {
  // === FILE MANAGEMENT (Phase 1) ===

  const {
    state: fileState,
    selectFolder,
    loadFolder,
    handleFileOperation,
    setSearchQuery,
  } = useFileManager();

  // === TAB MANAGEMENT (Phase 2) ===

  const {
    tabState,
    activeTab,
    hasUnsavedChanges,
    openTab,
    activateTab,
    closeTab,
    updateTabContent,
    saveTab,
    handleTabAction,
    saveAllTabs,
    clearPersistedTabs,
    reorderTabs,
  } = useTabManager();

  // === FILE WATCHER (Phase 2) ===

  const {
    state: watcherState,
    startWatching,
    // stopWatching, // TODO: Add UI button to manually stop watcher
    // clearEvents, // TODO: Add UI to clear event history  
    // getEventsForFile, // TODO: Show events for specific files
  } = useFileWatcher();

  // === SETTINGS MANAGEMENT ===

  const { settings, setTheme } = useSettings();

  // === MODAL MANAGEMENT ===

  const {
    isModalOpen,
    openModal,
    closeModal,
  } = useModalManager();

  // Create new file handler
  const createNewFile = async () => {
    if (!fileState.currentFolder) return;

    try {
      const fileName = `new-file-${Date.now()}.md`;
      await handleFileOperation({
        type: 'create',
        name: fileName,
      });
    } catch (error) {
      console.error('Failed to create new file:', error);
    }
  };

  // Close all tabs handler
  const closeAllTabs = async () => {
    try {
      const tabIds = tabState.openTabs.map(tab => tab.id);
      for (const tabId of tabIds) {
        await closeTab(tabId);
      }
    } catch (error) {
      console.error('Failed to close all tabs:', error);
    }
  };

  // Reopen last closed tab handler (placeholder)
  const reopenLastClosedTab = async () => {
    // TODO: Implement closed tab tracking
    console.log('Reopen last closed tab - not yet implemented');
  };

  // Refresh file list handler
  const refreshFileList = async () => {
    if (fileState.currentFolder) {
      await loadFolder(fileState.currentFolder);
    }
  };

  // === THEME MANAGEMENT ===

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // Auto theme - detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  const toggleTheme = async () => {
    const newTheme: Theme = settings.theme === 'dark' ? 'light' : 'dark';
    await setTheme(newTheme);
    applyTheme(newTheme);
  };

  // === INTEGRATED FILE OPERATIONS ===

  /**
   * Handle file selection from sidebar - opens in new tab
   */
  const handleFileSelect = async (file: MarkdownFile) => {
    try {
      await openTab(file);
    } catch (error) {
      console.error('Failed to open file in tab:', error);
    }
  };

  /**
   * Handle file operations from sidebar - refresh tabs if needed
   */
  const handleSidebarFileOperation = async (operation: FileOperation) => {
    await handleFileOperation(operation);

    // If we renamed or deleted a file that's open in a tab, we should handle it
    if (operation.type === 'delete') {
      const openTab = tabState.openTabs.find(tab => tab.file.path === operation.path);
      if (openTab) {
        await closeTab(openTab.id);
      }
    }
  };

  /**
   * Handle folder loading - start file watcher
   */
  const handleFolderLoad = async (folderPath: string) => {
    try {
      await loadFolder(folderPath);
      await startWatching(folderPath);
    } catch (error) {
      console.error('Failed to load folder or start watcher:', error);
    }
  };

  /**
   * Handle external file changes from file watcher
   */
  React.useEffect(() => {
    if (watcherState.recentEvents.length === 0) return;

    const latestEvent = watcherState.recentEvents[watcherState.recentEvents.length - 1];

    // Handle different types of file changes
    switch (latestEvent.event_type) {
      case 'created':
        // New file created - refresh file list
        if (fileState.currentFolder) {
          loadFolder(fileState.currentFolder);
        }
        break;

      case 'deleted':
        // File deleted - close tab if open and refresh file list
        const deletedTab = tabState.openTabs.find(tab => tab.file.path === latestEvent.file_path);
        if (deletedTab) {
          closeTab(deletedTab.id);
        }
        if (fileState.currentFolder) {
          loadFolder(fileState.currentFolder);
        }
        break;

      case 'modified':
        // File modified externally - show notification if tab is open
        const modifiedTab = tabState.openTabs.find(tab => tab.file.path === latestEvent.file_path);
        if (modifiedTab && !modifiedTab.hasUnsavedChanges) {
          // TODO: Show dialog asking if user wants to reload the file
          console.log(`File ${latestEvent.file_name} was modified externally`);
        }
        break;
    }
  }, [watcherState.recentEvents, fileState.currentFolder, tabState.openTabs, loadFolder, closeTab]);

  /**
   * Handle content changes in the active editor
   */
  const handleContentChange = (content: string) => {
    if (activeTab) {
      updateTabContent(activeTab.id, content);
    }
  };

  /**
   * Save the currently active tab
   */
  const saveActiveTab = async () => {
    if (activeTab && activeTab.hasUnsavedChanges) {
      try {
        await saveTab(activeTab.id);
      } catch (error) {
        console.error('Failed to save active tab:', error);
      }
    }
  };

  // Command handlers for the command palette
  const commandHandlers = {
    saveActiveTab,
    saveAllTabs: async () => {
      await saveAllTabs();
    },
    selectFolder,
    createNewFile,
    openGlobalSearch: () => openModal('globalSearch'),
    openSettings: () => openModal('settings'),
    toggleTheme,
    closeActiveTab: async () => {
      if (activeTab) {
        await closeTab(activeTab.id);
      }
    },
    closeAllTabs,
    reopenLastClosedTab,
    refreshFileList,
    clearPersistedTabs,
    enterWritingMode: () => openModal('writingMode'),
    exitWritingMode: () => closeModal(),
  };

  // Available commands
  const commands = useCommands({
    hasUnsavedChanges,
    hasActiveTab: !!activeTab,
    hasFolderSelected: !!fileState.currentFolder,
    theme: settings.theme,
    handlers: commandHandlers,
  });

  /**
   * Handle search result selection - open file in tab and jump to line
   */
  const handleSearchResultSelect = async (file: MarkdownFile, lineNumber?: number) => {
    try {
      // Open the file in a tab
      const tabId = await openTab(file);

      // If line number provided, we could scroll to it (future enhancement)
      if (lineNumber !== undefined) {
        console.log(`TODO: Scroll to line ${lineNumber + 1} in tab ${tabId}`);
      }
    } catch (error) {
      console.error('Failed to open search result:', error);
    }
  };

  /**
   * Handle replace in file operation
   */
  const handleReplaceInFile = async (filePath: string, searchTerm: string, replaceTerm: string): Promise<boolean> => {
    try {
      console.log('Replacing in file:', filePath, searchTerm, '->', replaceTerm);
      const result = await invoke<string>('replace_in_file', {
        file_path: filePath,
        search_term: searchTerm,
        replace_term: replaceTerm,
      });

      console.log('Replace result:', result);

      // Update any open tabs with this file
      const affectedTab = tabState.openTabs.find(tab => tab.file.path === filePath);
      if (affectedTab) {
        // Re-read the file content
        const newContent = await invoke<string>('read_file', { path: filePath });
        updateTabContent(affectedTab.id, newContent);
      }

      return true;
    } catch (error) {
      console.error('Failed to replace in file:', error);
      return false;
    }
  };

  /**
   * Reload a file's content in its tab (for external changes)
   */
  const reloadFileInTab = async (filePath: string) => {
    try {
      console.log('Reloading file in tab:', filePath);

      // Find the tab with this file
      const tab = tabState.openTabs.find(t => t.file.path === filePath);
      if (!tab) {
        console.warn('No tab found for file:', filePath);
        return;
      }

      // Read the latest file content
      const content = await invoke<string>('read_file', { path: filePath });

      // Update the tab content
      updateTabContent(tab.id, content);

      console.log('File reloaded successfully in tab:', tab.file.name);
    } catch (error) {
      console.error('Failed to reload file in tab:', error);
      throw new Error(`Failed to reload file: ${error}`);
    }
  };

  // === INITIALIZATION ===

  useEffect(() => {
    applyTheme(settings.theme);

    const testBackend = async () => {
      try {
        console.log('Testing backend connectivity...');
        const pingResponse = await invoke<string>('ping');
        console.log('Backend connected:', pingResponse);

        const permissions = await invoke<PermissionStatus>('check_permissions');
        console.log('Permissions:', permissions);
      } catch (error) {
        console.error('Backend connection failed:', error);
      }
    };

    testBackend();
  }, [settings.theme]);

  // === KEYBOARD SHORTCUTS ===

  useKeyboardShortcuts({
    onSaveActive: async () => { await saveActiveTab(); },
    onSaveAll: async () => { await saveAllTabs(); },
    onOpenFolder: selectFolder,
    onOpenGlobalSearch: () => openModal('globalSearch'),
    onOpenCommandPalette: () => openModal('commandPalette'),
  });

  // === RENDER HELPERS ===

  const getTabCount = () => {
    return tabState.openTabs.length;
  };

  // === MAIN APPLICATION LAYOUT ===

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header Bar */}
      <AppHeader
        fileName={activeTab?.file.name || ''}
        hasCurrentFileUnsavedChanges={!!activeTab?.hasUnsavedChanges}
        hasAnyUnsavedChanges={hasUnsavedChanges}
        tabCount={getTabCount()}
        theme={settings.theme}
        onSaveActiveFile={async () => { await saveActiveTab(); }}
        onSaveAllFiles={async () => { await saveAllTabs(); }}
        onOpenSettings={() => openModal('settings')}
        onToggleTheme={toggleTheme}
      />

      {/* Tab Bar */}
      <TabManager
        tabState={tabState}
        onTabActivate={activateTab}
        onTabClose={closeTab}
        onTabAction={handleTabAction}
        onTabReorder={reorderTabs}
      />

      {/* File Change Notifications */}
      {watcherState.recentEvents.length > 0 && (
        <div className="px-4 py-2 border-b bg-muted">
          <FileChangeManager
            events={watcherState.recentEvents}
            openTabs={tabState.openTabs}
            onReloadFile={reloadFileInTab}
            onCloseTab={closeTab}
            onRefreshFileList={() => fileState.currentFolder ? loadFolder(fileState.currentFolder) : Promise.resolve()}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* File Browser Sidebar */}
        <div className="w-80 border-r border-border">
          <FileBrowserSidebar
            state={fileState}
            onFolderSelect={handleFolderLoad}
            onFileSelect={handleFileSelect}
            onFileOperation={handleSidebarFileOperation}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Editor Area */}
        <div className="flex-1 min-w-0">
          {activeTab ? (
            <EnhancedTextEditor
              content={activeTab.content}
              onChange={handleContentChange}
              mode={fileState.editorMode}
              showLineNumbers={true}
              readOnly={false}
              autoFocus={true}
              className="h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-24 h-24 mx-auto mb-6 bg-muted rounded-lg flex items-center justify-center">
                  <Menu className="h-12 w-12 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold mb-3">
                  Welcome to GTD Space
                </h2>
                <p className="text-muted-foreground mb-6">
                  {!fileState.currentFolder
                    ? "Select a folder from the sidebar to get started with your markdown files."
                    : "Click on a file in the sidebar to open it in a new tab."
                  }
                </p>
                {!fileState.currentFolder ? (
                  <Button onClick={selectFolder}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Select Folder
                  </Button>
                ) : fileState.files.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {fileState.files.length} markdown file{fileState.files.length !== 1 ? 's' : ''} available
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No markdown files found in this folder
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      {activeTab && (
        <footer className="h-8 border-t border-border flex items-center justify-between px-4 text-xs text-muted-foreground bg-card">
          <div className="flex items-center space-x-4">
            <span>
              {fileState.files.length} file{fileState.files.length !== 1 ? 's' : ''} in folder
            </span>
            <span>
              {getTabCount()} open
            </span>
            <span>
              {activeTab.content.length} characters
            </span>
            <span>
              {activeTab.content.split('\n').length} lines
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span>
              Mode: {fileState.editorMode}
            </span>
            <span title={activeTab.file.path}>
              {activeTab.file.name}
            </span>
          </div>
        </footer>
      )}

      {/* Settings Dialog */}
      <SettingsManager
        isOpen={isModalOpen('settings')}
        onClose={closeModal}
      />

      {/* Global Search Dialog */}
      <GlobalSearch
        isOpen={isModalOpen('globalSearch')}
        onClose={closeModal}
        currentFolder={fileState.currentFolder}
        onResultSelect={handleSearchResultSelect}
        onReplaceInFile={handleReplaceInFile}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isModalOpen('commandPalette')}
        onClose={closeModal}
        commands={commands}
      />

      {/* Writing Mode */}
      <WritingMode
        isActive={isModalOpen('writingMode')}
        content={activeTab?.content || ''}
        fileName={activeTab?.file.name}
        hasUnsavedChanges={activeTab?.hasUnsavedChanges}
        onChange={(content: string) => {
          if (activeTab) {
            updateTabContent(activeTab.id, content);
          }
        }}
        onExit={closeModal}
        onSave={saveActiveTab}
      />
    </div>
  );
};

export default AppPhase2;