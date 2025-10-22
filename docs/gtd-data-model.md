# GTD Data Model and Data Flows

Updated: October 20, 2025

This document defines the data structures and end-to-end data flows for GTD Space items: Habits, Actions, Projects, Areas of Focus, Goals, Vision, and Purpose & Principles. It aligns with the current React + Tauri implementation and the file-based markdown storage model.

Goals of this doc:

- Specify canonical fields, tokens, and file locations for each item type
- Show how data moves between UI, frontend hooks, and Tauri commands
- Clarify cross-linking between Horizons of Focus and day-to-day work

Scope notes:

- “Current” indicates types and flows implemented in code today.
- “Proposed” indicates types intended for Horizons-of-Focus content (Areas, Goals, Vision, Purpose & Principles) that are already supported as markdown files and references but not yet formalized as TypeScript interfaces.

## Directory Structure (on Disk)

When initializing a GTD space, Tauri creates these top-level folders:

```
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
  - Examples: `status`, `project-status`, `effort`, `habit-frequency`
- Multi-select: `[!multiselect:<field>:<comma-separated-values>]`
  - Example: `contexts` (normalized tokens such as `home`, `office`, `computer`, `phone`, `errands`, `anywhere`).
- Checkbox: `[!checkbox:habit-status:true|false]` (used for habits)
- Date/Time: `[!datetime:<field>:<ISO or YYYY-MM-DD>]`
  - Examples: `due_date` (date), `focus_date` (date or datetime), `created_date_time`
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
  - Mixed lists: `[!projects-areas-list]`, `[!goals-areas-list]`, `[!visions-goals-list]`

Notes on canonical values:

- Action/Project status uses tokens: `in-progress`, `waiting`, `completed` (and `cancelled` for actions).
- Habit status is a checkbox (true = completed, false = todo), normalized to `todo`/`completed` in logic.
- Effort uses: `small` | `medium` | `large` | `extra-large`.
- Habit frequency uses: `daily` | `every-other-day` | `twice-weekly` | `weekly` | `weekdays` | `biweekly` | `monthly`.

## Data Structures

### Current (defined in `src/types/index.ts`)

```ts
// Project status tokens
export type GTDProjectStatus = "in-progress" | "waiting" | "completed";

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

### Proposed (Horizons of Focus)

Horizons items are already stored as markdown files under their respective directories and are surfaced in the sidebar. To formalize them in TypeScript and enable richer UI, the following interfaces can be added to `src/types/index.ts` later:

```ts
// Areas of Focus item (20,000 ft)
export interface GTDAreaOfFocus {
  name: string; // H1 title
  path: string; // full file path
  description?: string; // freeform body
  createdDateTime?: string; // ISO datetime
  // cross-links
  projects?: string[]; // file paths via [!projects-references]
  goals?: string[]; // via [!goals-references]
}

// Goal (30,000 ft)
export interface GTDGoal {
  name: string; // H1 title
  path: string;
  description?: string;
  targetDate?: string | null; // YYYY-MM-DD via [!datetime:target_date:]
  status?: "in-progress" | "waiting" | "completed"; // optional singleselect
  createdDateTime?: string;
  // cross-links
  areas?: string[]; // [!areas-references]
  projects?: string[]; // [!projects-references]
}

// Vision document (40,000 ft)
export interface GTDVisionDoc {
  name: string; // H1 title
  path: string;
  narrative?: string; // freeform body
  horizon?: "3-years" | "5-years" | "custom";
  createdDateTime?: string;
  // cross-links
  goals?: string[]; // [!goals-references]
  areas?: string[]; // [!areas-references]
}

// Purpose & Principles (50,000 ft)
export interface GTDPurposePrinciplesDoc {
  name: string; // H1 title (e.g., "Purpose & Principles")
  path: string;
  purposeStatement?: string;
  principles?: string[]; // bullet points
  createdDateTime?: string;
  // cross-links
  goals?: string[]; // [!goals-references]
  projects?: string[]; // [!projects-references]
}
```

These are intentionally minimal; all cross-links rely on the existing reference markers and `extractHorizonReferences()` already in the codebase.

## File Schemas (Markdown)

Below are recommended templates that match current parsing/blocks.

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

## Focus Date (optional)

[!datetime:focus_date:YYYY-MM-DDTHH:MM]

## Horizon References

[!projects-references:]
[!areas-references:]
[!goals-references:]
[!vision-references:]
[!purpose-references:]

## Created

[!datetime:created_date_time:2025-10-20T09:00:00]

## History

