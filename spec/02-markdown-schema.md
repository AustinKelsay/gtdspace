# GTD Markdown Schema

This document describes the current markdown language used by GTD Space. It is written from the implementation and tests, not from aspirational docs.

## Scope

The spec covers:

- Canonical metadata tokens and how they are encoded.
- Migration and normalization rules applied to legacy markdown.
- Canonical section ordering for project, habit, area, goal, vision, purpose, and horizon overview documents.
- Canonical list blocks and accepted aliases.
- Title and rename behavior enforced by the app.

There is no separate frontmatter format. GTD metadata lives inline in the markdown body as special markers.

## Canonical Tokens

### Single Select

The canonical single-select marker shape is:

```markdown
[!singleselect:<field>:<value>]
```

Current canonical fields:

- `status`
- `project-status`
- `effort`
- `habit-frequency`
- `habit-status`
- `area-status`
- `area-review-cadence`
- `goal-status`
- `vision-horizon`
- `horizon-altitude`
- `horizon-review-cadence`

Canonical value sets enforced in code:

- `status`: `in-progress`, `waiting`, `completed`, `cancelled`
- `project-status`: writer and backend creation paths use `in-progress`, `waiting`, `completed`; runtime loaders also tolerate `cancelled` in existing data
- `effort`: `small`, `medium`, `large`, `extra-large`
- `habit-frequency`: `5-minute`, `daily`, `every-other-day`, `twice-weekly`, `weekly`, `weekdays`, `biweekly`, `monthly`
- `habit-status`: stored as `true` or `false` via checkbox markers
- `area-status`: `steady`, `watch`, `incubating`, `delegated`
- `area-review-cadence`: `weekly`, `monthly`, `quarterly`, `annually`
- `goal-status`: `in-progress`, `waiting`, `completed`
- `vision-horizon`: `3-years`, `5-years`, `10-years`, `custom`
- `horizon-altitude`: `purpose`, `vision`, `goals`, `areas`
- `horizon-review-cadence`: `on-demand`, `monthly`, `quarterly`, `annually`

### Datetime

The canonical datetime marker shape is:

```markdown
[!datetime:<field>:<value>]
```

Current canonical fields:

- `created_date_time`
- `due_date`
- `focus_date`
- `goal-target-date`

The parser also accepts several legacy or alias field names and normalizes them to the camelCase metadata model.

### Checkbox

The canonical checkbox marker shape is:

```markdown
[!checkbox:habit-status:true]
[!checkbox:habit-status:false]
```

This is the preferred on-disk representation for habit completion state.

### References

The canonical reference marker shapes are:

```markdown
[!projects-references:...]
[!areas-references:...]
[!goals-references:...]
[!vision-references:...]
[!purpose-references:...]
[!references:...]
```

The editor also recognizes `[!habits-references:...]` for block rendering, but the metadata extractor does not currently surface a dedicated field for it.

## Encoding Rules

### Reference Arrays

Reference arrays are encoded as URI-safe JSON arrays, with path separators normalized to forward slashes.

Example:

```markdown
[!goals-references:%5B%22Goals%2FFitness.md%22%2C%22Goals%2FHealth.md%22%5D]
```

Implementation rules:

- Input values are trimmed.
- Backslashes are rewritten to `/`.
- Empty strings are removed.
- The value is `JSON.stringify(...)` and then `encodeURIComponent(...)` encoded.
- Empty arrays encode to an empty string in most builders, or to `[]` in horizon overview README reference markers.

### CSV References

Generic reference lists use comma-separated values with the same trimming and slash normalization rules.

Example:

```markdown
[!references:Cabinet/Ref.md,Someday Maybe/Idea.md]
```

Implementation rules:

- Input values are trimmed.
- Backslashes are rewritten to `/`.
- Empty strings are removed.
- Values are joined with commas.

### Decoding

The parser is intentionally forgiving:

- Accepts JSON arrays and CSV payloads.
- Tolerates one or more layers of URL decoding.
- Strips wrapping quotes around individual entries.
- Normalizes backslashes to forward slashes.
- Repairs malformed bracket payloads by adding a missing closing `]` when possible.

This means reference markers can survive legacy content, partial edits, and double-encoded payloads.

## Migration Rules

The app migrates markdown content in memory and, in some workflows, rewrites files to canonical form.

### Datetime Migrations

- `created_date` becomes `created_date_time`
- `focus_date_time` becomes `focus_date`
- `## Created Date` becomes `## Created Date/Time`

### Select Migrations

- `[!multiselect:status:...]` becomes `[!singleselect:status:...]`
- `[!multiselect:project-status:...]` becomes `[!singleselect:project-status:...]`
- `[!multiselect:effort:...]` becomes `[!singleselect:effort:...]`

When a multiselect is collapsed to a single value, the first value wins.

### Status Normalization

The following legacy values normalize to canonical status tokens:

