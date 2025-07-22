# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GTD Space** is a cross-platform desktop markdown editor built with Tauri. It combines a React 18 + TypeScript frontend with a Rust backend to create a local-first markdown editing experience.

**Current Status:**
- **Phase 2 Active**: Enhanced multi-file editing with tabbed interface
  - ✅ Tabbed interface with `TabManager` and `FileTab` components
  - ✅ Enhanced CodeMirror editor with `CodeMirrorEditor` and `EnhancedTextEditor`
  - ✅ File watcher service using Rust `notify` crate with real-time change detection
  - ✅ Advanced editor modes (source/preview/split) with toolbar controls
- **Phase 1 Complete**: Full MVP with file management and basic editing
- File browser with folder selection, file listing, and search
- Complete file operations (create, read, save, rename, delete)
- shadcn/ui component system with Tailwind CSS styling
- Working Tauri 2.x backend with comprehensive file management commands

**Key Technologies:**
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, shadcn/ui, Radix UI
- **Editor**: CodeMirror 6 with markdown language support and themes
- **Backend**: Rust, Tauri 2.x with fs, dialog, and store plugins  
- **Build System**: Vite for frontend, Cargo for backend

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
```

## Architecture & Structure

### Frontend Architecture (`src/`)

**Core Application:**
- `AppPhase2.tsx`: Current main app with tabbed interface (Phase 2)
- `main.tsx`: React application entry point using AppPhase2
- `hooks/useFileManager.ts`: Central state management for file operations and auto-save
- `hooks/useTabManager.ts`: Tab state management for multi-file editing
- `hooks/useFileWatcher.ts`: File system change detection
- `types/index.ts`: Complete TypeScript definitions for all phases

**Component Structure:**
- `components/tabs/`: Phase 2 tabbed interface
  - `TabManager.tsx`: Central tab management with keyboard shortcuts
  - `FileTab.tsx`: Individual tabs with close buttons and context menus
- `components/file-browser/`: Complete file management UI
  - `FileBrowserSidebar.tsx`: Main sidebar integrating folder selection, search, and file list
  - `FolderSelector.tsx`: Folder selection with manual path input fallback
  - `FileList.tsx`: File listing with search, create, and operations
  - `FileItem.tsx`: Individual file items with context menus for rename/delete
  - `FileSearch.tsx`: Real-time file search and filtering
- `components/editor/`: Enhanced text editing functionality
  - `EnhancedTextEditor.tsx`: Phase 2 main editor with preview modes
  - `CodeMirrorEditor.tsx`: Advanced CodeMirror integration with markdown support
  - `TextEditor.tsx`: Phase 1 basic editor (legacy)
  - `MarkdownPreview.tsx`: React-markdown based preview component
- `components/ui/`: shadcn/ui components (Button, Dialog, Input, Card, etc.)

**Key Integration Points:**
- `useFileManager` hook centralizes all file state and operations
- `invoke()` calls for all Rust backend communication
- Absolute imports using `@/` prefix for clean module resolution

### Backend Architecture (`src-tauri/`)

**File Operations Core:**
- `commands/mod.rs`: Complete command handlers for all phases
  - File management: `select_folder`, `list_markdown_files`, `read_file`, `save_file`
  - File operations: `create_file`, `rename_file`, `delete_file`
  - Settings: `load_settings`, `save_settings` with persistent storage
  - File watching: `start_file_watcher`, `stop_file_watcher` with `notify` crate
  - System: `ping`, `get_app_version`, `check_permissions`
- `lib.rs`: Tauri app initialization with all commands registered
- All commands return `Result<T, String>` for consistent error handling

**Data Structures:**
- `MarkdownFile`: File metadata with id, name, path, size, last_modified
- `FileOperationResult`: Standardized result type for file operations
- `PermissionStatus`: System permission verification
- `UserSettings`: Persistent user preferences structure
- `FileChangeEvent`: File system change notifications for file watcher

### Communication Pattern

The app uses Tauri's `invoke()` system for frontend-backend communication:
- Frontend: `invoke<ReturnType>('command_name', { params })`
- Backend: `#[tauri::command]` annotated functions
- All commands return `Result<T, String>` for consistent error handling

