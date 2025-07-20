/**
 * @fileoverview Core type definitions for the GTD Space markdown editor
 * @author Development Team
 * @created 2024-01-XX
 * @phase 0 - Basic type definitions for Phase 0 setup
 */

// === BACKEND COMMUNICATION TYPES ===

/**
 * Permission status returned from backend permission check
 */
export interface PermissionStatus {
  /** Whether file system read access is available */
  can_read_files: boolean;
  /** Whether file system write access is available */
  can_write_files: boolean;
  /** Whether dialog access is available */
  can_open_dialogs: boolean;
}

// === UI STATE TYPES ===

/**
 * Theme options for the application
 */
export type Theme = 'light' | 'dark' | 'auto';

/**
 * Application state for Phase 0
 */
export interface AppState {
  /** Current theme setting */
  theme: Theme;
  /** Whether the application is ready */
  isReady: boolean;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

// === COMPONENT PROPS TYPES ===

/**
 * Base props that all components can accept
 */
export interface BaseComponentProps {
  /** Optional CSS class name */
  className?: string;
  /** Optional children elements */
  children?: React.ReactNode;
}

/**
 * Props for layout components
 */
export interface LayoutProps extends BaseComponentProps {
  /** Whether sidebar is open */
  sidebarOpen?: boolean;
  /** Callback when sidebar toggle is requested */
  onSidebarToggle?: () => void;
}

// === ASYNC OPERATION TYPES ===

/**
 * Standard result type for async operations
 */
export type AsyncResult<T = unknown> = 
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

/**
 * Loading state for async operations
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Async state wrapper for data operations
 */
export interface AsyncState<T> {
  /** Current state of the operation */
  state: LoadingState;
  /** Data if operation succeeded */
  data: T | null;
  /** Error message if operation failed */
  error: string | null;
}