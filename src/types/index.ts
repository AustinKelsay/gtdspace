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
 * Editor mode options for Phase 1-3
 */
export type EditorMode = 'source' | 'preview' | 'split' | 'wysiwyg';

/**
 * File operation types
 */
export type FileOperation = 
  | { type: 'create'; name: string }
  | { type: 'rename'; oldPath: string; newName: string }
  | { type: 'delete'; path: string }
  | { type: 'copy'; sourcePath: string; destPath: string }
  | { type: 'move'; sourcePath: string; destPath: string };

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

// === PHASE 2 TAB MANAGEMENT TYPES ===

/**
 * File tab representing an open file
 */
export interface FileTab {
  /** Unique tab identifier */
  id: string;
  /** File associated with this tab */
  file: MarkdownFile;
  /** Current content in the editor for this tab */
  content: string;
  /** Original content when the tab was opened (for conflict detection) */
  originalContent?: string;
  /** Whether this tab has unsaved changes */
  hasUnsavedChanges: boolean;
  /** Whether this tab is currently active */
  isActive: boolean;
  /** Cursor position in the editor */
  cursorPosition?: number;
  /** Scroll position in the editor */
  scrollPosition?: number;
}

/**
 * Tab context menu actions
 */
export type TabAction = 
  | 'close'
  | 'close-others'
  | 'close-all'
  | 'close-to-right'
  | 'copy-path'
  | 'reveal-in-folder';

/**
 * Tab manager state
 */
export interface TabManagerState {
  /** All open tabs */
  openTabs: FileTab[];
  /** ID of the currently active tab */
  activeTabId: string | null;
  /** Maximum number of tabs allowed */
  maxTabs: number;
  /** Recently closed tabs for reopen functionality */
  recentlyClosed: FileTab[];
}

/**
 * Enhanced application state for Phase 2
 */
export interface AppStatePhase2 extends AppState {
  /** Currently selected folder path */
  currentFolder: string | null;
  /** List of markdown files in current folder */
  files: MarkdownFile[];
  /** Search query for file filtering */
  searchQuery: string;
  /** Tab management state */
  tabs: TabManagerState;
  /** Current editor mode */
  editorMode: EditorMode;
}

/**
 * Tab component props
 */
export interface FileTabProps extends BaseComponentProps {
  /** Tab data */
  tab: FileTab;
  /** Whether this tab is active */
  isActive: boolean;
  /** Callback when tab is clicked */
  onActivate: (tabId: string) => void;
  /** Callback when tab close button is clicked */
  onClose: (tabId: string) => void;
  /** Callback when tab context menu is requested */
  onContextMenu?: (tabId: string, action: TabAction) => void;
  /** Whether tab can be closed */
  closable?: boolean;
}

/**
 * Tab manager component props
 */
export interface TabManagerProps extends BaseComponentProps {
  /** Tab manager state */
  tabState: TabManagerState;
  /** Callback when tab is activated */
  onTabActivate: (tabId: string) => void;
  /** Callback when tab is closed */
  onTabClose: (tabId: string) => void;
  /** Callback when new tab is requested */
  onNewTab?: () => void;
  /** Callback for tab context menu actions */
  onTabAction?: (tabId: string, action: TabAction) => void;
  /** Callback when tabs are reordered */
  onTabReorder?: (newTabs: FileTab[]) => void;
}

// === FILE WATCHING TYPES ===

/**
 * File change event from file watcher service
 */
export interface FileChangeEvent {
  /** Type of change that occurred */
  event_type: 'created' | 'modified' | 'deleted' | 'changed';
  /** Full path of the affected file */
  file_path: string;
  /** File name without path */
  file_name: string;
  /** Timestamp of the event (Unix timestamp) */
  timestamp: number;
}

// === SETTINGS TYPES ===

/**
 * User settings structure for persistence
 */
export interface UserSettings {
  /** Theme preference: 'light', 'dark', or 'auto' */
  theme: Theme;
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
  /** Maximum number of tabs to keep open */
  max_tabs?: number;
  /** Whether to restore tabs on startup */
  restore_tabs?: boolean;
}

// === SEARCH TYPES ===

/**
 * Search result item
 */
