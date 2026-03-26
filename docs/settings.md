# Settings System

This document describes the current settings model used by GTD Space.

Settings are split between normal persisted preferences and sensitive values that belong in secure storage.

## What Settings Control

The current settings surface covers five broad areas:

- Appearance: theme, font family, font size, line height
- Editor behavior: tab size, word wrap, editor mode, keybindings
- Workspace behavior: `last_folder`, `max_tabs`, `restore_tabs`, auto-initialize, seed example content, default workspace path
- MCP server launch defaults: `mcp_server_workspace_path`, `mcp_server_read_only`, `mcp_server_log_level`
- Optional integrations: git sync preferences and related metadata

Google Calendar configuration uses its own command surface and secure storage flow rather than living entirely inside normal settings.

## Where Settings Live

There are two persistence layers:

1. Standard settings stored through `load_settings` and `save_settings`
2. Sensitive values stored through secure-store commands such as `secure_store_set`

Practical split:

- Normal preferences belong in `UserSettings`
- Secrets such as git sync encryption material should not be treated as plain settings-only values

## Frontend Entry Point

`useSettings` is the main frontend abstraction.

Its responsibilities are:

- initialize local defaults
- load persisted settings on startup
- optimistically update local state
- persist changes through the backend
- broadcast `settings-updated` events for immediate UI consumers

## Startup Behavior

At startup, settings influence several important flows:

- theme application
- editor mode selection
- workspace recovery via `last_folder`
- default-space initialization when no valid workspace is saved
- standalone MCP server workspace resolution and launch defaults when callers omit CLI flags
- git sync and settings UI defaults

This means settings are part of application boot, not just a passive preferences screen.

## Current Settings Shape

The canonical frontend type is `UserSettings` in `src/types/index.ts`.

Important fields include:

- `theme`
- `font_size`
- `tab_size`
- `word_wrap`
- `font_family`
- `line_height`
- `keybindings`
- `last_folder`
- `editor_mode`
- `max_tabs`
- `restore_tabs`
- `auto_initialize`
- `seed_example_content`
- `default_space_path`
- `mcp_server_workspace_path`
- `mcp_server_read_only`
- `mcp_server_log_level`
- git sync fields such as `git_sync_enabled`, `git_sync_repo_path`, `git_sync_remote_url`, `git_sync_branch`, and sync timestamps

Git sync behavior now includes a mandatory manual push review step:

- the app saves open tabs before generating the review
- the review compares the current workspace against the latest local encrypted backup
- confirmation is required before `git_sync_push` mutates the backup repo

## UI Structure

The settings UI is organized under `src/components/settings/` and includes:

- appearance settings
- editor settings
- workspace settings
- GTD settings
- git sync settings
- MCP server settings
- Google Calendar settings
- advanced settings
- keyboard shortcut management

The settings docs should reflect this grouped structure, not an old flat preferences modal.

## Validation And Migration

Settings are validated and normalized before use. The relevant logic lives in:

- `src/utils/settings-validation.ts`
- backend settings serialization/deserialization
- `useSettings` optimistic update flow

When documenting settings, assume coercion and fallback behavior may exist even if a UI control only exposes a narrow valid range.

## Tab Restore Behavior

Tab restore is now workspace-scoped:

- the tab runtime persists the open-tab snapshot in localStorage
- restore only runs when `restore_tabs` is enabled
- a saved snapshot is only restored when it matches the current workspace path
- missing or unreadable files are skipped during restore, and restored tabs start clean

## Related Docs

- [`architecture.md`](./architecture.md)
- [`hooks.md`](./hooks.md)
- [`tauri.md`](./tauri.md)
- [`git-sync.md`](./git-sync.md)
