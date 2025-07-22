/**
 * @fileoverview Hook for managing application commands
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Command management
 */

import { useMemo } from 'react';
import { 
  Save, 
  FolderOpen, 
  File, 
  Search, 
  Settings, 
  Bold, 
  Italic, 
  Link, 
  RotateCcw,
  X,
  RefreshCw,
  Moon,
  Sun
} from 'lucide-react';
import type { Command } from '@/components/command-palette';

export interface UseCommandsProps {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether there's an active tab */
  hasActiveTab: boolean;
  /** Whether a folder is selected */
  hasFolderSelected: boolean;
  /** Current theme */
  theme: 'light' | 'dark' | 'auto';
  /** Command handlers */
  handlers: {
    saveActiveTab: () => Promise<void>;
    saveAllTabs: () => Promise<void>;
    selectFolder: () => Promise<void>;
    createNewFile: () => Promise<void>;
    openGlobalSearch: () => void;
    openSettings: () => void;
    toggleTheme: () => void;
    closeActiveTab: () => Promise<void>;
    closeAllTabs: () => Promise<void>;
    reopenLastClosedTab: () => Promise<void>;
    refreshFileList: () => Promise<void>;
    clearPersistedTabs: () => void;
  };
}

/**
 * Hook for managing all application commands for the command palette
 */
export const useCommands = ({
  hasUnsavedChanges,
  hasActiveTab,
  hasFolderSelected,
  theme,
  handlers,
}: UseCommandsProps): Command[] => {
  return useMemo(() => {
    const commands: Command[] = [
      // File Operations
      {
        id: 'file.save',
        name: 'Save File',
        description: 'Save the currently active file',
        icon: Save,
        shortcut: 'Ctrl+S',
        category: 'file',
        enabled: hasActiveTab && hasUnsavedChanges,
        execute: handlers.saveActiveTab,
      },
      {
        id: 'file.saveAll',
        name: 'Save All Files',
        description: 'Save all open files with unsaved changes',
        icon: Save,
        shortcut: 'Ctrl+Shift+S',
        category: 'file',
        enabled: hasUnsavedChanges,
        execute: handlers.saveAllTabs,
      },
      {
        id: 'file.openFolder',
        name: 'Open Folder',
        description: 'Select a folder to browse markdown files',
        icon: FolderOpen,
        shortcut: 'Ctrl+O',
        category: 'file',
        enabled: true,
        execute: handlers.selectFolder,
      },
      {
        id: 'file.newFile',
        name: 'New File',
        description: 'Create a new markdown file in the current folder',
        icon: File,
        shortcut: 'Ctrl+N',
        category: 'file',
        enabled: hasFolderSelected,
        execute: handlers.createNewFile,
      },
      {
        id: 'file.closeTab',
        name: 'Close Tab',
        description: 'Close the currently active tab',
        icon: X,
        shortcut: 'Ctrl+W',
        category: 'file',
        enabled: hasActiveTab,
        execute: handlers.closeActiveTab,
      },
      {
        id: 'file.closeAllTabs',
        name: 'Close All Tabs',
        description: 'Close all open tabs',
        icon: X,
        shortcut: 'Ctrl+Shift+W',
        category: 'file',
        enabled: hasActiveTab,
        execute: handlers.closeAllTabs,
      },
      {
        id: 'file.reopenTab',
        name: 'Reopen Last Closed Tab',
        description: 'Reopen the most recently closed tab',
        icon: RotateCcw,
        shortcut: 'Ctrl+Shift+T',
        category: 'file',
        enabled: true, // TODO: Check if there are closed tabs to reopen
        execute: handlers.reopenLastClosedTab,
      },
      {
        id: 'file.refresh',
        name: 'Refresh File List',
        description: 'Refresh the file browser to show latest changes',
        icon: RefreshCw,
        shortcut: 'F5',
        category: 'file',
        enabled: hasFolderSelected,
        execute: handlers.refreshFileList,
      },
      {
        id: 'file.clearPersistedTabs',
        name: 'Clear Saved Tabs',
        description: 'Clear all saved tabs from local storage',
        icon: X,
        category: 'file',
        enabled: true,
        execute: handlers.clearPersistedTabs,
      },

      // Search
      {
        id: 'search.global',
        name: 'Global Search',
        description: 'Search across all files in the current folder',
        icon: Search,
        shortcut: 'Ctrl+Shift+F',
        category: 'search',
        enabled: hasFolderSelected,
        execute: handlers.openGlobalSearch,
      },

      // Editor Commands (these would need to be integrated with CodeMirror)
      {
        id: 'editor.bold',
        name: 'Toggle Bold',
        description: 'Make selected text bold or insert bold markers',
        icon: Bold,
        shortcut: 'Ctrl+B',
        category: 'edit',
        enabled: hasActiveTab,
        execute: () => {
          // This would need to trigger CodeMirror's bold command
          console.log('Bold command - would need CodeMirror integration');
        },
      },
      {
        id: 'editor.italic',
        name: 'Toggle Italic',
        description: 'Make selected text italic or insert italic markers',
        icon: Italic,
        shortcut: 'Ctrl+I',
        category: 'edit',
        enabled: hasActiveTab,
        execute: () => {
          // This would need to trigger CodeMirror's italic command
          console.log('Italic command - would need CodeMirror integration');
        },
      },
      {
        id: 'editor.link',
        name: 'Insert Link',
        description: 'Insert a markdown link or wrap selected text',
        icon: Link,
        shortcut: 'Ctrl+K',
        category: 'edit',
        enabled: hasActiveTab,
        execute: () => {
          // This would need to trigger CodeMirror's link command
          console.log('Link command - would need CodeMirror integration');
        },
      },

      // View
      {
        id: 'view.toggleTheme',
        name: 'Toggle Theme',
        description: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`,
        icon: theme === 'dark' ? Sun : Moon,
        shortcut: 'Ctrl+Shift+L',
        category: 'view',
        enabled: true,
        execute: handlers.toggleTheme,
      },

      // Settings
      {
        id: 'settings.open',
        name: 'Open Settings',
        description: 'Open the application settings dialog',
        icon: Settings,
        shortcut: 'Ctrl+,',
        category: 'settings',
        enabled: true,
        execute: handlers.openSettings,
      },
    ];

    return commands;
  }, [
    hasUnsavedChanges,
    hasActiveTab,
    hasFolderSelected,
    theme,
    handlers,
  ]);
};

export default useCommands;