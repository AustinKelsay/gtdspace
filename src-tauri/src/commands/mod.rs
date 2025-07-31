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
//!
//! # Phase 1 Commands
//!
//! File management and basic editing functionality:
//! - `select_folder()` - Open folder selection dialog
//! - `list_markdown_files()` - List all .md files in a directory
//! - `read_file()` - Read file contents
//! - `save_file()` - Save content to file
//! - `create_file()` - Create new markdown file
//! - `rename_file()` - Rename existing file
//! - `delete_file()` - Delete file
//! - `load_settings()` - Load user settings from persistent storage
//! - `save_settings()` - Save user settings to persistent storage

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;
use std::sync::{Arc, Mutex};
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreBuilder;
use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};

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

/// Represents a markdown file with metadata
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarkdownFile {
    /// Unique identifier for the file
    pub id: String,
    /// File name without path
    pub name: String,
    /// Full file path
    pub path: String,
    /// File size in bytes
    pub size: u64,
    /// Last modification timestamp (Unix timestamp)
    pub last_modified: u64,
    /// File extension (.md, .markdown)
    pub extension: String,
}

/// File operation result for create operations
#[derive(Debug, Serialize, Deserialize)]
pub struct FileOperationResult {
    /// Whether the operation was successful
    pub success: bool,
    /// The file path if successful
    pub path: Option<String>,
    /// Error message if unsuccessful
    pub message: Option<String>,
}

/// User settings structure for persistence
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserSettings {
    /// Theme preference: 'light', 'dark', or 'system'
    pub theme: String,
    /// Editor font size in pixels
    pub font_size: u32,
    /// Tab size for indentation
    pub tab_size: u32,
    /// Whether to wrap long lines
    pub word_wrap: bool,
    /// Last opened folder path
    pub last_folder: Option<String>,
    /// Editor mode preference
    pub editor_mode: String,
    /// Window width (for future use)
    pub window_width: Option<u32>,
    /// Window height (for future use)
    pub window_height: Option<u32>,
}

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

/// Search result item
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    /// File path where match was found
    pub file_path: String,
    /// File name without path
    pub file_name: String,
    /// Line number (0-based)
    pub line_number: usize,
    /// Line content containing the match
    pub line_content: String,
    /// Start position of match within the line
    pub match_start: usize,
    /// End position of match within the line
    pub match_end: usize,
    /// Context lines before the match
    pub context_before: Option<Vec<String>>,
    /// Context lines after the match
    pub context_after: Option<Vec<String>>,
}

/// Search filters and options
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchFilters {
    /// Case sensitive search
    pub case_sensitive: bool,
    /// Whole word matching
    pub whole_word: bool,
    /// Use regular expressions
    pub use_regex: bool,
    /// Include file names in search
    pub include_file_names: bool,
    /// Maximum number of results
    pub max_results: usize,
}

/// Search response from backend
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    /// Search results
    pub results: Vec<SearchResult>,
    /// Total number of matches found
    pub total_matches: usize,
    /// Number of files searched
    pub files_searched: usize,
    /// Search duration in milliseconds
    pub duration_ms: u64,
    /// Whether search was truncated due to limits
    pub truncated: bool,
}

// Global file watcher state - stores handle to watcher task
lazy_static::lazy_static! {
    static ref WATCHER_HANDLE: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>> = Arc::new(Mutex::new(None));
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
    log::info!("Folder selection dialog requested");
    
    match app
        .dialog()
        .file()
        .set_title("Select Folder with Markdown Files")
        .blocking_pick_folder()
    {
        Some(folder_path) => {
            let path_str = folder_path.to_string();
            log::info!("Folder selected: {}", path_str);
            Ok(path_str)
        }
        None => {
            log::info!("Folder selection cancelled by user");
            Err("Folder selection was cancelled".to_string())
        }
    }
}