### Phase-Based Development

**Completed:**
- **Phase 0**: Basic Tauri shell with working React frontend and Rust backend
- **Phase 1**: Complete MVP with file management, basic editing, auto-save, and file operations

**Current Phase (Phase 2) - Enhanced UX & Workflow:**
- ✅ Tabbed interface for multiple open files with tab management
- ✅ Enhanced CodeMirror editor with markdown support and shortcuts
- ✅ File watcher service for real-time external change detection
- ✅ Advanced editor modes with improved preview synchronization
- ✅ Keyboard shortcuts for all major operations (Ctrl+Tab, Ctrl+W, etc.)
- 🔄 Advanced file operations (copy, move, batch operations) - planned
- 🔄 Global search across all files - planned

**Future Phases:**
- **Phase 3**: Advanced features (global search, templates, settings persistence, system integration)

## Key Implementation Details

### Tauri Configuration
- **App ID**: `com.gtdspace.app`
- **Window**: 1200x800 default, 800x600 minimum, resizable
- **Plugins**: `tauri-plugin-fs` for file operations, `tauri-plugin-dialog` for system dialogs, `tauri-plugin-store` for settings persistence
- **Dev Tools**: Automatically opens in debug mode

### Frontend Features
- **Multi-File Editing**: Tabbed interface supporting up to 10 open files with tab overflow
- **File Management**: Complete folder selection, file listing, search, and CRUD operations
- **Enhanced Editor**: CodeMirror 6 with markdown language support, syntax highlighting, and keyboard shortcuts
- **Editor Modes**: Source, preview, and split-view modes with synchronized scrolling
- **Auto-Save**: Debounced auto-save per tab with visual feedback and status indicators
- **File Watching**: Real-time detection of external file changes with reload prompts
- **Theme System**: Dark/light mode toggle with system preference detection
- **Keyboard Shortcuts**: Complete set including Ctrl+Tab navigation, Ctrl+W close, Ctrl+S save
- **Error Handling**: Comprehensive error states with user-friendly messages
- **shadcn/ui Integration**: Complete design system with Radix UI primitives

### Backend Capabilities
- **File System**: Read/write permissions checked via `check_permissions` command
- **File Watching**: `notify` crate with debounced events for external change detection
- **Settings Persistence**: `tauri-plugin-store` for user preferences storage
- **Logging**: `env_logger` for development debugging
- **Error Types**: `thiserror` for structured error handling
- **Async Support**: `tokio` runtime for async operations and file watcher tasks

## Development Workflow

### Adding New Features
1. **Backend**: Add command handlers in `src-tauri/src/commands/mod.rs` and register in `lib.rs`
2. **Types**: Define TypeScript interfaces in `src/types/index.ts` for new data structures
3. **Frontend**: Import commands via `invoke()` from `@tauri-apps/api/core`
4. **State Management**: Extend hooks (`useFileManager`, `useTabManager`, `useFileWatcher`) for state operations
5. **Components**: Follow shadcn/ui patterns and existing component structure
6. **Testing**: Use `npm run tauri:dev` to test full-stack functionality

### Code Architecture Patterns
- **State Management**: Multiple specialized hooks:
  - `useFileManager`: File operations and folder management
  - `useTabManager`: Multi-file tab state and operations
  - `useFileWatcher`: External file change detection
- **Component Props**: All components extend `BaseComponentProps` with className and standard props
- **Error Handling**: All Tauri commands return `Result<T, String>` with user-friendly error messages
- **File Operations**: Use standardized `FileOperationResult` type for create/rename/delete operations
- **Tab Management**: Tab-based auto-save with per-file unsaved change tracking

