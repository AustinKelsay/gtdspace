# Vision Page Template - UI and Markdown Standard

Updated: November 2, 2025

This document defines the standardized Vision horizon page template for GTD Space. It mirrors the Goal, Area, Habit, and Action templates so designers, engineers, and content contributors share a single blueprint for the Horizons of Focus experience.

- Describes the target layout and interactive behavior for Vision files rendered in the desktop app.
- Defines the canonical markdown ordering enforced when rebuilding or migrating Vision pages.
- Maps UI elements to existing hooks, blocks, and utilities so implementation can reuse proven flows.

## Goals
- Deliver an inspiring but structured authoring surface for Vision narratives that stays consistent with other Horizons pages.
- Keep metadata tokens predictable to simplify parsing, migrations, and cross-linking with Goals and Areas.
- Highlight the time horizon, core narrative, and supporting references without overwhelming the reading experience.
- Lean on shared theming primitives for accessibility and light/dark parity.

## At-a-Glance
- Layout: Same `px-12` left gutter, compact header plus divider, bare BlockNote body.
- Title: H1 input identical to other pages; no background chrome.
- Header fields: Vision Horizon (duration), Created timestamp, Projects references, Goals references, Areas references, optional Purpose references.
- Body: Freeform narrative region aligned with the header gutter.
- References: Dialog-driven pickers for Horizons (Goals, Areas, Purpose & Principles) reused from other page types.
- Canonical tokens: `vision-horizon`, horizon reference markers, `created_date_time`.

## UI Specification

### Header (Compact Grid)
- Left gutter: `px-12` from the page edge (reuse the shared page shell).
- Title: `text-5xl font-bold` input; typing updates the H1 and triggers rename prompts when the saved name differs.
- Field grid (2 columns, `gap-y-2 gap-x-6`):
  - Row 1: Vision Horizon (left) • Created (right, read-only text).
  - Row 2: Projects References (left chips) • Goals References (right chips).
  - Row 3: Areas References (left chips) • Purpose & Principles References (right chips, optional). When the right slot is unused the left group spans the row.
- Field controls:
  - Vision Horizon: singleselect with tokens `3-years | 5-years | 10-years | custom`. Defaults to `3-years`.
- Projects/Goals/Areas/Purpose references: chip groups that open the shared horizon reference dialog; selections stored as JSON arrays.
  - Created: read-only ISO datetime rendered as a friendly string. Set on first build and remains stable.
- Visual style: Tailwind utilities backed by theme variables (see `docs/theming.md`).
- Divider: `border-t border-border` separates header and body in line with other horizon designs.

### Body
- Narrative block: Bare BlockNote editor for describing the vivid picture of the future state. Parent adds `align-with-header` to keep the first line aligned with the header gutter.
- The body preserves author-controlled ordering; only the metadata sections are canonicalized.

## Markdown Specification (Canonical Ordering)

The renderer rebuilds Vision markdown in this exact sequence. Blank lines separate logical sections; optional sections are omitted entirely when empty.

```
# <Vision Title>

## Horizon
[!singleselect:vision-horizon:<3-years|5-years|10-years|custom>]

## Projects References
[!projects-references:<json-array-or-empty-string>]

## Goals References
[!goals-references:<json-array-or-empty-string>]

## Areas References
[!areas-references:<json-array-or-empty-string>]

## Purpose & Principles References (optional)
[!purpose-references:<json-array-or-empty-string>]

## Created
[!datetime:created_date_time:YYYY-MM-DDTHH:MM:SSZ]

## Narrative
<Freeform BlockNote content. Always present; defaults to a placeholder paragraph when blank.>
```

Notes:
- Reference tokens normalize to compact JSON arrays. CSV, legacy encodings, and blank strings continue parsing for backward compatibility, but canonical rebuild emits JSON.
- `Narrative` is the only non-optional body section; an empty state inserts a single placeholder paragraph so the section survives canonicalization.

## Behaviors and Data Flow
- Live rebuild: Editing header fields or body content regenerates canonical markdown and updates the open tab. No-op guard prevents redundant writes.
- Stable Created: Captured on first render using existing created timestamp utilities; never regenerated once set.
- Reference dialogs: Reuses the horizon reference dialog leveraged by Goal and Area templates. Selections write JSON arrays into the corresponding markers.
- Horizon tokens: Write only the constrained `vision-horizon` values to avoid conflicts with other singleselect markers.
- Sidebar metadata: Horizon value and reference badges surface in the Horizons sidebar once the corresponding TypeScript interfaces are formalized.

## Implementation Map
- Entry point: Introduce `src/components/gtd/VisionPage.tsx`, mirroring `GoalPage`, `AreaPage`, and `HabitPage` structure (header builder, markdown orchestrator, BlockNote body).
- Routing: Extend the editor router to mount `VisionPage` for files under `/Vision/`.
- Metadata helpers: Add `buildVisionMarkdown()` to `src/utils/gtd-markdown-helpers.ts`, enforcing the ordering above while preserving the narrative body content.
- Tokens: Extend `src/types/index.ts` with `GTDVisionHorizon`, `GTDVisionDoc`, and related helpers (see `docs/gtd-data-model.md` for baseline structure). Update the metadata extractor to parse the singleselect marker `vision-horizon` and horizon reference tokens.
- Reference dialog: Reuse existing horizon picker with props to toggle which groups appear (Projects, Goals, Areas, Purpose). Group chips in the header using Tailwind utilities defined in `src/styles`.
- Body section: Extend the BlockNote schema with a `Narrative` delimiter so canonical rebuild can remount it in order while leaving content untouched.

## Theming and Accessibility
- All header controls inherit theme variables (`--background`, `--foreground`, `--border`). Ensure focus states match other horizon patterns.
- Horizon badges and read-only timestamps use `text-muted-foreground` to de-emphasize non-editable fields without compromising contrast.
- Narrative copy respects reduced motion settings and leverages semantic markup for screen reader clarity.

## QA Checklist (Vision)
- Title aligns with the first body line; header divider renders once.
- Updating Vision Horizon only modifies the `[!singleselect:vision-horizon:]` token.
- Reference chips mirror JSON array order; removing a chip updates the token immediately.
- Created timestamp remains unchanged after edits.
- Narrative content persists through canonical rebuilds without introducing duplicate sections.
- Exporting the file (save/reopen) produces no diff when the content already matches the template.

## Future Enhancements
- Add progress visualization showing how goals roll up into the vision horizon.
- Surface linked Goals’ target dates inline when focus mode is active.
- Explore optional `Key Themes` section that summarizes major pillars without bloating the main narrative.

---

References:
- `docs/goal-page-template.md` for shared layout and canonicalization patterns.
- `docs/area-page-template.md` for horizon-aware reference handling.
- `docs/gtd-data-model.md` for canonical tokens and Horizons data structures.
