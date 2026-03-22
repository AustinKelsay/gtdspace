# GTD Data Model and Data Flows

Updated: March 21, 2026

This document defines the data structures and end-to-end data flows for GTD Space items: Habits, Actions, Projects, Areas of Focus, Goals, Vision, and Purpose & Principles. It aligns with the current React + Tauri implementation and the file-based markdown storage model.

Authoritative reference:

- This doc is a high-level data model reference.
- The canonical GTD rules and markdown ordering live in [`../spec/gtd-spec.md`](../spec/gtd-spec.md) and [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md).
- If this doc conflicts with code/tests or the `spec/` docs, the code/tests and `spec/` docs win.

Goals of this doc:

- Specify canonical fields, tokens, and file locations for each item type
- Show how data moves between UI, frontend hooks, and Tauri commands
- Clarify cross-linking between Horizons of Focus and day-to-day work

Scope notes:

- “Current” indicates types and flows implemented in code today.
- Horizons of Focus are formalized in `src/types/index.ts`.

## Directory Structure (on Disk)

When initializing a GTD space, Tauri creates these top-level folders:

```text
<GTD Root>/
├── Projects/              # Each project is a folder, actions are files inside
├── Habits/                # Each habit is a single markdown file
├── Areas of Focus/        # Markdown files for areas
├── Goals/                 # Markdown files for goals
├── Vision/                # Markdown files for future-state narratives
├── Purpose & Principles/  # Markdown files for purpose and values
├── Someday Maybe/
└── Cabinet/
```

The app does not require a “Horizons/” folder; Horizons are represented by the above dedicated directories.

## Canonical Markdown Tokens

GTD metadata is stored inside markdown using inline markers. These are parsed by `src/utils/metadata-extractor.ts` and rendered/edited via custom blocks.

- Single-select: `[!singleselect:<field>:<value>]`
  - Examples: `status`, `project-status`, `effort`, `habit-frequency`, `goal-status`, `vision-horizon`, `horizon-altitude`, `horizon-review-cadence`
- Multi-select: `[!multiselect:<field>:<comma-separated-values>]`
  - Example: `contexts` (normalized tokens such as `home`, `office`, `computer`, `phone`, `errands`, `anywhere`).
- Checkbox: `[!checkbox:habit-status:true|false]` (used for habits)
- Date/Time: `[!datetime:<field>:<ISO or YYYY-MM-DD>]`
  - Examples: `due_date` (date), `focus_date` (date or datetime), `created_date_time`, `goal-target-date`
- References (comma-separated or JSON array):

  - `[!projects-references:...]`
  - `[!areas-references:...]`
  - `[!goals-references:...]`
  - `[!vision-references:...]`
  - `[!purpose-references:...]`
  - `[!references:...]` (generic)

- List markers (rendered blocks, not parsed as metadata):
  - `[!actions-list]` (optionally `[!actions-list:<status-filter>]`)
  - `[!projects-list]`, `[!areas-list]`, `[!goals-list]`, `[!visions-list]`, `[!habits-list]`
  - Horizon overview README tokens also use configured singular forms such as `[!vision-list]` and `[!purpose-list]`
  - Mixed lists: `[!projects-areas-list]`, `[!goals-areas-list]`, `[!visions-goals-list]`

Notes on canonical values:

- Action status uses tokens: `in-progress`, `waiting`, `completed`, `cancelled`.
- Project creation uses `in-progress`, `waiting`, `completed`; loaded project data may still normalize to `cancelled` in runtime code paths.
- Habit status is a checkbox (true = completed, false = todo), normalized to `todo`/`completed` in logic.
- Effort uses: `small` | `medium` | `large` | `extra-large`.
- Habit frequency uses: `5-minute` | `daily` | `every-other-day` | `twice-weekly` | `weekly` | `weekdays` | `biweekly` | `monthly`.

Implementation note:

- Shared markdown/domain helpers now own the parsing and canonical rebuild rules for the most mutation-heavy GTD item types:
  - `src/utils/gtd-action-markdown.ts`
  - `src/utils/gtd-project-content.ts`
  - `src/utils/gtd-habit-markdown.ts`
  - `src/utils/gtd-reference-utils.ts`
