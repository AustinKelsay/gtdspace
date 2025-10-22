# Action Page Template — UI and Markdown Standard

Updated: October 21, 2025

This document defines the standardized Action page template in GTD Space. It serves two purposes:
- Documentation of what is implemented today (UI and markdown composition).
- A blueprint for building the next standardized templates (Projects, Horizons).

## Goals
- Consistent, Notion‑style authoring experience across page types.
- Canonical ordering and formatting of metadata tokens in markdown.
- Minimal visual chrome; the page should feel like “typing on the page”.
- Strong alignment with theme variables and accessibility.

## At‑a‑Glance
- Layout: Compact header on top, full WYSIWYG body below, left‑aligned.
- Title: H1 sized, seamless input (no special background).
- Divider: A subtle full‑width divider line separates header and body.
- Body: BlockNote WYSIWYG in “bare” mode (no card, no status bar).
- Alignment: Header and body share the same left gutter; text aligns perfectly.
- Canonical tokens: Status, Focus Date, Due Date, Effort, Contexts, References, Horizon References (optional), Created.
- References: Multi‑select picker of Cabinet and Someday Maybe pages (no manual paths required).

## UI Specification

### Header (Compact Grid)
- Left gutter: `px-12` from the page edge.
- Title: H1; class example `text-5xl font-bold`.
- Field grid (2 columns):
  - Row 1: Status (left) • Effort (right)
  - Row 2: Focus Date (date + time) • Due Date (date)
  - Row 3: Contexts (chips + add) • —
  - Row 4: References (chips + add) • —
  - Row 5: Created (read‑only timestamp)
- Field controls:
  - Status: singleselect with tokens `in-progress`, `waiting`, `completed`, `cancelled`.
  - Effort: singleselect `small | medium | large | extra-large`.
  - Focus Date: date + time; time optional (defaults to 09:00 if omitted), stored as ISO datetime.
  - Due Date: date only (YYYY‑MM‑DD).
  - Contexts: chips; add opens a compact multi‑select (uses `GTDTagSelector` contexts).
  - References: chips; add opens a dialog listing Cabinet and Someday Maybe pages (search + multi‑select). Manual input still available for URLs.
  - Created: read‑only; set once and remains stable.
- Visual style: Tailwind utilities backed by theme CSS variables (see docs/theming.md).
- Divider: `border-t border-border` between header and body.

### Body (WYSIWYG)
- Editor: BlockNote, using our EnhancedTextEditor in “bare” mode.
- Class hook: parent adds `align-with-header` to zero out left padding on the canvas so the first body line aligns with the title.
- Status bar: hidden on Action pages (kept available for other contexts).

## Markdown Specification (Canonical Ordering)

The Action markdown is rebuilt in this exact order. Tokens are single lines and blank lines are preserved between sections.

```
# <Action Title>

## Status
[!singleselect:status:<in-progress|waiting|completed|cancelled>]

## Focus Date
[!datetime:focus_date:YYYY-MM-DDTHH:MM:SSZ]

## Due Date
[!datetime:due_date:YYYY-MM-DD]

## Effort
[!singleselect:effort:<small|medium|large|extra-large>]

## Contexts
[!multiselect:contexts:<comma-separated-contexts>]

<Freeform body content authored in the WYSIWYG>

## References
[!references:<comma-separated file paths or URLs>]

## Horizon References (optional)
[!projects-references:]
[!areas-references:]
[!goals-references:]
[!vision-references:]
[!purpose-references:]

## Created
[!datetime:created_date_time:YYYY-MM-DDTHH:MM:SSZ]
```

Notes:
- References are stored canonically as CSV (not JSON). The parser supports both, but CSV is the standard going forward.
- Created timestamp is set at first build or read from the file and remains stable thereafter.
- Horizons references are emitted in the markdown but not surfaced in the Action header (yet). They can be edited via blocks or future pickers.

## Behaviors & Data Flow
- Live rebuild: Changing any header field or typing in the body rebuilds the canonical markdown and updates the open tab.
- No‑op guard: The component compares rebuild output to current content; identical content does not re‑emit (prevents churn).
- Stable Created: held in a ref; never re‑generated once set.
- References picker: resolves Cabinet and Someday Maybe files via Tauri, search, and multi‑select; writes CSV paths to `[!references:]`.
- Contexts: chips reflect normalized context tokens (`computer`, `phone`, etc.).

## Implementation Map
- UI entry point: `src/App.tsx`
  - Renders `ActionPage` for files under `<GTD Root>/Projects/<Project>/<Action>.md` (excludes `README.md`).
- Action layout: `src/components/gtd/ActionPage.tsx`
  - Compact header (title + fields), canonical markdown builder, references dialog, and seamless WYSIWYG body.
- Editor shell: `src/components/editor/EnhancedTextEditor.tsx`
  - Supports `frame="bare"` and `showStatusBar={false}` for Notion‑like pages.
- Editor theming/alignment: `src/components/editor/blocknote-theme.css`
  - `.align-with-header` removes left padding/margins so the body aligns with the header gutter.
- Tag selector: `src/components/gtd/GTDTagSelector.tsx`
  - Provides the contexts multi‑select (with `@` normalization for display, stored without `@`).

## Theming & Accessibility
- All colors via theme variables (`--background`, `--foreground`, `--border`, etc.).
- Minimal contrast risks; chips and inputs inherit theme foreground/background.
- Compact controls are keyboard navigable (Radix‑based selects, dialogs).

## QA Checklist (Actions)
- Title aligns with first body line.
- Header fields update tokens in the exact order after save.
- Created timestamp remains unchanged across edits.
- Contexts add/remove via picker; chips reflect current state.
- References dialog lists Cabinet + Someday files; selections appear as chips; `[!references:]` updated as CSV.
- Focus Date can include time; Due Date is date‑only.

## How to Apply This Pattern to Other Page Types

The template pattern is intentionally reusable:

1) Keep the layout contract
- Same left gutter (`px-12`), title H1, compact header grid, divider, seamless WYSIWYG body.
- Use `EnhancedTextEditor` with `frame="bare"`, `showStatusBar={false}`, and wrap the body with `align-with-header`.

2) Swap the field set and tokens
- Projects
  - Fields: Title, Project Status (`[!singleselect:project-status:*]`), Due Date, Desired Outcome/Description, References, Created, Actions list (`[!actions-list]`).
  - Keep the same references dialog.
- Horizons (Areas, Goals, Vision, Purpose)
  - Fields vary by horizon; use singleselects and datetimes where relevant (e.g., goal `target_date`).
  - Provide horizon‑specific references pickers (projects/areas/goals) using the same dialog pattern.

3) Preserve canonical ordering in markdown
- Decide section order per type and enforce it in a single builder function (as done for Actions).

4) Reuse the no‑op guard and stable Created behavior
- Prevent event loops and ensure clean diffs.

## Future Enhancements
- Add first‑class horizon reference pickers to Actions header.
- File/jump navigation on reference chip click (already available inside the WYSIWYG references block).
- Optional keyboard affordances to open pickers (e.g., ⌘⌥R for references).

---

This document complements the data model in `docs/gtd-data-model.md` by specifying the user‑facing layout and canonical markdown ordering for Action pages. Use it as the source of truth when creating standardized templates for other page types.

