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
npm run dev            # Port 1420, no backend

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

**Tauri Context Detection:**
- Use `isTauriContext()` from `@/utils/tauri-ready` to check if running in Tauri
- Fallback dialog handling for web-only development
- Prevents runtime errors when testing without backend

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
- **`useReferencesInsertion`** - References block insertion for Cabinet/Someday links
- **`useHorizonReferencesInsertion`** - Hierarchical GTD horizon references
- **`useHorizonListInsertion`** - Dynamic horizon list blocks
- **`useDateTimeInsertion`** - DateTime field insertion with calendar UI
- **`useHabitTracking`** - Habit-specific operations and state management
- **`useCalendarData`** - Aggregates all dated items across workspace with performance optimization

## Architecture: GTD Implementation

### Default Behavior
1. On startup, derives default path: `~/GTD Space` (platform-specific)
2. Auto-initializes if not a GTD space (creates folders, seeds examples)
3. Loads workspace automatically (no folder dialog)
4. Runs habit reset scheduler every minute at :01 seconds
5. Catches up on missed habit resets when app starts

### Directory Structure
```
gtd-space/
├── Purpose & Principles/  # Core values and life mission (50,000 ft)
├── Vision/               # 3-5 year aspirations (40,000 ft)
├── Goals/                # 1-2 year objectives (30,000 ft)
├── Areas of Focus/       # Ongoing responsibilities (20,000 ft)
├── Projects/             # Active projects (folders with README.md + actions)
├── Habits/               # Recurring routines with automatic tracking
├── Someday Maybe/        # Future ideas
└── Cabinet/              # Reference materials
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
  frequency: 'daily' | 'every-other-day' | 'twice-weekly' | 'weekly' | 'weekdays' | 'biweekly' | 'monthly';
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

**Checkbox Fields** (Habit Status):
```markdown
[!checkbox:habit-status:false]  # Todo state
[!checkbox:habit-status:true]   # Complete state
```

**Single Select Fields** (Status, Effort):
```markdown
[!singleselect:status:in-progress]
[!singleselect:effort:medium]
[!singleselect:project-status:waiting]
[!singleselect:habit-frequency:daily]
```

**Multi Select Fields** (Tags, legacy support):
```markdown
[!multiselect:tags:urgent,important]
```

**DateTime Fields** (Dates and Times):
```markdown
[!datetime:due_date:2025-01-20]  # Date only
[!datetime:focus_date_time:2025-01-20T14:30:00]  # Date with time
[!datetime:created_date_time:2025-01-17T10:00:00Z]  # ISO 8601 with timezone
```

**References Block** (Cabinet & Someday Maybe links):
```markdown
[!references:path1.md,path2.md]  # Links to Cabinet/Someday pages
```

**Horizon References Blocks** (Hierarchical GTD references):
```markdown
[!areas-references:path1.md,path2.md]  # Links to Areas of Focus
[!goals-references:path1.md,path2.md]  # Links to Goals
[!vision-references:path1.md,path2.md]  # Links to Vision
[!purpose-references:path1.md,path2.md]  # Links to Purpose & Principles
```

**Horizon List Blocks** (Dynamic downward-looking lists):
```markdown
[!projects-list]  # Lists all projects that reference this page
[!areas-list]  # Lists all areas that reference this page
[!goals-list]  # Lists all goals that reference this page
[!visions-list]  # Lists all visions that reference this page
[!projects-areas-list]  # Combined list of projects and areas
[!goals-areas-list]  # Combined list of goals and areas
[!visions-goals-list]  # Combined list of visions and goals
```

### Content Processing Pipeline
1. **Load**: Markdown → `preprocessMarkdownForBlockNote()` → `postProcessBlockNoteBlocks()` → Interactive blocks
2. **Save**: BlockNote blocks → `toExternalHTML()` → Markdown with field markers
3. **Theme**: DOM class mutation observer for light/dark switching
4. **Metadata Extraction**: `metadata-extractor.ts` parses GTD fields with regex
5. **Live Updates**: Content changes trigger event bus for real-time UI sync

### Keyboard Shortcuts
- **Single Select**: `Cmd/Ctrl+Alt+S` (Status), `+E` (Effort), `+P` (Project Status), `+F` (Habit Frequency), `+H` (Habit Status)
- **DateTime**: `Cmd/Ctrl+Alt+D` (Due Date), `+T` (Focus DateTime), `+C` (Created Date)
- **References**: `Cmd/Ctrl+Alt+R` (Insert References block)
- **Horizon References**: `Cmd/Ctrl+Alt+A` (Areas), `+G` (Goals), `+V` (Vision), `+U` (Purpose)
- **Multi Select**: `Cmd/Ctrl+Shift+S/E/P` (legacy)
- **Lists**: Available via slash commands in the editor (e.g., `/projects-list`)

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
  - `gtdspace-current-path` - Active workspace
  - `blocknote-current-file` - Editor context
- **Tauri Store**: User settings and preferences

### Event-Driven Architecture
- **File Change Events**: Rust backend emits, frontend receives via Tauri
- **Content Event Bus** (`src/utils/content-event-bus.ts`): Centralized metadata updates
- **Custom Window Events**: Cross-component communication
  - `gtd-project-created` - Dispatched when project created (useGTDSpace.ts:182)
  - `gtd-action-created` - Dispatched when action created
  - `gtd-habit-updated` - Dispatched when habit status changes
  - `file-renamed` - Dispatched when file/folder renamed
- **Tab Conflicts**: External changes trigger user prompts for resolution
- **Recursive Prevention**: `isEmitting` flag prevents infinite loops
- **Real-Time Sync**: Live UI updates as content changes in editor

### Calendar System Performance
- **View-Window Optimization**: Only generates dates within current view
- **Pre-compiled Regex**: Cached patterns for metadata extraction
- **Parallel File Reading**: Concurrent operations for data aggregation
- **Smart Habit Scheduling**: Generates recurring dates on-demand

### Google Calendar Integration Details
- **OAuth2 Authentication**: Secure token-based authentication with refresh support
- **Local Token Storage**: Tokens stored in Tauri app data directory (`google_calendar_tokens.json`)
- **Event Caching**: Calendar events cached locally for offline access
- **Sync Status Tracking**: Real-time sync status with last sync timestamp
- **Automatic Token Refresh**: Handles expired tokens transparently
- **Event Filtering**: Only retrieves events within current calendar view window
- **OAuth Redirect URI**: `http://localhost:9898/callback`

