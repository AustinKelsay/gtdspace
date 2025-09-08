# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

```bash
# Development
npm run tauri:dev      # Primary dev server with hot reload
npm run tauri          # Run Tauri CLI commands directly
npm run dev            # Vite dev server only (frontend)
npm run preview        # Preview built frontend

# Code Quality - ALWAYS RUN BEFORE COMMITTING
npm run type-check     # TypeScript validation
npm run lint           # ESLint check (CI fails on warnings)
npm run lint:fix       # Auto-fix ESLint issues
cd src-tauri && cargo check && cargo clippy  # Rust checks
cd src-tauri && cargo fmt --check  # Rust formatting check

# Production Build
npm run tauri:build    # Creates platform-specific installer (runs pretauri:build automatically)
npm run build          # Build frontend only

# Version Management (updates versions only)
npm run version:bump   # Alias for version:patch (default bump)
npm run version:patch  # Bump patch version
npm run version:minor  # Bump minor version
npm run version:major  # Bump major version

# Release (full release: version bump + git tag + commit)
npm run release        # Alias for release:patch (default release)
npm run release:patch  # 0.1.0 → 0.1.1 with git operations
npm run release:minor  # 0.1.0 → 0.2.0 with git operations
npm run release:major  # 0.1.0 → 1.0.0 with git operations

# Utilities
npm run icons:generate # Generate app icons for all platforms

# Testing (manual only - no framework configured)
# 1. Test frontend changes with npm run tauri:dev
# 2. Test production build with npm run tauri:build
# 3. Verify GTD operations in sidebar and editor
```

## Before First Run

