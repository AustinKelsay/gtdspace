//! Command handlers for frontend-backend communication
//!
//! This module contains all Tauri command handlers that can be invoked
//! from the React frontend. These commands provide the bridge between
//! the TypeScript frontend and Rust backend.
//!
//! # Phase 0 Commands
//!
//! Basic commands for testing communication and getting app information:
//! - `ping()` - Simple test command
//! - `get_app_version()` - Returns application version
//! - `check_permissions()` - Verifies file system access

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
/// import { invoke } from '@tauri-apps/api/tauri';
/// 
/// const response = await invoke('ping');
/// console.log(response); // "pong"
/// ```
#[tauri::command]
pub async fn ping() -> Result<String, String> {
    log::info!("Ping command received");
    Ok("pong".to_string())
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
/// import { invoke } from '@tauri-apps/api/tauri';
/// 
/// const version = await invoke('get_app_version');
/// console.log(`App version: ${version}`);
/// ```
#[tauri::command]
pub async fn get_app_version(app: AppHandle) -> Result<String, String> {
    let package_info = app.package_info();
    let version = package_info.version.to_string();
    
    log::info!("App version requested: {}", version);
    Ok(version)
}

/// Check file system and dialog permissions
///
/// Verifies that the application has the necessary permissions to:
/// - Read files from the file system
/// - Write files to the file system  
/// - Open system dialogs
///
/// This is important for Phase 1 when we implement file operations.
///
/// # Returns
///
/// PermissionStatus struct with boolean flags for each permission type
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/tauri';
/// 
/// const permissions = await invoke('check_permissions');
/// if (permissions.can_read_files) {
///   console.log('File reading is available');
/// }
/// ```
#[tauri::command]
pub async fn check_permissions() -> Result<PermissionStatus, String> {
    log::info!("Permission check requested");
    
    // For Phase 0, we'll return a basic permission check
    // In Phase 1, this will involve actual file system testing
    let status = PermissionStatus {
        can_read_files: true,  // Assumed true for now
        can_write_files: true, // Assumed true for now  
        can_open_dialogs: true, // Assumed true for now
    };
    
    Ok(status)
}