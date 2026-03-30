use chrono::{DateTime, Utc};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tokio::io::AsyncWriteExt;

use super::GoogleCalendarEvent;

const APP_IDENTIFIER: &str = "com.gtdspace.app";
const CACHE_FILE_NAME: &str = "google_calendar_cache.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedEvents {
    pub events: Vec<GoogleCalendarEvent>,
    pub last_updated: DateTime<Utc>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OsKind {
    Linux,
    Macos,
    Windows,
}

pub fn google_calendar_cache_path() -> Result<PathBuf, String> {
    google_calendar_app_data_dir().map(|dir| dir.join(CACHE_FILE_NAME))
}

pub fn load_google_calendar_cache() -> Result<Option<CachedEvents>, String> {
    let path = google_calendar_cache_path()?;
    load_google_calendar_cache_from_path(&path)
}

pub(crate) fn load_google_calendar_cache_from_path(
    path: &Path,
) -> Result<Option<CachedEvents>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(path).map_err(|error| {
        format!(
            "Failed to read Google Calendar cache '{}': {}",
            path.display(),
            error
        )
    })?;
    let cache = serde_json::from_str::<CachedEvents>(&contents).map_err(|error| {
        format!(
            "Failed to parse Google Calendar cache '{}': {}",
            path.display(),
            error
        )
    })?;
    Ok(Some(cache))
}

pub(crate) async fn save_google_calendar_cache(cache: &CachedEvents) -> Result<(), String> {
    let path = google_calendar_cache_path()?;
    let parent = path
        .parent()
        .ok_or_else(|| format!("Invalid Google Calendar cache path '{}'", path.display()))?;
    tokio::fs::create_dir_all(parent).await.map_err(|error| {
        format!(
            "Failed to create Google Calendar cache directory '{}': {}",
            parent.display(),
            error
        )
    })?;

    let json = serde_json::to_vec_pretty(cache)
        .map_err(|error| format!("Failed to serialize Google Calendar cache: {}", error))?;
    let temp_path = path.with_extension(format!("tmp.{}", uuid::Uuid::new_v4()));

    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&temp_path)
        .await
        .map_err(|error| {
            format!(
                "Failed to create Google Calendar cache temp file '{}': {}",
                temp_path.display(),
                error
            )
        })?;
    file.write_all(&json).await.map_err(|error| {
        format!(
            "Failed to write Google Calendar cache temp file '{}': {}",
            temp_path.display(),
            error
        )
    })?;
    file.sync_all().await.map_err(|error| {
        format!(
            "Failed to flush Google Calendar cache temp file '{}': {}",
            temp_path.display(),
            error
        )
    })?;
    drop(file);

    if let Err(error) = tokio::fs::rename(&temp_path, &path).await {
        #[cfg(windows)]
        {
            use std::io::ErrorKind;

            if matches!(
                error.kind(),
                ErrorKind::AlreadyExists | ErrorKind::PermissionDenied
            ) {
                let _ = tokio::fs::remove_file(&path).await;
                if let Err(rename_error) = tokio::fs::rename(&temp_path, &path).await {
                    let _ = tokio::fs::remove_file(&temp_path).await;
                    return Err(format!(
                        "Failed to replace Google Calendar cache '{}': {}",
                        path.display(),
                        rename_error
                    ));
                }
                return Ok(());
            }
        }

        let _ = tokio::fs::remove_file(&temp_path).await;
        return Err(format!(
            "Failed to move Google Calendar cache temp file into place '{}': {}",
            path.display(),
            error
        ));
    }

    Ok(())
}

fn google_calendar_app_data_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA").ok();
    let home = std::env::var("HOME").ok();
    let xdg_data_home = std::env::var("XDG_DATA_HOME").ok();
    resolve_app_data_dir_for_os(
        current_os_kind(),
        appdata.as_deref(),
        home.as_deref(),
        xdg_data_home.as_deref(),
    )
}

fn current_os_kind() -> OsKind {
    #[cfg(target_os = "windows")]
    {
        OsKind::Windows
    }
    #[cfg(target_os = "macos")]
    {
        OsKind::Macos
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        OsKind::Linux
    }
}

