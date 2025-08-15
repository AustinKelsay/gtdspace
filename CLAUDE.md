# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GTD Space is a GTD-first productivity system with integrated markdown editing, built with Tauri, React, and TypeScript. The application is architected around Getting Things Done methodology as the primary experience.

**Tech Stack:**
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui components
- **Editor**: BlockNote v0.35 with custom single/multiselect GTD blocks
- **Backend**: Rust with Tauri 2.x (fs, dialog, store plugins)
- **State**: Custom hooks pattern (no Redux/MobX)
- **File Watching**: notify crate with 500ms debounce
- **DnD**: @dnd-kit for tab reordering

## Development Commands

```bash
# Primary development workflow
npm run tauri:dev      # Full dev environment (frontend + backend)
npm run tauri:build    # Production build

# Code quality
npm run type-check     # TypeScript validation
npm run lint           # ESLint check
npm run lint:fix       # Auto-fix linting issues

# Rust backend (from src-tauri/)
cd src-tauri && cargo check   # Fast compilation check
cd src-tauri && cargo build   # Full compilation

# Frontend-only (limited - no file operations)
npm run dev

# Production preview
npm run preview        # Preview production build
```

## Architecture: Frontend-Backend Communication

All backend operations use Tauri's IPC with consistent error handling:

```typescript
import { invoke } from "@tauri-apps/api/core";
import { withErrorHandling } from "@/hooks/useErrorHandler";

// Pattern for all backend calls
const result = await withErrorHandling(
  async () => await invoke<ReturnType>("command_name", { param }),
  "User-friendly error message",
  "category" // optional
);
```

**Parameter Convention:**
- Frontend: `camelCase` (e.g., `spacePath`)
- Backend: `snake_case` (e.g., `space_path`)
- Tauri auto-converts during IPC

## Architecture: State Management via Custom Hooks

Each hook in `src/hooks/` encapsulates specific domain logic:

- **`useGTDSpace`** - GTD workspace, projects, actions, initialization
- **`useTabManager`** - Multi-file tabs, auto-save (2s debounce), persistence
- **`useFileWatcher`** - External change detection, conflict resolution
- **`useFileManager`** - File operations, folder state
- **`useSettings`** - User preferences via Tauri store
- **`useErrorHandler`** - Centralized error handling with toasts
- **`useKeyboardShortcuts`** - Platform-aware keyboard shortcuts
- **`useSingleSelectInsertion`** / **`useMultiSelectInsertion`** - GTD field insertion

## Architecture: GTD Implementation

### Default Behavior
1. On startup, derives default path: `~/GTD Space` (platform-specific)
2. Auto-initializes if not a GTD space (creates folders, seeds examples)
3. Loads workspace automatically (no folder dialog)

### Directory Structure
```
gtd-space/
├── Projects/          # Active projects (folders with README.md + actions)
├── Habits/           # Recurring routines
├── Someday Maybe/    # Future ideas
└── Cabinet/          # Reference materials
```

### Data Models
```typescript
// Projects: Folders with README.md containing metadata
interface GTDProject {
  name: string;
  description: string;
  due_date?: string | null;  // snake_case for Rust compatibility
  status: GTDProjectStatus[]; // Array for compatibility
  created_date: string;
  action_count?: number;
}

// Actions: Individual .md files within project folders
interface GTDAction {
  name: string;
  status: GTDActionStatus;  // in-progress | waiting | complete
  focus_date?: string | null;  // When to work on (datetime)
  due_date?: string | null;    // Deadline (date only)
  effort: string;  // small | medium | large | extra-large
}

// Habits: Recurring routines with automatic tracking
interface GTDHabit {
  name: string;
  frequency: 'daily' | 'every-other-day' | 'twice-weekly' | 'weekly' | 'biweekly' | 'monthly';
  status: 'todo' | 'complete';  // Resets automatically based on frequency
  history: HabitRecord[];  // Self-contained tracking history
}

interface HabitRecord {
  date: string;  // YYYY-MM-DD HH:MM format
  status: 'todo' | 'complete';
  action: 'created' | 'changed' | 'auto-reset';
}
```

## Architecture: BlockNote Editor Customizations

### Custom GTD Blocks

**Single Select Fields** (Status, Effort):
```markdown
[!singleselect:status:in-progress]
[!singleselect:effort:medium]
[!singleselect:project-status:waiting]
```

**Multi Select Fields** (Tags, legacy support):
```markdown
[!multiselect:tags:urgent,important]
```

### Content Processing Pipeline
1. **Load**: Markdown → `preprocessMarkdownForBlockNote()` → `postProcessBlockNoteBlocks()` → Interactive blocks
2. **Save**: BlockNote blocks → `toExternalHTML()` → Markdown with field markers
3. **Theme**: DOM class mutation observer for light/dark switching

### Keyboard Shortcuts
- **Single Select**: `Cmd/Ctrl+Alt+S` (Status), `+E` (Effort), `+P` (Project Status), `+F` (Habit Frequency), `+H` (Habit Status)
- **Multi Select**: `Cmd/Ctrl+Shift+S/E/P` (legacy)

## Critical Patterns & Constraints

### File Operations
- All operations go through `useFileManager` hook
- Max file size: 10MB
- Max open tabs: 10
- Auto-save: 2s debounce
- File watcher: 500ms debounce

