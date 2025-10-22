import React from 'react';
import '@/utils/resize-observer-fix';
// Use guarded Tauri detection and dynamic invoke to avoid web/runtime crashes
import { waitForTauriReady } from '@/utils/tauri-ready';
import { safeInvoke } from '@/utils/safe-invoke';
import { PanelLeftClose, PanelLeft, FolderOpen, Folder, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AppHeader, AppLoadingScreen } from '@/components/app';
import { GTDWorkspaceSidebar, GTDDashboard, GTDQuickActions, GTDInitDialog } from '@/components/gtd';
import { FileChangeManager } from '@/components/file-browser/FileChangeManager';
import { EnhancedTextEditor } from '@/components/editor/EnhancedTextEditor';
import { ActionPage } from '@/components/gtd/ActionPage';
import { CalendarView } from '@/components/calendar/CalendarView';
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
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { ErrorBoundary } from '@/components/error-handling';
import { Toaster } from '@/components/ui/toaster';
import type { Theme, MarkdownFile, EditorMode, GTDProject } from '@/types';
import './styles/globals.css';

/**
 * Normalizes a file path by converting it to lowercase and replacing
 * backslashes with forward slashes. This ensures consistent path comparisons
 * across different operating systems (e.g., Windows vs. Unix-like).
 * @param p The path to normalize.
 * @returns The normalized path, or null/undefined if the input is null/undefined.
 */
function norm(p?: string | null): string | null | undefined {
  return p?.toLowerCase().replace(/\\/g, '/');
}

/**
 * Checks if a given path `p` is located under a directory `dir`.
 * Paths are normalized before comparison to ensure cross-platform consistency.
 * @param p The path to check.
 * @param dir The directory path to check against.
 * @returns True if `p` is under `dir`, false otherwise.
 */
function isUnder(p?: string | null, dir?: string | null): boolean {
  const normalizedP = norm(p);
  const normalizedDir = norm(dir);

  if (!normalizedP || !normalizedDir) {
    return false;
  }

  // Ensure the directory path ends with a slash for accurate "under" comparison
  const dirWithTrailingSlash = normalizedDir.endsWith('/') ? normalizedDir : `${normalizedDir}/`;

  return normalizedP.startsWith(dirWithTrailingSlash);
}

