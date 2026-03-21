# Hooks Reference

This document maps the current custom hooks in `src/hooks/` and explains which ones are central to the app today.

Use it as a navigation aid, not as a substitute for reading the hook source.

## Core Application Hooks

These hooks drive the main app lifecycle:

- `useSettings`: loads, saves, and broadcasts user settings
- `useFileManager`: loads folders/files, manages editor content, and mediates save/load state
- `useTabManager`: tracks open tabs, current tab, and tab persistence behavior
- `useGTDSpace`: initializes GTD spaces, validates workspace shape, and creates GTD projects/actions/habits
- `useGTDWorkspaceSidebar`: orchestrates sidebar preloading, content-event reactions, rename/delete flows, and sidebar-local UI state

These hooks are the main coordination layer between the app shell, workspace state, and Tauri commands.

## Data-Derivation Hooks

These hooks derive dashboard and calendar data from markdown content:

- `useProjectsData`
- `useActionsData`
- `useCalendarData`
- `useHorizonsRelationships`
- `useHabitsHistory`
- `useHabitTracking`

They are read-heavy hooks. Most of the GTD dashboards and rollups depend on them rather than on a separate database.

## Editor And Marker Insertion Hooks

These hooks support GTD-specific editing flows inside the BlockNote editor:

- `useSingleSelectInsertion`
- `useMultiSelectInsertion`
- `useDateTimeInsertion`
- `useReferencesInsertion`
- `useHorizonReferencesInsertion`
- `useActionsListInsertion`
- `useHorizonListInsertion`

They exist to keep marker insertion logic out of the editor components themselves.

## Infrastructure And Integration Hooks

These hooks connect the UI to broader runtime services:

- `useFileWatcher`: subscribes to backend file watcher events
- `useGlobalSearch`: runs repo/workspace search
- `useGitSync`: wraps encrypted git backup/sync operations
- `useKeyboardShortcuts`: registers application shortcuts
- `useModalManager`: centralizes modal open/close state
- `useErrorHandler`: normalizes async error handling patterns
- `useToast` / `use-toast`: local toast helpers

## Hooks With Narrow Or Transitional Roles

Some hooks are narrower or not part of the core steady-state runtime:

- `useHabitScheduler`: present in the codebase but not the effective production automation path today
- `useHabitTracking`: focused on habit-specific interaction flows
- `useHorizonsRelationships`: horizon relationship convenience layer rather than a global state primitive

When documenting behavior, avoid assuming every hook in `src/hooks/` has equal architectural weight.

## How Hooks Fit Together

The current composition pattern is:

1. `useSettings` restores preferences and workspace hints
2. `useGTDSpace` and `useFileManager` load the workspace
3. `useGTDWorkspaceSidebar` derives and maintains the workspace navigation tree
4. `useTabManager` manages opened files/pages
5. Data hooks derive dashboard/calendar models from markdown content
6. Integration hooks attach watchers, search, and sync behavior

This is a hooks-first architecture, but it is not a generic hook library. Most hooks are tightly coupled to GTD Space’s file-based model.

## Reading Order

If you are new to the codebase, read the hooks in this order:

1. `useSettings`
2. `useGTDSpace`
3. `useFileManager`
4. `useGTDWorkspaceSidebar`
5. `useTabManager`
6. `useProjectsData`, `useActionsData`, `useCalendarData`
7. the editor insertion hooks
8. the integration hooks (`useFileWatcher`, `useGitSync`, `useGlobalSearch`)

## Related Docs

- [`architecture.md`](./architecture.md)
- [`tauri.md`](./tauri.md)
- [`settings.md`](./settings.md)
- [`content-events.md`](./content-events.md)
- [`../spec/03-runtime-behavior.md`](../spec/03-runtime-behavior.md)
