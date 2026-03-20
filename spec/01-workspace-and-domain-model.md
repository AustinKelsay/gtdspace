# GTD Workspace and Domain Model

This document describes the GTD Space workspace and item model implemented in this repository. When this spec differs from other docs, the code and tests win.

## Workspace Shape

- A GTD workspace is a single root folder that contains the GTD directories directly beneath it. The backend initializer creates `Areas of Focus`, `Goals`, `Vision`, `Purpose & Principles`, `Projects`, `Habits`, `Someday Maybe`, and `Cabinet` in that root. `initialize_gtd_space` also seeds overview/example files as part of initialization, not as a separate step. [`src-tauri/src/commands/mod.rs`](../src-tauri/src/commands/mod.rs#L3265), [`src-tauri/src/commands/mod.rs`](../src-tauri/src/commands/mod.rs#L3277).
- The current workspace validation is weaker than the full structure: `useGTDSpace` only waits for `Projects`, `Habits`, `Someday Maybe`, and `Cabinet` before considering the space ready. Horizon folders may still be missing at that point. [`src/hooks/useGTDSpace.ts`](../src/hooks/useGTDSpace.ts#L31).
- The frontend file manager does not auto-load the last workspace on startup. It starts empty and only initializes a missing folder if the selected path is not a GTD subfolder inside an existing GTD workspace. [`src/hooks/useFileManager.ts`](../src/hooks/useFileManager.ts#L49).

## Top-Level Folders

- `Projects`: project folders; each project is a directory with a canonical `README.md` and action files inside it. [`src-tauri/src/commands/mod.rs`](../src-tauri/src/commands/mod.rs#L3330), [`src/types/index.ts`](../src/types/index.ts#L522).
- `Habits`: one markdown file per habit. [`src/types/index.ts`](../src/types/index.ts#L650).
- `Areas of Focus`: one markdown file per area. [`src/types/index.ts`](../src/types/index.ts#L678).
- `Goals`: one markdown file per goal. [`src/types/index.ts`](../src/types/index.ts#L709).
- `Vision`: one markdown file per vision document. [`src/types/index.ts`](../src/types/index.ts#L738).
- `Purpose & Principles`: one markdown file per purpose document. [`src/types/index.ts`](../src/types/index.ts#L762).
- `Someday Maybe` and `Cabinet`: flat markdown reference areas. [`src-tauri/src/commands/mod.rs`](../src-tauri/src/commands/mod.rs#L3430), [`src/components/gtd/GTDWorkspaceSidebar.tsx`](../src/components/gtd/GTDWorkspaceSidebar.tsx#L91).

## Canonical Item Types

- Project: `name`, `description`, optional `dueDate`, `status`, `path`, `createdDateTime`, optional derived `action_count`. Loaded project data can normalize to `in-progress`, `waiting`, `completed`, or `cancelled`, but the backend project creator only accepts `in-progress`, `waiting`, and `completed`. [`src/types/index.ts`](../src/types/index.ts#L507), [`src-tauri/src/commands/mod.rs`](../src-tauri/src/commands/mod.rs#L3897).
- Action: `name`, `path`, `status`, optional `focusDate`, optional `dueDate`, `effort`, optional `notes`, `createdDateTime`, `project_path`. The same status set is used here. [`src/types/index.ts`](../src/types/index.ts#L542).
- Habit: `name`, `frequency`, `status`, optional `path`, optional `last_updated`, `createdDateTime`. Habit status is normalized to `todo` or `completed`, but the markdown may still use a checkbox field. [`src/types/index.ts`](../src/types/index.ts#L650).
- Area: `name`, `path`, `status`, `reviewCadence`, optional `stewards`, optional `createdDateTime`, plus horizon links. [`src/types/index.ts`](../src/types/index.ts#L678).
- Goal: `name`, `path`, `status`, optional `targetDate`, optional `createdDateTime`, plus horizon links. [`src/types/index.ts`](../src/types/index.ts#L709).
- Vision: `name`, `path`, `horizon`, optional `createdDateTime`, plus horizon links and optional narrative. [`src/types/index.ts`](../src/types/index.ts#L738).
- Purpose & Principles: `name`, `path`, optional `createdDateTime`, plus horizon links and optional purpose/principles body. [`src/types/index.ts`](../src/types/index.ts#L762).

## Default Values

- New projects default to `status = in-progress`, `description` is required in the dialog, and `dueDate` is date-only. [`src/components/gtd/GTDProjectDialog.tsx`](../src/components/gtd/GTDProjectDialog.tsx#L193).
- New actions default to `status = in-progress` and `effort = medium`. If a focus date is entered without a time, the dialog stores `T09:00:00` as the default time. [`src/components/gtd/GTDActionDialog.tsx`](../src/components/gtd/GTDActionDialog.tsx#L41).
- New habits default to `status = todo`, `frequency = daily`, and optional `focusTime` is stored separately. The UI intentionally does not expose habit status as a creation control. [`src/components/gtd/CreateHabitDialog.tsx`](../src/components/gtd/CreateHabitDialog.tsx#L109), [`src/components/gtd/CreateHabitDialog.tsx`](../src/components/gtd/CreateHabitDialog.tsx#L296).
- New area pages default to `status = steady` and `reviewCadence = monthly`. [`src/components/gtd/CreatePageDialog.tsx`](../src/components/gtd/CreatePageDialog.tsx#L307).
- New goal pages default to `status = in-progress` and no target date. [`src/components/gtd/CreatePageDialog.tsx`](../src/components/gtd/CreatePageDialog.tsx#L293).
- New vision pages default to `horizon = 3-years`. [`src/components/gtd/CreatePageDialog.tsx`](../src/components/gtd/CreatePageDialog.tsx#L280).
- New purpose pages default to the title `Purpose & Principles`. [`src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts#L807).

## File Location Rules

- Project folders live under `Projects/<Project Name>/`, and the canonical project page is `README.md` or `README.markdown`. Action files are siblings inside that same folder. [`src/components/gtd/GTDWorkspaceSidebar.tsx`](../src/components/gtd/GTDWorkspaceSidebar.tsx#L133), [`src/hooks/useGTDSpace.ts`](../src/hooks/useGTDSpace.ts#L145).
- Horizon pages live directly in their folder, and the folder `README.md` acts as the overview/index page for that horizon. The sidebar treats that README as the folder landing page and hides it from the child list. [`src/utils/horizon-readme-utils.ts`](../src/utils/horizon-readme-utils.ts#L170), [`src/components/gtd/GTDWorkspaceSidebar.tsx`](../src/components/gtd/GTDWorkspaceSidebar.tsx#L267).
- `Someday Maybe` and `Cabinet` are flat markdown sections with optional ad hoc files; they are not special typed horizon folders. [`src/components/gtd/GTDWorkspaceSidebar.tsx`](../src/components/gtd/GTDWorkspaceSidebar.tsx#L149).

## Reference and Relationship Rules

- Project README files can carry outbound horizon links with `areas-references`, `goals-references`, `vision-references`, `purpose-references`, and generic `references`. [`src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts#L475), [`src/utils/metadata-extractor.ts`](../src/utils/metadata-extractor.ts#L90).
- Project creation also writes the reverse relationship into the selected horizon pages by upserting `projects-references`. [`src/components/gtd/GTDProjectDialog.tsx`](../src/components/gtd/GTDProjectDialog.tsx#L93).
- Habit pages can reference `projects`, `areas`, `goals`, `vision`, `purpose`, plus generic `references`. README targets are filtered out before saving. [`src/components/gtd/CreateHabitDialog.tsx`](../src/components/gtd/CreateHabitDialog.tsx#L87), [`src/components/gtd/CreateHabitDialog.tsx`](../src/components/gtd/CreateHabitDialog.tsx#L305).
- Horizon README sync normalizes reference paths, deduplicates them, and sorts them case-insensitively. It always emits a canonical `README.md` section order. [`src/utils/horizon-readme-utils.ts`](../src/utils/horizon-readme-utils.ts#L147), [`src/utils/horizon-readme-utils.ts`](../src/utils/horizon-readme-utils.ts#L170).
- Horizon page references resolve relative to the workspace root, while bare project references resolve to `Projects/<name>/README.md`. [`src/hooks/useHorizonsRelationships.ts`](../src/hooks/useHorizonsRelationships.ts#L120).

## Markdown Contract

- Metadata uses inline markers, not YAML frontmatter. Current canonical markers are `singleselect`, `multiselect`, `checkbox`, `datetime`, references markers, and rendered list markers such as `actions-list` and `habits-list`. [`src/utils/metadata-extractor.ts`](../src/utils/metadata-extractor.ts#L26).
- `created_date` migrates to `created_date_time`, `focus_date_time` migrates to `focus_date`, multiselect `status`/`project-status`/`effort` collapse to single values, and legacy status words are normalized to canonical slugs. [`src/utils/data-migration.ts`](../src/utils/data-migration.ts#L13).
- `extractMetadata()` accepts reference payloads as JSON arrays or CSV, and it normalizes slashes and strips quotes during parsing. [`src/utils/metadata-extractor.ts`](../src/utils/metadata-extractor.ts#L117).
- Canonical project, habit, area, goal, vision, and purpose builders all emit a stable section order and end with a trailing newline. [`src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts#L425).

## Canonical Section Order

- Project: `# title`, `## Status`, `## Due Date (optional)`, `## Desired Outcome`, `## Horizon References`, `## References (optional)`, `## Created`, `## Actions`, `## Related Habits (optional)`, then any extra content. [`src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts#L463).
- Habit: `# title`, `## Status`, `## Frequency`, optional `## Focus Date`, `## Projects References`, `## Areas References`, `## Goals References`, `## Vision References`, `## Purpose & Principles References`, `## References`, `## Created`, optional `## Notes`, `## History`. [`src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts#L538).
- Area: `# title`, `## Status`, `## Review Cadence`, `## Projects References`, optional `## Areas References`, `## Goals References`, optional `## Vision References`, optional `## Purpose & Principles References`, `## References (optional)`, `## Created`, `## Description`. [`src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts#L614).
- Goal: `# title`, `## Status`, optional `## Target Date (optional)`, `## Projects References`, `## Areas References`, optional `## Vision References`, optional `## Purpose & Principles References`, `## References (optional)`, `## Created`, `## Description`. [`src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts#L687).
- Vision: `# title`, `## Horizon`, `## Projects References`, `## Goals References`, `## Areas References`, optional `## Purpose & Principles References`, `## References (optional)`, `## Created`, `## Narrative`. [`src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts#L754).
- Purpose: `# title`, `## Projects References`, `## Goals References`, `## Vision References`, optional `## Areas References`, `## References (optional)`, `## Created`, `## Description`. [`src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts#L810).
- Horizon overview README: `# <Horizon> Overview`, `## Altitude`, `## Review Cadence`, `## Created`, `## Why this horizon matters`, `## How to work this horizon in GTD Space`, `## Horizon Pages Overview`, `## Reference Index`, `## Horizon Pages`. [`src/utils/horizon-readme-utils.ts`](../src/utils/horizon-readme-utils.ts#L170).

## Calendar and Triggers

- The calendar view is derived data, not a primary store. It includes projects with due dates, actions with focus or due dates, habits with a parseable created timestamp, Google Calendar events, and fallback project entries from in-memory GTD space state. [`src/hooks/useCalendarData.ts`](../src/hooks/useCalendarData.ts#L196).
- Calendar scans apply markdown migrations in memory only; they do not rewrite files during calendar loading. [`src/hooks/useCalendarData.ts`](../src/hooks/useCalendarData.ts#L242).
- Calendar refreshes are event-driven. Relevant changes in projects or habits, as well as structural events like create/rename/delete, schedule a reload. [`src/hooks/useCalendarData.ts`](../src/hooks/useCalendarData.ts#L590).
- Habit reset is the only built-in automation-like behavior. The backend runs `check_and_reset_habits`, and the app uses it to keep habit state current. [`src-tauri/src/commands/mod.rs`](../src-tauri/src/commands/mod.rs#L4453).

## Known Mismatches

- `GTDDashboard` quick-create still seeds simpler legacy horizon markdown in some cases instead of the canonical builders. Goals are the clearest example: it writes `[!datetime:target_date:]`, while the canonical goal schema uses `[!datetime:goal-target-date:]`. [`src/components/gtd/GTDDashboard.tsx`](../src/components/gtd/GTDDashboard.tsx#L666), [`src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts#L676).
- `useGTDSpace.checkGTDSpace()` only checks four folders, so it is not a full guarantee that the workspace already has every GTD directory. [`src/hooks/useGTDSpace.ts`](../src/hooks/useGTDSpace.ts#L38).
- `useFileManager` auto-initializes missing folders that look like new GTD roots, but refuses to initialize a missing path that is actually inside an existing GTD workspace. [`src/hooks/useFileManager.ts`](../src/hooks/useFileManager.ts#L100).

## Source Notes

- Workspace initialization and seeding: [`src-tauri/src/commands/mod.rs`](../src-tauri/src/commands/mod.rs#L3265)
- Current GTD types and defaults: [`src/types/index.ts`](../src/types/index.ts#L507)
- Markdown builders and canonical section order: [`src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts#L425)
- Metadata parsing and migrations: [`src/utils/metadata-extractor.ts`](../src/utils/metadata-extractor.ts#L26), [`src/utils/data-migration.ts`](../src/utils/data-migration.ts#L13)
- Horizon overview syncing: [`src/utils/horizon-readme-utils.ts`](../src/utils/horizon-readme-utils.ts#L170)
- Workspace loading and subfolder guardrails: [`src/hooks/useFileManager.ts`](../src/hooks/useFileManager.ts#L72)
- Calendar derivation and reload triggers: [`src/hooks/useCalendarData.ts`](../src/hooks/useCalendarData.ts#L196)
- Horizon creation defaults: [`src/components/gtd/CreatePageDialog.tsx`](../src/components/gtd/CreatePageDialog.tsx#L260), [`src/components/gtd/CreateHabitDialog.tsx`](../src/components/gtd/CreateHabitDialog.tsx#L296)
