# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GTD Space** is a cross-platform desktop markdown editor built with Tauri. It combines a React 18 + TypeScript frontend with a Rust backend to create a local-first markdown editing experience.

**Current Status:**
- **Phase 1 MVP Complete**: Functional markdown editor with file management
- File browser with folder selection, file listing, and search
- Basic text editor with source/preview/split modes and auto-save
- Complete file operations (create, read, save, rename, delete)
- shadcn/ui component system with Tailwind CSS styling
- Working Tauri 2.x backend with comprehensive file management commands

**Key Technologies:**
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, shadcn/ui, Radix UI
- **Backend**: Rust, Tauri 2.x with fs and dialog plugins
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
- `App.tsx`: Main Phase 1 app with integrated file management, editor, and sidebar
- `hooks/useFileManager.ts`: Central state management for all file operations and auto-save
- `types/index.ts`: Complete TypeScript definitions for Phase 1 MVP

**Component Structure:**
- `components/file-browser/`: Complete file management UI
  - `FileBrowserSidebar.tsx`: Main sidebar integrating folder selection, search, and file list
  - `FolderSelector.tsx`: Folder selection with manual path input fallback
  - `FileList.tsx`: File listing with search, create, and operations
  - `FileItem.tsx`: Individual file items with context menus for rename/delete
  - `FileSearch.tsx`: Real-time file search and filtering
- `components/editor/`: Text editing functionality
  - `TextEditor.tsx`: Main editor with source/preview/split modes and toolbar
  - `MarkdownPreview.tsx`: React-markdown based preview component
- `components/ui/`: shadcn/ui components (Button, Dialog, Input, Card, etc.)

**Key Integration Points:**
- `useFileManager` hook centralizes all file state and operations
- `invoke()` calls for all Rust backend communication
- Absolute imports using `@/` prefix for clean module resolution

### Backend Architecture (`src-tauri/`)

**File Operations Core:**
- `commands/mod.rs`: Complete Phase 1 command handlers
  - File management: `select_folder`, `list_markdown_files`, `read_file`, `save_file`
  - File operations: `create_file`, `rename_file`, `delete_file`
  - System: `ping`, `get_app_version`, `check_permissions`
- `lib.rs`: Tauri app initialization with all Phase 1 commands registered
- All commands return `Result<T, String>` for consistent error handling

**Data Structures:**
- `MarkdownFile`: File metadata with id, name, path, size, last_modified
- `FileOperationResult`: Standardized result type for file operations
- `PermissionStatus`: System permission verification

### Communication Pattern

The app uses Tauri's `invoke()` system for frontend-backend communication:
- Frontend: `invoke<ReturnType>('command_name', { params })`
- Backend: `#[tauri::command]` annotated functions
- All commands return `Result<T, String>` for consistent error handling

### Phase-Based Development

**Completed:**
- **Phase 0**: Basic Tauri shell with working React frontend and Rust backend
- **Phase 1**: Complete MVP with file management, basic editing, auto-save, and file operations

**Next Phases:**
- **Phase 2**: Rich WYSIWYG editing with Tiptap, syntax highlighting, and advanced editor features
- **Phase 3**: Advanced features (global search, templates, settings persistence, system integration)

## Key Implementation Details

### Tauri Configuration
- **App ID**: `com.gtdspace.app`
- **Window**: 1200x800 default, 800x600 minimum, resizable
- **Plugins**: `tauri-plugin-fs` for file operations, `tauri-plugin-dialog` for system dialogs
- **Dev Tools**: Automatically opens in debug mode

### Frontend Features
- **File Management**: Complete folder selection, file listing, search, and CRUD operations
- **Editor Modes**: Source, preview, and split-view modes with mode switching toolbar
- **Auto-Save**: Debounced auto-save every 2 seconds with visual feedback
- **Theme System**: Dark/light mode toggle with system preference detection
- **Error Handling**: Comprehensive error states with user-friendly messages
- **shadcn/ui Integration**: Complete design system with Radix UI primitives

### Backend Capabilities
- **File System**: Read/write permissions checked via `check_permissions` command
- **Logging**: `env_logger` for development debugging
- **Error Types**: `thiserror` for structured error handling
- **Async Support**: `tokio` runtime for async operations

## Development Workflow

### Adding New Features
1. **Backend**: Add command handlers in `src-tauri/src/commands/mod.rs` and register in `lib.rs`
2. **Types**: Define TypeScript interfaces in `src/types/index.ts` for new data structures
3. **Frontend**: Import commands via `invoke()` from `@tauri-apps/api/core`
4. **State Management**: Extend `useFileManager` hook for complex state operations
5. **Components**: Follow shadcn/ui patterns for new UI components
6. **Testing**: Use `npm run tauri:dev` to test full-stack functionality

### Code Architecture Patterns
- **State Management**: `useFileManager` hook centralizes file operations and auto-save logic
- **Component Props**: All components extend `BaseComponentProps` with className and standard props
- **Error Handling**: All Tauri commands return `Result<T, String>` with user-friendly error messages
- **File Operations**: Use standardized `FileOperationResult` type for create/rename/delete operations
- **Auto-Save**: Debounced pattern with visual feedback via `autoSaveStatus` state

### Working with Phase 1 MVP
- **File Browser**: All file operations go through `FileBrowserSidebar` → `FileList` → `FileItem` hierarchy
- **Editor Integration**: `TextEditor` component handles three modes (source/preview/split) with toolbar
- **Manual Folder Selection**: `FolderSelector` includes fallback manual path input for Tauri dialog limitations
- **Search**: Real-time filtering implemented in `FileList` component with `useMemo` optimization

### Key Configuration Files
- `package.json`: Frontend dependencies and npm scripts
- `src-tauri/Cargo.toml`: Rust dependencies and Tauri plugins
- `src-tauri/tauri.conf.json`: Tauri app configuration and window settings
- `tailwind.config.js`: Tailwind CSS configuration
- `vite.config.ts`: Vite bundler configuration with Tauri integration and path aliases

## Important Implementation Details

### Known Limitations and Workarounds
- **Folder Selection**: Tauri 2.x dialog API has changed - current implementation includes manual path input fallback
- **File Watching**: No external file change detection - users must manually refresh
- **Syntax Highlighting**: Basic textarea editor, no advanced highlighting yet (planned for Phase 2)
- **Settings Persistence**: Not yet implemented (low priority Phase 1 feature)

### Auto-Save System
The auto-save implementation uses a debounced pattern in `useFileManager`:
- Triggers 2 seconds after user stops typing
- Visual feedback through `autoSaveStatus` state ('saving', 'saved', 'error')
- Prevents data loss without overwhelming the file system
- Status indicator in header shows save state to user

### File Operation Flow
All file operations follow this pattern:
1. User action in UI (FileList, FileItem components)
2. Operation request via `handleFileOperation` in `useFileManager`
3. Backend Rust command execution with error handling
4. State update and UI refresh
5. User feedback via notifications or visual state changes

### Phase Documentation
The `docs/phases/` directory contains detailed specifications for all development phases:
- Current implementation status tracked in `phase-1-mvp.md`
- Future features planned in subsequent phase documents
- Use these for understanding project roadmap and requirements