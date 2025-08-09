# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GTD Space** is a GTD-first productivity system with integrated markdown editing, built with Tauri, React, and TypeScript. The entire application is designed around the Getting Things Done methodology as the primary experience, not an add-on feature.

**Key Technologies:**
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Editor**: BlockNote v0.35 for WYSIWYG editing with custom single/multiselect blocks
- **State Management**: Custom hooks pattern (no Redux/MobX)
- **Backend**: Rust, Tauri 2.x with fs, dialog, and store plugins
- **File Watching**: notify crate with 500ms debounce for real-time external change detection
- **Toast Notifications**: shadcn/ui toast system (not sonner)
- **DnD**: @dnd-kit for tab reordering and file operations

## Development Commands

```bash
# Start development server (runs both frontend and Tauri backend)
npm run tauri:dev

# Build for production
npm run tauri:build

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Frontend-only development (file operations won't work)
npm run dev

# Rust compilation check (run from src-tauri directory)
cargo check
cargo build
```

## Architecture Overview

### Frontend-Backend Communication Pattern

The app uses Tauri's invoke system for IPC. All backend operations follow this pattern:

```typescript
import { invoke } from '@tauri-apps/api/core';
import { withErrorHandling } from '@/hooks/useErrorHandler';

// Always wrap invokes with error handling
const result = await withErrorHandling(
  async () => await invoke<MarkdownFile[]>('list_markdown_files', { path }),
  'Failed to list files',
  'gtd' // optional category for error handling
);
```

### Tauri Commands (`src-tauri/src/commands/mod.rs`)

**File Operations:**
- `select_folder` - Native folder selection dialog
- `list_markdown_files` - Get markdown files in directory
- `read_file` - Read file contents
- `save_file` - Save content to file
- `create_file` - Create new markdown file with GTD templates
- `rename_file` - Rename existing file
- `delete_file` - Delete file
- `copy_file` - Copy file to new location
- `move_file` - Move file to new location

**Search:**
- `search_files` - Full-text search with filters
- `replace_in_file` - Find and replace in files

**File Watching:**
- `start_file_watcher` - Monitor directory for changes
- `stop_file_watcher` - Stop monitoring

**Settings:**
- `load_settings` - Load user preferences
- `save_settings` - Save user preferences

**System:**
- `ping` - Test communication
- `get_app_version` - Get app version
- `check_permissions` - Check file system access
- `check_directory_exists` - Verify directory existence

**GTD Operations:**
- `initialize_gtd_space` - Create GTD directory structure
- `create_gtd_project` - Create new project with metadata and status
- `create_gtd_action` - Create new action within project with focus date
- `list_gtd_projects` - List all projects with action counts

### State Management Architecture

Each feature has a dedicated hook in `src/hooks/` that encapsulates all business logic:

- **`useFileManager`** - File operations and folder state
- **`useTabManager`** - Multi-file tab management with auto-save (2s debounce)
- **`useFileWatcher`** - External file change detection
- **`useSettings`** - User preferences with Tauri store persistence
- **`useModalManager`** - Centralized modal control
- **`useErrorHandler`** - Error handling with toasts
- **`useKeyboardShortcuts`** - Platform-aware shortcuts
- **`useGTDSpace`** - GTD methodology integration
- **`useToast`** - Toast notifications wrapper
- **`useMultiSelectInsertion`** - MultiSelect field insertion via keyboard shortcuts
- **`useSingleSelectInsertion`** - SingleSelect field insertion via keyboard shortcuts

### Component Organization

The main app flow is:
1. **App.tsx** - Main orchestrator that connects all hooks
2. **GTDWorkspaceSidebar** - GTD project list with expandable actions
3. **TabManager** - Tab bar UI with drag-and-drop reordering
4. **BlockNoteEditor** - WYSIWYG markdown editor with custom blocks
5. **SingleSelectBlock/MultiSelectBlock** - Custom BlockNote blocks for GTD fields

## Select Fields Implementation

### Single Select Fields (Status, Effort)
Used for fields where only one value should be selected.

**Markdown Syntax:**
```markdown
[!singleselect:type:value]
```

Examples:
- `[!singleselect:status:in-progress]`
- `[!singleselect:effort:medium]`
- `[!singleselect:project-status:waiting]`

### Multi Select Fields (Tags, Contexts)
Used for fields where multiple values can be selected.

**Markdown Syntax:**
```markdown
[!multiselect:type:value1,value2]
```

### Field Types and Values

**Action Status (Single Select):**
- in-progress, waiting, complete

**Effort Estimates (Single Select):**
- small (<30min), medium (30-90min), large (>90min), extra-large (>3hrs)

**Project Status (Single Select):**
- in-progress, waiting, completed

### Keyboard Shortcuts for Insertion
**Single Select:**
- **Cmd+Alt+S** (Mac) / **Ctrl+Alt+S** (Windows/Linux): Insert Status field
- **Cmd+Alt+E** (Mac) / **Ctrl+Alt+E** (Windows/Linux): Insert Effort field
- **Cmd+Alt+P** (Mac) / **Ctrl+Alt+P** (Windows/Linux): Insert Project Status field

**Multi Select:**
- **Cmd+Shift+S** (Mac) / **Ctrl+Shift+S** (Windows/Linux): Insert Status field
- **Cmd+Shift+E** (Mac) / **Ctrl+Shift+E** (Windows/Linux): Insert Effort field
- **Cmd+Shift+P** (Mac) / **Ctrl+Shift+P** (Windows/Linux): Insert Project Status field