- Frontend hooks and pages consume those helpers rather than reimplementing marker parsing, reference normalization, or section slicing locally.
- Habit reset scheduling is mirrored in `src-tauri/src/commands/gtd_habits_domain.rs` so frontend and backend use the same calendar-window model.

## Data Structures

### Current (defined in `src/types/index.ts`)

```ts
// Project status tokens
export type GTDProjectStatus =
  | "in-progress"
  | "waiting"
  | "completed"
  | "cancelled";

// Action status and effort tokens
export type GTDActionStatus =
  | "in-progress"
  | "waiting"
  | "completed"
  | "cancelled";
export type GTDActionEffort = "small" | "medium" | "large" | "extra-large";

// Project folder with README metadata
export interface GTDProject {
  name: string;
  description: string;
  dueDate?: string | null; // YYYY-MM-DD
  status: GTDProjectStatus; // singleselect:project-status
  path: string; // full folder path
  createdDateTime: string; // ISO datetime
  action_count?: number; // derived
}

// Action markdown file inside a project
export interface GTDAction {
  name: string;
  path: string; // full file path
  status: GTDActionStatus; // singleselect:status
  focusDate?: string | null; // ISO datetime or date-only
  dueDate?: string | null; // YYYY-MM-DD
  effort: GTDActionEffort; // singleselect:effort
  contexts?: string[]; // multiselect:contexts (normalized)
  notes?: string;
  createdDateTime: string; // ISO datetime
  project_path: string; // parent project folder path
}

// Habit markdown file in Habits/
export type GTDHabitFrequency =
  | "5-minute"
  | "daily"
  | "every-other-day"
  | "twice-weekly"
  | "weekly"
  | "weekdays"
  | "biweekly"
  | "monthly";

export type GTDHabitStatus = "todo" | "completed";

export interface GTDHabit {
  name: string;
  frequency: GTDHabitFrequency; // singleselect:habit-frequency
  status: GTDHabitStatus; // checkbox:habit-status (normalized)
  path?: string; // full file path
  last_updated?: string; // ISO datetime
  createdDateTime: string; // ISO datetime
}

// Root GTD space
export interface GTDSpace {
  root_path: string;
  is_initialized: boolean;
  isGTDSpace?: boolean;
  projects?: GTDProject[];
  total_actions?: number; // derived sum of action_count
}
```

Supporting utility types in use throughout the app:

- `MarkdownFile` (file metadata from backend)
- `extractMetadata()` for token parsing
- `migrateGTDObjects()` and `migrateMarkdownContent()` for backward compatibility

### Horizons of Focus

Horizons items are already formalized in `src/types/index.ts` and stored as markdown files under their respective directories. The minimal interfaces below reflect the implemented shape:

```ts
// Areas of Focus item (20,000 ft)
export interface GTDArea {
  name: string; // H1 title
  path: string; // full file path
  status: "steady" | "watch" | "incubating" | "delegated";
  reviewCadence: "weekly" | "monthly" | "quarterly" | "annually";
  createdDateTime?: string; // ISO datetime
  // cross-links
  projects?: string[]; // file paths via [!projects-references]
  goals?: string[]; // via [!goals-references]
  vision?: string[];
  purpose?: string[];
}

// Goal (30,000 ft)
export interface GTDGoal {
  name: string; // H1 title
  path: string;
  status: "in-progress" | "waiting" | "completed";
  targetDate?: string | null; // YYYY-MM-DD via [!datetime:goal-target-date:]
  createdDateTime?: string;
  // cross-links
  areas?: string[]; // [!areas-references]
  projects?: string[]; // [!projects-references]
  vision?: string[];
  purpose?: string[];
}

// Vision document (40,000 ft)
export interface GTDVisionDoc {
  name: string; // H1 title
  path: string;
  horizon: "3-years" | "5-years" | "10-years" | "custom";
  createdDateTime?: string;
  // cross-links
  projects?: string[];
  goals?: string[]; // [!goals-references]
  areas?: string[]; // [!areas-references]
  purpose?: string[];
  narrative?: string; // freeform body
}

// Purpose & Principles (50,000 ft)
export interface GTDPurposePrinciplesDoc {
  name: string; // H1 title (e.g., "Purpose & Principles")
  path: string;
  purposeStatement?: string;
  principles?: string; // rich text or markdown list
  createdDateTime?: string;
  // cross-links
  goals?: string[]; // [!goals-references]
  projects?: string[]; // [!projects-references]
  vision?: string[];
  areas?: string[];
}
```