- `not-started`, `active`, `planning` -> `in-progress`
- `on-hold`, `waiting-for` -> `waiting`
- `done`, `complete` -> `completed`
- `cancelled` stays `cancelled`

The normalization is case-insensitive and whitespace-insensitive.

Note:

- Runtime status normalization in dashboard/data hooks is broader than markdown migration. For example, loaders also treat values like `blocked`, `paused`, and `canceled` as aliases, even though `migrateMarkdownContent()` does not rewrite every one of those spellings on disk.

### Object Migration

GTD object payloads also migrate snake_case fields to camelCase:

- `created_date` -> `createdDateTime`
- `created_date_time` -> `createdDateTime`
- `due_date` -> `dueDate`
- `focus_date` -> `focusDate`
- `focus_date_time` -> `focusDate`
- `end_date` -> `endDate`
- `completed_date` -> `completedDate`
- `modified_date` -> `modifiedDate`

## Canonical Document Schemas

### Project README

Canonical location:

- `Projects/<Project Name>/README.md`
- `Projects/<Project Name>/README.markdown` is accepted by readers, but `README.md` is the canonical writer target.

Canonical order:

```markdown
# <Project Name>

## Status
[!singleselect:project-status:<value>]

## Due Date (optional)
[!datetime:due_date:<YYYY-MM-DD>]

## Desired Outcome
<body text>

## Horizon References
[!areas-references:<json-array>]
[!goals-references:<json-array>]
[!vision-references:<json-array>]
[!purpose-references:<json-array>]

## References (optional)
[!references:<csv>]

## Created
[!datetime:created_date_time:<iso-or-timestamp>]

## Actions
[!actions-list]

## Related Habits (optional)
[!habits-list]
```

Rules:

- Project status defaults to `in-progress`.
- Due date is date-only.
- The canonical project title is the H1.
- Additional custom content may be appended after the canonical sections.

### Habit File

Canonical location:

- `Habits/<Habit Name>.md`

Canonical order:

```markdown
# <Habit Name>

## Status
[!checkbox:habit-status:true|false]

## Frequency
[!singleselect:habit-frequency:<value>]

## Focus Date
[!datetime:focus_date:<iso-datetime>]

## Projects References
[!projects-references:<json-array>]

## Areas References
[!areas-references:<json-array>]

## Goals References
[!goals-references:<json-array>]

## Vision References
[!vision-references:<json-array>]

## Purpose & Principles References
[!purpose-references:<json-array>]

## References
[!references:<csv>]

## Created
[!datetime:created_date_time:<iso-datetime>]

## Notes
<optional body>

## History
<markdown table or default table body>
```

Rules:

- Habit status starts as `todo`, which is stored as `false`.
- Habit frequency defaults to `daily`.
- The history section is a markdown table in canonical form.
- The default history table header is:

```markdown
| Date | Time | Status | Action | Details |
| --- | --- | --- | --- | --- |
```

- History parsing preserves intro text, extra columns, blank spacer lines, and escaped pipes.
- Multiline history details are serialized using `<br>`.

### Area of Focus

Canonical location:

- `Areas of Focus/<Area Name>.md`

Canonical order:

```markdown
# <Area Name>

## Status
[!singleselect:area-status:<value>]

## Review Cadence
[!singleselect:area-review-cadence:<value>]

## Projects References
[!projects-references:<json-array>]

## Areas References (optional)
[!areas-references:<json-array>]

## Goals References
[!goals-references:<json-array>]

## Vision References (optional)
[!vision-references:<json-array>]

## Purpose & Principles References (optional)
[!purpose-references:<json-array>]

## References (optional)
[!references:<csv>]

## Created
[!datetime:created_date_time:<iso-datetime>]

## Description
<body text>
```

Rules:

- Status defaults to `steady`.
- Review cadence defaults to `monthly`.
- Optional reference sections are omitted when empty.
- Optional general references use CSV encoding.

### Goal

Canonical location:

- `Goals/<Goal Name>.md`

Canonical order:

```markdown
# <Goal Name>

## Status
[!singleselect:goal-status:<value>]

## Target Date (optional)
[!datetime:goal-target-date:<YYYY-MM-DD>]

## Projects References
[!projects-references:<json-array>]

## Areas References
[!areas-references:<json-array>]

## Vision References (optional)
[!vision-references:<json-array>]

## Purpose & Principles References (optional)
[!purpose-references:<json-array>]

## References (optional)
[!references:<csv>]

## Created
[!datetime:created_date_time:<iso-datetime>]

## Description
<body text>
```

Rules:

- Goal status defaults to `in-progress`.
- Target date is optional and omitted entirely when blank.

### Vision

Canonical location:

- `Vision/<Vision Name>.md`

Canonical order:

