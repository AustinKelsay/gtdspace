# Habits Implementation

Updated: March 21, 2026

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

The current implementation centralizes habit parsing and rebuilding in shared helpers instead of spreading the rules across page components and Rust commands:

- Frontend domain helper: `src/utils/gtd-habit-markdown.ts`
- Backend domain helper: `src-tauri/src/commands/gtd_habits_domain.rs`

Those modules are responsible for the same core concerns: status normalization, frequency normalization, history parsing/reconstruction, reset-anchor detection, and calendar-based reset math.

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

`update_habit_status` is now a thin orchestration layer around the shared habit-domain helpers. That keeps legacy singleselect support, history insertion, and status-token normalization in one backend place.

## Reset Scheduling

Periodic reset behavior is currently driven by the app runtime plus the backend reset command:

- `App.tsx` calls `check_and_reset_habits` on startup
- `App.tsx` also polls every 60 seconds while a GTD space is open
- the backend decides whether any habits actually need resetting
- reset operations append history rows and return changed habits so the UI can refresh

`useHabitScheduler` exists in the repo, but it is not the active runtime path today.

Current reset windows are calendar-based rather than rough duration approximations:

- `5-minute`: next 5-minute boundary
- `daily`: next local midnight
- `every-other-day`: two days after the current anchor day
- `twice-weekly`: next Tuesday or Friday boundary
- `weekly`: next Monday boundary
- `weekdays`: next weekday boundary
- `biweekly`: two weeks from the Monday of the anchor week
- `monthly`: first day of the next month

Reset anchoring is also more explicit now:

- prefer the most recent `Auto-Reset` or `Backfill` history row
- otherwise fall back to `Created`
- otherwise fall back to the latest parseable history timestamp

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

Legacy list-style history is still accepted on read. When the backend writes a new entry, it migrates that legacy history into the canonical table form.

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
- Backend habit domain: `src-tauri/src/commands/gtd_habits_domain.rs`
- Frontend helpers: `useHabitTracking`, `useHabitsHistory`
- Frontend habit domain: `src/utils/gtd-habit-markdown.ts`
- Canonical markdown builder: `buildHabitMarkdown()` via `canonicalizeHabitMarkdown()`
- Runtime scheduler path: `App.tsx`

## Related Docs

- [`habit-page-template.md`](./habit-page-template.md)
- [`gtd-data-model.md`](./gtd-data-model.md)
- [`../spec/03-runtime-behavior.md`](../spec/03-runtime-behavior.md)
