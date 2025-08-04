# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GTD Space** is a GTD-first productivity system with integrated markdown editing, built with Tauri, React, and TypeScript. The application implements David Allen's Getting Things Done methodology as its core experience, with markdown editing as a supporting capability.

**Key Technologies:**

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Editor**: BlockNote for WYSIWYG editing (with @blocknote/code-block for syntax highlighting)
- **State Management**: Custom hooks pattern (no Redux/MobX)
- **Backend**: Rust, Tauri 2.x with fs, dialog, and store plugins
- **File Watching**: notify crate with 500ms debounce
- **GTD Integration**: Built-in support for projects, actions, and structured spaces
- **DnD**: @dnd-kit for tab reordering

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
```

## Architecture Overview

### Frontend-Backend Communication Pattern

All backend operations use Tauri's invoke system with consistent error handling:

```typescript
import { invoke } from '@tauri-apps/api/core';
import { withErrorHandling } from '@/hooks/useErrorHandler';

const result = await withErrorHandling(
  async () => await invoke<ReturnType>('command_name', { param }),
  'User-friendly error message'
);
```

### Tauri Commands (`src-tauri/src/commands/mod.rs`)

**File Operations:**

- `select_folder`, `list_markdown_files`, `read_file`, `save_file`
- `create_file`, `rename_file`, `delete_file`, `copy_file`, `move_file`

**Search & Replace:**

- `search_files`, `replace_in_file`

**File Watching:**

- `start_file_watcher`, `stop_file_watcher`

**Settings & System:**

- `load_settings`, `save_settings`
- `ping`, `get_app_version`, `check_permissions`

**GTD Operations:**

- `initialize_gtd_space`, `create_gtd_project`, `create_gtd_action`
- `list_gtd_projects`

### State Management Architecture

Core hooks in `src/hooks/`:

- **`useFileManager`** - File operations and folder state
- **`useTabManager`** - Multi-file tabs with 2s auto-save debounce
- **`useFileWatcher`** - External change detection (500ms debounce)
- **`useSettings`** - Theme, font size, editor preferences
- **`useModalManager`** - Centralized modal state
- **`useErrorHandler`** - Error handling with toast notifications
- **`useKeyboardShortcuts`** - Platform-aware shortcuts
- **`useGTDSpace`** - GTD methodology integration
- **`useToast`** - Toast notifications (shadcn/ui based)

### Component Organization

1. **App.tsx** - Main orchestrator connecting all hooks
2. **GTDWorkspaceSidebar** - Projects, actions, and GTD navigation
3. **TabManager** - Multi-tab interface
4. **BlockNoteEditor** - WYSIWYG markdown editor

### Critical Patterns

**Event-Driven File Watching:**
Backend emits events via Tauri's event system. Frontend updates in `App.tsx`.

**Tab State Persistence:**
Tabs saved to localStorage with content and metadata. Auto-recovery on launch.

**Error Handling:**

```typescript
const { withErrorHandling } = useErrorHandler();
const result = await withErrorHandling(
  async () => await invoke('command', args),
  'User-friendly message'
);
```

## GTD Space Structure

When initialized, creates:

```
gtd-space/
├── .gtd.json           # Space metadata
├── projects/           # Active projects
├── habits/            # Daily/weekly routines
├── someday_maybe/     # Future ideas
├── cabinet/           # Reference materials
└── archive/           # Completed items
```

## Important Constraints

### Limits

- Maximum file size: 10MB
- Maximum open tabs: 10
- Auto-save delay: 2 seconds
- File watcher debounce: 500ms

### TypeScript Configuration

- **Strict mode is disabled** - check for null/undefined manually
- Path alias `@/` maps to `src/`
- No explicit return types required

### Platform Considerations

- File paths handled by Rust backend (cross-platform)
- Keyboard shortcuts adapt to platform (Cmd/Ctrl)
- Native file dialogs via tauri-plugin-dialog

## Common Development Tasks

### Adding a New Tauri Command

1. Add function in `src-tauri/src/commands/mod.rs`
2. Add TypeScript types in `src/types/index.ts`
3. Update relevant hook in `src/hooks/`
4. Always use `withErrorHandling` when invoking

### Modifying the Editor

- BlockNote config in `BlockNoteEditor.tsx`
- Theme overrides in `blocknote-theme.css`
- For extensions, install package and update editor config

### GTD Feature Development

- All GTD operations go through `useGTDSpace` hook
- **Rust backend**: Use snake_case for all parameters and data structures
- **TypeScript frontend**: Use camelCase for function parameters, snake_case for data structures that match backend
- Projects require README.md, actions are individual .md files
