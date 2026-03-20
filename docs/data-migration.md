# Data Migration Guide

Updated: March 20, 2026

This document explains the migration paths GTD Space applies to older markdown content and loaded GTD objects.

Authoritative reference:

- This is a focused implementation note.
- The canonical migration rules live in [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md).
- If this guide conflicts with code/tests or the `spec/` docs, the code/tests and `spec/` docs win.

## What Gets Migrated

The current migration layer handles a small set of schema changes:

- `created_date` becomes `created_date_time`
- `focus_date_time` becomes `focus_date`
- `## Created Date` becomes `## Created Date/Time`
- legacy multiselect `status`, `project-status`, and `effort` markers collapse to single-select markers
- legacy status aliases normalize to canonical tokens such as `in-progress`, `waiting`, and `completed`

These migrations exist to keep older markdown readable without forcing manual cleanup.

## Markdown Migration

Markdown migration is handled by `migrateMarkdownContent()`.

Current behavior:

- When a file is opened in tabs, migrated content may be saved back to disk if the canonicalized content changed.
- Calendar loading applies markdown migration in memory only.
- Migration is intentionally targeted rather than broad; it rewrites known legacy patterns and leaves unrelated content alone.

Current call sites:

- `useTabManager` for tab-open flows
- `useCalendarData` for calendar derivation

## Object Migration

Loaded GTD objects also pass through `migrateGTDObjects()` so older backend-shaped data still matches current frontend expectations.

Current call sites include:

- `useGTDSpace`
- `useProjectsData`

Object migration mainly handles property-name normalization and legacy status cleanup.

## Canonical Status Mapping

Legacy status words normalize to the current canonical set:

- `not-started`, `active`, `planning` -> `in-progress`
- `on-hold`, `waiting-for`, `blocked`, `paused` -> `waiting`
- `done`, `complete`, `finished` -> `completed`
- `cancelled` stays `cancelled`

## Example

Before:

```markdown
## Status
[!multiselect:project-status:active,planning]

## Created Date
[!datetime:created_date:2025-01-15]
```

After:

```markdown
## Status
[!singleselect:project-status:in-progress]

## Created Date/Time
[!datetime:created_date_time:2025-01-15]
```

## Notes

- Migration checks are intentionally lightweight and pattern-based.
- Some workflows rewrite migrated content back to disk; others keep it in memory only.
- Exact rules should stay small and explicit so they remain easy to reason about and test.
