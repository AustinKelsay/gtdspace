# GTD Spec

This is the current single-file GTD spec for the codebase.

If it conflicts with other docs, the current code and tests win. The detailed supporting breakdowns live in:

- `spec/01-workspace-and-domain-model.md`
- `spec/02-markdown-schema.md`
- `spec/03-runtime-behavior.md`

## 1. Workspace Model

### 1.1 Root Structure

A GTD workspace is a single root folder containing these top-level directories:

- `Areas of Focus`
- `Goals`
- `Vision`
- `Purpose & Principles`
- `Projects`
- `Habits`
- `Someday Maybe`
- `Cabinet`

The backend initializer also creates overview/example files during initialization, including horizon READMEs and welcome/seed content. The current frontend readiness checks are weaker than the full structure and only require `Projects`, `Habits`, `Someday Maybe`, and `Cabinet`.

### 1.2 No `Horizons/` Parent Folder

The current implementation does not use a `Horizons/` parent folder. Horizon folders live directly under the workspace root.

### 1.3 Section Semantics

- `Projects` stores folders, one per project.
- `Habits` stores one markdown file per habit.
- `Areas of Focus`, `Goals`, `Vision`, and `Purpose & Principles` store one markdown file per page plus a folder `README.md` overview.
- `Someday Maybe` and `Cabinet` are flat markdown sections for ideas and references.

## 2. Item Model

### 2.1 Projects

- Canonical location: `Projects/<Project Name>/README.md`
- Accepted fallback location: `Projects/<Project Name>/README.markdown`
- Actions are sibling markdown files in the same project folder.
- Backend project creation accepts `in-progress`, `waiting`, and `completed`. Runtime loaders and dashboards also tolerate `cancelled` in existing data.
- New projects default to `in-progress`.

### 2.2 Actions

- Canonical location: `Projects/<Project Name>/<Action Name>.md`
- Action status tokens are `in-progress`, `waiting`, `completed`, and `cancelled`.
- Effort tokens are `small`, `medium`, `large`, `extra-large`.
- New actions default to `in-progress` and `medium`.
- If a focus date is entered without a time in the UI, the stored time defaults to `09:00:00`.

### 2.3 Habits

- Canonical location: `Habits/<Habit Name>.md`
- Habit status normalizes to `todo` or `completed`.
- Habit frequency tokens are `5-minute`, `daily`, `every-other-day`, `twice-weekly`, `weekly`, `weekdays`, `biweekly`, `monthly`.
- New habits always start as `todo`.
- New habits default to `daily`.

### 2.4 Horizons

- Areas use `steady`, `watch`, `incubating`, `delegated`.
- Area review cadence uses `weekly`, `monthly`, `quarterly`, `annually`.
- Goals use `in-progress`, `waiting`, `completed`.
- Vision uses `3-years`, `5-years`, `10-years`, `custom`.
- New Area defaults: `steady`, `monthly`
- New Goal defaults: `in-progress`
- New Vision defaults: `3-years`
- New Purpose page title default: `Purpose & Principles`

## 3. Markdown Language

### 3.1 Metadata Format

GTD metadata is stored inline in markdown markers, not YAML frontmatter.

Supported marker families:

- Single select: `[!singleselect:<field>:<value>]`
- Multi select: `[!multiselect:<field>:<value1,value2>]`
- Checkbox: `[!checkbox:<field>:true|false]`
- Datetime: `[!datetime:<field>:<value>]`
- References:
  - `[!projects-references:...]`
  - `[!areas-references:...]`
  - `[!goals-references:...]`
  - `[!vision-references:...]`
  - `[!purpose-references:...]`
  - `[!references:...]`
- Rendered list blocks:
  - `[!actions-list]`
  - `[!actions-list:<status>]`
  - `[!habits-list]`
  - `[!projects-list]`
  - `[!areas-list]`
  - `[!goals-list]`
  - `[!visions-list]`
  - combined horizon list aliases handled by BlockNote preprocessing

Horizon overview READMEs use horizon-specific list tokens from `horizon-config`, including `purpose-list` and `vision-list`.

