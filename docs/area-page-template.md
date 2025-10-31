# Area of Focus Page Template - UI and Markdown Standard

Updated: October 27, 2025

This document defines the standardized Area of Focus page template for GTD Space. It mirrors the Action and Habit templates so designers, engineers, and content contributors share a single blueprint for the Horizons of Focus experience.

- Describes the target layout and interactive behavior for Area files rendered in the desktop app.
- Defines the canonical markdown ordering enforced when rebuilding or migrating Area pages.
- Maps UI elements to existing hooks, blocks, and utilities so implementation can reuse proven flows.

## Goals
- Deliver a rich but lightweight authoring surface for Areas that stays consistent with Action and Habit pages.
- Keep metadata tokens predictable to simplify parsing, migrations, and cross-linking.
- Highlight responsibilities, success criteria, and metrics without overwhelming the reading experience.
- Lean on shared theming primitives for accessibility and light/dark parity.

## At-a-Glance
- Layout: Same `px-12` left gutter, compact header plus divider, bare BlockNote body.
- Title: H1 input identical to Actions; no background chrome.
- Header fields: Area Status, Review Cadence, Stewards, Projects references, Goals references, optional Vision and Purpose references, Created timestamp.
- Body: Freeform narrative region followed by structured success criteria and metrics blocks.
- References: Dialog-driven pickers for Horizons (Projects, Goals, Vision, Purpose & Principles) reused from other page types.
- Canonical tokens: `area-status`, `area-review-cadence`, `area-stewards`, horizon reference markers, `created_date_time`.

## UI Specification

### Header (Compact Grid)
- Left gutter: `px-12` from the page edge (reuse the shared page shell).
- Title: `text-5xl font-bold` input; typing updates the H1 and triggers rename prompts when the saved name differs.
- Field grid (2 columns, `gap-y-2 gap-x-6`):
  - Row 1: Area Status (left) • Review Cadence (right).
  - Row 2: Stewards (left chips + add) • Created (right, read-only text).
  - Row 3: Projects References (left chips) • Goals References (right chips).
  - Row 4: Vision References (left chips, optional) • Purpose & Principles References (right chips, optional).
- Field controls:
  - Area Status: singleselect with tokens `steady | watch | incubating | delegated`. Defaults to `steady`.
  - Review Cadence: singleselect `weekly | monthly | quarterly | annually`. Defaults to `monthly`.
  - Stewards: multi-select chips representing owners or teams; stored as normalized strings (e.g., `operations`, `marketing`). Uses the generic multi-select picker.
  - Projects/Goals/Vision/Purpose references: chip groups that open the shared horizon reference dialog; selections stored as JSON arrays.
  - Created: read-only ISO datetime rendered as a friendly string. Set on first build and remains stable.
- Visual style: Tailwind utilities backed by theme variables (see `docs/theming.md`).
- Divider: `border-t border-border` separates header and body in line with Action/Habit designs.

### Body
- Area Narrative block: Bare BlockNote editor for describing the responsibility, desired outcomes, and scope. Parent adds `align-with-header` to keep the first line aligned with the header gutter.
- Success Criteria block: Optional heading plus unordered list or checklist outlining what good looks like. When empty, the entire section is omitted.
- Focus Metrics block: Optional markdown table capturing key measures (e.g., coverage, budget, satisfaction). Provides toolbar shortcuts for adding rows.
- Projects Snapshot block (optional): Embedded `[!projects-list]` filtered via dialog to show relevant projects in context.
- Goals Snapshot block (optional): Embedded `[!goals-list]` filtered similarly.
- The body preserves author-controlled ordering; only the metadata sections are canonicalized.

## Markdown Specification (Canonical Ordering)

The renderer rebuilds Area markdown in this exact sequence. Blank lines separate logical sections; optional sections are omitted entirely when empty.

```
# <Area Title>

## Status
[!singleselect:area-status:<steady|watch|incubating|delegated>]

## Review Cadence
[!singleselect:area-review-cadence:<weekly|monthly|quarterly|annually>]

## Stewards (optional)
[!multiselect:area-stewards:<comma-separated-stewards>]

## Projects References
[!projects-references:<json-array-or-empty-string>]

## Goals References
[!goals-references:<json-array-or-empty-string>]

## Vision References (optional)
[!vision-references:<json-array-or-empty-string>]

## Purpose & Principles References (optional)
[!purpose-references:<json-array-or-empty-string>]

## Created
[!datetime:created_date_time:YYYY-MM-DDTHH:MM:SSZ]

## Area Narrative
<Freeform BlockNote content. Always present; defaults to a placeholder paragraph when blank.>

## Success Criteria (optional)
- Bullet list or checklist outlining desired outcomes.

## Focus Metrics (optional)
| Metric | Target | Current | Updated |
|--------|--------|---------|---------|
| Example | 90% | 72% | 2025-10-27 |

## Supporting Notes (optional)
<Additional rich-text blocks, embeds, or attachments.>

## Snapshots (optional)
[!projects-list]
[!goals-list]
```

