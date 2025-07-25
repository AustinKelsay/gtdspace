/**
 * @fileoverview Main App component - Simplified GTD Space
 * @author Development Team
 * @created 2024-01-XX
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
import { 
  SettingsManagerLazy,
  GlobalSearchLazy,
  KeyboardShortcutsReferenceLazy
} from '@/components/lazy';
import { useFileManager } from '@/hooks/useFileManager';
import { useTabManager } from '@/hooks/useTabManager';
import { useFileWatcher } from '@/hooks/useFileWatcher';
import { useSettings } from '@/hooks/useSettings';
import { useModalManager } from '@/hooks/useModalManager';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { ErrorBoundary } from '@/components/error-handling';
import type { Theme, MarkdownFile, FileOperation, EditorMode } from '@/types';
import './styles/globals.css';

/**
 * Main application component - Simplified version
 * 
 * Core Features:
 * - File browser and management
 * - Markdown editor with syntax highlighting
 * - Preview mode
 * - Multi-tab editing
 * - Auto-save
 * - Basic search
 * - Theme switching
 * - File watcher
 * 
 * @returns Simplified GTD Space application
 */
export const AppPhase2: React.FC = () => {
  // === FILE MANAGEMENT ===

  const {
    state: fileState,
    selectFolder,
    loadFolder,
    handleFileOperation,
    setSearchQuery,
  } = useFileManager();

  // === TAB MANAGEMENT ===

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

  // === FILE WATCHER ===

  const {
    state: watcherState,
    startWatching,
  } = useFileWatcher();

  // === SETTINGS MANAGEMENT ===

  const { settings, setTheme } = useSettings();

  // === MODAL MANAGEMENT ===

  const {
    isModalOpen,
    openModal,
    closeModal,
  } = useModalManager();

  // === ERROR HANDLING ===

  const {
    reportError,
    withErrorHandling,
  } = useErrorHandler();

  // Create new file handler
  const createNewFile = async () => {
    if (!fileState.currentFolder) return;

    await withErrorHandling(
      async () => {
        const fileName = `new-file-${Date.now()}.md`;
        await handleFileOperation({
          type: 'create',
          name: fileName,
        });
      },
      'Failed to create new file',
      'file_operation'
    );
  };

  // Close all tabs handler
  const closeAllTabs = async () => {
    // Save any unsaved changes first
    if (hasUnsavedChanges) {
      await saveAllTabs();
    }
    
    // Close all tabs
    tabState.openTabs.forEach(tab => closeTab(tab.id));
    
    // Clear persisted tabs
    clearPersistedTabs();
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
          console.log(`File ${latestEvent.file_name} was modified externally`);
        }
        break;
    }
  }, [watcherState.recentEvents, fileState.currentFolder, tabState.openTabs, loadFolder, closeTab]);

  // === KEYBOARD SHORTCUTS ===

  const keyboardHandlers = {
    onSave: saveTab,
    onOpenFolder: selectFolder,
    onNewFile: createNewFile,
    onCloseTab: activeTab ? () => closeTab(activeTab.id) : undefined,
    onNextTab: () => {
      const currentIndex = tabState.openTabs.findIndex(tab => tab.id === activeTab?.id);
      if (currentIndex !== -1 && currentIndex < tabState.openTabs.length - 1) {
        activateTab(tabState.openTabs[currentIndex + 1].id);
      }
    },
    onPreviousTab: () => {
      const currentIndex = tabState.openTabs.findIndex(tab => tab.id === activeTab?.id);
      if (currentIndex > 0) {
        activateTab(tabState.openTabs[currentIndex - 1].id);
      }
    },
    onShowKeyboardShortcuts: () => openModal('keyboardShortcuts'),
    onToggleSearch: () => openModal('globalSearch'),
  };

  useKeyboardShortcuts(keyboardHandlers);

  // === GLOBAL SEARCH INTEGRATION ===

  const handleSearchResultClick = async (
    file: MarkdownFile,
    lineNumber?: number
  ) => {
    await withErrorHandling(
      async () => {
        // Open the file in a tab
        const tabId = await openTab(file);

        // If line number provided, we could scroll to it (future enhancement)
        if (lineNumber !== undefined) {
          console.log(`Scroll to line ${lineNumber + 1} in tab ${tabId}`);
        }
      },
      'Failed to open search result',
      'file_operation'
    );
  };

  // === SIDEBAR STATE ===

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  // === INITIALIZE ===

  React.useEffect(() => {
    const init = async () => {
      try {
        // Apply initial theme
        applyTheme(settings.theme);

        // Check permissions on app start
        const status = await invoke<{ status: string }>('check_permissions');
        console.log('Permission status:', status);
      } catch (error) {
        console.error('Failed to check permissions:', error);
      }
    };

    init();
  }, [settings.theme]);

  // === RENDER ===

  const [isTauriEnvironment, setIsTauriEnvironment] = React.useState(false);
  
  React.useEffect(() => {
    // Check for Tauri environment after component mount
    const checkTauri = async () => {
      try {
        // In Tauri 2.x, check if we can invoke commands
        await invoke('ping');
        setIsTauriEnvironment(true);
        console.log('Tauri environment confirmed: ping successful');
      } catch (error) {
        // If invoke fails, we're not in Tauri environment
        setIsTauriEnvironment(false);
        console.log('Not in Tauri environment:', error);
      }
    };
    
    checkTauri();
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* Header */}
        <AppHeader
          fileName={activeTab?.file.name || ''}
          hasCurrentFileUnsavedChanges={activeTab?.hasUnsavedChanges || false}
          hasAnyUnsavedChanges={hasUnsavedChanges}
          tabCount={tabState.openTabs.length}
          theme={settings.theme}
          onSaveActiveFile={async () => {
            if (activeTab) {
              await saveTab(activeTab.id);
            }
          }}
          onSaveAllFiles={async () => {
            await saveAllTabs();
          }}
          onOpenSettings={() => openModal('settings')}
          onOpenAnalytics={() => {/* Analytics removed */}}
          onToggleTheme={toggleTheme}
        />

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div
            className={`transition-all duration-300 ${
              sidebarCollapsed ? 'w-0' : 'w-64'
            }`}
          >
            {!sidebarCollapsed && (
              <FileBrowserSidebar
                state={fileState}
                onFolderSelect={handleFolderLoad}
                onFileSelect={handleFileSelect}
                onFileOperation={handleSidebarFileOperation}
                onSearchChange={setSearchQuery}
              />
            )}
          </div>

          {/* Sidebar toggle button */}
          <div className="flex items-start pt-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="ml-1"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          {/* Editor area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Tab bar */}
            <TabManager
              tabState={tabState}
              onTabActivate={activateTab}
              onTabClose={closeTab}
              onTabAction={handleTabAction}
              onTabReorder={reorderTabs}
            />

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              {activeTab ? (
                <EnhancedTextEditor
                  key={activeTab.id}
                  content={activeTab.content}
                  onChange={(content) => updateTabContent(activeTab.id, content)}
                  mode={settings.editor_mode as EditorMode}
                  showLineNumbers={true}
                  readOnly={false}
                  autoFocus={true}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No file open</p>
                    <p className="text-sm mt-2">
                      Select a file from the sidebar or create a new one
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* File change notification */}
        {watcherState.isWatching && watcherState.recentEvents.length > 0 && (
          <FileChangeManager
            events={watcherState.recentEvents}
            openTabs={tabState.openTabs}
            onReloadFile={async (filePath) => {
              const tab = tabState.openTabs.find(t => t.file.path === filePath);
              if (tab) {
                await openTab(tab.file);
              }
            }}
            onCloseTab={closeTab}
            onRefreshFileList={refreshFileList}
          />
        )}

        {/* Environment warning (development) */}
        {!isTauriEnvironment && (
          <div className="fixed bottom-4 right-4 bg-yellow-500 text-black px-4 py-2 rounded shadow-lg">
            Warning: Not running in Tauri environment. File operations will not work.
          </div>
        )}
      </div>

      {/* Modals */}
      
      {/* Settings Modal */}
      <SettingsManagerLazy
        isOpen={isModalOpen('settings')}
        onClose={closeModal}
      />

      {/* Global Search */}
      <GlobalSearchLazy
        isOpen={isModalOpen('globalSearch')}
        onClose={closeModal}
        currentFolder={fileState.currentFolder}
        onResultClick={handleSearchResultClick}
      />

      {/* Keyboard Shortcuts Reference */}
      <KeyboardShortcutsReferenceLazy
        isOpen={isModalOpen('keyboardShortcuts')}
        onClose={closeModal}
      />
    </ErrorBoundary>
  );
};

export default AppPhase2;