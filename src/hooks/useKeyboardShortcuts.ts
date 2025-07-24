/**
 * @fileoverview Keyboard shortcuts hook for centralized shortcut management
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Extraction of keyboard shortcut logic
 */

import { useEffect } from 'react';

/**
 * Keyboard shortcut handlers interface
 */
export interface KeyboardShortcutHandlers {
  /** Save current file (Ctrl+S) */
  onSaveActive?: () => Promise<void> | void;
  /** Save all files (Ctrl+Shift+S) */
  onSaveAll?: () => Promise<void> | void;
  /** Open folder dialog (Ctrl+O) */
  onOpenFolder?: () => Promise<void> | void;
  /** Open global search (Ctrl+Shift+F) */
  onOpenGlobalSearch?: () => void;
  /** Open command palette (Ctrl+Shift+P) */
  onOpenCommandPalette?: () => void;
  /** Open debug panel (Ctrl+Shift+D) */
  onOpenDebugPanel?: () => void;
  /** Open help documentation (Ctrl+?) */
  onOpenHelp?: () => void;
  /** Open keyboard shortcuts reference (Ctrl+Shift+?) */
  onOpenKeyboardShortcuts?: () => void;
}

/**
 * Hook for managing application-wide keyboard shortcuts
 * 
 * Provides centralized keyboard shortcut handling with common shortcuts
 * for file operations, search, and UI navigation. Automatically handles
 * event cleanup and prevents default browser behavior.
 * 
 * @param handlers - Object containing shortcut handler functions
 * @param enabled - Whether shortcuts are enabled (default: true)
 * 
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   onSaveActive: saveCurrentFile,
 *   onSaveAll: saveAllFiles,
 *   onOpenFolder: selectFolder,
 *   onOpenGlobalSearch: () => openModal('globalSearch'),
 *   onOpenCommandPalette: () => openModal('commandPalette'),
 * });
 * ```
 */
export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return;

    /**
     * Handle keyboard events for application shortcuts
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle Ctrl/Cmd key combinations
      if (!event.ctrlKey && !event.metaKey) return;

      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault();
          if (event.shiftKey) {
            // Ctrl+Shift+S: Save all files
            handlers.onSaveAll?.();
          } else {
            // Ctrl+S: Save current file
            handlers.onSaveActive?.();
          }
          break;

        case 'o':
          // Ctrl+O: Open folder
          event.preventDefault();
          handlers.onOpenFolder?.();
          break;

        case 'f':
          // Ctrl+Shift+F: Global search
          if (event.shiftKey) {
            event.preventDefault();
            handlers.onOpenGlobalSearch?.();
          }
          break;

        case 'p':
          // Ctrl+Shift+P: Command palette
          if (event.shiftKey) {
            event.preventDefault();
            handlers.onOpenCommandPalette?.();
          }
          break;

        case 'd':
          // Ctrl+Shift+D: Debug panel (development only)
          if (event.shiftKey && process.env.NODE_ENV === 'development') {
            event.preventDefault();
            handlers.onOpenDebugPanel?.();
          }
          break;

        case '?':
          event.preventDefault();
          if (event.shiftKey) {
            // Ctrl+Shift+?: Keyboard shortcuts reference
            handlers.onOpenKeyboardShortcuts?.();
          } else {
            // Ctrl+?: Help documentation
            handlers.onOpenHelp?.();
          }
          break;

        default:
          // No handler for this key combination
          break;
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlers, enabled]);
} 