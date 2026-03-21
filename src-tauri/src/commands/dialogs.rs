//! Native dialog and file explorer commands.

use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tokio::task;

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
/// Selected folder path as string, or error if cancelled or failed
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
///
/// try {
///   const folderPath = await invoke('select_folder');
///   console.log('Selected folder:', folderPath);
/// } catch (error) {
///   console.log('User cancelled or error occurred');
/// }
/// ```
#[tauri::command]
pub async fn select_folder(app: AppHandle) -> Result<String, String> {
    println!("=== select_folder command called (async with thread) ===");
    log::info!("Folder selection dialog requested");

    let result = task::spawn_blocking(move || {
        let dialog = app.dialog().file();
        let dialog = dialog.set_title("Select Folder with Markdown Files");

        println!("Opening folder dialog in separate thread...");

        dialog.blocking_pick_folder()
    })
    .await
    .map_err(|error| format!("Failed to join folder dialog task: {}", error))?;

    match result {
        Some(folder_path) => {
            let path_str = folder_path.to_string();
            println!("Folder selected: {}", path_str);
            Ok(path_str)
        }
        None => {
            println!("Folder selection cancelled");
            Err("Folder selection was cancelled".to_string())
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
    use std::process::Command;

    log::info!("Opening folder in explorer: {}", path);

    // Verify the path exists and is a directory
    let path_buf = PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !path_buf.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    // Open the folder based on the operating system
    let result = if cfg!(target_os = "windows") {
        Command::new("explorer").arg(&path).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(&path).spawn()
    } else if cfg!(target_os = "linux") {
        // Try common Linux file managers
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .or_else(|_| Command::new("nautilus").arg(&path).spawn())
            .or_else(|_| Command::new("dolphin").arg(&path).spawn())
            .or_else(|_| Command::new("thunar").arg(&path).spawn())
    } else {
        return Err("Unsupported operating system".to_string());
    };

    match result {
        Ok(_) => {
            log::info!("Successfully opened folder in explorer");
            Ok(format!("Opened folder: {}", path))
        }
        Err(e) => {
            log::error!("Failed to open folder in explorer: {}", e);
            Err(format!("Failed to open folder: {}", e))
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
    use std::process::Command;

    log::info!("Opening file location: {}", file_path);

    // Get the parent directory of the file
    let path_buf = PathBuf::from(&file_path);
    if !path_buf.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    // Get the parent directory
    let parent_dir = path_buf
        .parent()
        .ok_or_else(|| format!("Could not get parent directory of: {}", file_path))?;

    // Open the folder and select the file based on the operating system
    let result = if cfg!(target_os = "windows") {
        // On Windows, explorer can select a file with /select
        Command::new("explorer")
            .arg(format!("/select,{}", file_path))
            .spawn()
    } else if cfg!(target_os = "macos") {
        // On macOS, we can use open -R to reveal the file
        Command::new("open").arg("-R").arg(&file_path).spawn()
    } else {
        // On Linux, just open the parent directory
        // Different file managers have different ways to select files
        // So we'll just open the parent directory
        Command::new("xdg-open").arg(parent_dir.as_os_str()).spawn()
    };

    match result {
        Ok(_) => {
            log::info!("Successfully opened file location: {}", file_path);
            Ok(format!("Opened file location: {}", file_path))
        }
        Err(e) => {
            log::error!("Failed to open file location: {}", e);
            Err(format!("Failed to open file location: {}", e))
        }
    }
}
