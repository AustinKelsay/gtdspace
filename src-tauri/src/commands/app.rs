//! Lightweight app-level Tauri commands.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

/// Response structure for permission check command
#[derive(Debug, Serialize, Deserialize)]
pub struct PermissionStatus {
    /// Whether file system read access is available
    pub can_read_files: bool,
    /// Whether file system write access is available  
    pub can_write_files: bool,
    /// Whether dialog access is available
    pub can_open_dialogs: bool,
}

/// Simple ping command to test frontend-backend communication
///
/// This command serves as a basic connectivity test between the React
/// frontend and Rust backend. It's useful for verifying that the Tauri
/// invoke system is working correctly.
///
/// # Returns
///
/// Always returns the string "pong"
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// import { withErrorHandling } from '@/hooks/useErrorHandler';
///
/// const response = await withErrorHandling(() => invoke<string>('ping'));
/// console.log(response); // "pong"
/// ```
#[tauri::command]
pub fn ping() -> Result<String, String> {
    log::info!("Ping command received");
    Ok("pong".to_string())
}

/// Test folder selection
#[cfg(debug_assertions)]
#[allow(dead_code)]
#[tauri::command]
pub fn test_select_folder() -> Result<String, String> {
    log::info!("=== test_select_folder called ===");
    Ok("Test successful - command reached!".to_string())
}

/// Get the current application version
///
/// Returns the version string from the Cargo.toml file. This is useful
/// for displaying version information in the UI and for debugging.
///
/// # Arguments
///
/// * `app` - Tauri application handle for accessing app metadata
///
/// # Returns
///
/// Application version string or error message
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// import { withErrorHandling } from '@/hooks/useErrorHandler';
///
/// const version = await withErrorHandling(() => invoke<string>('getAppVersion'));
/// console.log(`App version: ${version}`);
/// ```
#[tauri::command]
pub fn get_app_version(app: AppHandle) -> Result<String, String> {
    let package_info = app.package_info();
    let version = package_info.version.to_string();

    log::info!("App version requested: {}", version);
    Ok(version)
}

/// Check file system and dialog permissions.
///
/// Desktop permission checks are not implemented yet, so this command currently
/// always returns `Err("Permission checks are not implemented for desktop yet")`.
///
/// The return type remains `Result<PermissionStatus, String>` so callers can
/// switch to handling a successful `PermissionStatus` once desktop permission
/// probing is implemented.
///
/// # Returns
///
/// Currently always returns:
/// `Err("Permission checks are not implemented for desktop yet")`
#[tauri::command]
pub fn check_permissions() -> Result<PermissionStatus, String> {
    log::info!("Permission check requested; desktop permission checks are not implemented yet");
    Err("Permission checks are not implemented for desktop yet".to_string())
}
