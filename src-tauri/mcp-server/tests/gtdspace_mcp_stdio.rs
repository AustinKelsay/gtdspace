use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;

use gtdspace_lib::backend::{
    ChangeApplyResult, ChangeSetSummary, ContextPack, GoogleCalendarMcpEnvelope,
    GtdItemSummary, HabitHistoryResult, PlannedChange, WorkspaceInfo, WorkspaceListItemsResult,
    WorkspaceRefreshResult, WorkspaceSearchResult, GOOGLE_CALENDAR_EVENTS_RESOURCE_URI,
    gtdspace_server_version, normalize_workspace_path,
};
use gtdspace_lib::test_utils::{seed_test_workspace, write_test_file};
use rmcp::{
    model::{CallToolRequestParams, ReadResourceRequestParams, ResourceContents},
    transport::{ConfigureCommandExt, TokioChildProcess},
    ServiceExt,
};
use serde::de::DeserializeOwned;
use serde_json::{json, Map, Value};

fn mcp_settings_dir(root: &Path) -> PathBuf {
    if cfg!(target_os = "macos") {
        root.join("Library/Application Support/com.gtdspace.app")
    } else if cfg!(target_os = "windows") {
        root.join("AppData/Roaming/com.gtdspace.app")
    } else {
        root.join(".config/com.gtdspace.app")
    }
}

fn mcp_app_data_dir(root: &Path) -> PathBuf {
    if cfg!(target_os = "macos") {
        root.join("Library/Application Support/com.gtdspace.app")
    } else if cfg!(target_os = "windows") {
        root.join("AppData/Roaming/com.gtdspace.app")
    } else {
        root.join(".local/share/com.gtdspace.app")
    }
}

fn write_saved_mcp_settings(home_root: &Path, settings: Value) -> Result<(), Box<dyn Error>> {
    let settings_dir = mcp_settings_dir(home_root);
    fs::create_dir_all(&settings_dir)?;
    fs::write(
        settings_dir.join("settings.json"),
        serde_json::to_vec_pretty(&json!({ "user_settings": settings }))?,
    )?;
    Ok(())
}

fn write_google_calendar_cache(home_root: &Path, cache: Value) -> Result<(), Box<dyn Error>> {
    let app_data_dir = mcp_app_data_dir(home_root);
    fs::create_dir_all(&app_data_dir)?;
    fs::write(
        app_data_dir.join("google_calendar_cache.json"),
        serde_json::to_vec_pretty(&cache)?,
    )?;
    Ok(())
}

async fn start_client(
    workspace: &Path,
) -> Result<rmcp::service::RunningService<rmcp::RoleClient, ()>, Box<dyn Error>> {
    let transport = TokioChildProcess::new(
        tokio::process::Command::new(env!("CARGO_BIN_EXE_gtdspace-mcp")).configure(|cmd| {
            cmd.arg("--workspace")
                .arg(workspace)
                .arg("--log-level")
                .arg("warn");
        }),
    )?;

    Ok(().serve(transport).await?)
}

async fn start_client_with_app_data_root(
    workspace: &Path,
    home_root: &Path,
) -> Result<rmcp::service::RunningService<rmcp::RoleClient, ()>, Box<dyn Error>> {
    let mut command = tokio::process::Command::new(env!("CARGO_BIN_EXE_gtdspace-mcp"));
    command
        .arg("--workspace")
        .arg(workspace)
        .arg("--log-level")
        .arg("warn")
        .env("HOME", home_root);

    if cfg!(target_os = "windows") {
        command
            .env("APPDATA", home_root.join("AppData/Roaming"))
            .env("USERPROFILE", home_root);
    } else if cfg!(target_os = "linux") {
        command
            .env("XDG_DATA_HOME", home_root.join(".local/share"))
            .env("XDG_CONFIG_HOME", home_root.join(".config"));
    }

    let transport = TokioChildProcess::new(command.configure(|_cmd| {}))?;
    Ok(().serve(transport).await?)
}

