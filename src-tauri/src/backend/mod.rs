pub mod mcp_google_calendar;
pub mod mcp_workspace;
pub mod mcp_workspace_config;
pub mod mcp_workspace_context;
pub mod mcp_workspace_index;
mod mcp_workspace_markdown;

pub use mcp_google_calendar::{
    GoogleCalendarListEventsRequest, GoogleCalendarMcpEnvelope, GoogleCalendarMcpEvent,
    GOOGLE_CALENDAR_EVENTS_RESOURCE_URI,
};
pub use mcp_workspace::{
    gtdspace_server_version, normalize_workspace_path, ChangeApplyResult, ChangeSet,
    ChangeSetErrorKind, ChangeSetSummary, ChangeSetToolError, ChangeStatus, ContextPack,
    ContextPackCache, GtdItemReferenceSummary, GtdItemSummary, GtdItemType, GtdWorkspaceService,
    HabitHistoryResult, HabitHistoryRow, HabitHistoryRowInput, PlannedChange, RelationshipSummary,
    WorkspaceFingerprint, WorkspaceInfo, WorkspaceListItemsResult, WorkspaceRefreshResult,
    WorkspaceSearchResult,
};
pub use mcp_workspace_config::{load_mcp_server_launch_settings, McpServerLaunchSettings};

pub(crate) fn encode_hex(bytes: impl AsRef<[u8]>) -> String {
    let bytes = bytes.as_ref();
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        let _ = write!(&mut output, "{:02x}", byte);
    }
    output
}
