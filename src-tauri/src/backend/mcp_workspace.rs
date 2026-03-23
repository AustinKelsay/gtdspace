use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use directories::ProjectDirs;
use rmcp::schemars;
use rmcp::schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::commands::filesystem::{
    create_directory, list_markdown_files, read_file, save_file, MarkdownFile,
};
use crate::commands::gtd_habits::update_habit_status;
use crate::commands::gtd_projects::{list_gtd_projects, rename_gtd_action, rename_gtd_project};
use crate::commands::gtd_relationships::{find_habits_referencing, find_reverse_relationships};
use crate::commands::search::{search_files, SearchFilters};
use crate::commands::seed_data::{
    generate_area_of_focus_template_with_refs, generate_goal_template_with_refs,
    generate_project_readme_with_refs, generate_vision_document_template_with_refs,
    ProjectReadmeParams,
};
use crate::commands::utils::sanitize_markdown_file_stem;
use crate::commands::workspace::{check_is_gtd_space, get_default_gtd_space_path};

const CONTEXT_PACK_VERSION: u32 = 1;
const SETTINGS_FILE_NAME: &str = "settings.json";
const CONTEXT_CACHE_DIR: &str = "mcp-context";
const MAX_CONTEXT_PACK_RETRIES: usize = 5;

pub(crate) const GTD_SPEC_DOC: &str = include_str!("../../../spec/gtd-spec.md");
pub(crate) const MARKDOWN_SCHEMA_DOC: &str = include_str!("../../../spec/02-markdown-schema.md");
pub(crate) const ARCHITECTURE_DOC: &str = include_str!("../../../docs/architecture.md");

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum GtdItemType {
    Project,
    Action,
    Habit,
    Area,
    Goal,
    Vision,
    Purpose,
    CabinetNote,
    SomedayNote,
    HorizonOverview,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GtdItemReferenceSummary {
    pub kind: String,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GtdItemSummary {
    pub relative_path: String,
    pub absolute_path: String,
    pub item_type: GtdItemType,
    pub title: String,
    pub status: Option<String>,
    pub due_date: Option<String>,
    pub focus_date: Option<String>,
    pub target_date: Option<String>,
    pub horizon: Option<String>,
    pub review_cadence: Option<String>,
    pub frequency: Option<String>,
    pub effort: Option<String>,
    pub created_date_time: Option<String>,
    pub parent_project_path: Option<String>,
    pub description: Option<String>,
    pub references: Vec<GtdItemReferenceSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RelationshipSummary {
    pub relative_path: String,
    pub outgoing: Vec<GtdItemReferenceSummary>,
    pub incoming_paths: Vec<String>,
    pub referencing_habits: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFingerprint {
    pub normalized_root_path: String,
    pub latest_modified_unix: u64,
    pub markdown_file_count: usize,
    pub aggregate_digest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ContextPackCache {
    pub cache_dir: String,
    pub manifest_path: String,
    pub json_path: String,
    pub markdown_path: String,
    pub source: String,
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub workspace_root: String,
    pub read_only: bool,
    pub item_counts: BTreeMap<String, usize>,
    pub fingerprint: WorkspaceFingerprint,
    pub context_pack_cache: ContextPackCache,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchMatch {
    pub file_path: String,
    pub file_name: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceListItemsResult {
    pub items: Vec<GtdItemSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchResult {
    pub matches: Vec<WorkspaceSearchMatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRefreshResult {
    pub workspace_info: WorkspaceInfo,
    pub invalidated_change_sets: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FolderMeaning {
    pub folder: String,
    pub meaning: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MarkerDefinition {
    pub family: String,
    pub syntax: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ContextPack {
    pub version: u32,
    pub generated_at: String,
    pub workspace_root: String,
    pub fingerprint: WorkspaceFingerprint,
    pub top_level_folders: Vec<FolderMeaning>,
    pub marker_glossary: Vec<MarkerDefinition>,
    pub item_counts: BTreeMap<String, usize>,
    pub items: Vec<GtdItemSummary>,
    pub operation_guidance: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ChangeStatus {
    Planned,
    Applied,
    Discarded,
    Invalidated,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSetSummary {
    pub id: String,
    pub tool_name: String,
    pub summary: String,
    pub status: ChangeStatus,
    pub affected_paths: Vec<String>,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSet {
    pub id: String,
    pub tool_name: String,
    pub summary: String,
    pub status: ChangeStatus,
    pub affected_paths: Vec<String>,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlannedChange {
    pub change_set: ChangeSetSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChangeApplyResult {
    pub change_set: ChangeSetSummary,
    pub workspace_info: WorkspaceInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceListItemsRequest {
    pub item_type: Option<GtdItemType>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchRequest {
    pub query: String,
    #[serde(default = "default_search_limit")]
    pub max_results: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePathRequest {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCreateRequest {
    pub name: String,
    pub description: String,
    pub due_date: Option<String>,
    pub status: Option<String>,
    #[serde(default)]
    pub areas: Vec<String>,
    #[serde(default)]
    pub goals: Vec<String>,
    #[serde(default)]
    pub vision: Vec<String>,
    #[serde(default)]
    pub purpose: Vec<String>,
    #[serde(default)]
    pub general_references: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProjectUpdateRequest {
    pub path: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub status: Option<String>,
    #[serde(default)]
    pub areas: Vec<String>,
    #[serde(default)]
    pub goals: Vec<String>,
    #[serde(default)]
    pub vision: Vec<String>,
    #[serde(default)]
    pub purpose: Vec<String>,
    #[serde(default)]
    pub general_references: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRenameRequest {
    pub path: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ActionCreateRequest {
    pub project_path: String,
    pub name: String,
    pub status: Option<String>,
    pub focus_date: Option<String>,
    pub due_date: Option<String>,
    pub effort: Option<String>,
    #[serde(default)]
    pub contexts: Vec<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub general_references: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ActionUpdateRequest {
    pub path: String,
    pub title: Option<String>,
    pub status: Option<String>,
    pub focus_date: Option<String>,
    pub due_date: Option<String>,
    pub effort: Option<String>,
    #[serde(default)]
    pub contexts: Vec<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub general_references: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ActionRenameRequest {
    pub path: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct HabitCreateRequest {
    pub name: String,
    pub frequency: String,
    pub focus_time: Option<String>,
    #[serde(default)]
    pub projects: Vec<String>,
    #[serde(default)]
    pub areas: Vec<String>,
    #[serde(default)]
    pub goals: Vec<String>,
    #[serde(default)]
    pub vision: Vec<String>,
    #[serde(default)]
    pub purpose: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct HabitStatusUpdateRequest {
    pub path: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum HorizonPageType {
    Area,
    Goal,
    Vision,
    Purpose,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct HorizonPageCreateRequest {
    pub page_type: HorizonPageType,
    pub title: String,
    pub status: Option<String>,
    pub review_cadence: Option<String>,
    pub target_date: Option<String>,
    pub horizon: Option<String>,
    pub description: Option<String>,
    #[serde(default)]
    pub projects: Vec<String>,
    #[serde(default)]
    pub areas: Vec<String>,
    #[serde(default)]
    pub goals: Vec<String>,
    #[serde(default)]
    pub vision: Vec<String>,
    #[serde(default)]
    pub purpose: Vec<String>,
    #[serde(default)]
    pub general_references: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct HorizonPageUpdateRequest {
    pub path: String,
    pub page_type: HorizonPageType,
    pub title: Option<String>,
    pub status: Option<String>,
    pub review_cadence: Option<String>,
    pub target_date: Option<String>,
    pub horizon: Option<String>,
    pub description: Option<String>,
    #[serde(default)]
    pub projects: Vec<String>,
    #[serde(default)]
    pub areas: Vec<String>,
    #[serde(default)]
    pub goals: Vec<String>,
    #[serde(default)]
    pub vision: Vec<String>,
    #[serde(default)]
    pub purpose: Vec<String>,
    #[serde(default)]
    pub general_references: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ReferenceNoteSection {
    Cabinet,
    SomedayMaybe,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceNoteCreateRequest {
    pub section: ReferenceNoteSection,
    pub title: String,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceNoteUpdateRequest {
    pub path: String,
    pub title: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ChangeSetRequest {
    pub change_set_id: String,
}

#[derive(Debug, Clone)]
struct WorkspaceSnapshot {
    fingerprint: WorkspaceFingerprint,
    items: Vec<GtdItemSummary>,
    item_lookup: HashMap<String, GtdItemSummary>,
    item_counts: BTreeMap<String, usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContextPackManifest {
    workspace_path_hash: String,
    generated_at: String,
    generator_version: u32,
    fingerprint: WorkspaceFingerprint,
}

#[derive(Debug, Clone)]
pub(crate) struct CachedContextPack {
    pub pack: ContextPack,
    pub markdown: String,
    cache_paths: CachePaths,
    source: String,
}

#[derive(Debug, Clone)]
struct CachePaths {
    root: PathBuf,
    manifest: PathBuf,
    json: PathBuf,
    markdown: PathBuf,
}

#[derive(Debug, Clone)]
enum ChangeOperation {
    CreateDirectory {
        path: String,
    },
    WriteFile {
        path: String,
        expected_sha256: Option<String>,
        content: String,
    },
    RenameProject {
        old_path: String,
        new_name: String,
        expected_sha256: Option<String>,
    },
    RenameAction {
        old_path: String,
        new_name: String,
        expected_sha256: Option<String>,
    },
    UpdateHabitStatus {
        path: String,
        new_status: String,
        expected_sha256: Option<String>,
    },
}

#[derive(Debug, Clone)]
struct StoredChangeSet {
    public: ChangeSet,
    operations: Vec<ChangeOperation>,
}

#[derive(Debug, Default)]
struct ServiceState {
    snapshot: Option<WorkspaceSnapshot>,
    context_pack: Option<CachedContextPack>,
    change_sets: HashMap<String, StoredChangeSet>,
}

#[derive(Debug, Clone)]
pub struct GtdWorkspaceService {
    workspace_root: PathBuf,
    read_only: bool,
    state: Arc<Mutex<ServiceState>>,
}

impl GtdWorkspaceService {
    pub fn new(cli_workspace: Option<String>, read_only: bool) -> Result<Self, String> {
        let workspace_root = resolve_workspace(cli_workspace)?;
        Ok(Self {
            workspace_root,
            read_only,
            state: Arc::new(Mutex::new(ServiceState::default())),
        })
    }

    pub fn workspace_root(&self) -> String {
        normalize_path(&self.workspace_root)
    }

    pub fn read_only(&self) -> bool {
        self.read_only
    }

    pub fn workspace_info(&self) -> Result<WorkspaceInfo, String> {
        let snapshot = self.ensure_snapshot(false)?;
        let cache = self.ensure_context_pack(false)?;
        Ok(WorkspaceInfo {
            workspace_root: self.workspace_root(),
            read_only: self.read_only,
            item_counts: snapshot.item_counts.clone(),
            fingerprint: snapshot.fingerprint.clone(),
            context_pack_cache: cache.to_public(true),
        })
    }

    pub fn workspace_refresh(&self) -> Result<WorkspaceRefreshResult, String> {
        let invalidated = {
            let mut state = self
                .state
                .lock()
                .map_err(|_| "Failed to lock workspace state".to_string())?;
            let count = state.change_sets.len();
            state.change_sets.clear();
            state.snapshot = None;
            state.context_pack = None;
            count
        };
        let snapshot = self.ensure_snapshot(true)?;
        let cache = self.ensure_context_pack(true)?;
        Ok(WorkspaceRefreshResult {
            workspace_info: WorkspaceInfo {
                workspace_root: self.workspace_root(),
                read_only: self.read_only,
                item_counts: snapshot.item_counts.clone(),
                fingerprint: snapshot.fingerprint,
                context_pack_cache: cache.to_public(true),
            },
            invalidated_change_sets: invalidated,
        })
    }

    pub(crate) fn workspace_context_pack(&self) -> Result<CachedContextPack, String> {
        self.ensure_context_pack(false)
    }

    pub fn list_items(&self, filter: Option<GtdItemType>) -> Result<Vec<GtdItemSummary>, String> {
        let snapshot = self.ensure_snapshot(false)?;
        Ok(snapshot
            .items
            .into_iter()
            .filter(|item| filter.as_ref().is_none_or(|kind| item.item_type == *kind))
            .collect())
    }

    pub fn get_item(&self, path: &str) -> Result<GtdItemSummary, String> {
        let snapshot = self.ensure_snapshot(false)?;
        let normalized = normalize_relative_input(path);
        snapshot
            .item_lookup
            .get(&normalized)
            .cloned()
            .ok_or_else(|| format!("Workspace item not found: {}", normalized))
    }

    pub fn read_markdown(&self, path: &str) -> Result<String, String> {
        let absolute = self.resolve_workspace_file(path)?;
        read_file(absolute)
    }

    pub async fn search(
        &self,
        request: WorkspaceSearchRequest,
    ) -> Result<Vec<WorkspaceSearchMatch>, String> {
        let filters = SearchFilters {
            case_sensitive: false,
            whole_word: false,
            use_regex: false,
            include_file_names: true,
            max_results: request.max_results.max(1),
        };
        let response = search_files(request.query, self.workspace_root(), filters).await?;
        Ok(response
            .results
            .into_iter()
            .map(|entry| WorkspaceSearchMatch {
                file_path: entry.file_path,
                file_name: entry.file_name,
                line_number: entry.line_number,
                line_content: entry.line_content,
                match_start: entry.match_start,
                match_end: entry.match_end,
            })
            .collect())
    }

    pub fn relationships(&self, path: &str) -> Result<RelationshipSummary, String> {
        let item = self.get_item(path)?;
        let filter_types = ["projects", "areas", "goals", "visions", "purpose"];
        let mut incoming = Vec::new();
        for filter in filter_types {
            let results = find_reverse_relationships(
                item.absolute_path.clone(),
                self.workspace_root(),
                filter.to_string(),
            )?;
            incoming.extend(results.into_iter().map(|entry| {
                normalize_absolute_to_relative(&self.workspace_root, &entry.file_path)
            }));
        }
        incoming.sort();
        incoming.dedup();

        let habits = find_habits_referencing(item.absolute_path.clone(), self.workspace_root())?
            .into_iter()
            .map(|entry| normalize_absolute_to_relative(&self.workspace_root, &entry.file_path))
            .collect::<Vec<_>>();

        Ok(RelationshipSummary {
            relative_path: item.relative_path,
            outgoing: item.references,
            incoming_paths: incoming,
            referencing_habits: habits,
        })
    }

    pub fn plan_project_create(
        &self,
        request: ProjectCreateRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let title = sanitize_title(&request.name, "Untitled Project");
        let project_dir = self.workspace_root.join("Projects").join(&title);
        if project_dir.exists() {
            return Err(format!("Project '{}' already exists", title));
        }
        let readme_path = project_dir.join("README.md");
        let content = build_project_markdown(ProjectBuildInput {
            title: title.clone(),
            description: request.description,
            due_date: request.due_date,
            status: request.status.unwrap_or_else(|| "in-progress".to_string()),
            areas: request.areas,
            goals: request.goals,
            vision: request.vision,
            purpose: request.purpose,
            general_references: request.general_references,
            created_date_time: Utc::now().to_rfc3339(),
            additional_content: None,
        });
        self.store_change_set(
            "project_create",
            format!("Create project '{}'", title),
            vec![normalize_path(&project_dir), normalize_path(&readme_path)],
            preview_write(
                "Create project README",
                &normalize_path(&readme_path),
                &content,
            ),
            vec![
                ChangeOperation::CreateDirectory {
                    path: normalize_path(&project_dir),
                },
                ChangeOperation::WriteFile {
                    path: normalize_path(&readme_path),
                    expected_sha256: None,
                    content,
                },
            ],
        )
    }

    pub fn plan_project_update(
        &self,
        request: ProjectUpdateRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let item = self.get_item(&request.path)?;
        if item.item_type != GtdItemType::Project {
            return Err("project_update requires a project README path".to_string());
        }
        let current = self.read_markdown(&item.relative_path)?;
        let parsed = parse_project_update_seed(&current, &item);
        let content = build_project_markdown(ProjectBuildInput {
            title: request.title.unwrap_or(parsed.title),
            description: request
                .description
                .or(parsed.description)
                .unwrap_or_default(),
            due_date: request.due_date.or(parsed.due_date),
            status: request.status.unwrap_or(parsed.status),
            areas: if request.areas.is_empty() {
                parsed.areas
            } else {
                request.areas
            },
            goals: if request.goals.is_empty() {
                parsed.goals
            } else {
                request.goals
            },
            vision: if request.vision.is_empty() {
                parsed.vision
            } else {
                request.vision
            },
            purpose: if request.purpose.is_empty() {
                parsed.purpose
            } else {
                request.purpose
            },
            general_references: if request.general_references.is_empty() {
                parsed.general_references
            } else {
                request.general_references
            },
            created_date_time: parsed.created_date_time,
            additional_content: parsed.additional_content,
        });
        self.store_change_set(
            "project_update",
            format!("Update project '{}'", item.title),
            vec![item.relative_path.clone()],
            preview_write("Rewrite project README", &item.relative_path, &content),
            vec![ChangeOperation::WriteFile {
                path: item.absolute_path.clone(),
                expected_sha256: Some(hash_bytes(current.as_bytes())),
                content,
            }],
        )
    }

    pub fn plan_project_rename(
        &self,
        request: ProjectRenameRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let item = self.get_item(&request.path)?;
        if item.item_type != GtdItemType::Project {
            return Err("project_rename requires a project README path".to_string());
        }
        let current = self.read_markdown(&item.relative_path)?;
        self.store_change_set(
            "project_rename",
            format!("Rename project '{}' to '{}'", item.title, request.new_name),
            vec![item.relative_path.clone()],
            format!(
                "Rename project folder and README title\n- from: {}\n- to: {}",
                item.relative_path, request.new_name
            ),
            vec![ChangeOperation::RenameProject {
                old_path: project_directory_from_readme(&item.absolute_path)?,
                new_name: request.new_name,
                expected_sha256: Some(hash_bytes(current.as_bytes())),
            }],
        )
    }

    pub fn plan_action_create(
        &self,
        request: ActionCreateRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let project_dir = PathBuf::from(self.resolve_workspace_file(&request.project_path)?);
        let file_name = format!("{}.md", sanitize_markdown_file_stem(&request.name));
        let action_path = project_dir.join(file_name);
        if action_path.exists() {
            return Err(format!(
                "Action already exists at {}",
                normalize_path(&action_path)
            ));
        }
        let content = build_action_markdown(ActionBuildInput {
            title: sanitize_title(&request.name, "Untitled Action"),
            status: request.status.unwrap_or_else(|| "in-progress".to_string()),
            focus_date: request.focus_date,
            due_date: request.due_date,
            effort: request.effort.unwrap_or_else(|| "medium".to_string()),
            contexts: request.contexts,
            general_references: request.general_references,
            notes: request.notes,
            created_date_time: Utc::now().to_rfc3339(),
        });
        self.store_change_set(
            "action_create",
            format!("Create action '{}'", request.name),
            vec![normalize_path(&action_path)],
            preview_write(
                "Create action markdown",
                &normalize_path(&action_path),
                &content,
            ),
            vec![ChangeOperation::WriteFile {
                path: normalize_path(&action_path),
                expected_sha256: None,
                content,
            }],
        )
    }

    pub fn plan_action_update(
        &self,
        request: ActionUpdateRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let item = self.get_item(&request.path)?;
        if item.item_type != GtdItemType::Action {
            return Err("action_update requires an action path".to_string());
        }
        let current = self.read_markdown(&item.relative_path)?;
        let parsed = parse_action_update_seed(&current, &item);
        let content = build_action_markdown(ActionBuildInput {
            title: request.title.unwrap_or(parsed.title),
            status: request.status.unwrap_or(parsed.status),
            focus_date: request.focus_date.or(parsed.focus_date),
            due_date: request.due_date.or(parsed.due_date),
            effort: request.effort.unwrap_or(parsed.effort),
            contexts: if request.contexts.is_empty() {
                parsed.contexts
            } else {
                request.contexts
            },
            general_references: if request.general_references.is_empty() {
                parsed.general_references
            } else {
                request.general_references
            },
            notes: request.notes.or(parsed.notes),
            created_date_time: parsed.created_date_time,
        });
        self.store_change_set(
            "action_update",
            format!("Update action '{}'", item.title),
            vec![item.relative_path.clone()],
            preview_write("Rewrite action markdown", &item.relative_path, &content),
            vec![ChangeOperation::WriteFile {
                path: item.absolute_path.clone(),
                expected_sha256: Some(hash_bytes(current.as_bytes())),
                content,
            }],
        )
    }

    pub fn plan_action_rename(
        &self,
        request: ActionRenameRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let item = self.get_item(&request.path)?;
        if item.item_type != GtdItemType::Action {
            return Err("action_rename requires an action path".to_string());
        }
        let current = self.read_markdown(&item.relative_path)?;
        self.store_change_set(
            "action_rename",
            format!("Rename action '{}' to '{}'", item.title, request.new_name),
            vec![item.relative_path.clone()],
            format!(
                "Rename action file and title\n- from: {}\n- to: {}",
                item.relative_path, request.new_name
            ),
            vec![ChangeOperation::RenameAction {
                old_path: item.absolute_path.clone(),
                new_name: request.new_name,
                expected_sha256: Some(hash_bytes(current.as_bytes())),
            }],
        )
    }

    pub fn plan_habit_create(&self, request: HabitCreateRequest) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let title = sanitize_title(&request.name, "Untitled Habit");
        let habit_path = self
            .workspace_root
            .join("Habits")
            .join(format!("{}.md", sanitize_markdown_file_stem(&title)));
        if habit_path.exists() {
            return Err(format!("Habit '{}' already exists", title));
        }
        let content = build_habit_markdown(HabitBuildInput {
            title: title.clone(),
            frequency: request.frequency,
            focus_time: request.focus_time,
            projects: request.projects,
            areas: request.areas,
            goals: request.goals,
            vision: request.vision,
            purpose: request.purpose,
            created_date_time: Utc::now().to_rfc3339(),
        })?;
        self.store_change_set(
            "habit_create",
            format!("Create habit '{}'", title),
            vec![normalize_path(&habit_path)],
            preview_write(
                "Create habit markdown",
                &normalize_path(&habit_path),
                &content,
            ),
            vec![ChangeOperation::WriteFile {
                path: normalize_path(&habit_path),
                expected_sha256: None,
                content,
            }],
        )
    }

    pub fn plan_habit_status_update(
        &self,
        request: HabitStatusUpdateRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let item = self.get_item(&request.path)?;
        if item.item_type != GtdItemType::Habit {
            return Err("habit_update_status requires a habit path".to_string());
        }
        let current = self.read_markdown(&item.relative_path)?;
        self.store_change_set(
            "habit_update_status",
            format!("Set habit '{}' to {}", item.title, request.status),
            vec![item.relative_path.clone()],
            format!(
                "Update habit status\n- path: {}\n- new status: {}",
                item.relative_path, request.status
            ),
            vec![ChangeOperation::UpdateHabitStatus {
                path: item.absolute_path.clone(),
                new_status: request.status,
                expected_sha256: Some(hash_bytes(current.as_bytes())),
            }],
        )
    }

    pub fn plan_horizon_page_create(
        &self,
        request: HorizonPageCreateRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let folder = horizon_folder_name(&request.page_type);
        let title = sanitize_title(&request.title, "Untitled Page");
        let file_path = self
            .workspace_root
            .join(folder)
            .join(format!("{}.md", sanitize_markdown_file_stem(&title)));
        if file_path.exists() {
            return Err(format!(
                "Page already exists at {}",
                normalize_path(&file_path)
            ));
        }
        let content = build_horizon_markdown(
            &request.page_type,
            HorizonBuildInput {
                title,
                status: request.status,
                review_cadence: request.review_cadence,
                target_date: request.target_date,
                horizon: request.horizon,
                description: request.description,
                projects: request.projects,
                areas: request.areas,
                goals: request.goals,
                vision: request.vision,
                purpose: request.purpose,
                general_references: request.general_references,
                created_date_time: Utc::now().to_rfc3339(),
                trailing_content: None,
            },
        )?;
        self.store_change_set(
            "horizon_page_create",
            format!("Create {:?} page", request.page_type),
            vec![normalize_path(&file_path)],
            preview_write("Create horizon page", &normalize_path(&file_path), &content),
            vec![ChangeOperation::WriteFile {
                path: normalize_path(&file_path),
                expected_sha256: None,
                content,
            }],
        )
    }

    pub fn plan_horizon_page_update(
        &self,
        request: HorizonPageUpdateRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let item = self.get_item(&request.path)?;
        let expected = match request.page_type {
            HorizonPageType::Area => GtdItemType::Area,
            HorizonPageType::Goal => GtdItemType::Goal,
            HorizonPageType::Vision => GtdItemType::Vision,
            HorizonPageType::Purpose => GtdItemType::Purpose,
        };
        if item.item_type != expected {
            return Err("horizon_page_update path does not match page_type".to_string());
        }
        let current = self.read_markdown(&item.relative_path)?;
        let parsed = parse_horizon_update_seed(&request.page_type, &current, &item);
        let content = build_horizon_markdown(
            &request.page_type,
            HorizonBuildInput {
                title: request.title.unwrap_or(parsed.title),
                status: request.status.or(parsed.status),
                review_cadence: request.review_cadence.or(parsed.review_cadence),
                target_date: request.target_date.or(parsed.target_date),
                horizon: request.horizon.or(parsed.horizon),
                description: request.description.or(parsed.description),
                projects: if request.projects.is_empty() {
                    parsed.projects
                } else {
                    request.projects
                },
                areas: if request.areas.is_empty() {
                    parsed.areas
                } else {
                    request.areas
                },
                goals: if request.goals.is_empty() {
                    parsed.goals
                } else {
                    request.goals
                },
                vision: if request.vision.is_empty() {
                    parsed.vision
                } else {
                    request.vision
                },
                purpose: if request.purpose.is_empty() {
                    parsed.purpose
                } else {
                    request.purpose
                },
                general_references: if request.general_references.is_empty() {
                    parsed.general_references
                } else {
                    request.general_references
                },
                created_date_time: parsed.created_date_time,
                trailing_content: parsed.trailing_content,
            },
        )?;
        self.store_change_set(
            "horizon_page_update",
            format!("Update {:?} page '{}'", request.page_type, item.title),
            vec![item.relative_path.clone()],
            preview_write("Rewrite horizon page", &item.relative_path, &content),
            vec![ChangeOperation::WriteFile {
                path: item.absolute_path.clone(),
                expected_sha256: Some(hash_bytes(current.as_bytes())),
                content,
            }],
        )
    }

    pub fn plan_reference_note_create(
        &self,
        request: ReferenceNoteCreateRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let folder = match request.section {
            ReferenceNoteSection::Cabinet => "Cabinet",
            ReferenceNoteSection::SomedayMaybe => "Someday Maybe",
        };
        let title = sanitize_title(&request.title, "Untitled Note");
        let path = self
            .workspace_root
            .join(folder)
            .join(format!("{}.md", sanitize_markdown_file_stem(&title)));
        if path.exists() {
            return Err(format!("Note already exists at {}", normalize_path(&path)));
        }
        let content = build_reference_note_markdown(&title, request.body, None);
        self.store_change_set(
            "reference_note_create",
            format!("Create {} note '{}'", folder, title),
            vec![normalize_path(&path)],
            preview_write("Create reference note", &normalize_path(&path), &content),
            vec![ChangeOperation::WriteFile {
                path: normalize_path(&path),
                expected_sha256: None,
                content,
            }],
        )
    }

    pub fn plan_reference_note_update(
        &self,
        request: ReferenceNoteUpdateRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let item = self.get_item(&request.path)?;
        if !matches!(
            item.item_type,
            GtdItemType::CabinetNote | GtdItemType::SomedayNote
        ) {
            return Err(
                "reference_note_update requires a Cabinet or Someday Maybe note".to_string(),
            );
        }
        let current = self.read_markdown(&item.relative_path)?;
        let (_, body) = parse_reference_note(&current);
        let content = build_reference_note_markdown(
            request.title.as_deref().unwrap_or(&item.title),
            request.body,
            Some(body),
        );
        self.store_change_set(
            "reference_note_update",
            format!("Update note '{}'", item.title),
            vec![item.relative_path.clone()],
            preview_write("Rewrite reference note", &item.relative_path, &content),
            vec![ChangeOperation::WriteFile {
                path: item.absolute_path.clone(),
                expected_sha256: Some(hash_bytes(current.as_bytes())),
                content,
            }],
        )
    }

    pub fn change_apply(&self, request: ChangeSetRequest) -> Result<ChangeApplyResult, String> {
        self.reject_if_read_only()?;
        let change_set_id = request.change_set_id;
        let stored = {
            let state = self
                .state
                .lock()
                .map_err(|_| "Failed to lock workspace state".to_string())?;
            state
                .change_sets
                .get(&change_set_id)
                .cloned()
                .ok_or_else(|| format!("Unknown change set '{}'", change_set_id))?
        };

        for op in &stored.operations {
            self.revalidate_operation(op)?;
        }

        for op in &stored.operations {
            let apply_result = match op {
                ChangeOperation::CreateDirectory { path } => {
                    create_directory(path.clone()).map(|_| ())
                }
                ChangeOperation::WriteFile { path, content, .. } => {
                    save_file(path.clone(), content.clone()).map(|_| ())
                }
                ChangeOperation::RenameProject {
                    old_path, new_name, ..
                } => rename_gtd_project(old_path.clone(), new_name.clone()).map(|_| ()),
                ChangeOperation::RenameAction {
                    old_path, new_name, ..
                } => rename_gtd_action(old_path.clone(), new_name.clone()).map(|_| ()),
                ChangeOperation::UpdateHabitStatus {
                    path, new_status, ..
                } => update_habit_status(path.clone(), new_status.clone()).map(|_| ()),
            };

            if let Err(error) = apply_result {
                let mut state = self
                    .state
                    .lock()
                    .map_err(|_| "Failed to lock workspace state".to_string())?;
                state.change_sets.remove(&change_set_id);
                state.snapshot = None;
                state.context_pack = None;
                return Err(format!(
                    "{} Workspace state may be partially updated; run workspace_refresh before continuing.",
                    error
                ));
            }
        }

        {
            let mut state = self
                .state
                .lock()
                .map_err(|_| "Failed to lock workspace state".to_string())?;
            state.change_sets.remove(&change_set_id);
            state.snapshot = None;
            state.context_pack = None;
        }

        let info = self.workspace_info()?;
        Ok(ChangeApplyResult {
            change_set: ChangeSetSummary {
                id: stored.public.id,
                tool_name: stored.public.tool_name,
                summary: stored.public.summary,
                status: ChangeStatus::Applied,
                affected_paths: stored.public.affected_paths,
                preview: stored.public.preview,
            },
            workspace_info: info,
        })
    }

    pub fn change_discard(&self, request: ChangeSetRequest) -> Result<ChangeSetSummary, String> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Failed to lock workspace state".to_string())?;
        let mut change = state
            .change_sets
            .remove(&request.change_set_id)
            .ok_or_else(|| format!("Unknown change set '{}'", request.change_set_id))?;
        change.public.status = ChangeStatus::Discarded;
        Ok(ChangeSetSummary {
            id: change.public.id,
            tool_name: change.public.tool_name,
            summary: change.public.summary,
            status: change.public.status,
            affected_paths: change.public.affected_paths,
            preview: change.public.preview,
        })
    }

    fn ensure_snapshot(&self, force: bool) -> Result<WorkspaceSnapshot, String> {
        let files = list_markdown_files(self.workspace_root())?;
        let fingerprint = build_fingerprint(&self.workspace_root, &files);

        let mut state = self
            .state
            .lock()
            .map_err(|_| "Failed to lock workspace state".to_string())?;
        if !force {
            if let Some(snapshot) = &state.snapshot {
                if snapshot.fingerprint == fingerprint {
                    return Ok(snapshot.clone());
                }
            }
        }

        let items = build_item_summaries(&self.workspace_root, files)?;
        let mut lookup = HashMap::new();
        let mut counts = BTreeMap::new();
        for item in &items {
            lookup.insert(item.relative_path.clone(), item.clone());
            *counts
                .entry(item_type_key(&item.item_type).to_string())
                .or_insert(0) += 1;
        }
        let snapshot = WorkspaceSnapshot {
            fingerprint,
            items,
            item_lookup: lookup,
            item_counts: counts,
        };
        state.snapshot = Some(snapshot.clone());
        state.context_pack = None;
        state.change_sets.clear();
        Ok(snapshot)
    }

    fn ensure_context_pack(&self, force: bool) -> Result<CachedContextPack, String> {
        for attempt in 0..MAX_CONTEXT_PACK_RETRIES {
            let snapshot = self.ensure_snapshot(force)?;
            let cache_paths = self.cache_paths()?;

            {
                let state = self
                    .state
                    .lock()
                    .map_err(|_| "Failed to lock workspace state".to_string())?;
                if !force {
                    if let Some(cached) = &state.context_pack {
                        if cached.pack.fingerprint == snapshot.fingerprint {
                            return Ok(cached.clone());
                        }
                    }
                }
            }

            if !force {
                if let Some(cached) = read_cached_context_pack(&cache_paths, &snapshot.fingerprint)?
                {
                    let mut state = self
                        .state
                        .lock()
                        .map_err(|_| "Failed to lock workspace state".to_string())?;
                    if let Some(existing) = &state.context_pack {
                        if existing.pack.fingerprint == snapshot.fingerprint {
                            return Ok(existing.clone());
                        }
                    }
                    if !snapshot_matches_state(&state, &snapshot.fingerprint) {
                        if attempt + 1 < MAX_CONTEXT_PACK_RETRIES {
                            std::thread::sleep(std::time::Duration::from_millis(10));
                        }
                        continue;
                    }
                    state.context_pack = Some(cached.clone());
                    return Ok(cached);
                }
            }

            let pack = build_context_pack(snapshot.clone(), self.workspace_root());
            let markdown = build_context_pack_markdown(&pack);
            write_cached_context_pack(&cache_paths, &pack, &markdown)?;
            let cached = CachedContextPack {
                pack,
                markdown,
                cache_paths,
                source: "generated".to_string(),
            };
            let mut state = self
                .state
                .lock()
                .map_err(|_| "Failed to lock workspace state".to_string())?;
            if let Some(existing) = &state.context_pack {
                if existing.pack.fingerprint == snapshot.fingerprint {
                    return Ok(existing.clone());
                }
            }
            if !snapshot_matches_state(&state, &snapshot.fingerprint) {
                if attempt + 1 < MAX_CONTEXT_PACK_RETRIES {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
                continue;
            }
            state.context_pack = Some(cached.clone());
            return Ok(cached);
        }
        Err("Failed to generate a stable context pack after repeated workspace changes".to_string())
    }

    fn cache_paths(&self) -> Result<CachePaths, String> {
        let dirs = project_dirs()?;
        let mut hasher = Sha256::new();
        hasher.update(self.workspace_root().as_bytes());
        let workspace_hash = format!("{:x}", hasher.finalize());
        let root = dirs
            .cache_dir()
            .join(CONTEXT_CACHE_DIR)
            .join(workspace_hash);
        Ok(CachePaths {
            manifest: root.join("manifest.json"),
            json: root.join("gtd-context.json"),
            markdown: root.join("gtd-context.md"),
            root,
        })
    }

    fn resolve_workspace_file(&self, path: &str) -> Result<String, String> {
        let candidate = Path::new(path);
        let absolute = if candidate.is_absolute() {
            normalize_path_components(candidate)
        } else {
            normalize_path_components(&self.workspace_root.join(normalize_relative_input(path)))
        };
        let canonical_root = fs::canonicalize(&self.workspace_root)
            .map_err(|error| format!("Failed to resolve workspace root: {}", error))?;
        let normalized_absolute = if absolute.exists() {
            fs::canonicalize(&absolute).map_err(|error| {
                format!("Failed to resolve path '{}': {}", absolute.display(), error)
            })?
        } else {
            absolute.clone()
        };
        let parent_check = normalized_absolute
            .parent()
            .map(|parent| parent.starts_with(&canonical_root))
            .unwrap_or(false);
        if normalized_absolute.exists() {
            if !normalized_absolute.starts_with(&canonical_root) {
                return Err("Path must stay inside the GTD workspace".to_string());
            }
        } else if !parent_check {
            return Err("Path must stay inside the GTD workspace".to_string());
        }
        Ok(normalize_path(&absolute))
    }

    fn reject_if_read_only(&self) -> Result<(), String> {
        if self.read_only {
            Err("This MCP server is running in read-only mode".to_string())
        } else {
            Ok(())
        }
    }

    fn revalidate_operation(&self, operation: &ChangeOperation) -> Result<(), String> {
        match operation {
            ChangeOperation::CreateDirectory { path } => {
                let _ = self.resolve_workspace_file(path)?;
                Ok(())
            }
            ChangeOperation::WriteFile {
                path,
                expected_sha256,
                ..
            } => {
                let absolute = self.resolve_workspace_file(path)?;
                let current_hash = hash_file_if_exists(&absolute)?;
                if &current_hash != expected_sha256 {
                    return Err(format!(
                        "File changed since planning: {}",
                        normalize_absolute_to_relative(&self.workspace_root, &absolute)
                    ));
                }
                Ok(())
            }
            ChangeOperation::RenameProject {
                old_path,
                expected_sha256,
                ..
            } => {
                let readme = Path::new(old_path).join("README.md");
                let readme_path = normalize_path(&readme);
                let current_hash = hash_file_if_exists(&readme_path)?;
                if &current_hash != expected_sha256 {
                    return Err("Project changed since planning".to_string());
                }
                Ok(())
            }
            ChangeOperation::RenameAction {
                old_path,
                expected_sha256,
                ..
            } => {
                let current_hash = hash_file_if_exists(old_path)?;
                if &current_hash != expected_sha256 {
                    return Err("Action changed since planning".to_string());
                }
                Ok(())
            }
            ChangeOperation::UpdateHabitStatus {
                path,
                expected_sha256,
                ..
            } => {
                let current_hash = hash_file_if_exists(path)?;
                if &current_hash != expected_sha256 {
                    return Err("Habit changed since planning".to_string());
                }
                Ok(())
            }
        }
    }

    fn store_change_set(
        &self,
        tool_name: &str,
        summary: String,
        affected_paths: Vec<String>,
        preview: String,
        operations: Vec<ChangeOperation>,
    ) -> Result<PlannedChange, String> {
        let id = Uuid::new_v4().to_string();
        let public = ChangeSet {
            id: id.clone(),
            tool_name: tool_name.to_string(),
            summary: summary.clone(),
            status: ChangeStatus::Planned,
            affected_paths: affected_paths.clone(),
            preview: preview.clone(),
        };
        let summary = ChangeSetSummary {
            id: id.clone(),
            tool_name: tool_name.to_string(),
            summary,
            status: ChangeStatus::Planned,
            affected_paths,
            preview,
        };
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Failed to lock workspace state".to_string())?;
        state
            .change_sets
            .insert(id, StoredChangeSet { public, operations });
        Ok(PlannedChange {
            change_set: summary,
        })
    }
}

impl CachedContextPack {
    fn to_public(&self, valid: bool) -> ContextPackCache {
        ContextPackCache {
            cache_dir: normalize_path(&self.cache_paths.root),
            manifest_path: normalize_path(&self.cache_paths.manifest),
            json_path: normalize_path(&self.cache_paths.json),
            markdown_path: normalize_path(&self.cache_paths.markdown),
            source: self.source.clone(),
            valid,
        }
    }
}

#[derive(Debug)]
struct ProjectBuildInput {
    title: String,
    description: String,
    due_date: Option<String>,
    status: String,
    areas: Vec<String>,
    goals: Vec<String>,
    vision: Vec<String>,
    purpose: Vec<String>,
    general_references: Vec<String>,
    created_date_time: String,
    additional_content: Option<String>,
}

#[derive(Debug)]
struct ActionBuildInput {
    title: String,
    status: String,
    focus_date: Option<String>,
    due_date: Option<String>,
    effort: String,
    contexts: Vec<String>,
    general_references: Vec<String>,
    notes: Option<String>,
    created_date_time: String,
}

#[derive(Debug)]
struct HabitBuildInput {
    title: String,
    frequency: String,
    focus_time: Option<String>,
    projects: Vec<String>,
    areas: Vec<String>,
    goals: Vec<String>,
    vision: Vec<String>,
    purpose: Vec<String>,
    created_date_time: String,
}

#[derive(Debug)]
struct HorizonBuildInput {
    title: String,
    status: Option<String>,
    review_cadence: Option<String>,
    target_date: Option<String>,
    horizon: Option<String>,
    description: Option<String>,
    projects: Vec<String>,
    areas: Vec<String>,
    goals: Vec<String>,
    vision: Vec<String>,
    purpose: Vec<String>,
    general_references: Vec<String>,
    created_date_time: String,
    trailing_content: Option<String>,
}

#[derive(Debug)]
struct ProjectUpdateSeed {
    title: String,
    description: Option<String>,
    due_date: Option<String>,
    status: String,
    areas: Vec<String>,
    goals: Vec<String>,
    vision: Vec<String>,
    purpose: Vec<String>,
    general_references: Vec<String>,
    created_date_time: String,
    additional_content: Option<String>,
}

#[derive(Debug)]
struct ActionUpdateSeed {
    title: String,
    status: String,
    focus_date: Option<String>,
    due_date: Option<String>,
    effort: String,
    contexts: Vec<String>,
    general_references: Vec<String>,
    notes: Option<String>,
    created_date_time: String,
}

#[derive(Debug)]
struct HorizonUpdateSeed {
    title: String,
    status: Option<String>,
    review_cadence: Option<String>,
    target_date: Option<String>,
    horizon: Option<String>,
    description: Option<String>,
    projects: Vec<String>,
    areas: Vec<String>,
    goals: Vec<String>,
    vision: Vec<String>,
    purpose: Vec<String>,
    general_references: Vec<String>,
    created_date_time: String,
    trailing_content: Option<String>,
}

fn default_search_limit() -> usize {
    20
}

fn resolve_workspace(cli_workspace: Option<String>) -> Result<PathBuf, String> {
    if let Some(path) = cli_workspace {
        return validate_workspace_candidate(Path::new(&path));
    }

    if let Some(settings_path) = settings_file_path() {
        if let Ok(contents) = fs::read_to_string(&settings_path) {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&contents) {
                let candidates = [
                    value
                        .get("user_settings")
                        .and_then(|settings| settings.get("last_folder"))
                        .and_then(|entry| entry.as_str())
                        .map(str::to_string),
                    value
                        .get("user_settings")
                        .and_then(|settings| settings.get("default_space_path"))
                        .and_then(|entry| entry.as_str())
                        .map(str::to_string),
                ];

                for candidate in candidates.into_iter().flatten() {
                    if let Ok(path) = validate_workspace_candidate(Path::new(&candidate)) {
                        return Ok(path);
                    }
                }
            }
        }
    }

    let default_path = get_default_gtd_space_path()?;
    validate_workspace_candidate(Path::new(&default_path))
}

fn validate_workspace_candidate(candidate: &Path) -> Result<PathBuf, String> {
    for ancestor in candidate.ancestors() {
        let path = normalize_path(ancestor);
        if check_is_gtd_space(path.clone())? {
            return fs::canonicalize(ancestor)
                .map_err(|error| format!("Failed to resolve workspace '{}': {}", path, error));
        }
    }
    Err(format!(
        "Path '{}' is not inside a valid GTD workspace",
        candidate.display()
    ))
}

fn project_dirs() -> Result<ProjectDirs, String> {
    ProjectDirs::from("", "", "com.gtdspace.app")
        .ok_or_else(|| "Failed to resolve GTD Space application directories".to_string())
}

fn settings_file_path() -> Option<PathBuf> {
    project_dirs()
        .ok()
        .map(|dirs| dirs.config_dir().join(SETTINGS_FILE_NAME))
}

fn snapshot_matches_state(state: &ServiceState, fingerprint: &WorkspaceFingerprint) -> bool {
    state
        .snapshot
        .as_ref()
        .map(|snapshot| snapshot.fingerprint == *fingerprint)
        .unwrap_or(false)
}

fn build_fingerprint(root: &Path, files: &[MarkdownFile]) -> WorkspaceFingerprint {
    let mut latest_modified_unix = 0_u64;
    let mut hasher = Sha256::new();

    for file in files {
        latest_modified_unix = latest_modified_unix.max(file.last_modified);
        let relative = normalize_absolute_to_relative(root, &file.path);
        hasher.update(relative.as_bytes());
        hasher.update(file.last_modified.to_string().as_bytes());
    }

    WorkspaceFingerprint {
        normalized_root_path: normalize_path(root),
        latest_modified_unix,
        markdown_file_count: files.len(),
        aggregate_digest: format!("{:x}", hasher.finalize()),
    }
}

fn build_item_summaries(
    root: &Path,
    files: Vec<MarkdownFile>,
) -> Result<Vec<GtdItemSummary>, String> {
    let project_paths = list_gtd_projects(normalize_path(root))?
        .into_iter()
        .map(|project| {
            (
                normalize_path(Path::new(&project.path).join("README.md")),
                project,
            )
        })
        .collect::<HashMap<_, _>>();

    let mut items = Vec::new();
    for file in files {
        if let Some(item) = parse_item_summary(root, &file, &project_paths)? {
            items.push(item);
        }
    }
    items.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(items)
}

fn parse_item_summary(
    root: &Path,
    file: &MarkdownFile,
    project_readmes: &HashMap<String, crate::commands::gtd_projects::GTDProject>,
) -> Result<Option<GtdItemSummary>, String> {
    let relative_path = normalize_absolute_to_relative(root, &file.path);
    let normalized = relative_path.replace('\\', "/");
    let content = read_file(file.path.clone())?;
    let title = extract_h1(&content).unwrap_or_else(|| strip_markdown_extension(&file.name));
    let references = extract_all_reference_groups(&content);
    let created_fallback = Some(unix_to_rfc3339(file.last_modified));

    let summary = if is_horizon_overview(&normalized) {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::HorizonOverview,
            title,
            status: None,
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: extract_single_select(&content, "horizon-altitude"),
            review_cadence: extract_single_select(&content, "horizon-review-cadence"),
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "How to work this horizon in GTD Space"),
            references,
        })
    } else if is_project_readme(&normalized) {
        let project = project_readmes.get(&normalize_path(&file.path));
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Project,
            title,
            status: extract_single_select(&content, "project-status")
                .or_else(|| extract_single_select(&content, "status")),
            due_date: extract_datetime(&content, "due_date"),
            focus_date: None,
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: project.map(|entry| normalize_path(&entry.path)),
            description: extract_section_body(&content, "Desired Outcome")
                .or_else(|| extract_section_body(&content, "Description")),
            references,
        })
    } else if normalized.starts_with("Projects/") {
        let project_path = Path::new(&normalized)
            .parent()
            .map(normalize_path)
            .unwrap_or_default();
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Action,
            title,
            status: extract_single_select(&content, "status"),
            due_date: extract_datetime(&content, "due_date"),
            focus_date: extract_datetime(&content, "focus_date")
                .or_else(|| extract_datetime(&content, "focus_date_time")),
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: extract_single_select(&content, "effort"),
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: Some(project_path),
            description: extract_section_body(&content, "Notes"),
            references,
        })
    } else if normalized.starts_with("Habits/") {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Habit,
            title,
            status: extract_checkbox_status(&content),
            due_date: None,
            focus_date: extract_datetime(&content, "focus_date"),
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: extract_single_select(&content, "habit-frequency"),
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "Notes"),
            references,
        })
    } else if normalized.starts_with("Areas of Focus/") {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Area,
            title,
            status: extract_single_select(&content, "area-status"),
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: None,
            review_cadence: extract_single_select(&content, "area-review-cadence"),
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "Description"),
            references,
        })
    } else if normalized.starts_with("Goals/") {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Goal,
            title,
            status: extract_single_select(&content, "goal-status"),
            due_date: None,
            focus_date: None,
            target_date: extract_datetime(&content, "goal-target-date")
                .or_else(|| extract_datetime(&content, "target_date")),
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "Description"),
            references,
        })
    } else if normalized.starts_with("Vision/") {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Vision,
            title,
            status: None,
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: extract_single_select(&content, "vision-horizon"),
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "Narrative"),
            references,
        })
    } else if normalized.starts_with("Purpose & Principles/") {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Purpose,
            title,
            status: None,
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "Description"),
            references,
        })
    } else if normalized.starts_with("Cabinet/") {
        let (_, body) = parse_reference_note(&content);
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::CabinetNote,
            title,
            status: None,
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: created_fallback,
            parent_project_path: None,
            description: Some(body),
            references,
        })
    } else if normalized.starts_with("Someday Maybe/") {
        let (_, body) = parse_reference_note(&content);
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::SomedayNote,
            title,
            status: None,
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: created_fallback,
            parent_project_path: None,
            description: Some(body),
            references,
        })
    } else {
        None
    };

    Ok(summary)
}

fn build_context_pack(snapshot: WorkspaceSnapshot, workspace_root: String) -> ContextPack {
    ContextPack {
        version: CONTEXT_PACK_VERSION,
        generated_at: Utc::now().to_rfc3339(),
        workspace_root,
        fingerprint: snapshot.fingerprint,
        top_level_folders: vec![
            FolderMeaning {
                folder: "Projects".to_string(),
                meaning: "Project folders with canonical README.md files and sibling action files."
                    .to_string(),
            },
            FolderMeaning {
                folder: "Habits".to_string(),
                meaning: "One markdown file per habit.".to_string(),
            },
            FolderMeaning {
                folder: "Areas of Focus".to_string(),
                meaning: "Area pages plus a folder overview README.".to_string(),
            },
            FolderMeaning {
                folder: "Goals".to_string(),
                meaning: "Goal pages plus a folder overview README.".to_string(),
            },
            FolderMeaning {
                folder: "Vision".to_string(),
                meaning: "Vision pages plus a folder overview README.".to_string(),
            },
            FolderMeaning {
                folder: "Purpose & Principles".to_string(),
                meaning: "Purpose pages plus a folder overview README.".to_string(),
            },
            FolderMeaning {
                folder: "Someday Maybe".to_string(),
                meaning: "Flat idea/reference note area.".to_string(),
            },
            FolderMeaning {
                folder: "Cabinet".to_string(),
                meaning: "Flat reference storage area.".to_string(),
            },
        ],
        marker_glossary: vec![
            MarkerDefinition {
                family: "singleselect".to_string(),
                syntax: "[!singleselect:<field>:<value>]".to_string(),
                notes: "Canonical enum-like GTD metadata.".to_string(),
            },
            MarkerDefinition {
                family: "multiselect".to_string(),
                syntax: "[!multiselect:<field>:a,b,c]".to_string(),
                notes: "Used for contexts and selected multi-value fields.".to_string(),
            },
            MarkerDefinition {
                family: "checkbox".to_string(),
                syntax: "[!checkbox:habit-status:true|false]".to_string(),
                notes: "Canonical habit completion marker.".to_string(),
            },
            MarkerDefinition {
                family: "datetime".to_string(),
                syntax: "[!datetime:<field>:<value>]".to_string(),
                notes: "Dates and timestamps such as due dates and created timestamps.".to_string(),
            },
            MarkerDefinition {
                family: "references".to_string(),
                syntax: "[!areas-references:...] / [!references:...]".to_string(),
                notes: "Typed and generic links between GTD items.".to_string(),
            },
        ],
        item_counts: snapshot.item_counts,
        items: snapshot.items,
        operation_guidance: vec![
            "Prefer GTD semantic tools over raw file edits.".to_string(),
            "All write tools dry-run first and require change_apply.".to_string(),
            "Paths in tool requests should be workspace-relative unless otherwise noted."
                .to_string(),
        ],
    }
}

fn build_context_pack_markdown(pack: &ContextPack) -> String {
    let mut lines = vec![
        "# GTD Space Context Pack".to_string(),
        String::new(),
        format!("- Workspace: `{}`", pack.workspace_root),
        format!("- Generated: `{}`", pack.generated_at),
        format!(
            "- Files indexed: `{}`",
            pack.fingerprint.markdown_file_count
        ),
        String::new(),
        "## Folder Semantics".to_string(),
    ];
    for folder in &pack.top_level_folders {
        lines.push(format!("- `{}`: {}", folder.folder, folder.meaning));
    }
    lines.push(String::new());
    lines.push("## Item Counts".to_string());
    for (key, value) in &pack.item_counts {
        lines.push(format!("- `{}`: {}", key, value));
    }
    lines.push(String::new());
    lines.push("## Tool Guidance".to_string());
    for entry in &pack.operation_guidance {
        lines.push(format!("- {}", entry));
    }
    lines.push(String::new());
    lines.push("## Items".to_string());
    for item in &pack.items {
        lines.push(format!(
            "- `{}` [{}] {}",
            item.relative_path,
            item_type_key(&item.item_type),
            item.title
        ));
    }
    format!("{}\n", lines.join("\n"))
}

fn read_cached_context_pack(
    cache_paths: &CachePaths,
    fingerprint: &WorkspaceFingerprint,
) -> Result<Option<CachedContextPack>, String> {
    if !cache_paths.manifest.exists()
        || !cache_paths.json.exists()
        || !cache_paths.markdown.exists()
    {
        return Ok(None);
    }
    let manifest = fs::read_to_string(&cache_paths.manifest)
        .map_err(|error| format!("Failed to read context manifest: {}", error))?;
    let manifest = serde_json::from_str::<ContextPackManifest>(&manifest)
        .map_err(|error| format!("Failed to parse context manifest: {}", error))?;
    if manifest.generator_version != CONTEXT_PACK_VERSION || manifest.fingerprint != *fingerprint {
        return Ok(None);
    }
    let json = fs::read_to_string(&cache_paths.json)
        .map_err(|error| format!("Failed to read cached context JSON: {}", error))?;
    let markdown = fs::read_to_string(&cache_paths.markdown)
        .map_err(|error| format!("Failed to read cached context markdown: {}", error))?;
    let pack = serde_json::from_str::<ContextPack>(&json)
        .map_err(|error| format!("Failed to parse cached context JSON: {}", error))?;
    Ok(Some(CachedContextPack {
        pack,
        markdown,
        cache_paths: cache_paths.clone(),
        source: "cache".to_string(),
    }))
}

fn write_cached_context_pack(
    cache_paths: &CachePaths,
    pack: &ContextPack,
    markdown: &str,
) -> Result<(), String> {
    fs::create_dir_all(&cache_paths.root)
        .map_err(|error| format!("Failed to create context cache directory: {}", error))?;
    let mut hasher = Sha256::new();
    hasher.update(pack.workspace_root.as_bytes());
    let manifest = ContextPackManifest {
        workspace_path_hash: format!("{:x}", hasher.finalize()),
        generated_at: pack.generated_at.clone(),
        generator_version: CONTEXT_PACK_VERSION,
        fingerprint: pack.fingerprint.clone(),
    };
    fs::write(
        &cache_paths.manifest,
        serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Failed to write context manifest: {}", error))?;
    fs::write(
        &cache_paths.json,
        serde_json::to_vec_pretty(pack).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Failed to write context JSON: {}", error))?;
    fs::write(&cache_paths.markdown, markdown)
        .map_err(|error| format!("Failed to write context markdown: {}", error))?;
    Ok(())
}

fn normalize_path<P: AsRef<Path>>(path: P) -> String {
    path.as_ref().to_string_lossy().replace('\\', "/")
}

fn normalize_relative_input(path: &str) -> String {
    path.trim().trim_start_matches("./").replace('\\', "/")
}

fn normalize_absolute_to_relative(root: &Path, path: &str) -> String {
    let absolute = Path::new(path);
    if absolute.is_absolute() {
        absolute
            .strip_prefix(root)
            .map(normalize_path)
            .unwrap_or_else(|_| normalize_path(absolute))
            .trim_start_matches('/')
            .to_string()
    } else {
        normalize_relative_input(path)
    }
}

fn item_type_key(kind: &GtdItemType) -> &'static str {
    match kind {
        GtdItemType::Project => "project",
        GtdItemType::Action => "action",
        GtdItemType::Habit => "habit",
        GtdItemType::Area => "area",
        GtdItemType::Goal => "goal",
        GtdItemType::Vision => "vision",
        GtdItemType::Purpose => "purpose",
        GtdItemType::CabinetNote => "cabinet-note",
        GtdItemType::SomedayNote => "someday-note",
        GtdItemType::HorizonOverview => "horizon-overview",
    }
}

fn strip_markdown_extension(name: &str) -> String {
    let lowered = name.to_ascii_lowercase();
    if lowered.ends_with(".markdown") {
        name[..name.len() - ".markdown".len()].to_string()
    } else if lowered.ends_with(".md") {
        name[..name.len() - ".md".len()].to_string()
    } else {
        name.to_string()
    }
}

fn sanitize_title(input: &str, fallback: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

fn is_project_readme(path: &str) -> bool {
    path.starts_with("Projects/") && path.split('/').count() == 3 && path.ends_with("README.md")
        || path.starts_with("Projects/")
            && path.split('/').count() == 3
            && path.ends_with("README.markdown")
}

fn is_horizon_overview(path: &str) -> bool {
    matches!(
        path,
        "Areas of Focus/README.md"
            | "Goals/README.md"
            | "Vision/README.md"
            | "Purpose & Principles/README.md"
    )
}

fn extract_h1(content: &str) -> Option<String> {
    content.lines().find_map(|line| {
        line.trim()
            .strip_prefix("# ")
            .map(|value| value.trim().to_string())
    })
}

fn extract_single_select(content: &str, field: &str) -> Option<String> {
    extract_marker(content, &format!("[!singleselect:{}:", field))
        .or_else(|| extract_marker(content, &format!("[!multiselect:{}:", field)))
}

fn extract_checkbox_status(content: &str) -> Option<String> {
    extract_marker(content, "[!checkbox:habit-status:").map(|value| {
        if value.eq_ignore_ascii_case("true") {
            "completed".to_string()
        } else {
            "todo".to_string()
        }
    })
}

fn extract_datetime(content: &str, field: &str) -> Option<String> {
    extract_marker(content, &format!("[!datetime:{}:", field))
}

fn extract_multiselect(content: &str, field: &str) -> Vec<String> {
    extract_marker(content, &format!("[!multiselect:{}:", field))
        .map(|value| {
            value
                .split(',')
                .map(|entry| entry.trim().to_string())
                .filter(|entry| !entry.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn extract_marker(content: &str, prefix: &str) -> Option<String> {
    let start = content.find(prefix)?;
    let remaining = &content[start + prefix.len()..];
    let end = remaining.find(']')?;
    Some(remaining[..end].trim().to_string())
}

fn extract_section_body(content: &str, heading: &str) -> Option<String> {
    let mut active = false;
    let mut buffer = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.eq_ignore_ascii_case(&format!("## {}", heading)) {
            active = true;
            continue;
        }
        if active && trimmed.starts_with("## ") {
            break;
        }
        if active {
            buffer.push(line);
        }
    }

    let value = buffer.join("\n").trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn extract_all_reference_groups(content: &str) -> Vec<GtdItemReferenceSummary> {
    let groups = [
        ("projects", "projects-references"),
        ("areas", "areas-references"),
        ("goals", "goals-references"),
        ("vision", "vision-references"),
        ("purpose", "purpose-references"),
        ("references", "references"),
    ];
    groups
        .into_iter()
        .filter_map(|(kind, tag)| {
            let paths = extract_reference_list(content, tag);
            if paths.is_empty() {
                None
            } else {
                Some(GtdItemReferenceSummary {
                    kind: kind.to_string(),
                    paths,
                })
            }
        })
        .collect()
}

fn extract_reference_list(content: &str, tag: &str) -> Vec<String> {
    let marker = format!("[!{}:", tag);
    let Some(start) = content.find(&marker) else {
        return Vec::new();
    };
    let remainder = &content[start + marker.len()..];
    let Some(end) = remainder.find(']') else {
        return Vec::new();
    };
    parse_reference_list(&remainder[..end])
}

fn parse_reference_list(raw: &str) -> Vec<String> {
    let decoded = decode_loose(raw.trim());
    if decoded.is_empty() {
        return Vec::new();
    }

    if decoded.starts_with('[') {
        if let Ok(list) = serde_json::from_str::<Vec<String>>(&decoded) {
            return normalize_reference_list(list);
        }
    }

    normalize_reference_list(
        decoded
            .trim_matches(['[', ']'])
            .split(',')
            .map(|value| {
                value
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string()
            })
            .collect(),
    )
}

fn normalize_path_components(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Normal(part) => normalized.push(part),
        }
    }
    normalized
}

fn normalize_reference_list(values: Vec<String>) -> Vec<String> {
    let mut output = values
        .into_iter()
        .map(|value| value.replace('\\', "/"))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    output.sort();
    output.dedup();
    output
}

fn decode_loose(input: &str) -> String {
    let mut current = input.to_string();
    for _ in 0..3 {
        match urlencoding::decode(&current) {
            Ok(decoded) if decoded != current => current = decoded.into_owned(),
            _ => break,
        }
    }
    current
}

fn unix_to_rfc3339(timestamp: u64) -> String {
    let seconds = i64::try_from(timestamp).unwrap_or(i64::MAX);
    DateTime::<Utc>::from_timestamp(seconds, 0)
        .unwrap_or_else(Utc::now)
        .to_rfc3339()
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn hash_file_if_exists(path: &str) -> Result<Option<String>, String> {
    if !Path::new(path).exists() {
        return Ok(None);
    }
    let bytes = fs::read(path).map_err(|error| format!("Failed to read '{}': {}", path, error))?;
    Ok(Some(hash_bytes(&bytes)))
}

fn preview_write(action: &str, path: &str, content: &str) -> String {
    format!(
        "{}\n- path: {}\n- bytes: {}\n\n{}",
        action,
        path,
        content.len(),
        content.lines().take(20).collect::<Vec<_>>().join("\n")
    )
}

fn encode_reference_array(values: &[String]) -> String {
    let normalized = normalize_reference_list(values.to_vec());
    if normalized.is_empty() {
        String::new()
    } else {
        serde_json::to_string(&normalized)
            .map(|json| urlencoding::encode(&json).into_owned())
            .unwrap_or_default()
    }
}

fn encode_reference_csv(values: &[String]) -> String {
    normalize_reference_list(values.to_vec()).join(",")
}

fn project_directory_from_readme(readme_path: &str) -> Result<String, String> {
    let path = Path::new(readme_path);
    let Some(parent) = path.parent() else {
        return Err("Project README path has no parent directory".to_string());
    };
    Ok(normalize_path(parent))
}

fn build_project_markdown(input: ProjectBuildInput) -> String {
    let mut content = generate_project_readme_with_refs(ProjectReadmeParams {
        name: &input.title,
        description: &input.description,
        due_date: input.due_date.clone(),
        status: &input.status,
        areas_refs: &encode_reference_array(&input.areas),
        goals_refs: &encode_reference_array(&input.goals),
        vision_refs: &encode_reference_array(&input.vision),
        purpose_refs: &encode_reference_array(&input.purpose),
        general_refs: &encode_reference_csv(&input.general_references),
    });
    content = replace_datetime_marker(content, "created_date_time", &input.created_date_time);
    if let Some(extra) = input
        .additional_content
        .filter(|value| !value.trim().is_empty())
    {
        content.push('\n');
        content.push_str(extra.trim());
        content.push('\n');
    }
    content
}

fn build_action_markdown(input: ActionBuildInput) -> String {
    let references = encode_reference_csv(&input.general_references);
    let contexts = input
        .contexts
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>()
        .join(",");
    let notes = input.notes.unwrap_or_else(|| {
        "<!-- Add any additional notes or details about this action here -->".to_string()
    });
    format!(
        "# {title}\n\n## Status\n[!singleselect:status:{status}]\n\n## Focus Date\n[!datetime:focus_date:{focus}]\n\n## Due Date\n[!datetime:due_date:{due}]\n\n## Effort\n[!singleselect:effort:{effort}]\n\n## Contexts\n[!multiselect:contexts:{contexts}]\n\n## References\n[!references:{references}]\n\n## Notes\n{notes}\n\n---\n## Created\n[!datetime:created_date_time:{created}]\n",
        title = input.title,
        status = input.status,
        focus = input.focus_date.unwrap_or_default(),
        due = input.due_date.unwrap_or_default(),
        effort = input.effort,
        contexts = contexts,
        references = references,
        notes = notes.trim_end(),
        created = input.created_date_time
    )
}

fn build_habit_markdown(input: HabitBuildInput) -> Result<String, String> {
    let focus_section = if let Some(time) = input.focus_time.as_deref() {
        format!(
            "\n## Focus Date\n[!datetime:focus_date:{}T{}:00]\n",
            Utc::now().format("%Y-%m-%d"),
            time
        )
    } else {
        String::new()
    };
    Ok(format!(
        "# {title}\n\n## Status\n[!checkbox:habit-status:false]\n\n## Frequency\n[!singleselect:habit-frequency:{frequency}]{focus}\
\n## Projects References\n[!projects-references:{projects}]\n\n## Areas References\n[!areas-references:{areas}]\n\n## Goals References\n[!goals-references:{goals}]\n\n## Vision References\n[!vision-references:{vision}]\n\n## Purpose & Principles References\n[!purpose-references:{purpose}]\n\n## Created\n[!datetime:created_date_time:{created}]\n\n## History\n| Date | Action | Source | Details |\n| --- | --- | --- | --- |\n",
        title = input.title,
        frequency = input.frequency,
        focus = focus_section,
        projects = encode_reference_array(&input.projects),
        areas = encode_reference_array(&input.areas),
        goals = encode_reference_array(&input.goals),
        vision = encode_reference_array(&input.vision),
        purpose = encode_reference_array(&input.purpose),
        created = input.created_date_time
    ))
}

fn build_horizon_markdown(
    page_type: &HorizonPageType,
    input: HorizonBuildInput,
) -> Result<String, String> {
    let content = match page_type {
        HorizonPageType::Area => {
            let mut body = generate_area_of_focus_template_with_refs(
                &input.title,
                input
                    .description
                    .as_deref()
                    .unwrap_or("Define the standard for this area."),
                "",
                &encode_reference_array(&input.goals),
                &encode_reference_array(&input.vision),
                &encode_reference_array(&input.purpose),
            );
            body = replace_marker(
                body,
                "[!singleselect:area-status:",
                &input.status.unwrap_or_else(|| "steady".to_string()),
            );
            body = replace_marker(
                body,
                "[!singleselect:area-review-cadence:",
                &input
                    .review_cadence
                    .unwrap_or_else(|| "monthly".to_string()),
            );
            body = replace_reference_marker(body, "projects-references", &input.projects);
            body = replace_reference_marker(body, "areas-references", &input.areas);
            body = replace_reference_marker(body, "references", &input.general_references);
            body
        }
        HorizonPageType::Goal => {
            let mut body = generate_goal_template_with_refs(
                &input.title,
                input.target_date.as_deref(),
                input
                    .description
                    .as_deref()
                    .unwrap_or("Describe the desired outcome for this goal."),
                &encode_reference_array(&input.vision),
                &encode_reference_array(&input.purpose),
            );
            body = replace_marker(
                body,
                "[!singleselect:goal-status:",
                &input.status.unwrap_or_else(|| "in-progress".to_string()),
            );
            body = replace_reference_marker(body, "projects-references", &input.projects);
            body = replace_reference_marker(body, "areas-references", &input.areas);
            body = replace_reference_marker(body, "references", &input.general_references);
            body
        }
        HorizonPageType::Vision => {
            let mut body = generate_vision_document_template_with_refs(&encode_reference_array(
                &input.purpose,
            ));
            body = replace_h1(body, &input.title);
            body = replace_marker(
                body,
                "[!singleselect:vision-horizon:",
                &input.horizon.unwrap_or_else(|| "3-years".to_string()),
            );
            body = replace_reference_marker(body, "projects-references", &input.projects);
            body = replace_reference_marker(body, "goals-references", &input.goals);
            body = replace_reference_marker(body, "areas-references", &input.areas);
            body = replace_reference_marker(body, "references", &input.general_references);
            if let Some(narrative) = input.description {
                body = replace_section_body(body, "Narrative", &narrative);
            }
            body
        }
        HorizonPageType::Purpose => {
            let body = format!(
                "# {}\n\n## Projects References\n[!projects-references:{}]\n\n## Goals References\n[!goals-references:{}]\n\n## Vision References\n[!vision-references:{}]\n{}\n## References (optional)\n[!references:{}]\n\n## Created\n[!datetime:created_date_time:{}]\n\n## Description\n{}\n",
                input.title,
                encode_reference_array(&input.projects),
                encode_reference_array(&input.goals),
                encode_reference_array(&input.vision),
                if input.areas.is_empty() {
                    String::new()
                } else {
                    format!(
                        "## Areas References (optional)\n[!areas-references:{}]\n\n",
                        encode_reference_array(&input.areas)
                    )
                },
                encode_reference_csv(&input.general_references),
                input.created_date_time,
                input
                    .description
                    .unwrap_or_else(|| "Describe your purpose and principles.".to_string())
            );
            body
        }
    };

    let mut content =
        replace_datetime_marker(content, "created_date_time", &input.created_date_time);
    if let Some(trailing) = input
        .trailing_content
        .filter(|value| !value.trim().is_empty())
    {
        if !content.ends_with('\n') {
            content.push('\n');
        }
        content.push('\n');
        content.push_str(trailing.trim());
        content.push('\n');
    }
    Ok(content)
}

fn build_reference_note_markdown(
    title: &str,
    new_body: Option<String>,
    existing_body: Option<String>,
) -> String {
    let body = new_body
        .or(existing_body)
        .unwrap_or_else(|| "<!-- Add note body -->".to_string());
    format!("# {}\n\n{}\n", title.trim(), body.trim_end())
}

fn replace_marker(mut content: String, prefix: &str, value: &str) -> String {
    if let Some(start) = content.find(prefix) {
        let remainder = &content[start + prefix.len()..];
        if let Some(end) = remainder.find(']') {
            let end_index = start + prefix.len() + end;
            content.replace_range(start + prefix.len()..end_index, value);
        }
    }
    content
}

fn replace_reference_marker(content: String, tag: &str, values: &[String]) -> String {
    let encoded = if tag == "references" {
        encode_reference_csv(values)
    } else {
        encode_reference_array(values)
    };
    replace_marker(content, &format!("[!{}:", tag), &encoded)
}

fn replace_datetime_marker(content: String, field: &str, value: &str) -> String {
    replace_marker(content, &format!("[!datetime:{}:", field), value)
}

fn replace_h1(content: String, title: &str) -> String {
    let mut lines = content.lines().map(str::to_string).collect::<Vec<_>>();
    if let Some(first) = lines.iter_mut().find(|line| line.trim().starts_with("# ")) {
        *first = format!("# {}", title.trim());
    } else {
        lines.insert(0, format!("# {}", title.trim()));
    }
    format!("{}\n", lines.join("\n"))
}

fn replace_section_body(content: String, heading: &str, new_body: &str) -> String {
    let mut output = Vec::new();
    let mut active = false;
    let mut replaced = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.eq_ignore_ascii_case(&format!("## {}", heading)) {
            active = true;
            replaced = true;
            output.push(line.to_string());
            output.push(new_body.trim_end().to_string());
            continue;
        }
        if active && trimmed.starts_with("## ") {
            active = false;
        }
        if !active {
            output.push(line.to_string());
        }
    }
    if !replaced {
        output.push(String::new());
        output.push(format!("## {}", heading));
        output.push(new_body.trim_end().to_string());
    }
    format!("{}\n", output.join("\n"))
}

fn parse_project_update_seed(content: &str, item: &GtdItemSummary) -> ProjectUpdateSeed {
    ProjectUpdateSeed {
        title: item.title.clone(),
        description: item.description.clone(),
        due_date: item.due_date.clone(),
        status: item
            .status
            .clone()
            .unwrap_or_else(|| "in-progress".to_string()),
        areas: extract_reference_list(content, "areas-references"),
        goals: extract_reference_list(content, "goals-references"),
        vision: extract_reference_list(content, "vision-references"),
        purpose: extract_reference_list(content, "purpose-references"),
        general_references: extract_reference_list(content, "references"),
        created_date_time: item
            .created_date_time
            .clone()
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
        additional_content: extract_tail_after(content, "[!habits-list]"),
    }
}

fn parse_action_update_seed(content: &str, item: &GtdItemSummary) -> ActionUpdateSeed {
    ActionUpdateSeed {
        title: item.title.clone(),
        status: item
            .status
            .clone()
            .unwrap_or_else(|| "in-progress".to_string()),
        focus_date: item.focus_date.clone(),
        due_date: item.due_date.clone(),
        effort: item.effort.clone().unwrap_or_else(|| "medium".to_string()),
        contexts: extract_multiselect(content, "contexts"),
        general_references: extract_reference_list(content, "references"),
        notes: extract_section_body(content, "Notes"),
        created_date_time: item
            .created_date_time
            .clone()
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
    }
}

fn parse_horizon_update_seed(
    page_type: &HorizonPageType,
    content: &str,
    item: &GtdItemSummary,
) -> HorizonUpdateSeed {
    let trailing_heading = match page_type {
        HorizonPageType::Area | HorizonPageType::Goal | HorizonPageType::Purpose => "Description",
        HorizonPageType::Vision => "Narrative",
    };
    HorizonUpdateSeed {
        title: item.title.clone(),
        status: item.status.clone(),
        review_cadence: item.review_cadence.clone(),
        target_date: item.target_date.clone(),
        horizon: item.horizon.clone(),
        description: item.description.clone(),
        projects: extract_reference_list(content, "projects-references"),
        areas: extract_reference_list(content, "areas-references"),
        goals: extract_reference_list(content, "goals-references"),
        vision: extract_reference_list(content, "vision-references"),
        purpose: extract_reference_list(content, "purpose-references"),
        general_references: extract_reference_list(content, "references"),
        created_date_time: item
            .created_date_time
            .clone()
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
        trailing_content: extract_additional_after_section(content, trailing_heading),
    }
}

fn extract_tail_after(content: &str, marker: &str) -> Option<String> {
    let start = content.find(marker)?;
    let tail = &content[start + marker.len()..];
    let value = tail.trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn extract_additional_after_section(content: &str, heading: &str) -> Option<String> {
    let marker = format!("## {}", heading);
    let start = content.find(&marker)?;
    let tail = &content[start..];
    let rest = tail.split_once('\n')?.1;
    let value = rest.trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn parse_reference_note(content: &str) -> (String, String) {
    let title = extract_h1(content).unwrap_or_else(|| "Untitled Note".to_string());
    let body = content
        .lines()
        .skip_while(|line| !line.trim().starts_with("# "))
        .skip(1)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();
    (title, body)
}

fn horizon_folder_name(page_type: &HorizonPageType) -> &'static str {
    match page_type {
        HorizonPageType::Area => "Areas of Focus",
        HorizonPageType::Goal => "Goals",
        HorizonPageType::Vision => "Vision",
        HorizonPageType::Purpose => "Purpose & Principles",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{seed_test_workspace, write_test_file};
    use std::fs;

    #[test]
    fn parses_reference_lists_from_json_and_csv() {
        assert_eq!(
            parse_reference_list("%5B%22Goals%2FFitness.md%22%2C%22Goals%2FHealth.md%22%5D"),
            vec![
                "Goals/Fitness.md".to_string(),
                "Goals/Health.md".to_string()
            ]
        );
        assert_eq!(
            parse_reference_list("Cabinet/Ref.md, Someday Maybe/Idea.md"),
            vec![
                "Cabinet/Ref.md".to_string(),
                "Someday Maybe/Idea.md".to_string()
            ]
        );
    }

    #[test]
    fn fingerprint_changes_when_file_metadata_changes() {
        let root = Path::new("/tmp/workspace");
        let before = build_fingerprint(
            root,
            &[MarkdownFile {
                id: "one".to_string(),
                name: "One.md".to_string(),
                path: "/tmp/workspace/One.md".to_string(),
                size: 10,
                last_modified: 10,
                extension: ".md".to_string(),
            }],
        );
        let after = build_fingerprint(
            root,
            &[MarkdownFile {
                id: "one".to_string(),
                name: "One.md".to_string(),
                path: "/tmp/workspace/One.md".to_string(),
                size: 10,
                last_modified: 11,
                extension: ".md".to_string(),
            }],
        );
        assert_ne!(before.aggregate_digest, after.aggregate_digest);
    }

    #[test]
    fn context_pack_markdown_contains_workspace_and_items() {
        let pack = ContextPack {
            version: 1,
            generated_at: "2026-01-01T00:00:00Z".to_string(),
            workspace_root: "/tmp/workspace".to_string(),
            fingerprint: WorkspaceFingerprint {
                normalized_root_path: "/tmp/workspace".to_string(),
                latest_modified_unix: 0,
                markdown_file_count: 1,
                aggregate_digest: "abc".to_string(),
            },
            top_level_folders: vec![],
            marker_glossary: vec![],
            item_counts: BTreeMap::from([(String::from("project"), 1)]),
            items: vec![GtdItemSummary {
                relative_path: "Projects/Test/README.md".to_string(),
                absolute_path: "/tmp/workspace/Projects/Test/README.md".to_string(),
                item_type: GtdItemType::Project,
                title: "Test".to_string(),
                status: Some("in-progress".to_string()),
                due_date: None,
                focus_date: None,
                target_date: None,
                horizon: None,
                review_cadence: None,
                frequency: None,
                effort: None,
                created_date_time: None,
                parent_project_path: None,
                description: None,
                references: vec![],
            }],
            operation_guidance: vec!["Use semantic tools".to_string()],
        };
        let markdown = build_context_pack_markdown(&pack);
        assert!(markdown.contains("GTD Space Context Pack"));
        assert!(markdown.contains("/tmp/workspace"));
        assert!(markdown.contains("Projects/Test/README.md"));
    }

    #[test]
    fn context_pack_cache_reuses_and_regenerates_when_fingerprint_changes() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let workspace_root = workspace.path().to_string_lossy().to_string();

        let service = GtdWorkspaceService::new(Some(workspace_root.clone()), false)?;
        let first = service.workspace_context_pack()?;
        assert_eq!(first.source, "generated");

        let second_service = GtdWorkspaceService::new(Some(workspace_root.clone()), false)?;
        let second = second_service.workspace_context_pack()?;
        assert_eq!(second.source, "cache");

        write_test_file(
            workspace.path().join("Cabinet/External Note.md"),
            "# External Note\n\nCreated outside MCP.\n",
        )?;

        let third_service = GtdWorkspaceService::new(Some(workspace_root), false)?;
        let third = third_service.workspace_context_pack()?;
        assert_eq!(third.source, "generated");
        Ok(())
    }

    #[test]
    fn workspace_refresh_invalidates_pending_change_sets() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let planned = service.plan_reference_note_create(ReferenceNoteCreateRequest {
            section: ReferenceNoteSection::Cabinet,
            title: "Inbox Reference".to_string(),
            body: Some("Useful note.".to_string()),
        })?;

        let refreshed = service.workspace_refresh()?;
        assert_eq!(refreshed.invalidated_change_sets, 1);

        let error = service
            .change_apply(ChangeSetRequest {
                change_set_id: planned.change_set.id,
            })
            .unwrap_err();
        assert!(error.contains("Unknown change set"));
        Ok(())
    }

    #[test]
    fn change_apply_fails_if_file_changed_after_planning() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let planned = service.plan_project_update(ProjectUpdateRequest {
            path: "Projects/Alpha Project/README.md".to_string(),
            title: Some("Alpha Project Updated".to_string()),
            description: None,
            due_date: None,
            status: None,
            areas: vec![],
            goals: vec![],
            vision: vec![],
            purpose: vec![],
            general_references: vec![],
        })?;

        let alpha_readme = workspace.path().join("Projects/Alpha Project/README.md");
        let existing = fs::read_to_string(&alpha_readme).map_err(|error| error.to_string())?;
        fs::write(&alpha_readme, format!("{existing}\nConcurrent edit.\n"))
            .map_err(|error| error.to_string())?;

        let error = service
            .change_apply(ChangeSetRequest {
                change_set_id: planned.change_set.id,
            })
            .unwrap_err();
        assert!(error.contains("changed since planning"));
        Ok(())
    }

    #[test]
    fn resolve_workspace_file_rejects_parent_traversal_for_missing_paths() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let error = service
            .resolve_workspace_file("Projects/../../outside.md")
            .unwrap_err();
        assert!(error.contains("inside the GTD workspace"));
        Ok(())
    }

    #[test]
    fn change_apply_reports_refresh_after_apply_failure() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let planned = service.plan_reference_note_create(ReferenceNoteCreateRequest {
            section: ReferenceNoteSection::Cabinet,
            title: "Broken Apply".to_string(),
            body: Some("This should fail during apply.".to_string()),
        })?;

        let cabinet_path = workspace.path().join("Cabinet");
        fs::remove_dir_all(&cabinet_path).map_err(|error| error.to_string())?;
        fs::write(&cabinet_path, "not a directory").map_err(|error| error.to_string())?;

        let error = service
            .change_apply(ChangeSetRequest {
                change_set_id: planned.change_set.id,
            })
            .unwrap_err();
        assert!(error.contains("workspace_refresh"));
        Ok(())
    }
}
