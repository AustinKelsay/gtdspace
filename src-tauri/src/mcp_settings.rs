use std::path::PathBuf;

use directories::ProjectDirs;
use serde_json::Value;

pub const SETTINGS_FILE_NAME: &str = "settings.json";
pub const DEFAULT_MCP_SERVER_LOG_LEVEL: &str = "info";
pub const VALID_MCP_SERVER_LOG_LEVELS: [&str; 5] = ["error", "warn", "info", "debug", "trace"];

pub fn settings_store_path() -> PathBuf {
    PathBuf::from(SETTINGS_FILE_NAME)
}

pub fn settings_file_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    if let Ok(appdata) = std::env::var("APPDATA") {
        return Some(
            PathBuf::from(appdata)
                .join("com.gtdspace.app")
                .join(SETTINGS_FILE_NAME),
        );
    }

    #[cfg(target_os = "linux")]
    if let Ok(config_home) = std::env::var("XDG_CONFIG_HOME") {
        return Some(
            PathBuf::from(config_home)
                .join("com.gtdspace.app")
                .join(SETTINGS_FILE_NAME),
        );
    }

    #[cfg(target_os = "macos")]
    if let Ok(home) = std::env::var("HOME") {
        return Some(
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("com.gtdspace.app")
                .join(SETTINGS_FILE_NAME),
        );
    }

    ProjectDirs::from("", "", "com.gtdspace.app")
        .map(|dirs| dirs.config_dir().join(SETTINGS_FILE_NAME))
}

pub fn sanitize_mcp_server_log_level(value: Option<&str>) -> String {
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

pub fn normalize_mcp_server_workspace_path(value: Option<String>) -> Option<String> {
    value.and_then(|path| {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

pub fn coerce_mcp_server_read_only(value: &Value) -> Option<bool> {
    match value {
        Value::Bool(boolean) => Some(*boolean),
        Value::Number(number) => {
            if number.as_i64() == Some(0) || number.as_u64() == Some(0) {
                Some(false)
            } else if number.as_i64() == Some(1) || number.as_u64() == Some(1) {
                Some(true)
            } else {
                None
            }
        }
        Value::String(string) => {
            let normalized = string.trim().to_ascii_lowercase();
            match normalized.as_str() {
                "true" | "1" | "yes" | "y" | "on" => Some(true),
                "false" | "0" | "no" | "n" | "off" => Some(false),
                _ => None,
            }
        }
        _ => None,
    }
}