### TypeScript Configuration
- **Strict mode disabled** - careful with null checks
- Path alias `@/` → `src/`
- Unused vars allowed with `_` prefix

### ESLint Configuration
- React Refresh plugin for HMR validation
- TypeScript rules with `_` prefix for unused args
- React hooks exhaustive deps as warning
- Console statements allowed (no-console: off)
- Max warnings: 0 (strict mode for CI/CD)

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
`read_file`, `save_file`, `create_file`, `delete_file`, `delete_folder`, `rename_file`, `copy_file`, `move_file`, `list_markdown_files`

**GTD Operations:**
`initialize_gtd_space`, `create_gtd_project`, `create_gtd_action`, `create_gtd_habit`, `update_habit_status`, `check_and_reset_habits`, `list_gtd_projects`, `seed_example_gtd_content`, `rename_gtd_project`, `rename_gtd_action`, `list_project_actions`, `find_reverse_relationships`

**System:**
`select_folder`, `check_permissions`, `get_app_version`, `get_default_gtd_space_path`, `open_folder_in_explorer`, `open_file_location`, `check_directory_exists`, `create_directory`, `initialize_default_gtd_space`

**File Watching:**
`start_file_watcher`, `stop_file_watcher`

**Search:**
`search_files`, `replace_in_file`

**Settings:**
`load_settings`, `save_settings`