/// List all markdown files in the specified directory
///
/// Scans the given directory for files with .md and .markdown extensions,
/// returning metadata for each file found. This is used to populate the
/// file browser sidebar.
///
/// # Arguments
///
/// * `path` - Directory path to scan for markdown files
///
/// # Returns
///
/// Vector of MarkdownFile structs with metadata, or error message
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// const files = await invoke('list_markdown_files', { 
///   path: '/Users/username/documents' 
/// });
/// console.log(`Found ${files.length} markdown files`);
/// ```
#[tauri::command]
pub async fn list_markdown_files(path: String) -> Result<Vec<MarkdownFile>, String> {
    log::info!("Listing markdown files in: {}", path);
    
    let dir_path = Path::new(&path);
    
    if !dir_path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    if !dir_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    let mut files = Vec::new();
    let markdown_extensions = ["md", "markdown"];
    
    match fs::read_dir(dir_path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    
                    // Skip directories and non-markdown files
                    if path.is_file() {
                        if let Some(extension) = path.extension() {
                            let ext_str = extension.to_string_lossy().to_lowercase();
                            if markdown_extensions.contains(&ext_str.as_str()) {
                                if let Ok(metadata) = entry.metadata() {
                                    let file_name = path.file_name()
                                        .unwrap_or_default()
                                        .to_string_lossy()
                                        .to_string();
                                    
                                    // Generate simple ID from file path
                                    use std::collections::hash_map::DefaultHasher;
                                    use std::hash::{Hash, Hasher};
                                    let mut hasher = DefaultHasher::new();
                                    path.to_string_lossy().hash(&mut hasher);
                                    let id = format!("{:x}", hasher.finish());
                                    
                                    files.push(MarkdownFile {
                                        id,
                                        name: file_name,
                                        path: path.to_string_lossy().to_string(),
                                        size: metadata.len(),
                                        last_modified: metadata
                                            .modified()
                                            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                                            .duration_since(std::time::SystemTime::UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_secs(),
                                        extension: ext_str,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }
    
    // Sort files by name for consistent ordering
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    log::info!("Found {} markdown files", files.len());
    Ok(files)
}

/// Read the contents of a file
///
/// Reads the entire file contents into memory as a UTF-8 string.
/// Used for loading file content into the editor.
///
/// # Arguments
///
/// * `path` - Full path to the file to read
///
/// # Returns
///
/// File contents as string, or error message if read fails
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// const content = await invoke('read_file', { 
///   path: '/path/to/file.md' 
/// });
/// console.log('File content loaded');
/// ```
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    log::info!("Reading file: {}", path);
    
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }
    
    if !file_path.is_file() {
        return Err("Path is not a file".to_string());
    }
    
    match fs::read_to_string(file_path) {
        Ok(content) => {
            log::info!("Successfully read file: {} ({} bytes)", path, content.len());
            Ok(content)
        }
        Err(e) => {
            log::error!("Failed to read file {}: {}", path, e);
            Err(format!("Failed to read file: {}", e))
        }
    }
}

/// Save content to a file
///
/// Writes the provided content to the specified file path.
/// Creates parent directories if they don't exist.
///
/// # Arguments
///
/// * `path` - Full path where to save the file
/// * `content` - File content to write
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
/// await invoke('save_file', { 
///   path: '/path/to/file.md',
///   content: '# My Document\n\nContent here...'
/// });
/// ```
#[tauri::command]
pub async fn save_file(path: String, content: String) -> Result<String, String> {
    log::info!("Saving file: {} ({} bytes)", path, content.len());
    
    let file_path = Path::new(&path);
    
    // Create parent directories if they don't exist
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            if let Err(e) = fs::create_dir_all(parent) {
                return Err(format!("Failed to create parent directories: {}", e));
            }
        }
    }
    
    match fs::write(file_path, content.as_bytes()) {
        Ok(_) => {
            log::info!("Successfully saved file: {}", path);
            Ok("File saved successfully".to_string())
        }
        Err(e) => {
            log::error!("Failed to save file {}: {}", path, e);
            Err(format!("Failed to save file: {}", e))
        }
    }
}

/// Create a new markdown file
///
/// Creates a new file with the specified name in the given directory.
/// Adds .md extension if not present.
///
/// # Arguments
///
/// * `directory` - Directory where to create the file
/// * `name` - File name (with or without .md extension)
///
/// # Returns
///
/// FileOperationResult with success status and file path
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// const result = await invoke('create_file', { 
///   directory: '/path/to/folder',
///   name: 'new-document'
/// });
/// if (result.success) {
///   console.log('Created:', result.path);
/// }
/// ```
#[tauri::command]
pub async fn create_file(directory: String, name: String) -> Result<FileOperationResult, String> {
    log::info!("Creating file: {} in directory: {}", name, directory);
    
    let dir_path = Path::new(&directory);
    
    if !dir_path.exists() || !dir_path.is_dir() {
        return Ok(FileOperationResult {
            success: false,
            path: None,
            message: Some("Directory does not exist".to_string()),
        });
    }
    
    // Add .md extension if not present
    let file_name = if name.ends_with(".md") || name.ends_with(".markdown") {
        name.clone()
    } else {
        format!("{}.md", name)
    };
    
    let file_path = dir_path.join(&file_name);
    
    // Check if file already exists
    if file_path.exists() {
        return Ok(FileOperationResult {
            success: false,
            path: None,
            message: Some("File already exists".to_string()),
        });
    }
    
    // Create file with basic markdown template
    let template_content = format!("# {}\n\n", name);
    
    match fs::write(&file_path, template_content) {
        Ok(_) => {
            let path_str = file_path.to_string_lossy().to_string();
            log::info!("Successfully created file: {}", path_str);
            Ok(FileOperationResult {
                success: true,
                path: Some(path_str),
                message: Some("File created successfully".to_string()),
            })
        }
        Err(e) => {
            log::error!("Failed to create file {}: {}", file_path.display(), e);
            Ok(FileOperationResult {
                success: false,
                path: None,
                message: Some(format!("Failed to create file: {}", e)),
            })
        }
    }
}

/// Rename an existing file
///
/// Renames a file from old_path to new_name within the same directory.
///
/// # Arguments
///
/// * `old_path` - Current full path of the file
/// * `new_name` - New name for the file (with or without extension)
///
/// # Returns
///
/// FileOperationResult with success status and new file path
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// const result = await invoke('rename_file', { 
///   old_path: '/path/to/old-name.md',
///   new_name: 'new-name'
/// });
/// ```
#[tauri::command]
pub async fn rename_file(old_path: String, new_name: String) -> Result<FileOperationResult, String> {
    log::info!("Renaming file: {} to: {}", old_path, new_name);
    
    let old_file_path = Path::new(&old_path);
    
    if !old_file_path.exists() {
        return Ok(FileOperationResult {
            success: false,
            path: None,
            message: Some("Original file does not exist".to_string()),
        });
    }
    
    let directory = match old_file_path.parent() {
        Some(parent) => parent,
        None => {
            return Ok(FileOperationResult {
                success: false,
                path: None,
                message: Some("Cannot determine parent directory".to_string()),
            });
        }
    };
    
    // Add .md extension if not present
    let file_name = if new_name.ends_with(".md") || new_name.ends_with(".markdown") {
        new_name
    } else {
        format!("{}.md", new_name)
    };
    
    let new_file_path = directory.join(&file_name);
    
    // Check if target file already exists
    if new_file_path.exists() && new_file_path != old_file_path {
        return Ok(FileOperationResult {
            success: false,
            path: None,
            message: Some("A file with that name already exists".to_string()),
        });
    }
    
    match fs::rename(old_file_path, &new_file_path) {
        Ok(_) => {
            let path_str = new_file_path.to_string_lossy().to_string();
            log::info!("Successfully renamed file to: {}", path_str);
            Ok(FileOperationResult {
                success: true,
                path: Some(path_str),
                message: Some("File renamed successfully".to_string()),
            })
        }
        Err(e) => {
            log::error!("Failed to rename file {}: {}", old_path, e);
            Ok(FileOperationResult {
                success: false,
                path: None,
                message: Some(format!("Failed to rename file: {}", e)),
            })
        }
    }
}

/// Delete a file
///
/// Permanently deletes the specified file from the file system.
///
/// # Arguments
///
/// * `path` - Full path of the file to delete
///
/// # Returns
///
/// FileOperationResult with success status
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// const result = await invoke('delete_file', { 
///   path: '/path/to/file.md'
/// });
/// ```
#[tauri::command]
pub async fn delete_file(path: String) -> Result<FileOperationResult, String> {
    log::info!("Deleting file: {}", path);
    
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        return Ok(FileOperationResult {
            success: false,
            path: None,
            message: Some("File does not exist".to_string()),
        });
    }
    
    if !file_path.is_file() {
        return Ok(FileOperationResult {
            success: false,
            path: None,
            message: Some("Path is not a file".to_string()),
        });
    }
    
    match fs::remove_file(file_path) {
        Ok(_) => {
            log::info!("Successfully deleted file: {}", path);
            Ok(FileOperationResult {
                success: true,
                path: Some(path),
                message: Some("File deleted successfully".to_string()),
            })
        }
        Err(e) => {
            log::error!("Failed to delete file {}: {}", path, e);
            Ok(FileOperationResult {
                success: false,
                path: None,
                message: Some(format!("Failed to delete file: {}", e)),
            })
        }
    }
}

/// Load user settings from persistent storage
///
/// Loads user preferences from the store. If settings don't exist, returns default values.
///
/// # Arguments
///
/// * `app` - Tauri application handle for accessing the store
///
/// # Returns
///
/// UserSettings struct with current or default settings
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// const settings = await invoke('load_settings');
/// console.log('Current theme:', settings.theme);
/// ```
#[tauri::command]
pub async fn load_settings(app: AppHandle) -> Result<UserSettings, String> {
    log::info!("Loading user settings");
    
    // Get or create store
    let store = match tauri_plugin_store::StoreExt::get_store(&app, std::path::PathBuf::from("settings.json")) {
        Some(store) => store,
        None => {
            // Create new store if it doesn't exist
            match StoreBuilder::new(&app, std::path::PathBuf::from("settings.json")).build() {
                Ok(store) => store,
                Err(e) => {
                    log::error!("Failed to create settings store: {}", e);
                    return Ok(get_default_settings());
                }
            }
        }
    };
    
    // Load settings from store
    match store.get("user_settings") {
        Some(value) => {
            match serde_json::from_value::<UserSettings>(value) {
                Ok(settings) => {
                    log::info!("Loaded existing settings");
                    Ok(settings)
                }
                Err(e) => {
                    log::warn!("Failed to parse settings, using defaults: {}", e);
                    Ok(get_default_settings())
                }
            }
        }
        None => {
            log::info!("No existing settings found, using defaults");
            Ok(get_default_settings())
        }
    }
}

/// Save user settings to persistent storage
///
/// Saves the provided user settings to the store for persistence across sessions.
///
/// # Arguments
///
/// * `app` - Tauri application handle for accessing the store
/// * `settings` - UserSettings struct to save
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
/// const settings = {
///   theme: 'dark',
///   font_size: 14,
///   // ... other settings
/// };
/// 
/// await invoke('save_settings', { settings });
/// ```
#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: UserSettings) -> Result<String, String> {
    log::info!("Saving user settings");
    
    // Get or create store
    let store = match tauri_plugin_store::StoreExt::get_store(&app, std::path::PathBuf::from("settings.json")) {
        Some(store) => store,
        None => {
            // Create new store if it doesn't exist
            match StoreBuilder::new(&app, std::path::PathBuf::from("settings.json")).build() {
                Ok(store) => store,
                Err(e) => {
                    log::error!("Failed to create settings store: {}", e);
                    return Err(format!("Failed to create settings store: {}", e));
                }
            }
        }
    };
    
    // Save settings to store
    match serde_json::to_value(&settings) {
        Ok(value) => {
            store.set("user_settings", value);
            
            if let Err(e) = store.save() {
                return Err(format!("Failed to persist settings: {}", e));
            }
            
            log::info!("Settings saved successfully");
            Ok("Settings saved successfully".to_string())
        }
        Err(e) => {
            log::error!("Failed to serialize settings: {}", e);
            Err(format!("Failed to serialize settings: {}", e))
        }
    }
}

/// Get default settings values
///
/// Returns a UserSettings struct with sensible defaults for new users.
fn get_default_settings() -> UserSettings {
    UserSettings {
        theme: "dark".to_string(),
        font_size: 14,
        tab_size: 2,
        word_wrap: true,
        last_folder: None,
        editor_mode: "split".to_string(),
        window_width: Some(1200),
        window_height: Some(800),
    }
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
    
    // Spawn background task to handle events
    let handle = tokio::spawn(async move {
        // Keep debouncer alive in this task
        let _debouncer = debouncer;
        
        loop {
            match rx.recv() {
                Ok(Ok(events)) => {
                    for event in events {
                        handle_file_event(&app_handle, &event.path, &event.kind).await;
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

/// Search for text across all markdown files in a directory
///
/// Performs full-text search across all markdown files in the specified directory.
/// Supports various search options including regex, case sensitivity, and whole word matching.
///
/// # Arguments
///
/// * `query` - Search query string
/// * `directory` - Directory path to search in
/// * `filters` - Search filters and options
///
/// # Returns
///
/// SearchResponse with results and metadata
///
/// Copy a file to a new location
///
/// Creates a copy of the specified file at a new location.
/// Handles directory creation if needed.
///
/// # Arguments
///
/// * `source_path` - Full path to the source file
/// * `dest_path` - Full path to the destination file
///
/// # Returns
///
/// Success status or error message if copy fails
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// await invoke('copy_file', { 
///   sourcePath: '/path/to/source.md',
///   destPath: '/path/to/destination.md'
/// });
/// ```
#[tauri::command]
pub async fn copy_file(source_path: String, dest_path: String) -> Result<String, String> {
    log::info!("Copying file from {} to {}", source_path, dest_path);
    
    let source = Path::new(&source_path);
    let dest = Path::new(&dest_path);
    
    // Validate source file exists
    if !source.exists() {
        return Err("Source file does not exist".to_string());
    }
    
    if !source.is_file() {
        return Err("Source path is not a file".to_string());
    }
    
    // Ensure destination directory exists
    if let Some(parent) = dest.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            log::error!("Failed to create destination directory {}: {}", parent.display(), e);
            return Err(format!("Failed to create destination directory: {}", e));
        }
    }
    
    // Check if destination already exists
    if dest.exists() {
        return Err("Destination file already exists".to_string());
    }
    
    // Perform the copy
    match fs::copy(source, dest) {
        Ok(bytes_copied) => {
            log::info!("Successfully copied file: {} ({} bytes)", dest_path, bytes_copied);
            Ok(format!("File copied successfully ({} bytes)", bytes_copied))
        }
        Err(e) => {
            log::error!("Failed to copy file from {} to {}: {}", source_path, dest_path, e);
            Err(format!("Failed to copy file: {}", e))
        }
    }
}

/// Move a file to a new location
///
/// Moves the specified file to a new location, effectively renaming/relocating it.
/// Handles directory creation if needed.
///
/// # Arguments
///
/// * `source_path` - Full path to the source file
/// * `dest_path` - Full path to the destination file
///
/// # Returns
///
/// Success status or error message if move fails
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// await invoke('move_file', { 
///   sourcePath: '/path/to/source.md',
///   destPath: '/path/to/destination.md'
/// });
/// ```
#[tauri::command]
pub async fn move_file(source_path: String, dest_path: String) -> Result<String, String> {
    log::info!("Moving file from {} to {}", source_path, dest_path);
    
    let source = Path::new(&source_path);
    let dest = Path::new(&dest_path);
    
    // Validate source file exists
    if !source.exists() {
        return Err("Source file does not exist".to_string());
    }
    
    if !source.is_file() {
        return Err("Source path is not a file".to_string());
    }
    
    // Ensure destination directory exists
    if let Some(parent) = dest.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            log::error!("Failed to create destination directory {}: {}", parent.display(), e);
            return Err(format!("Failed to create destination directory: {}", e));
        }
    }
    
    // Check if destination already exists
    if dest.exists() {
        return Err("Destination file already exists".to_string());
    }
    
    // Perform the move
    match fs::rename(source, dest) {
        Ok(()) => {
            log::info!("Successfully moved file to: {}", dest_path);
            Ok("File moved successfully".to_string())
        }
        Err(e) => {
            log::error!("Failed to move file from {} to {}: {}", source_path, dest_path, e);
            Err(format!("Failed to move file: {}", e))
        }
    }
}

/// Search across markdown files in a directory
///
/// Performs full-text search across all markdown files in the specified directory
/// with support for various filters and options.
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// const response = await invoke('search_files', {
///   query: 'TODO',
///   directory: '/path/to/markdown/files',
///   filters: {
///     case_sensitive: false,
///     whole_word: true,
///     use_regex: false,
///     include_file_names: true,
///     max_results: 100
///   }
/// });
/// ```
#[tauri::command]
pub async fn search_files(
    query: String,
    directory: String,
    filters: SearchFilters,
) -> Result<SearchResponse, String> {
    let start_time = std::time::Instant::now();
    
    log::info!("Searching for '{}' in directory: {}", query, directory);
    
    let dir_path = Path::new(&directory);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err("Directory does not exist or is not a directory".to_string());
    }

    if query.trim().is_empty() {
        return Ok(SearchResponse {
            results: vec![],
            total_matches: 0,
            files_searched: 0,
            duration_ms: start_time.elapsed().as_millis() as u64,
            truncated: false,
        });
    }

    let mut results = Vec::new();
    let mut files_searched = 0;
    let mut total_matches = 0;
    let markdown_extensions = ["md", "markdown"];

    // Prepare regex if needed
    let regex_pattern = if filters.use_regex {
        match regex::Regex::new(&query) {
            Ok(re) => Some(re),
            Err(e) => return Err(format!("Invalid regex pattern: {}", e)),
        }
    } else {
        None
    };

    // Search through all markdown files
    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                
                if path.is_file() {
                    if let Some(extension) = path.extension() {
                        let ext_str = extension.to_string_lossy().to_lowercase();
                        if markdown_extensions.contains(&ext_str.as_str()) {
                            files_searched += 1;
                            
                            if let Ok(content) = fs::read_to_string(&path) {
                                let file_name = path.file_name()
                                    .unwrap_or_default()
                                    .to_string_lossy()
                                    .to_string();
                                let file_path = path.to_string_lossy().to_string();

                                // Search in file name if enabled
                                if filters.include_file_names {
                                    if let Some(match_result) = search_in_text(&file_name, &query, &filters, &regex_pattern) {
                                        results.push(SearchResult {
                                            file_path: file_path.clone(),
                                            file_name: file_name.clone(),
                                            line_number: 0,
                                            line_content: format!("📁 {}", file_name),
                                            match_start: match_result.0,
                                            match_end: match_result.1,
                                            context_before: None,
                                            context_after: None,
                                        });
                                        total_matches += 1;
                                    }
                                }

                                // Search in file content
                                let lines: Vec<&str> = content.lines().collect();
                                for (line_number, line) in lines.iter().enumerate() {
                                    if let Some(match_result) = search_in_text(line, &query, &filters, &regex_pattern) {
                                        let context_before = if line_number > 0 {
                                            Some(lines.get(line_number.saturating_sub(2)..line_number)
                                                .unwrap_or(&[])
                                                .iter()
                                                .map(|s| s.to_string())
                                                .collect())
                                        } else {
                                            None
                                        };

                                        let context_after = if line_number < lines.len() - 1 {
                                            Some(lines.get(line_number + 1..std::cmp::min(line_number + 3, lines.len()))
                                                .unwrap_or(&[])
                                                .iter()
                                                .map(|s| s.to_string())
                                                .collect())
                                        } else {
                                            None
                                        };

                                        results.push(SearchResult {
                                            file_path: file_path.clone(),
                                            file_name: file_name.clone(),
                                            line_number,
                                            line_content: line.to_string(),
                                            match_start: match_result.0,
                                            match_end: match_result.1,
                                            context_before,
                                            context_after,
                                        });
                                        total_matches += 1;

                                        // Check max results limit
                                        if results.len() >= filters.max_results {
                                            let duration = start_time.elapsed().as_millis() as u64;
                                            log::info!("Search completed with {} results in {}ms (truncated)", results.len(), duration);
                                            return Ok(SearchResponse {
                                                results,
                                                total_matches,
                                                files_searched,
                                                duration_ms: duration,
                                                truncated: true,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let duration = start_time.elapsed().as_millis() as u64;
    log::info!("Search completed with {} results in {}ms", results.len(), duration);

    Ok(SearchResponse {
        results,
        total_matches,
        files_searched,
        duration_ms: duration,
        truncated: false,
    })
}

/// Search for a pattern in text with various options
fn search_in_text(
    text: &str,
    query: &str,
    filters: &SearchFilters,
    regex_pattern: &Option<regex::Regex>,
) -> Option<(usize, usize)> {
    if filters.use_regex {
        if let Some(re) = regex_pattern {
            if let Some(mat) = re.find(text) {
                return Some((mat.start(), mat.end()));
            }
        }
        return None;
    }

    let search_text = if filters.case_sensitive { text } else { &text.to_lowercase() };
    let search_query = if filters.case_sensitive { query } else { &query.to_lowercase() };

    if filters.whole_word {
        // Find word boundaries
        let words: Vec<&str> = search_text.split_whitespace().collect();
        for (i, word) in words.iter().enumerate() {
            if word == &search_query {
                // Calculate position in original text
                let mut pos = 0;
                for j in 0..i {
                    pos += words[j].len() + 1; // +1 for space
                }
                return Some((pos, pos + query.len()));
            }
        }
        None
    } else {
        search_text.find(search_query).map(|start| (start, start + query.len()))
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
    let file_name = path.file_name()
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
    
    log::info!("File change detected: {} - {}", change_event.event_type, change_event.file_name);
    
    // Emit event to frontend
    if let Err(e) = app.emit("file-changed", &change_event) {
        log::error!("Failed to emit file change event: {}", e);
    }
}

/// Replace text in a file with new content
///
/// Replaces all occurrences of a search term with a replacement term in the specified file.
/// Supports both simple string replacement and regex patterns.
///
/// # Arguments
///
/// * `file_path` - Path to the file to modify
/// * `search_term` - Text to search for (can be regex if contains regex characters)
/// * `replace_term` - Text to replace matches with
///
/// # Returns
///
/// Success message with number of replacements or error details
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// await invoke('replace_in_file', {
///   file_path: '/path/to/file.md',
///   search_term: 'TODO',
///   replace_term: 'DONE'
/// });
/// ```
#[tauri::command]
pub async fn replace_in_file(file_path: String, search_term: String, replace_term: String) -> Result<String, String> {
    log::info!("Replacing '{}' with '{}' in file: {}", search_term, replace_term, file_path);
    
    // Validate file path
    let path = Path::new(&file_path);
    
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    
    if !path.is_file() {
        return Err(format!("Path is not a file: {}", file_path));
    }
    
    // Read the file content
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(e) => return Err(format!("Failed to read file: {}", e)),
    };
    
    // Perform replacement
    let new_content = if search_term.contains("\\") || search_term.contains(".*") || search_term.contains("+") {
        // Treat as regex if it contains regex special characters
        match regex::Regex::new(&search_term) {
            Ok(regex) => regex.replace_all(&content, replace_term.as_str()).to_string(),
            Err(e) => return Err(format!("Invalid regex pattern: {}", e)),
        }
    } else {
        // Simple string replacement
        content.replace(&search_term, &replace_term)
    };
    
    // Count replacements made
    let original_matches = content.matches(&search_term).count();
    let new_matches = new_content.matches(&search_term).count();
    let replacements_made = original_matches - new_matches;
    
    if replacements_made == 0 {
        return Ok(format!("No matches found for '{}' in {}", search_term, path.file_name().unwrap_or_default().to_string_lossy()));
    }
    
    // Write the updated content back to the file
    match fs::write(path, new_content) {
        Ok(_) => {
            log::info!("Successfully replaced {} occurrence(s) in {}", replacements_made, file_path);
            Ok(format!("Replaced {} occurrence(s) of '{}' with '{}' in {}", 
                       replacements_made, search_term, replace_term, 
                       path.file_name().unwrap_or_default().to_string_lossy()))
        }
        Err(e) => Err(format!("Failed to write file: {}", e)),
    }
}

/// Initialize GTD space structure
///
/// Creates the standard GTD directory structure in the specified path:
/// - Projects/ (contains project folders with README.md files)
/// - Habits/ (for habit tracking)
/// - Someday Maybe/ (for future ideas)
/// - Cabinet/ (for reference materials)
///
/// # Arguments
///
/// * `space_path` - Full path where to create the GTD space
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
/// await invoke('initialize_gtd_space', { 
///   space_path: '/path/to/my/gtd/space' 
/// });
/// ```
#[tauri::command]
pub async fn initialize_gtd_space(space_path: String) -> Result<String, String> {
    log::info!("Initializing GTD space at: {}", space_path);
    
    let root_path = Path::new(&space_path);
    
    // Create root directory if it doesn't exist
    if !root_path.exists() {
        if let Err(e) = fs::create_dir_all(root_path) {
            return Err(format!("Failed to create root directory: {}", e));
        }
    }
    
    // GTD directories to create
    let directories = [
        "Projects",
        "Habits",
        "Someday Maybe",
        "Cabinet",
    ];
    
    let mut created_dirs = Vec::new();
    
    for dir_name in &directories {
        let dir_path = root_path.join(dir_name);
        
        if dir_path.exists() {
            log::info!("Directory already exists: {}", dir_name);
        } else {
            if let Err(e) = fs::create_dir_all(&dir_path) {
                return Err(format!("Failed to create {} directory: {}", dir_name, e));
            }
            created_dirs.push(dir_name.to_string());
            log::info!("Created directory: {}", dir_name);
        }
    }
    
    // Create a welcome file in the root directory
    let welcome_path = root_path.join("Welcome to GTD Space.md");
    if !welcome_path.exists() {
        let welcome_content = r#"# Welcome to Your GTD Space

This is your personal Getting Things Done (GTD) space. The directory structure has been set up to help you organize your life:

## 📁 Projects
Contains all your active projects. Each project is a folder with:
- A README.md file containing project details
- Individual action files (markdown) for tasks

### Project Structure:
```
Projects/
├── Project Name/
│   ├── README.md (Description, Due Date, Status)
│   ├── action-1.md (Status, Due Date, Effort)
│   └── action-2.md
```

## 📁 Habits
Track your recurring habits and routines.

## 📁 Someday Maybe
Ideas and projects for future consideration.

## 📁 Cabinet
Reference materials and documents that don't require action.

---

Start by creating your first project in the Projects folder!
"#;
        
        if let Err(e) = fs::write(&welcome_path, welcome_content) {
            log::warn!("Failed to create welcome file: {}", e);
        } else {
            log::info!("Created welcome file");
        }
    }
    
    let message = if created_dirs.is_empty() {
        "GTD space already initialized".to_string()
    } else {
        format!("GTD space initialized. Created directories: {}", created_dirs.join(", "))
    };
    
    Ok(message)
}

/// Create a new GTD project
///
/// Creates a new project folder with a README.md template in the Projects directory.
///
/// # Arguments
///
/// * `space_path` - Path to the GTD space root
/// * `project_name` - Name of the project
/// * `description` - Project description
/// * `due_date` - Optional due date (ISO format: YYYY-MM-DD)
///
/// # Returns
///
/// Path to the created project or error details
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// await invoke('create_gtd_project', { 
///   space_path: '/path/to/gtd/space',
///   project_name: 'Build Website',
///   description: 'Create company website',
///   due_date: '2024-12-31'
/// });
/// ```
#[tauri::command]
pub async fn create_gtd_project(
    space_path: String,
    project_name: String,
    description: String,
    due_date: Option<String>,
) -> Result<String, String> {
    log::info!("Creating GTD project: {}", project_name);
    
    let projects_path = Path::new(&space_path).join("Projects");
    
    // Ensure Projects directory exists
    if !projects_path.exists() {
        return Err("Projects directory does not exist. Initialize GTD space first.".to_string());
    }
    
    // Create project folder
    let project_path = projects_path.join(&project_name);
    
    if project_path.exists() {
        return Err(format!("Project '{}' already exists", project_name));
    }
    
    if let Err(e) = fs::create_dir_all(&project_path) {
        return Err(format!("Failed to create project directory: {}", e));
    }
    
    // Create README.md with project template
    let readme_path = project_path.join("README.md");
    let readme_content = format!(
        r#"# {}

## Description
{}

## Due Date
{}

## Status
Active

## Actions
Actions for this project are stored as individual markdown files in this directory.

### Action Template
Each action file should contain:
- **Status**: Not Started / In Progress / Complete
- **Due Date**: (optional)
- **Effort**: Small / Medium / Large

---
Created: {}
"#,
        project_name,
        description,
        due_date.as_deref().unwrap_or("Not set"),
        chrono::Local::now().format("%Y-%m-%d")
    );
    
    if let Err(e) = fs::write(&readme_path, readme_content) {
        // Clean up project directory if README creation fails
        let _ = fs::remove_dir(&project_path);
        return Err(format!("Failed to create project README: {}", e));
    }
    
    log::info!("Successfully created project: {}", project_name);
    Ok(project_path.to_string_lossy().to_string())
}

/// Create a new GTD action
///
/// Creates a new action (task) file within a project directory.
///
/// # Arguments
///
/// * `project_path` - Full path to the project directory
/// * `action_name` - Name of the action
/// * `status` - Initial status (Not Started / In Progress / Complete)
/// * `due_date` - Optional due date (ISO format: YYYY-MM-DD)
/// * `effort` - Effort estimate (Small / Medium / Large)
///
/// # Returns
///
/// Path to the created action file or error details
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// await invoke('create_gtd_action', { 
///   project_path: '/path/to/gtd/space/Projects/Build Website',
///   action_name: 'Design homepage',
///   status: 'Not Started',
///   due_date: '2024-11-15',
///   effort: 'Medium'
/// });
/// ```
#[tauri::command]
pub async fn create_gtd_action(
    project_path: String,
    action_name: String,
    status: String,
    due_date: Option<String>,
    effort: String,
) -> Result<String, String> {
    log::info!("Creating GTD action: {} in project: {}", action_name, project_path);
    
    let project_dir = Path::new(&project_path);
    
    if !project_dir.exists() || !project_dir.is_dir() {
        return Err("Project directory does not exist".to_string());
    }
    
    // Sanitize action name for filename
    let file_name = format!("{}.md", action_name.replace('/', "-"));
    let action_path = project_dir.join(&file_name);
    
    if action_path.exists() {
        return Err(format!("Action '{}' already exists", action_name));
    }
    
    // Create action file with template
    let action_content = format!(
        r#"# {}

## Status
{}

## Due Date
{}

## Effort
{}

## Notes
<!-- Add any additional notes or details about this action here -->

---
Created: {}
"#,
        action_name,
        status,
        due_date.as_deref().unwrap_or("Not set"),
        effort,
        chrono::Local::now().format("%Y-%m-%d %H:%M")
    );
    
    match fs::write(&action_path, action_content) {
        Ok(_) => {
            log::info!("Successfully created action: {}", action_name);
            Ok(action_path.to_string_lossy().to_string())
        }
        Err(e) => Err(format!("Failed to create action file: {}", e))
    }
}

/// GTD Project metadata structure
#[derive(Debug, Serialize, Deserialize)]
pub struct GTDProject {
    /// Project name
    pub name: String,
    /// Project description
    pub description: String,
    /// Due date (optional)
    pub due_date: Option<String>,
    /// Project status
    pub status: String,
    /// Full path to project directory
    pub path: String,
    /// Created date
    pub created_date: String,
    /// Number of actions in the project
    pub action_count: u32,
}

/// List all GTD projects in a space
///
/// Scans the Projects directory for project folders and extracts metadata
/// from their README.md files.
///
/// # Arguments
///
/// * `space_path` - Path to the GTD space root
///
/// # Returns
///
/// Vector of GTDProject structs or error details
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// const projects = await invoke('list_gtd_projects', { 
///   space_path: '/path/to/gtd/space' 
/// });
/// ```
#[tauri::command]
pub async fn list_gtd_projects(space_path: String) -> Result<Vec<GTDProject>, String> {
    log::info!("Listing GTD projects in: {}", space_path);
    
    let projects_path = Path::new(&space_path).join("Projects");
    
    if !projects_path.exists() {
        return Err("Projects directory does not exist".to_string());
    }
    
    let mut projects = Vec::new();
    
    // Read all directories in Projects folder
    match fs::read_dir(&projects_path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    
                    // Only process directories
                    if path.is_dir() {
                        let project_name = path.file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        
                        // Read README.md to extract project metadata
                        let readme_path = path.join("README.md");
                        
                        let (description, due_date, status, created_date) = if readme_path.exists() {
                            match fs::read_to_string(&readme_path) {
                                Ok(content) => parse_project_readme(&content),
                                Err(_) => (
                                    "No description available".to_string(),
                                    None,
                                    "Active".to_string(),
                                    "Unknown".to_string()
                                ),
                            }
                        } else {
                            (
                                "No description available".to_string(),
                                None,
                                "Active".to_string(),
                                "Unknown".to_string()
                            )
                        };
                        
                        // Count action files in the project
                        let action_count = count_project_actions(&path);
                        
                        projects.push(GTDProject {
                            name: project_name,
                            description,
                            due_date,
                            status,
                            path: path.to_string_lossy().to_string(),
                            created_date,
                            action_count,
                        });
                    }
                }
            }
        }
        Err(e) => return Err(format!("Failed to read projects directory: {}", e)),
    }
    
    // Sort projects by name
    projects.sort_by(|a, b| a.name.cmp(&b.name));
    
    log::info!("Found {} GTD projects", projects.len());
    Ok(projects)
}

/// Parse project README.md to extract metadata
fn parse_project_readme(content: &str) -> (String, Option<String>, String, String) {
    let mut description = "No description available".to_string();
    let mut due_date = None;
    let mut status = "Active".to_string();
    let mut created_date = "Unknown".to_string();
    
    let lines: Vec<&str> = content.lines().collect();
    let mut current_section = "";
    
    for line in lines {
        let trimmed = line.trim();
        
        // Detect section headers
        if trimmed.starts_with("## Description") {
            current_section = "description";
        } else if trimmed.starts_with("## Due Date") {
            current_section = "due_date";
        } else if trimmed.starts_with("## Status") {
            current_section = "status";
        } else if trimmed.starts_with("Created:") {
            created_date = trimmed.replace("Created:", "").trim().to_string();
        } else if trimmed.starts_with("##") {
            current_section = "";
        } else if !trimmed.is_empty() && !trimmed.starts_with('#') {
            // Parse content based on current section
            match current_section {
                "description" => {
                    if description == "No description available" {
                        description = trimmed.to_string();
                    }
                }
                "due_date" => {
                    if trimmed != "Not set" {
                        due_date = Some(trimmed.to_string());
                    }
                }
                "status" => {
                    status = trimmed.to_string();
                }
                _ => {}
            }
        }
    }
    
    (description, due_date, status, created_date)
}

/// Count the number of action files in a project directory
fn count_project_actions(project_path: &Path) -> u32 {
    let mut count = 0;
    
    if let Ok(entries) = fs::read_dir(project_path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    if let Some(extension) = path.extension() {
                        if extension == "md" && path.file_name() != Some(std::ffi::OsStr::new("README.md")) {
                            count += 1;
                        }
                    }
                }
            }
        }
    }
    
    count
}