_When you first create a habit, the file is generated without a history table. The first status update will create this table automatically with the following headers:_
| Date | Time | Status | Action | Details |
|------|------|--------|--------|---------|
```

### Areas of Focus (`Areas of Focus/*.md`) – Proposed shape

```markdown
# <Area Name>

## Description

Ongoing responsibility/role.

## Horizon References

[!projects-references:]
[!goals-references:]

## Created

[!datetime:created_date_time:2025-10-20T09:00:00]
```

### Goal (`Goals/*.md`) – Proposed shape

```markdown
# <Goal Name>

## Status (optional)

[!singleselect:status:in-progress]

## Target Date (optional)

[!datetime:target_date:YYYY-MM-DD]

## Description

What success looks like in 1–2 years.

## Horizon References

[!areas-references:]
[!projects-references:]

## Created

[!datetime:created_date_time:2025-10-20T09:00:00]
```

### Vision (`Vision/*.md`) – Proposed shape

```markdown
# <Vision Name>

## Narrative

3–5 year vivid picture.

## Horizon References

[!goals-references:]
[!areas-references:]

## Created

[!datetime:created_date_time:2025-10-20T09:00:00]
```

### Purpose & Principles (`Purpose & Principles/*.md`) – Proposed shape

```markdown
# Purpose & Principles

## Purpose

Concise mission statement.

## Principles

- Principle 1
- Principle 2

## Horizon References

[!goals-references:]
[!projects-references:]

## Created

[!datetime:created_date_time:2025-10-20T09:00:00]
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

  - README metadata (status/due date/title) parsed in backend + enriched in frontend. Description is extracted from the "## Desired Outcome" section ("## Description" is still supported for backward compatibility).

- Update
  - Changing README Status/Due Date emits content/metadata events; sidebar updates `projectMetadata` live; rename on save triggers `rename_gtd_project` if H1 differs from folder.

### Actions

- Create

  - UI dialog → `useGTDSpace.createAction(params)` → `create_gtd_action` writes a markdown file with canonical tokens, including `[!multiselect:contexts:]` and `[!references:]`.
  - State update: increments parent project `action_count`, emits `gtd-action-created`.

- Read

  - `list_project_actions(projectPath)` returns action files; frontend `useActionsData` reads each file → `extractMetadata()` → builds action list and status counts.

- Update
  - `updateActionStatus(idOrPath, newStatus)` rewrites file content tokens and dispatches `content-updated` for reactive components.

### Habits

- Create

  - UI dialog → `create_gtd_habit(spacePath, habitName, frequency, status='todo')` writes file with checkbox + frequency; a History section is present but the table is added on first status change.

- Read

  - `useHabitsHistory` lists `Habits/` files, reads content, parses history table, computes streaks/success rates, and extracts horizon references via `extractHorizonReferences()`.

- Update
  - `update_habit_status(habitPath, 'todo'|'completed')` toggles checkbox and appends a history row; frontend emits `habit-content-changed` to refresh open editors.
  - Auto-reset: `check_and_reset_habits(spacePath)` runs on schedule and at startup to reset completed habits per frequency, recording “Auto-Reset” or “Catch-up Reset” in history.

### Horizons of Focus (Areas, Goals, Vision, Purpose & Principles)

- Create/Read

  - Treated as normal markdown files under their respective directories and surfaced in the sidebar via `list_markdown_files`.
  - Cross-linking uses reference markers; clicking a reference opens the target file (`open-reference-file` event).

- Update
  - Any save or metadata change in these folders triggers sidebar refresh for titles.

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

- Hooks: `useGTDSpace`, `useActionsData`, `useHabitsHistory`, `useHabitTracking`, `useHabitScheduler`.
- Backend commands: `initialize_gtd_space`, `list_gtd_projects`, `create_gtd_project`, `create_gtd_action`, `create_gtd_habit`, `list_project_actions`, `update_habit_status`.
- Blocks and markers: see `src/components/editor/blocks/*` and `src/utils/blocknote-preprocessing.ts`.

## Future Work

- Add TypeScript interfaces and CRUD commands for Horizons items (Areas/Goals/Vision/Purpose & Principles) to enable richer dashboarding and filtering.
- Optional status for goals, and light-weight progress metrics at the Horizons level.
- Reference validation and jump-to-definition UX enhancements.

Known inconsistencies to consider resolving in code:

- Project README generator uses "## Desired Outcome" while the project lister extracts description from "## Description".
- The generic page creator for Habits creates a History section without a table; the table is added on first update (correct behavior), but older docs/screenshots may show a pre-seeded table.
