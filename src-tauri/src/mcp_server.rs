use std::sync::Arc;

use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::AnnotateAble,
    model::{
        ListResourcesResult, PaginatedRequestParams, ReadResourceRequestParams, ReadResourceResult,
        Resource, ResourceContents, ServerInfo,
    },
    service::RequestContext,
    tool, tool_handler, tool_router, Json, ServerHandler, ServiceExt,
};

use crate::backend::mcp_workspace::{
    ActionCreateRequest, ActionRenameRequest, ActionUpdateRequest, ChangeSetRequest,
    GtdWorkspaceService, HabitCreateRequest, HabitStatusUpdateRequest, HorizonPageCreateRequest,
    HorizonPageUpdateRequest, ProjectCreateRequest, ProjectRenameRequest, ProjectUpdateRequest,
    ReferenceNoteCreateRequest, ReferenceNoteUpdateRequest, WorkspaceListItemsRequest,
    WorkspacePathRequest, WorkspaceSearchRequest,
};

fn internal_error<E: ToString>(error: E) -> rmcp::ErrorData {
    rmcp::ErrorData::internal_error(error.to_string(), None)
}

#[derive(Clone, Debug)]
pub struct GtdMcpServer {
    service: Arc<GtdWorkspaceService>,
    tool_router: ToolRouter<Self>,
}

impl GtdMcpServer {
    pub fn new(service: GtdWorkspaceService) -> Self {
        Self {
            service: Arc::new(service),
            tool_router: Self::tool_router(),
        }
    }

    pub async fn serve_stdio(self) -> Result<(), String> {
        let running = self
            .serve((tokio::io::stdin(), tokio::io::stdout()))
            .await
            .map_err(|error| error.to_string())?;
        running.waiting().await.map_err(|error| error.to_string())?;
        Ok(())
    }
}

