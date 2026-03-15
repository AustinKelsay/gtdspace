# Horizon README Template - Structure & Canonical Markdown

Updated: November 11, 2025

This document defines the canonical README structure shared by all Horizons folders in GTD Space (Purpose & Principles, Vision, Goals, Areas of Focus). It aligns the folder overview page with the standardized horizon page templates so the sidebar interaction model mirrors Projects.

- Explains the expected UI/UX behavior for horizon overview pages.
- Documents the canonical markdown ordering enforced by the README builder.
- Lists required metadata tokens, default values, and copy anchors.
- Serves as the single reference for seed content, migrations, and QA.

## UX Goals

1. **README-first navigation** – Clicking a horizon row in the sidebar opens the folder README before exposing child pages.
2. **Instructional copy** – The README teaches the GTD altitude, review cadence, and how to work that horizon inside GTD Space.
3. **Live reference list** – Each README embeds reference tokens plus a rendered `[!<horizon>-list]` block so the page reflects the actual files stored in the folder.
4. **Canonical layout** – All horizons share the same header grid and body ordering to keep migrations and automation predictable.

## Header Specification

| Field           | Type         | Tokens                                                                                | Notes                                                                            |
| --------------- | ------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Title           | H1           | `<Horizon Name> Overview`                                                             | Non-editable default title; users may rename but migrations reinsert if missing. |
| Altitude        | SingleSelect | `purpose` · `vision` · `goals` · `areas`                                              | Read-only value derived from folder type; displayed as badge in header.          |
| Review Cadence  | SingleSelect | `on-demand` (Purpose) · `annually` (Vision) · `quarterly` (Goals) · `monthly` (Areas) | Optional; omitted if cadence is `on-demand`.                                     |
| Created         | DateTime     | `[!datetime:created_date_time:ISO]`                                                   | Set on seed; never regenerated.                                                  |
| Reference Chips | JSON         | `[!<horizon>-references:<json-array>]`                                                | Managed by sync utility; never hand-edited.                                      |

Header layout mirrors other templates: 2-column grid, `px-12` gutter, `border-t border-border` divider separating metadata from the BlockNote body.

## Body Sections (Canonical Order)

The README builder enforces the following markdown order. Optional sections drop entirely when empty. Blank lines separate all blocks.

```markdown
# <Horizon Name> Overview

## Why this horizon matters

<Copy describing the GTD altitude, example prompts, and review frequency.>

## How to work this horizon in GTD Space

<Instructions for creating pages, linking references, and running reviews.>

## Horizon Pages Overview

<Short paragraph explaining the rendered list below.>

## Reference Index

[!<horizon>-references:<json-array-or-empty-string>]

## Horizon Pages

[!<horizon>-list]
```

Notes:

- The builder inserts placeholder paragraphs for the first three sections so migrations never erase user copy; content may be edited freely.
- `[!<horizon>-list]` renders a read-only list of markdown files inside the folder (excluding `README.md`).
- `[!<horizon>-references:]` stores the same list as JSON for programmatic use (sidebar counts, dashboards, etc.).

## Copy Blocks per Horizon

| Horizon              | GTD Altitude | Default "Why" Highlights                                     | Review Guidance                                                       |
| -------------------- | ------------ | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| Purpose & Principles | 50,000 ft    | Mission statement, guiding values, filters for big decisions | Revisit when making life/mission pivots; optional `on-demand` cadence |
| Vision               | 40,000 ft    | Vivid snapshot 3–5 years out, big themes, success signals    | Review annually or when strategizing multi-year direction             |
| Goals                | 30,000 ft    | 12–24 month objectives feeding the vision                    | Review quarterly; ensure each goal has supporting projects/actions    |
| Areas of Focus       | 20,000 ft    | Ongoing roles and responsibilities (life/business)           | Review monthly; check load balance and commitments                    |

The builder references these defaults when seeding README copy or backfilling legacy files.

## Canonical Tokens & Defaults

| Horizon              | Reference Token            | List Block        | Default Cadence | Seed Paragraph Key                            |
| -------------------- | -------------------------- | ----------------- | --------------- | --------------------------------------------- |
| Purpose & Principles | `[!purpose-references:[]]` | `[!purpose-list]` | `on-demand`     | `purposeWhy`, `purposeHow`, `purposeOverview` |
| Vision               | `[!vision-references:[]]`  | `[!vision-list]`  | `annually`      | `visionWhy`, `visionHow`, `visionOverview`    |
| Goals                | `[!goals-references:[]]`   | `[!goals-list]`   | `quarterly`     | `goalsWhy`, `goalsHow`, `goalsOverview`       |
| Areas of Focus       | `[!areas-references:[]]`   | `[!areas-list]`   | `monthly`       | `areasWhy`, `areasHow`, `areasOverview`       |

## Builder Requirements

Any helper that generates or migrates horizon READMEs must:

- Preserve user-authored content within the `Why`, `How`, and `Overview` sections while enforcing their ordering.
- Guarantee that `Reference Index` and `Horizon Pages` sections exist with the correct tokens, regardless of user edits.
- Normalize reference arrays to compact JSON (no whitespace, sorted by file name) for deterministic diffs.
- Avoid rewriting the file when no changes are detected.

## QA Checklist

- Title, header layout, and divider match other horizon templates.
- `Reference Index` JSON matches the files rendered in `[!<horizon>-list]`.
- Creating, renaming, or deleting a horizon page updates both the JSON token and the rendered list after the sync utility runs.
- Migrations append missing sections without duplicating headings or removing custom copy.

---

References:

- `docs/vision-page-template.md`, `docs/goal-page-template.md`, `docs/area-page-template.md`, `docs/purpose-page-template.md` for shared layout guidance.
- `docs/gtd-data-model.md` for token definitions and list block syntax.
