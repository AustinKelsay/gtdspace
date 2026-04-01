# MCP Server

This document describes the standalone GTD Space MCP server package under `src-tauri/mcp-server/`.

The server is a separate stdio process intended for any MCP-capable local-model client. It is not tied to the desktop UI process, but it reuses the same GTD-aware backend rules through `src-tauri/src/backend/mcp_workspace.rs`.

## Run Locally

Use the npm helper from the repository root:

```bash
npm run mcp:dev -- --workspace "/absolute/path/to/GTD Space"
```

You can also run the Rust binary directly:

```bash
cargo run --manifest-path src-tauri/mcp-server/Cargo.toml -- --workspace "/absolute/path/to/GTD Space"
```

Supported CLI flags:

- `--workspace <path>`: bind the MCP server to a single GTD workspace for the life of the process
- `--read-only`: disable all mutation tools (`--read-only=false` forces read-write)
- `--log-level <level>`: set logging for local debugging

If `--workspace` is omitted, the server resolves the workspace from saved GTD Space settings in this order:

- `mcp_server_workspace_path` from Settings > MCP Server
- `last_folder`
- `default_space_path`
- the platform default GTD Space path

If `--read-only` or `--log-level` are omitted, the server also falls back to the defaults saved on the Settings > MCP Server page.

## Resources

The server exposes these MCP resources:

- `gtdspace://spec/gtd-spec`
- `gtdspace://spec/markdown-schema`
- `gtdspace://spec/architecture`
- `gtdspace://workspace/context.json`
- `gtdspace://workspace/context.md`
- `gtdspace://integrations/google-calendar/events.json`

## Tools

Read/query tools:

- `workspace_info`
- `workspace_refresh`
- `workspace_list_items`
- `workspace_search`
- `workspace_get_item`
- `workspace_get_relationships`
- `workspace_read_markdown`
- `habit_get_history`
- `google_calendar_list_events`

`workspace_info` now includes `serverVersion` so clients can confirm which GTD Space backend build they are connected to. The generated workspace context resource also includes the same `serverVersion` field.

Path notes for MCP responses:

- Workspace item, relationship, search, and change-set paths are workspace-relative.
- Absolute filesystem paths are kept internal to the server and are not part of the MCP response surface.

Pagination notes:

- `workspace_list_items` accepts optional `cursor` and `limit` inputs and returns `nextCursor` when more items are available.
- `workspace_search` accepts optional `cursor`, `limit`, and legacy `maxResults` inputs and returns `nextCursor` when more matches are available.
- `google_calendar_list_events` accepts optional `cursor`, `limit`, and legacy `maxResults` inputs and returns `nextCursor` when more cached events are available.

Google Calendar access is cache-only in MCP v1. The desktop app remains responsible for OAuth and sync. The MCP server reads the persisted `google_calendar_cache.json` file from the app-data directory on demand and never calls the Google API directly.

Google Calendar cache semantics:

- If no cache file exists, the resource and tool return a successful empty payload with `cacheAvailable: false`.
- If the cache file is malformed or partially written, the resource/tool call fails with a parse error instead of silently dropping events.
- The resource returns the full cached event list.
- The tool supports optional filtering by `timeMin`, `timeMax`, `query`, `includeCancelled`, `cursor`, `limit`, and legacy `maxResults`. Cancelled events are excluded by default unless `includeCancelled` is set to `true`.
- Google Calendar events are intentionally excluded from `workspace/context.json`, `workspace/context.md`, workspace fingerprinting, and `workspace_refresh` invalidation rules.

Mutation planning tools:

- `project_create`, `project_update`, `project_rename`
- `action_create`, `action_update`, `action_rename`
- `habit_create`, `habit_update_status`, `habit_write_history_entry`, `habit_replace_history`
- `horizon_page_create`, `horizon_page_update`
- `reference_note_create`, `reference_note_update`

Update request semantics:

