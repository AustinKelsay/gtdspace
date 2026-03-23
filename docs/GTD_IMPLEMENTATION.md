# GTD Implementation Guide

Updated: March 21, 2026

This guide explains how GTD Space applies Getting Things Done at a product level.

Authoritative reference:

- This is a high-level implementation guide.
- The canonical GTD rules, markdown schemas, and runtime behavior live in [`../spec/gtd-spec.md`](../spec/gtd-spec.md) and the supporting files in [`../spec/`](../spec/README.md).
- If this guide conflicts with code/tests or the `spec/` docs, the code/tests and `spec/` docs win.

## Overview

GTD Space is a local-first desktop app built around a GTD workspace on disk. The app treats markdown as the source material, then layers GTD meaning on top through canonical markers, folder conventions, sidebar behavior, dashboards, calendar derivation, and habit reset logic.

## Workspace Structure

When a GTD space is initialized, the app uses dedicated top-level folders rather than a shared `Horizons/` parent:

```text
<GTD Root>/
├── Projects/
├── Habits/
├── Areas of Focus/
├── Goals/
├── Vision/
├── Purpose & Principles/
├── Someday Maybe/
├── Cabinet/
└── Welcome to GTD Space.md
```

Each section has a distinct role:

- `Projects`: one folder per outcome, with a project README plus sibling action files.
- `Habits`: one markdown file per habit.
- `Areas of Focus`, `Goals`, `Vision`, `Purpose & Principles`: one markdown file per page plus a folder `README.md` overview.
- `Someday Maybe` and `Cabinet`: flat markdown collections for future ideas and reference material.

## Core GTD Model

The current implementation maps GTD concepts into the workspace like this:

- Projects represent multi-step outcomes.
- Actions are concrete next steps stored inside project folders.
- Habits are recurring commitments with frequency, checkbox state, and a history table.
- Horizons provide the higher-level structure:
  - Purpose & Principles: 50,000 ft
  - Vision: 40,000 ft
  - Goals: 30,000 ft
  - Areas of Focus: 20,000 ft

The app interprets these items from markdown markers such as single-selects, datetimes, references, checkboxes, and list blocks. Exact marker syntax and canonical ordering are documented in [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md).

## How GTD Space Behaves

### Projects and Actions

- A project lives at `Projects/<Project Name>/README.md`.
- Actions live beside that README as sibling markdown files.
- Project READMEs carry project status, due date, desired outcome, references, and list blocks such as `[!actions-list]`.
- Action files carry status, focus date, due date, effort, contexts, references, and created timestamp.
- Saving with a changed H1 can trigger rename behavior for the project folder or action file.
- Shared frontend helpers now own the canonical parsing/rebuild rules for these files so schema changes do not have to be repeated in every page and hook.

### Habits

- Habits store checkbox state, frequency, references, created timestamp, optional notes, and a history table.
- Manual toggles call the backend habit update command and append history rows.
- The app also runs periodic habit reset checks while a GTD space is open.
- Habit parsing and reset semantics are now centralized in shared frontend and backend domain helpers, including calendar-based reset windows and legacy history migration.

### Horizons

- Each horizon folder has a `README.md` overview page plus child markdown pages.
- Clicking a horizon row in the sidebar opens the overview README; expanding the row reveals the child pages.
- Horizon READMEs include canonical metadata such as altitude, review cadence, reference index, and horizon page list markers.
- Reference lists are synchronized from the filesystem rather than maintained by hand.

## Cross-Linking and References

The app uses path-based references across the workspace:

- Project, habit, and horizon files can store references to other GTD items.
- Generic references can point into `Cabinet` and `Someday Maybe`.
- Reference tokens are parsed from markdown and surfaced in the sidebar, page headers, and rendered list blocks.

No strict database-style referential integrity is enforced. The app resolves what it can from the current filesystem state.

## Runtime Features

Several runtime systems make the markdown workspace feel like a cohesive GTD app:

- Sidebar metadata refreshes from content events and file operations.
- Dashboards derive filtered project/action/habit summaries from markdown content.
- Calendar derives entries from project due dates, action focus/due dates, habit timing, and synced Google Calendar events.
- Habit reset polling runs on startup and every 60 seconds while a GTD space is open.
- File watching and content events keep open tabs and workspace views synchronized.

## Where To Go Next

- For the authoritative GTD rules: [`../spec/gtd-spec.md`](../spec/gtd-spec.md)
- For markdown markers and canonical section ordering: [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md)
- For the data model and data flows: [`gtd-data-model.md`](./gtd-data-model.md)
- For runtime event behavior: [`content-events.md`](./content-events.md)
- For horizon README structure: [`horizon-readme-template.md`](./horizon-readme-template.md)