These are intentionally minimal; all cross-links rely on the existing reference markers and `extractHorizonReferences()` already in the codebase.

## File Schemas (Markdown)

Below are representative templates that match the current parser and canonical builders. For exact ordering, optionality, and migration rules, see [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md).

### Project (`Projects/<Project Name>/README.md`)

```markdown
# <Project Name>

## Status

[!singleselect:project-status:in-progress]

## Due Date

[!datetime:due_date:YYYY-MM-DD]

## Desired Outcome

Goal/outcome statement for the project.

## Horizon References

[!areas-references:]
[!goals-references:]
[!vision-references:]
[!purpose-references:]

## References

[!references:]

## Created

[!datetime:created_date_time:2025-10-20T09:00:00]

## Actions

[!actions-list]

## Related Habits

[!habits-list]
```

Actions are sibling files inside the same folder (see below).

### Action (`Projects/<Project Name>/<Action Name>.md`)

```markdown
# <Action Name>

## Status

[!singleselect:status:in-progress]

## Focus Date

[!datetime:focus_date:YYYY-MM-DDTHH:MM]

## Due Date

[!datetime:due_date:YYYY-MM-DD]

## Effort

[!singleselect:effort:medium]

## Contexts

[!multiselect:contexts:]

## Notes

Freeform details.

## References

[!references:]

## Horizon References (optional)

[!projects-references:]
[!areas-references:]
[!goals-references:]
[!vision-references:]
[!purpose-references:]

## Created

[!datetime:created_date_time:2025-10-20T09:00:00]
```

### Habit (`Habits/<Habit Name>.md`)

```markdown
# <Habit Name>

## Status

[!checkbox:habit-status:false] <!-- false = todo, true = completed -->

## Frequency

[!singleselect:habit-frequency:daily]

## Projects References
[!projects-references:]

## Areas References
[!areas-references:]

## Goals References
[!goals-references:]

## Vision References
[!vision-references:]

## Purpose & Principles References
[!purpose-references:]

## Created

[!datetime:created_date_time:2025-10-20T09:00:00]

## History

_New habits are created with the History section and table header already present. Later updates append rows beneath it._
| Date | Time | Status | Action | Details |
|------|------|--------|--------|---------|
```

Habit history parsing remains backward compatible with legacy list-style rows, but new writes normalize back to the canonical table form.
When a legacy list contains lines that do not match the standard completion pattern, migration preserves those lines verbatim in the History block instead of dropping them.
Habit project references may use either the project folder path or a `README.md` / `README.markdown` path, and the parser keeps both forms so existing links round-trip cleanly.

### Areas of Focus (`Areas of Focus/*.md`)

```markdown
# <Area Name>

## Status
[!singleselect:area-status:steady]

## Review Cadence
[!singleselect:area-review-cadence:monthly]

## Projects References
[!projects-references:<json-array-or-empty-string>]

## Goals References
[!goals-references:<json-array-or-empty-string>]

## Vision References (optional)
[!vision-references:<json-array-or-empty-string>]

## Purpose & Principles References (optional)
[!purpose-references:<json-array-or-empty-string>]

## References (optional)
[!references:]

## Created
[!datetime:created_date_time:2025-10-20T09:00:00]

## Description
Ongoing responsibility/role.
```

### Goal (`Goals/*.md`)

