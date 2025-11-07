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
  /** Last modification timestamp (Unix timestamp, seconds) */
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
 * File manager state
 */
export interface FileManagerState extends AppState {
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
  /** File path for context */
  filePath?: string;
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
  /** File path for the tab */
  filePath: string;
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
  /** Automatically initialize a GTD space if one is not found */
  auto_initialize?: boolean | null;
  /** Seed example content in new workspaces */
  seed_example_content?: boolean | null;
  /** Preferred default GTD space path */
  default_space_path?: string | null;
  /** Whether git sync/backups are enabled */
  git_sync_enabled?: boolean;
  /** Path to the dedicated git sync repository */
  git_sync_repo_path?: string | null;
  /** Optional override for the workspace path to back up */
  git_sync_workspace_path?: string | null;
  /** Remote URL (e.g., GitHub) for pushing encrypted backups */
  git_sync_remote_url?: string | null;
  /** Branch used for syncing backups */
  git_sync_branch?: string | null;
  /** Locally stored encryption key/passphrase */
  git_sync_encryption_key?: string | null;
  /** Number of encrypted snapshots to keep in history */
  git_sync_keep_history?: number | null;
  /** Optional git author override */
  git_sync_author_name?: string | null;
  /** Optional git email override */
  git_sync_author_email?: string | null;
  /** Timestamp of the last successful push */
  git_sync_last_push?: string | null;
  /** Timestamp of the last successful pull */
  git_sync_last_pull?: string | null;
  /** Optional automatic pull interval */
  git_sync_auto_pull_interval_minutes?: number | null;
}

/**
 * Result returned from git sync operations
 */
export interface GitOperationResult {
  /** Whether the operation completed successfully */
  success: boolean;
  /** Human-friendly message summarizing the result */
  message: string;
  /** File name of the snapshot that was used */
  backup_file?: string | null;
  /** Timestamp of the snapshot */
  timestamp?: string | null;
  /** Whether data was pushed to the remote */
  pushed?: boolean;
  /** Additional context for UI diagnostics */
  details?: Record<string, unknown> | null;
}

/**
 * Status information about the git sync/backups subsystem
 */