### Implementation Details
- Custom BlockNote blocks in `src/components/editor/blocks/`
- Markdown preprocessing converts markers to BlockNote blocks
- Theme-aware styling with Tailwind classes
- Legacy HTML format support for backward compatibility

## BlockNote Editor Configuration

- Version 0.35 with custom schema
- Custom single/multiselect blocks for GTD fields
- Theme detection via DOM class mutation observer
- Markdown preprocessing for custom syntax in `src/utils/blocknote-preprocessing.ts`
- Code syntax highlighting via @blocknote/code-block
- Custom theme integration via `blocknote-theme.css`

## Important Constraints

### File Size and Tab Limits
- Maximum file size: 10MB
- Maximum open tabs: 10
- Auto-save delay: 2 seconds
- File watcher debounce: 500ms

### TypeScript Configuration
- **Strict mode is disabled** - be careful with null checks
- Path alias `@/` maps to `src/`
- Unused variable checks disabled for underscore-prefixed vars

### Vite Configuration
- Development server port: 1420 (strict)
- Path aliases configured for `@/`, `@/components`, `@/hooks`, `@/lib`, `@/types`
- Build targets: Chrome 105 (Windows), Safari 13 (others)
- Source maps enabled in debug builds

### ESLint Rules
- React Refresh plugin for component exports
- TypeScript unused vars allowed with `_` prefix
- React hooks exhaustive deps set to warn
- Console statements allowed

### Platform Considerations
- File paths handled by Rust backend (cross-platform)
- Settings stored in platform-specific app data directory
- Keyboard shortcuts adapt to platform (Cmd on macOS, Ctrl elsewhere)
- Native file dialogs via tauri-plugin-dialog

### GTD Space Structure
When initialized, creates this directory structure:
```
gtd-space/
├── .gtd.json           # Space metadata (future)
├── Projects/           # Active projects (folders with README.md + action files)
├── Habits/            # Daily/weekly routines
├── Someday Maybe/     # Future ideas
└── Cabinet/           # Reference materials
```

### Tauri Security
- Only whitelisted commands exposed to frontend
- File operations restricted to user-selected directories
- No arbitrary command execution
- All file paths validated in Rust backend

## GTD-Specific Implementation Details

### Parameter Naming Convention
- **Rust backend**: Uses `snake_case` for all parameters
- **TypeScript frontend**: Uses `camelCase` for parameters
- **Tauri automatically converts** camelCase to snake_case when invoking Rust commands

Example:
```typescript
// Frontend (camelCase)
await invoke('create_gtd_project', {
  spacePath,     // Becomes space_path in Rust
  projectName,   // Becomes project_name in Rust
  description,
  dueDate,       // Becomes due_date in Rust
  status,        // Project status selection
});
```

### Data Structure Naming
TypeScript interfaces use `snake_case` properties to match Rust serialization:
```typescript
interface GTDProject {
  name: string;
  description: string;
  due_date?: string | null;    // snake_case
  status: GTDProjectStatus[];  // Array for compatibility
  path: string;
  created_date: string;         // snake_case
  action_count?: number;        // snake_case
}

interface GTDAction {
  name: string;
  status: GTDActionStatus;
  focus_date?: string | null;   // When to work on (date + time)
  due_date?: string | null;     // Deadline (date only)
  effort: string;
}
```

### GTD State Management
The `useGTDSpace` hook maintains:
- `gtdSpace` state with `root_path` tracking
- Smart subdirectory detection (won't re-prompt for initialization)
- Toast notifications for all operations
- Deduplication logic to prevent double notifications in React StrictMode

## Critical Architecture Patterns

### Event-Driven File Watcher
The file watcher runs in the Rust backend and emits events to the frontend via Tauri's event system. The frontend responds in `App.tsx` to update file lists and handle external changes to open tabs.

### Tab State Persistence
Tab state is persisted to localStorage with file metadata, content, and unsaved changes. Recovery happens automatically on app launch.

### Multi-Level Error Handling
- Rust backend returns `Result<T, String>` for all commands
- Frontend wraps all invokes with `withErrorHandling`
- User-friendly error messages displayed via toast system
- Errors are categorized for better debugging

### File Operations Pattern
All file operations go through `useFileManager`:
```typescript
await handleFileOperation({
  type: 'create' | 'rename' | 'delete',
  name: 'filename',
  path: 'optional/path'
});
```

## Recent Changes (January 2025)

### Single Select Fields
- Status and Effort fields now use single select instead of multiselect
- Projects can have initial status set during creation
- Actions use single select for cleaner UI

### GTD Action Enhancements
- Actions support Focus Date (when to work on) with date and time
- Actions support Due Date (deadline) as date only
- Status options: In Progress (default), Waiting, Complete
- Removed "Not Started" status - actions default to "In Progress"

### GTD Project Enhancements
- Projects support status selection during creation
- Status options: in-progress (default), waiting, completed
- Removed categories field - simplified to just status

### GTD-First Architecture
- GTD is now the default and only mode
- Automatic GTD initialization prompts for non-GTD folders
- Sidebar shows expandable project list with inline actions
- Floating action button for quick project/action creation
- Toast notifications for all GTD operations with deduplication

### Key Fixes
- Parameter naming convention clarified (Rust: snake_case, TypeScript: camelCase)
- Smart subdirectory detection prevents re-initialization prompts
- Root path tracking maintains GTD context across navigation
- Actions load dynamically when projects are expanded in sidebar
- Proper parsing of single/multiselect syntax in project README files