function isHabitPath(p?: string | null): boolean {
  const normalized = p?.replace(/\\/g, '/');
  return !!normalized && normalized.toLowerCase().includes('/habits/');
}

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
export const App: React.FC = () => {
  // === FILE MANAGEMENT ===

  const {
    state: fileState,
    selectFolder,
    loadFolder,
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
    reorderTabs,
  } = useTabManager();


  // Fallback to last tab if activeTab is not set for any reason
  const displayedTab = React.useMemo(() => {
    return activeTab || (tabState.openTabs.length > 0 ? tabState.openTabs[tabState.openTabs.length - 1] : null);
  }, [activeTab, tabState.openTabs]);

  // Handle auto-activation of last tab when no active tab exists
  React.useEffect(() => {
    if (!activeTab && tabState.openTabs.length > 0 && !tabState.activeTabId) {
      const lastTab = tabState.openTabs[tabState.openTabs.length - 1];
      activateTab(lastTab.id);
    }
  }, [activeTab, tabState.openTabs, tabState.activeTabId, activateTab]);

  // === FILE WATCHER ===

  const {
    state: watcherState,
    startWatching,
  } = useFileWatcher();

  // === SETTINGS MANAGEMENT ===

  const { settings, setTheme, setLastFolder, isLoading: isLoadingSettings } = useSettings();
  const [themeKey, setThemeKey] = React.useState(0); // Force re-render on theme change

  // === MODAL MANAGEMENT ===

  const {
    isModalOpen,
    openModal,
    closeModal,
  } = useModalManager();

  // === ERROR HANDLING ===

  const {
    withErrorHandling,
  } = useErrorHandler();

  // Refresh file list handler
  const refreshFileList = async () => {
    if (fileState.currentFolder) {
      await loadFolder(fileState.currentFolder);
    }
  };

  // === THEME MANAGEMENT ===

  const applyTheme = React.useCallback((theme: Theme) => {
    const root = document.documentElement;

    // Remove any existing theme classes first
    root.classList.remove('dark', 'light');

    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else if (theme === 'light') {
      root.classList.add('light');
      root.style.colorScheme = 'light';
    } else {
      // Auto theme - detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.add('light');
        root.style.colorScheme = 'light';
      }
    }

    // Force a re-render of affected components
    window.dispatchEvent(new Event('theme-changed'));
    setThemeKey(prev => prev + 1); // Force React re-render
  }, []);

  const toggleTheme = async () => {
    const newTheme: Theme = settings.theme === 'dark' ? 'light' : 'dark';
    await setTheme(newTheme);
    // Theme will be applied automatically by the useEffect watching settings.theme
  };

  // === INTEGRATED FILE OPERATIONS ===

  /**
   * Handle file selection from sidebar - opens in new tab
   */
  const handleFileSelect = async (file: MarkdownFile) => {
    // Check if file path exists and is valid
    if (!file.path) {
      console.error('File path is undefined or empty');
      return;
    }

    try {
      const tabId = await openTab(file);
      if (tabId) {
        activateTab(tabId);
        // Focus the editor region shortly after activation
        setTimeout(() => {
          const editorRoot = document.querySelector('[data-editor-root]') as HTMLElement | null;
          editorRoot?.focus();
        }, 0);
      }
    } catch (error) {
      console.error('Failed to open file in tab:', error);
    }
  };


  /**
   * Handle folder loading - start file watcher
   */
  const handleFolderLoad = React.useCallback(
    async (folderPath: string) => {
      try {
        await loadFolder(folderPath);
        await startWatching(folderPath);
      } catch (error) {
        console.error('Failed to load folder or start watcher:', error);
      }
    },
    [loadFolder, startWatching]
  );

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

      case 'deleted': {
        // File deleted - close tab if open and refresh file list
        const deletedTab = tabState.openTabs.find(tab => norm(tab.file.path) === norm(latestEvent.file_path));
        if (deletedTab) {
          closeTab(deletedTab.id);
        }
        if (fileState.currentFolder) {
          loadFolder(fileState.currentFolder);
        }
        break;
      }

      case 'modified': {
        // File modified externally - show notification if tab is open
        const modifiedTab = tabState.openTabs.find(tab => norm(tab.file.path) === norm(latestEvent.file_path));
        if (modifiedTab && !modifiedTab.hasUnsavedChanges) {
          // File was modified externally
        }
        break;
      }
    }
  }, [watcherState.recentEvents, fileState.currentFolder, tabState.openTabs, loadFolder, closeTab]);

  // === KEYBOARD SHORTCUTS ===

  // Helper function to check if a file requires project reload
  const shouldReloadProjects = (filePath: string): boolean => {
    if (!gtdSpace?.root_path) return false;
    const projectsPath = `${gtdSpace.root_path}/Projects/`;
    return isUnder(filePath, projectsPath) && norm(filePath)?.endsWith('.md');
  };

  const keyboardHandlers = {
    onSaveActive: activeTab ? async () => {
      const saved = await saveTab(activeTab.id);
      // Reload projects if we saved a file in the Projects folder
      if (saved && shouldReloadProjects(activeTab.file.path)) {
        await loadProjects(gtdSpace.root_path!);
      }
    } : undefined,
    onSaveAll: async () => {
      const hadProjectFiles = tabState.openTabs.some(tab =>
        tab.hasUnsavedChanges && shouldReloadProjects(tab.file.path)
      );

      await saveAllTabs();

      // Reload projects if any project files were saved
      if (hadProjectFiles && gtdSpace?.root_path) {
        await loadProjects(gtdSpace.root_path);
      }
    },
    onOpenFolder: selectFolder,
    onOpenGlobalSearch: () => openModal('globalSearch'),
    onOpenKeyboardShortcuts: () => openModal('keyboardShortcuts'),
    onInsertActionsList: () => {
      // Dispatch custom event that the editor hook will listen for
      window.dispatchEvent(new CustomEvent('insert-actions-list'));
    },
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
        await openTab(file);

        // If line number provided, we could scroll to it (future enhancement)
        if (lineNumber !== undefined) {
          // TODO: Future enhancement to scroll to specific line
        }
      },
      'Failed to open search result',
      'file_operation'
    );
  };

  // === GTD STATE ===

  const { gtdSpace, isLoading, checkGTDSpace, loadProjects, initializeGTDSpace, initializeDefaultSpaceIfNeeded, refreshSpace: refreshGTDSpace } = useGTDSpace();
  const [currentProject, setCurrentProject] = React.useState<GTDProject | null>(null);
  const [showGTDInit, setShowGTDInit] = React.useState(false);
  const [isAppInitializing, setIsAppInitializing] = React.useState(true); // App-level loading state

  // Derived state for GTD space
  const isGTDSpace = gtdSpace?.isGTDSpace || false;

  // Set up callback for when files are saved to reload projects
  // This is used by useTabManager to notify when files are saved
  React.useEffect(() => {
    if (!gtdSpace?.root_path) return;

    const projectsPath = `${gtdSpace.root_path}/Projects/`;

    window.onTabFileSaved = async (filePath: string) => {
      // Only reload if the file is in the Projects directory
      if (isUnder(filePath, projectsPath) && norm(filePath)?.endsWith('.md')) {
        await loadProjects(gtdSpace.root_path);
      }
    };

    return () => {
      delete window.onTabFileSaved;
    };
  }, [gtdSpace?.root_path, loadProjects]);

  // Create a workspace switching function that can be passed to settings
  const switchWorkspace = React.useCallback(async (path: string) => {
    // Close all tabs when switching workspaces
    tabState.openTabs.forEach(tab => {
      closeTab(tab.id);
    });

    // Mark that we're handling a workspace change to prevent loops
    hasInitializedWorkspace.current = true;

    // Initialize the new GTD space
    await initializeGTDSpace(path);

    // Load the folder without saving to settings to avoid triggering side effects
    await loadFolder(path, { saveToSettings: false });

    // Save the workspace path to settings after everything is loaded
    await setLastFolder(path);
  }, [tabState.openTabs, closeTab, initializeGTDSpace, loadFolder, setLastFolder]);

  // === VIEW STATE ===

  const [showSettings, setShowSettings] = React.useState(false);

  // === SIDEBAR STATE ===

  const MIN_SIDEBAR_WIDTH = 180; // Minimum width for usability
  const MAX_SIDEBAR_WIDTH = 400; // Maximum width
  const DEFAULT_SIDEBAR_WIDTH = 256; // Default 256px (w-64)

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    // Restore saved width from localStorage with validation
    const saved = localStorage.getItem('gtdspace-sidebar-width');
    if (saved) {
      const parsedWidth = parseInt(saved, 10);
      // Validate the parsed value
      if (!isNaN(parsedWidth) &&
        parsedWidth >= MIN_SIDEBAR_WIDTH &&
        parsedWidth <= MAX_SIDEBAR_WIDTH) {
        return parsedWidth;
      }
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizing, setIsResizing] = React.useState(false);

  // === GTD SPACE CHECK ===

  React.useEffect(() => {
    // Only update current project when in a GTD space
    if (gtdSpace?.root_path && isUnder(fileState.currentFolder, gtdSpace.root_path)) {
      // Check if we're in a specific project
      if (isUnder(fileState.currentFolder, `${gtdSpace.root_path}/Projects/`) && gtdSpace?.projects) {
        const projectPath = fileState.currentFolder;
        const project = gtdSpace.projects.find(p => norm(p.path) === norm(projectPath));
        setCurrentProject(project || null);
      } else {
        setCurrentProject(null);
      }
    } else {
      setCurrentProject(null);
    }
  }, [fileState.currentFolder, gtdSpace?.projects, gtdSpace?.root_path]);

  // === THEME WATCHER ===

  // Apply theme whenever settings change
  React.useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme, applyTheme]);

  // === INITIALIZE ===

  // Track if we've done initial workspace setup
  const hasInitializedWorkspace = React.useRef(false);

  // Initialize app on mount only
  React.useEffect(() => {
    const init = async () => {
      try {
        // Ensure Tauri is ready to reduce callback warnings during hot reload
        await waitForTauriReady();

        // Check permissions on app start (guarded)
        await withErrorHandling<{ status: string } | null>(
          async () => await safeInvoke<{ status: string }>('check_permissions', undefined, null),
          'Failed to check permissions'
        );

        // Clear tab state if no folder is selected (fresh start)
        if (!fileState.currentFolder) {
          localStorage.removeItem('gtdspace-tabs');
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    init();
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Separate effect for workspace initialization after settings load
  React.useEffect(() => {
    const initWorkspace = async () => {
      // Wait for settings to load
      if (isLoadingSettings) {
        return;
      }

      // Only initialize once
      if (hasInitializedWorkspace.current || gtdSpace?.root_path) {
        setIsAppInitializing(false); // App is initialized if we already have a workspace
        return;
      }

      hasInitializedWorkspace.current = true;

      try {
        // Check if settings has a last_folder saved
        if (settings.last_folder && settings.last_folder !== '') {
          // Use the saved workspace
          await handleFolderLoad(settings.last_folder);
          const isGTDNow = await checkGTDSpace(settings.last_folder);
          if (isGTDNow) await loadProjects(settings.last_folder);
          setShowGTDInit(false);
        } else {
          // No saved workspace, initialize default
          const spacePath = await initializeDefaultSpaceIfNeeded();
          if (spacePath) {
            await handleFolderLoad(spacePath);
            const isGTDNow = await checkGTDSpace(spacePath);
            if (isGTDNow) await loadProjects(spacePath);
            setShowGTDInit(false);
          }
        }
      } catch (e) {
        console.warn('Workspace initialization failed:', e);
      } finally {
        setIsAppInitializing(false); // Always stop showing loading state
      }
    };

    initWorkspace();
  }, [isLoadingSettings, settings.last_folder, gtdSpace?.root_path, handleFolderLoad, checkGTDSpace, loadProjects, initializeDefaultSpaceIfNeeded]);

  // Apply theme when it changes  
  React.useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme, applyTheme]);

  // === RENDER ===

  const [isTauriEnvironment, setIsTauriEnvironment] = React.useState(false);

  React.useEffect(() => {
    // Check for Tauri environment after component mount
    const checkTauri = async () => {
      // In Tauri 2.x, check if we can invoke commands
      // Use safeInvoke which gracefully handles non-Tauri environments
      const result = await safeInvoke<string>('ping', undefined, null);
      setIsTauriEnvironment(result !== null);
    };

    checkTauri();
  }, [applyTheme]);

  // Listen for habit status updates to refresh the editor
  React.useEffect(() => {
    const handleHabitStatusUpdate = (event: CustomEvent<{ habitPath: string }>) => {
      // Check if the updated habit is currently open in the editor
      if (norm(activeTab?.filePath) === norm(event.detail.habitPath)) {
        // Reload the file content from disk
        safeInvoke<string>('read_file', { path: event.detail.habitPath }, null)
          .then(freshContent => {
            if (freshContent !== null && freshContent !== undefined) {
              updateTabContent(activeTab.id, freshContent);
            }
          })
          .catch(error => {
            console.error('Failed to refresh habit after status update:', error);
          });
      }

      // Also refresh the sidebar to show updated status
      if (isHabitPath(event.detail.habitPath)) {
        refreshGTDSpace();
      }
    };

    // Handle real-time content changes for habits
    const handleHabitContentChanged = (event: CustomEvent<{ filePath: string }>) => {
      const { filePath } = event.detail;

      // If the changed file is the currently active tab, reload its content
      if (norm(activeTab?.filePath) === norm(filePath)) {
        safeInvoke<string>('read_file', { path: filePath }, null)
          .then(freshContent => {
            if (freshContent !== null && freshContent !== undefined) {
              updateTabContent(activeTab.id, freshContent);
            }
          })
          .catch(error => {
            console.error('Failed to reload habit content:', error);
          });
      }
    };

    window.addEventListener('habit-status-updated', handleHabitStatusUpdate as EventListener);
    window.addEventListener('habit-content-changed', handleHabitContentChanged as EventListener);

    return () => {
      window.removeEventListener('habit-status-updated', handleHabitStatusUpdate as EventListener);
      window.removeEventListener('habit-content-changed', handleHabitContentChanged as EventListener);
    };
  }, [activeTab?.filePath, activeTab?.id, updateTabContent, refreshGTDSpace]);

  // === HABIT RESET SCHEDULER ===
  // Store refs to avoid re-running effect when functions change
  const checkGTDSpaceRef = React.useRef(checkGTDSpace);
  const loadProjectsRef = React.useRef(loadProjects);
  const updateTabContentRef = React.useRef(updateTabContent);
  const activeTabRef = React.useRef(activeTab);

  React.useEffect(() => {
    checkGTDSpaceRef.current = checkGTDSpace;
    loadProjectsRef.current = loadProjects;
    updateTabContentRef.current = updateTabContent;
    activeTabRef.current = activeTab;
  }, [checkGTDSpace, loadProjects, updateTabContent, activeTab]);

  React.useEffect(() => {
    const currentSpacePath = gtdSpace?.root_path;
    if (!currentSpacePath) {
      return;
    }

    // Function to check and reset habits
    const checkHabits = async () => {
      try {
        // Guard against missing required state
        if (!currentSpacePath || currentSpacePath.trim() === '') {
          return; // Skip invocation if no valid space path
        }

        // Always run the check - the backend will determine if any habits need resetting
        // This ensures we catch all frequency intervals properly
        const resetHabits = (await safeInvoke<string[]>('check_and_reset_habits', {
          spacePath: currentSpacePath,
        }, [])) ?? [];

        if (resetHabits && resetHabits.length > 0) {
          // Refresh the workspace to show updated statuses
          // Use refs to avoid effect re-running when these functions change
          await checkGTDSpaceRef.current(currentSpacePath);
          await loadProjectsRef.current(currentSpacePath);

          // Also refresh the current tab if it's a habit
          const currentTab = activeTabRef.current;
          if (isHabitPath(currentTab?.filePath)) {
            // Reload the file content from disk
            try {
              const freshContent = await safeInvoke<string>('read_file', { path: currentTab.filePath }, null);
              if (freshContent !== null && freshContent !== undefined) {
                updateTabContentRef.current(currentTab.id, freshContent);
              }
            } catch (error) {
              console.error('Failed to refresh habit tab:', error);
            }
          }
        }
      } catch (error) {
        console.error('[App] Failed to check and reset habits:', error);
      }
    };

    // Check for missed resets on startup
    const checkMissedResets = async () => {
      try {
        // Guard against missing required state
        if (!currentSpacePath || currentSpacePath.trim() === '') {
          return; // Skip invocation if no valid space path
        }

        const resetHabits = (await safeInvoke<string[]>('check_and_reset_habits', {
          spacePath: currentSpacePath,
        }, [])) ?? [];

        if (resetHabits && resetHabits.length > 0) {
          // Refresh the workspace to show updated statuses
          // Use refs to avoid effect re-running when these functions change
          await checkGTDSpaceRef.current(currentSpacePath);
          await loadProjectsRef.current(currentSpacePath);
        }
      } catch (error) {
        console.error('Failed to check for missed habit resets:', error);
      }
    };

    // Check for missed resets immediately on startup
    checkMissedResets();

    // Check every minute to catch all frequency intervals
    // The backend will determine if any habits actually need resetting
    const interval = setInterval(() => {
      checkHabits();
    }, 60000); // 1 minute interval

    return () => {
      clearInterval(interval);
    };
  }, [gtdSpace?.root_path]); // Only depend on root_path, use refs for everything else



  // Show loading screen while app is initializing
  if (isAppInitializing) {
    return (
      <ErrorBoundary>
        <AppLoadingScreen />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div key={themeKey} className="flex flex-col h-screen bg-background text-foreground">
        <Toaster />

        {/* Header */}
        <AppHeader
          fileName={activeTab?.file.name || ''}
          hasCurrentFileUnsavedChanges={activeTab?.hasUnsavedChanges || false}
          hasAnyUnsavedChanges={hasUnsavedChanges}
          tabCount={tabState.openTabs.length}
          theme={settings.theme}
          isGTDSpace={isGTDSpace}
          onSaveActiveFile={async () => {
            if (activeTab) {
              await saveTab(activeTab.id);
            }
          }}
          onSaveAllFiles={async () => {
            await saveAllTabs();
          }}
          onOpenSettings={() => setShowSettings(true)}
          onToggleTheme={toggleTheme}
          onOpenCalendar={isGTDSpace ? () => {
            // Open calendar in a new tab
            openTab({
              id: 'calendar',
              name: 'Calendar',
              path: '::calendar::',
              size: 0,
                    last_modified: Math.floor(Date.now() / 1000),
              extension: '',
            });
          } : undefined}
          onOpenDashboard={isGTDSpace ? () => {
            // Close all tabs to show dashboard
            if (tabState.openTabs.length > 0) {
              // Close all tabs which will automatically show the dashboard
              tabState.openTabs.forEach(tab => closeTab(tab.id));
            }
          } : undefined}
          onOpenKeyboardShortcuts={() => openModal('keyboardShortcuts')}
        />

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div
            className={`relative flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-0' : ''
              } overflow-hidden`}
            style={{
              width: sidebarCollapsed ? 0 : `${sidebarWidth}px`,
              minWidth: sidebarCollapsed ? 0 : `${MIN_SIDEBAR_WIDTH}px`,
              maxWidth: sidebarCollapsed ? 0 : `${MAX_SIDEBAR_WIDTH}px`
            }}
          >
            <GTDWorkspaceSidebar
              key={`sidebar-${gtdSpace?.root_path || 'none'}`}
              currentFolder={fileState.currentFolder}
              onFolderSelect={handleFolderLoad}
              onFileSelect={handleFileSelect}
              onRefresh={refreshFileList}
              className={sidebarCollapsed ? 'invisible' : ''}
              gtdSpace={gtdSpace}
              checkGTDSpace={checkGTDSpace}
              loadProjects={loadProjects}
            />

            {/* Resize Handle */}
            {!sidebarCollapsed && (
              <div
                className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors ${isResizing ? 'bg-primary/40' : 'bg-transparent hover:bg-primary/20'
                  }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsResizing(true);

                  const startX = e.clientX;
                  const startWidth = sidebarWidth;

                  const handleMouseMove = (e: MouseEvent) => {
                    const delta = e.clientX - startX;
                    const newWidth = Math.min(
                      MAX_SIDEBAR_WIDTH,
                      Math.max(MIN_SIDEBAR_WIDTH, startWidth + delta)
                    );
                    setSidebarWidth(newWidth);
                  };

                  const handleMouseUp = () => {
                    setIsResizing(false);
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    // Save the width preference
                    localStorage.setItem('gtdspace-sidebar-width', String(sidebarWidth));
                  };

                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              />
            )}
          </div>

          {/* Sidebar toggle button */}
          <div className="flex items-start pt-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="ml-1 gap-1.5"
                    aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                  >
                    {sidebarCollapsed ? (
                      <>
                        <PanelLeft className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <PanelLeftClose className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{sidebarCollapsed ? 'Show sidebar (⌘B)' : 'Hide sidebar (⌘B)'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {gtdSpace && isGTDSpace && tabState.openTabs.length === 0 ? (
              // GTD Dashboard View - Show when in GTD space with no open tabs
              <GTDDashboard
                currentFolder={gtdSpace.root_path}
                gtdSpace={gtdSpace}
                isLoading={isLoading}
                loadProjects={loadProjects}
                onSelectProject={handleFolderLoad}
                onSelectFile={handleFileSelect}
                className="flex-1"
              />
            ) : fileState.currentFolder || tabState.openTabs.length > 0 ? (
              // Editor View - Show when editing files or when there are open tabs
              <>
                {/* Tab bar */}
                <TabManager
                  tabState={tabState}
                  onTabActivate={activateTab}
                  onTabClose={closeTab}
                  onTabAction={handleTabAction}
                  onTabReorder={reorderTabs}
                />

                {/* Editor */}
                <div className="flex-1 flex flex-col min-h-0">
                  {displayedTab ? (
                    // Check if this is the calendar tab
                    displayedTab.file.path === '::calendar::' ? (
                      <CalendarView
                        onFileSelect={handleFileSelect}
                        spacePath={gtdSpace?.root_path || fileState.currentFolder || ''}
                        gtdSpace={gtdSpace}
                        files={fileState.files}
                      />
                    ) : (
                      (() => {
                        // Detect Action files: under Projects/ and not README.md
                        const projectsDir = gtdSpace?.root_path ? `${gtdSpace.root_path}/Projects/` : undefined;
                        const underProjects = projectsDir ? isUnder(displayedTab.file.path, projectsDir) : false;
                        const isReadme = /(^|\/)README\.md$/i.test(displayedTab.file.path);
                        // Narrow routing: only render ActionPage when the file is clearly an action
                        // 1) Path heuristic: in an "Actions/" subfolder under a project, or
                        // 2) Content heuristic: has action markers
                        const pathLooksLikeAction = /(^|\/)Actions\//i.test(displayedTab.file.path);
                        const contentHasActionMarkers = /\[!singleselect:status:/i.test(displayedTab.content)
                          || /\[!singleselect:effort:/i.test(displayedTab.content)
                          || /\[!multiselect:contexts:/i.test(displayedTab.content)
                          || /\[!datetime:focus_date:/i.test(displayedTab.content)
                          || /\[!datetime:due_date:/i.test(displayedTab.content);
                        const isActionFile = underProjects && !isReadme && (pathLooksLikeAction || contentHasActionMarkers);

                        if (isActionFile) {
                          return (
                            <ActionPage
                              key={displayedTab.id}
                              content={displayedTab.content}
                              onChange={(content) => updateTabContent(displayedTab.id, content)}
                              filePath={displayedTab.filePath}
                              className="flex-1"
                            />
                          );
                        }

                        // Default editor for non-action files
                        return (
                          <EnhancedTextEditor
                            key={displayedTab.id}
                            content={displayedTab.content}
                            onChange={(content) => updateTabContent(displayedTab.id, content)}
                            mode={settings.editor_mode as EditorMode}
                            showLineNumbers={true}
                            readOnly={false}
                            autoFocus={true}
                            className="flex-1"
                            data-editor-root
                            filePath={displayedTab.filePath}
                          />
                        );
                      })()
                    )
                  ) : tabState.openTabs.length > 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <p>Activating tab...</p>
                      </div>
                    </div>
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
              </>
            ) : (
              // No folder selected - show welcome screen
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center p-8">
                  <Target className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h2 className="text-2xl font-semibold mb-2">Welcome to GTD Space</h2>
                  <p className="text-lg mb-6">Your personal productivity system</p>
                  <p className="mb-4">Select a folder from the sidebar to get started</p>
                  <Button onClick={selectFolder} size="lg">
                    <Folder className="h-5 w-5 mr-2" />
                    Select Folder
                  </Button>
                </div>
              </div>
            )}
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

        {/* GTD Quick Actions */}
        {isGTDSpace && (
          <GTDQuickActions
            currentFolder={fileState.currentFolder}
            currentProject={currentProject}
            variant="floating"
            onProjectCreated={async () => {
              // Refresh file list when project is created
              await refreshFileList();
            }}
            onActionCreated={async () => {
              // Refresh file list when action is created
              await refreshFileList();
            }}
          />
        )}
      </div>

      {/* Settings View (Full Page) */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-background">
          <SettingsManagerLazy
            onBack={() => setShowSettings(false)}
            gtdSpace={gtdSpace}
            switchWorkspace={switchWorkspace}
            checkGTDSpace={checkGTDSpace}
            loadProjects={loadProjects}
          />
        </div>
      )}

      {/* Modals */}

      {/* Global Search */}
      <GlobalSearchLazy
        isOpen={isModalOpen('globalSearch')}
        onClose={closeModal}
        currentFolder={fileState.currentFolder}
        onResultSelect={handleSearchResultClick}
      />

      {/* Keyboard Shortcuts Reference */}
      <KeyboardShortcutsReferenceLazy
        isOpen={isModalOpen('keyboardShortcuts')}
        onClose={closeModal}
      />

      {/* GTD Initialization Dialog */}
      <GTDInitDialog
        isOpen={showGTDInit}
        onClose={() => setShowGTDInit(false)}
        onSuccess={async (spacePath) => {
          setShowGTDInit(false);
          // Reload the folder to show GTD structure
          await handleFolderLoad(spacePath);
          // Force a GTD space check and load projects
          const isGTD = await checkGTDSpace(spacePath);
          if (isGTD) {
            // Load GTD projects to properly update the sidebar
            await loadProjects(spacePath);
          }
        }}
        initialPath={fileState.currentFolder || undefined}
      />
    </ErrorBoundary>
  );
};

export default App;