export interface SearchResult {
  /** File path where match was found */
  file_path: string;
  /** File name without path */
  file_name: string;
  /** Line number (0-based) */
  line_number: number;
  /** Line content containing the match */
  line_content: string;
  /** Start position of match within the line */
  match_start: number;
  /** End position of match within the line */
  match_end: number;
  /** Context lines before the match */
  context_before?: string[];
  /** Context lines after the match */
  context_after?: string[];
}

/**
 * Search filters and options
 */
export interface SearchFilters {
  /** Case sensitive search */
  case_sensitive: boolean;
  /** Whole word matching */
  whole_word: boolean;
  /** Use regular expressions */
  use_regex: boolean;
  /** Include file names in search */
  include_file_names: boolean;
  /** Maximum number of results */
  max_results: number;
}

/**
 * Search request parameters
 */
export interface SearchRequest {
  /** Search query */
  query: string;
  /** Directory to search in */
  directory: string;
  /** Search filters */
  filters: SearchFilters;
}

/**
 * Search response from backend
 */
export interface SearchResponse {
  /** Search results */
  results: SearchResult[];
  /** Total number of matches found */
  total_matches: number;
  /** Number of files searched */
  files_searched: number;
  /** Search duration in milliseconds */
  duration_ms: number;
  /** Whether search was truncated due to limits */
  truncated: boolean;
}

// === GTD TYPES ===

/**
 * GTD Project status options
 */
export type GTDProjectStatus = 'Active' | 'On Hold' | 'Complete' | 'Cancelled';

/**
 * GTD Action status options
 */
export type GTDActionStatus = 'Not Started' | 'In Progress' | 'Complete';

/**
 * GTD Action effort estimation
 */
export type GTDActionEffort = 'Small' | 'Medium' | 'Large';

/**
 * GTD Project structure
 */
export interface GTDProject {
  /** Project name (folder name) */
  name: string;
  /** Project description */
  description: string;
  /** Optional due date (ISO format: YYYY-MM-DD) */
  due_date?: string | null;
  /** Project status */
  status: GTDProjectStatus;
  /** Full path to project folder */
  path: string;
  /** Date project was created */
  created_date: string;
  /** Number of actions in the project */
  action_count?: number;
}

/**
 * GTD Action (task) structure
 */
export interface GTDAction {
  /** Action name */
  name: string;
  /** Full path to action file */
  path: string;
  /** Action status */
  status: GTDActionStatus;
  /** Optional due date (ISO format: YYYY-MM-DD) */
  due_date?: string | null;
  /** Effort estimation */
  effort: GTDActionEffort;
  /** Optional notes */
  notes?: string;
  /** Date action was created */
  created_date: string;
  /** Project this action belongs to */
  project_path: string;
}

/**
 * GTD Space structure
 */
export interface GTDSpace {
  /** Root path of the GTD space */
  root_path: string;
  /** Whether the space is properly initialized */
  is_initialized: boolean;
  /** Whether this is a GTD space (alias for is_initialized) */
  isGTDSpace?: boolean;
  /** List of projects in the space */
  projects?: GTDProject[];
  /** Total action count across all projects */
  total_actions?: number;
}

/**
 * GTD initialization result
 */
export interface GTDInitResult {
  /** Whether initialization was successful */
  success: boolean;
  /** Message describing the result */
  message: string;
  /** Path to the initialized space */
  space_path?: string;
}

/**
 * GTD project creation parameters
 */
export interface GTDProjectCreate {
  /** GTD space root path */
  space_path: string;
  /** Project name */
  project_name: string;
  /** Project description */
  description: string;
  /** Optional due date (ISO format: YYYY-MM-DD) */
  due_date?: string | null;
  /** Project categories/tags */
  categories?: string[];
}

/**
 * GTD action creation parameters
 */
export interface GTDActionCreate {
  /** Full path to the project directory */
  project_path: string;
  /** Action name */
  action_name: string;
  /** Initial status */
  status: GTDActionStatus;
  /** Optional due date (ISO format: YYYY-MM-DD) */
  due_date?: string | null;
  /** Effort estimate */
  effort: GTDActionEffort;
  /** GTD contexts where this action can be performed */
  contexts?: string[];
}