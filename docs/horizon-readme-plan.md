# Horizons Sidebar & README Modernization Plan

**Author:** Codex (GPT-5)  
**Date:** November 11, 2025  
**Scope:** `/Users/plebdev/Desktop/code/gtdspace`

---

## 1. Problem Statement
Horizons (Purpose & Principles, Vision, Goals, Areas of Focus) are seeded as folders with README files, but today they feel disconnected from the polished template experience:
- Sidebar rows are collapsible lists that immediately expose child pages; they do not behave like “project cards” where the README opens first.
- README content is thin, inconsistent with canonical page templates, and offers no live view of the horizon’s child pages.
- There is no automated wiring between folders and their READMEs, so reference lists drift out of sync as soon as users add or rename pages.

The goal is to make each horizon behave like Projects in the sidebar: a single row acts as the entry point, clicking opens the README, and expanding reveals the curated list of horizon pages. The README itself must function as an instructive landing page with a standardized header plus rendered reference sections listing the actual pages in that folder.

---

## 2. Success Criteria
1. **UI Parity:** Horizon rows follow the same interaction model as Projects (click → README, chevron → expand child list, hidden by default).  
2. **Instructive READMEs:** Every horizon README ships with rich, GTD-aligned copy explaining the altitude, how to use that folder in GTD Space, and where the rendered list of pages appears.  
3. **Live Reference Lists:** READMEs contain canonical reference blocks and a rendered `[!<horizon>-list]` section that automatically mirrors the files present in the folder.  
4. **Backward Compatible:** Existing workspaces keep custom content; migrations only add missing sections/tokens and sync page lists without overwriting user copy.  
5. **Low Maintenance:** Utilities keep reference tokens updated whenever files change, so READMEs never drift from filesystem reality.

---

## 3. User Stories
| Persona | Story |
|---------|-------|
| New GTD Space user | “When I click `Goals` in the sidebar I first see a rich Goals overview explaining what belongs here and how to review it. I can expand the row to jump to any goal file.” |
| Experienced user | “When I add or rename a Vision page, the Vision README automatically lists it without manual editing.” |
| Reviewer | “During my Weekly Review I can skim the Areas README to understand the horizon’s purpose, and immediately see the current Areas underneath without switching to the sidebar.” |

---

## 4. Experience Specification

### 4.1 Sidebar Interaction Model
- **Row anatomy:** icon, title, optional count badge, secondary actions (`+` create, `…` menu), and chevron.
- **Primary click (icon/title/README button):** opens `<Horizon>/README.md` in the editor panel. No expansion occurs on this click.
- **Chevron / keyboard toggle:** expands or collapses the child list (default collapsed). Expansion state should persist per workspace (reuse `expandedSectionsRef`).
- **Child list contents:** all `.md` files except `README.md`, sorted case-insensitively, rendered identical to project action rows (icon + title + hover menu).
- **Empty state:** “No pages yet” message plus inline shortcut to create a page.

### 4.2 README Page Structure
Each README uses the same page frame as other templates (header grid + BlockNote body). Required sections:
1. **Title:** `<Horizon Name> Overview`
2. **Header metadata:**  
   - `Created` datetime (read-only)  
   - `Altitude` singleselect (tokens: `purpose`, `vision`, `goals`, `areas`).  
   - Optional `Review Cadence` singleselect (Areas default monthly, Goals quarterly, Vision annually, Purpose on demand).  
   - `Reference Index` chips for cross-linking to other horizons as needed.
3. **Body sections (canonical order):**
   - `## Why this horizon matters` – GTD explanation + review cues.  
   - `## How to work this horizon in GTD Space` – specific UI instructions (creating pages, referencing, reviews).  
   - `## Horizon Pages Overview` – short paragraph introducing the rendered list.  
   - `## Reference Index` – `[!<horizon>-references:<json-array>]` (auto-managed).  
   - `## Horizon Pages` – `[!<horizon>-list]` block (rendered list of child files, read-only).  
   - Future optional sections (metrics, review log) can append later without reordering.

