# Purpose & Principles Page Template - UI and Markdown Standard

Updated: November 2, 2025

This document defines the standardized Purpose & Principles horizon page template for GTD Space. It mirrors the Vision, Goal, Area, Habit, and Action templates so designers, engineers, and content contributors share a single blueprint for the Horizons of Focus experience.

- Describes the target layout and interactive behavior for Purpose & Principles files rendered in the desktop app.
- Defines the canonical markdown ordering enforced when rebuilding or migrating Purpose & Principles pages.
- Maps UI elements to existing hooks, blocks, and utilities so implementation can reuse proven flows.

## Goals

- Provide a grounded authoring surface for purpose statements and guiding principles that stays consistent with other Horizons pages.
- Keep metadata tokens predictable to simplify parsing, migrations, and cross-linking with Goals, Projects, and Vision narratives.
- Highlight the overarching purpose, principles, and supporting references without overwhelming the reading experience.
- Lean on shared theming primitives for accessibility and light/dark parity.

## At-a-Glance

- Layout: Same `px-12` left gutter, compact header plus divider, bare BlockNote body.
- Title: H1 input identical to other pages; no background chrome.
- Header fields: Created timestamp, Projects references, Goals references, Vision references, optional Areas references.
- Body: Single description block aligned with the header gutter.
- References: Dialog-driven pickers for Horizons (Projects, Goals, Vision, Areas) reused from other page types.
- Canonical tokens: horizon reference markers, `created_date_time`.

## UI Specification

### Header (Compact Grid)

- Left gutter: `px-12` from the page edge (reuse the shared page shell).
- Title: `text-5xl font-bold` input; typing updates the H1 and triggers rename prompts when the saved name differs.
- Field grid (2 columns, `gap-y-2 gap-x-6`):
  - Row 1: Created (left, read-only text) • Projects References (right chips).
  - Row 2: Goals References (left chips) • Vision References (right chips).
  - Row 3: Areas References (left chips, optional) spans both columns when the right slot is unused.
- Field controls:
  - Projects/Goals/Vision/Areas references: chip groups that open the shared horizon reference dialog; selections stored as JSON arrays.
  - Created: read-only ISO datetime rendered as a friendly string. Set on first build and remains stable.
- Visual style: Tailwind utilities backed by theme variables (see `docs/theming.md`).
- Divider: `border-t border-border` separates header and body in line with other horizon designs.

### Body

- Description block: Bare BlockNote editor for articulating purpose and guiding principles together. Defaults to a succinct placeholder paragraph.
- The body preserves author-controlled ordering; only the metadata sections are canonicalized.

## Markdown Specification (Canonical Ordering)

The renderer rebuilds Purpose & Principles markdown in this exact sequence. Blank lines separate logical sections; optional sections are omitted entirely when empty.

```markdown
# <Purpose & Principles Title>

## Projects References
[!projects-references:<json-array-or-empty-string>]

## Goals References
[!goals-references:<json-array-or-empty-string>]

## Vision References
[!vision-references:<json-array-or-empty-string>]

## Areas References (optional)
[!areas-references:<json-array-or-empty-string>]

## Created
[!datetime:created_date_time:YYYY-MM-DDTHH:MM:SSZ]

## Description
<Freeform BlockNote content. Always present; defaults to a placeholder paragraph when blank.>
```

Notes:
- Reference tokens normalize to compact JSON arrays. CSV, legacy encodings, and blank strings continue parsing for backward compatibility, but canonical rebuild emits JSON.
- `Description` is the only non-optional body section; an empty state inserts a placeholder paragraph so the section survives canonicalization.

## Behaviors and Data Flow

- Live rebuild: Editing header fields or body content regenerates canonical markdown and updates the open tab. No-op guard prevents redundant writes.
- Stable Created: Captured on first render using existing created timestamp utilities; never regenerated once set.
- Reference dialogs: Reuses the horizon reference dialog leveraged by Vision and Goal templates. Selections write JSON arrays into the corresponding markers.
- Sidebar metadata: Reference badges surface in the Horizons sidebar once the corresponding TypeScript interfaces are formalized.

## Implementation Map

- Entry point: Introduce `src/components/gtd/PurposePage.tsx`, mirroring `VisionPage`, `GoalPage`, and `AreaPage` structure (header builder, markdown orchestrator, BlockNote body).
- Routing: Extend the editor router to mount `PurposePage` for files under `/Purpose & Principles/`.
- Metadata helpers: Add `buildPurposeMarkdown()` (or similar) to `src/utils/gtd-markdown-helpers.ts`, enforcing the ordering above while preserving both body sections.
- Tokens: Extend `src/types/index.ts` with `GTDPurposePrinciplesDoc` helpers (see `docs/gtd-data-model.md` for baseline structure). Update the metadata extractor if new markers are introduced.
- Reference dialog: Reuse existing horizon picker with props to toggle which groups appear (Projects, Goals, Vision, Areas). Group chips in the header using Tailwind utilities defined in `src/styles`.
- Body sections: Extend the BlockNote schema with a `Description` delimiter so canonical rebuild can remount it in order while leaving content untouched.

## Theming and Accessibility

- All header controls inherit theme variables (`--background`, `--foreground`, `--border`). Ensure focus states match other horizon patterns.
- Read-only timestamps use `text-muted-foreground` to de-emphasize non-editable fields without compromising contrast.
- Principles lists respect reduced motion settings and leverage semantic list markup for screen reader clarity.

## QA Checklist (Purpose & Principles)

- Title aligns with the first body line; header divider renders once.
- Reference chips mirror JSON array order; removing a chip updates the token immediately.
- Created timestamp remains unchanged after edits.
- Description content persists through canonical rebuilds without introducing duplicate sections.
- Exporting the file (save/reopen) produces no diff when the content already matches the template.

## Future Enhancements

- Add optional `Key Relationships` section for stakeholders or communities impacted by the purpose.
- Surface linked Goals’ target dates inline when focus mode is active.
- Explore a summary badge showing the number of principles defined.

---

References:
- `docs/vision-page-template.md` for shared layout and canonicalization patterns.
- `docs/goal-page-template.md` for horizon-aware reference handling.
- `docs/gtd-data-model.md` for canonical tokens and Horizons data structures.
