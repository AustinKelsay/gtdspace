# Project Page Template - UI and Markdown Standard

Updated: November 4, 2025

This document defines the standardized Project page template for GTD Space. It brings Projects in line with the refined Action, Habit, and Horizons templates so designers, engineers, and content authors work from a single blueprint.

- Describes the target UI layout and interactive behavior for `Projects/<Project>/README.md` files rendered in the desktop app.
- Establishes the canonical markdown ordering that the renderer enforces when rebuilding or migrating project folders.
- Maps each UI element to existing hooks, blocks, and utilities so implementation reuses proven flows instead of inventing new ones.

## Goals
- Deliver a consistent, low-friction authoring experience for projects that mirrors the Action template but surfaces folder-wide context.
- Keep metadata tokens predictable to simplify parsing, migrations, and cross-linking with Horizons and Actions.
- Make Desired Outcome, linked references, and live action lists easy to scan without overwhelming the reading experience.
- Lean on shared theming primitives for accessibility and light/dark parity.

## At-a-Glance
- Layout: Same `px-12` left gutter, compact header plus divider, bare BlockNote body used across modern templates.
- Title: H1 input that mirrors Actions; editing prompts rename of the containing project folder when the saved name differs.
- Header fields: Project Status, Due Date, Created timestamp, Areas references, Goals references, Vision references, Purpose & Principles references, and generic References.
- Body: Structured Desired Outcome block (BlockNote) with optional supporting sections.
- Lists: Canonical `[!actions-list]` and `[!habits-list]` blocks render below metadata to surface the current execution and reinforcement footprint.
- Canonical tokens: `project-status`, `due_date`, horizon reference markers, generic `references`, `created_date_time`.

## UI Specification

### Header (Compact Grid)
- Left gutter: `px-12` from the page edge (reuse the shared page shell).
- Title: `text-5xl font-bold` input; typing updates the H1 and triggers `rename_gtd_project` prompts when the persisted folder name diverges.
- Field grid (2 columns, `gap-y-2 gap-x-6`):
  - Row 1: Project Status (left) • Due Date (right).
  - Row 2: Created (left, read-only text) • Areas References (right chips).
  - Row 3: Goals References (left chips) • Vision References (right chips, optional).
  - Row 4: Purpose & Principles References (left chips, optional) • References (right chips, optional, supports external URLs).
- Field controls:
  - Project Status: singleselect with tokens `in-progress | waiting | completed`. Defaults to `in-progress` on creation. (Matches `GTDProjectStatus`.)
  - Due Date: date picker with ISO output (`YYYY-MM-DD`). Supports clearing; blank removes the token.
  - Areas/Goals/Vision/Purpose references: chip groups that open the shared horizon reference dialog; selections stored as compact JSON arrays in the markdown markers. Chips respect display names resolved from file paths.
  - References: multi-select chip group that surfaces Cabinet, Someday Maybe, and URL entries; writes CSV by default and gracefully upgrades legacy JSON.
  - Created: read-only ISO datetime rendered as a friendly string. Set on first build and remains stable.
- Visual style: Tailwind utilities backed by theme variables (see `docs/theming.md`). Controls share Action/Habit focus rings and spacing.
- Divider: `border-t border-border` separates header and body in line with other standardized templates.

### Body
- Desired Outcome block: Bare BlockNote editor describing success, constraints, and key deliverables. Parent adds `align-with-header` so the first line aligns with the header gutter.
- Supporting sections: Optional headings such as “Scope”, “Notes”, or “Resources” remain in canonical order after Desired Outcome but are authored in the same BlockNote surface.
- List blocks: `[!actions-list]` renders read-only live status of child actions; `[!habits-list]` (optional) spotlights reinforcing habits. Both blocks adopt the existing block renderer styles.

## Markdown Specification (Canonical Ordering)

Project README markdown is rebuilt in this exact sequence. Blank lines separate logical sections; optional sections are omitted when empty.

```
# <Project Title>

## Status
[!singleselect:project-status:<in-progress|waiting|completed>]

## Due Date (optional)
[!datetime:due_date:YYYY-MM-DD]

## Desired Outcome
<Freeform BlockNote content. Always present; defaults to a placeholder paragraph when blank.>

## Horizon References
[!areas-references:<json-array-or-empty-string>]
[!goals-references:<json-array-or-empty-string>]
[!vision-references:<json-array-or-empty-string>]
[!purpose-references:<json-array-or-empty-string>]

## References (optional)
[!references:<comma-separated file paths or URLs>]

## Created
[!datetime:created_date_time:YYYY-MM-DDTHH:MM:SSZ]

## Actions
[!actions-list]

## Related Habits (optional)
[!habits-list]
```

