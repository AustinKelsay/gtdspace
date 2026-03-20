# Runtime Behavior Spec

This document describes the runtime behavior the app enforces today. When code and docs disagree, the code and tests are the source of truth.

## Dashboards

The dashboard views are filter-first summaries, not raw file browsers.

- `DashboardProjects` defaults to showing only `in-progress` and `waiting` projects. `completed` and `cancelled` are hidden until the user changes the status filter.
- `DashboardActions` defaults to showing only `in-progress` and `waiting` actions. `completed` and `cancelled` are hidden until the user changes the status filter.
- Both dashboards default to sorting by due date ascending.
- Projects can be filtered by search, status, deadline presence, horizon-link presence, and completion range.
- Actions can be filtered by search, status, effort, project, deadline presence, focus-date presence, and context presence.
- Project search matches project name and description.
- Action search matches action name, project name, and contexts.
- Project completion filtering is always applied as a numeric range.
- Project overdue logic treats a project as overdue only when it has a due date, that date is before today, and the project is not `completed` or `cancelled`.
- Action overdue logic is based on local dates, not UTC timestamps.

The data hooks back these views with canonical status normalization:

- Project statuses normalize to `in-progress`, `waiting`, `completed`, or `cancelled`.
- Action statuses normalize to `in-progress`, `waiting`, `completed`, or `cancelled`.
- `useActionsData` can exclude completed or cancelled actions at load time.
- `useProjectsData` falls back to scanning `Projects/**/README.(md|markdown)` if the backend does not return projects.

## Event Bus

The in-app content event bus is the shared runtime signal layer for content changes.

- Event types are `content:changed`, `content:saved`, `content:metadata-changed`, `file:created`, `file:deleted`, and `file:renamed`.
- `content:changed` is deduplicated per file when the same file emits again within 100ms.
- `content:saved` and `content:metadata-changed` cascade into `content:changed`.
- The bus keeps a defensive metadata cache per file.
- The bus is for synchronization, not a general notification system.

Current notification behavior is mostly toast and DOM-event based:

- File watcher events produce toasts for created, deleted, and modified files.
- Habit updates and habit content refreshes are handled through custom window events.
- Google Calendar sync is announced through local events and stored state, not through a dedicated notification service.

## File Watching

The file watcher is workspace-root oriented.

- `useFileWatcher` starts watching the selected folder path and stores up to 50 recent events.
- The frontend listens to the Tauri `file-changed` event.
- The backend watcher is debounced at 500ms.
- The backend watcher is non-recursive, so it watches only the direct folder passed to it.
- The backend currently emits `file-changed` events with `event_type = "changed"`.

The app-level reaction logic is narrower than the backend event payload:

- `App.tsx` currently switches on `created`, `deleted`, and `modified`.
- A `created` event refreshes the current folder list and shows a created-file toast.
- A `deleted` event closes any open tab for the deleted file, refreshes the folder list, and shows a deleted-file toast.
- A `modified` event shows a reload prompt if the tab is clean.
- A dirty modified tab gets a warning only, with no auto-reload.

There is one important mismatch here:

- The backend emits `changed`, but the app switch handles `created`, `deleted`, and `modified`.
- That means the file-change UX is currently only as accurate as whatever maps the backend event into those app-facing states upstream.

There is also a project-save reload path:

- Saving a markdown file under `Projects/` triggers a project list reload.
- This happens both for save-active and save-all flows.
- `window.onTabFileSaved` is also used to refresh project data after project markdown saves.

## Calendar

The calendar view is a derived index of dated GTD content plus Google Calendar events.

- Projects are included only when their project README has a `due_date` marker.
- Actions are included only when they have a `focus_date`, `focus_date_time`, or `due_date` marker.
- Habits are included when they have a parseable `created_date_time` value, a parseable `## Created` fallback header, or a fallback timestamp from file metadata.
- Google Calendar events are included from the persisted sync cache.
- If `gtdSpace.projects` already contains due-dated projects, those can be added as a backup source.

Calendar parsing rules are conservative:

- The hook only scans the current workspace path.
- Project and action files are detected from the `Projects/` tree.
- Habit files are detected from the `Habits/` tree.
- Markdown migrations are applied in memory only during calendar reads.
- Calendar loads never rewrite the file just because old markers were found.