async fn start_client_from_saved_defaults(
    home_root: &Path,
) -> Result<rmcp::service::RunningService<rmcp::RoleClient, ()>, Box<dyn Error>> {
    let mut command = tokio::process::Command::new(env!("CARGO_BIN_EXE_gtdspace-mcp"));
    command.env("HOME", home_root);

    if cfg!(target_os = "windows") {
        command
            .env("APPDATA", home_root.join("AppData/Roaming"))
            .env("USERPROFILE", home_root);
    } else if cfg!(target_os = "linux") {
        command.env("XDG_CONFIG_HOME", home_root.join(".config"));
    }

    let transport = TokioChildProcess::new(command.configure(|_cmd| {}))?;
    Ok(().serve(transport).await?)
}

async fn call_tool_typed<T: DeserializeOwned>(
    client: &rmcp::service::RunningService<rmcp::RoleClient, ()>,
    name: &str,
    arguments: Option<Map<String, Value>>,
) -> Result<T, Box<dyn Error>> {
    let params = match arguments {
        Some(arguments) => CallToolRequestParams::new(name.to_string()).with_arguments(arguments),
        None => CallToolRequestParams::new(name.to_string()),
    };
    let result = client.call_tool(params).await?;
    Ok(result.into_typed()?)
}

fn read_first_text_resource(
    result: rmcp::model::ReadResourceResult,
) -> Result<String, Box<dyn Error>> {
    let Some(content) = result.contents.into_iter().next() else {
        return Err("resource read returned no content".into());
    };
    match content {
        ResourceContents::TextResourceContents { text, .. } => Ok(text),
        _ => Err("resource read returned non-text content".into()),
    }
}

fn write_habit_fixture(workspace_root: &Path) -> Result<(), Box<dyn Error>> {
    write_test_file(
        workspace_root.join("Habits/Morning Run.md"),
        r#"# Morning Run

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:daily]

## Created
[!datetime:created_date_time:2026-03-20T10:00:00Z]

## History
*Track your habit completions below:*

| Date | Time | Status | Action | Details |
|------|------|--------|--------|---------|
| 2026-03-21 | 7:30 AM | Complete | Manual | Ran 3 miles |
"#,
    )
    .map_err(|error| -> Box<dyn Error> { error.into() })
}

fn write_project_fixture(
    workspace_root: &Path,
    name: &str,
    desired_outcome: &str,
) -> Result<(), Box<dyn Error>> {
    write_test_file(
        workspace_root.join("Projects").join(name).join("README.md"),
        &format!(
            r#"# {name}

[!singleselect:project-status:in-progress]
[!datetime:created_date_time:2026-03-20T10:00:00Z]

## Desired Outcome

{desired_outcome}
"#
        ),
    )
    .map_err(|error| -> Box<dyn Error> { error.into() })
}

