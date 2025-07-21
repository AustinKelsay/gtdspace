/**
 * @fileoverview Core type definitions for the GTD Space markdown editor
 * @author Development Team
 * @created 2024-01-XX
 * @phase 0-1 - Type definitions for Phase 0 setup and Phase 1 MVP
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

// === PHASE 1 FILE MANAGEMENT TYPES ===

/**
 * Markdown file structure returned from backend
 */
export interface MarkdownFile {
  /** Unique identifier for the file */
  id: string;
  /** File name without path */
  name: string;
  /** Full file path */
  path: string;
  /** File size in bytes */
  size: number;
  /** Last modification timestamp (Unix timestamp) */
  last_modified: number;
  /** File extension (.md, .markdown) */
  extension: string;
}

/**
 * File operation result from backend operations
 */
export interface FileOperationResult {
  /** Whether the operation was successful */
  success: boolean;
  /** The file path if successful */
  path?: string;
  /** Error or success message */
  message?: string;
}

/**
 * Editor mode options for Phase 1
 */
export type EditorMode = 'source' | 'preview' | 'split';

/**
 * File operation types
 */
export type FileOperation = 
  | { type: 'create'; name: string }
  | { type: 'rename'; oldPath: string; newName: string }
  | { type: 'delete'; path: string };

/**
 * Extended application state for Phase 1
 */
export interface AppStatePhase1 extends AppState {
  /** Currently selected folder path */
  currentFolder: string | null;
  /** List of markdown files in current folder */
  files: MarkdownFile[];
  /** Currently selected/open file */
  currentFile: MarkdownFile | null;
  /** Current file content being edited */
  fileContent: string;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Current editor mode */
  editorMode: EditorMode;
  /** Search query for file filtering */
  searchQuery: string;
  /** Auto-save status */
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

/**
 * File list component props
 */
export interface FileListProps extends BaseComponentProps {
  /** List of files to display */
  files: MarkdownFile[];
  /** Currently selected file */
  selectedFile?: MarkdownFile | null;
  /** Callback when file is selected */
  onFileSelect: (file: MarkdownFile) => void;
  /** Optional loading state */
  loading?: boolean;
  /** Optional search query for filtering */
  searchQuery?: string;
  /** Callback for file operations */
  onFileOperation?: (operation: FileOperation) => void;
}

/**
 * File item component props
 */
export interface FileItemProps extends BaseComponentProps {
  /** File to display */
  file: MarkdownFile;
  /** Whether this file is selected */
  isSelected: boolean;
  /** Callback when file is clicked */
  onSelect: () => void;
  /** Callback for file operations */
  onFileOperation?: (operation: FileOperation) => void;
}

/**
 * Folder selector component props
 */
export interface FolderSelectorProps extends BaseComponentProps {
  /** Current selected folder path */
  currentFolder?: string | null;
  /** Callback when folder is selected */
  onFolderSelect: (folderPath: string) => void;
  /** Loading state */
  loading?: boolean;
}

/**
 * Text editor component props
 */
export interface TextEditorProps extends BaseComponentProps {
  /** Content to edit */
  content: string;
  /** Callback when content changes */
  onChange: (content: string) => void;
  /** Editor mode */
  mode?: EditorMode;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

// === SETTINGS TYPES ===

/**
 * User settings structure for persistence
 */
export interface UserSettings {
  /** Theme preference: 'light', 'dark', or 'system' */
  theme: string;
  /** Editor font size in pixels */
  font_size: number;
  /** Tab size for indentation */
  tab_size: number;
  /** Whether to wrap long lines */
  word_wrap: boolean;
  /** Last opened folder path */
  last_folder?: string | null;
  /** Editor mode preference */
  editor_mode: EditorMode;
  /** Window width (for future use) */
  window_width?: number | null;
  /** Window height (for future use) */
  window_height?: number | null;
}