Calendar refreshes are event-driven:

- Metadata changes for relevant GTD fields schedule a reload.
- Content saves for relevant GTD files schedule a reload.
- Structural events such as create, rename, and delete also schedule a reload.
- Relevant metadata keys include focus, due, created, habit, and frequency.

Google Calendar events are surfaced into the calendar as:

- `type: "google-event"`
- `status: "confirmed"`
- `dueDate` set from event end time, or start time if end is missing

## Habits And Automation

Habit status and reset behavior is the only built-in automation loop in the app today.

- The app invokes `check_and_reset_habits` on startup when a GTD space is loaded.
- The app invokes `check_and_reset_habits` again every 60 seconds while a GTD space remains open.
- If resets occur, the app refreshes GTD space state and project state.
- If the currently open tab is a habit, the app reloads that file from disk after a reset.

Manual habit edits are also first-class runtime behavior:

- `update_habit_status` normalizes the new value, updates the markdown marker, and appends a history row.
- The app listens for `habit-status-updated` and `habit-content-changed` DOM events and reloads the active habit tab when they refer to the open file.

Supported habit frequencies today include:

- `5-minute`
- `daily`
- `every-other-day`
- `twice-weekly`
- `weekly`
- `weekdays`
- `biweekly`
- `monthly`

Important note:

- `useHabitScheduler` exists and can emit `habit-reset` and `habits-refreshed`, but it is not wired into the current app runtime.
- The effective automation path today is the backend `check_and_reset_habits` command plus the polling inside `App.tsx`.

## Google Calendar Sync

Google Calendar sync is optional, local-state-backed, and preference-driven.

- Auto-sync is enabled by default unless local storage says otherwise.
- The auto-sync manager runs an initial sync on mount.
- It runs again every 5 minutes when enabled.
- It also runs when the document becomes visible again.
- Interval syncs are skipped while the tab is hidden.
- Sync is skipped while another sync is already in flight.
- Sync is skipped unless the backend reports that Google Calendar is connected and not already syncing.

Persisted sync behavior:

- Synced events are stored in `localStorage` under `google-calendar-events`.
- The last sync timestamp is stored in `localStorage` under `google-calendar-last-sync`.
- Persisting events emits a `google-calendar-synced` window event.
- `useCalendarData` listens for that event and loads the synced events into the calendar view.

This is not a general scheduler:

- If the backend is unavailable, sync degrades into a no-op with warnings.
- Google Calendar sync is not part of GTD space initialization.

## Known Mismatches

These are worth keeping visible because they affect how we should read the runtime:

- `checkGTDSpace()` only verifies `Projects`, `Habits`, `Someday Maybe`, and `Cabinet`, so it does not fully validate the horizon folders.
- The dashboard quick-create flow still seeds some legacy/simple horizon markdown instead of the canonical builders. A current example is Goals, which still start with `[!datetime:target_date:]` there instead of `[!datetime:goal-target-date:]`.
- The backend file watcher emits `changed`, while the app switch currently handles `created`, `deleted`, and `modified`.
- `useHabitScheduler` is present but unused, so its events are not part of current production runtime.
- There is no generic automation engine or notification service beyond habit polling, Google Calendar auto-sync, custom DOM events, and toast notifications.

## Sources

- `src/components/dashboard/DashboardProjects.tsx:83-220`
- `src/components/dashboard/DashboardActions.tsx:85-220`
- `src/hooks/useProjectsData.ts:62-260`
- `src/hooks/useActionsData.ts:61-259`
- `src/utils/content-event-bus.ts:17-198`
- `src/hooks/useFileWatcher.ts:47-209`
- `src-tauri/src/commands/mod.rs:1938-2005`
- `src-tauri/src/commands/mod.rs:2459-2488`
- `src/App.tsx:309-386`
- `src/App.tsx:517-520`
- `src/App.tsx:855-1027`
- `src/hooks/useCalendarData.ts:128-698`
- `src/components/calendar/GoogleCalendarAutoSyncManager.tsx:15-117`
- `src/utils/google-calendar.ts:4-88`
- `src/hooks/useHabitScheduler.ts:15-79`
- `src/hooks/useHabitTracking.ts:15-72`
