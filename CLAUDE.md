# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

**Start Development:** `npm run tauri:dev`  
**Run Tests Before Commit:** `npm run type-check && npm run lint` (also run `cargo check && cargo clippy` in src-tauri/)  
**Build Production:** `npm run tauri:build`  
**Main Entry Points:** `src/App.tsx` (frontend), `src-tauri/src/lib.rs` (backend setup)  
**GTD Logic:** `src/hooks/useGTDSpace.ts`, `src-tauri/src/commands/mod.rs`

## Essential Commands

```bash
# Development
npm run tauri:dev      # Full dev environment (frontend + backend with hot reload)
npm run dev            # Frontend only on port 1420 (limited - no file operations)

# Code Quality - ALWAYS RUN BEFORE COMMITTING
npm run type-check     # TypeScript validation (strict: false)
npm run lint           # ESLint check (max-warnings: 0 - CI will fail on warnings)
npm run lint:fix       # Auto-fix linting issues

# Rust backend checks (run from src-tauri/)
cd src-tauri && cargo check   # Fast compilation check
cd src-tauri && cargo clippy  # Rust linting (CI enforces -D warnings)
cd src-tauri && cargo fmt     # Format Rust code (CI enforces --check)

# Building & Release
npm run tauri:build    # Production build
npm run release:patch  # Full release process with safety checks (0.1.0 → 0.1.1)
npm run release:minor  # Minor release (0.1.0 → 0.2.0)
npm run release:major  # Major release (0.1.0 → 1.0.0)
npm run icons:generate # Icon generation (automated in build)
```

## Prerequisites

- **Node.js**: v20+ required
- **Rust**: Latest stable toolchain
- **Platform-specific**: See `docs/build-setup.md`

## High-Level Architecture

### Tech Stack

- **Frontend**: React 18 + TypeScript (strict: false) + Vite + Tailwind CSS + shadcn/ui
- **Editor**: BlockNote v0.35 (pinned) with custom GTD blocks
- **Backend**: Rust + Tauri 2.x
- **State Management**: Custom hooks pattern (no Redux/Zustand)
- **File Watching**: Rust notify crate (500ms debounce)
- **Async Runtime**: Tokio for backend operations

### Frontend-Backend Communication

All Tauri commands follow this pattern:

```typescript
import { invoke } from "@tauri-apps/api/core";
import { withErrorHandling } from "@/hooks/useErrorHandler";

const result = await withErrorHandling(
  async () => await invoke<ReturnType>("command_name", { param }),
  "User-friendly error message"
);
```

**Important:** Frontend uses `camelCase`, backend expects `snake_case` - Tauri auto-converts.

### GTD Directory Structure

The app auto-creates and manages this structure at `~/GTD Space`:

```
gtd-space/
├── Purpose & Principles/  # 50,000 ft - Life mission
├── Vision/               # 40,000 ft - 3-5 year view
├── Goals/                # 30,000 ft - 1-2 year objectives
├── Areas of Focus/       # 20,000 ft - Ongoing responsibilities
├── Projects/             # 10,000 ft - Multi-step outcomes (folders with README.md)
│   └── [Project]/
│       ├── README.md     # Project metadata
│       └── *.md          # Individual actions
├── Habits/               # Recurring routines with auto-reset
├── Someday Maybe/        # Future possibilities
└── Cabinet/              # Reference materials
```

### Custom BlockNote Fields

The editor uses these custom markdown markers:

```markdown
# Single Select
[!singleselect:status:in-progress] # Action status: in-progress|waiting|completed
[!singleselect:effort:medium] # Effort: small|medium|large|extra-large
[!singleselect:project-status:waiting] # Project status
[!singleselect:habit-frequency:daily] # Habit frequency

# DateTime
[!datetime:due_date:2025-01-20] # Date only
[!datetime:focus_date:2025-01-20T14:30:00] # Date with time
[!datetime:created_date_time:2025-01-17T10:00:00Z] # ISO 8601

# References & Lists
[!references:path1.md,path2.md] # Links to Cabinet/Someday
[!areas-references:path1.md] # Links to Areas
[!projects-list] # Dynamic list of referencing projects

# Checkbox (Habits)
[!checkbox:habit-status:false] # Todo/complete state
```

### Critical Event Flow

1. **Project Creation**:
   - `useGTDSpace.createProject()` → `invoke('create_gtd_project')` → dispatches `gtd-project-created` event
   - `GTDWorkspaceSidebar` listens for event → reloads projects