```markdown
# <Goal Name>

## Status
[!singleselect:goal-status:in-progress]

## Target Date (optional)
[!datetime:goal-target-date:YYYY-MM-DD]

## Projects References
[!projects-references:<json-array-or-empty-string>]

## Areas References
[!areas-references:<json-array-or-empty-string>]

## Vision References (optional)
[!vision-references:<json-array-or-empty-string>]

## Purpose & Principles References (optional)
[!purpose-references:<json-array-or-empty-string>]

## References (optional)
[!references:]

## Created
[!datetime:created_date_time:2025-10-20T09:00:00]

## Description
What success looks like in 1-2 years.
```

### Vision (`Vision/*.md`)

```markdown
# <Vision Name>

## Horizon
[!singleselect:vision-horizon:3-years]

## Projects References
[!projects-references:<json-array-or-empty-string>]

## Goals References
[!goals-references:<json-array-or-empty-string>]

## Areas References
[!areas-references:<json-array-or-empty-string>]

## Purpose & Principles References (optional)
[!purpose-references:<json-array-or-empty-string>]

## References (optional)
[!references:]

## Created

[!datetime:created_date_time:2025-10-20T09:00:00]

## Narrative
3-5 year vivid picture.
```

### Purpose & Principles (`Purpose & Principles/*.md`)

```markdown
# <Purpose Page Title>

## Projects References
[!projects-references:<json-array-or-empty-string>]

## Goals References
[!goals-references:<json-array-or-empty-string>]

## Vision References
[!vision-references:<json-array-or-empty-string>]

## Areas References (optional)
[!areas-references:<json-array-or-empty-string>]

## References (optional)
[!references:]

## Created

[!datetime:created_date_time:2025-10-20T09:00:00]

## Description
Concise mission statement, values, and principles.
```

## Data Flows

This section summarizes how data moves across layers for each item type.

### Initialization

1. UI calls `initialize_gtd_space(spacePath)` (Tauri).
2. Backend creates folders: Projects, Habits, Someday Maybe, Cabinet, Areas of Focus, Goals, Vision, Purpose & Principles.
3. Frontend stores `root_path` and marks `is_initialized`.

### Projects

- Create

  - UI dialog → `useGTDSpace.createProject(params)` → `create_gtd_project` (Tauri) writes `README.md` and folder.
  - State update: app appends `GTDProject` to `GTDSpace.projects` and emits `gtd-project-created` for UI refresh.

- Read
- `list_gtd_projects(spacePath)` returns project folders plus derived `action_count`.

  - README metadata is enriched in the frontend through `parseProjectMarkdown()`, which normalizes project status, due date, desired outcome, trailing references, habits-list placement, and preserved freeform content.

- Update
  - `useProjectsData.updateProject()` now parses the existing README, applies targeted field changes, and rebuilds it canonically instead of patching markers ad hoc.
  - Changing README Status/Due Date still emits content/metadata events; `useGTDWorkspaceSidebar` updates project overlays live; rename on save triggers `rename_gtd_project` if H1 differs from folder.

### Actions

- Create

  - UI dialog → `useGTDSpace.createAction(params)` → `create_gtd_action` writes a markdown file with canonical tokens, including `[!multiselect:contexts:]` and `[!references:]`.
  - State update: increments parent project `action_count`, emits `gtd-action-created`.

- Read

  - `list_project_actions(projectPath)` returns action files; frontend `useActionsData` reads each file and parses it through `parseActionMarkdown()` to build action list entries and status counts.

- Update
  - `updateActionStatus(idOrPath, newStatus)` now rebuilds canonical action markdown through `rebuildActionMarkdown()` instead of regex-replacing only the status token.
  - Sidebar action rows are hydrated from `list_project_actions(projectPath)` plus per-file metadata overlays maintained by `useGTDWorkspaceSidebar`.

### Habits

- Create

  - UI dialog → `create_gtd_habit(spacePath, habitName, frequency, focusTime?, references?)` writes file with checkbox, frequency, and a seeded History section including the standard table header.

- Read

  - `useHabitsHistory` lists `Habits/` files, reads content, parses it through `parseHabitContent()`, computes streaks/success rates, and derives next reset times from shared calendar-window logic.
  - Reset-maintenance rows such as `Auto-Reset` and `Backfill` are excluded from streak/success analytics so only actual completion attempts affect those metrics.