### Working with Phase 2 Enhanced UX
- **Current App**: `AppPhase2.tsx` is the active main component using tabbed interface
- **Tab Management**: `TabManager` component handles tab bar, overflow, and keyboard shortcuts
- **File Browser**: All file operations go through `FileBrowserSidebar` → `FileList` → `FileItem` hierarchy
- **Editor Integration**: `EnhancedTextEditor` with `CodeMirrorEditor` for improved markdown editing
- **File Watching**: External changes detected via `useFileWatcher` with automatic file list refresh
- **Keyboard Shortcuts**: Comprehensive shortcuts (Ctrl+Tab, Ctrl+W, Ctrl+S, Ctrl+Shift+S)
- **Manual Folder Selection**: `FolderSelector` includes fallback manual path input for Tauri dialog limitations
- **Search**: Real-time filtering implemented in `FileList` component with `useMemo` optimization

### Key Configuration Files
- `package.json`: Frontend dependencies and npm scripts
- `src-tauri/Cargo.toml`: Rust dependencies and Tauri plugins
- `src-tauri/tauri.conf.json`: Tauri app configuration and window settings
- `tailwind.config.js`: Tailwind CSS configuration
- `vite.config.ts`: Vite bundler configuration with Tauri integration and path aliases

## Important Implementation Details

### Known Limitations and Current Workarounds
- **Folder Selection**: Tauri 2.x dialog API has changed - current implementation includes manual path input fallback
- **File Watching Events**: Simplified event types (uses "changed" for all event types due to debouncer abstraction)
- **Tab Limit**: Hard limit of 10 tabs to prevent memory issues - oldest inactive tabs auto-close
- **Global Search**: Not yet implemented - only file name filtering available

### Tab-Based Auto-Save System
The auto-save implementation in Phase 2 uses per-tab tracking:
- Each tab maintains its own `hasUnsavedChanges` state
- Debounced auto-save triggers per tab content changes
- Visual feedback through tab indicators (orange dot for unsaved changes)
- Save all functionality for multiple tabs with unsaved changes
- Status indicators in header and status bar show save state

### File Operation Flow (Phase 2)
All file operations follow this enhanced pattern:
1. User action in UI (FileList, FileItem components, or tab interactions)
2. Operation request via `handleFileOperation` in `useFileManager` or `useTabManager`
3. Backend Rust command execution with error handling
4. State update in relevant hook (file manager, tab manager)
5. Tab synchronization (close tabs for deleted files, update tab names for renames)
6. File watcher events may trigger additional UI updates
7. User feedback via notifications, status indicators, or visual state changes

### Phase Documentation
The `docs/phases/` directory contains detailed specifications for all development phases:
- **Phase 1 Complete**: Basic MVP documented in `phase-1-mvp.md` 
- **Phase 2 Active**: Enhanced UX and tabbed interface from `phase-2-enhancement.md`
  - ✅ Tabbed file interface with TabManager and FileTab components
  - ✅ Enhanced CodeMirror editor with markdown support and shortcuts
  - ✅ File watching service with real-time change detection
  - 🔄 Advanced file operations (copy, move, batch operations) - planned
  - 🔄 Global search across all files - planned
- Use these documents for understanding current progress and upcoming features

## Current Dependencies

### Key Frontend Dependencies
- `@codemirror/*`: Advanced editor functionality with markdown support
- `@uiw/react-codemirror`: React integration for CodeMirror
- `@tauri-apps/api`: Tauri frontend integration
- `@radix-ui/*`: UI primitives for shadcn/ui components
- `react-markdown`: Markdown preview rendering

### Key Backend Dependencies  
- `tauri-plugin-fs`: File system operations
- `tauri-plugin-dialog`: System dialogs for folder selection
- `tauri-plugin-store`: Settings persistence
- `notify`: File system watching
- `notify-debouncer-mini`: Debounced file change events
- `tokio`: Async runtime for file operations