2. **Content Updates**:
   - Editor change → `useTabManager` → `content-event-bus` → UI components update

3. **File Operations**:
   - UI action → Tauri command → File system → File watcher (500ms) → UI refresh

4. **Data Migration**:
   - Files are migrated in-memory only during reads (not auto-saved)
   - `needsMigration()` checks for old field formats
   - `migrateMarkdownContent()` updates to current format

### Performance Patterns

- **Parallel Operations**: File reads run concurrently in `useCalendarData`
- **Debouncing**: Auto-save (2s), file watcher (500ms), habit scheduler (1min)
- **Calendar Optimization**: Only generates dates in current view window
- **Regex Caching**: Metadata patterns pre-compiled for performance

### State Management Hooks

Key hooks and their responsibilities:

- `useGTDSpace` - Workspace initialization, project/action CRUD operations
- `useTabManager` - Multi-tab editing with manual save and debounced metadata emission (2s debounce)
- `useFileManager` - File system operations via Tauri
- `useFileWatcher` - External change detection (500ms debounce)
- `useCalendarData` - Aggregates all dated items (parallel reads)
- `useHabitTracking` - Habit status updates and reset scheduling
- `useErrorHandler` - Centralized error handling with toast notifications

### Google Calendar Integration

OAuth2 setup in `.env`:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

- OAuth server runs on port 9898
- Redirect URI must be `http://localhost:9898/callback`
- Tokens stored in Tauri app data directory
- Sync runs with 30-day past, 90-day future window

## Common Development Tasks

### Adding a New GTD Field Type

1. Create BlockNote component in `src/components/editor/blocks/`
2. Add insertion hook in `src/hooks/use[FieldName]Insertion.ts`
3. Update `preprocessMarkdownForBlockNote()` in `src/utils/blocknote-preprocessing.ts`
4. Add extraction regex in `src/utils/metadata-extractor.ts`
5. Register keyboard shortcut in `src/hooks/useKeyboardShortcuts.ts`

### Adding a Tauri Command

1. Implement in `src-tauri/src/commands/mod.rs`
2. Add to command list in `src-tauri/src/lib.rs` (not main.rs)
3. Create frontend wrapper with `withErrorHandling()`
4. Test with both Tauri context and web-only mode

## Important Constraints

- **TypeScript**: Strict mode disabled - be careful with null checks
- **File Size**: Max 10MB per file
- **Open Tabs**: Max 10 simultaneous
- **ESLint**: Max warnings: 0 (CI will fail on any warnings)
- **BlockNote**: Version pinned at 0.35 for stability
- **Rust**: Must pass `cargo check`, `cargo clippy -D warnings`, and `cargo fmt --check`
- **Node Version**: Requires Node 20+
- **Testing**: Limited test infrastructure - no unit test framework currently implemented

## CI/CD Quality Gates

GitHub Actions enforce these requirements:

- **TypeScript**: `npm run type-check` must pass
- **ESLint**: Zero warnings allowed (`max-warnings: 0`)
- **Rust Format**: `cargo fmt --check` must pass
- **Rust Linting**: `cargo clippy -D warnings` must pass
- **Cross-platform**: Builds tested on Ubuntu, macOS, Windows
- **Branch Protection**: main/develop/staging with workflow dispatch on main/staging only
- **Release Safety**: Scripts include git status checks, version validation, and tag verification

## Release Process Details

The release scripts (`scripts/safe-release.js`) include safety checks:

1. Verifies clean git status (no uncommitted changes)
2. Ensures on correct branch (main/staging)
3. Validates version bump type (patch/minor/major)
4. Updates version in package.json, Cargo.toml, and src-tauri/tauri.conf.json
5. Creates git tag only at HEAD
6. Triggers GitHub Actions for multi-platform builds

## Known Issues

### Sidebar Not Updating

Projects may not appear immediately after creation. The event system (`gtd-project-created`) may have timing issues. Workaround: Collapse/expand Projects section.

### Google Calendar Auth

If authentication fails:
1. Check `.env` file exists with valid credentials
2. Verify redirect URI is `http://localhost:9898/callback`
3. Ensure port 9898 is free
4. Check Google Cloud Console for OAuth consent screen configuration

### Large File Performance

Files over 1MB may cause editor performance issues. The app uses 2-second debounced auto-save to mitigate.

### Test Coverage

No automated testing framework is currently implemented. Manual testing is required before releases.