- Update
  - `update_habit_status(habitPath, 'todo'|'completed')` toggles checkbox and appends a history row; frontend emits `habit-content-changed` to refresh open editors.
  - Auto-reset: `check_and_reset_habits(spacePath)` runs on schedule and at startup to reset completed habits per frequency, recording `Auto-Reset` or `Backfill` in history.
  - `Auto-Reset` marks the current scheduled reset boundary. `Backfill` marks older missed reset periods that are being filled in retroactively after the app was offline or the scheduler missed runs.
  - Reset windows are calendar-based, not rough elapsed-day approximations. For example, `twice-weekly` uses Tuesday/Friday boundaries and `monthly` resets on the first day of the next month.

### Horizons of Focus (Areas, Goals, Vision, Purpose & Principles)

- Create/Read

  - Treated as normal markdown files under their respective directories and surfaced in the sidebar via `list_markdown_files`.
  - Cross-linking uses reference markers; clicking a reference opens the target file (`open-reference-file` event).

- Update
  - Any save or metadata change in these folders triggers a targeted section reload in `useGTDWorkspaceSidebar`, which keeps titles and renamed file paths in sync without reloading the whole workspace tree.

## Cross-Linking Model

- References are many-to-many and path-based: items store arrays of file paths in the appropriate `[...]references` marker.
- `extractHorizonReferences(content)` returns arrays for Areas/Goals/Vision/Purpose/Projects/References.
- No hard referential integrity is enforced; missing targets simply don’t resolve at render time.

Implementation detail: generic `[!references:]` is supported alongside horizon-specific reference markers. Both are parsed by `metadata-extractor.ts`.

## Eventing and Sync

Key events used for UI coherence:

- `gtd-project-created` / `gtd-action-created` – emitted on creation for sidebar/list refresh
- `content:changed` / `content:metadata-changed` / `content:saved` – internal bus for live UI updates
- `project-renamed` / `action-renamed` / `section-file-renamed` – emitted after successful rename ops
- `habit-status-updated` / `habit-content-changed` – keep habit editors and lists in sync
- `file-changed` (from Tauri watcher) – backend filesystem changes to refresh views

Implementation note: the workspace sidebar is now split into a thin component entrypoint, a dedicated controller hook (`useGTDWorkspaceSidebar`), and presentational section components under `src/components/gtd/sidebar/`.

## Migration Guarantees

The app auto-migrates older content formats:

- `created_date` → `created_date_time`
- `focus_date_time` → `focus_date`
- Multiselect `status`/`project-status`/`effort` → single-select tokens
- Legacy status values mapped to canonical tokens (`done` → `completed`, etc.)

See `src/utils/data-migration.ts` for details.

## Naming and Renames

- Projects: H1 in README is authoritative for rename; saving can trigger `rename_gtd_project` to match folder.
- Actions: H1 is authoritative; saving can trigger `rename_gtd_action` to match filename.
- Habits & Horizons: Sidebar reflects the H1 as display name; files can be renamed manually via the file system or future UI affordances.

## Date/Time Conventions

- `dueDate`: date-only `YYYY-MM-DD`.
- `focusDate`: date or ISO datetime when scheduling matters.
- `createdDateTime`: ISO datetime.

## Implementation Pointers

- Hooks: `useGTDSpace`, `useActionsData`, `useHabitsHistory`, `useHabitTracking`.
- Backend commands: `initialize_gtd_space`, `list_gtd_projects`, `create_gtd_project`, `create_gtd_action`, `create_gtd_habit`, `list_project_actions`, `update_habit_status`.
- Blocks and markers: see `src/components/editor/blocks/*` and `src/utils/blocknote-preprocessing/`.

## Open Follow-Ups

- The dashboard quick-create flow still seeds some legacy/simple horizon markdown instead of always using the canonical builders. Goals are the clearest example: one path still writes `target_date` while the canonical schema uses `goal-target-date`.
- Reference validation remains path-based and permissive; broken targets fail softly at render time rather than being rejected at write time.
- Additional horizon analytics and richer relationship views are still future-facing rather than part of the current canonical model.