#[tool_router(router = tool_router)]
impl GtdMcpServer {
    #[tool(
        description = "Return the current workspace binding, fingerprint, counts, and context-pack cache status."
    )]
    async fn workspace_info(&self) -> Result<Json<crate::backend::WorkspaceInfo>, rmcp::ErrorData> {
        self.service
            .workspace_info()
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Force a workspace rescan and invalidate any pending dry-run changes.")]
    async fn workspace_refresh(
        &self,
    ) -> Result<Json<crate::backend::WorkspaceRefreshResult>, rmcp::ErrorData> {
        self.service
            .workspace_refresh()
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "List indexed GTD items, optionally filtered by item type.")]
    async fn workspace_list_items(
        &self,
        Parameters(request): Parameters<WorkspaceListItemsRequest>,
    ) -> Result<Json<crate::backend::WorkspaceListItemsResult>, rmcp::ErrorData> {
        self.service
            .list_items(request.item_type)
            .map(|items| Json(crate::backend::WorkspaceListItemsResult { items }))
            .map_err(internal_error)
    }

    #[tool(description = "Search markdown content within the bound GTD workspace.")]
    async fn workspace_search(
        &self,
        Parameters(request): Parameters<WorkspaceSearchRequest>,
    ) -> Result<Json<crate::backend::WorkspaceSearchResult>, rmcp::ErrorData> {
        self.service
            .search(request)
            .await
            .map(|matches| Json(crate::backend::WorkspaceSearchResult { matches }))
            .map_err(internal_error)
    }

    #[tool(description = "Return the structured item summary for a workspace-relative path.")]
    async fn workspace_get_item(
        &self,
        Parameters(request): Parameters<WorkspacePathRequest>,
    ) -> Result<Json<crate::backend::GtdItemSummary>, rmcp::ErrorData> {
        self.service
            .get_item(&request.path)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(
        description = "Return outgoing and incoming GTD relationships for a workspace-relative path."
    )]
    async fn workspace_get_relationships(
        &self,
        Parameters(request): Parameters<WorkspacePathRequest>,
    ) -> Result<Json<crate::backend::RelationshipSummary>, rmcp::ErrorData> {
        self.service
            .relationships(&request.path)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Read raw markdown for a workspace-relative path.")]
    async fn workspace_read_markdown(
        &self,
        Parameters(request): Parameters<WorkspacePathRequest>,
    ) -> Result<String, rmcp::ErrorData> {
        self.service
            .read_markdown(&request.path)
            .map_err(internal_error)
    }

    #[tool(
        description = "Plan creation of a GTD project. Returns a dry-run change set that must be applied separately."
    )]
    async fn project_create(
        &self,
        Parameters(request): Parameters<ProjectCreateRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_project_create(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Plan an update to a GTD project README.")]
    async fn project_update(
        &self,
        Parameters(request): Parameters<ProjectUpdateRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_project_update(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Plan a GTD project rename.")]
    async fn project_rename(
        &self,
        Parameters(request): Parameters<ProjectRenameRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_project_rename(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Plan creation of a GTD action.")]
    async fn action_create(
        &self,
        Parameters(request): Parameters<ActionCreateRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_action_create(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Plan an update to a GTD action file.")]
    async fn action_update(
        &self,
        Parameters(request): Parameters<ActionUpdateRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_action_update(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Plan a GTD action rename.")]
    async fn action_rename(
        &self,
        Parameters(request): Parameters<ActionRenameRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_action_rename(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Plan creation of a GTD habit.")]
    async fn habit_create(
        &self,
        Parameters(request): Parameters<HabitCreateRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_habit_create(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Plan a GTD habit status change.")]
    async fn habit_update_status(
        &self,
        Parameters(request): Parameters<HabitStatusUpdateRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_habit_status_update(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Plan creation of an Area, Goal, Vision, or Purpose page.")]
    async fn horizon_page_create(
        &self,
        Parameters(request): Parameters<HorizonPageCreateRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_horizon_page_create(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Plan an update to an Area, Goal, Vision, or Purpose page.")]
    async fn horizon_page_update(
        &self,
        Parameters(request): Parameters<HorizonPageUpdateRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_horizon_page_update(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Plan creation of a Cabinet or Someday Maybe note.")]
    async fn reference_note_create(
        &self,
        Parameters(request): Parameters<ReferenceNoteCreateRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_reference_note_create(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Plan an update to a Cabinet or Someday Maybe note.")]
    async fn reference_note_update(
        &self,
        Parameters(request): Parameters<ReferenceNoteUpdateRequest>,
    ) -> Result<Json<crate::backend::PlannedChange>, rmcp::ErrorData> {
        self.service
            .plan_reference_note_update(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Apply a previously planned dry-run change set.")]
    async fn change_apply(
        &self,
        Parameters(request): Parameters<ChangeSetRequest>,
    ) -> Result<Json<crate::backend::ChangeApplyResult>, rmcp::ErrorData> {
        self.service
            .change_apply(request)
            .map(Json)
            .map_err(internal_error)
    }

    #[tool(description = "Discard a previously planned dry-run change set without applying it.")]
    async fn change_discard(
        &self,
        Parameters(request): Parameters<ChangeSetRequest>,
    ) -> Result<Json<crate::backend::ChangeSetSummary>, rmcp::ErrorData> {
        self.service
            .change_discard(request)
            .map(Json)
            .map_err(internal_error)
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for GtdMcpServer {
    fn get_info(&self) -> ServerInfo {
        let mut info = ServerInfo::default();
        info.instructions = Some(
            "Use GTD semantic tools by default. All mutations require a dry-run tool call followed by change_apply."
                .to_string(),
        );
        info
    }

    async fn list_resources(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<rmcp::RoleServer>,
    ) -> Result<ListResourcesResult, rmcp::ErrorData> {
        let context_pack = self
            .service
            .workspace_context_pack()
            .map_err(internal_error)?;
        let mut resources: Vec<Resource> = vec![
            rmcp::model::RawResource::new("gtdspace://spec/gtd-spec", "GTD Spec")
                .with_mime_type("text/markdown")
                .with_description("Canonical GTD behavior and markdown contract.")
                .no_annotation(),
            rmcp::model::RawResource::new("gtdspace://spec/markdown-schema", "Markdown Schema")
                .with_mime_type("text/markdown")
                .with_description("Detailed GTD markdown marker rules.")
                .no_annotation(),
            rmcp::model::RawResource::new("gtdspace://spec/architecture", "Architecture")
                .with_mime_type("text/markdown")
                .with_description("GTD Space runtime architecture overview.")
                .no_annotation(),
            rmcp::model::RawResource::new(
                "gtdspace://workspace/context.json",
                "Workspace Context JSON",
            )
            .with_mime_type("application/json")
            .with_description("Generated structured workspace context pack.")
            .no_annotation(),
            rmcp::model::RawResource::new(
                "gtdspace://workspace/context.md",
                "Workspace Context Markdown",
            )
            .with_mime_type("text/markdown")
            .with_description("Generated human-readable workspace context pack.")
            .no_annotation(),
        ];
        resources.extend(context_pack.pack.items.iter().map(|item| {
            rmcp::model::RawResource::new(
                format!(
                    "gtdspace://item/{}",
                    urlencoding::encode(&item.relative_path)
                ),
                item.title.clone(),
            )
            .with_mime_type("application/json")
            .with_description(format!("Structured summary for {}", item.relative_path))
            .no_annotation()
        }));
        Ok(ListResourcesResult {
            resources,
            next_cursor: None,
            meta: None,
        })
    }

    async fn read_resource(
        &self,
        request: ReadResourceRequestParams,
        _context: RequestContext<rmcp::RoleServer>,
    ) -> Result<ReadResourceResult, rmcp::ErrorData> {
        let uri = request.uri;
        let contents = if uri == "gtdspace://spec/gtd-spec" {
            vec![ResourceContents::text(
                crate::backend::mcp_workspace::GTD_SPEC_DOC,
                uri,
            )]
        } else if uri == "gtdspace://spec/markdown-schema" {
            vec![ResourceContents::text(
                crate::backend::mcp_workspace::MARKDOWN_SCHEMA_DOC,
                uri,
            )]
        } else if uri == "gtdspace://spec/architecture" {
            vec![ResourceContents::text(
                crate::backend::mcp_workspace::ARCHITECTURE_DOC,
                uri,
            )]
        } else if uri == "gtdspace://workspace/context.json" {
            let context_pack = self
                .service
                .workspace_context_pack()
                .map_err(internal_error)?;
            vec![ResourceContents::text(
                serde_json::to_string_pretty(&context_pack.pack).map_err(internal_error)?,
                uri,
            )
            .with_mime_type("application/json")]
        } else if uri == "gtdspace://workspace/context.md" {
            let context_pack = self
                .service
                .workspace_context_pack()
                .map_err(internal_error)?;
            vec![ResourceContents::text(context_pack.markdown, uri).with_mime_type("text/markdown")]
        } else if let Some(encoded) = uri.strip_prefix("gtdspace://item/") {
            let decoded = urlencoding::decode(encoded).map_err(internal_error)?;
            let item = self
                .service
                .get_item(decoded.as_ref())
                .map_err(internal_error)?;
            vec![ResourceContents::text(
                serde_json::to_string_pretty(&item).map_err(internal_error)?,
                uri,
            )
            .with_mime_type("application/json")]
        } else {
            return Err(rmcp::ErrorData::resource_not_found(
                "Unknown resource URI",
                None,
            ));
        };
        Ok(ReadResourceResult::new(contents))
    }
}
