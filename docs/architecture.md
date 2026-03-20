# Architecture Overview

GTD Space is a local-first desktop application built with a React frontend and a Tauri/Rust backend. The app treats a GTD workspace on disk as the primary source of user data, then derives UI state, dashboards, and calendar views from that markdown content.

Use this document as a high-level architecture map. For GTD behavior and markdown rules, start with [`../spec/gtd-spec.md`](../spec/gtd-spec.md).

## Runtime Shape

At a high level, the app is split into four layers:

1. Frontend application shell in `src/`
2. GTD/domain-specific UI and hooks in `src/components/gtd/` and `src/hooks/`
3. Shared parsing, migration, and markdown helpers in `src/utils/`
4. Native file, settings, git sync, and calendar commands in `src-tauri/src/`

## Frontend Structure

The current frontend is organized around these major areas:

- `src/components/app/`: top-level shell, loading state, and header
- `src/components/gtd/`: GTD pages, workspace sidebar, dialogs, and dashboard shell
- `src/components/dashboard/`: dashboard tabs for overview, projects, actions, habits, and horizons
- `src/components/calendar/`: calendar view and Google Calendar auto-sync bridge
- `src/components/editor/`: `EnhancedTextEditor`, `BlockNoteEditor`, and custom editor blocks
- `src/components/settings/`: settings manager and grouped settings panels
- `src/components/tabs/` and `src/components/search/`: tab management and global search
- `src/components/ui/`: shared shadcn/ui primitives and local UI wrappers

## Backend Structure

The current backend lives primarily in these modules:

- `src-tauri/src/commands/mod.rs`: Tauri command surface for file operations, GTD workspace management, settings, file watching, habits, git sync, and Google Calendar
- `src-tauri/src/commands/git_sync.rs`: encrypted git backup and sync logic
- `src-tauri/src/google_calendar/`: OAuth, token storage, sync, and cached event handling
- `src-tauri/src/lib.rs`: Tauri app wiring and command registration

## Startup And Workspace Lifecycle

The app startup path is GTD-first:

1. Load persisted settings through `useSettings`
2. Apply the active theme
3. Try to recover `settings.last_folder` if it points at a corrupted GTD subfolder path
4. If no valid workspace is stored, initialize the default GTD space path
5. Load the workspace, then load GTD projects and supporting dashboard state

The important practical consequence is that the app now tries to reopen the last workspace instead of behaving like a generic file browser on launch.

## Data Model And Storage

The storage model is file-based:

- Projects are folders with `README.md` plus action files
- Habits are one markdown file per habit
- Areas, Goals, Vision, and Purpose & Principles are markdown files inside their top-level folders
- Horizon folders also contain canonical `README.md` overview pages
- `Someday Maybe` and `Cabinet` are flat markdown sections

The backend reads and writes files directly. The frontend derives metadata from inline GTD markers in markdown and from file paths.

## Cross-Cutting Runtime Systems

Several systems cut across the frontend and backend:

- Content event bus: coordinates save, metadata, and rename-related refreshes
- File watcher: surfaces external file changes, though watcher event naming still has a known mismatch documented in the spec
- Markdown migration: normalizes older marker formats during load and some save flows
- Habit reset loop: runs on startup and on a timer while a workspace is open
- Google Calendar sync: optional subsystem that fetches and caches events locally
- Git sync: optional encrypted backup/sync flow driven from settings and secure storage

## Where Behavior Lives

If you need the current source of truth for a subsystem, use this map:

- GTD behavior and document shapes: [`../spec/gtd-spec.md`](../spec/gtd-spec.md)
- GTD data flows: [`gtd-data-model.md`](./gtd-data-model.md)
- Markdown parsing and editor pipeline: [`markdown.md`](./markdown.md), [`blocknote.md`](./blocknote.md)
- Event propagation: [`content-events.md`](./content-events.md)
- Hooks and state orchestration: [`hooks.md`](./hooks.md)
- Native command surface: [`tauri.md`](./tauri.md)
- Settings and persistence: [`settings.md`](./settings.md)

## Current Caveats

The architecture still has a few notable weak spots:

- Workspace validation is weaker than the full intended GTD structure
- The backend watcher emits `changed` while some frontend logic still switches on `created`, `deleted`, and `modified`
- Some older quick-create flows still seed simpler legacy markdown instead of the canonical builders

Those gaps are tracked explicitly in the spec so they remain visible while the implementation catches up.
