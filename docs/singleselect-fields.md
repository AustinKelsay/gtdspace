# SingleSelect Fields

Updated: March 20, 2026

This document covers the single-select marker family used in GTD Space.

Authoritative reference:

- The canonical token set and markdown ordering live in [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md).
- Use this file as an implementation-oriented companion, not a competing source of truth.

## Marker Format

```markdown
[!singleselect:<field>:<value>]
```

Common examples:

- `[!singleselect:status:in-progress]`
- `[!singleselect:effort:medium]`
- `[!singleselect:project-status:waiting]`
- `[!singleselect:goal-status:completed]`
- `[!singleselect:vision-horizon:3-years]`

## Where Single-Selects Are Used

Current major single-select fields include:

- action status
- project status
- effort
- habit frequency
- area status
- area review cadence
- goal status
- vision horizon
- horizon altitude
- horizon review cadence

## Current Canonical Values

Examples of current canonical value sets:

- Action status: `in-progress`, `waiting`, `completed`, `cancelled`
- Project creation status: `in-progress`, `waiting`, `completed`
- Effort: `small`, `medium`, `large`, `extra-large`
- Habit frequency: `5-minute`, `daily`, `every-other-day`, `twice-weekly`, `weekly`, `weekdays`, `biweekly`, `monthly`

Some runtime loaders normalize additional legacy values into those canonical sets.

## Editor Behavior

Single-select markers are converted into interactive editor blocks when files are loaded. On save, the selected value is written back into the markdown marker.

This gives GTD Space a constrained, structured way to store state without frontmatter or a database.

## Migration From Legacy Multi-Selects

Legacy `[!multiselect:status:...]`, `[!multiselect:project-status:...]`, and `[!multiselect:effort:...]` markers are migrated to single-select form.

Current migration behavior:

- the first legacy value wins
- legacy aliases are normalized to the canonical token set
- migrated content may be rewritten back to disk in some flows

## Related Docs

- [`multiselect-fields.md`](./multiselect-fields.md)
- [`datetime-fields.md`](./datetime-fields.md)
- [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md)