- For list-valued update fields such as `areas`, `goals`, `vision`, `purpose`, `contexts`, and `generalReferences`, omitting the field preserves the current values.
- Sending an empty array for one of those fields explicitly clears that section in the rewritten markdown.

Path notes:

- `action_create.projectPath` must point to an existing GTD project directory such as `Projects/Alpha Project` or the project README such as `Projects/Alpha Project/README.md`.
- The server rejects unknown project paths instead of creating new folders implicitly.

Change-set lifecycle tools:

- `change_apply`
- `change_discard`

## Dry-Run And Apply Contract

All write tools are dry-run by default.

Each mutating tool returns a structured `PlannedChange` with:

- a `change_set_id`
- normalized affected paths
- a short human-readable preview
- the semantic operation summary

To commit the change, call `change_apply` with the returned `change_set_id`.

`change_apply` returns a `ChangeApplyResult` that now includes:

- `changeSet`
- `workspaceInfo`
- `replayed`

`replayed` is `false` on the first successful apply. It is `true` only when a client repeats `change_apply` with the same already-applied `change_set_id` in the same MCP server session and the server safely replays the original apply receipt without re-running writes.

Typical action-create flow:

1. Discover a valid project path:

   ```json
   {"itemType":"project"}
   ```

   Call `workspace_list_items` with that payload and copy one of the returned project paths such as `Projects/Alpha Project/README.md`.

2. Plan the action:

   ```json
   {
     "projectPath": "Projects/Alpha Project/README.md",
     "name": "Add search function in nav",
     "status": "waiting"
   }
   ```

   Call `action_create` with that payload. This only returns a planned change set. No file is written yet.

3. Apply the plan:

   ```json
   {"changeSetId":"<returned change_set_id>"}
   ```

   Call `change_apply` with the returned `change_set_id` to actually write the markdown file.

Before writing, `change_apply` revalidates the target files using the expected file hash captured during planning. If anything changed after the plan step, apply fails with a stale-plan error and the client must create a fresh plan.

`change_discard` removes a pending plan without writing anything.

`workspace_refresh` also invalidates all pending change sets.

Normal read and query tools may rebuild cached snapshot/context state, but they do not discard pending change sets.

If an apply step fails after a mutation has already started, the server invalidates its cached snapshot/context and returns an error telling the client to call `workspace_refresh` before continuing. V1 does not implement full multi-step rollback.

## Change-Set Lifecycle

- Change sets are session-scoped to the current `gtdspace-mcp` server process.
- Repeating `change_apply` for an already-applied change set succeeds only within the same server session and returns the original apply receipt with `replayed: true`.
- `workspace_refresh` invalidates all pending change sets. Those plans must be recreated before applying.
- Normal read/query calls do not invalidate pending change sets.
- `change_discard` transitions a pending change set to a terminal discarded state. Discarded plans cannot be applied later.
- If the MCP server restarts, previously planned change-set ids are not preserved and later apply attempts will be treated as unknown.

## Context Pack Caching

The generated GTD context pack is cached outside the workspace in the app cache directory, under a workspace-path-hash key.

The cache includes:

- `manifest.json`
- `gtd-context.json`
- `gtd-context.md`

The cache manifest tracks:

- workspace path hash
- generation timestamp
- generator version
- workspace fingerprint

The v1 fingerprint uses:

- normalized workspace root path
- latest markdown modification timestamp
- markdown file count
- an aggregate digest over relative paths and mtimes

The server regenerates the context pack when:

- no valid cached pack exists
- the generator version changed
- the workspace fingerprint no longer matches
- `workspace_refresh` is called
- an MCP-applied write completes

Otherwise, the cached context pack is reused. `workspace_info` reports the cache paths and whether the active pack came from generation or cache reuse.

## Boundaries

- The server is bound to one workspace per process.
- Raw reads and searches are allowed inside the workspace root.
- Generic raw writes are intentionally not exposed in v1.
- Context-pack cache artifacts are written outside the workspace so the GTD files stay clean.
