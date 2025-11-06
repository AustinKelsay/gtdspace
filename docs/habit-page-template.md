# Habit Page Template — UI and Markdown Standard

Updated: October 22, 2025

This document captures the emerging Habit page template for GTD Space. It mirrors the Action template work so that readers, designers, and engineers share a single blueprint while we finish implementing the standardized experience.

- Describes the target layout and interactive behavior for habit files rendered in the desktop app.
- Defines the canonical markdown ordering used when rebuilding or migrating habit files.
- Maps UI pieces to existing hooks, utilities, and commands so implementation can reuse proven flows.

## Goals

- Deliver a frictionless authoring surface for Habits that matches the Action template conventions.
- Keep metadata tokens ordered predictably to minimize merge churn and simplify parsing.
- Surface habit-specific insights (status, reset cadence, recent completion) without overwhelming the layout.
- Lean on shared theming primitives for accessibility and light/dark parity.

## At‑a‑Glance

- Layout: Same `px-12` left gutter, compact header + divider, bare BlockNote body.
- Title: H1 input identical to Actions, with inline checkbox affordance for quick toggling.
- Header fields: Habit Status (checkbox), Frequency (singleselect), Next Reset (read-only), Last Completion (read-only), References (grouped chips), Created timestamp.
- Body: Freeform notes block (optional) followed by structured History table block.
- References: Dialog-driven pickers for Projects, Areas, Goals, Vision, Purpose & Principles — consistent with current habit/reference flows.
- Canonical tokens: `habit-status`, `habit-frequency`, horizon reference markers, `created_date_time`; history remains a markdown table.

## UI Specification

### Header (Compact Grid)

- Left gutter: `px-12` from page edge (reuse Action layout wrapper).
- Title row:
  - Title: `text-5xl font-bold` input.
  - Status toggle: Inline checkbox aligned with title baseline; toggling updates `[!checkbox:habit-status:]`.
- Field grid (2 columns, subtle `gap-y-2 gap-x-6`):
  - Row 1: Frequency (left) • Next Reset (right, read-only badge).
  - Row 2: Last Completion (left, read-only badge) • Created (right, read-only text).
  - Row 3: Projects References (left chips) • Areas References (right chips).
  - Row 4: Goals References (left) • Vision References (right).
  - Row 5: Purpose & Principles References (left) • — (right empty for future metrics).
- Field controls:
- Frequency: singleselect tokens `5-minute | daily | every-other-day | twice-weekly | weekly | weekdays | biweekly | monthly` (aligns with `GTDHabitFrequency`; `5-minute` remains a testing utility).
  - Next Reset: derived timestamp computed via `useHabitTracking`; displayed as `Oct 22, 2025 • 12:00 AM` (local time). No markdown token is written.
  - Last Completion: derived from history table (`Latest status === Complete ? timestamp` else `—`). Also not written to markdown.
  - Created: read-only ISO datetime normalized to local friendly string; persists in `[!datetime:created_date_time:]`.
  - References: chip lists grouped by horizon type, editing opens existing reference dialog (JSON array storage preferred).
- Divider: `border-t border-border` separates header and body.

### Body

- Notes block (optional): Bare BlockNote editor region for narrative or instructions (`align-with-header` class to maintain gutter alignment). Content persists directly in markdown between metadata and history.
- History block:
  - Standard markdown table (rendered via existing history parser).
  - Toolbar actions: “Add Manual Entry”, “Reset Now” (hooks into `update_habit_status` / `check_and_reset_habits`).
  - Auto-scrolls newest entries into view; retains full markdown fidelity for migrations.
- Related Habits block is not rendered here (reserved for Projects/Horizons pages).

## Markdown Specification (Canonical Ordering)

The renderer rebuilds habit markdown in this exact sequence. Blank lines separate logical sections; freeform notes stay between References and History.

```markdown
# <Habit Title>

## Status
[!checkbox:habit-status:<true|false>]

## Frequency
[!singleselect:habit-frequency:<5-minute|daily|every-other-day|twice-weekly|weekly|weekdays|biweekly|monthly>]

## Projects References
[!projects-references:<json-array-or-empty-string>]

## Areas References
[!areas-references:<json-array-or-empty-string>]

## Goals References
[!goals-references:<json-array-or-empty-string>]

## Vision References
[!vision-references:<json-array-or-empty-string>]

## Purpose & Principles References
[!purpose-references:<json-array-or-empty-string>]

## Created
[!datetime:created_date_time:YYYY-MM-DDTHH:MM:SSZ]

## Notes (optional)
<Freeform BlockNote content. Omit entire section when empty.>

## History
| Date | Time | Status | Action | Details |
|------|------|--------|--------|---------|
| YYYY-MM-DD | H:MM AM | Complete | Manual | Changed from To Do |
```