Notes:
- Reference tokens normalize to compact JSON arrays. CSV, legacy encodings, and blank strings continue parsing for backward compatibility, but canonical rebuild emits JSON.
- `area-stewards` stores normalized lowercase tokens separated by commas. When empty, the entire section is removed to avoid blank headings.
- `Area Narrative` is the only non-optional body section; an empty state inserts a single placeholder paragraph so the section survives canonicalization.
- Snapshot list markers are optional helpers; authors may remove them without breaking canonical ordering.

## Behaviors and Data Flow
- Live rebuild: Editing header fields or body content regenerates canonical markdown and updates the open tab. No-op guard prevents redundant writes.
- Stable Created: Captured on first render using existing created timestamp utilities; never regenerated once set.
- Stewards picker: Uses the generic multi-select block with normalization (`marketing-ops` rather than `Marketing Ops` unless explicitly capitalized by the author).
- Reference dialogs: Reuses the horizon reference dialog leveraged by Habit and upcoming Project templates. Selections write JSON arrays into the corresponding markers.
- Snapshot blocks: `[!projects-list]` and `[!goals-list]` default to filtering by the current Area path. Authors can adjust filters via block menus; the canonical rebuild preserves block configuration.
- Sidebar metadata: Status and cadence values surface in the Horizons sidebar summary once the corresponding TypeScript interfaces are formalized.

## Implementation Map
- Entry point: Introduce `src/components/gtd/AreaPage.tsx`, mirroring `ActionPage` and `HabitPage` structure (header builder, markdown orchestrator, BlockNote body).
- Routing: Extend the editor router to mount `AreaPage` for files under `/Areas of Focus/`.
- Metadata helpers: Add `buildAreaMarkdown()` to `src/utils/gtd-markdown-helpers.ts`, enforcing the ordering above while preserving optional sections that contain content.
- Tokens: Extend `src/types/index.ts` with `GTDAreaStatus`, `GTDAreaReviewCadence`, and `GTDArea` (see `docs/gtd-data-model.md` for baseline structure). Update metadata extractor to parse the new singleselect and multiselect markers.
- Reference dialog: Reuse existing horizon picker with props to toggle which groups appear (Projects, Goals, Vision, Purpose). Group chips in the header using Tailwind utilities defined in `src/styles`.
- Snapshot blocks: Leverage existing list blocks; ensure filtering defaults to the open file path and remains editable.

## Theming and Accessibility
- All header controls inherit theme variables (`--background`, `--foreground`, `--border`). Ensure focus states match Action/Habit patterns.
- Stewards chips use the same `aria-label` pattern (`aria-label="Remove <Steward>"`) for screen readers.
- Derived badges (Created timestamp) use `text-muted-foreground` to de-emphasize read-only fields without compromising contrast.
- Body sections respect reduced motion settings, especially for expanding/collapsing snapshot blocks.

## QA Checklist (Areas)
- Title aligns with the first body line; header divider renders once.
- Updating Area Status only modifies the `[!singleselect:area-status:]` token.
- Review Cadence updates propagate to sidebar summaries (once implemented) without rewrites elsewhere.
- Removing all stewards deletes the heading and token entirely.
- Reference chips mirror JSON array order; removing a chip updates the token immediately.
- Created timestamp remains unchanged after edits.
- Snapshot blocks filter correctly to the current Area and survive round-trip canonicalization.
- Exporting the file (save/reopen) produces no diff when the content already matches the template.

## Future Enhancements
- Display aggregated metrics (e.g., project load, habit coverage) inline once supporting data is available.
- Add optional `Key Resources` field that embeds Cabinet files for quick access.
- Explore timeline visualization for review cadence adherence (e.g., last review indicator).

---

References:
- `docs/action-page-template.md` for shared layout and canonicalization patterns.
- `docs/habit-page-template.md` for horizon-aware reference handling.
- `docs/gtd-data-model.md` for canonical tokens and Horizons data structures.