fn resolve_app_data_dir_for_os(
    os: OsKind,
    appdata: Option<&str>,
    home: Option<&str>,
    xdg_data_home: Option<&str>,
) -> Result<PathBuf, String> {
    match os {
        OsKind::Windows => {
            if let Some(appdata) = normalize_env_value(appdata) {
                return Ok(PathBuf::from(appdata).join(APP_IDENTIFIER));
            }
        }
        OsKind::Macos => {
            if let Some(home) = normalize_env_value(home) {
                return Ok(PathBuf::from(home)
                    .join("Library")
                    .join("Application Support")
                    .join(APP_IDENTIFIER));
            }
        }
        OsKind::Linux => {
            if let Some(xdg_data_home) = normalize_env_value(xdg_data_home) {
                return Ok(PathBuf::from(xdg_data_home).join(APP_IDENTIFIER));
            }
            if let Some(home) = normalize_env_value(home) {
                return Ok(PathBuf::from(home)
                    .join(".local")
                    .join("share")
                    .join(APP_IDENTIFIER));
            }
        }
    }

    // The empty qualifier and organization are deliberate here. We want
    // ProjectDirs to derive the platform-default data_dir for APP_IDENTIFIER
    // when explicit environment overrides are unavailable.
    ProjectDirs::from("", "", APP_IDENTIFIER)
        .map(|dirs| dirs.data_dir().to_path_buf())
        .ok_or_else(|| "Failed to resolve Google Calendar app data directory".to_string())
}

fn normalize_env_value(value: Option<&str>) -> Option<&str> {
    value
        .map(str::trim)
        .filter(|candidate| !candidate.is_empty())
}

#[cfg(test)]
mod tests {
    use super::{
        load_google_calendar_cache_from_path, resolve_app_data_dir_for_os, CachedEvents, OsKind,
    };
    use crate::google_calendar::GoogleCalendarEvent;
    use chrono::Utc;
    use std::fs;
    use std::path::PathBuf;

    fn sample_cache() -> CachedEvents {
        CachedEvents {
            events: vec![GoogleCalendarEvent {
                id: "evt-1".to_string(),
                summary: "Weekly planning".to_string(),
                description: Some("Review upcoming work".to_string()),
                start: Some("2026-03-29T09:00:00-05:00".to_string()),
                end: Some("2026-03-29T10:00:00-05:00".to_string()),
                location: Some("Office".to_string()),
                attendees: vec!["a@example.com".to_string()],
                meeting_link: Some("https://meet.example.com/weekly".to_string()),
                status: "confirmed".to_string(),
                color_id: Some("3".to_string()),
            }],
            last_updated: Utc::now(),
        }
    }

    #[test]
    fn resolve_app_data_dir_honors_platform_overrides() {
        assert_eq!(
            resolve_app_data_dir_for_os(OsKind::Macos, None, Some("/Users/tester"), None).unwrap(),
            PathBuf::from("/Users/tester/Library/Application Support/com.gtdspace.app")
        );
        assert_eq!(
            resolve_app_data_dir_for_os(
                OsKind::Linux,
                None,
                Some("/home/tester"),
                Some("/xdg/data")
            )
            .unwrap(),
            PathBuf::from("/xdg/data/com.gtdspace.app")
        );
        assert_eq!(
            resolve_app_data_dir_for_os(
                OsKind::Windows,
                Some(r"C:\Users\tester\AppData\Roaming"),
                None,
                None
            )
            .unwrap(),
            PathBuf::from(r"C:\Users\tester\AppData\Roaming").join("com.gtdspace.app")
        );
    }

    #[test]
    fn load_google_calendar_cache_returns_none_for_missing_file() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().join("missing.json");

        let cache = load_google_calendar_cache_from_path(&path).unwrap();
        assert!(cache.is_none());
    }

    #[test]
    fn load_google_calendar_cache_errors_for_malformed_json() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().join("google_calendar_cache.json");
        fs::write(&path, "{not json").unwrap();

        let error = load_google_calendar_cache_from_path(&path).unwrap_err();
        assert!(error.contains("Failed to parse Google Calendar cache"));
    }

    #[test]
    fn load_google_calendar_cache_reads_valid_json() {
        let temp_dir = tempfile::tempdir().unwrap();
        let path = temp_dir.path().join("google_calendar_cache.json");
        fs::write(&path, serde_json::to_vec_pretty(&sample_cache()).unwrap()).unwrap();

        let cache = load_google_calendar_cache_from_path(&path)
            .unwrap()
            .unwrap();
        assert_eq!(cache.events.len(), 1);
        assert_eq!(cache.events[0].summary, "Weekly planning");
    }
}
