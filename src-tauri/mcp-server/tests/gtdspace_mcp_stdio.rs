use std::error::Error;
use std::fs;
use std::path::Path;
use std::process::Stdio;

use gtdspace_lib::backend::{
    ChangeApplyResult, ContextPack, GtdItemSummary, PlannedChange, WorkspaceInfo,
    WorkspaceRefreshResult, WorkspaceSearchResult,
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
