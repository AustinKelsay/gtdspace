# GTDspace Agent Interface Plan

Updated: March 20, 2026

## Goal

Ship a full agent interface for GTDspace that allows external agents to safely read, understand, and write a GTDspace workspace according to the existing spec.

This agent interface should ship as:

- an MCP server
- a CLI
- a bundled skill

The three surfaces should share one underlying contract and one implementation of the GTD domain rules. They should not become three separate interpretations of GTDspace.

## Why This Matters

GTDspace already behaves like a structured local-first knowledge and workflow system. The workspace, markdown schema, item types, references, and runtime behaviors are documented in:

- [`../spec/gtd-spec.md`](../spec/gtd-spec.md)
- [`../spec/01-workspace-and-domain-model.md`](../spec/01-workspace-and-domain-model.md)
- [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md)
- [`../spec/03-runtime-behavior.md`](../spec/03-runtime-behavior.md)

Today, the app already has a strong internal GTD model, but the exposed integration layer is still the Tauri invoke surface in [`../src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) and [`../src-tauri/src/commands/mod.rs`](../src-tauri/src/commands/mod.rs). That is useful for the desktop app, but it is not yet a stable or safe public interface for agents.

## Product Definition

An agent interface for GTDspace means:

1. Agents can inspect a workspace and understand its canonical GTD structure.
2. Agents can read typed GTD entities without re-implementing the markdown parser every time.
3. Agents can make safe mutations that preserve GTDspace invariants.
4. Agents can discover relationships, backlinks, scheduling data, and review context.
5. Agents can do the above from any agent host through MCP, from shell automation through a CLI, and from Codex-style environments through a bundled skill.

## Design Principles

### One Domain Contract

The GTD spec should be implemented once in a shared service layer and consumed by MCP, CLI, Tauri commands, and tests.

### Reads Must Be Pure

Agent-facing read operations must never rewrite files as a side effect.

### Writes Must Be Canonical

Agent writes should preserve or restore canonical GTDspace formatting:

- correct top-level folder placement
- correct H1 and file/folder identity rules
- correct token families and values
- correct section order
- normalized reference encoding
- derived backlink and overview updates where required

### Structured First, Raw Files Last

Agents should prefer typed operations over direct file editing. Raw markdown access should still exist, but it should not be the default path for common GTD actions.

### Deterministic Automation

CLI and MCP responses should be predictable, machine-readable, and validation-friendly.

## Current State Summary

### What Already Exists

- Tauri file and workspace primitives in [`../src-tauri/src/commands/mod.rs`](../src-tauri/src/commands/mod.rs)
- GTD creation flows for projects, actions, and habits
- markdown parsing in [`../src/utils/metadata-extractor.ts`](../src/utils/metadata-extractor.ts)
- canonical markdown builders in [`../src/utils/gtd-markdown-helpers.ts`](../src/utils/gtd-markdown-helpers.ts)
- typed GTD entities in [`../src/types/index.ts`](../src/types/index.ts)
- search and relationship helpers

### Main Gaps

- no single shared agent-facing service layer
- no structured CRUD for all horizons
- read paths that can mutate state
- shallow search and watcher semantics for external automation
- split parser/writer logic across Rust and TypeScript
- no strict validation/dry-run contract for safe automation
- no agent-oriented documentation or shipped skill

## Target Architecture

Create a shared backend domain layer and place MCP, CLI, and existing Tauri commands on top of it.

### Proposed Layers

1. GTD Domain Layer
   Responsible for parsing, validation, canonical writing, indexing, relationship derivation, and workspace rules.

2. Agent Service Layer
   Responsible for stable operations such as get/list/create/update/delete/rename/search/backlinks/validate.

3. Surface Adapters
   - Tauri commands for the desktop app
   - MCP server for external agent hosts
   - CLI for shell scripts and local automation
   - skill docs/prompts for agent behavior guidance

### Proposed Rust Structure

Suggested modules under `src-tauri/src/`:

- `gtd/schema.rs`
- `gtd/parser.rs`
- `gtd/writer.rs`
- `gtd/index.rs`
- `gtd/relationships.rs`
- `gtd/service.rs`
- `gtd/errors.rs`
- `bin/gtdspace-cli.rs`
- `bin/gtdspace-mcp.rs`

### Responsibilities

`schema.rs`
- canonical enums and token families
- validation rules
- normalization helpers

`parser.rs`
- parse markdown into typed GTD entities
- support legacy tolerance on reads
- expose warnings for migrated or weak content

`writer.rs`
- write canonical markdown
- preserve unrelated content where possible
- enforce section ordering and token normalization

`index.rs`
- recursive workspace scan
- typed entity index
- fast search inputs
- cache invalidation model

`relationships.rs`
- backlinks
- horizon reference resolution
- derived README reference index support

`service.rs`
- stable high-level operations used by Tauri, MCP, and CLI

## Core Domain Model To Expose

The agent interface should expose typed entities for:

- workspace
- project
- action
- habit
- area
- goal
- vision
- purpose
- generic file
- relationship/backlink
- validation issue
- planned change

Each entity should expose:

- canonical path
- display name/title
- raw markdown
- parsed metadata
- normalized references
- warnings if content is legacy or partially malformed

## Required Invariants

The shared service layer should enforce these invariants:

- GTD metadata uses inline markers, not YAML frontmatter
- canonical top-level folders are direct children of the workspace root
- project canonical file is `Projects/<Project Name>/README.md`
- action canonical file is a sibling markdown file within a project folder
- horizon pages and habits remain aligned with H1/file identity rules
- typed reference arrays use normalized forward-slash paths
- generic references use CSV
- writes emit canonical field names such as `created_date_time`, `focus_date`, and `goal-target-date`
- habit history keeps its table structure
- writes preserve the workspace as something the current app can load without ambiguity

## Public Operation Set

These operations should exist in the shared service layer and be exposed by both MCP and CLI.

### Workspace

- `workspace.validate`
- `workspace.summary`
- `workspace.index`
- `workspace.initialize`
- `workspace.rebuildDerivedData`

### Items

- `items.get`
- `items.list`
- `items.search`
- `items.create`
- `items.update`
- `items.rename`
- `items.delete`
- `items.readRaw`
- `items.writeRaw`

### Typed Entity Groups

- `projects.list|get|create|update|rename|delete`
- `actions.list|get|create|update|rename|delete`
- `habits.list|get|create|update|rename|delete|toggle|resetCheck`
- `areas.list|get|create|update|rename|delete`
- `goals.list|get|create|update|rename|delete`
- `vision.list|get|create|update|rename|delete`
- `purpose.list|get|create|update|rename|delete`

### Relationships

- `relationships.backlinks`
- `relationships.references`
- `relationships.rebuild`

### Reviews And Context

- `reviews.workspaceSnapshot`
- `reviews.weekly`
- `calendar.extract`

## MCP Plan

### Purpose

Provide the cleanest interface for external agent hosts that support tool calling and structured resources.

### Transport

- stdio MCP server first
- optional future HTTP wrapper only if needed later

### Initial MCP Tools

- `workspace_validate`
- `workspace_summary`
- `workspace_index`
- `item_get`
- `item_list`
- `item_search`
- `item_create`
- `item_update`
- `item_rename`
- `item_delete`
- `relationship_backlinks`
- `review_weekly_snapshot`
- `calendar_extract`

### MCP Resource Ideas

- `gtdspace://spec/summary`
- `gtdspace://workspace/summary`
- `gtdspace://workspace/index`
- `gtdspace://item/<encoded-path>`

### MCP Requirements

- JSON-schema-based inputs and outputs
- strict validation failures
- dry-run support for mutating tools
- explicit warnings when content was auto-normalized
- no hidden file mutation during read tools

## CLI Plan

### Purpose

Provide local automation, scripting, debugging, and a fallback for environments that do not support MCP.

### Command Shape

Use a single command such as `gtdspace`.

Example command tree:

```text
gtdspace workspace validate --path <root> --json
gtdspace workspace index --path <root> --json
gtdspace list projects --path <root> --json
gtdspace get item --path <file> --json
gtdspace create project ...
gtdspace update action ...
gtdspace backlinks --target <path> --workspace <root> --json
gtdspace review weekly --path <root> --json
```

### CLI Requirements

- human-readable mode by default
- deterministic `--json` mode
- stable exit codes
- `--dry-run` on mutating commands
- `--validate-only` where useful
- no UI fallbacks
- errors should be actionable and specific

## Skill Plan

### Purpose

Ship a bundled skill so agents using Codex-like systems understand:

- what GTDspace is
- what the canonical workspace and markdown schema are
- which tools to prefer
- what mutation rules to follow

### Suggested Skill Contents

`SKILL.md` should include:

- workspace layout
- canonical item types
- allowed enum values
- marker syntax
- path and H1 identity rules
- backlink and derived-data expectations
- safe write checklist
- preferred order of operations:
  - use MCP typed tools first
  - use CLI second
  - use raw file edits only when structured operations are unavailable

### Skill Extras

Include example prompts for:

- capture to inbox/project/action
- weekly review
- finding stale projects
- linking projects to goals/areas
- habit status and review flows

## Phased Delivery Plan

### Phase 0: Contract Freeze

Goal:
- decide exactly what the agent contract is

Tasks:
- freeze canonical entity shapes from the existing spec
- define validation error categories
- define pure-read policy
- define mutating-operation return shape
- define dry-run output shape

Deliverables:
- service contract doc
- test matrix doc

### Phase 1: Shared Domain Extraction

Goal:
- extract GTD logic from Tauri command handlers into reusable Rust modules

Tasks:
- move parsing and normalization helpers into shared modules
- move canonical writers into shared modules
- unify relationship logic
- add recursive index building
- add read-only item loading for all entity types

Deliverables:
- shared `gtd` Rust module
- tests for parse/write/index/relationships

### Phase 2: Validation And Safety

Goal:
- make automation safe before making it broad

Tasks:
- enforce side-effect-free reads
- add strict workspace validation
- add dry-run planning for writes
- add structured warnings for legacy content
- add consistency checks for H1/path mismatch and broken references

Deliverables:
- validation report format
- dry-run change format

### Phase 3: CLI MVP

Goal:
- make the shared layer usable locally and scriptably

Tasks:
- implement workspace validate/index
- implement list/get/search
- implement CRUD for projects/actions/habits
- implement read/update for horizons
- add JSON mode

Deliverables:
- `gtdspace` CLI binary
- CLI help docs

### Phase 4: MCP MVP

Goal:
- expose the same contract to agent hosts

Tasks:
- create stdio MCP server
- expose workspace/item/search/relationship/review tools
- add tool schemas
- add smoke tests for MCP startup and tool calls

Deliverables:
- `gtdspace-mcp` server binary
- MCP integration docs

### Phase 5: Horizon Completion

Goal:
- finish full structured support across all GTD entities

Tasks:
- full CRUD for areas/goals/vision/purpose
- derived overview/index rebuild flows
- richer review-oriented endpoints
- backlinks and relationship repair tools

Deliverables:
- full typed surface parity across GTD entities

### Phase 6: Bundled Skill

Goal:
- ship agent guidance that matches the real interface

Tasks:
- write bundled skill
- include examples and safety guidance
- test skill against common GTDspace flows

Deliverables:
- shipped skill folder
- example prompts

### Phase 7: App Integration Cleanup

Goal:
- make the desktop app consume the same shared contract where appropriate

Tasks:
- route Tauri commands through the shared service layer
- reduce logic drift between frontend TypeScript and backend Rust
- clean up known mismatches in validation, search, and watcher behavior

Deliverables:
- fewer duplicated GTD rules
- reduced drift risk

## MVP Recommendation

To get to a useful first release quickly, the MVP should include:

- shared service layer
- pure read operations
- recursive workspace index
- validation and dry-run
- full project/action/habit support
- read/list/create/update support for horizons
- backlinks and search
- CLI with JSON mode
- MCP stdio server
- bundled skill

The MVP does not need to solve every runtime subscription problem immediately. Event streaming can be a follow-up once the contract itself is stable.

## Testing Strategy

### Contract Tests

- parse canonical docs into typed objects
- write typed objects back to canonical markdown
- round-trip existing seeded content
- validate legacy marker migration behavior

### Safety Tests

- reads do not mutate files
- dry-run does not mutate files
- invalid enum values fail clearly
- malformed references are surfaced with warnings

### Integration Tests

- CLI JSON snapshots
- MCP smoke tests
- end-to-end create/update/rename/delete flows
- backlink rebuild flows

## Known Risks

- logic drift between Rust and TypeScript if the shared layer is not adopted broadly
- agents overusing raw file writes if the typed tools are incomplete
- relationship repair becoming inconsistent if derived updates are optional but unclear
- watcher and event behavior causing confusion if external automation is assumed to be real-time before that exists

## Success Criteria

This effort is successful when:

- an external agent can inspect a workspace without mutating it
- an external agent can safely create and update GTD entities without breaking the current app
- MCP, CLI, and bundled skill all describe the same rules
- the GTD spec is enforced by one implementation path rather than scattered duplicated logic
- common agent workflows such as capture, review, linking, and cleanup are reliable enough to trust

## Recommended Next Step

Start with Phase 0 and Phase 1 together:

- freeze the public agent contract
- extract the shared Rust GTD service layer

That gives every later piece, including MCP, CLI, bundled skill, and desktop cleanup, a single foundation to build on.
