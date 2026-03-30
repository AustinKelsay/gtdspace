use std::collections::{BTreeMap, HashMap, VecDeque};
use std::env;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, Timelike, Utc};
use directories::ProjectDirs;
use rmcp::schemars;
use rmcp::schemars::transform::RecursiveTransform;
use rmcp::schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use strsim::jaro_winkler;
use uuid::Uuid;

use crate::commands::filesystem::{
    create_directory, list_markdown_files, read_file, save_file, MarkdownFile,
};
use crate::commands::gtd_habits::update_habit_status;
use crate::commands::gtd_habits_domain::{
    apply_status_marker, format_history_entry, format_history_time, insert_history_entry,
    parse_habit_state, parse_history_rows_strict, parse_history_timestamp, HabitStatus,
    DEFAULT_HISTORY_TEMPLATE,
};
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
const MAX_CHANGE_SET_TOMBSTONES: usize = 256;
const DEFAULT_MCP_SERVER_LOG_LEVEL: &str = "info";
const VALID_MCP_SERVER_LOG_LEVELS: [&str; 5] = ["error", "warn", "info", "debug", "trace"];

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
#[schemars(transform = RecursiveTransform(remove_unsupported_integer_formats))]
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
#[schemars(transform = RecursiveTransform(remove_unsupported_integer_formats))]
pub struct WorkspaceInfo {
    #[serde(default = "default_server_version")]
    pub server_version: String,
    pub workspace_root: String,
    pub read_only: bool,
    pub item_counts: BTreeMap<String, usize>,
    pub fingerprint: WorkspaceFingerprint,
    pub context_pack_cache: ContextPackCache,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpServerLaunchSettings {
    pub read_only: bool,
    pub log_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[schemars(transform = RecursiveTransform(remove_unsupported_integer_formats))]
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
#[schemars(transform = RecursiveTransform(remove_unsupported_integer_formats))]
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
    #[serde(default = "default_server_version")]
    pub server_version: String,
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
    #[serde(default)]
    pub replayed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceListItemsRequest {
    pub item_type: Option<GtdItemType>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(transform = RecursiveTransform(remove_unsupported_integer_formats))]
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
    /// Workspace-relative path to an existing GTD project directory or project README.
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
#[serde(rename_all = "camelCase")]
pub struct HabitHistoryRow {
    pub date: String,
    pub time: String,
    pub status: String,
    pub action: String,
    pub details: String,
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct HabitHistoryResult {
    pub relative_path: String,
    pub title: String,
    pub current_status: Option<String>,
    pub frequency: Option<String>,
    pub rows: Vec<HabitHistoryRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct HabitWriteHistoryEntryRequest {
    pub path: String,
    pub status: String,
    pub action: String,
    pub details: Option<String>,
    pub date: Option<String>,
    pub time: Option<String>,
    pub update_current_status: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HabitHistoryRowInput {
    pub date: String,
    pub time: String,
    pub status: String,
    pub action: String,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct HabitReplaceHistoryRequest {
    pub path: String,
    pub rows: Vec<HabitHistoryRowInput>,
    pub update_current_status_from_latest: Option<bool>,
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
    WriteHabitHistoryEntry {
        path: String,
        entry: String,
        new_status: Option<String>,
        expected_sha256: Option<String>,
    },
    ReplaceHabitHistory {
        path: String,
        content: String,
        expected_sha256: Option<String>,
    },
}

#[derive(Debug, Clone)]
struct StoredChangeSet {
    public: ChangeSet,
    operations: Vec<ChangeOperation>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TerminalChangeSetState {
    Applied,
    Discarded,
    Invalidated,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TerminalChangeSetReason {
    Applied,
    Discarded,
    InvalidatedByRefresh,
    InvalidatedByRevalidation,
    ApplyFailed,
}

#[derive(Debug, Clone)]
struct StoredChangeSetTombstone {
    summary: ChangeSetSummary,
    state: TerminalChangeSetState,
    reason: TerminalChangeSetReason,
    apply_result: Option<ChangeApplyResult>,
    message: Option<String>,
}

#[derive(Debug, Default)]
struct ServiceState {
    snapshot: Option<WorkspaceSnapshot>,
    context_pack: Option<CachedContextPack>,
    change_sets: HashMap<String, StoredChangeSet>,
    change_set_tombstones: HashMap<String, StoredChangeSetTombstone>,
    change_set_tombstone_order: VecDeque<String>,
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
            server_version: default_server_version(),
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
            let pending = std::mem::take(&mut state.change_sets);
            let count = pending.len();
            for (id, change) in pending {
                let message = format!(
                    "Change set '{}' was invalidated by workspace_refresh and can no longer be applied. Create a fresh plan before applying.",
                    id
                );
                Self::record_change_set_tombstone(
                    &mut state,
                    id,
                    StoredChangeSetTombstone {
                        summary: Self::change_set_summary(
                            &change.public,
                            ChangeStatus::Invalidated,
                        ),
                        state: TerminalChangeSetState::Invalidated,
                        reason: TerminalChangeSetReason::InvalidatedByRefresh,
                        apply_result: None,
                        message: Some(message),
                    },
                );
            }
            state.snapshot = None;
            state.context_pack = None;
            count
        };
        let snapshot = self.ensure_snapshot(true)?;
        let cache = self.ensure_context_pack(true)?;
        Ok(WorkspaceRefreshResult {
            workspace_info: WorkspaceInfo {
                server_version: default_server_version(),
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

    pub fn get_habit_history(&self, path: &str) -> Result<HabitHistoryResult, String> {
        let item = self.get_item(path)?;
        if item.item_type != GtdItemType::Habit {
            return Err("habit_get_history requires a habit path".to_string());
        }

        let content = self.read_markdown(&item.relative_path)?;
        let rows = parse_history_rows_strict(&content)
            .map_err(|error| {
                format!(
                    "Failed to parse habit history for '{}': {}",
                    item.relative_path, error
                )
            })?
            .into_iter()
            .map(|row| HabitHistoryRow {
                date: row.date,
                time: row.time,
                status: row.status,
                action: row.action,
                details: row.details,
                timestamp: Some(row.timestamp.format("%Y-%m-%dT%H:%M:%S").to_string()),
            })
            .collect();

        Ok(HabitHistoryResult {
            relative_path: item.relative_path,
            title: item.title,
            current_status: item.status,
            frequency: item.frequency,
            rows,
        })
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
        let project_dir = self.resolve_existing_project_directory(&request.project_path)?;
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

    pub fn plan_habit_write_history_entry(
        &self,
        request: HabitWriteHistoryEntryRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let item = self.get_item(&request.path)?;
        if item.item_type != GtdItemType::Habit {
            return Err("habit_write_history_entry requires a habit path".to_string());
        }

        let action = request.action.trim();
        if action.is_empty() {
            return Err("Habit history action cannot be empty".to_string());
        }

        let status = HabitStatus::from_input(&request.status)?;
        let timestamp =
            resolve_history_entry_timestamp(request.date.as_deref(), request.time.as_deref())?;
        let details = request.details.unwrap_or_default();
        let entry = format_history_entry(timestamp, status, action, &details);
        let current = self.read_markdown(&item.relative_path)?;
        let update_current_status = request.update_current_status.unwrap_or(false);
        let new_status = if update_current_status {
            Some(status.marker_token().to_string())
        } else {
            None
        };

        self.store_change_set(
            "habit_write_history_entry",
            format!("Append history entry to habit '{}'", item.title),
            vec![item.relative_path.clone()],
            format!(
                "Append habit history entry\n- path: {}\n- date: {}\n- time: {}\n- status: {}\n- action: {}",
                item.relative_path,
                timestamp.format("%Y-%m-%d"),
                format_history_time(timestamp),
                status.history_label(),
                action
            ),
            vec![ChangeOperation::WriteHabitHistoryEntry {
                path: item.absolute_path.clone(),
                entry,
                new_status,
                expected_sha256: Some(hash_bytes(current.as_bytes())),
            }],
        )
    }

    pub fn plan_habit_replace_history(
        &self,
        request: HabitReplaceHistoryRequest,
    ) -> Result<PlannedChange, String> {
        self.reject_if_read_only()?;
        let item = self.get_item(&request.path)?;
        if item.item_type != GtdItemType::Habit {
            return Err("habit_replace_history requires a habit path".to_string());
        }

        let current = self.read_markdown(&item.relative_path)?;
        let rows = normalize_replacement_history_rows(request.rows)?;
        let update_current_status = request.update_current_status_from_latest.unwrap_or(false);
        let content = replace_habit_history_content(&current, &rows, update_current_status)?;

        self.store_change_set(
            "habit_replace_history",
            format!("Replace history for habit '{}'", item.title),
            vec![item.relative_path.clone()],
            format!(
                "Replace habit history\n- path: {}\n- rows: {}\n- update current status from latest: {}",
                item.relative_path,
                rows.len(),
                update_current_status
            ),
            vec![ChangeOperation::ReplaceHabitHistory {
                path: item.absolute_path.clone(),
                content,
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
            if let Some(stored) = state.change_sets.get(&change_set_id).cloned() {
                stored
            } else if let Some(tombstone) = Self::lookup_terminal_change_set(&state, &change_set_id)
            {
                if tombstone.state == TerminalChangeSetState::Applied {
                    if let Some(result) = Self::replayed_change_apply_result(&tombstone) {
                        return Ok(result);
                    }
                }
                return Err(Self::terminal_change_set_apply_error(&tombstone));
            } else {
                return Err(Self::unknown_change_set_message(&change_set_id));
            }
        };

        for op in &stored.operations {
            if let Err(error) = self.revalidate_operation(op) {
                let message = format!(
                    "Change set '{}' is no longer valid because workspace files changed since planning: {} Create a fresh plan before applying.",
                    change_set_id, error
                );
                let mut state = self
                    .state
                    .lock()
                    .map_err(|_| "Failed to lock workspace state".to_string())?;
                state.change_sets.remove(&change_set_id);
                Self::record_change_set_tombstone(
                    &mut state,
                    change_set_id.clone(),
                    StoredChangeSetTombstone {
                        summary: Self::change_set_summary(
                            &stored.public,
                            ChangeStatus::Invalidated,
                        ),
                        state: TerminalChangeSetState::Invalidated,
                        reason: TerminalChangeSetReason::InvalidatedByRevalidation,
                        apply_result: None,
                        message: Some(message.clone()),
                    },
                );
                state.snapshot = None;
                state.context_pack = None;
                return Err(message);
            }
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
                ChangeOperation::WriteHabitHistoryEntry {
                    path,
                    entry,
                    new_status,
                    ..
                } => apply_habit_history_entry(path, entry, new_status.as_deref()),
                ChangeOperation::ReplaceHabitHistory { path, content, .. } => {
                    save_file(path.clone(), content.clone()).map(|_| ())
                }
            };

            if let Err(error) = apply_result {
                let retry_message = format!(
                    "Change set '{}' previously failed during apply: {} Workspace state may be partially updated; run workspace_refresh before continuing and create a new plan.",
                    change_set_id, error
                );
                let mut state = self
                    .state
                    .lock()
                    .map_err(|_| "Failed to lock workspace state".to_string())?;
                state.change_sets.remove(&change_set_id);
                Self::record_change_set_tombstone(
                    &mut state,
                    change_set_id.clone(),
                    StoredChangeSetTombstone {
                        summary: Self::change_set_summary(
                            &stored.public,
                            ChangeStatus::Invalidated,
                        ),
                        state: TerminalChangeSetState::Failed,
                        reason: TerminalChangeSetReason::ApplyFailed,
                        apply_result: None,
                        message: Some(retry_message),
                    },
                );
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
        let result = ChangeApplyResult {
            change_set: Self::change_set_summary(&stored.public, ChangeStatus::Applied),
            workspace_info: info,
            replayed: false,
        };
        {
            let mut state = self
                .state
                .lock()
                .map_err(|_| "Failed to lock workspace state".to_string())?;
            Self::record_change_set_tombstone(
                &mut state,
                change_set_id,
                StoredChangeSetTombstone {
                    summary: result.change_set.clone(),
                    state: TerminalChangeSetState::Applied,
                    reason: TerminalChangeSetReason::Applied,
                    apply_result: Some(result.clone()),
                    message: None,
                },
            );
        }
        Ok(result)
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
        let summary = ChangeSetSummary {
            id: change.public.id,
            tool_name: change.public.tool_name,
            summary: change.public.summary,
            status: change.public.status,
            affected_paths: change.public.affected_paths,
            preview: change.public.preview,
        };
        Self::record_change_set_tombstone(
            &mut state,
            request.change_set_id,
            StoredChangeSetTombstone {
                summary: summary.clone(),
                state: TerminalChangeSetState::Discarded,
                reason: TerminalChangeSetReason::Discarded,
                apply_result: None,
                message: Some(format!(
                    "Change set '{}' was discarded and can no longer be applied. Create a fresh plan if you still want to make this change.",
                    summary.id
                )),
            },
        );
        Ok(summary)
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
        let parent_check = {
            let mut current = normalized_absolute.as_path();
            let mut deepest_existing = None;

            while let Some(parent) = current.parent() {
                if parent.exists() {
                    deepest_existing = Some(parent);
                    break;
                }
                current = parent;
            }

            deepest_existing
                .map(|ancestor| {
                    let canonicalized_deepest_existing =
                        fs::canonicalize(ancestor).unwrap_or_else(|_| ancestor.to_path_buf());
                    path_is_within_workspace(&canonicalized_deepest_existing, &canonical_root)
                })
                .unwrap_or(false)
        };
        if normalized_absolute.exists() {
            if !path_is_within_workspace(&normalized_absolute, &canonical_root) {
                return Err("Path must stay inside the GTD workspace".to_string());
            }
        } else if !parent_check {
            return Err("Path must stay inside the GTD workspace".to_string());
        }
        Ok(normalize_path(&absolute))
    }

    fn resolve_existing_project_directory(&self, project_path: &str) -> Result<PathBuf, String> {
        let absolute = PathBuf::from(self.resolve_workspace_file(project_path)?);
        let normalized_input = normalize_relative_input(project_path);

        if absolute.is_file() {
            let absolute_path = normalize_path(&absolute);
            let relative_path =
                normalize_absolute_to_relative(&self.workspace_root, &absolute_path);
            let item = self.get_item(&relative_path)?;
            if item.item_type != GtdItemType::Project {
                return Err(format!(
                    "action_create requires a GTD project path, got {}",
                    item.relative_path
                ));
            }
            return absolute.parent().map(Path::to_path_buf).ok_or_else(|| {
                format!(
                    "Project README path has no parent directory: {}",
                    relative_path
                )
            });
        }

        if absolute.is_dir() {
            let Some(readme_path) = resolve_project_readme_in_directory(&absolute) else {
                return Err(self.project_not_found_message(&normalized_input));
            };
            let readme_path = normalize_path(&readme_path);
            let relative_path = normalize_absolute_to_relative(&self.workspace_root, &readme_path);
            let item = self.get_item(&relative_path)?;
            if item.item_type != GtdItemType::Project {
                return Err(format!(
                    "action_create requires a GTD project path, got {}",
                    item.relative_path
                ));
            }
            return Ok(absolute);
        }

        Err(self.project_not_found_message(&normalized_input))
    }

    fn project_not_found_message(&self, project_path: &str) -> String {
        let mut message = format!(
            "Project not found: {}. Use workspace_list_items({{\"itemType\":\"project\"}}) and pass a returned project relative path or README path.",
            project_path
        );
        let suggestions = self.suggest_project_paths(project_path).unwrap_or_default();
        if !suggestions.is_empty() {
            message.push_str(" Closest matches: ");
            message.push_str(&suggestions.join(", "));
        }
        message
    }

    fn suggest_project_paths(&self, project_path: &str) -> Result<Vec<String>, String> {
        let normalized_input = normalize_similarity_key(project_path);
        if normalized_input.is_empty() {
            return Ok(Vec::new());
        }

        let snapshot = self.ensure_snapshot(false)?;
        let mut scored = snapshot
            .items
            .iter()
            .filter(|item| item.item_type == GtdItemType::Project)
            .filter_map(|item| {
                let score = project_similarity_keys(item)
                    .into_iter()
                    .map(|candidate| jaro_winkler(&normalized_input, &candidate))
                    .fold(0.0, f64::max);
                (score >= 0.84).then(|| (item.relative_path.clone(), score))
            })
            .collect::<Vec<_>>();

        scored.sort_by(|left, right| {
            right
                .1
                .partial_cmp(&left.1)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| left.0.cmp(&right.0))
        });
        scored.dedup_by(|left, right| left.0 == right.0);

        Ok(scored.into_iter().take(3).map(|(path, _)| path).collect())
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
            ChangeOperation::WriteHabitHistoryEntry {
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
            ChangeOperation::ReplaceHabitHistory {
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

    fn change_set_summary(change_set: &ChangeSet, status: ChangeStatus) -> ChangeSetSummary {
        ChangeSetSummary {
            id: change_set.id.clone(),
            tool_name: change_set.tool_name.clone(),
            summary: change_set.summary.clone(),
            status,
            affected_paths: change_set.affected_paths.clone(),
            preview: change_set.preview.clone(),
        }
    }

    fn record_change_set_tombstone(
        state: &mut ServiceState,
        id: String,
        tombstone: StoredChangeSetTombstone,
    ) {
        if state.change_set_tombstones.contains_key(&id) {
            state.change_set_tombstone_order = state
                .change_set_tombstone_order
                .drain(..)
                .filter(|existing| existing != &id)
                .collect::<VecDeque<_>>();
        }

        state.change_set_tombstones.insert(id.clone(), tombstone);
        state.change_set_tombstone_order.push_back(id);

        while state.change_set_tombstone_order.len() > MAX_CHANGE_SET_TOMBSTONES {
            if let Some(oldest) = state.change_set_tombstone_order.pop_front() {
                state.change_set_tombstones.remove(&oldest);
            }
        }
    }

    fn lookup_terminal_change_set(
        state: &ServiceState,
        change_set_id: &str,
    ) -> Option<StoredChangeSetTombstone> {
        state.change_set_tombstones.get(change_set_id).cloned()
    }

    fn replayed_change_apply_result(
        tombstone: &StoredChangeSetTombstone,
    ) -> Option<ChangeApplyResult> {
        tombstone.apply_result.clone().map(|mut result| {
            result.replayed = true;
            result
        })
    }

    fn unknown_change_set_message(change_set_id: &str) -> String {
        format!(
            "Unknown change set '{}'. It may belong to a different MCP server session, may have expired after restart, or may never have been created.",
            change_set_id
        )
    }

    fn terminal_change_set_apply_error(tombstone: &StoredChangeSetTombstone) -> String {
        if let Some(message) = tombstone.message.as_deref() {
            return message.to_string();
        }

        match (tombstone.state, tombstone.reason) {
            (TerminalChangeSetState::Applied, TerminalChangeSetReason::Applied) => format!(
                "Change set '{}' was already applied in this MCP server session.",
                tombstone.summary.id
            ),
            (TerminalChangeSetState::Discarded, TerminalChangeSetReason::Discarded) => format!(
                "Change set '{}' was discarded and can no longer be applied. Create a fresh plan if you still want to make this change.",
                tombstone.summary.id
            ),
            (
                TerminalChangeSetState::Invalidated,
                TerminalChangeSetReason::InvalidatedByRefresh,
            ) => format!(
                "Change set '{}' was invalidated by workspace_refresh and can no longer be applied. Create a fresh plan before applying.",
                tombstone.summary.id
            ),
            (
                TerminalChangeSetState::Invalidated,
                TerminalChangeSetReason::InvalidatedByRevalidation,
            ) => format!(
                "Change set '{}' is no longer valid because workspace files changed since planning. Create a fresh plan before applying.",
                tombstone.summary.id
            ),
            (TerminalChangeSetState::Failed, TerminalChangeSetReason::ApplyFailed) => format!(
                "Change set '{}' previously failed during apply. Workspace state may be partially updated; run workspace_refresh before continuing and create a new plan.",
                tombstone.summary.id
            ),
            _ => format!(
                "Change set '{}' is no longer pending and can no longer be applied.",
                tombstone.summary.id
            ),
        }
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

fn resolve_history_entry_timestamp(
    date: Option<&str>,
    time: Option<&str>,
) -> Result<NaiveDateTime, String> {
    let now = Local::now().naive_local();
    match (date.map(str::trim), time.map(str::trim)) {
        (None, None) => Ok(now),
        (Some(date), None) => {
            let parsed_date = NaiveDate::parse_from_str(date, "%Y-%m-%d")
                .map_err(|_| format!("Invalid history date '{}'. Expected YYYY-MM-DD", date))?;
            parsed_date
                .and_hms_opt(now.hour(), now.minute(), 0)
                .ok_or_else(|| "Invalid history timestamp".to_string())
        }
        (None, Some(_)) => Err("History time requires a date".to_string()),
        (Some(date), Some(time)) => parse_history_timestamp(date, time).ok_or_else(|| {
            format!(
                "Invalid history date/time '{} {}'. Expected YYYY-MM-DD with either HH:MM or h:MM AM/PM",
                date, time
            )
        }),
    }
}

fn apply_habit_history_entry(
    path: &str,
    entry: &str,
    new_status: Option<&str>,
) -> Result<(), String> {
    let content = read_file(path.to_string())?;
    let updated = if let Some(status) = new_status {
        let parsed = parse_habit_state(&content)?;
        let next_status = HabitStatus::from_input(status)?;
        let with_status = apply_status_marker(&content, next_status, parsed.status_format);
        insert_history_entry(&with_status, entry)?
    } else {
        insert_history_entry(&content, entry)?
    };

    save_file(path.to_string(), updated).map(|_| ())
}

fn normalize_replacement_history_rows(
    rows: Vec<HabitHistoryRowInput>,
) -> Result<Vec<(NaiveDateTime, HabitStatus, String, String)>, String> {
    let mut normalized = rows
        .into_iter()
        .enumerate()
        .map(|(index, row)| {
            let action = row.action.trim().to_string();
            if action.is_empty() {
                return Err(format!("History row {} action cannot be empty", index + 1));
            }

            let timestamp = parse_history_timestamp(row.date.trim(), row.time.trim()).ok_or_else(|| {
                format!(
                    "Invalid history row {} date/time '{} {}'. Expected YYYY-MM-DD with either HH:MM or h:MM AM/PM",
                    index + 1,
                    row.date,
                    row.time
                )
            })?;
            let status = HabitStatus::from_input(&row.status)?;
            Ok((
                timestamp,
                status,
                action,
                row.details.unwrap_or_default(),
            ))
        })
        .collect::<Result<Vec<_>, String>>()?;

    normalized.sort_by_key(|(timestamp, status, action, details)| {
        (
            *timestamp,
            status.marker_token().to_string(),
            action.clone(),
            details.clone(),
        )
    });

    Ok(normalized)
}

fn render_canonical_history_table(rows: &[(NaiveDateTime, HabitStatus, String, String)]) -> String {
    let mut lines = vec![
        "## History".to_string(),
        "*Track your habit completions below:*".to_string(),
        String::new(),
        "| Date | Time | Status | Action | Details |".to_string(),
        "|------|------|--------|--------|---------|".to_string(),
    ];

    lines.extend(rows.iter().map(|(timestamp, status, action, details)| {
        format_history_entry(*timestamp, *status, action, details)
    }));

    lines.join("\n")
}

fn replace_habit_history_content(
    current: &str,
    rows: &[(NaiveDateTime, HabitStatus, String, String)],
    update_current_status_from_latest: bool,
) -> Result<String, String> {
    let canonical_history = render_canonical_history_table(rows);
    let mut updated = replace_or_append_history_section(current, &canonical_history);

    if update_current_status_from_latest {
        if let Some((_, latest_status, _, _)) = rows.last() {
            let parsed = parse_habit_state(&updated)?;
            updated = apply_status_marker(&updated, *latest_status, parsed.status_format);
        }
    }

    Ok(updated)
}

fn replace_or_append_history_section(content: &str, history_section: &str) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let history_heading_idx = lines
        .iter()
        .position(|line| line.trim().eq_ignore_ascii_case("## history"));

    match history_heading_idx {
        Some(start) => {
            let mut end = lines.len();
            for (index, line) in lines.iter().enumerate().skip(start + 1) {
                if line.trim_start().starts_with("## ") {
                    end = index;
                    break;
                }
            }

            let prefix = lines[..start].join("\n").trim_end().to_string();
            let suffix = lines[end..].join("\n").trim_start().to_string();

            match (prefix.is_empty(), suffix.is_empty()) {
                (true, true) => history_section.to_string(),
                (true, false) => format!("{history_section}\n\n{suffix}"),
                (false, true) => format!("{prefix}\n\n{history_section}"),
                (false, false) => format!("{prefix}\n\n{history_section}\n\n{suffix}"),
            }
        }
        None => format!("{}\n\n{}", content.trim_end(), history_section),
    }
}

fn default_search_limit() -> usize {
    20
}

fn remove_unsupported_integer_formats(schema: &mut schemars::Schema) {
    if let Some(object) = schema.as_object_mut() {
        let should_remove = object
            .get("format")
            .and_then(Value::as_str)
            .map(|format| format.starts_with("uint"))
            .unwrap_or(false);

        if should_remove {
            object.remove("format");
        }
    }
}

fn resolve_workspace(cli_workspace: Option<String>) -> Result<PathBuf, String> {
    if let Some(path) = cli_workspace {
        return validate_workspace_candidate(Path::new(&path));
    }

    if let Some(settings) = load_saved_user_settings() {
        if let Some(candidate) = settings.mcp_server_workspace_path {
            return validate_workspace_candidate(Path::new(&candidate));
        }

        for candidate in [settings.last_folder, settings.default_space_path]
            .into_iter()
            .flatten()
        {
            if let Ok(path) = validate_workspace_candidate(Path::new(&candidate)) {
                return Ok(path);
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
    #[cfg(target_os = "windows")]
    if let Ok(appdata) = env::var("APPDATA") {
        return Some(
            PathBuf::from(appdata)
                .join("com.gtdspace.app")
                .join("config")
                .join(SETTINGS_FILE_NAME),
        );
    }

    #[cfg(target_os = "linux")]
    if let Ok(config_home) = env::var("XDG_CONFIG_HOME") {
        return Some(
            PathBuf::from(config_home)
                .join("com.gtdspace.app")
                .join(SETTINGS_FILE_NAME),
        );
    }

    #[cfg(target_os = "macos")]
    if let Ok(home) = env::var("HOME") {
        return Some(
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("com.gtdspace.app")
                .join(SETTINGS_FILE_NAME),
        );
    }

    project_dirs()
        .ok()
        .map(|dirs| dirs.config_dir().join(SETTINGS_FILE_NAME))
}

fn load_saved_settings() -> Option<Value> {
    let settings_path = settings_file_path()?;
    let contents = fs::read_to_string(settings_path).ok()?;
    serde_json::from_str::<Value>(&contents).ok()
}

fn load_saved_user_settings() -> Option<crate::commands::settings::UserSettings> {
    let settings = load_saved_settings()?;
    let user_settings = settings.get("user_settings")?;
    crate::commands::settings::parse_user_settings_value(user_settings).ok()
}

fn sanitize_mcp_server_log_level(value: Option<&str>) -> String {
    let normalized = value
        .unwrap_or(DEFAULT_MCP_SERVER_LOG_LEVEL)
        .trim()
        .to_ascii_lowercase();
    if VALID_MCP_SERVER_LOG_LEVELS.contains(&normalized.as_str()) {
        normalized
    } else {
        DEFAULT_MCP_SERVER_LOG_LEVEL.to_string()
    }
}

pub fn load_mcp_server_launch_settings() -> McpServerLaunchSettings {
    let user_settings = load_saved_user_settings();

    McpServerLaunchSettings {
        read_only: user_settings
            .as_ref()
            .and_then(|settings| settings.mcp_server_read_only)
            .unwrap_or(false),
        log_level: sanitize_mcp_server_log_level(
            user_settings
                .as_ref()
                .and_then(|settings| settings.mcp_server_log_level.as_deref()),
        ),
    }
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
        server_version: default_server_version(),
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
            "If a project path is unclear, call workspace_list_items({\"itemType\":\"project\"}) before action_create."
                .to_string(),
            "Planned changes do not modify files until change_apply succeeds.".to_string(),
            "Paths in tool requests should be workspace-relative unless otherwise noted."
                .to_string(),
        ],
    }
}

fn build_context_pack_markdown(pack: &ContextPack) -> String {
    let mut lines = vec![
        "# GTD Space Context Pack".to_string(),
        String::new(),
        format!("- Server version: `{}`", pack.server_version),
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

pub fn normalize_workspace_path<P: AsRef<Path>>(path: P) -> String {
    let normalized = path.as_ref().to_string_lossy().replace('\\', "/");
    normalized
        .strip_prefix("//?/")
        .or_else(|| normalized.strip_prefix("\\\\?/"))
        .unwrap_or(&normalized)
        .to_string()
}

fn normalize_path<P: AsRef<Path>>(path: P) -> String {
    normalize_workspace_path(path)
}

fn path_is_within_workspace(path: &Path, root: &Path) -> bool {
    let normalized_root = normalize_path(root).trim_end_matches('/').to_string();
    let normalized_path = normalize_path(path);
    #[cfg(target_os = "windows")]
    let normalized_root = normalized_root.to_lowercase();
    #[cfg(target_os = "windows")]
    let normalized_path = normalized_path.to_lowercase();
    normalized_path == normalized_root || normalized_path.starts_with(&(normalized_root + "/"))
}

fn normalize_relative_input(path: &str) -> String {
    path.trim().trim_start_matches("./").replace('\\', "/")
}

pub fn gtdspace_server_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

fn default_server_version() -> String {
    gtdspace_server_version().to_string()
}

fn normalize_absolute_to_relative(root: &Path, path: &str) -> String {
    let absolute = Path::new(path);
    if absolute.is_absolute() {
        let stripped = absolute.strip_prefix(root).map(normalize_path);
        stripped
            .unwrap_or_else(|_| {
                let normalized_root = normalize_path(root).trim_end_matches('/').to_string();
                let normalized_absolute = normalize_path(absolute);
                normalized_absolute
                    .strip_prefix(&(normalized_root.clone() + "/"))
                    .or_else(|| normalized_absolute.strip_prefix(&normalized_root))
                    .map(str::to_string)
                    .unwrap_or(normalized_absolute)
            })
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

fn normalize_similarity_key(value: &str) -> String {
    strip_markdown_extension(&normalize_relative_input(value))
        .to_ascii_lowercase()
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect()
}

fn strip_project_readme_suffix(path: &str) -> String {
    path.strip_suffix("/README.md")
        .or_else(|| path.strip_suffix("/README.markdown"))
        .unwrap_or(path)
        .to_string()
}

fn project_similarity_keys(item: &GtdItemSummary) -> Vec<String> {
    let mut candidates = vec![
        normalize_similarity_key(&item.relative_path),
        normalize_similarity_key(&strip_project_readme_suffix(&item.relative_path)),
        normalize_similarity_key(&item.title),
    ];
    candidates.retain(|candidate| !candidate.is_empty());
    candidates.sort();
    candidates.dedup();
    candidates
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

fn resolve_project_readme_in_directory(project_dir: &Path) -> Option<PathBuf> {
    let md_path = project_dir.join("README.md");
    if md_path.exists() {
        return Some(md_path);
    }

    let markdown_path = project_dir.join("README.markdown");
    if markdown_path.exists() {
        return Some(markdown_path);
    }

    None
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
\n## Projects References\n[!projects-references:{projects}]\n\n## Areas References\n[!areas-references:{areas}]\n\n## Goals References\n[!goals-references:{goals}]\n\n## Vision References\n[!vision-references:{vision}]\n\n## Purpose & Principles References\n[!purpose-references:{purpose}]\n\n## Created\n[!datetime:created_date_time:{created}]\n\n## History\n{history}\n",
        title = input.title,
        frequency = input.frequency,
        focus = focus_section,
        projects = encode_reference_array(&input.projects),
        areas = encode_reference_array(&input.areas),
        goals = encode_reference_array(&input.goals),
        vision = encode_reference_array(&input.vision),
        purpose = encode_reference_array(&input.purpose),
        created = input.created_date_time,
        history = DEFAULT_HISTORY_TEMPLATE
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
            server_version: gtdspace_server_version().to_string(),
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
        assert!(markdown.contains("Server version"));
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
    fn change_apply_after_workspace_refresh_reports_refresh_invalidation() -> Result<(), String> {
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
        assert!(error.contains("workspace_refresh"));
        assert!(!error.contains("Unknown change set"));
        Ok(())
    }

    #[test]
    fn change_apply_after_revalidation_failure_reports_stale_plan_on_retry() -> Result<(), String> {
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

        let change_set_id = planned.change_set.id.clone();
        let error = service
            .change_apply(ChangeSetRequest {
                change_set_id: change_set_id.clone(),
            })
            .unwrap_err();
        assert!(error.contains("changed since planning"));
        assert!(error.contains("Create a fresh plan"));

        let retry_error = service
            .change_apply(ChangeSetRequest { change_set_id })
            .unwrap_err();
        assert!(retry_error.contains("changed since planning"));
        assert!(!retry_error.contains("Unknown change set"));
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
    fn plan_action_create_rejects_unknown_project_path() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let error = service
            .plan_action_create(ActionCreateRequest {
                project_path: "visible".to_string(),
                name: "Add search function in nav".to_string(),
                status: Some("waiting".to_string()),
                focus_date: None,
                due_date: None,
                effort: None,
                contexts: vec![],
                notes: None,
                general_references: vec![],
            })
            .unwrap_err();

        assert!(error.contains("Project not found: visible"));
        assert!(error.contains("workspace_list_items({\"itemType\":\"project\"})"));
        Ok(())
    }

    #[test]
    fn plan_action_create_suggests_close_project_paths_for_typos() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        write_test_file(
            workspace.path().join("Projects/Visibible/README.md"),
            r#"# Visibible

[!singleselect:project-status:in-progress]
[!datetime:created_date_time:2026-03-21T10:00:00Z]

## Desired Outcome

Ship the visibible navigation updates.
"#,
        )?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let error = service
            .plan_action_create(ActionCreateRequest {
                project_path: "projects/visible".to_string(),
                name: "Add search function in nav".to_string(),
                status: Some("waiting".to_string()),
                focus_date: None,
                due_date: None,
                effort: None,
                contexts: vec![],
                notes: None,
                general_references: vec![],
            })
            .unwrap_err();

        assert!(error.contains("Project not found: projects/visible"));
        assert!(error.contains("Closest matches: Projects/Visibible/README.md"));
        Ok(())
    }

    #[test]
    fn workspace_info_includes_server_version() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let info = service.workspace_info()?;
        assert_eq!(info.server_version, gtdspace_server_version());
        Ok(())
    }

    #[test]
    fn workspace_context_pack_includes_server_version_and_guidance() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let context_pack = service.workspace_context_pack()?;
        assert_eq!(context_pack.pack.server_version, gtdspace_server_version());
        assert!(context_pack
            .pack
            .operation_guidance
            .iter()
            .any(|entry| entry.contains("workspace_list_items({\"itemType\":\"project\"})")));
        assert!(context_pack
            .pack
            .operation_guidance
            .iter()
            .any(|entry| entry.contains("do not modify files until change_apply")));
        Ok(())
    }

    #[test]
    fn plan_action_create_accepts_project_readme_path() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let planned = service.plan_action_create(ActionCreateRequest {
            project_path: "Projects/Alpha Project/README.md".to_string(),
            name: "Review nav search".to_string(),
            status: Some("waiting".to_string()),
            focus_date: None,
            due_date: None,
            effort: None,
            contexts: vec![],
            notes: None,
            general_references: vec![],
        })?;

        assert!(planned
            .change_set
            .affected_paths
            .iter()
            .any(|path| path.ends_with("Projects/Alpha Project/Review nav search.md")));
        Ok(())
    }

    #[test]
    fn change_apply_reports_refresh_after_apply_failure() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let planned = service.plan_project_rename(ProjectRenameRequest {
            path: "Projects/Alpha Project/README.md".to_string(),
            new_name: "Renamed Project".to_string(),
        })?;

        fs::create_dir_all(workspace.path().join("Projects/Renamed Project"))
            .map_err(|error| error.to_string())?;

        let change_set_id = planned.change_set.id.clone();
        let error = service
            .change_apply(ChangeSetRequest {
                change_set_id: change_set_id.clone(),
            })
            .unwrap_err();
        assert!(error.contains("workspace_refresh"));

        let retry_error = service
            .change_apply(ChangeSetRequest { change_set_id })
            .unwrap_err();
        assert!(retry_error.contains("previously failed during apply"));
        assert!(retry_error.contains("workspace_refresh"));
        assert!(!retry_error.contains("Unknown change set"));
        Ok(())
    }

    #[test]
    fn change_apply_replays_applied_change_set_with_replayed_true() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let planned = service.plan_reference_note_create(ReferenceNoteCreateRequest {
            section: ReferenceNoteSection::Cabinet,
            title: "Inbox Reference".to_string(),
            body: Some("Useful note.".to_string()),
        })?;

        let first = service.change_apply(ChangeSetRequest {
            change_set_id: planned.change_set.id.clone(),
        })?;
        assert!(!first.replayed);

        let note_path = workspace.path().join("Cabinet/Inbox Reference.md");
        fs::write(
            &note_path,
            format!(
                "{}\nReplay should not overwrite.\n",
                fs::read_to_string(&note_path).map_err(|error| error.to_string())?
            ),
        )
        .map_err(|error| error.to_string())?;

        let replay = service.change_apply(ChangeSetRequest {
            change_set_id: planned.change_set.id,
        })?;
        assert!(replay.replayed);
        assert_eq!(replay.change_set.id, first.change_set.id);

        let content = fs::read_to_string(&note_path).map_err(|error| error.to_string())?;
        assert!(content.contains("Replay should not overwrite."));
        Ok(())
    }

    #[test]
    fn change_apply_after_discard_reports_discarded_state() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let planned = service.plan_reference_note_create(ReferenceNoteCreateRequest {
            section: ReferenceNoteSection::Cabinet,
            title: "Discard Me".to_string(),
            body: Some("Temporary note.".to_string()),
        })?;

        let discarded = service.change_discard(ChangeSetRequest {
            change_set_id: planned.change_set.id.clone(),
        })?;
        assert_eq!(discarded.status, ChangeStatus::Discarded);

        let error = service
            .change_apply(ChangeSetRequest {
                change_set_id: planned.change_set.id,
            })
            .unwrap_err();
        assert!(error.contains("discarded"));
        assert!(!error.contains("Unknown change set"));
        Ok(())
    }

    #[test]
    fn unknown_change_set_message_mentions_session_or_restart() {
        let error = GtdWorkspaceService::unknown_change_set_message("missing-id");
        assert!(error.contains("different MCP server session"));
        assert!(error.contains("expired after restart"));
    }

    #[test]
    fn change_set_tombstones_are_bounded_and_oldest_entries_evict() {
        let mut state = ServiceState::default();

        for index in 0..=MAX_CHANGE_SET_TOMBSTONES {
            let id = format!("change-set-{index}");
            GtdWorkspaceService::record_change_set_tombstone(
                &mut state,
                id.clone(),
                StoredChangeSetTombstone {
                    summary: ChangeSetSummary {
                        id,
                        tool_name: "test".to_string(),
                        summary: "Synthetic tombstone".to_string(),
                        status: ChangeStatus::Discarded,
                        affected_paths: vec![],
                        preview: "Synthetic preview".to_string(),
                    },
                    state: TerminalChangeSetState::Discarded,
                    reason: TerminalChangeSetReason::Discarded,
                    apply_result: None,
                    message: None,
                },
            );
        }

        assert_eq!(state.change_set_tombstones.len(), MAX_CHANGE_SET_TOMBSTONES);
        assert!(!state.change_set_tombstones.contains_key("change-set-0"));
        assert!(state
            .change_set_tombstones
            .contains_key(&format!("change-set-{}", MAX_CHANGE_SET_TOMBSTONES)));
    }

    #[test]
    fn get_habit_history_returns_structured_rows() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        write_test_file(
            workspace.path().join("Habits/Morning Run.md"),
            r#"# Morning Run

## Status
[!checkbox:habit-status:true]

## Frequency
[!singleselect:habit-frequency:daily]

## Created
[!datetime:created_date_time:2026-03-20T10:00:00Z]

## History
*Track your habit completions below:*

| Date | Time | Status | Action | Details |
|------|------|--------|--------|---------|
| 2026-03-21 | 7:30 AM | Complete | Manual | Ran 3 miles |
| 2026-03-22 | 12:00 AM | To Do | Auto-Reset | New period |
"#,
        )?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let result = service.get_habit_history("Habits/Morning Run.md")?;
        assert_eq!(result.title, "Morning Run");
        assert_eq!(result.current_status.as_deref(), Some("completed"));
        assert_eq!(result.frequency.as_deref(), Some("daily"));
        assert_eq!(result.rows.len(), 2);
        assert_eq!(result.rows[0].action, "Manual");
        assert_eq!(result.rows[0].details, "Ran 3 miles");
        assert_eq!(result.rows[1].status, "To Do");
        Ok(())
    }

    #[test]
    fn plan_habit_create_seeds_canonical_history_that_habit_get_history_accepts(
    ) -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let planned = service.plan_habit_create(HabitCreateRequest {
            name: "Morning Run".to_string(),
            frequency: "daily".to_string(),
            focus_time: None,
            projects: vec![],
            areas: vec![],
            goals: vec![],
            vision: vec![],
            purpose: vec![],
        })?;

        service.change_apply(ChangeSetRequest {
            change_set_id: planned.change_set.id,
        })?;

        let content = service.read_markdown("Habits/Morning Run.md")?;
        assert!(content.contains("| Date | Time | Status | Action | Details |"));

        let parsed_rows = parse_history_rows_strict(&content)?;
        assert!(parsed_rows.is_empty());

        let history = service.get_habit_history("Habits/Morning Run.md")?;
        assert!(history.rows.is_empty());
        Ok(())
    }

    #[test]
    fn get_habit_history_fails_fast_for_unsupported_legacy_history_rows() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        write_test_file(
            workspace.path().join("Habits/Legacy Habit.md"),
            r#"# Legacy Habit

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:daily]

## Created
[!datetime:created_date_time:2026-03-20T10:00:00Z]

## History
| Date | Action | Source | Details |
| --- | --- | --- | --- |
| 2026-03-21 | Complete | Manual | Legacy row |
"#,
        )?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let content = service.read_markdown("Habits/Legacy Habit.md")?;
        assert!(parse_history_rows_strict(&content).is_err());

        let error = service
            .get_habit_history("Habits/Legacy Habit.md")
            .unwrap_err();
        assert!(error.contains("Failed to parse habit history"));
        Ok(())
    }

    #[test]
    fn habit_write_history_entry_appends_and_can_update_status() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        write_test_file(
            workspace.path().join("Habits/Morning Run.md"),
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
"#,
        )?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let planned = service.plan_habit_write_history_entry(HabitWriteHistoryEntryRequest {
            path: "Habits/Morning Run.md".to_string(),
            status: "completed".to_string(),
            action: "Manual".to_string(),
            details: Some("Ran before work".to_string()),
            date: Some("2026-03-23".to_string()),
            time: Some("7:45 AM".to_string()),
            update_current_status: Some(true),
        })?;

        service.change_apply(ChangeSetRequest {
            change_set_id: planned.change_set.id,
        })?;

        let content = fs::read_to_string(workspace.path().join("Habits/Morning Run.md"))
            .map_err(|error| error.to_string())?;
        assert!(content.contains("[!checkbox:habit-status:true]"));
        assert!(content.contains("| 2026-03-23 | 7:45 AM | Complete | Manual | Ran before work |"));
        Ok(())
    }

    #[test]
    fn habit_replace_history_rewrites_canonical_table_and_updates_status() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        write_test_file(
            workspace.path().join("Habits/Morning Run.md"),
            r#"# Morning Run

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:daily]

## Created
[!datetime:created_date_time:2026-03-20T10:00:00Z]

## History
This freeform block will be replaced.

- **2026-03-21** at **7:30 AM**: Complete (Manual - Legacy)

## Notes
Still here
"#,
        )?;
        let service =
            GtdWorkspaceService::new(Some(workspace.path().to_string_lossy().to_string()), false)?;

        let planned = service.plan_habit_replace_history(HabitReplaceHistoryRequest {
            path: "Habits/Morning Run.md".to_string(),
            rows: vec![
                HabitHistoryRowInput {
                    date: "2026-03-24".to_string(),
                    time: "8:30 PM".to_string(),
                    status: "todo".to_string(),
                    action: "Backfill".to_string(),
                    details: Some("Missed the run".to_string()),
                },
                HabitHistoryRowInput {
                    date: "2026-03-23".to_string(),
                    time: "7:45 AM".to_string(),
                    status: "complete".to_string(),
                    action: "Manual".to_string(),
                    details: Some("Ran before work".to_string()),
                },
            ],
            update_current_status_from_latest: Some(true),
        })?;

        service.change_apply(ChangeSetRequest {
            change_set_id: planned.change_set.id,
        })?;

        let content = fs::read_to_string(workspace.path().join("Habits/Morning Run.md"))
            .map_err(|error| error.to_string())?;
        assert!(content.contains("[!checkbox:habit-status:false]"));
        assert!(content.contains("| Date | Time | Status | Action | Details |"));
        assert!(content.contains("| 2026-03-23 | 7:45 AM | Complete | Manual | Ran before work |"));
        assert!(content.contains("| 2026-03-24 | 8:30 PM | To Do | Backfill | Missed the run |"));
        assert!(!content.contains("This freeform block will be replaced."));
        assert!(content.contains("## Notes\nStill here"));
        Ok(())
    }

    #[test]
    fn normalize_path_strips_windows_verbatim_prefix() {
        assert_eq!(
            normalize_path(r"\\?\C:\Temp\GTD Space\Projects\Alpha Project\README.md"),
            "C:/Temp/GTD Space/Projects/Alpha Project/README.md"
        );
    }
}