```markdown
# <Vision Name>

## Horizon
[!singleselect:vision-horizon:<value>]

## Projects References
[!projects-references:<json-array>]

## Goals References
[!goals-references:<json-array>]

## Areas References
[!areas-references:<json-array>]

## Purpose & Principles References (optional)
[!purpose-references:<json-array>]

## References (optional)
[!references:<csv>]

## Created
[!datetime:created_date_time:<iso-datetime>]

## Narrative
<body text>
```

Rules:

- Horizon defaults to `3-years`.
- The `10-years` token is accepted by the creator and builders.

### Purpose & Principles

Canonical location:

- `Purpose & Principles/<Purpose Name>.md`

Canonical order:

```markdown
# <Purpose Name>

## Projects References
[!projects-references:<json-array>]

## Goals References
[!goals-references:<json-array>]

## Vision References
[!vision-references:<json-array>]

## Areas References (optional)
[!areas-references:<json-array>]

## References (optional)
[!references:<csv>]

## Created
[!datetime:created_date_time:<iso-datetime>]

## Description
<body text>
```

Rules:

- The canonical default title is `Purpose & Principles`.
- The description body seeds the purpose statement and guiding principles text.

### Horizon Overview README

Each horizon folder has a canonical `README.md` overview page.

Canonical order:

```markdown
# <Label> Overview

## Altitude
[!singleselect:horizon-altitude:<purpose|vision|goals|areas>]

## Review Cadence
[!singleselect:horizon-review-cadence:<value>]

## Created
[!datetime:created_date_time:<iso-datetime>]

## Why this horizon matters
<body text>

## How to work this horizon in GTD Space
<body text>

## Horizon Pages Overview
<body text>

## Reference Index
[!<token>:[...]]

## Horizon Pages
[!<list-token>]
```

Rules:

- The `horizon-altitude` token is one of `purpose`, `vision`, `goals`, or `areas`.
- The reference marker uses JSON array syntax, not CSV.
- The list token matches the horizon: `purpose-list`, `vision-list`, `goals-list`, or `areas-list`.
- README files exclude themselves from the referenced page list.

## List Blocks

Canonical list block markers:

| Context | Token Style | Examples |
| --- | --- | --- |
| Horizon overview `README.md` files | singular, horizon-specific tokens from `horizon-config` | `purpose-list`, `vision-list`, `goals-list`, `areas-list` |
| Generic rendered list blocks | plural canonical tokens | `projects-list`, `goals-list`, `visions-list`, `habits-list` |

- `[!projects-list]`
- `[!areas-list]`
- `[!goals-list]`
- `[!visions-list]`
- `[!habits-list]`
- `[!actions-list]`
- `[!actions-list:<status-filter>]`
- `[!projects-areas-list]`
- `[!goals-areas-list]`
- `[!visions-goals-list]`

Accepted parser aliases:

- `[!projects-and-areas-list]` -> `projects-areas-list`
- `[!goals-and-areas-list]` -> `goals-areas-list`
- `[!visions-and-goals-list]` -> `visions-goals-list`

Rules:

- `actions-list` can include an optional status filter.
- Parser aliases normalize to the canonical hyphenated plural forms such as `projects-areas-list`, `goals-areas-list`, and `visions-goals-list`.
- The canonical writer uses the shorter hyphenated forms.
- Horizon overview `README.md` files use horizon-specific singular tokens from `horizon-config`, including `purpose-list` and `vision-list`; generic list blocks still use the plural forms such as `visions-list`.

## Title And Rename Rules

The app keeps titles and filesystem names synchronized, but the source of truth depends on the document type.

- Project folders are canonicalized around the folder name. If a project README title diverges from the folder name, the project loader rewrites the README title to match the folder.
- Saving a project page with a changed H1 triggers a project rename so the folder and README stay aligned.
- Actions are canonicalized around the file name. Saving a renamed H1 triggers an action file rename and a title rewrite.
- Horizon pages, habits, and other section markdown files follow the same save-time rename behavior when their H1 changes.
- Horizon overview README files use the canonical `<Label> Overview` title.
- The parser extracts the first H1 as the document title.

Practical rule:

- Do not treat the H1 as independent metadata. In GTD Space it is part of the filename/folder-name contract.

## Source Map

Primary implementation sources for this spec:

- `src/utils/gtd-markdown-helpers.ts`
- `src/utils/metadata-extractor.ts`
- `src/utils/data-migration.ts`
- `src/utils/horizon-readme-utils.ts`
- `src/utils/blocknote-preprocessing.ts`
- `src/components/gtd/CreatePageDialog.tsx`
- `src/components/gtd/CreateHabitDialog.tsx`
- `src/components/gtd/GTDWorkspaceSidebar.tsx`
- `src-tauri/src/commands/mod.rs`
- `tests/gtd-markdown-helpers.spec.ts`
- `tests/data-migration.spec.ts`
- `tests/horizon-readme-utils.spec.ts`
- `tests/habit-history.spec.ts`
