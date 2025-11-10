# Horizon Readme Modernization Plan

**Author:** Codex (GPT-5)  
**Date:** November 10, 2025  
**Scope:** `/Users/plebdev/Desktop/code/gtdspace`

## 1. Objectives & Success Criteria
- Give every Horizons folder (Purpose & Principles, Vision, Goals, Areas of Focus) the same affordances as Projects in the sidebar: a primary row that opens the folder README plus a collapsible list of child pages.
- Replace the current “lazy” README seeds with rich, instructive overview pages that teach what each horizon means in GTD, describe how to use that folder inside GTD Space, and surface living metadata.
- Embed lightweight reference sections inside each README that automatically list the horizon pages stored in that folder so users can scan and navigate even when they are inside the editor.
- Maintain backwards compatibility for existing workspaces (no data loss, no broken sidebar interactions) while encouraging migrations to the new template format.

## 2. Current State Snapshot
1. **Folder scaffolding** — `src-tauri/src/commands/mod.rs` + `seed_data.rs` create folders and `README.md` files, but the content is brief and not aligned with the canonical templates (`docs/vision-page-template.md`, etc.).
2. **Sidebar behavior** — `src/components/gtd/GTDWorkspaceSidebar.tsx` lists each horizon as a `Collapsible` section. Clicking the header opens the README (lines ~1985–2001), but the row does not show metadata (counts, cadence summaries, etc.), and the dropdown simply lists markdown files minus the README (line 285 filter).
3. **Reference UX** — No mechanism keeps READMEs aware of their child pages. There are GTD list markers like `[!goals-list]` (see `docs/gtd-data-model.md:57-59`), but they are not used in the seed content.
4. **Templates** — Horizon-specific templates (`docs/*-page-template.md`) describe individual page structures, but not the folder-level README conventions we want.

## 3. Requirements (from user brief)
- Treat every horizon folder like a project node: one clickable row reveals the README plus an expandable drawer of individual horizon pages.
- Rewrite README seeds to be “instructive informative default pages” that explain each horizon within GTD, describing how GTD Space expects you to use it.
- Add “simple reference list fields” to the README that enumerate the actual horizon pages in that folder (effectively auto-generated tables of contents).
- Preserve the ability to add new pages from the sidebar and from dialogs.

## 4. Proposed Solution Overview
| Workstream | Description |
|------------|-------------|
| A. README Content System | Define canonical README structure + content per horizon, update `seed_data.rs`, and document the structure in `/docs`. |
| B. Sidebar UI & UX | Refactor the horizon section in `GTDWorkspaceSidebar.tsx` to mirror `Projects` (header row, inline stats, nested file list). |
| C. Reference List Wiring | Introduce a small utility that syncs horizon folder contents into the README reference block (insert/update tokens). |
| D. Migration & Backfill | Detect existing workspaces, add missing README sections, and backfill reference lists without overriding user customizations. |
| E. QA & Telemetry | Extend tests (unit + exploratory) to cover the new sidebar behavior and README token updates. |

## 5. Detailed Implementation Plan

### A. README Content System
1. **Canonical structure definition**
   - Create `docs/horizon-readme-template.md` that documents the shared layout:
     ```markdown
     # <Horizon Name> Overview

     ## Why this horizon matters
     <copy>

     ## How to work this horizon in GTD Space
     <context + UI instructions>

     ## Reference Index
     [!<horizon>-references:<json-array>]

     ## Horizon Pages
     [!<horizon>-list]
     ```
   - Bring over altitude descriptions from the official GTD sources already summarized.
2. **Seed updates** (`src-tauri/src/commands/seed_data.rs`)
   - Replace `*_OVERVIEW_TEMPLATE` strings with richer content per the template above.
   - Inject copy that explains review cadence, what “clicking the folder header” does, and how to create child pages.
   - Add placeholder reference tokens, e.g., `[!areas-references:[]]`, plus `[!areas-list]` to leverage the existing list-rendering system.
3. **Shared constants**
   - Consider storing horizon metadata in `src/utils/horizon-config.ts` so both the frontend and Tauri code share review cadence text, altitude labels, and README snippet copy.

### B. Sidebar UI & UX
1. **Componentization**
   - Extract a `HorizonFolder` component from `GTDWorkspaceSidebar.tsx` responsible for rendering header row, README click action, stats, and child list. This keeps the main component manageable.
