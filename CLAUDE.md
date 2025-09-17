# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

```bash
# Development
npm run tauri:dev      # Primary dev server with hot reload
npm run dev            # Vite frontend only
npm run preview        # Preview production build

# Code Quality - ALWAYS RUN BEFORE COMMITTING
npm run type-check     # TypeScript validation
npm run lint           # ESLint check (CI fails on warnings)
npm run lint:fix       # Auto-fix ESLint issues
cd src-tauri && cargo check && cargo clippy  # Rust checks
cd src-tauri && cargo fmt  # Auto-fix Rust formatting

# Building
npm run tauri:build    # Creates platform installers
npm run build          # Frontend build only

# Testing
npm test               # Run Vitest in watch mode
npm run test:run       # Run tests once

# Release Management
npm run release:patch  # 0.1.0 → 0.1.1 with git tag
npm run release:minor  # 0.1.0 → 0.2.0 with git tag
npm run release:major  # 0.1.0 → 1.0.0 with git tag
```

## Setup Requirements

- **Node.js**: v20+ required
- **Rust**: Latest stable via [rustup](https://rustup.rs/)
- **First run**: `npm install` then `npm run tauri:dev`
- **Google Calendar**: Configure OAuth in Settings UI (or `.env` with `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET`)

## Architecture Overview

**Stack**: React 18 + TypeScript + Vite + Tauri 2.x (Rust backend) + BlockNote editor v0.37 (pinned)
**State Management**: Custom React hooks only - no Redux/Zustand
**Entry Points**: `src/App.tsx` (frontend), `src-tauri/src/lib.rs` (backend commands)

### Project Structure

```
src/
├── components/     # React UI (editor/, sidebar/, calendar/, dashboard/)
├── hooks/          # Business logic and state management
├── utils/          # Helpers (metadata-extractor.ts, date-formatting.ts, etc.)
├── lib/            # Shared utilities and configurations
src-tauri/
├── src/commands/   # Rust IPC commands
├── src/lib.rs      # Command registration (NOT main.rs)
scripts/            # Build automation (bump-version.js, safe-release.js)
```

### GTD Workspace Structure

Auto-created at `~/GTD Space` on first run:
- **Projects/** - Folders containing README.md + action files (.md)
- **Habits/** - Recurring tasks with frequency-based auto-reset
- **Purpose & Principles/**, **Vision/**, **Goals/**, **Areas of Focus/** - GTD horizons
- **Cabinet/**, **Someday Maybe/** - Reference and future ideas

## Core React Hooks

- **`useGTDSpace`**: Project/action CRUD operations
- **`useTabManager`**: Multi-tab editor state (manual save with Cmd/Ctrl+S)
- **`useFileManager`**: Tauri file operations wrapper
- **`useCalendarData`**: Aggregates all dated items
- **`useHabitTracking`**: Auto-reset based on frequency
- **`useErrorHandler`**: Wraps all Tauri invokes with error handling

## Important Patterns

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

### Content Event Bus

Window-level events for cross-component updates:
```typescript
// Dispatch
window.dispatchEvent(new CustomEvent('content-updated', { detail: { path } }));

// Listen
window.addEventListener('content-updated', handler);
```

Events: `content-updated`, `gtd-project-created`, `file-renamed`

### Custom Markdown Fields

```markdown
[!singleselect:status:in-progress]     # Status dropdown
[!singleselect:effort:medium]          # Effort selector
[!datetime:due_date:2025-01-20]        # Date/time picker
[!checkbox:habit-status:false]         # Habit tracking
[!multiselect:contexts:home,work]      # Multiple tags
[!references:file1.md,file2.md]        # File links
[!actions-list]                        # Dynamic action list
```

## Key Features & Components

### Dashboard System

Five-tab layout in `src/components/dashboard/`:
- **Overview**: System statistics, trends, overdue alerts
- **Actions**: All actions with filtering (status/effort/dates/contexts)
- **Projects**: Portfolio view with progress tracking
- **Habits**: Tracking with streaks and auto-reset
- **Horizons**: GTD hierarchy visualization

### Actions List

- Projects show expandable action lists in sidebar
- Real-time status updates (in-progress/waiting/completed)
- Insert `[!actions-list]` with Ctrl/Cmd+Alt+L

## Adding New Features

**New GTD Field**:
1. BlockNote component in `src/components/editor/blocks/`
2. Insertion hook in `src/hooks/use[FieldName]Insertion.ts`
3. Update `preprocessMarkdownForBlockNote()` and `metadata-extractor.ts`
4. Register keyboard shortcut

**New Tauri Command**:
1. Implement in `src-tauri/src/commands/`
2. Register in `src-tauri/src/lib.rs` (NOT main.rs)
3. Wrap with `withErrorHandling()` in frontend

## Technical Constraints

- **TypeScript**: Strict mode disabled, path aliases configured (`@/*` → `./src/*`)
- **ESLint**: v9 flat config, **zero warnings allowed** (CI enforced), unused vars must start with `_`
- **Rust**: Must pass `cargo clippy -D warnings` and `cargo fmt --check`
- **BlockNote**: v0.37 pinned (DO NOT upgrade without thorough testing)
- **Node**: v20+ required, npm v9 package manager
- **Vitest**: Tests in `tests/` directory, run with `npm test`

## Key Utilities

**Date Handling** (`src/utils/date-formatting.ts`): `formatRelativeDate()`, `formatCompactDate()`, `formatRelativeTime()`
**Metadata** (`src/utils/metadata-extractor.ts`): `extractMetadata()`, `extractProjectStatus()`, `extractActionStatus()`
**Notifications**: `const { toast } = useToast()` for user feedback
**Error Handling**: Always wrap Tauri invokes with `withErrorHandling()` from `useErrorHandler`

## Critical Event Flows

- **Save**: Cmd/Ctrl+S → `saveTab()` → Tauri `write_file` → toast notification
- **File Watch**: External changes detected with 500ms debounce → UI auto-refresh
- **Content Bus**: Window-level events (`content-updated`, `gtd-project-created`, `file-renamed`)
- **Tab System**: Multi-tab with manual save, max 10 tabs, drag-and-drop reordering

## Performance Notes

- **Debouncing**: Auto-save (2s), metadata (500ms), file watcher (500ms)
- **Limits**: Max 10MB files, max 10 open tabs
- **Parallel Operations**: Calendar data loads, multiple file reads

## CI/CD & Release Process

**GitHub Actions**: `ci.yml` (linting/type checks), `build.yml` (platform builds), `release.yml` (creates releases)

**Release Commands**:
- `npm run release:patch/minor/major` - Full release with git tag
- `npm run version:patch/minor/major` - Version bump only
- Script updates package.json, Cargo.toml, and tauri.conf.json in sync

## Build Notes

- **Icons**: Auto-generated from `app-icon.png` before build
- **Platforms**: macOS (.dmg), Windows (.msi), Linux (.AppImage/.deb)
- **Versions**: Synchronized across package.json, Cargo.toml, tauri.conf.json

## Troubleshooting

- **Module errors**: `npm install` and restart
- **Rust errors**: `rustup update`
- **Calendar sync**: Check OAuth config in Settings or `.env` file
- **File watch issues**: Check 500ms debounce in console logs

## Commit Guidelines

From AGENTS.md:
- Use imperative mood with concise scope (e.g., `feat: add calendar week view`)
- Reference issues when applicable
- Ensure `type-check` and `lint` pass before committing
- Include screenshots for UI changes in PRs