#[tokio::test]
async fn mcp_server_exposes_resources_and_applies_project_change() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let workspace_root = workspace.path().to_path_buf();
    let canonical_workspace_root = fs::canonicalize(&workspace_root)?;

    let client = start_client(&workspace_root).await?;

    let resources = client.list_all_resources().await?;
    assert!(resources
        .iter()
        .any(|resource| resource.uri == "gtdspace://workspace/context.json"));
    assert!(resources
        .iter()
        .any(|resource| resource.uri == "gtdspace://spec/gtd-spec"));
    assert!(resources
        .iter()
        .any(|resource| resource.uri == GOOGLE_CALENDAR_EVENTS_RESOURCE_URI));
    assert!(!resources
        .iter()
        .any(|resource| resource.uri.starts_with("gtdspace://item/")));

    let tools = client.list_all_tools().await?;
    assert!(tools.iter().any(|tool| tool.name == "workspace_info"));
    assert!(tools.iter().any(|tool| tool.name == "project_create"));
    assert!(tools.iter().any(|tool| tool.name == "change_apply"));
    assert!(tools
        .iter()
        .any(|tool| tool.name == "google_calendar_list_events"));

    let context_json = client
        .read_resource(ReadResourceRequestParams::new(
            "gtdspace://workspace/context.json",
        ))
        .await?;
    let context_pack: ContextPack = serde_json::from_str(&read_first_text_resource(context_json)?)?;
    assert_eq!(
        context_pack.workspace_root,
        normalize_workspace_path(&canonical_workspace_root)
    );
    assert_eq!(context_pack.server_version, gtdspace_server_version());
    assert!(context_pack
        .items
        .iter()
        .any(|item| item.relative_path == "Projects/Alpha Project/README.md"));
    assert!(context_pack
        .items
        .iter()
        .all(|item| item.absolute_path.is_empty()));

    let info: WorkspaceInfo = call_tool_typed(&client, "workspace_info", None).await?;
    assert_eq!(info.server_version, gtdspace_server_version());
    assert_eq!(info.context_pack_cache.source, "generated");
    assert_eq!(info.fingerprint.markdown_file_count, 2);

    let matches: WorkspaceSearchResult = call_tool_typed(
        &client,
        "workspace_search",
        Some(
            json!({
                "query": "Alpha",
                "maxResults": 5
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert!(!matches.matches.is_empty());
    assert!(matches
        .matches
        .iter()
        .all(|entry| !entry.file_path.starts_with(&normalize_workspace_path(&canonical_workspace_root))));

    let first_page: WorkspaceListItemsResult = call_tool_typed(
        &client,
        "workspace_list_items",
        Some(
            json!({
                "limit": 1
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert_eq!(first_page.items.len(), 1);
    assert_eq!(first_page.next_cursor.as_deref(), Some("1"));

    let second_page: WorkspaceListItemsResult = call_tool_typed(
        &client,
        "workspace_list_items",
        Some(
            json!({
                "limit": 1,
                "cursor": first_page.next_cursor
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert_eq!(second_page.items.len(), 1);
    assert_eq!(second_page.next_cursor, None);

    let beta_readme = workspace_root.join("Projects/Beta Project/README.md");
    assert!(!beta_readme.exists());

    let planned: PlannedChange = call_tool_typed(
        &client,
        "project_create",
        Some(
            json!({
                "name": "Beta Project",
                "description": "Ship the beta release.",
                "status": "in-progress",
                "areas": [],
                "goals": ["Goals/Fitness.md"],
                "vision": [],
                "purpose": [],
                "generalReferences": []
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;

    let applied: ChangeApplyResult = call_tool_typed(
        &client,
        "change_apply",
        Some(
            json!({
                "changeSetId": planned.change_set.id
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert!(beta_readme.exists());
    assert_eq!(
        applied.workspace_info.context_pack_cache.source,
        "generated"
    );

    let beta_item: GtdItemSummary = call_tool_typed(
        &client,
        "workspace_get_item",
        Some(
            json!({
                "path": "Projects/Beta Project/README.md"
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert_eq!(beta_item.title, "Beta Project");

    client.cancel().await?;

    let cached_client = start_client(&workspace_root).await?;
    let cached_info: WorkspaceInfo =
        call_tool_typed(&cached_client, "workspace_info", None).await?;
    assert_eq!(cached_info.context_pack_cache.source, "cache");

    let refreshed: WorkspaceRefreshResult =
        call_tool_typed(&cached_client, "workspace_refresh", None).await?;
    assert_eq!(
        refreshed.workspace_info.context_pack_cache.source,
        "generated"
    );
    assert_eq!(refreshed.invalidated_change_sets, 0);
    cached_client.cancel().await?;

    write_test_file(
        workspace_root.join("Cabinet/External Note.md"),
        "# External Note\n\nCreated outside MCP.\n",
    )
    .map_err(|error| -> Box<dyn Error> { error.into() })?;

    let regenerated_client = start_client(&workspace_root).await?;
    let regenerated_info: WorkspaceInfo =
        call_tool_typed(&regenerated_client, "workspace_info", None).await?;
    assert_eq!(regenerated_info.context_pack_cache.source, "generated");
    regenerated_client.cancel().await?;

    Ok(())
}

#[tokio::test]
async fn mcp_server_returns_empty_google_calendar_resource_without_cache() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let fake_home = tempfile::tempdir()?;

    let client = start_client_with_app_data_root(workspace.path(), fake_home.path()).await?;

    let calendar_json = client
        .read_resource(ReadResourceRequestParams::new(
            GOOGLE_CALENDAR_EVENTS_RESOURCE_URI,
        ))
        .await?;
    let envelope: GoogleCalendarMcpEnvelope =
        serde_json::from_str(&read_first_text_resource(calendar_json)?)?;

    assert_eq!(envelope.source, "cache");
    assert!(!envelope.cache_available);
    assert_eq!(envelope.cache_event_count, 0);
    assert_eq!(envelope.returned_count, 0);
    assert!(envelope.events.is_empty());

    client.cancel().await?;
    Ok(())
}

#[tokio::test]
async fn mcp_server_reads_and_filters_google_calendar_cache() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let fake_home = tempfile::tempdir()?;

    write_google_calendar_cache(
        fake_home.path(),
        json!({
            "events": [
                {
                    "id": "evt-1",
                    "summary": "Team sync",
                    "description": "Alice reviews priorities",
                    "start": "2026-03-29T09:00:00-05:00",
                    "end": "2026-03-29T09:30:00-05:00",
                    "location": "HQ",
                    "attendees": ["alice@example.com"],
                    "meeting_link": "https://meet.example.com/sync",
                    "status": "confirmed",
                    "color_id": "1"
                },
                {
                    "id": "evt-2",
                    "summary": "Company offsite",
                    "description": "All hands",
                    "start": "2026-03-30",
                    "end": "2026-03-31",
                    "location": "Austin",
                    "attendees": ["team@example.com"],
                    "meeting_link": null,
                    "status": "confirmed",
                    "color_id": "2"
                },
                {
                    "id": "evt-3",
                    "summary": "Retro",
                    "description": "Cancelled meeting",
                    "start": "2026-03-31T16:00:00-05:00",
                    "end": "2026-03-31T17:00:00-05:00",
                    "location": "Remote",
                    "attendees": ["bob@example.com"],
                    "meeting_link": "https://meet.example.com/retro",
                    "status": "cancelled",
                    "color_id": "3"
                }
            ],
            "last_updated": "2026-03-29T18:00:00Z"
        }),
    )?;

    let client = start_client_with_app_data_root(workspace.path(), fake_home.path()).await?;

    let calendar_json = client
        .read_resource(ReadResourceRequestParams::new(
            GOOGLE_CALENDAR_EVENTS_RESOURCE_URI,
        ))
        .await?;
    let envelope: GoogleCalendarMcpEnvelope =
        serde_json::from_str(&read_first_text_resource(calendar_json)?)?;
    assert!(envelope.cache_available);
    assert_eq!(envelope.cache_event_count, 3);
    assert_eq!(envelope.returned_count, 3);
    assert_eq!(envelope.events[0].meeting_link.as_deref(), Some("https://meet.example.com/sync"));

    let filtered: GoogleCalendarMcpEnvelope = call_tool_typed(
        &client,
        "google_calendar_list_events",
        Some(
            json!({
                "query": "alice",
                "includeCancelled": false,
                "maxResults": 5
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert_eq!(filtered.matched_count, 1);
    assert_eq!(filtered.events[0].id, "evt-1");
    assert_eq!(filtered.next_cursor, None);

    let excluded_cancelled: GoogleCalendarMcpEnvelope = call_tool_typed(
        &client,
        "google_calendar_list_events",
        Some(
            json!({
                "query": "retro",
                "includeCancelled": false,
                "maxResults": 5
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert_eq!(excluded_cancelled.matched_count, 0);
    assert!(excluded_cancelled.events.is_empty());

    let included_cancelled: GoogleCalendarMcpEnvelope = call_tool_typed(
        &client,
        "google_calendar_list_events",
        Some(
            json!({
                "query": "retro",
                "includeCancelled": true,
                "maxResults": 5
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert_eq!(included_cancelled.matched_count, 1);
    assert_eq!(included_cancelled.events[0].id, "evt-3");

    let day_filtered: GoogleCalendarMcpEnvelope = call_tool_typed(
        &client,
        "google_calendar_list_events",
        Some(
            json!({
                "timeMin": "2026-03-30",
                "timeMax": "2026-03-30"
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert_eq!(day_filtered.matched_count, 1);
    assert_eq!(day_filtered.events[0].id, "evt-2");

    let paged: GoogleCalendarMcpEnvelope = call_tool_typed(
        &client,
        "google_calendar_list_events",
        Some(
            json!({
                "includeCancelled": true,
                "limit": 2
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert_eq!(paged.returned_count, 2);
    assert_eq!(paged.next_cursor.as_deref(), Some("2"));

    let paged_follow_up: GoogleCalendarMcpEnvelope = call_tool_typed(
        &client,
        "google_calendar_list_events",
        Some(
            json!({
                "includeCancelled": true,
                "limit": 2,
                "cursor": paged.next_cursor
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert_eq!(paged_follow_up.returned_count, 1);
    assert_eq!(paged_follow_up.next_cursor, None);

    client.cancel().await?;
    Ok(())
}

#[tokio::test]
async fn mcp_server_errors_for_malformed_google_calendar_cache() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let fake_home = tempfile::tempdir()?;
    let app_data_dir = mcp_app_data_dir(fake_home.path());
    fs::create_dir_all(&app_data_dir)?;
    fs::write(app_data_dir.join("google_calendar_cache.json"), "{bad json")?;

    let client = start_client_with_app_data_root(workspace.path(), fake_home.path()).await?;

    let error = client
        .read_resource(ReadResourceRequestParams::new(
            GOOGLE_CALENDAR_EVENTS_RESOURCE_URI,
        ))
        .await
        .unwrap_err()
        .to_string();
    assert!(error.contains("Failed to parse Google Calendar cache"));

    client.cancel().await?;
    Ok(())
}

#[tokio::test]
async fn mcp_server_fails_fast_for_invalid_workspace() -> Result<(), Box<dyn Error>> {
    let invalid = tempfile::tempdir()?;
    let status = tokio::process::Command::new(env!("CARGO_BIN_EXE_gtdspace-mcp"))
        .arg("--workspace")
        .arg(invalid.path())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .status()
        .await?;

    assert!(!status.success());
    Ok(())
}

#[tokio::test]
async fn mcp_server_uses_saved_defaults_when_flags_are_omitted() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let workspace_root = workspace.path().to_path_buf();
    let canonical_workspace_root = fs::canonicalize(&workspace_root)?;
    let fake_home = tempfile::tempdir()?;

    write_saved_mcp_settings(
        fake_home.path(),
        json!({
            "mcp_server_workspace_path": workspace_root,
            "mcp_server_read_only": true,
            "mcp_server_log_level": "debug"
        }),
    )?;

    let client = start_client_from_saved_defaults(fake_home.path()).await?;

    let info: WorkspaceInfo = call_tool_typed(&client, "workspace_info", None).await?;
    assert_eq!(info.workspace_root, normalize_workspace_path(&canonical_workspace_root));
    assert!(info.read_only);

    let error = call_tool_typed::<PlannedChange>(
        &client,
        "project_create",
        Some(
            json!({
                "name": "Gamma Project",
                "description": "Should stay read only.",
                "status": "in-progress",
                "areas": [],
                "goals": [],
                "vision": [],
                "purpose": [],
                "generalReferences": []
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await
    .unwrap_err()
    .to_string();

    assert!(error.contains("read-only mode"));
    client.cancel().await?;

    Ok(())
}

#[tokio::test]
async fn mcp_server_reads_and_writes_habit_history() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let workspace_root = workspace.path().to_path_buf();
    write_habit_fixture(&workspace_root)?;

    let client = start_client(&workspace_root).await?;

    let tools = client.list_all_tools().await?;
    assert!(tools.iter().any(|tool| tool.name == "habit_get_history"));
    assert!(tools
        .iter()
        .any(|tool| tool.name == "habit_write_history_entry"));

    let history: HabitHistoryResult = call_tool_typed(
        &client,
        "habit_get_history",
        Some(
            json!({
                "path": "Habits/Morning Run.md"
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert_eq!(history.title, "Morning Run");
    assert_eq!(history.rows.len(), 1);
    assert_eq!(history.rows[0].action, "Manual");
    assert_eq!(history.rows[0].details, "Ran 3 miles");

    let planned: PlannedChange = call_tool_typed(
        &client,
        "habit_write_history_entry",
        Some(
            json!({
                "path": "Habits/Morning Run.md",
                "status": "completed",
                "action": "Backfill",
                "details": "Imported from journal",
                "date": "2026-03-22",
                "time": "8:15 PM",
                "updateCurrentStatus": true
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;

    let _: ChangeApplyResult = call_tool_typed(
        &client,
        "change_apply",
        Some(
            json!({
                "changeSetId": planned.change_set.id
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;

    let updated = fs::read_to_string(workspace_root.join("Habits/Morning Run.md"))?;
    assert!(updated.contains("[!checkbox:habit-status:true]"));
    assert!(updated.contains("| 2026-03-22 | 8:15 PM | Complete | Backfill | Imported from journal |"));

    client.cancel().await?;
    Ok(())
}

#[tokio::test]
async fn mcp_server_rejects_action_create_for_unknown_project_path() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let workspace_root = workspace.path().to_path_buf();
    write_project_fixture(&workspace_root, "Visibible", "Ship nav search and image flows.")?;

    let client = start_client(&workspace_root).await?;

    let error = call_tool_typed::<PlannedChange>(
        &client,
        "action_create",
        Some(
            json!({
                "projectPath": "projects/visible",
                "name": "Add search function in nav",
                "status": "waiting"
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await
    .unwrap_err()
    .to_string();

    assert!(error.contains("Project not found: projects/visible"));
    assert!(error.contains("workspace_list_items({\"itemType\":\"project\"})"));
    assert!(error.contains("Projects/Visibible/README.md"));
    client.cancel().await?;
    Ok(())
}

#[tokio::test]
async fn mcp_server_only_writes_action_after_change_apply() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let workspace_root = workspace.path().to_path_buf();
    let action_path = workspace_root.join("Projects/Alpha Project/Add search function in nav.md");

    let client = start_client(&workspace_root).await?;

    let planned: PlannedChange = call_tool_typed(
        &client,
        "action_create",
        Some(
            json!({
                "projectPath": "Projects/Alpha Project/README.md",
                "name": "Add search function in nav",
                "status": "waiting"
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;

    assert!(!action_path.exists());

    let _: ChangeApplyResult = call_tool_typed(
        &client,
        "change_apply",
        Some(
            json!({
                "changeSetId": planned.change_set.id
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;

    assert!(action_path.exists());
    client.cancel().await?;
    Ok(())
}

#[tokio::test]
async fn mcp_server_replays_applied_change_set_without_rewriting_files() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let workspace_root = workspace.path().to_path_buf();
    let action_path = workspace_root.join("Projects/Alpha Project/Add search function in nav.md");

    let client = start_client(&workspace_root).await?;

    let planned: PlannedChange = call_tool_typed(
        &client,
        "action_create",
        Some(
            json!({
                "projectPath": "Projects/Alpha Project/README.md",
                "name": "Add search function in nav",
                "status": "waiting"
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;

    let first: ChangeApplyResult = call_tool_typed(
        &client,
        "change_apply",
        Some(
            json!({
                "changeSetId": planned.change_set.id.clone()
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert!(!first.replayed);

    let original = fs::read_to_string(&action_path)?;
    fs::write(&action_path, format!("{original}\nManual edit after apply.\n"))?;

    let replay: ChangeApplyResult = call_tool_typed(
        &client,
        "change_apply",
        Some(
            json!({
                "changeSetId": planned.change_set.id
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert!(replay.replayed);
    assert_eq!(replay.change_set.id, first.change_set.id);

    let after_replay = fs::read_to_string(&action_path)?;
    assert!(after_replay.contains("Manual edit after apply."));

    client.cancel().await?;
    Ok(())
}

#[tokio::test]
async fn mcp_server_reports_refresh_invalidation_for_pending_change_sets() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let workspace_root = workspace.path().to_path_buf();

    let client = start_client(&workspace_root).await?;

    let planned: PlannedChange = call_tool_typed(
        &client,
        "action_create",
        Some(
            json!({
                "projectPath": "Projects/Alpha Project/README.md",
                "name": "Add search function in nav",
                "status": "waiting"
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;

    let refreshed: WorkspaceRefreshResult =
        call_tool_typed(&client, "workspace_refresh", None).await?;
    assert_eq!(refreshed.invalidated_change_sets, 1);

    let error = call_tool_typed::<ChangeApplyResult>(
        &client,
        "change_apply",
        Some(
            json!({
                "changeSetId": planned.change_set.id
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await
    .unwrap_err()
    .to_string();
    assert!(error.contains("workspace_refresh"));
    assert!(!error.contains("Unknown change set"));

    client.cancel().await?;
    Ok(())
}

#[tokio::test]
async fn mcp_server_reports_discarded_change_sets_on_apply() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let workspace_root = workspace.path().to_path_buf();

    let client = start_client(&workspace_root).await?;

    let planned: PlannedChange = call_tool_typed(
        &client,
        "action_create",
        Some(
            json!({
                "projectPath": "Projects/Alpha Project/README.md",
                "name": "Add search function in nav",
                "status": "waiting"
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;

    let discarded: ChangeSetSummary = call_tool_typed(
        &client,
        "change_discard",
        Some(
            json!({
                "changeSetId": planned.change_set.id.clone()
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;
    assert_eq!(discarded.id, planned.change_set.id);

    let error = call_tool_typed::<ChangeApplyResult>(
        &client,
        "change_apply",
        Some(
            json!({
                "changeSetId": planned.change_set.id
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await
    .unwrap_err()
    .to_string();
    assert!(error.contains("discarded"));
    assert!(!error.contains("Unknown change set"));

    client.cancel().await?;
    Ok(())
}

#[tokio::test]
async fn mcp_server_reports_stale_plan_errors_without_falling_back_to_unknown() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let workspace_root = workspace.path().to_path_buf();
    let project_readme = workspace_root.join("Projects/Alpha Project/README.md");

    let client = start_client(&workspace_root).await?;

    let planned: PlannedChange = call_tool_typed(
        &client,
        "project_update",
        Some(
            json!({
                "path": "Projects/Alpha Project/README.md",
                "title": "Alpha Project Updated",
                "description": null,
                "dueDate": null,
                "status": null,
                "areas": [],
                "goals": [],
                "vision": [],
                "purpose": [],
                "generalReferences": []
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;

    let existing = fs::read_to_string(&project_readme)?;
    fs::write(&project_readme, format!("{existing}\nConcurrent edit.\n"))?;

    let _: WorkspaceInfo = call_tool_typed(&client, "workspace_info", None).await?;

    let first_error = call_tool_typed::<ChangeApplyResult>(
        &client,
        "change_apply",
        Some(
            json!({
                "changeSetId": planned.change_set.id.clone()
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await
    .unwrap_err()
    .to_string();
    assert!(first_error.contains("changed since planning"));
    assert!(first_error.contains("Create a fresh plan"));

    let retry_error = call_tool_typed::<ChangeApplyResult>(
        &client,
        "change_apply",
        Some(
            json!({
                "changeSetId": planned.change_set.id
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await
    .unwrap_err()
    .to_string();
    assert!(retry_error.contains("changed since planning"));
    assert!(!retry_error.contains("Unknown change set"));

    client.cancel().await?;
    Ok(())
}

#[tokio::test]
async fn mcp_server_replaces_habit_history_with_canonical_table() -> Result<(), Box<dyn Error>> {
    let workspace = seed_test_workspace().map_err(|error| -> Box<dyn Error> { error.into() })?;
    let workspace_root = workspace.path().to_path_buf();
    write_habit_fixture(&workspace_root)?;

    let client = start_client(&workspace_root).await?;

    let planned: PlannedChange = call_tool_typed(
        &client,
        "habit_replace_history",
        Some(
            json!({
                "path": "Habits/Morning Run.md",
                "rows": [
                    {
                        "date": "2026-03-23",
                        "time": "7:45 AM",
                        "status": "completed",
                        "action": "Manual",
                        "details": "Ran before work"
                    },
                    {
                        "date": "2026-03-24",
                        "time": "8:30 PM",
                        "status": "todo",
                        "action": "Backfill",
                        "details": "Missed the run"
                    }
                ],
                "updateCurrentStatusFromLatest": true
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;

    let _: ChangeApplyResult = call_tool_typed(
        &client,
        "change_apply",
        Some(
            json!({
                "changeSetId": planned.change_set.id
            })
            .as_object()
            .unwrap()
            .clone(),
        ),
    )
    .await?;

    let updated = fs::read_to_string(workspace_root.join("Habits/Morning Run.md"))?;
    assert!(updated.contains("[!checkbox:habit-status:false]"));
    assert!(updated.contains("| 2026-03-23 | 7:45 AM | Complete | Manual | Ran before work |"));
    assert!(updated.contains("| 2026-03-24 | 8:30 PM | To Do | Backfill | Missed the run |"));

    client.cancel().await?;
    Ok(())
}