### 4.3 Rendered Reference Lists
- `[!<horizon>-list]` already has renderer support; ensure it supports inline options such as `[!goals-list:show-status=true]` for future enhancements (default `show-status=false`).
- `[!<horizon>-references:<json-array>]` acts as serialized data for other components (sidebar stats, future dashboards).
- README copy explicitly mentions that the list is auto-maintained and read-only to set expectations.

---

## 5. Technical Implementation Plan

### 5.1 Frontend: Sidebar Refactor
1. **Component extraction:** Create `HorizonFolderSection` within `src/components/gtd/sidebar/` that accepts `sectionMeta`, `files`, and callbacks (`onOpenReadme`, `onToggle`, `onCreate`).  
2. **Interaction logic:**  
   - `handleSectionClick(sectionPath)` exclusively opens README via `onFileSelect`.  
   - `toggleSection(sectionPath)` drives `Collapsible` open state, mirroring Projects.  
3. **State persistence:** Replace `expandedSections` map for horizons with a shared hook (`useSidebarSectionsState`) so Projects and Horizons store identical state semantics.  
4. **UX polish:**  
   - Add count badges showing number of horizon pages (excludes README).  
   - Provide tooltip copy (“Open Goals overview”) to reinforce behavior shift.  
   - Update keyboard handlers (`Enter` → README, `Space` → toggle).  
5. **Tests:** Add React Testing Library snapshots for collapsed/expanded states and keyboard interactions.

### 5.2 README Template System
1. **Docs:** Author `docs/horizon-readme-template.md` describing canonical markdown ordering, review cadence defaults, and acceptable tokens.  
2. **Builder helper:** Introduce `buildHorizonReadmeMarkdown(horizonType, contentOverrides)` in `src/utils/gtd-markdown-helpers.ts`. Responsibilities:  
   - Guarantee header metadata order.  
   - Inject `[!<horizon>-references:[]]` and `[!<horizon>-list]` if missing.  
   - Preserve user-edited body paragraphs between canonical sections.  
3. **Seed updates:**  
   - Replace `*_OVERVIEW_TEMPLATE` definitions in `src-tauri/src/commands/seed_data.rs` with the new copy + tokens.  
   - Pre-populate reference arrays with existing sample pages (if any) so the rendered list is non-empty on first launch.  
4. **Editor rendering:** Ensure BlockNote renders `[!<horizon>-list]` as a read-only component with explanatory hint text (reusing actions list styling but without filters).

### 5.3 Reference Synchronization Utility
1. **Utility module:** `src/utils/horizon-readme-sync.ts` exporting `syncHorizonReadme(folderPath, horizonType)`.  
2. **Process:**  
   - Enumerate markdown files under folder (via existing IPC).  
   - Generate sorted array of relative paths → JSON encode into `[!<horizon>-references:...]`.  
   - Rebuild `[!<horizon>-list]` block metadata (if additional attributes needed later).  
   - Skip `README.md`, ignore hidden files, and respect debounce to avoid spamming writes.  
3. **Triggers:**  
   - File create/delete/rename operations (`useWorkspaceFileEvents`, Tauri watchers).  
   - Manual “Refresh Horizon” command accessible from the sidebar context menu.  
4. **Error handling:**  
   - On failure, surface non-blocking toast and log to console; retries happen on next event.  
   - Protect against concurrent writes with file-lock utility already used by canonical rebuilds.

### 5.4 Data & Type Updates
1. **TypeScript types:** Formalize `GTDHorizonType = "purpose" | "vision" | "goals" | "areas"` and extend `sectionFileMetadata` to include `readmePath`, `pageCount`, and `lastSynced`.  
2. **Sidebar stats:** Display `pageCount` badge pulled from reference token length instead of recomputing at render.  
3. **Telemetry hooks (optional):** When a README sync occurs, emit `horizon_reference_sync` event for debugging adoption.