Notes:
- Horizon reference tokens normalize to compact JSON arrays. Legacy CSV strings remain readable, but rebuild emits JSON to align with Horizons templates.
- The generic `References` marker keeps CSV encoding for compatibility with the Action template. Converters may emit JSON in the future, but the renderer should accept both formats.
- `[!actions-list]` always renders even when empty; the block shows the “No actions yet” empty state.
- `[!habits-list]` is omitted entirely when the user removes the block.

## Behaviors and Data Flow
- Live rebuild: Editing header fields or body content regenerates canonical markdown and updates the open tab. The shared no-op guard prevents redundant writes.
- Stable Created: Captured on first render using existing created timestamp utilities; never regenerated once set.
- Reference dialogs: Reuses the horizon reference dialog leveraged by Area, Goal, and Habit templates. Selections write JSON arrays into the corresponding horizon markers and CSV into `[!references:]`.
- Folder awareness: Saving a renamed title triggers `rename_gtd_project`, which updates the folder name and rehydrates open child action tabs via `project-renamed` events.
- Lists: `[!actions-list]` queries sibling files via `list_project_actions(projectPath)`; `[!habits-list]` filters habits referencing the project via `extractHorizonReferences()`.
- Sidebar metadata: Status, due date, and action counts surface in the Projects sidebar and dashboard cards using `GTDProject` objects documented in `docs/gtd-data-model.md`.

## Implementation Map
- Entry point: `src/components/gtd/ProjectPage.tsx` combines the shared page shell, header builder, BlockNote body, and list blocks. It lives beside `ActionPage`, `HabitPage`, and `AreaPage`.
- Routing: Ensure the editor router mounts `ProjectPage` for `Projects/**/README.md`. Other files within the folder (actions) continue to use `ActionPage`.
- Markdown builder: Add `buildProjectMarkdown()` to `src/utils/gtd-markdown-helpers.ts`, enforcing ordering, JSON normalization for horizon references, and CSV preservation for `[!references:]`.
- Metadata parsing: Extend `src/utils/metadata-extractor.ts` if needed to normalize optional due dates and horizon JSON arrays. `GTDProject` already expects `dueDate`, `status`, and `createdDateTime`.
- Reference dialog: Reuse existing component with props to toggle which groups appear (Areas, Goals, Vision, Purpose, Cabinet/Someday). Ensure the dialog exposes both local files and URL entry to cover generic references.
- Blocks: Confirm the BlockNote schema includes stub nodes for `[!actions-list]` and `[!habits-list]`, and that migration utilities inject them when missing.

## Theming and Accessibility
- Header controls inherit theme variables (`--background`, `--foreground`, `--border`); focus states mirror the Action template for consistency.
- Status badges and read-only timestamps use `text-muted-foreground` to de-emphasize non-editable fields without reducing contrast.
- BlockNote content respects reduced motion settings and screen readers announce section headings in canonical order.
- Chip groups expose keyboard navigation (arrow keys, enter/delete) and convey selection state via aria attributes.

## QA Checklist (Projects)
- Title aligns with the first body line; header divider renders once.
- Updating Project Status only modifies the `[!singleselect:project-status:]` marker.
- Clearing or changing Due Date updates only the `[!datetime:due_date:]` token and handles timezone normalization.
- Horizon reference chips mirror JSON array order; removing a chip updates the respective marker immediately.
- Generic References chips emit CSV entries and persist after save/reload.
- Created timestamp remains unchanged across edits and migrations.
- `[!actions-list]` accurately reflects child action files and live updates when actions are added, completed, or deleted.
- `[!habits-list]` hides automatically when removed from the page.

## Future Enhancements
- Inline summary chips for action counts (e.g., “4 open actions”) beside the header once supporting metrics land.
- Optional “Next Review” field that ties into cadence reminders shared with Areas.
- Dedicated “Key Resources” block that reuses Cabinet previews without cluttering the generic References section.
- Project health indicators (e.g., status vs. due date) surfaced in the sidebar and dashboard once analytics mature.

---

References:
- `docs/action-page-template.md` for shared layout and canonicalization patterns.
- `docs/habit-page-template.md` for list block behaviors and reference dialogs.
- `docs/gtd-data-model.md` for canonical project tokens, folder structure, and data flows.