### Storage Patterns
- **localStorage keys**: Consistent `gtdspace-*` prefix
  - `gtdspace-sidebar-width` - UI state
  - `gtdspace-tabs` - Tab persistence
  - `gtdspace-search-history` - Search history
  - `gtdspace-saved-searches` - Saved queries
- **Tauri Store**: User settings and preferences

### Event-Driven Updates
- Rust backend emits file change events
- Frontend receives via Tauri event system
- `App.tsx` orchestrates responses
- Tab conflicts trigger user prompts
- Content Event Bus (`src/utils/content-event-bus.ts`) manages metadata updates
- Custom events for project/action/section file renames
- Recursive emission prevention with `isEmitting` flag

### TypeScript Configuration
- **Strict mode disabled** - careful with null checks
- Path alias `@/` → `src/`
- Unused vars allowed with `_` prefix

### ESLint Configuration
- React Refresh plugin for HMR validation
- TypeScript rules with `_` prefix for unused args
- React hooks exhaustive deps as warning
- Console statements allowed (no-console: off)

### Vite Configuration
- Dev port: 1420 (strict)
- Build targets: Chrome 105 (Windows), Safari 13 (others)  
- Source maps in debug builds
- Environment variables: `VITE_*` prefix for frontend access

### Tailwind Extensions
- Custom breakpoints: `editor-sm`, `editor-md`, `editor-lg`, `editor-xl`
- Sidebar widths: `sidebar: '280px'`, `sidebar-collapsed: '48px'`
- Editor colors: `editor-bg`, `editor-border`, `editor-text`
- Typography customizations for markdown rendering
- Animation: Shimmer effects for loading states

### Security
- Whitelisted Tauri commands only
- File ops restricted to user-selected directories
- Path validation in Rust backend

## Tauri Backend Commands

**File Operations:**
`read_file`, `save_file`, `create_file`, `delete_file`, `rename_file`, `copy_file`, `move_file`, `list_markdown_files`

**GTD Operations:**
`initialize_gtd_space`, `create_gtd_project`, `create_gtd_action`, `create_gtd_habit`, `update_habit_status`, `check_and_reset_habits`, `list_gtd_projects`, `seed_example_gtd_content`, `rename_gtd_project`, `rename_gtd_action`, `list_project_actions`

**System:**
`select_folder`, `check_permissions`, `get_app_version`, `get_default_gtd_space_path`, `open_folder_in_explorer`, `check_directory_exists`, `create_directory`, `initialize_default_gtd_space`

**File Watching:**
`start_file_watcher`, `stop_file_watcher`

**Search:**
`search_files`, `replace_in_file`

**Settings:**
`load_settings`, `save_settings`

## Recent Architecture Decisions (Jan 2025)

- **GTD-First**: GTD is the default mode, not optional
- **Single Select**: Status/Effort fields use single select for cleaner UX
- **Smart Detection**: Subdirectory detection prevents re-initialization
- **IPC Fix**: Rust commands are synchronous for Tauri 2.0 compatibility
- **Recursive Scanning**: `list_markdown_files` scans project subdirectories
- **Focus vs Due Dates**: Actions support both work timing and deadlines
- **Toast Deduplication**: Prevents double notifications in React StrictMode
- **Bidirectional Title Sync**: Document titles auto-rename files/folders when saved
- **Content Event Bus**: Centralized event system for metadata updates with infinite loop prevention
- **Parallel Loading**: Action statuses load in parallel for better performance
- **Tab Path Updates**: Tabs automatically update paths when files/folders are renamed
- **Create Page Dialog**: Generic page creation for Someday Maybe and Cabinet sections
- **Habits Implementation**: Full habit tracking with frequency/status dropdowns and keyboard shortcuts (Cmd/Ctrl+Alt+F/H)
- **Optimistic Updates**: Sidebar immediately adds new habits to state before confirming with backend
- **Background Sync**: Loads actual files from disk after 500ms to correct any discrepancies
- **Force Re-render**: Uses sectionRefreshKey to force component re-mount when needed
- **Habit Tracking System**: Habits have 'todo'/'complete' status that auto-resets based on frequency
- **Habit History**: Each habit file contains self-documenting history of all status changes
- **Automatic Reset Scheduler**: Runs at 00:01 daily to reset habits based on their frequency
- **Catch-up Reset on Startup**: App checks for missed resets when starting, ensuring habits are always current
- **Backend Status Updates**: Habit status changes trigger `update_habit_status` command to record history
- **Smart Reset Logic**: Only resets habits marked 'complete' that have passed their frequency interval

## Key Dependencies

### Frontend
- **BlockNote v0.35**: Rich markdown editor (pinned version for stability)
- **Radix UI**: 13+ primitive components for accessible UI
- **@dnd-kit**: Drag-and-drop for tab reordering
- **Syntax Highlighting**: Both `shiki` and `highlight.js` for code blocks
- **react-hotkeys-hook**: Keyboard shortcut management
- **lodash.debounce**: Performance optimization

### Backend (Rust)
- **notify + notify-debouncer-mini**: File system watching
- **chrono**: Date/time handling
- **tokio**: Async runtime with full features
- **thiserror**: Structured error types
- **regex**: Text processing

## Testing Status

**No test suite exists.** Manual testing required for all changes. Test component available at `src/components/test/TestMultiSelect.tsx` for UI experimentation.