### 3.2 Canonical Fields

Implemented single-select fields include:

- `status`
- `project-status`
- `effort`
- `habit-frequency`
- `habit-status`
- `area-status`
- `area-review-cadence`
- `goal-status`
- `vision-horizon`
- `horizon-altitude`
- `horizon-review-cadence`

Implemented datetime fields include:

- `created_date_time`
- `due_date`
- `focus_date`
- `goal-target-date`

The parser also accepts legacy aliases and normalizes them into the app metadata model.

### 3.3 Reference Encoding

- Horizon reference arrays are normalized to forward slashes, trimmed, deduplicated, JSON-serialized, and URI-encoded.
- Generic `references` values are normalized CSV.
- The parser accepts JSON arrays, CSV, malformed closing brackets in some cases, and multiple levels of URL decoding.

## 4. Canonical Document Schemas

### 4.1 Project

Canonical order:

1. `# <Project Name>`
2. `## Status`
3. optional `## Due Date`
4. `## Desired Outcome`
5. `## Horizon References`
6. `## References (optional)`
7. `## Created`
8. `## Actions`
9. `## Related Habits (optional)`
10. additional custom content

### 4.2 Habit

Canonical order:

1. `# <Habit Name>`
2. `## Status`
3. `## Frequency`
4. optional `## Focus Date`
5. `## Projects References`
6. `## Areas References`
7. `## Goals References`
8. `## Vision References`
9. `## Purpose & Principles References`
10. `## References`
11. `## Created`
12. optional `## Notes`
13. `## History`

Habit history is treated as a table with a stable header/body/outro structure. Blank lines do not terminate parsing, escaped pipes round-trip, and multiline details serialize as `<br>`.

### 4.3 Area

Canonical order:

1. `# <Area Name>`
2. `## Status`
3. `## Review Cadence`
4. `## Projects References`
5. optional `## Areas References`
6. `## Goals References`
7. optional `## Vision References`
8. optional `## Purpose & Principles References`
9. `## References (optional)`
10. `## Created`
11. `## Description`

### 4.4 Goal

Canonical order:

1. `# <Goal Name>`
2. `## Status`
3. optional `## Target Date`
4. `## Projects References`
5. `## Areas References`
6. optional `## Vision References`
7. optional `## Purpose & Principles References`
8. `## References (optional)`
9. `## Created`
10. `## Description`

### 4.5 Vision

Canonical order:

1. `# <Vision Name>`
2. `## Horizon`
3. `## Projects References`
4. `## Goals References`
5. `## Areas References`
6. optional `## Purpose & Principles References`
7. `## References (optional)`
8. `## Created`
9. `## Narrative`

### 4.6 Purpose & Principles

Canonical order:

1. `# <Title>`
2. `## Projects References`
3. `## Goals References`
4. `## Vision References`
5. optional `## Areas References`
6. `## References (optional)`
7. `## Created`
8. `## Description`

### 4.7 Horizon Overview README

Each horizon folder `README.md` is a canonical overview page with this order:

1. `# <Horizon> Overview`
2. `## Altitude`
3. `## Review Cadence`
4. `## Created`
5. `## Why this horizon matters`
6. `## How to work this horizon in GTD Space`
7. `## Horizon Pages Overview`
8. `## Reference Index`
9. `## Horizon Pages`

Its reference list excludes `README.md`, normalizes paths, deduplicates entries, and sorts them.

## 5. Relationships

### 5.1 Stored Links

- Project READMEs can link to areas, goals, vision, and purpose pages.
- Habit files can link to projects, areas, goals, vision, and purpose pages.
- Horizon pages can link downward and sideways depending on page type.
- Generic `references` can point into `Cabinet` and `Someday Maybe`.

### 5.2 Path Rules

- Project references resolve to project `README` paths.
- Non-project horizon references resolve to markdown files under the matching top-level folder.
- Relative references are normalized against the workspace root.
- Bare project references resolve to `Projects/<ref>/README.md`.
- README targets are excluded from several selection UIs when they represent overview pages rather than user pages.

### 5.3 Rename Contract

