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
- `gtdspace://item/<workspace-relative-path>`

The item resource uses a URL-encoded workspace-relative path, for example:

```text
gtdspace://item/Projects%2FAlpha%20Project%2FREADME.md
```

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

Mutation planning tools:

- `project_create`, `project_update`, `project_rename`
- `action_create`, `action_update`, `action_rename`
- `habit_create`, `habit_update_status`, `habit_write_history_entry`
- `horizon_page_create`, `horizon_page_update`
- `reference_note_create`, `reference_note_update`

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

Before writing, `change_apply` revalidates the target files using the expected file hash captured during planning. If anything changed after the plan step, apply fails and the client must create a fresh plan.

`change_discard` removes a pending plan without writing anything.

`workspace_refresh` also invalidates all pending change sets.

If an apply step fails after a mutation has already started, the server invalidates its cached snapshot/context and returns an error telling the client to call `workspace_refresh` before continuing. V1 does not implement full multi-step rollback.

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