**Google Calendar:**
`google_calendar_connect`, `google_calendar_disconnect_simple`, `google_calendar_sync`, `google_calendar_get_status`, `google_calendar_get_cached_events`, `google_calendar_is_authenticated`, `google_calendar_fetch_events`

## Known Issues & Troubleshooting

### Sidebar Not Updating After Project Creation
**Problem**: When creating a new project, the sidebar doesn't immediately show the new project.

**Root Cause**: The project creation flow relies on custom events:
1. `useGTDSpace.createProject()` dispatches `gtd-project-created` event (line 182)
2. `GTDWorkspaceSidebar` listens for this event (line 770) and calls `loadProjects()`
3. Issue may be timing/race condition or event listener not properly attached

**Debug Steps**:
1. Check browser console for:
   - `[GTDProjectDialog] Calling onSuccess callback` 
   - `[Sidebar] Project created event received`
   - `[Sidebar] Reloading projects from event`
2. Verify `gtdSpace.root_path` is set when event fires
3. Check if manual `loadProjects()` call works in console

**Workaround**: Manually refresh the sidebar by collapsing and expanding the Projects section.

### Google Calendar Authentication Issues
**Problem**: OAuth flow fails or tokens expire unexpectedly.

**Debug Steps**:
1. Check `.env` file has valid `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
2. Verify OAuth redirect URI matches Google Console: `http://localhost:9898/callback`
3. Check Tauri app data directory for `google_calendar_tokens.json`
4. Look for OAuth server errors in console (port 9898 conflicts)

**Workaround**: Disconnect and reconnect Google Calendar in Settings > Google Calendar.

## Recent Architecture Decisions (Jan 2025)

### Core GTD Features
- **GTD-First**: GTD is the default mode, not optional
- **Complete Horizons**: All GTD levels as dedicated folders (runway to 50,000 ft)
- **Single Select**: Status/Effort fields use single select for cleaner UX
- **Focus vs Due Dates**: Actions support both work timing and deadlines
- **Smart Detection**: Subdirectory detection prevents re-initialization
- **Bidirectional Title Sync**: Document titles auto-rename files/folders when saved

### Horizons of Focus Implementation
- **Four Horizon Levels as Folders**: Each horizon is a top-level folder containing individual pages
  - **Purpose & Principles** (50,000 ft) - Life Mission and Core Values documents
  - **Vision** (40,000 ft) - 3-5 Year Vision document
  - **Goals** (30,000 ft) - Individual goal pages with milestones and success criteria
  - **Areas of Focus** (20,000 ft) - Individual area pages with projects and metrics
- **Template-Based**: Each folder has a README overview and example pages
- **Sidebar Integration**: Horizon folders appear in altitude order (highest to lowest) above Projects
- **Auto-Seeding**: Horizon folders created with example content on initialization
- **Bidirectional References**: Projects can reference Areas/Goals, Areas can reference Goals/Vision/Purpose
- **Dynamic Lists**: Pages show items from lower horizons that reference them

### Habit System
- **Habit Tracking System**: Habits have 'todo'/'complete' status that auto-resets based on frequency
- **Habit History**: Each habit file contains self-documenting history of all status changes
- **Automatic Reset Scheduler**: Runs every minute at :01 seconds to reset habits
- **Catch-up Reset on Startup**: App checks for missed resets when starting
- **Checkbox UI for Habits**: Habit status uses checkbox instead of dropdown
- **Weekdays Frequency**: Added Monday-Friday option for business day habits
- **Backfill Support**: Automatically backfills missed habit periods when app was offline

### Calendar View
- **Calendar Integration**: Full calendar view aggregating all dated items
- **Performance Optimized**: Pre-compiled regex patterns and parallel file reading
- **Multi-Source Data**: Combines project due dates, action focus dates, habit schedules, and Google Calendar events
- **View-Window Generation**: Only generates dates within current view for performance
- **Week View**: Time-based scheduling with current time indicator
- **Month View**: Date-based overview with item counts
- **Google Calendar Sync**: OAuth2-based integration with calendar sync capabilities

