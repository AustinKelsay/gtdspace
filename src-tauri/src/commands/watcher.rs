//! File watcher commands and emitted event payloads.

use notify_debouncer_mini::DebouncedEventKind;
use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

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
struct RunningWatcher {
    handle: tokio::task::JoinHandle<()>,
    shutdown: Arc<AtomicBool>,
}

lazy_static::lazy_static! {
    static ref WATCHER_HANDLE: Arc<Mutex<Option<RunningWatcher>>> = Arc::new(Mutex::new(None));
}

async fn shutdown_running_watcher(watcher_slot: &mut Option<RunningWatcher>) -> bool {
    let Some(running_watcher) = watcher_slot.take() else {
        return false;
    };

    running_watcher.shutdown.store(true, Ordering::SeqCst);

    match running_watcher.handle.await {
        Ok(()) => log::info!("Stopped existing file watcher"),
        Err(error) => log::warn!(
            "File watcher task ended with error during shutdown: {}",
            error
        ),
    }

    true
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
/// import { useErrorHandler } from '@/hooks/useErrorHandler';
///
/// function WatcherControls() {
///   const { withErrorHandling } = useErrorHandler();
///
///   const handleStart = async () => {
///     await withErrorHandling(() =>
///       invoke('startFileWatcher', {
///         folderPath: '/path/to/markdown/files'
///       })
///     );
///   };
///
///   return <button onClick={handleStart}>Start watcher</button>;
/// }
/// ```
#[tauri::command]
pub async fn start_file_watcher(app: AppHandle, folder_path: String) -> Result<String, String> {
    log::info!("Starting file watcher for: {}", folder_path);

    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Invalid directory path".to_string());
    }

    // Stop existing watcher if running
    let mut watcher_guard = WATCHER_HANDLE.lock().await;

    if shutdown_running_watcher(&mut watcher_guard).await {
        log::info!("Stopped existing file watcher before starting a new one");
    }

    let app_handle = app.clone();
    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_for_task = shutdown.clone();

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
        .watch(path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    // Use a blocking task because the notify channel receiver is synchronous.
    let handle = tokio::task::spawn_blocking(move || {
        // Keep debouncer alive in this task
        let _debouncer = debouncer;
        loop {
            if shutdown_for_task.load(Ordering::SeqCst) {
                log::info!("File watcher shutdown requested");
                break;
            }

            match rx.recv_timeout(Duration::from_millis(250)) {
                Ok(Ok(events)) => {
                    for event in events {
                        handle_file_event(&app_handle, &event.path, &event.kind);
                    }
                }
                Ok(Err(e)) => {
                    log::error!("File watcher error: {:?}", e);
                }
                Err(RecvTimeoutError::Timeout) => continue,
                Err(RecvTimeoutError::Disconnected) => {
                    log::info!("File watcher channel closed");
                    break;
                }
            }
        }

        log::info!("File watcher task ended");
    });

    // Store task handle
    *watcher_guard = Some(RunningWatcher { handle, shutdown });
    drop(watcher_guard);

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
/// import { useErrorHandler } from '@/hooks/useErrorHandler';
///
/// function WatcherControls() {
///   const { withErrorHandling } = useErrorHandler();
///
///   const handleStop = async () => {
///     await withErrorHandling(() => invoke('stopFileWatcher'));
///   };
///
///   return <button onClick={handleStop}>Stop watcher</button>;
/// }
/// ```
#[tauri::command]
pub async fn stop_file_watcher() -> Result<String, String> {
    log::info!("Stopping file watcher");

    let mut watcher_guard = WATCHER_HANDLE.lock().await;
    if shutdown_running_watcher(&mut watcher_guard).await {
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
fn handle_file_event(app: &AppHandle, path: &std::path::Path, _kind: &DebouncedEventKind) {
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

    let event_type = "modified".to_string();

    let change_event = FileChangeEvent {
        event_type,
        file_path,
        file_name,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
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
