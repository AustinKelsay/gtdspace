use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;

use gtdspace_lib::backend::{
    ChangeApplyResult, ContextPack, GtdItemSummary, HabitHistoryResult, PlannedChange,
    WorkspaceInfo, WorkspaceRefreshResult, WorkspaceSearchResult,
    normalize_workspace_path,
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
        root.join("AppData/Roaming/com.gtdspace.app/config")
    } else {
        root.join(".config/com.gtdspace.app")
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

async fn start_client_from_saved_defaults(
    home_root: &Path,
) -> Result<rmcp::service::RunningService<rmcp::RoleClient, ()>, Box<dyn Error>> {
    let mut command = tokio::process::Command::new(env!("CARGO_BIN_EXE_gtdspace-mcp"));
    command.env("HOME", home_root);

    if cfg!(target_os = "windows") {
        command.env("APPDATA", home_root.join("AppData/Roaming"));
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

    let tools = client.list_all_tools().await?;
    assert!(tools.iter().any(|tool| tool.name == "workspace_info"));
    assert!(tools.iter().any(|tool| tool.name == "project_create"));
    assert!(tools.iter().any(|tool| tool.name == "change_apply"));

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
    assert!(context_pack
        .items
        .iter()
        .any(|item| item.relative_path == "Projects/Alpha Project/README.md"));

    let info: WorkspaceInfo = call_tool_typed(&client, "workspace_info", None).await?;
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