### 5.5 Backend / Seed Adjustments
1. **Initialization:** After seeding horizon folders, immediately call the sync utility from Rust via a Tauri command (`sync_horizon_readme`).  
2. **Existing command surface:** expose `sync_horizon_readme` to the frontend so migrations can invoke it for legacy workspaces.  
3. **Performance:** Batch sync operations during initialization to avoid N file writes; e.g., gather all horizon updates and issue a single IPC call per horizon.

---

## 6. Migration Strategy
1. **Detection:** On workspace load, inspect each `<Horizon>/README.md` for:  
   - Presence of `## Horizon Pages` + `[!<horizon>-list]`  
   - Presence of `[!<horizon>-references:]` token  
   - Presence of `## Why this horizon matters` copy.  
2. **Non-destructive insertion:** Use `migrateMarkdownContent()` to insert missing sections at canonical anchors. Preserve user-written intro paragraphs by placing new sections after the title unless duplicates already exist.  
3. **One-time sync:** After structural migration, run `syncHorizonReadme` so reference arrays reflect actual files.  
4. **Audit trail:** Log a concise summary in the developer console or telemetry (e.g., “Migrated Goals README → added Reference Index + 3 pages”).  
5. **Rollback plan:** Because we only append sections, users can delete the new blocks manually if they truly object; no irreversible mutations occur.

---

## 7. QA & Validation
1. **Automated tests:**  
   - Unit tests for `buildHorizonReadmeMarkdown` (fixtures covering blank README, custom copy, legacy order).  
   - Unit tests for `syncHorizonReadme` (mock FS lists, ensure JSON arrays match).  
   - Sidebar interaction tests verifying keyboard + mouse behaviors.  
2. **Manual checklist:**  
   - Clicking `Vision` opens `Vision/README.md`; chevron toggles list; re-opening preserves state.  
   - Adding `Vision/My Future Studio.md` updates README reference list within 2 seconds and increments badge count.  
   - Deleting a Goal file removes it from README list without leaving orphan entries.  
   - Migrated legacy workspace retains custom copy preceding the new sections.  
   - README body clearly explains horizon purpose and auto-generated list behavior.  
3. **Regression watch:** Ensure Projects, Habits, and other sidebar sections are unchanged (no layout regressions).

---

## 8. Timeline & Ownership
| Phase | Deliverables | Owner | Due |
|-------|-------------|-------|-----|
| P0 | Approve plan + copy outline | Product + Eng | Nov 11 |
| P1 | README template doc + seed copy + helper | Content + Platform | Nov 13 |
| P2 | Sidebar refactor + interaction parity | Frontend | Nov 15 |
| P3 | Reference sync utility + Tauri hook | Full-stack | Nov 16 |
| P4 | Migration runner + QA + docs update | Full-stack + QA | Nov 18 |

---

## 9. Open Questions
1. Should the `Altitude` singleselect live in the README header UI, or do we hardcode it per folder and hide the control? (Default: render read-only value sourced from config.)  
2. Do we want badge counts to reflect only “active” pages (e.g., exclude archived/resolved) once status metadata exists?  
3. Should `[!<horizon>-list]` support grouping (e.g., Goals by status) in this iteration or wait for telemetry feedback?  
4. Are there compliance concerns with automatically editing user-authored README files, and do we need an opt-out toggle?

---

## 10. Acceptance Checklist
- [ ] Horizon rows behave exactly like project folders in the sidebar (README on click, dropdown for children, hidden by default).  
- [ ] Each README ships with standardized header metadata, GTD explanations, and auto-generated `Reference Index` + `Horizon Pages` sections.  
- [ ] Reference tokens and rendered lists stay synchronized with filesystem contents without manual intervention.  
- [ ] Legacy workspaces migrate without clobbering user copy.  
- [ ] Documentation (`docs/horizon-readme-template.md`, `docs/GTD_IMPLEMENTATION.md`) reflects the new behavior.  
- [ ] QA sign-off includes keyboard accessibility, copy accuracy, and sync reliability tests.
