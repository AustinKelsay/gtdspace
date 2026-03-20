# GTD Spec

This directory contains the current GTD spec for the codebase.

`gtd-spec.md` is the current single-file reference. The numbered docs remain as the deeper supporting breakdowns we can keep validating against the code and tests.

## Files

- `01-workspace-and-domain-model.md`: workspace shape, top-level folders, item types, defaults, canonical file locations, and relationship rules
- `02-Markdown-schema.md`: the GTD Markdown language, token set, encoding/decoding rules, migrations, canonical section ordering, and title/rename behavior
- `03-runtime-behavior.md`: dashboard behavior, event semantics, file watching, calendar inclusion, habit reset logic, and Google Calendar sync

## Ground Rules

- These docs describe what the app enforces today.
- When there is a conflict, current code and tests win.
- Known mismatches and weak spots are recorded explicitly so they can be fixed or covered by future tests.

## Next Step

Keep tightening `gtd-spec.md` as the primary reference and turn its rules into explicit validation and regression tests over time.
