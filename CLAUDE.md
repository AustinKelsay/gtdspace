# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GTD Space** is a streamlined cross-platform desktop markdown editor built with Tauri that integrates Getting Things Done (GTD) methodology. It combines a React 18 + TypeScript frontend with a Rust backend to create a local-first markdown editing and productivity experience.

**Key Technologies:**
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Editor**: BlockNote for WYSIWYG editing (with @blocknote/code-block for syntax highlighting)
- **State Management**: Custom hooks pattern (no Redux/MobX)
- **Markdown**: BlockNote handles all markdown conversion internally
- **Backend**: Rust, Tauri 2.x with fs, dialog, and store plugins
- **File Watching**: notify crate with 500ms debounce for real-time external change detection
- **Toast Notifications**: shadcn/ui toast system (not sonner)
- **GTD Integration**: Built-in support for GTD methodology with projects, actions, and structured spaces
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

# Build frontend only
npm run build

# Preview built frontend
npm run preview
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
  'Failed to list files'
);
```

### Tauri Commands (`src-tauri/src/commands/mod.rs`)

**File Operations:**
- `select_folder` - Native folder selection dialog
- `list_markdown_files` - Get markdown files in directory
- `read_file` - Read file contents
- `save_file` - Save content to file
- `create_file` - Create new markdown file
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

**GTD Operations:**
- `initialize_gtd_space` - Create GTD directory structure
- `create_gtd_project` - Create new project with metadata
- `create_gtd_action` - Create new action within project
- `list_gtd_projects` - List all projects with action counts

### State Management Architecture

Each feature has a dedicated hook in `src/hooks/` that encapsulates all business logic:

- **`useFileManager`** - File operations and folder state
  - Manages current folder, file list, search
  - Handles file operations (create, rename, delete)
  
- **`useTabManager`** - Multi-file tab management with auto-save
  - Manages open tabs, active tab, unsaved changes
  - Auto-saves content with 2s debounce
  - Persists tab state to localStorage
  
- **`useFileWatcher`** - External file change detection
  - Monitors current directory for external changes
  - Emits events when files are created/modified/deleted
  
- **`useSettings`** - User preferences
  - Theme, font size, editor mode preferences
  - Persists to Tauri store
  
- **`useModalManager`** - Centralized modal control
  - Single source of truth for modal state
  - Prevents multiple modals from opening
  
- **`useErrorHandler`** - Error handling with toasts
  - Provides `withErrorHandling` wrapper for all async operations
  - Shows user-friendly error messages
  
- **`useKeyboardShortcuts`** - Keyboard shortcut handling
  - Platform-aware shortcuts (Cmd on macOS, Ctrl elsewhere)
  - Centralized shortcut registration

- **`useGTDSpace`** - GTD methodology integration
  - Initialize GTD spaces with standard structure
  - Create and manage projects and actions
  - Load project lists with action counts
  
- **`useToast`** - Toast notifications wrapper
  - Provides convenience methods (showSuccess, showError, etc.)
  - Built on shadcn/ui toast system

### Component Organization

The main app flow is:
1. **App.tsx** - Main orchestrator that connects all hooks
2. **FileBrowserSidebar** - File tree and operations
3. **TabManager** - Tab bar UI
4. **BlockNoteEditor** - WYSIWYG markdown editor
5. **EnhancedTextEditor** - Wrapper for BlockNote with theme detection

### Critical Architecture Patterns

**Event-Driven File Watcher Integration:**
The file watcher runs in the Rust backend and emits events to the frontend via Tauri's event system. The frontend responds to these events in `App.tsx` to update file lists and handle external changes to open tabs.

**Tab State Persistence:**
Tab state is persisted to localStorage with a specific structure that includes file metadata, content, and unsaved changes. Recovery happens automatically on app launch.

**Multi-Level Error Handling:**
- Rust backend returns `Result<T, String>` for all commands
- Frontend wraps all invokes with `withErrorHandling` 
- User-friendly error messages displayed via toast system
- Errors are categorized for better debugging

## Key Implementation Patterns

### Error Handling Pattern
```typescript
// Always use withErrorHandling for async operations
const { withErrorHandling } = useErrorHandler();

const result = await withErrorHandling(
  async () => await invoke('command_name', args),
  'User-friendly error message',
  'optional_error_category'
);
```

### Tab Management Pattern
```typescript
// Opening a file always goes through tab manager
const handleFileSelect = async (file: MarkdownFile) => {
  await openTab(file); // Handles duplicate detection, tab limits, etc.
};
```

### File Operations Pattern
```typescript
// All file operations go through useFileManager
await handleFileOperation({
  type: 'create' | 'rename' | 'delete',
  name: 'filename',
  path: 'optional/path'
});
```

## BlockNote Editor Configuration

- Uses `@blocknote/mantine` for theming
- Requires `@blocknote/code-block` for syntax highlighting
- Custom theme integration via `blocknote-theme.css`
- Light/dark mode support with CSS variables
- Markdown conversion handled by BlockNote's built-in methods

## Important Constraints

### File Size and Tab Limits
- Maximum file size: 10MB (hardcoded check)
- Maximum open tabs: 10 (memory management)
- Auto-save delay: 2 seconds
- File watcher debounce: 500ms

### TypeScript Configuration
- **Strict mode is disabled** - be careful with null checks
- Path alias `@/` maps to `src/`
- Unused variable checks disabled for underscore-prefixed vars
- No explicit return types required

### Platform Considerations
- File paths handled by Rust backend (cross-platform)
- Settings stored in platform-specific app data directory
- Keyboard shortcuts adapt to platform automatically
- Native file dialogs via tauri-plugin-dialog

### GTD Space Structure
When initialized, creates this directory structure:
```
gtd-space/
├── .gtd.json           # Space metadata
├── projects/           # Active projects
├── habits/            # Daily/weekly routines
├── someday_maybe/     # Future ideas
├── cabinet/           # Reference materials
└── archive/           # Completed items
```

### Tauri Security
- Only whitelisted commands exposed to frontend
- File operations restricted to user-selected directories
- No arbitrary command execution
- All file paths validated in Rust backend

## Common Development Tasks

### Adding a New Tauri Command
1. Add the command function in `src-tauri/src/commands/mod.rs`
2. Add TypeScript types in `src/types/index.ts`
3. Create or update the relevant hook in `src/hooks/`
4. Always use `withErrorHandling` when invoking

### Adding a New Modal
1. Create the modal component
2. Add modal type to `useModalManager`
3. Open with `openModal('modalName')`
4. Close with `closeModal()`

### Modifying the Editor
- BlockNote configuration is in `BlockNoteEditor.tsx`
- Theme overrides are in `blocknote-theme.css`
- For new BlockNote extensions, install the package and add to editor config

## Testing and Debugging

### Development Testing
- No automated test suite currently implemented
- When testing file operations, use `npm run tauri:dev` (not `npm run dev`)
- Check console for Rust backend logs
- File watcher events can be monitored in browser console

### Debugging Tips
- Rust backend logging: Set `RUST_LOG=info` environment variable
- Frontend debugging: React DevTools work normally
- Tauri DevTools: Available in development builds
- IPC debugging: All commands log to console with timing

### Performance Considerations
- BlockNote editor handles large files well up to 10MB
- File list virtualization not implemented (may lag with 1000+ files)
- Search is performed in Rust backend for speed
- Tab content stored in memory (hence 10 tab limit)