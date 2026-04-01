use std::fs;
use std::path::{Path, PathBuf};

use rmcp::schemars;
use serde_json::Value;

use crate::backend::normalize_workspace_path;
use crate::commands::settings::{parse_user_settings_value, UserSettings};
use crate::commands::workspace::{check_is_gtd_space, get_default_gtd_space_path};
use crate::mcp_settings::{sanitize_mcp_server_log_level, settings_file_path};

#[derive(
    Debug, Clone, serde::Serialize, serde::Deserialize, rmcp::schemars::JsonSchema, PartialEq, Eq,
)]
#[serde(rename_all = "camelCase")]
pub struct McpServerLaunchSettings {
    pub read_only: bool,
    pub log_level: String,
}

pub(crate) fn resolve_workspace(cli_workspace: Option<String>) -> Result<PathBuf, String> {
    if let Some(path) = cli_workspace {
        return validate_workspace_candidate(Path::new(&path));
    }

    if let Some(settings) = load_saved_user_settings() {
        if let Some(path) = resolve_saved_workspace(&settings) {
            return Ok(path);
        }
    }

    let default_path = get_default_gtd_space_path()?;
    validate_workspace_candidate(Path::new(&default_path))
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

fn validate_workspace_candidate(candidate: &Path) -> Result<PathBuf, String> {
    for ancestor in candidate.ancestors() {
        let path = normalize_workspace_path(ancestor);
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

fn load_saved_settings() -> Option<Value> {
    let settings_path = settings_file_path()?;
    let contents = fs::read_to_string(settings_path).ok()?;
    serde_json::from_str::<Value>(&contents).ok()
}

fn load_saved_user_settings() -> Option<UserSettings> {
    let settings = load_saved_settings()?;
    let user_settings = settings.get("user_settings")?;
    parse_user_settings_value(user_settings).ok()
}

fn resolve_saved_workspace(settings: &UserSettings) -> Option<PathBuf> {
    if let Some(candidate) = settings.mcp_server_workspace_path.as_deref() {
        if let Ok(path) = validate_workspace_candidate(Path::new(candidate)) {
            return Some(path);
        }
    }

    for candidate in [
        settings.last_folder.as_deref(),
        settings.default_space_path.as_deref(),
    ]
    .into_iter()
    .flatten()
    {
        if let Ok(path) = validate_workspace_candidate(Path::new(candidate)) {
            return Some(path);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::resolve_saved_workspace;
    use crate::commands::settings::get_default_settings;
    use crate::test_utils::seed_test_workspace;
    use std::fs;

    #[test]
    fn invalid_saved_override_falls_back_to_other_saved_candidates() -> Result<(), String> {
        let workspace = seed_test_workspace()?;
        let mut settings = get_default_settings();
        settings.mcp_server_workspace_path = Some("/tmp/not-a-workspace".to_string());
        settings.last_folder = Some(
            workspace
                .path()
                .join("Projects/Alpha Project")
                .to_string_lossy()
                .to_string(),
        );

        let resolved = resolve_saved_workspace(&settings).expect("saved fallback should resolve");

        assert_eq!(resolved, fs::canonicalize(workspace.path()).unwrap());
        Ok(())
    }
}