### UI/UX Improvements
- **DateTime Fields**: Beautiful calendar/time picker components using shadcn/ui
- **12-Hour Time Format**: All times display in 12-hour format with AM/PM
- **Field-Specific Colors**: Due dates (orange/red), focus dates (blue), completed (green)
- **Toast Deduplication**: Prevents double notifications in React StrictMode
- **Visual Animations**: Subtle green highlight when habit file updates
- **Optimistic Updates**: UI updates immediately, then syncs with disk
- **Sidebar Highlighting**: Active files highlighted in sidebar for better navigation
- **Options Menu**: Three-dot menu in sidebar for delete and other file operations
- **References System**: Interactive UI for linking Cabinet and Someday Maybe pages to actions/projects
- **Horizon References**: Hierarchical reference system linking projects to areas/goals, areas to goals/vision/purpose, etc.
- **Horizon Lists**: Dynamic lists showing items from lower horizons that reference the current page
- **Settings Organization**: Modular settings panels (GTD, Appearance, Advanced, About, Google Calendar)

### Technical Improvements
- **IPC Fix**: Rust commands are synchronous for Tauri 2.0 compatibility
- **Content Event Bus**: Centralized event system with infinite loop prevention
- **Parallel Loading**: Action statuses load in parallel for better performance
- **Tab Path Updates**: Tabs automatically update paths when files/folders are renamed
- **Recursive Scanning**: `list_markdown_files` scans project subdirectories
- **ISO 8601 Support**: Full datetime storage with timezone support
- **Reverse Relationship Queries**: Efficient backend support for hierarchy traversal

## Key Dependencies

### Frontend
- **BlockNote v0.35**: Rich markdown editor (pinned version for stability)
- **Radix UI**: 13+ primitive components for accessible UI
- **@dnd-kit**: Drag-and-drop for tab reordering
- **Syntax Highlighting**: Both `shiki` and `highlight.js` for code blocks
- **react-hotkeys-hook**: Keyboard shortcut management
- **lodash.debounce**: Performance optimization
- **react-day-picker v9.8**: Calendar component for date selection
- **date-fns v4.1**: Date manipulation and formatting
- **lucide-react**: Modern icon library

### Backend (Rust)
- **notify + notify-debouncer-mini**: File system watching
- **chrono**: Date/time handling
- **tokio**: Async runtime with full features
- **thiserror**: Structured error types
- **regex**: Text processing
- **google-calendar3**: Google Calendar API client
- **oauth2**: OAuth authentication flow
- **hyper + warp**: HTTP server for OAuth callback

## Important Multi-File Patterns

### State Flow Patterns
1. **Content Changes**: Editor → useTabManager → content-event-bus → GTDWorkspaceSidebar
2. **File Operations**: UI → Tauri commands → File system → File watcher → UI updates  
3. **GTD Operations**: Forms → useGTDSpace → Rust backend → State refresh
4. **Habit Updates**: Checkbox → useHabitTracking → update_habit_status → File content
5. **Calendar Data**: useCalendarData → Parallel file reads → Aggregated view
6. **Google Calendar Sync**: Settings UI → OAuth flow → Token storage → API sync
7. **Project Creation Flow**:
   - GTDProjectDialog → useGTDSpace.createProject()
   - createProject() → invoke('create_gtd_project') → Updates local state
   - createProject() → dispatch('gtd-project-created') event
   - GTDWorkspaceSidebar listens → loadProjects() → UI updates

### Critical File Dependencies
- **App.tsx** orchestrates all major hooks and components
- **useTabManager** depends on content-event-bus for metadata updates
- **GTDWorkspaceSidebar** requires useGTDSpace and content event subscriptions
- **BlockNote Editor** integrates with custom blocks and preprocessing utilities
- **Calendar View** aggregates data from all GTD sections and Google Calendar in parallel
- **ReferencesBlock** provides Cabinet/Someday linking with dialog-based selection
- **HorizonReferencesBlock** provides hierarchical GTD horizon linking
- **HorizonListBlock** provides dynamic lists of items that reference the current page
- **Settings Components** modular panels for different configuration areas
- **Google Calendar Integration** OAuth server, token management, and calendar sync

