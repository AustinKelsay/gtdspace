# Habits Implementation

Updated: March 20, 2026

This document explains how habits work in the current codebase.

Authoritative reference:

- This is a focused habit implementation note.
- The canonical GTD/runtime rules live in [`../spec/gtd-spec.md`](../spec/gtd-spec.md) and [`../spec/03-runtime-behavior.md`](../spec/03-runtime-behavior.md).
- If this guide conflicts with code/tests or the `spec/` docs, the code/tests and `spec/` docs win.

## Habit Model

A habit is a markdown file under `Habits/` with:

- checkbox status via `[!checkbox:habit-status:true|false]`
- frequency via `[!singleselect:habit-frequency:...]`
- references to projects and horizons
- created timestamp
- optional notes
- a history section seeded with the standard markdown table header

The history table is present at creation time; later updates append rows to it.

## Supported Frequencies

All current reset frequencies are local-time based:

- `5-minute`
- `daily`
- `every-other-day`
- `twice-weekly`
- `weekly`
- `weekdays`
- `biweekly`
- `monthly`

The `5-minute` option exists primarily as a testing utility, but it is a real supported token in the current implementation.

## Manual Updates

Manual habit toggles flow through `update_habit_status`.

Current behavior:

- the checkbox marker is updated
- a history row is appended
- the app emits refresh events so open views can reload

The frontend hook `useHabitTracking()` wraps these manual update calls, but it is not the source of periodic scheduling.

## Reset Scheduling

Periodic reset behavior is currently driven by the app runtime plus the backend reset command:

- `App.tsx` calls `check_and_reset_habits` on startup
- `App.tsx` also polls every 60 seconds while a GTD space is open
- the backend decides whether any habits actually need resetting
- reset operations append history rows and return changed habits so the UI can refresh

`useHabitScheduler` exists in the repo, but it is not the active runtime path today.

## History Semantics

History is stored as a markdown table with these columns:

```markdown
| Date | Time | Status | Action | Details |
|------|------|--------|--------|---------|
```

The implementation preserves this structure so history stays both machine-readable and hand-editable.

Rows may represent:

- manual changes
- auto-resets
- catch-up or backfill-style resets when the app was previously offline

## References and Related Habits

Habits can reference:

- projects
- areas of focus
- goals
- vision pages
- purpose & principles pages

Current related-habits rendering is not universal across every page type. The clearest built-in rendering path today is the project-side `[!habits-list]` block. Other horizon pages may carry references, but they do not all render a dedicated related-habits section by default.

## Implementation Pointers

- Backend commands: `create_gtd_habit`, `update_habit_status`, `check_and_reset_habits`
- Frontend helpers: `useHabitTracking`, `useHabitsHistory`
- Canonical markdown builder: `buildHabitMarkdown()`
- Runtime scheduler path: `App.tsx`

## Related Docs

- [`habit-page-template.md`](./habit-page-template.md)
- [`gtd-data-model.md`](./gtd-data-model.md)
- [`../spec/03-runtime-behavior.md`](../spec/03-runtime-behavior.md)