- The H1 title is treated as rename intent only after save.
- Saving a project README with a changed H1 triggers project folder rename.
- Saving an action file with a changed H1 triggers action file rename.
- The same rename-on-save pattern is reused for habits, horizon pages, `Someday Maybe`, and `Cabinet`.
- Metadata-change events alone do not trigger rename; save is the point of commitment.

## 6. Migration Rules

### 6.1 Markdown Migration

- `created_date` -> `created_date_time`
- `focus_date_time` -> `focus_date`
- `## Created Date` -> `## Created Date/Time`
- multiselect `status`, `project-status`, and `effort` collapse to singleselect using the first value

### 6.2 Status Normalization

- `not-started`, `active`, `planning` -> `in-progress`
- `on-hold`, `waiting-for`, `blocked`, `paused` -> `waiting`
- `done`, `complete`, `finished` -> `completed`
- `cancelled` stays `cancelled`

### 6.3 Object Migration

Snake_case GTD object fields are normalized into camelCase when loaded.

## 7. Runtime Behavior

### 7.1 Dashboards

- Project and action dashboards default to showing only `in-progress` and `waiting`.
- Both default to due-date ascending sort.
- Projects filter by search, status, deadline presence, horizon-link presence, and completion range.
- Actions filter by search, status, effort, project, deadline presence, focus-date presence, and contexts.
- Project overdue excludes `completed` and `cancelled`.
- Action overdue uses local-date parsing.

### 7.2 Calendar

Calendar is a derived view.

- Projects appear only if they have `due_date`.
- Actions appear only if they have focus or due dates.
- Habits appear if they have a parseable created timestamp or fallback metadata/header timestamp.
- Google Calendar events are included from local persisted sync state.
- Calendar refreshes on relevant metadata saves, content saves, and structural events.
- Calendar applies migrations in memory only while loading.

### 7.3 Event Bus

The content event bus provides:

- `content:changed`
- `content:saved`
- `content:metadata-changed`
- `file:created`
- `file:deleted`
- `file:renamed`

It deduplicates rapid `content:changed` emissions per file within 100ms and cascades save/metadata events into `content:changed`.

### 7.4 File Watching

- The frontend watches the selected workspace root.
- The backend watcher is debounced at 500ms.
- The backend watcher is non-recursive.
- The backend currently emits `event_type = "changed"`.
- App-level logic currently switches on `created`, `deleted`, and `modified`, which is a known mismatch.
- External modification reload is only offered for clean tabs; dirty tabs get a warning.

### 7.5 Habits And Automation

Habit reset is the only built-in automation loop today.

- The app runs `check_and_reset_habits` on startup and every 60 seconds while a GTD space is open.
- Reset timing is based on the last recorded action time or created timestamp.
- Backfill is supported for missed periods.
- Reset processing caps written history entries per run.
- Resets force habits back to todo/unchecked.
- Manual habit toggles append history rows.

Supported reset frequencies:

- `5-minute`
- `daily`
- `every-other-day`
- `twice-weekly`
- `weekly`
- `weekdays`
- `biweekly`
- `monthly`

### 7.6 Google Calendar

Google Calendar is optional and local-state-backed.

- Auto-sync runs on mount, every 5 minutes, and on visibility return.
- Interval syncs are skipped when hidden.
- Sync is gated on connection state and in-flight sync state.
- Synced events and last-sync timestamps are stored in `localStorage`.
- Synced events are rebroadcast with `google-calendar-synced`.

## 8. Known Mismatches

- `checkGTDSpace()` validates only four top-level folders, not the full intended structure.
- The dashboard quick-create path still seeds simpler legacy horizon content in some cases. For example, Goals are initialized with `[!datetime:target_date:]` there, while the canonical builders and spec use `[!datetime:goal-target-date:]`.
- The backend watcher emits `changed` while frontend logic expects `created`, `deleted`, or `modified`.
- `useHabitScheduler` exists but is not wired into the current runtime, so the effective automation path is in `App.tsx` plus backend habit reset commands.
- There is no generic notification engine or automation framework beyond habits polling, Google Calendar auto-sync, DOM events, and toasts.
