//! Native dialog and file explorer commands.

use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tokio::task;

fn open_in_linux_file_manager(path: &std::ffi::OsStr) -> Result<(), std::io::Error> {
    let mut last_error: Option<std::io::Error> = None;
    let mut last_non_success: Option<String> = None;

    for launcher in ["xdg-open", "nautilus", "dolphin", "thunar"] {
        match Command::new(launcher).arg(path).status() {
            Ok(status) if status.success() => return Ok(()),
            Ok(status) => {
                let detail = status
                    .code()
                    .map(|code| format!("{} exited with code {}", launcher, code))
                    .unwrap_or_else(|| format!("{} terminated by signal", launcher));
                last_non_success = Some(detail);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                continue;
            }
            Err(error) => {
                last_error = Some(error);
            }
        }
    }

    Err(last_error.unwrap_or_else(|| {
        std::io::Error::other(
            last_non_success.unwrap_or_else(|| "No suitable file manager found".to_string()),
        )
    }))
}

fn redact_path(path: &str) -> String {
    PathBuf::from(path)
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.to_string())
        .unwrap_or_else(|| "<redacted>".to_string())
}

/// Open folder selection dialog and return selected path
///
/// Uses Tauri's dialog API to present a native folder selection dialog
/// to the user. This is the entry point for workspace selection in Phase 1.
///
/// # Arguments
///
/// * `app` - Tauri application handle for accessing dialog API
///
/// # Returns
///
/// Selected folder path as string, or `None` if cancelled
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
///
/// const folderPath = await invoke<string | null>('select_folder');
/// if (folderPath) {
///   console.log('Selected folder:', folderPath);
/// } else {
///   console.log('User cancelled folder selection');
/// }
/// ```
#[tauri::command]
pub async fn select_folder(app: AppHandle) -> Result<Option<String>, String> {
    log::debug!("select_folder command called");
    log::info!("Folder selection dialog requested");

    let result = task::spawn_blocking(move || {
        let dialog = app.dialog().file();
        let dialog = dialog.set_title("Select Folder with Markdown Files");

        log::debug!("Opening folder dialog on Tokio blocking thread");

        dialog.blocking_pick_folder()
    })
    .await
    .map_err(|error| format!("Failed to join folder dialog task: {}", error))?;

    match result {
        Some(folder_path) => {
            let path_str = folder_path.to_string();
            log::debug!("Folder selected: {}", redact_path(&path_str));
            Ok(Some(path_str))
        }
        None => {
            log::debug!("Folder selection cancelled");
            Ok(None)
        }
    }
}

/// Open a folder in the system's file explorer
///
/// Opens the specified folder path in the native file manager:
/// - macOS: Finder
/// - Windows: Explorer
/// - Linux: Default file manager
///
/// # Arguments
///
/// * `path` - The folder path to open
///
/// # Returns
///
/// Success message or error
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
///
/// await invoke('open_folder_in_explorer', { path: '/Users/me/Documents' });
/// ```
#[tauri::command]
pub fn open_folder_in_explorer(path: String) -> Result<String, String> {
    log::info!("Opening folder in explorer: {}", redact_path(&path));

    // Verify the path exists and is a directory
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", redact_path(&path)));
    }
    if !path_buf.is_dir() {
        return Err(format!("Path is not a directory: {}", redact_path(&path)));
    }

    // Open the folder based on the operating system
    if cfg!(target_os = "linux") {
        open_in_linux_file_manager(path_buf.as_os_str()).map_err(|e| {
            log::error!("Failed to open folder in explorer: {}", e);
            format!("Failed to open folder {}: {}", redact_path(&path), e)
        })?;
        log::info!("Successfully opened folder in explorer");
        return Ok(format!("Opened folder: {}", redact_path(&path)));
    }

    let result = if cfg!(target_os = "windows") {
        Command::new("explorer").arg(&path).status()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(&path).status()
    } else {
        return Err("Unsupported operating system".to_string());
    };

    match result {
        Ok(status) if status.success() => {
            log::info!("Successfully opened folder in explorer");
            Ok(format!("Opened folder: {}", redact_path(&path)))
        }
        Ok(status) => {
            let status_detail = status
                .code()
                .map(|code| format!("exit code {}", code))
                .unwrap_or_else(|| "terminated by signal".to_string());
            log::error!(
                "Failed to open folder in explorer: launcher exited unsuccessfully ({})",
                status_detail
            );
            Err(format!(
                "Failed to open folder {}: launcher exited unsuccessfully ({})",
                redact_path(&path),
                status_detail
            ))
        }
        Err(e) => {
            log::error!("Failed to open folder in explorer: {}", e);
            Err(format!(
                "Failed to open folder {}: {}",
                redact_path(&path),
                e
            ))
        }
    }
}

/// Open a file's location in the system file explorer
///
/// Opens the parent folder of the specified file in the system's default file manager
/// and selects the file if possible.
///
/// # Arguments
/// * `file_path` - Path to the file whose location to open
///
/// # Example
/// ```javascript
/// import { invoke } from '@tauri-apps/api/core';
///
/// await invoke('open_file_location', { file_path: '/path/to/file.md' });
/// ```
#[tauri::command]
pub fn open_file_location(file_path: String) -> Result<String, String> {
    log::info!("Opening file location: {}", redact_path(&file_path));

    // Get the parent directory of the file
    let path_buf = PathBuf::from(&file_path);
    if !path_buf.exists() {
        return Err(format!("File does not exist: {}", redact_path(&file_path)));
    }
    if !path_buf.is_file() {
        return Err(format!("Not a file: {}", redact_path(&file_path)));
    }

    // Get the parent directory
    let parent_dir = path_buf.parent().ok_or_else(|| {
        format!(
            "Could not get parent directory of: {}",
            redact_path(&file_path)
        )
    })?;

    // Open the folder and select the file based on the operating system
    if cfg!(target_os = "linux") {
        open_in_linux_file_manager(parent_dir.as_os_str()).map_err(|e| {
            log::error!("Failed to open file location: {}", e);
            format!(
                "Failed to open file location for {}: {}",
                redact_path(&file_path),
                e
            )
        })?;
        log::info!(
            "Successfully opened file location: {}",
            redact_path(&file_path)
        );
        return Ok(format!("Opened file location: {}", redact_path(&file_path)));
    }

    let result = if cfg!(target_os = "windows") {
        // On Windows, explorer can select a file with /select
        Command::new("explorer")
            .arg(format!("/select,{}", file_path))
            .status()
    } else if cfg!(target_os = "macos") {
        // On macOS, we can use open -R to reveal the file
        Command::new("open").arg("-R").arg(&file_path).status()
    } else {
        return Err("Unsupported operating system".to_string());
    };

    match result {
        Ok(status) if status.success() => {
            log::info!(
                "Successfully opened file location: {}",
                redact_path(&file_path)
            );
            Ok(format!("Opened file location: {}", redact_path(&file_path)))
        }
        Ok(status) => {
            let status_detail = status
                .code()
                .map(|code| format!("exit code {}", code))
                .unwrap_or_else(|| "terminated by signal".to_string());
            log::error!(
                "Failed to open file location: launcher exited unsuccessfully ({})",
                status_detail
            );
            Err(format!(
                "Failed to open file location: launcher exited unsuccessfully ({})",
                status_detail
            ))
        }
        Err(e) => {
            log::error!("Failed to open file location: {}", e);
            Err(format!("Failed to open file location: {}", e))
        }
    }
}
