/**
 * @fileoverview Hooks index for centralized exports
 * @author Development Team
 * @created 2024-01-XX
 */

// Core application hooks
export { useFileManager } from './useFileManager';
export { useTabManager } from './useTabManager';
export { useFileWatcher } from './useFileWatcher';
export { useSettings } from './useSettings';

// UI and interaction hooks
export { useModalManager } from './useModalManager';
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
// useCommands removed during simplification
export { useGlobalSearch } from './useGlobalSearch';

// Type exports
export type { UseModalManagerResult, ModalType } from './useModalManager';
export type { KeyboardShortcutHandlers } from './useKeyboardShortcuts';
// UseCommandsProps removed during simplification
export type { UseGlobalSearchResult } from './useGlobalSearch'; 