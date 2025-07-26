# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GTD Space** is a streamlined cross-platform desktop markdown editor built with Tauri. It combines a React 18 + TypeScript frontend with a Rust backend to create a local-first markdown editing experience focused on simplicity and core functionality.

**Key Technologies:**
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Editor**: BlockNote for WYSIWYG editing
- **State Management**: Custom hooks pattern
- **Markdown**: marked for preview rendering
- **Backend**: Rust, Tauri 2.x with fs, dialog, and store plugins
- **File Watching**: notify crate for real-time external change detection

## Development Commands

```bash
# Start development server (runs both frontend and Tauri backend)
npm run tauri:dev

# Build for production
npm run tauri:build

# Frontend-only development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Build frontend only
npm run build

# Preview built frontend
npm run preview

# Access Tauri CLI directly
npm run tauri <command>
```

## Core Features

- File browser and management (create, rename, delete, open folder)
- BlockNote WYSIWYG editor with rich text editing
- Markdown preview mode
- Multi-tab editing with tab management
- Auto-save functionality (2s debounce)
- Basic file search within current folder
- Theme switching (light/dark/auto)
- File watcher for external changes
- Essential keyboard shortcuts

## Architecture

### Frontend-Backend Communication

The app uses Tauri's invoke system for IPC:
```typescript
import { invoke } from '@tauri-apps/api/core';

const files = await invoke<MarkdownFile[]>('list_markdown_files', { 
  path: '/path/to/folder' 
});
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

### State Management Pattern

Each feature has a dedicated hook in `src/hooks/`:
- `useFileManager` - File operations and folder state
- `useTabManager` - Multi-file tab management with auto-save
- `useFileWatcher` - External file change detection
- `useSettings` - User preferences
- `useModalManager` - Centralized modal control
- `useGlobalSearch` - File search functionality
- `useErrorHandler` - Error handling with toasts
- `useKeyboardShortcuts` - Keyboard shortcut handling

### Component Architecture

```
src/
├── App.tsx              # Main application component
├── components/
│   ├── editor/          # BlockNote editor wrapper
│   ├── file-browser/    # File tree and operations
│   ├── tabs/            # Tab bar and management
│   ├── settings/        # Settings UI
│   ├── search/          # Global search components
│   └── ui/              # shadcn/ui base components
└── hooks/               # Business logic hooks
```

## Key Implementation Notes

### TypeScript Configuration
- **Strict mode disabled** (`tsconfig.json`)
- Path aliases configured for clean imports (`@/`)
- Unused variable/parameter checks disabled

### ESLint Configuration
- Uses `@typescript-eslint/recommended`
- React hooks rules enabled
- Allow underscore-prefixed unused parameters
- Console statements allowed

### BlockNote Editor Integration
- Uses `@blocknote/mantine` theme
- Custom styles in `blocknote-theme.css`
- Markdown conversion utilities for BlockNote blocks
- WYSIWYG-only (no source code view)

### File Size and Tab Limits
- Maximum file size: 10MB (hardcoded)
- Maximum open tabs: 10 (memory management)
- Auto-save delay: 2 seconds

### Error Handling Pattern
All operations use the `withErrorHandling` wrapper:
```typescript
const { withErrorHandling } = useErrorHandler();

const result = await withErrorHandling(
  async () => await invoke('command_name', args),
  'User-friendly error message'
);
```

### File Watcher Integration
- Uses notify crate with 500ms debounce
- Only monitors markdown files (.md, .markdown)
- Emits 'file-changed' events to frontend
- Non-recursive directory watching

### Search Implementation
- Basic text search (no advanced regex by default)
- Supports case sensitivity, whole word, file name search
- Results limited by `max_results` filter
- Returns context lines for matches


## Current Issues to Address

1. **TypeScript strict mode disabled** - Consider enabling for better type safety
2. **Unused @dnd-kit dependencies** - Remove from package.json and TabManager.tsx
3. **Empty services directory** - Either populate or remove `src/services/`
4. **10MB file size limit** - Consider making configurable
5. **Basic search only** - No regex support in UI despite backend capability

## Platform-Specific Notes

- File paths handled by Rust backend (cross-platform compatibility)
- Keyboard shortcuts adapt to platform (Cmd on macOS, Ctrl on Windows/Linux)
- Native file dialogs via Tauri's dialog plugin
- Settings stored in platform-specific app data directory


## Performance Considerations

- Components lazy-loaded for code splitting
- File list refresh debounced to prevent excessive updates
- Tab content saved with 2-second debounce
- Maximum 10 tabs to prevent memory issues
- File watcher uses debounced events (500ms)