Notes:
- Reference tokens normalize to JSON arrays (preferred) but continue parsing CSV/encoded formats for backward compatibility. When canonicalizing, emit compact JSON (`["/Projects/..."]`).
- `habit-status:true` maps to `completed`; `habit-status:false` maps to `todo` in TypeScript (`GTDHabitStatus`).
- History rows remain human-editable; the system appends/prepends entries as needed without re-sorting.
- `## Notes` heading is skipped entirely when no rich text content exists (avoids empty sections).

## Behaviors & Data Flow

- Status toggle fires `update_habit_status` (Tauri) with debounce guard; optimistic UI updates history table immediately (`Habits Implementation` doc behavior).
- Frequency changes re-run the scheduler from `useHabitTracking`, prompting recalculation of next reset and upcoming history entries.
- Header derived fields:
  - Next Reset reads from `useHabitsHistory` computed schedule; updates when frequency or local time window changes.
  - Last Completion inspects the latest `Manual` completion entry (status `Complete`); falls back to “—”.
- History table mutations (manual add/reset) bubble events (`habit-status-updated`, `habits-reset`) so other open views stay in sync (`src/components/editor/BlockNoteEditor.tsx:212`).
- Reference pickers reuse Horizon reference dialog, writing normalized JSON string tokens and dispatching `habit-content-changed` for live refresh.

## Implementation Map

- Entry point: new `src/components/gtd/HabitPage.tsx` (mirrors `ActionPage.tsx` structure with header builder + markdown orchestrator).
- Editor integration: extend `src/components/editor/BlockNoteEditor.tsx` detection around existing habit-specific logic to mount `HabitPage` when files live under `/Habits/` and contain `## History`.
- Header controls:
  - Checkbox: reuse `CheckboxBlock` but expose inline variant for header (share styling tokens).
  - Frequency select: adapt `SingleSelectBlock` with `type="habit-frequency"` and bare mode.
  - Reference chips: reuse horizon reference block internals, grouped visually via Tailwind utilities defined in `src/styles`.
- Derived metadata:
  - Next Reset + Last Completion values come from `useHabitsHistory` and `useHabitTracking`.
  - Ensure derived badges never write to markdown; they are UI-only for clarity.
- Markdown rebuild: extend `src/utils/gtd-markdown-helpers.ts` with `buildHabitMarkdown()` that enforces the canonical ordering above and preserves history rows.
- Scheduler hooks: confirm `useHabitTracking` remains the single source for reset polling; header should subscribe but avoid duplicating timers.

## Theming & Accessibility

- All header controls adopt theme tokens (`bg-card`, `border-border`, `text-foreground`) to maintain contrast (see `docs/theming.md`).
- Checkbox focus ring uses `outline outline-2 outline-primary/60` for keyboard visibility.
- Derived badges (`Next Reset`, `Last Completion`) use `bg-secondary text-secondary-foreground` to differentiate from editable fields without breaking dark mode.
- History table preserves readable contrast in both themes; header row uses `bg-muted/60` and `text-foreground`.
- Ensure chips respect reduced motion preferences and provide accessible names (`aria-label="Remove <Project>"`).

## QA Checklist (Habits)

- Header aligns with body gutter; divider renders once.
- Toggling status writes only the checkbox token and appends correct history entry (Manual Complete / Manual To Do).
- Auto-reset events append “Auto-Reset” rows without duplicating manual entries; UI updates `Next Reset` immediately after reset.
- Frequency change persists new token and recalculates derived badges.
- Reference chips display the same order as stored JSON arrays; removing a chip updates the corresponding `[!*-references:]` token.
- Created timestamp remains stable across edits.
- History table maintains column alignment after multiple auto-resets; manual entries inserted via UI follow canonical format.
- Markdown rebuild is idempotent: saving immediately after load produces no diff when file already matches template.

## Future Enhancements

- Consider streak visualization badges in header once `useHabitsHistory` exposes streak counts.
- Investigate optional “Reminders” field tied to notifications before finalizing layout.
- Explore collapsing history table for long-running habits (e.g., newest 30 entries + “Load More”) to reduce initial render cost.

---

References:
- `docs/gtd-data-model.md` for canonical field definitions (GTDHabit + tokens).
- `docs/habits-implementation.md` for reset cadence, history semantics, and backend commands.
- `docs/theming.md` for component styling guidelines.
