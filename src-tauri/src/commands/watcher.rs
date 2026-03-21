//! File watcher commands and emitted event payloads.

#[allow(unused_imports)]
use notify_debouncer_mini::{
    new_debouncer,
    notify::{RecursiveMode, Watcher},
    DebouncedEventKind,
};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// File change event for external file modifications
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileChangeEvent {
    /// Type of change that occurred
    pub event_type: String,
    /// Full path of the affected file
    pub file_path: String,
    /// File name without path
    pub file_name: String,
    /// Timestamp of the event
    pub timestamp: u64,
}

// Global file watcher state - stores handle to watcher task
lazy_static::lazy_static! {
    static ref WATCHER_HANDLE: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>> = Arc::new(Mutex::new(None));
}

/// Start file watching service for a folder
///
/// Monitors the specified folder for changes to markdown files and emits
/// events to the frontend when changes are detected.
///
/// # Arguments
///
/// * `app` - Tauri application handle for emitting events
/// * `folder_path` - Directory path to monitor
///
/// # Returns
///
/// Success message or error details
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
///
/// await invoke('start_file_watcher', {
///   folder_path: '/path/to/markdown/files'
/// });
/// ```
#[tauri::command]
pub async fn start_file_watcher(app: AppHandle, folder_path: String) -> Result<String, String> {
    log::info!("Starting file watcher for: {}", folder_path);

    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Invalid directory path".to_string());
    }

    // Stop existing watcher if running
    {
        let mut handle_guard = WATCHER_HANDLE.lock().unwrap();
        if let Some(handle) = handle_guard.take() {
            handle.abort();
            log::info!("Stopped existing file watcher");
        }
    }

    let app_handle = app.clone();

    // Create debounced watcher
    let (tx, rx) = mpsc::channel();
    let mut debouncer = new_debouncer(Duration::from_millis(500), move |result| {
        if let Err(e) = tx.send(result) {
            log::error!("Failed to send file event: {:?}", e);
        }
    })
    .map_err(|e| format!("Failed to create file watcher: {}", e))?;

    // Add path to watcher
    debouncer
        .watcher()
        .watch(path, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    // Use a blocking task because the notify channel receiver is synchronous.
    let handle = tokio::task::spawn_blocking(move || {
        // Keep debouncer alive in this task
        let _debouncer = debouncer;
        let runtime_handle = tokio::runtime::Handle::current();

        loop {
            match rx.recv() {
                Ok(Ok(events)) => {
                    for event in events {
                        runtime_handle.block_on(handle_file_event(
                            &app_handle,
                            &event.path,
                            &event.kind,
                        ));
                    }
                }
                Ok(Err(e)) => {
                    log::error!("File watcher error: {:?}", e);
                }
                Err(_) => {
                    log::info!("File watcher channel closed");
                    break;
                }
            }
        }

        log::info!("File watcher task ended");
    });

    // Store task handle
    {
        let mut handle_guard = WATCHER_HANDLE.lock().unwrap();
        *handle_guard = Some(handle);
    }

    log::info!("File watcher started successfully for: {}", folder_path);
    Ok("File watcher started successfully".to_string())
}

/// Stop the currently running file watcher
///
/// Stops monitoring file changes and cleans up watcher resources.
///
/// # Returns
///
/// Success message or error details
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
///
/// await invoke('stop_file_watcher');
/// ```
#[tauri::command]
pub async fn stop_file_watcher() -> Result<String, String> {
    log::info!("Stopping file watcher");

    let mut handle_guard = WATCHER_HANDLE.lock().unwrap();
    if let Some(handle) = handle_guard.take() {
        handle.abort();
        log::info!("File watcher stopped successfully");
        Ok("File watcher stopped successfully".to_string())
    } else {
        log::info!("No file watcher was running");
        Ok("No file watcher was running".to_string())
    }
}

/// Handle individual file system events
///
/// Processes file change events and emits appropriate events to the frontend.
async fn handle_file_event(app: &AppHandle, path: &std::path::Path, _kind: &DebouncedEventKind) {
    // Only process markdown files
    if let Some(extension) = path.extension() {
        let ext_str = extension.to_string_lossy().to_lowercase();
        if !["md", "markdown"].contains(&ext_str.as_str()) {
            return;
        }
    } else {
        return;
    }

    let file_path = path.to_string_lossy().to_string();
    let file_name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Simplified event type detection - the debouncer abstracts away specific event types
    let event_type = "changed".to_string();

    let change_event = FileChangeEvent {
        event_type,
        file_path,
        file_name,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    };

    log::info!(
        "File change detected: {} - {}",
        change_event.event_type,
        change_event.file_name
    );

    // Emit event to frontend
    if let Err(e) = app.emit("file-changed", &change_event) {
        log::error!("Failed to emit file change event: {}", e);
    }
}