1. Install dependencies: `npm install`
2. Rust toolchain: Ensure Rust is installed via [rustup](https://rustup.rs/)
3. For Google Calendar integration:
   - **WARNING**: Never put secrets in `VITE_*` environment variables as they are exposed to the frontend
   - Use PKCE (Proof Key for Code Exchange) flow in the Vite frontend with only a public client ID
   - If a client secret is required, it must be handled on the Tauri (Rust) backend and stored securely in the OS keychain
   - Create `.env.local` with only the public client ID (ensure `.env*` is git-ignored):
     - Add redirect URI `http://localhost:9898` in Google Cloud Console
     - Never commit `.env*` files; confirm `.gitignore` excludes them
   ```
   VITE_GOOGLE_CLIENT_ID=your_client_id
   ```
4. First build may take longer due to Rust compilation

## Architecture Overview

**Frontend**: React 18 + TypeScript + Vite + BlockNote editor (v0.37 pinned) + Tailwind/shadcn  
**Backend**: Rust + Tauri 2.x with Tokio async runtime  
**State**: Custom hooks pattern - no Redux/Zustand  
**Entry Points**: `src/App.tsx` (frontend), `src-tauri/src/lib.rs` (backend)

### Key Directories

- `src/components/` - React components (editor, sidebar, calendar, settings)
- `src/hooks/` - Custom React hooks for state and business logic
- `src/utils/` - Helper functions (markdown processing, metadata extraction)
- `src-tauri/src/commands/` - Rust backend commands exposed to frontend
- `scripts/` - Build and release automation scripts

### Tauri Command Pattern

```typescript
import { invoke } from "@tauri-apps/api/core";
import { withErrorHandling } from "@/hooks/useErrorHandler";

// Frontend camelCase → Backend snake_case (auto-converted)
const result = await withErrorHandling(
  async () => await invoke<ReturnType>("command_name", { param }),
  "Error message"
);
```

Use `safeInvoke()` from `@/utils/safe-invoke.ts` during app init or web contexts.

### GTD Directory Structure

Auto-created at `~/GTD Space`:

```
├── Purpose & Principles/  # 50,000 ft
├── Vision/               # 40,000 ft  
├── Goals/                # 30,000 ft
├── Areas of Focus/       # 20,000 ft
├── Projects/             # 10,000 ft - Folders with README.md + action files
├── Habits/               # Recurring routines with auto-reset
├── Someday Maybe/        
└── Cabinet/              # Reference materials
```

### Custom Markdown Fields

```markdown
[!singleselect:status:in-progress]        # in-progress|waiting|completed
[!singleselect:effort:medium]              # small|medium|large|extra-large
[!datetime:due_date:2025-01-20]           # Date/time fields
[!references:file1.md,file2.md]           # Cabinet/Someday links
[!areas-references:path.md]               # Horizon references
[!multiselect:contexts:home,work]         # Tags/contexts
[!checkbox:habit-status:false]            # Habit tracking
[!projects-list]                          # Dynamic lists
[!actions-list]                           # Actions list in project README
```

### Key Event Flows

**Project Creation**: `useGTDSpace.createProject()` → Tauri command → `gtd-project-created` event → UI refresh  
**Content Updates**: Editor → `useTabManager` → `content-event-bus` → Components update  
**Tab Management**: Open file → `addTab()` → Active tab state → Editor mount → Content load  
**File Watch**: External change → File watcher (500ms debounce) → UI refresh  
**Save Flow**: Manual save (Cmd/Ctrl+S) → `saveTab()` → Tauri `write_file` → Success notification  
**Data Migration**: In-memory only during reads via `migrateMarkdownContent()`

### UI Components

- **Sidebar**: Scrollable with independent scroll areas for each section (Projects, Habits, etc.)
- **Editor**: BlockNote-based with custom GTD field components
- **Calendar**: Week/month views with event filtering and Google Calendar integration
- **Settings**: Theme selection, Google Calendar auth, preferences persistence

### Performance Optimizations

- Parallel file reads in `useCalendarData`  
- Debouncing: Auto-save (2s), metadata save (500ms), file watcher (500ms)  
- Calendar renders only visible date range  
- Pre-compiled regex patterns for metadata extraction

### Core Hooks

- `useGTDSpace` - Project/action CRUD, workspace init
- `useTabManager` - Multi-tab editing with manual save (Cmd/Ctrl+S)
- `useFileManager` - File operations via Tauri
- `useFileWatcher` - External change detection (500ms debounce)
- `useCalendarData` - Aggregates dated items from projects/actions/habits
- `useHabitTracking` - Habit status tracking with automatic reset
- `useErrorHandler` - Centralized error handling with toast notifications
- `useKeyboardShortcuts` - Global keyboard shortcut management
- `useActionsListInsertion` - Inserts dynamic actions list in project READMEs

### Adding a New GTD Field

1. Create BlockNote component in `src/components/editor/blocks/`
2. Add insertion hook in `src/hooks/use[FieldName]Insertion.ts`
3. Update `preprocessMarkdownForBlockNote()` in `src/utils/blocknote-preprocessing.ts`
4. Add extraction regex in `src/utils/metadata-extractor.ts`
5. Register shortcut in `src/hooks/useKeyboardShortcuts.ts`

### Adding a Tauri Command

1. Implement in `src-tauri/src/commands/mod.rs`
2. Register in `src-tauri/src/lib.rs` (not main.rs)
3. Frontend wrapper with `withErrorHandling()`

## Key Constraints

- **TypeScript**: Strict mode disabled
- **ESLint**: v9+ with flat config (`eslint.config.js`), zero warnings allowed (CI enforced)
  - Unused vars config: `argsIgnorePattern`, `varsIgnorePattern`, `caughtErrorsIgnorePattern` all set to `'^_'`
- **Rust**: Must pass `cargo clippy -D warnings` and `cargo fmt --check`
  - Uses `notify` through `notify-debouncer-mini` (no direct dependency)
  - `rand` v0.9 with new API: `rand::rng()` and `random_range()`
- **BlockNote**: v0.37 pinned for stability (DO NOT upgrade without testing)
- **Tailwind CSS**: v3.x required (v4 incompatible with current PostCSS config)
- **Node**: v20+ required
- **Limits**: Max 10MB files, max 10 open tabs
- **Google OAuth**: Port 9898 required (`.env` config needed)
- **Testing**: No test framework configured - manual testing required

## CI/CD & Release

**GitHub Actions** (.github/workflows/):
- `ci.yml` - Enforces TypeScript, ESLint, and Rust checks on all PRs
- `build.yml` - Tests multi-platform builds (Ubuntu/macOS/Windows)  
- `release.yml` - Triggered by version tags to create releases

**Release Process** (`scripts/safe-release.js`):
1. Verifies clean git status and main branch
2. Updates version in package.json, Cargo.toml, tauri.conf.json
3. Creates git commit and tag (format: v0.1.0)
4. Pushes to origin, triggering GitHub Actions builds

## Debugging Tips

- **Tauri DevTools**: Available in dev mode via right-click → Inspect
- **Rust Logs**: Check terminal output for backend errors
- **Event Bus**: Use `window.addEventListener('content-updated')` to debug
- **File Operations**: Check Tauri permissions if file access fails

## Common Troubleshooting

- **"Cannot find module"**: Run `npm install` and restart dev server
- **Rust compilation errors**: Update Rust toolchain with `rustup update`
- **Calendar sync fails**: Check `.env` configuration and port 9898 availability
- **Editor not loading**: Clear browser cache in dev tools
- **File changes not detected**: Check file watcher is running (see console logs)

## Known Issues

- **Large files**: >1MB may cause editor lag
- **BlockNote formatting**: Rich text features lost when converting to markdown
- **No test framework**: Manual testing required
- **macOS code signing**: Unsigned builds may require security bypass on first run

## Project-Specific Features

### Actions List in Projects
- Projects display expandable list of all actions in sidebar
- Actions show real-time status (in-progress, waiting, completed)
- Click action to open in editor
- Auto-updates when actions are added/modified/deleted
- Insert with `[!actions-list]` in project README