export interface GitSyncStatus {
  /** Whether the feature is toggled on */
  enabled: boolean;
  /** True when repo, workspace, and key are all configured */
  configured: boolean;
  /** Whether an encryption key is available */
  encryptionConfigured: boolean;
  /** Path to the repo used for backups */
  repoPath?: string | null;
  /** Workspace path used when building archives */
  workspacePath?: string | null;
  /** Remote URL (if configured) */
  remoteUrl?: string | null;
  /** Branch name */
  branch?: string | null;
  /** Timestamp of the latest push */
  lastPush?: string | null;
  /** Timestamp of the latest pull */
  lastPull?: string | null;
  /** Most recent encrypted snapshot file */
  latestBackupFile?: string | null;
  /** Timestamp for that snapshot */
  latestBackupAt?: string | null;
  /** Whether git has staged changes waiting to commit */
  hasPendingCommits?: boolean;
  /** Whether a remote named `origin` is available */
  hasRemote?: boolean;
  /** Additional diagnostic text */
  message?: string | null;
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
export type GTDProjectStatus = 'in-progress' | 'waiting' | 'completed' | 'cancelled';

/**
 * GTD Action status options
 */
export type GTDActionStatus = 'in-progress' | 'waiting' | 'completed' | 'cancelled';

/**
 * GTD Action effort estimation
 */
export type GTDActionEffort = 'small' | 'medium' | 'large' | 'extra-large';

/**
 * GTD Project structure
 */
export interface GTDProject {
  /** Project name (folder name) */
  name: string;
  /** Project description */
  description: string;
  /** Optional due date (ISO format: YYYY-MM-DD) */
  dueDate?: string | null;
  /** Project status */
  status: GTDProjectStatus;
  /** Full path to project folder */
  path: string;
  /** Date project was created */
  createdDateTime: string;
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
  /** Optional focus date (ISO format: YYYY-MM-DDTHH:mm:ss) */
  focusDate?: string | null;
  /** Optional due date (ISO format: YYYY-MM-DD) */
  dueDate?: string | null;
  /** Effort estimation */
  effort: GTDActionEffort;
  /** Optional notes */
  notes?: string;
  /** Date action was created */
  createdDateTime: string;
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
  spacePath: string;
  /** Project name */
  projectName: string;
  /** Project description */
  description: string;
  /** Optional due date (ISO format: YYYY-MM-DD) */
  dueDate?: string | null;
  /** Project status */
  status?: GTDProjectStatus;
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
  /** Optional focus date (ISO format: YYYY-MM-DDTHH:mm:ss) */
  focusDate?: string | null;
  /** Optional due date (ISO format: YYYY-MM-DD) */
  dueDate?: string | null;
  /** Effort estimate */
  effort: GTDActionEffort;
  /** GTD contexts where this action can be performed */
  contexts?: string[];
  /** Optional freeform notes to seed the Notes section */
  notes?: string;
}

/**
 * GTD Habit frequency options
 */
export type GTDHabitFrequency = 
  | '5-minute'
  | 'daily' 
  | 'every-other-day' 
  | 'twice-weekly' 
  | 'weekly' 
  | 'weekdays' 
  | 'biweekly' 
  | 'monthly';

/**
 * GTD Habit status
 */
export type GTDHabitStatus = 'todo' | 'completed';

/**
 * GTD Habit structure
 */
export interface GTDHabit {
  /** Habit name */
  name: string;
  /** How often the habit should be done */
  frequency: GTDHabitFrequency;
  /** Current status */
  status: GTDHabitStatus;
  /** Path to habit file */
  path?: string;
  /** Last update time */
  last_updated?: string;
  /** Date habit was created */
  createdDateTime: string;
}

/**
 * GTD Area of Focus status options
 */
export type GTDAreaStatus = 'steady' | 'watch' | 'incubating' | 'delegated';

/**
 * GTD Area of Focus review cadence options
 */
export type GTDAreaReviewCadence = 'weekly' | 'monthly' | 'quarterly' | 'annually';

/**
 * GTD Area of Focus structure
 */
export interface GTDArea {
  /** Area display name (H1 title) */
  name: string;
  /** Full file path to the area markdown file */
  path: string;
  /** Canonical status token controlling attention level */
  status: GTDAreaStatus;
  /** Preferred review cadence token */
  reviewCadence: GTDAreaReviewCadence;
  /** Owners or accountable stewards for the area */
  stewards?: string[];
  /** ISO timestamp representing creation date */
  createdDateTime?: string;
  /** Linked projects (file paths) */
  projects?: string[];
  /** Linked goals (file paths) */
  goals?: string[];
  /** Linked vision documents (file paths) */
  vision?: string[];
  /** Linked purpose & principles documents (file paths) */
  purpose?: string[];
}

/**
 * GTD Goal status options
 */
export type GTDGoalStatus = 'in-progress' | 'waiting' | 'completed';

/**
 * GTD Goal structure
 */
export interface GTDGoal {
  /** Goal display name (H1 title) */
  name: string;
  /** Full file path to the goal markdown file */
  path: string;
  /** Canonical progress status */
  status: GTDGoalStatus;
  /** Optional target date ISO string (YYYY-MM-DD) */
  targetDate?: string | null;
  /** ISO timestamp representing creation date */
  createdDateTime?: string;
  /** Linked areas (file paths) */
  areas?: string[];
  /** Linked projects (file paths) */
  projects?: string[];
  /** Linked vision documents (file paths) */
  vision?: string[];
  /** Linked purpose & principles documents (file paths) */
  purpose?: string[];
}

/**
 * GTD Vision horizon options
 */
export type GTDVisionHorizon = '3-years' | '5-years' | '10-years' | 'custom';

/**
 * GTD Vision document structure
 */
export interface GTDVisionDoc {
  /** Vision display name (H1 title) */
  name: string;
  /** Full file path to the vision markdown file */
  path: string;
  /** Horizon token representing time span */
  horizon: GTDVisionHorizon;
  /** ISO timestamp representing creation date */
  createdDateTime?: string;
  /** Linked projects (file paths) */
  projects?: string[];
  /** Linked goals (file paths) */
  goals?: string[];
  /** Linked areas (file paths) */
  areas?: string[];
  /** Linked purpose & principles documents (file paths) */
  purpose?: string[];
  /** Vision narrative content */
  narrative?: string;
}

/**
 * GTD Purpose & Principles document structure
 */
export interface GTDPurposePrinciplesDoc {
  /** Purpose document display name (H1 title) */
  name: string;
  /** Full file path to the purpose markdown file */
  path: string;
  /** ISO timestamp representing creation date */
  createdDateTime?: string;
  /** Linked projects (file paths) */
  projects?: string[];
  /** Linked goals (file paths) */
  goals?: string[];
  /** Linked vision documents (file paths) */
  vision?: string[];
  /** Linked areas of focus (file paths) */
  areas?: string[];
  /** Core purpose statement */
  purposeStatement?: string;
  /** Guiding principles (rich text or markdown list) */
  principles?: string;
}
