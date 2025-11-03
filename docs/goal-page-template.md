# Goal Page Template - UI and Markdown Standard

Updated: November 2, 2025

This document defines the standardized Goal horizon page template for GTD Space. It mirrors the Action, Habit, and Area templates so designers, engineers, and content contributors share a single blueprint for the Horizons of Focus experience.

- Describes the target layout and interactive behavior for Goal files rendered in the desktop app.
- Defines the canonical markdown ordering enforced when rebuilding or migrating Goal pages.
- Maps UI elements to existing hooks, blocks, and utilities so implementation can reuse proven flows.

## Goals
- Deliver a motivating yet lightweight authoring surface for Goals that stays consistent with other Horizons pages.
- Keep metadata tokens predictable to simplify parsing, migrations, and cross-linking with Areas and Projects.
- Spotlight the target date, success criteria, and supporting references without overwhelming the reading experience.
- Lean on shared theming primitives for accessibility and light/dark parity.

## At-a-Glance
- Layout: Same `px-12` left gutter, compact header plus divider, bare BlockNote body.
- Title: H1 input identical to Actions; no background chrome.
- Header fields: Goal Status, Target Date, Created timestamp, Projects references, Areas references, optional Vision and Purpose references.
- Body: Freeform description region aligned with the header gutter.
- References: Dialog-driven pickers for Horizons (Areas, Projects, Vision, Purpose & Principles) reused from other page types.
- Canonical tokens: `goal-status`, `goal-target-date`, horizon reference markers, `created_date_time`.

## UI Specification

### Header (Compact Grid)
- Left gutter: `px-12` from the page edge (reuse the shared page shell).
- Title: `text-5xl font-bold` input; typing updates the H1 and triggers rename prompts when the saved name differs.
- Field grid (2 columns, `gap-y-2 gap-x-6`):
  - Row 1: Goal Status (left) • Target Date (right).
  - Row 2: Created (left, read-only text) • Projects References (right chips).
  - Row 3: Areas References (left chips) • Vision References (right chips, optional).
  - Row 4: Purpose & Principles References (left chips, optional) spans both columns when the right slot is unused.
- Field controls:
  - Goal Status: singleselect with tokens `in-progress | waiting | completed`. Defaults to `in-progress`.
  - Target Date: date picker with ISO output (`YYYY-MM-DD`). Supports clearing the value.
  - Areas/Projects/Vision/Purpose references: chip groups that open the shared horizon reference dialog; selections stored as JSON arrays.
  - Created: read-only ISO datetime rendered as a friendly string. Set on first build and remains stable.
- Visual style: Tailwind utilities backed by theme variables (see `docs/theming.md`).
- Divider: `border-t border-border` separates header and body in line with Action/Habit/Area designs.

### Body
- Description block: Bare BlockNote editor for framing the desired outcome, success criteria, and motivational context. Parent adds `align-with-header` to keep the first line aligned with the header gutter.
- The body preserves author-controlled ordering; only the metadata sections are canonicalized.

## Markdown Specification (Canonical Ordering)

The renderer rebuilds Goal markdown in this exact sequence. Blank lines separate logical sections; optional sections are omitted entirely when empty.

```
# <Goal Title>

## Status
[!singleselect:goal-status:<in-progress|waiting|completed>]

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

## Created
[!datetime:created_date_time:YYYY-MM-DDTHH:MM:SSZ]

## Description
<Freeform BlockNote content. Always present; defaults to a placeholder paragraph when blank.>
```

Notes:
- Reference tokens normalize to compact JSON arrays. CSV, legacy encodings, and blank strings continue parsing for backward compatibility, but canonical rebuild emits JSON.
- `Description` is the only non-optional body section; an empty state inserts a single placeholder paragraph so the section survives canonicalization.

## Behaviors and Data Flow
- Live rebuild: Editing header fields or body content regenerates canonical markdown and updates the open tab. No-op guard prevents redundant writes.
- Stable Created: Captured on first render using existing created timestamp utilities; never regenerated once set.
- Reference dialogs: Reuses the horizon reference dialog leveraged by Habit and Area templates. Selections write JSON arrays into the corresponding markers.
- Status tokens: Write only the constrained `goal-status` values to avoid conflicts with Action `status` markers.
- Sidebar metadata: Status, target date, and reference badges surface in the Horizons sidebar once the corresponding TypeScript interfaces are formalized.

## Implementation Map
- Entry point: Introduce `src/components/gtd/GoalPage.tsx`, mirroring `ActionPage`, `HabitPage`, and `AreaPage` structure (header builder, markdown orchestrator, BlockNote body).
- Routing: Extend the editor router to mount `GoalPage` for files under `/Goals/`.
- Metadata helpers: Add `buildGoalMarkdown()` to `src/utils/gtd-markdown-helpers.ts`, enforcing the ordering above while preserving the description body content.
- Tokens: Extend `src/types/index.ts` with `GTDGoalStatus`, `GTDGoal`, and related helpers (see `docs/gtd-data-model.md` for baseline structure). Update the metadata extractor to parse the singleselect marker `goal-status`, `goal-target-date`, and horizon reference tokens.
- Reference dialog: Reuse existing horizon picker with props to toggle which groups appear (Areas, Projects, Vision, Purpose). Group chips in the header using Tailwind utilities defined in `src/styles`.
- Body section: Extend the BlockNote schema with a `Description` delimiter so canonical rebuild can remount it in order while leaving content untouched.

## Theming and Accessibility
- All header controls inherit theme variables (`--background`, `--foreground`, `--border`). Ensure focus states match Action/Habit/Area patterns.
- Status badges and read-only timestamps use `text-muted-foreground` to de-emphasize non-editable fields without compromising contrast.
- Description copy respects reduced motion settings and leverages semantic markup for screen reader clarity.

## QA Checklist (Goals)
- Title aligns with the first body line; header divider renders once.
- Updating Goal Status only modifies the `[!singleselect:goal-status:]` token.
- Clearing or changing Target Date updates only the `[!datetime:goal-target-date:]` token and handles timezone normalization.
- Reference chips mirror JSON array order; removing a chip updates the token immediately.
- Created timestamp remains unchanged after edits.
- Description content persists through canonical rebuilds without introducing duplicate sections.
- Exporting the file (save/reopen) produces no diff when the content already matches the template.

## Future Enhancements
- Add progress visualization (e.g., milestone completion pill) inline once supporting data is available.
- Surface linked Projects’ next actions inline when focus mode is active.
- Explore optional `Key Results` field that syncs to dashboard metrics without bloating the main body.

---

References:
- `docs/action-page-template.md` for shared layout and canonicalization patterns.
- `docs/area-page-template.md` for horizon-aware reference handling.
- `docs/gtd-data-model.md` for canonical tokens and Horizons data structures.