2. **Header behavior**
   - Mirror `Projects` rows: icon + title, inline stats (e.g., “3 Vision pages”), a `Badge` that reflects the number of markdown files, and a secondary icon for quick actions (create page, open folder).
   - Clicking the icon or title opens the README (`README.md`). Clicking the chevron toggles expansion only (match project affordances to avoid accidental README opens).
3. **Child list**
   - Continue to list `.md` files minus the README, but visually match action list styles (status icon placeholder + rename support).
   - Add an inline pill showing whether a file is linked elsewhere (optional stretch: show `goal-status` inside Goals list).
4. **State management**
   - Store readme metadata in `sectionFileMetadata` (already present) so header rows can display the `last_reviewed` or `created` timestamp once we capture it.
5. **Keyboard & accessibility**
   - Ensure `Enter` activates the README; `Space` toggles the collapsible; arrow keys follow WAI-ARIA accordion recommendations.
6. **Create Flow**
   - Keep the `+` button but relocate it inside the header action group so it mirrors the project action button placement.

### C. Reference List Wiring
1. **Utility**
   - Add `syncHorizonReferenceList(folderPath: string, readmePath: string, token: string)` inside `src/utils/gtd-markdown-helpers.ts` or a new `horizon-readme-utils.ts`.
   - Logic: read README, parse JSON array in `[!<token>-references:...]`, diff against actual files (ordered alphabetically), rewrite the token when there is a change.
2. **Invocation Points**
   - Trigger the sync after:
     - Creating/deleting/moving a horizon page (already have hooks via `CreatePageDialog`, `deleteItem`).
     - Manual refresh (Refresh button already loops over sections).
   - In Tauri backend, update initialization to call the sync once after seeding sample pages.
3. **Error Handling**
   - Wrap updates in try/catch; on failure surface a toast but do not block UI interactions.
   - Preserve user edits outside the reference token by using the canonical markdown builder functions.

### D. Migration & Backfill
1. **Detection**
   - During workspace load (`useGTDSpace` or a dedicated migration helper), check for each horizon folder’s README: does it contain `## Reference Index` and `[!<horizon>-list]`? If not, append/migrate.
2. **Non-destructive update**
   - Use `migrateMarkdownContent()` to insert missing headings or tokens without altering custom copy.
   - Log migrations in the developer console for debugging.
3. **Telemetry / Analytics (optional)**
   - Emit a custom event when horizon READMEs are updated to monitor adoption.

### E. QA & Observability
1. **Unit Coverage**
   - Tests for the new sync utility (input README string + directory listing → expected token JSON).
   - Snapshot tests for `HorizonFolder` (expanded + collapsed states).
2. **Manual QA checklist**
   - Creating a new goal updates the Goals README reference list.
   - Deleting a vision page removes it from the README list.
   - Clicking the Goals header opens `/Goals/README.md` while the chevron just expands.
   - Existing workspaces with custom README copy retain edits; only new sections are appended.
3. **Docs**
   - Update `docs/GTD_IMPLEMENTATION.md` (Horizons section) to reflect the new interaction model plus screenshot references once available.

## 6. Open Questions / Decisions Needed
1. **Reference token format** — Should we reuse `[!goals-list]` or store explicit JSON arrays? Proposal: use both (JSON token for programmatic use, list block for human scan). Need confirmation.
2. **Status surfacing** — Do we want inline status chips (e.g., Goal status) in the sidebar list now or later? Not required for the first pass but worth noting.
3. **Auto-review timestamps** — Should READMEs track “last reviewed” metadata that the sidebar can display? Requires extra UX guidance.

## 7. Timeline Draft
| Phase | Deliverables | Owner | ETA |
|-------|-------------|-------|-----|
| Day 1 | Finalize README template doc + copywriting | Content & Eng | Nov 12 |
| Day 2 | Sidebar component refactor + create flow parity | Frontend | Nov 14 |
| Day 3 | Reference sync utility + backend hooks | Full-stack | Nov 15 |
| Day 4 | Migration script + QA pass | Full-stack + QA | Nov 17 |

## 8. Acceptance Criteria Checklist
- [ ] README seeds include Why/How/Reference sections with live list tokens.
- [ ] Sidebar horizon rows show README on click and child pages in collapsible drawers identical to projects.
- [ ] Adding/removing horizon pages updates the README reference lists automatically.
- [ ] Existing spaces migrate without losing custom copy.
- [ ] Documentation updated (GTD implementation guide + new README template doc).
