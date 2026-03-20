# DateTime Fields

Updated: March 20, 2026

This document covers the datetime marker family used in GTD Space.

Authoritative reference:

- The canonical datetime fields and markdown ordering live in [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md).
- Use this file as a focused implementation note for editor behavior and common field usage.

## Marker Format

```markdown
[!datetime:<field>:<value>]
```

Examples:

```markdown
[!datetime:due_date:2026-03-20]
[!datetime:focus_date:2026-03-20T09:00:00]
[!datetime:created_date_time:2026-03-20T15:30:00Z]
[!datetime:goal-target-date:2027-01-15]
```

## Common Fields

Current commonly used datetime fields include:

- `created_date_time`
- `due_date`
- `focus_date`
- `goal-target-date`

The parser also accepts some legacy aliases such as `created_date` and `focus_date_time`.

## GTD Usage

- Actions use `focus_date`, `due_date`, and `created_date_time`
- Projects use `due_date` and `created_date_time`
- Goals use `goal-target-date`
- Horizon overview READMEs use `created_date_time`

## Editor Behavior

Datetime markers are rendered as interactive date/time controls inside the editor.

Important current behavior:

- `due_date` is treated as date-only
- `focus_date` may be date-only or datetime
- UI flows that collect a focus date without a time default to `09:00:00`
- created timestamps are generally treated as stable once written

## Migration Notes

Current migration behavior includes:

- `created_date` -> `created_date_time`
- `focus_date_time` -> `focus_date`
- `## Created Date` -> `## Created Date/Time`

See [`data-migration.md`](./data-migration.md) for the current migration call sites.

## Related Docs

- [`markdown.md`](./markdown.md)
- [`data-migration.md`](./data-migration.md)
- [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md)