## Testing Status

**No test suite exists.** Manual testing required for all changes. Test component available at `src/components/test/TestMultiSelect.tsx` for UI experimentation.

## VSCode Configuration

- **Format on Save**: Enabled with Prettier as default formatter
- **ESLint Auto-fix**: Enabled on save
- **Rust Analyzer**: Uses clippy for linting
- **Import Preferences**: Relative paths for TypeScript imports

## Environment Variables

```bash
# Google Calendar OAuth2 Configuration (.env file in project root)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

- Frontend accesses environment variables via `import.meta.env.VITE_*` pattern
- Backend loads `.env` file via `dotenv` crate at startup
- OAuth redirect URI must match Google Console configuration: `http://localhost:9898/callback`
- Tokens are stored locally, never in version control

## Version Management & Release Process

The project includes automated version management scripts:

```bash
# Bump version numbers across package.json, Cargo.toml, and tauri.conf.json
npm run version:patch   # Patch version (0.1.0 → 0.1.1)
npm run version:minor   # Minor version (0.1.0 → 0.2.0)
npm run version:major   # Major version (0.1.0 → 1.0.0)

# Full release process with validation
npm run release:patch   # Complete patch release
npm run release:minor   # Complete minor release
npm run release:major   # Complete major release
```

### Automated Release Workflow

This repository contains a GitHub Actions workflow to automate the release process, located at `.github/workflows/release.yml`. This workflow is designed to be triggered manually, providing a safe and consistent way to create new releases.

**Workflow Trigger:**

The workflow is triggered manually via `workflow_dispatch`. To run it:
1.  Navigate to the "Actions" tab of the repository on GitHub.
2.  Select the "Release" workflow from the list.
3.  Click the "Run workflow" button.
4.  Choose the type of release (`patch`, `minor`, or `major`) from the dropdown menu.

**Required Secrets:**

The workflow uses the standard `GITHUB_TOKEN` to commit, tag, and push changes. No additional secrets are required.

**Expected Behavior:**

When triggered, the workflow will:
1.  Check out the `main` branch.
2.  Install all dependencies.
3.  Run a series of checks (linting, type-checking, tests).
4.  Bump the version number in `package.json`, `Cargo.toml`, and `tauri.conf.json`.
5.  Create a version commit (e.g., `chore: bump version to v0.1.1`).
6.  Create an annotated tag for the new version (e.g., `v0.1.1`).
7.  Push the commit and tag to the `main` branch.

This push will, in turn, trigger the `Build and Release` workflow (`.github/workflows/build.yml`), which builds the application for all platforms and attaches the artifacts to a new GitHub Release.

**Icon Generation Pipeline:**
```bash
npm run icons:generate  # Auto-generates all platform icons from icon.png
# Runs: Node/JS script → Tauri CLI → Multiple format outputs
```

## Development Best Practices

### Performance Considerations
- **Parallel Operations**: File reads and metadata extraction run concurrently
- **Debounced Operations**: Auto-save (2s), file watcher (500ms), habit reset scheduler (1min intervals)
- **View-Window Optimization**: Calendar only generates dates in current view
- **Regex Pre-compilation**: Metadata patterns cached for performance

### Error Handling Patterns
- **Centralized Error Handling**: All Tauri commands wrapped with `withErrorHandling()`
- **Toast Deduplication**: Prevents double notifications in React StrictMode
- **Graceful Degradation**: Web-only fallbacks when Tauri context unavailable
- **Recursive Event Prevention**: `isEmitting` flags prevent infinite loops

### File System Patterns
- **Path Validation**: All file operations validated on Rust backend
- **Atomic Operations**: Multi-step file operations are transactional
- **External Change Detection**: File watcher monitors for external edits
- **Conflict Resolution**: User prompts when external changes conflict with unsaved edits