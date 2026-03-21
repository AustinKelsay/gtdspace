# Tauri Integration

This document describes the current frontend/backend boundary in GTD Space.

The frontend uses Tauri commands for native file access, settings persistence, GTD workspace management, encrypted git sync, and Google Calendar integration. The backend remains file-based and does not maintain a separate application database for GTD content.

The Rust command layer is now split by domain under `src-tauri/src/commands/`, with `src-tauri/src/commands/mod.rs` acting as a thin facade and `src-tauri/src/lib.rs` registering handlers from their concrete module paths. That keeps the public command names stable while making the backend easier to navigate.

## Command Conventions

The app uses these patterns consistently:

- Frontend calls are made through `safeInvoke(...)` in most user-facing flows
- Rust commands use snake_case names
- Frontend payloads usually use camelCase keys and rely on Tauri’s argument mapping
- Commands return plain values or `Result<..., String>`-style errors

## Current Command Groups

The current command surface falls into these groups:

## Backend Module Layout

- `app.rs`: app health/version/permission helpers
- `dialogs.rs`: folder and explorer integrations
- `filesystem.rs`: file CRUD, listing, existence checks, directory creation, and replace-in-file
- `settings.rs`: persisted settings and OS secure storage
- `watcher.rs`: file watcher lifecycle and emitted payloads
- `search.rs`: search request/response types and `search_files`
- `workspace.rs`: GTD space validation, bootstrap, and seed flows
- `gtd_projects.rs`: project and action creation, listing, and rename flows
- `gtd_habits.rs`: habit creation, updates, and reset logic
- `gtd_relationships.rs`: reverse-link and habit-reference lookup
- `git_commands.rs`: Tauri command wrappers for git sync
- `git_sync.rs`: core encrypted git sync implementation
- `google_calendar_commands.rs`: Tauri command wrappers for Google Calendar and OAuth config

### File And Workspace Commands

- `select_folder`
- `open_folder_in_explorer`
- `open_file_location`
- `list_markdown_files`
- `read_file`
- `save_file`
- `create_file`
- `rename_file`
- `delete_file`
- `delete_folder`
- `copy_file`
- `move_file`
- `search_files`
- `check_directory_exists`
- `create_directory`
- `check_file_exists`

### Settings And Secure Storage

- `load_settings`
- `save_settings`
- `secure_store_set`
- `secure_store_get`
- `secure_store_remove`

### GTD Workspace Commands

- `get_default_gtd_space_path`
- `check_is_gtd_space`
- `initialize_gtd_space`
- `seed_example_gtd_content`
- `initialize_default_gtd_space`
- `create_gtd_project`
- `create_gtd_habit`
- `list_gtd_projects`
- `list_project_actions`
- `rename_gtd_project`
- `rename_gtd_action`

### Habit Commands

- `update_habit_status`
- `check_and_reset_habits`
- `find_habits_referencing`
- `find_reverse_relationships`

### File Watcher Commands

- `start_file_watcher`
- `stop_file_watcher`

### Git Sync Commands

- `git_sync_status`
- `git_sync_push`
- `git_sync_pull`

### Google Calendar Commands

- `google_calendar_connect`
- `google_calendar_disconnect`
- `google_calendar_disconnect_simple`
- `google_calendar_is_authenticated`
- `google_calendar_fetch_events`
- `google_calendar_sync`
- `google_calendar_get_status`
- `google_calendar_get_cached_events`
- `google_calendar_start_auth`
- `google_oauth_store_config`
- `google_oauth_get_config`
- `google_oauth_clear_config`
- `google_oauth_has_config`

## Event Bridge

The backend also participates in the runtime through events:

- file watcher events emitted from Rust
- content save/metadata events coordinated in the frontend
- Google Calendar sync events rebroadcast into the UI layer

The most important current caveat is that the backend watcher emits `changed`, while some frontend switch logic still expects `created`, `deleted`, or `modified`.

## Security And Persistence Notes

- GTD content is stored as markdown files on disk
- Standard settings are persisted through the Tauri store
- Sensitive values such as git sync secrets and Google OAuth config use secure storage-oriented commands
- Tauri capability and CSP settings live in `src-tauri/tauri.conf.json` and `src-tauri/capabilities/`

## When To Read This Doc

Use this doc when you need to answer questions like:

- Which subsystem should own a file operation?
- Is a feature using a Tauri command or pure frontend logic?
- Where should a new native capability be added?
- Which secrets belong in secure storage rather than normal settings?
- Which backend command module should own a new Rust command?

For behavior details, pair this doc with:

- [`architecture.md`](./architecture.md)
- [`settings.md`](./settings.md)
- [`content-events.md`](./content-events.md)
- [`../spec/03-runtime-behavior.md`](../spec/03-runtime-behavior.md)
