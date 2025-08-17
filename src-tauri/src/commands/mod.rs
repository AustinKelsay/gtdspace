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

use chrono::{Datelike, Timelike};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::path::PathBuf;
use std::fs;
use std::sync::{Arc, Mutex};
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreBuilder;
use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use regex::Regex;
use once_cell::sync::Lazy;

// ===== REGEX PATTERNS FOR HABIT PARSING =====
// Define regex patterns as static constants to avoid duplication and ensure consistency

/// Regex for parsing habit history table entries
/// Format: | Date | Time | Status | Action | Notes |
static HABIT_HISTORY_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\| (\d{4}-\d{2}-\d{2}) \| (\d{2}:\d{2}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|")
        .expect("Invalid habit history regex pattern")
});

/// Regex for extracting creation date from habit file
/// Format: ## Created\nYYYY-MM-DD
static HABIT_CREATED_DATE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"## Created\n(\d{4}-\d{2}-\d{2})")
        .expect("Invalid habit created date regex pattern")
});

/// Regex for extracting habit status field
/// Format: [!singleselect:habit-status:VALUE]
static HABIT_STATUS_FIELD_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[!singleselect:habit-status:([^\]]+)\]")
        .expect("Invalid habit status field regex pattern")
});

/// Regex for extracting habit frequency field
/// Format: [!singleselect:habit-frequency:VALUE]
static HABIT_FREQUENCY_FIELD_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[!singleselect:habit-frequency:([^\]]+)\]")
        .expect("Invalid habit frequency field regex pattern")
});

/// Helper function to parse the last action time from a habit file's history
fn parse_last_habit_action_time(content: &str) -> Option<chrono::NaiveDateTime> {
    let mut last_action_time = None;
    
    // Parse history table entries
    for cap in HABIT_HISTORY_REGEX.captures_iter(content) {
        if let (Some(date_str), Some(time_str)) = (cap.get(1), cap.get(2)) {
            let datetime_str = format!("{} {}", date_str.as_str(), time_str.as_str());
            if let Ok(time) = chrono::NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%d %H:%M") {
                if last_action_time.is_none() || last_action_time < Some(time) {
                    last_action_time = Some(time);
                }
            }
        }
    }
    
    // If no history entries found, check the Created date
    if last_action_time.is_none() {
        if let Some(cap) = HABIT_CREATED_DATE_REGEX.captures(content) {
            if let Some(date_str) = cap.get(1) {
                if let Ok(date) = chrono::NaiveDate::parse_from_str(date_str.as_str(), "%Y-%m-%d") {
                    last_action_time = Some(date.and_hms_opt(0, 0, 0).unwrap());
                }
            }
        }
    }
    
    last_action_time
}

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
    /// Auto-initialize default GTD space on startup (optional; defaults to true)
    pub auto_initialize: Option<bool>,
    /// Seed example content on first run (optional; defaults to true)
    pub seed_example_content: Option<bool>,
    /// Preferred default GTD space path override
    pub default_space_path: Option<String>,
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
pub fn ping() -> Result<String, String> {
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
        Command::new("explorer")
            .arg(&path)
            .spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open")
            .arg(&path)
            .spawn()
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
    let parent_dir = path_buf.parent()
        .ok_or_else(|| format!("Could not get parent directory of: {}", file_path))?;
    
    // Open the folder and select the file based on the operating system
    let result = if cfg!(target_os = "windows") {
        // On Windows, explorer can select a file with /select
        Command::new("explorer")
            .arg("/select,")
            .arg(&file_path)
            .spawn()
    } else if cfg!(target_os = "macos") {
        // On macOS, we can use open -R to reveal the file
        Command::new("open")
            .arg("-R")
            .arg(&file_path)
            .spawn()
    } else {
        // On Linux, just open the parent directory
        // Different file managers have different ways to select files
        // So we'll just open the parent directory
        Command::new("xdg-open")
            .arg(parent_dir.to_str().unwrap_or(&file_path))
            .spawn()
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

/// Get the default GTD space path for the current user
///
/// Returns a platform-appropriate path in the user's home directory:
/// - macOS/Linux: "$HOME/GTD Space"
/// - Windows: "%USERPROFILE%\\GTD Space"
#[tauri::command]
pub async fn get_default_gtd_space_path() -> Result<String, String> {
    fn home_dir() -> Option<PathBuf> {
        if cfg!(target_os = "windows") {
            std::env::var_os("USERPROFILE").map(PathBuf::from)
        } else {
            std::env::var_os("HOME").map(PathBuf::from)
        }
    }

    match home_dir() {
        Some(home) => {
            let default_path = home.join("GTD Space");
            Ok(default_path.to_string_lossy().to_string())
        }
        None => Err("Unable to determine user home directory".to_string()),
    }
}

/// Helper function to recursively scan directories for markdown files
fn scan_directory_recursive(dir_path: &Path, files: &mut Vec<MarkdownFile>) -> Result<(), String> {
    let markdown_extensions = ["md", "markdown"];
    
    match fs::read_dir(dir_path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    
                    // Recursively scan subdirectories
                    if path.is_dir() {
                        // Skip hidden directories (starting with .)
                        if let Some(dir_name) = path.file_name() {
                            if !dir_name.to_string_lossy().starts_with('.') {
                                scan_directory_recursive(&path, files)?;
                            }
                        }
                    } else if path.is_file() {
                        // Process markdown files
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
            Ok(())
        }
        Err(e) => Err(format!("Failed to read directory: {}", e)),
    }
}

/// List all markdown files in the specified directory and its subdirectories
///
/// Recursively scans the given directory for files with .md and .markdown extensions,
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
    log::info!("Listing markdown files recursively in: {}", path);
    
    let dir_path = Path::new(&path);
    
    if !dir_path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    if !dir_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    let mut files = Vec::new();
    
    // Recursively scan the directory
    scan_directory_recursive(dir_path, &mut files)?;
    
    // Sort files by path for consistent ordering
    files.sort_by(|a, b| a.path.to_lowercase().cmp(&b.path.to_lowercase()));
    
    log::info!("Found {} markdown files", files.len());
    Ok(files)
}

/// List only project action files (markdown) in a project directory
/// Skips the project's README.md
#[tauri::command]
pub async fn list_project_actions(project_path: String) -> Result<Vec<MarkdownFile>, String> {
    log::info!("Listing project actions in: {}", project_path);

    let dir_path = Path::new(&project_path);
    if !dir_path.exists() {
        return Err("Project directory does not exist".to_string());
    }
    if !dir_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let mut files = Vec::new();
    match fs::read_dir(dir_path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(extension) = path.extension() {
                            let ext_str = extension.to_string_lossy().to_lowercase();
                            if (ext_str == "md" || ext_str == "markdown")
                                && path.file_name() != Some(std::ffi::OsStr::new("README.md"))
                            {
                                if let Ok(metadata) = entry.metadata() {
                                    use std::collections::hash_map::DefaultHasher;
                                    use std::hash::{Hash, Hasher};
                                    let mut hasher = DefaultHasher::new();
                                    path.to_string_lossy().hash(&mut hasher);
                                    let id = format!("{:x}", hasher.finish());

                                    files.push(MarkdownFile {
                                        id,
                                        name: path
                                            .file_name()
                                            .unwrap_or_default()
                                            .to_string_lossy()
                                            .to_string(),
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
        Err(e) => return Err(format!("Failed to read project directory: {}", e)),
    }

    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    log::info!("Found {} project actions", files.len());
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
pub fn read_file(path: String) -> Result<String, String> {
    log::info!("read_file command called with path: {}", path);
    
    let file_path = Path::new(&path);
    
    if !file_path.exists() {
        log::error!("File does not exist: {}", path);
        return Err(format!("File does not exist: {}", path));
    }
    
    if !file_path.is_file() {
        log::error!("Path is not a file: {}", path);
        return Err(format!("Path is not a file: {}", path));
    }
    
    match fs::read_to_string(file_path) {
        Ok(content) => {
            log::info!("Successfully read file: {} ({} bytes)", path, content.len());
            Ok(content)
        }
        Err(e) => {
            log::error!("Failed to read file {}: {:?}", path, e);
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
pub fn save_file(path: String, content: String) -> Result<String, String> {
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
    
    // Check if we're in a GTD Projects directory
    let is_in_projects = dir_path
        .components()
        .any(|c| c.as_os_str() == "Projects");
    
    // Check if this is a project directory (has README.md)
    let is_project_dir = dir_path.join("README.md").exists();
    
    // Create appropriate template content
    let template_content = if is_in_projects && is_project_dir {
        // Use GTD action template with single select and datetime fields
        let clean_name = name.trim_end_matches(".md");
        format!(
            r#"# {}

## Status
[!singleselect:status:in-progress]

## Focus Date
[!datetime:focus_date_time:]

## Due Date
[!datetime:due_date:]

## Effort
[!singleselect:effort:medium]

## Notes
<!-- Add any additional notes or details about this action here -->

---
[!datetime:created_date_time:{}]
"#,
            clean_name,
            chrono::Local::now().to_rfc3339()
        )
    } else {
        // Use basic template for non-GTD files
        let clean_name = name.trim_end_matches(".md");
        format!("# {}\n\n", clean_name)
    };
    
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
pub fn delete_file(path: String) -> Result<FileOperationResult, String> {
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

/// Delete a folder and all its contents
/// 
/// # Example
/// ```javascript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// const result = await invoke('delete_folder', { 
///   path: '/path/to/folder'
/// });
/// ```
#[tauri::command]
pub fn delete_folder(path: String) -> Result<FileOperationResult, String> {
    log::info!("Deleting folder: {}", path);
    
    let folder_path = Path::new(&path);
    
    if !folder_path.exists() {
        return Ok(FileOperationResult {
            success: false,
            path: None,
            message: Some("Folder does not exist".to_string()),
        });
    }
    
    if !folder_path.is_dir() {
        return Ok(FileOperationResult {
            success: false,
            path: None,
            message: Some("Path is not a folder".to_string()),
        });
    }
    
    match fs::remove_dir_all(folder_path) {
        Ok(_) => {
            log::info!("Successfully deleted folder: {}", path);
            Ok(FileOperationResult {
                success: true,
                path: Some(path),
                message: Some("Folder deleted successfully".to_string()),
            })
        }
        Err(e) => {
            log::error!("Failed to delete folder {}: {}", path, e);
            Ok(FileOperationResult {
                success: false,
                path: None,
                message: Some(format!("Failed to delete folder: {}", e)),
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
        auto_initialize: Some(true),
        seed_example_content: Some(true),
        default_space_path: None,
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
        
        let preexisted = dir_path.exists();
        match fs::create_dir_all(&dir_path) {
            Ok(_) => {
                if !preexisted {
                    created_dirs.push(dir_name.to_string());
                    log::info!("Created directory: {}", dir_name);
                } else {
                    log::info!("Directory already exists: {}", dir_name);
                }
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::AlreadyExists {
                    log::info!("Directory already exists: {}", dir_name);
                } else {
                    return Err(format!("Failed to create {} directory: {}", dir_name, e));
                }
            }
        }
        
        // Create example files immediately after creating directories
        match *dir_name {
            "Someday Maybe" => {
                let example_file = dir_path.join("Learn a New Language.md");
                if !example_file.exists() {
                    let content = r#"# Learn a New Language

## Idea

I've always wanted to learn Spanish to connect better with Spanish-speaking communities and travel more confidently in Latin America and Spain.

## Why it matters

- Opens up communication with 500+ million Spanish speakers worldwide
- Enhances travel experiences in 20+ countries
- Cognitive benefits of bilingualism
- Career advancement opportunities
- Cultural enrichment and understanding

## Next steps when ready

- [ ] Research language learning methods (apps, classes, tutors)
- [ ] Set a realistic timeline and daily practice goal
- [ ] Find a conversation partner or language exchange
- [ ] Plan an immersion trip as a goal/reward
- [ ] Start with basic conversational phrases
"#;
                    if let Err(e) = fs::write(&example_file, content) {
                        log::warn!("Failed to create example Someday Maybe page: {}", e);
                    } else {
                        log::info!("Created example Someday Maybe page: Learn a New Language.md");
                    }
                }
            },
            "Cabinet" => {
                let example_file = dir_path.join("GTD Principles Reference.md");
                if !example_file.exists() {
                    let content = r#"# GTD Principles Reference

## Reference

The Getting Things Done (GTD) methodology by David Allen - Core principles and practices.

## Key Points

- **Capture**: Collect what has your attention in trusted external systems
- **Clarify**: Process what it means and what to do about it
- **Organize**: Put it where it belongs based on what it is
- **Reflect**: Review frequently to stay current and aligned
- **Engage**: Use your trusted system to take action with confidence

## Notes

### The Five Steps of Mastering Workflow

1. **Capture** everything that has your attention
2. **Clarify** what each item means and what to do about it
3. **Organize** the results into trusted external systems
4. **Reflect** on your system regularly to keep it current
5. **Engage** with confidence in your moment-to-moment choices

### The Two-Minute Rule
If something takes less than two minutes to complete, do it now rather than adding it to your list.

### Weekly Review
- Get clear: Collect loose papers and materials, empty your head
- Get current: Review action lists, calendar, waiting-for lists
- Get creative: Review someday/maybe lists, trigger new ideas

### Natural Planning Model
1. Define purpose and principles
2. Envision the outcome
3. Brainstorm ideas
4. Organize into structure
5. Identify next actions
"#;
                    if let Err(e) = fs::write(&example_file, content) {
                        log::warn!("Failed to create example Cabinet page: {}", e);
                    } else {
                        log::info!("Created example Cabinet page: GTD Principles Reference.md");
                    }
                }
            },
            _ => {}
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

/// Seed the GTD space with example projects and actions
///
/// This creates a small set of demo projects and actions that showcase
/// statuses, focus dates, due dates, and effort levels. If the Projects
/// directory already contains subdirectories, seeding is skipped.
#[tauri::command]
pub async fn seed_example_gtd_content(space_path: String) -> Result<String, String> {
    let projects_root = Path::new(&space_path).join("Projects");

    if !projects_root.exists() {
        return Err("Projects directory does not exist. Initialize GTD space first.".to_string());
    }

    // If a seed marker exists, skip seeding
    let seed_marker = Path::new(&space_path).join(".gtdspace_seeded");
    if seed_marker.exists() {
        return Ok("Example content already seeded".to_string());
    }

    // Detect if any project directories already exist
    let mut has_any_projects = false;
    if let Ok(entries) = fs::read_dir(&projects_root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                has_any_projects = true;
                break;
            }
        }
    }

    if has_any_projects {
        // Still write a marker so we don't attempt again
        let _ = fs::write(&seed_marker, "seeded: existing-projects");
        return Ok("Projects already exist; skipping example seeding".to_string());
    }

    // Helper to safely create a project and ignore "already exists" errors
    async fn ensure_project(
        space_path: &str,
        name: &str,
        description: &str,
        due_date: Option<String>,
        status: Option<String>,
    ) -> Result<String, String> {
        match create_gtd_project(
            space_path.to_string(),
            name.to_string(),
            description.to_string(),
            due_date,
            status,
        )
        .await
        {
            Ok(path) => Ok(path),
            Err(e) => {
                // If it already exists, compute the expected path and return it
                if e.contains("already exists") {
                    Ok(Path::new(space_path)
                        .join("Projects")
                        .join(name)
                        .to_string_lossy()
                        .to_string())
                } else {
                    Err(e)
                }
            }
        }
    }

    // Project 1: Getting Started (with due date 3 days from now)
    let three_days = chrono::Local::now() + chrono::Duration::days(3);
    let project1_path = ensure_project(
        &space_path,
        "Getting Started",
        "A quick tour of how GTD Space works.",
        Some(three_days.format("%Y-%m-%d").to_string()),
        Some("in-progress".to_string()),
    )
    .await?;

    // Actions for Project 1 with various dates
    let tomorrow = chrono::Local::now() + chrono::Duration::days(1);
    let _ = create_gtd_action(
        project1_path.clone(),
        "Read the welcome file".to_string(),
        "in-progress".to_string(),
        Some(tomorrow.format("%Y-%m-%d").to_string()),  // Due tomorrow
        Some(chrono::Local::now().to_rfc3339()),  // Focus today
        "small".to_string(),
    )
    .await;

    let two_days = chrono::Local::now() + chrono::Duration::days(2);
    let _ = create_gtd_action(
        project1_path.clone(),
        "Create your first project".to_string(),
        "waiting".to_string(),
        Some(three_days.format("%Y-%m-%d").to_string()),  // Due in 3 days
        Some(two_days.to_rfc3339()),  // Focus in 2 days
        "medium".to_string(),
    )
    .await;

    let _ = create_gtd_action(
        project1_path.clone(),
        "Mark a task complete".to_string(),
        "complete".to_string(),
        None,
        None,
        "small".to_string(),
    )
    .await;

    // Project 2: Demo Project - Website
    let seven_days = chrono::Local::now() + chrono::Duration::days(7);

    let project2_path = ensure_project(
        &space_path,
        "Demo Project - Website",
        "Build a simple marketing website.",
        Some(seven_days.format("%Y-%m-%d").to_string()),
        Some("in-progress".to_string()),
    )
    .await?;

    let _ = create_gtd_action(
        project2_path.clone(),
        "Design homepage".to_string(),
        "in-progress".to_string(),
        Some(seven_days.format("%Y-%m-%d").to_string()),  // Due in 7 days
        Some(tomorrow.to_rfc3339()),  // Focus tomorrow
        "large".to_string(),
    )
    .await;

    let _ = create_gtd_action(
        project2_path.clone(),
        "Set up repository".to_string(),
        "complete".to_string(),
        None,
        None,
        "small".to_string(),
    )
    .await;

    let five_days = chrono::Local::now() + chrono::Duration::days(5);
    let _ = create_gtd_action(
        project2_path.clone(),
        "Plan content".to_string(),
        "waiting".to_string(),
        Some(seven_days.format("%Y-%m-%d").to_string()),  // Due in 7 days
        Some(five_days.to_rfc3339()),  // Focus in 5 days
        "medium".to_string(),
    )
    .await;

    // Project 3: Completed Example
    let project3_path = ensure_project(
        &space_path,
        "Completed Example",
        "An example of a finished project.",
        None,
        Some("completed".to_string()),
    )
    .await?;

    let _ = create_gtd_action(
        project3_path,
        "Wrap up and archive".to_string(),
        "Complete".to_string(),
        None,
        None,
        "Small".to_string(),
    )
    .await;

    // Create example Habits with dates
    let habits_dir = Path::new(&space_path).join("Habits");
    if habits_dir.exists() {
        // Morning Review habit (daily with focus time)
        let morning_review = habits_dir.join("Morning Review.md");
        if !morning_review.exists() {
            let morning_time = chrono::Local::now()
                .with_hour(9)
                .unwrap()
                .with_minute(0)
                .unwrap()
                .with_second(0)
                .unwrap();
            let content = format!(r#"# Morning Review

## Frequency
[!singleselect:habit-frequency:daily]

## Status
[!checkbox:habit-status:false]

## Focus Time
[!datetime:focus_date_time:{}]

## Notes
Review today's actions and priorities. Check calendar, update task statuses, and set focus for the day.

---
Created: {}"#, 
                morning_time.to_rfc3339(),
                chrono::Local::now().format("%Y-%m-%d")
            );
            let _ = fs::write(&morning_review, content);
        }

        // Evening Journal habit (daily with evening focus time)
        let evening_journal = habits_dir.join("Evening Journal.md");
        if !evening_journal.exists() {
            let evening_time = chrono::Local::now()
                .with_hour(20)
                .unwrap()
                .with_minute(0)
                .unwrap()
                .with_second(0)
                .unwrap();
            let content = format!(r#"# Evening Journal

## Frequency
[!singleselect:habit-frequency:daily]

## Status
[!checkbox:habit-status:false]

## Focus Time
[!datetime:focus_date_time:{}]

## Notes
Reflect on the day's accomplishments and lessons learned. Write down three things you're grateful for.

---
Created: {}"#,
                evening_time.to_rfc3339(),
                chrono::Local::now().format("%Y-%m-%d")
            );
            let _ = fs::write(&evening_journal, content);
        }

        // Weekly Review habit (weekly with Sunday afternoon focus)
        let weekly_review = habits_dir.join("Weekly Review.md");
        if !weekly_review.exists() {
            // Find next Sunday at 2 PM
            let mut next_sunday = chrono::Local::now();
            while next_sunday.weekday() != chrono::Weekday::Sun {
                next_sunday += chrono::Duration::days(1);
            }
            next_sunday = next_sunday
                .with_hour(14)
                .unwrap()
                .with_minute(0)
                .unwrap()
                .with_second(0)
                .unwrap();
            
            let content = format!(r#"# Weekly Review

## Frequency
[!singleselect:habit-frequency:weekly]

## Status
[!checkbox:habit-status:false]

## Focus Time
[!datetime:focus_date_time:{}]

## Notes
Complete weekly GTD review:
- Process all inboxes to zero
- Review project lists
- Update action lists
- Review Someday/Maybe items
- Clean up and organize

---
Created: {}"#,
                next_sunday.to_rfc3339(),
                chrono::Local::now().format("%Y-%m-%d")
            );
            let _ = fs::write(&weekly_review, content);
        }
    }

    // Create example Someday Maybe pages
    let someday_dir = Path::new(&space_path).join("Someday Maybe");
    if someday_dir.exists() {
        let someday_example1 = someday_dir.join("Start a Blog.md");
        if !someday_example1.exists() {
            let content = r#"# Start a Blog

## Idea

Share my experiences and insights about productivity, coding, and personal development through a regular blog.

## Why it matters

- Build a personal brand and online presence
- Help others learn from my experiences
- Improve writing and communication skills
- Create a portfolio of thoughts and ideas
- Potential passive income through affiliates/sponsorships

## Next steps when ready

- [ ] Choose a blogging platform (Ghost, WordPress, Medium, Substack)
- [ ] Define the blog's niche and target audience
- [ ] Create an editorial calendar with 10 post ideas
- [ ] Write the first three posts before launching
- [ ] Set up analytics and SEO basics
- [ ] Establish a consistent publishing schedule
"#;
            let _ = fs::write(&someday_example1, content);
        }

        let someday_example2 = someday_dir.join("Home Automation Project.md");
        if !someday_example2.exists() {
            let content = r#"# Home Automation Project

## Idea

Create a smart home system to automate lighting, temperature, and security for better comfort and energy efficiency.

## Why it matters

- Reduce energy consumption and utility bills
- Increase home security and peace of mind
- Learn IoT and home automation technologies
- Improve daily convenience and comfort
- Fun technical project to work on

## Next steps when ready

- [ ] Research home automation platforms (Home Assistant, SmartThings, Hubitat)
- [ ] List current devices and compatibility requirements
- [ ] Create a budget for smart devices
- [ ] Start with one room as a pilot project
- [ ] Document the setup for future reference
"#;
            let _ = fs::write(&someday_example2, content);
        }
    }

    // Create example Cabinet pages
    let cabinet_dir = Path::new(&space_path).join("Cabinet");
    if cabinet_dir.exists() {
        let cabinet_example1 = cabinet_dir.join("Keyboard Shortcuts.md");
        if !cabinet_example1.exists() {
            let content = r#"# Keyboard Shortcuts

## Reference

Common keyboard shortcuts for productivity tools and GTD Space.

## Key Points

### GTD Space Shortcuts
- **Cmd/Ctrl + Alt + S**: Insert Status field
- **Cmd/Ctrl + Alt + E**: Insert Effort field
- **Cmd/Ctrl + Alt + P**: Insert Project Status field
- **Cmd/Ctrl + S**: Save current file
- **Cmd/Ctrl + O**: Open folder

### VS Code / Editor Shortcuts
- **Cmd/Ctrl + P**: Quick file open
- **Cmd/Ctrl + Shift + P**: Command palette
- **Cmd/Ctrl + /**: Toggle comment
- **Alt + Up/Down**: Move line up/down
- **Cmd/Ctrl + D**: Select next occurrence

### Mac System Shortcuts
- **Cmd + Space**: Spotlight search
- **Cmd + Tab**: Switch applications
- **Cmd + ~**: Switch windows in same app
- **Cmd + ,**: Open preferences
- **Cmd + Q**: Quit application

## Notes

Keep this reference handy while learning the shortcuts. Muscle memory develops with consistent use.
"#;
            let _ = fs::write(&cabinet_example1, content);
        }

        let cabinet_example2 = cabinet_dir.join("Meeting Templates.md");
        if !cabinet_example2.exists() {
            let content = r#"# Meeting Templates

## Reference

Templates for different types of meetings to ensure productive discussions.

## Key Points

### One-on-One Template
```
Date: [Date]
Attendees: [Names]

Agenda:
1. Check-in (5 min)
2. Updates and progress (10 min)
3. Challenges and blockers (10 min)
4. Goals and priorities (10 min)
5. Action items (5 min)

Notes:
- 

Action Items:
- [ ] 

Next Meeting: [Date]
```

### Project Kickoff Template
```
Project: [Name]
Date: [Date]
Attendees: [Names]

Purpose:
- Define project goals and success criteria

Agenda:
1. Project overview and objectives
2. Roles and responsibilities
3. Timeline and milestones
4. Resources and budget
5. Communication plan
6. Risk assessment
7. Next steps

Decisions Made:
- 

Action Items:
- [ ] 

Follow-up Date: [Date]
```

### Retrospective Template
```
Sprint/Period: [Timeframe]
Date: [Date]
Team: [Names]

What went well:
- 

What didn't go well:
- 

What we learned:
- 

Action items for improvement:
- [ ] 
```

## Notes

Adapt these templates to your specific needs. The structure helps ensure all important topics are covered.
"#;
            let _ = fs::write(&cabinet_example2, content);
        }
    }

    // Create example Habits
    let habits_dir = Path::new(&space_path).join("Habits");
    if habits_dir.exists() {
        let _today = chrono::Local::now().format("%Y-%m-%d");
        
        // Habit 1: Morning Exercise
        let habit1 = habits_dir.join("Morning Exercise.md");
        if !habit1.exists() {
            let now = chrono::Local::now();
            let content = format!(r#"# Morning Exercise

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:daily]

## Created
[!datetime:created_date:{}]

## History
| Date | Time | Status | Action | Notes |
|------|------|--------|--------|-------|
| {} | {} | To Do | Created | Initial habit creation |

"#, now.format("%Y-%m-%d"), now.format("%Y-%m-%d"), now.format("%H:%M"));
            let _ = fs::write(&habit1, content);
        }

        // Habit 2: Weekly Review
        let habit2 = habits_dir.join("Weekly GTD Review.md");
        if !habit2.exists() {
            let now = chrono::Local::now();
            let content = format!(r#"# Weekly GTD Review

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:weekly]

## Created
[!datetime:created_date:{}]

## History
| Date | Time | Status | Action | Notes |
|------|------|--------|--------|-------|
| {} | {} | To Do | Created | Initial habit creation |

"#, now.format("%Y-%m-%d"), now.format("%Y-%m-%d"), now.format("%H:%M"));
            let _ = fs::write(&habit2, content);
        }

        // Habit 3: Reading
        let habit3 = habits_dir.join("Reading Practice.md");
        if !habit3.exists() {
            let now = chrono::Local::now();
            let content = format!(r#"# Reading Practice

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:daily]

## Created
[!datetime:created_date:{}]

## History
| Date | Time | Status | Action | Notes |
|------|------|--------|--------|-------|
| {} | {} | To Do | Created | Initial habit creation |

"#, now.format("%Y-%m-%d"), now.format("%Y-%m-%d"), now.format("%H:%M"));
            let _ = fs::write(&habit3, content);
        }

        // Habit 4: Meditation
        let habit4 = habits_dir.join("Mindfulness Meditation.md");
        if !habit4.exists() {
            let now = chrono::Local::now();
            let content = format!(r#"# Mindfulness Meditation

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:twice-weekly]

## Created
[!datetime:created_date:{}]

## History
| Date | Time | Status | Action | Notes |
|------|------|--------|--------|-------|
| {} | {} | To Do | Created | Initial habit creation |

"#, now.format("%Y-%m-%d"), now.format("%Y-%m-%d"), now.format("%H:%M"));
            let _ = fs::write(&habit4, content);
        }

        // Habit 5: Journaling
        let habit5 = habits_dir.join("Evening Journal.md");
        if !habit5.exists() {
            let now = chrono::Local::now();
            let content = format!(r#"# Evening Journal

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:daily]

## Created
[!datetime:created_date:{}]

## History
| Date | Time | Status | Action | Notes |
|------|------|--------|--------|-------|
| {} | {} | To Do | Created | Initial habit creation |

"#, now.format("%Y-%m-%d"), now.format("%Y-%m-%d"), now.format("%H:%M"));
            let _ = fs::write(&habit5, content);
        }
    }

    // Write seed marker
    let _ = fs::write(&seed_marker, format!(
        "seeded: {}",
        chrono::Local::now().to_rfc3339()
    ));

    Ok("Seeded example projects, actions, habits, and reference materials".to_string())
}

/// Initialize default GTD space and optionally seed example content in one call
#[tauri::command]
pub async fn initialize_default_gtd_space(app: AppHandle) -> Result<String, String> {
    // Load settings to determine behavior
    let settings = load_settings(app.clone()).await.unwrap_or_else(|_| get_default_settings());

    // Resolve default path (settings override or platform default)
    let target_path = if let Some(path) = settings.default_space_path.clone() {
        path
    } else {
        get_default_gtd_space_path().await?
    };

    // Ensure GTD structure
    let _ = initialize_gtd_space(target_path.clone()).await?;

    // Seed content if enabled
    if settings.seed_example_content.unwrap_or(true) {
        let _ = seed_example_gtd_content(target_path.clone()).await;
    }

    Ok(target_path)
}

/// Check if a directory exists
///
/// # Arguments
///
/// * `path` - Path to the directory to check
///
/// # Returns
///
/// Boolean indicating whether the directory exists
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// const exists = await invoke('check_directory_exists', {
///   path: '/path/to/directory'
/// });
/// ```
#[tauri::command]
pub async fn check_directory_exists(path: String) -> Result<bool, String> {
    let dir_path = Path::new(&path);
    Ok(dir_path.exists() && dir_path.is_dir())
}

/// Create a directory
///
/// # Arguments
///
/// * `path` - The directory path to create
///
/// # Example
///
/// ```typescript
/// await invoke('create_directory', {
///   path: '/Users/me/GTD Space/Cabinet'
/// });
/// ```
#[tauri::command]
pub async fn create_directory(path: String) -> Result<String, String> {
    let dir_path = Path::new(&path);
    
    // Validate path doesn't contain dangerous patterns
    if path.contains("..") {
        return Err("Path cannot contain '..' for security reasons".to_string());
    }
    
    // Optionally validate the path is within expected workspace
    // This depends on your security requirements
    
    fs::create_dir_all(&dir_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    Ok(format!("Directory created: {}", path))
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
/// * `status` - Optional project status (in-progress, waiting, completed). Defaults to 'in-progress'
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
///   due_date: '2024-12-31',
///   status: 'in-progress'
/// });
/// ```
#[tauri::command]
pub async fn create_gtd_project(
    space_path: String,
    project_name: String,
    description: String,
    due_date: Option<String>,
    status: Option<String>,
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
    let project_status = status.unwrap_or_else(|| "in-progress".to_string());
    let readme_content = format!(
        r#"# {}

## Description
{}

## Due Date
[!datetime:due_date:{}]

## Status
[!singleselect:project-status:{}]

## Actions
Actions for this project are stored as individual markdown files in this directory.

### Action Template
Each action file contains:
- **Status**: Single select field for tracking progress
- **Focus Date**: DateTime field for when to work on this action
- **Due Date**: Date field for optional deadline
- **Effort**: Single select field for time estimate

---
[!datetime:created_date:{}]
"#,
        project_name,
        description,
        due_date.as_deref().unwrap_or(""),
        project_status,
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
///   focus_date: '2024-11-14T14:30:00',
///   effort: 'Medium'
/// });
/// ```
#[tauri::command]
pub async fn create_gtd_action(
    project_path: String,
    action_name: String,
    status: String,
    due_date: Option<String>,
    focus_date: Option<String>,
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
    
    // Map status and effort to single select values
    let status_value = match status.as_str() {
        "In Progress" => "in-progress",
        "Waiting" => "waiting",
        "Complete" => "complete",
        _ => "in-progress"
    };
    
    let effort_value = match effort.as_str() {
        "Small" => "small",
        "Medium" => "medium",
        "Large" => "large",
        _ => "medium"
    };
    
    // Create action file with template using single select and datetime fields
    let action_content = format!(
        r#"# {}

## Status
[!singleselect:status:{}]

## Focus Date
[!datetime:focus_date_time:{}]

## Due Date
[!datetime:due_date:{}]

## Effort
[!singleselect:effort:{}]

## Notes
<!-- Add any additional notes or details about this action here -->

---
[!datetime:created_date_time:{}]
"#,
        action_name,
        status_value,
        focus_date.as_deref().unwrap_or(""),
        due_date.as_deref().unwrap_or(""),
        effort_value,
        chrono::Local::now().to_rfc3339()
    );
    
    match fs::write(&action_path, action_content) {
        Ok(_) => {
            log::info!("Successfully created action: {}", action_name);
            Ok(action_path.to_string_lossy().to_string())
        }
        Err(e) => Err(format!("Failed to create action file: {}", e))
    }
}

/// Create a new GTD habit
///
/// Creates a new habit file in the Habits directory.
///
/// # Arguments
///
/// * `space_path` - Path to the GTD space root
/// * `habit_name` - Name of the habit
/// * `frequency` - Habit frequency (daily, every-other-day, twice-weekly, weekly, biweekly, monthly)
/// * `status` - Habit status (active, paused, completed, archived)
///
/// # Returns
///
/// Path to the created habit file or error details
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// await invoke('create_gtd_habit', { 
///   space_path: '/path/to/gtd/space',
///   habit_name: 'Morning Exercise',
///   frequency: 'daily',
///   status: 'active'
/// });
/// ```
#[tauri::command]
pub fn create_gtd_habit(
    space_path: String,
    habit_name: String,
    frequency: String,
    _status: String,  // Always 'todo', kept for API compatibility
) -> Result<String, String> {
    log::info!("Creating GTD habit: {}", habit_name);
    
    let habits_path = Path::new(&space_path).join("Habits");
    
    // Ensure Habits directory exists
    if !habits_path.exists() {
        return Err("Habits directory does not exist. Initialize GTD space first.".to_string());
    }
    
    // Sanitize habit name for filename
    let file_name = format!("{}.md", habit_name.replace('/', "-"));
    let habit_path = habits_path.join(&file_name);
    
    if habit_path.exists() {
        return Err(format!("Habit '{}' already exists", habit_name));
    }
    
    // Map frequency and status to single select values
    let frequency_value = match frequency.as_str() {
        "Every Day" | "daily" => "daily",
        "Weekdays (Mon-Fri)" | "weekdays" => "weekdays",
        "Every Other Day" | "every-other-day" => "every-other-day",
        "Twice a Week" | "twice-weekly" => "twice-weekly",
        "Once Every Week" | "weekly" => "weekly",
        "Once Every Other Week" | "biweekly" => "biweekly",
        "Once a Month" | "monthly" => "monthly",
        _ => "daily"
    };
    
    // Habits always start as 'todo' (false in checkbox format)
    let checkbox_value = "false";
    
    // Create habit file with template using checkbox for status
    let now = chrono::Local::now();
    let habit_content = format!(
        r#"# {}

## Status
[!checkbox:habit-status:{}]

## Frequency
[!singleselect:habit-frequency:{}]

## Created
[!datetime:created_date:{}]

## History
| Date | Time | Status | Action | Notes |
|------|------|--------|--------|-------|

"#,
        habit_name,
        checkbox_value,
        frequency_value,
        now.format("%Y-%m-%d")
    );
    
    match fs::write(&habit_path, habit_content) {
        Ok(_) => {
            log::info!("Successfully created habit: {}", habit_name);
            Ok(habit_path.to_string_lossy().to_string())
        }
        Err(e) => Err(format!("Failed to create habit file: {}", e))
    }
}

/// Updates a habit's status and records it in the history
/// 
/// This function handles manual status changes made by the user through the UI.
/// It records the change in the habit's history table with proper timestamps.
/// 
/// # Arguments
/// * `habit_path` - Full path to the habit markdown file
/// * `new_status` - New status value ("todo" or "complete")
/// 
/// # Returns
/// * `Ok(())` if successful
/// * `Err(String)` with error message if operation fails
#[tauri::command]
pub fn update_habit_status(
    habit_path: String,
    new_status: String,
) -> Result<(), String> {
    use chrono::Local;
    
    log::info!("Updating habit status: path={}, new_status={}", habit_path, new_status);
    
    // Read and validate habit file
    let content = fs::read_to_string(&habit_path)
        .map_err(|e| format!("Failed to read habit file: {}", e))?;
    
    // Check for new checkbox format first
    let checkbox_regex = Regex::new(r"\[!checkbox:habit-status:([^\]]+)\]").unwrap();
    let (current_status, is_checkbox_format) = if let Some(cap) = checkbox_regex.captures(&content) {
        let checkbox_value = cap.get(1).map(|m| m.as_str()).unwrap_or("false");
        // Convert checkbox values to status values for internal processing
        let status = if checkbox_value == "true" { "complete" } else { "todo" };
        (status.to_string(), true)
    } else {
        // Fall back to old format
        let status = HABIT_STATUS_FIELD_REGEX.captures(&content)
            .and_then(|cap| cap.get(1))
            .map(|m| m.as_str())
            .ok_or("Could not find current status in habit file")?;
        (status.to_string(), false)
    };
    
    let _frequency = HABIT_FREQUENCY_FIELD_REGEX.captures(&content)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str())
        .ok_or("Could not find frequency in habit file")?;
    
    // Skip if status isn't changing
    if current_status == new_status {
        log::info!("Habit status unchanged ({}), skipping history update", current_status);
        return Ok(());
    }
    
    log::info!("Habit status changing from '{}' to '{}' (checkbox format: {})", current_status, new_status, is_checkbox_format);
    
    // Create history entry for the manual status change
    let now = Local::now();
    let status_display = if new_status == "todo" { "To Do" } else { "Complete" };
    let old_status_display = if current_status == "todo" { "To Do" } else { "Complete" };
    let history_entry = format!(
        "| {} | {} | {} | Manual | Changed from {} |",
        now.format("%Y-%m-%d"),
        now.format("%H:%M"),
        status_display,
        old_status_display
    );
    
    // After recording a completion, immediately reset to "todo" for the next cycle
    // This ensures each cycle starts fresh and auto-reset can detect if it was missed
    let final_status = if new_status == "complete" { "todo" } else { new_status.as_str() };
    
    // Update the status field in the content based on format
    let updated_content = if is_checkbox_format {
        // Convert status to checkbox value
        let checkbox_value = if final_status == "complete" { "true" } else { "false" };
        checkbox_regex.replace(
            &content,
            format!("[!checkbox:habit-status:{}]", checkbox_value).as_str()
        ).to_string()
    } else {
        // Use old format
        HABIT_STATUS_FIELD_REGEX.replace(
            &content,
            format!("[!singleselect:habit-status:{}]", final_status).as_str()
        ).to_string()
    };
    
    // Insert the history entry using our standardized function
    let final_content = insert_history_entry(&updated_content, &history_entry)?;
    
    // OLD complex regex code removed - using simpler line-based approach above
    
    // Removed - using simpler line-based approach above
    
    // Write the updated file with proper error handling
    fs::write(&habit_path, final_content)
        .map_err(|e| format!("Failed to write habit file: {}", e))?;
    
    log::info!("Successfully updated habit status for: {}", habit_path);
    Ok(())
}

/// Checks all habits and resets their status based on frequency
/// 
/// This function should be called periodically (e.g., every minute) to:
/// 1. Check if any habits need to be reset based on their frequency
/// 2. Record the current status in history before resetting
/// 3. Handle backfilling for missed periods when the app was closed
/// 
/// # Arguments
/// * `space_path` - Path to the GTD space directory
/// 
/// # Returns
/// * `Ok(Vec<String>)` - List of habit names that were reset
/// * `Err(String)` - Error message if operation fails
#[tauri::command]
pub fn check_and_reset_habits(space_path: String) -> Result<Vec<String>, String> {
    use chrono::Local;
    
    log::info!("[HABIT-CHECK] Starting habit check for space: {}", space_path);
    
    let habits_path = Path::new(&space_path).join("Habits");
    if !habits_path.exists() {
        return Ok(Vec::new());
    }
    
    let mut reset_habits = Vec::new();
    
    // Read all habit files
    let entries = fs::read_dir(&habits_path)
        .map_err(|e| format!("Failed to read Habits directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            // Read habit file
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read habit file: {}", e))?;
            
            // Extract frequency using the static regex constants
            let frequency = HABIT_FREQUENCY_FIELD_REGEX.captures(&content)
                .and_then(|cap| cap.get(1))
                .map(|m| m.as_str());
            
            // Check for new checkbox format first
            let checkbox_regex = Regex::new(r"\[!checkbox:habit-status:([^\]]+)\]").unwrap();
            let (current_status, is_checkbox_format) = if let Some(cap) = checkbox_regex.captures(&content) {
                let checkbox_value = cap.get(1).map(|m| m.as_str()).unwrap_or("false");
                // Convert checkbox values to status values
                let status = if checkbox_value == "true" { "complete" } else { "todo" };
                (Some(status), true)
            } else {
                // Fall back to old format
                let status = HABIT_STATUS_FIELD_REGEX.captures(&content)
                    .and_then(|cap| cap.get(1))
                    .map(|m| m.as_str());
                (status, false)
            };
            
            if let (Some(freq), Some(status)) = (frequency, current_status) {
                let habit_name = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown");
                
                log::debug!("[HABIT-CHECK] Checking habit '{}': frequency={}, status={}", habit_name, freq, status);
                
                // Check if we need to reset based on frequency
                let should_reset = should_reset_habit(&content, freq, status);
                
                if should_reset {
                    // Get last action time for backfilling calculation using the helper function
                    let last_action_time = parse_last_habit_action_time(&content);
                    
                    let mut missed_periods = if let Some(last_time) = last_action_time {
                        calculate_missed_periods(last_time, freq)
                    } else {
                        vec![]
                    };
                    
                    // Ensure we always have at least one period for the current reset
                    if missed_periods.is_empty() {
                        missed_periods.push(Local::now());
                    }
                    
                    log::debug!("Processing {} periods for habit '{}'", missed_periods.len(), habit_name);
                    
                    let mut history_entries = Vec::new();
                    
                    // Create history entries for each missed period
                    // Limit backfilling to prevent excessive entries (max 100)
                    let periods_to_process = if missed_periods.len() > 100 {
                        log::warn!("Limiting backfill to 100 entries for habit '{}' (found {})", 
                                 habit_name, missed_periods.len());
                        &missed_periods[missed_periods.len() - 100..]
                    } else {
                        &missed_periods[..]
                    };
                    
                    for (i, period_time) in periods_to_process.iter().enumerate() {
                        // Determine status for this period
                        let period_status;
                        let notes;
                        
                        if i < periods_to_process.len() - 1 {
                            // For historical periods during backfilling:
                            // These were missed (not completed) since the app wasn't running
                            period_status = "To Do";
                            notes = "Missed (app offline)";
                        } else {
                            // Current period - record the actual status before reset
                            // If it's still "todo", that means it was missed
                            // If it's "complete", record it as complete
                            period_status = if status == "todo" { "To Do" } else { "Complete" };
                            notes = if status == "todo" { 
                                "Missed habit" 
                            } else { 
                                "Completed" 
                            };
                        }
                    
                        // Determine if this is a catch-up reset (backfilling) or regular auto-reset
                        let is_catchup = i < periods_to_process.len() - 1;
                        let action_type = if is_catchup { "Backfill" } else { "Auto-Reset" };
                    
                        let history_entry = format!(
                            "| {} | {} | {} | {} | {} |",
                            period_time.format("%Y-%m-%d"),
                            period_time.format("%H:%M"),
                            period_status,
                            action_type,
                            notes
                        );
                        history_entries.push(history_entry);
                    }
                    
                    // Start with current content and insert history entries first
                    let mut content_with_history = content.clone();
                    
                    for history_entry in history_entries {
                        content_with_history = insert_history_entry(&content_with_history, &history_entry)
                            .map_err(|e| format!("Failed to insert history entry: {}", e))?;
                    }
                    
                    // ALWAYS update status to 'todo' after a reset (do this AFTER inserting history)
                    let final_content = if is_checkbox_format {
                        // Use checkbox format
                        let checkbox_regex = Regex::new(r"\[!checkbox:habit-status:([^\]]+)\]").unwrap();
                        checkbox_regex.replace(
                            &content_with_history,
                            "[!checkbox:habit-status:false]"  // false = todo
                        ).to_string()
                    } else {
                        // Use old format
                        HABIT_STATUS_FIELD_REGEX.replace(
                            &content_with_history,
                            "[!singleselect:habit-status:todo]"
                        ).to_string()
                    };
                
                    // Write updated file
                    fs::write(&path, final_content)
                        .map_err(|e| format!("Failed to write habit file: {}", e))?;
                    
                    log::info!("Reset habit '{}': status was '{}', now 'todo'", habit_name, status);
                    
                    reset_habits.push(path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string());
                }
            }
        }
    }
    
    log::info!("[HABIT-CHECK] Reset {} habits", reset_habits.len());
    Ok(reset_habits)
}

/// Inserts a history entry into a habit file's history table
/// 
/// This function provides a standardized way to insert history entries,
/// handling table creation if needed and proper formatting.
/// 
/// # Arguments
/// * `content` - The habit file content
/// * `entry` - The formatted history table row to insert
/// 
/// # Returns
/// * `Ok(String)` - The updated content with the entry inserted
/// * `Err(String)` - Error message if insertion fails
fn insert_history_entry(content: &str, entry: &str) -> Result<String, String> {
    let lines: Vec<&str> = content.lines().collect();
    let mut last_table_line_idx = None;
    let mut in_history_table = false;
    let mut has_history_section = false;
    let mut separator_idx = None;
    
    // Find the history section and last table row
    for (i, line) in lines.iter().enumerate() {
        if line.starts_with("## History") {
            in_history_table = true;
            has_history_section = true;
            continue;
        }
        
        if in_history_table {
            if line.contains("---") && line.contains("|") {
                separator_idx = Some(i);
            } else if line.starts_with("|") && !line.contains("Date") {
                last_table_line_idx = Some(i);
            } else if line.starts_with("##") {
                // Hit another section, stop looking
                break;
            }
        }
    }
    
    // Insert the entry in the appropriate location
    let result = if let Some(idx) = last_table_line_idx {
        // Insert after the last existing table row
        let mut new_lines = lines[..=idx].to_vec();
        new_lines.push(entry);
        new_lines.extend_from_slice(&lines[idx + 1..]);
        new_lines.join("\n")
    } else if let Some(idx) = separator_idx {
        // No data rows yet, insert after separator
        let mut new_lines = lines[..=idx].to_vec();
        new_lines.push(entry);
        new_lines.extend_from_slice(&lines[idx + 1..]);
        new_lines.join("\n")
    } else if has_history_section {
        // History section exists but no table, append entry
        format!("{}\n{}", content.trim_end(), entry)
    } else {
        // No history section, create it with proper table structure
        format!(
            "{}\n\n## History\n\n| Date | Time | Status | Action | Notes |\n|------|------|--------|--------|-------|\n{}",
            content.trim_end(),
            entry
        )
    };
    
    Ok(result)
}

/// Calculates missed reset periods for backfilling when app was closed
/// 
/// This function determines all the periods that should have been reset
/// while the application was not running, allowing for proper backfilling
/// of habit history.
/// 
/// # Arguments
/// * `last_action_time` - The timestamp of the last recorded action
/// * `frequency` - The habit frequency
/// 
/// # Returns
/// * Vector of DateTime objects representing missed reset periods
fn calculate_missed_periods(last_action_time: chrono::NaiveDateTime, frequency: &str) -> Vec<chrono::DateTime<chrono::Local>> {
    use chrono::{Local, Duration, TimeZone, Datelike};
    
    let mut missed_periods = Vec::new();
    let now = Local::now();
    
    // Special handling for weekdays frequency
    if frequency == "weekdays" {
        // Convert to local time
        let mut check_time = Local.from_local_datetime(&last_action_time).single()
            .unwrap_or_else(|| Local::now());
        
        // Move to next day
        check_time = check_time + Duration::days(1);
        
        // Add all weekdays between last action and now
        while check_time <= now {
            // Only add if it's a weekday (Monday = 0, Friday = 4)
            if check_time.weekday().num_days_from_monday() < 5 {
                missed_periods.push(check_time);
            }
            check_time = check_time + Duration::days(1);
            
            // Safety limit
            if missed_periods.len() >= 1000 {
                log::warn!("Reached maximum backfill limit for weekdays");
                break;
            }
        }
        
        return missed_periods;
    }
    
    // Determine reset period based on frequency
    let reset_period = match frequency {
        "5-minute" => Duration::minutes(5),
        "daily" => Duration::days(1),
        "every-other-day" => Duration::days(2),
        "twice-weekly" => Duration::days(3),  // Simplified approximation
        "weekly" => Duration::days(7),
        "biweekly" => Duration::days(14),
        "monthly" => Duration::days(30),  // Simplified approximation
        _ => {
            log::warn!("Unknown frequency '{}' for missed periods calculation", frequency);
            return missed_periods;
        }
    };
    
    // Convert naive time to local time with proper handling
    let check_time_opt = Local.from_local_datetime(&last_action_time).single();
    let mut check_time = match check_time_opt {
        Some(t) => t + reset_period,
        None => {
            log::error!("Failed to convert last action time to local time");
            return missed_periods;
        }
    };
    
    // Calculate all missed periods up to current time
    // Limit to reasonable number to prevent memory issues
    const MAX_PERIODS: usize = 1000;
    
    while check_time <= now && missed_periods.len() < MAX_PERIODS {
        missed_periods.push(check_time);
        
        // For monthly frequency, handle month boundaries properly
        if frequency == "monthly" {
            // Add one month properly, accounting for different month lengths
            let next_month = if check_time.month() == 12 {
                check_time.with_month(1)
                    .and_then(|t| t.with_year(check_time.year() + 1))
            } else {
                check_time.with_month(check_time.month() + 1)
            };
            
            check_time = next_month.unwrap_or(check_time + Duration::days(30));
        } else {
            check_time = check_time + reset_period;
        }
    }
    
    if missed_periods.len() >= MAX_PERIODS {
        log::warn!("Reached maximum backfill limit of {} periods", MAX_PERIODS);
    }
    
    missed_periods
}

/// Determines if a habit should be reset based on its frequency and last action time
/// 
/// # Arguments
/// * `content` - The habit file content
/// * `frequency` - The habit frequency (e.g., "daily", "weekly", etc.)
/// * `current_status` - The current status of the habit ("todo" or "complete")
/// 
/// # Returns
/// * `true` if the habit should be reset, `false` otherwise
fn should_reset_habit(content: &str, frequency: &str, _current_status: &str) -> bool {
    use chrono::{Local, Duration, TimeZone, Datelike};
    
    // Use the helper function to get the last action time
    let last_action_time = parse_last_habit_action_time(content);
    
    let Some(last_action) = last_action_time else {
        return false; // Can't determine, don't reset
    };
    
    
    // Always reset habits at their frequency interval, regardless of status
    // This ensures we record missed habits (when status is still "todo")
    // and completed habits (when status is "complete")
    
    let now = Local::now().naive_local();
    let duration_since_action = now.signed_duration_since(last_action);
    
    // Special handling for weekdays frequency
    if frequency == "weekdays" {
        // Convert last action to local time for day checking
        let last_local = Local.from_local_datetime(&last_action).single()
            .unwrap_or_else(|| Local::now());
        let now_local = Local::now();
        
        // Check if it's currently a weekday (Monday = 1, Friday = 5)
        let is_weekday = now_local.weekday().num_days_from_monday() < 5;
        
        if !is_weekday {
            return false; // Don't reset on weekends
        }
        
        // If last action was on Friday and now it's Monday, should reset
        // If last action was earlier today, don't reset yet
        // Otherwise check if at least 1 day has passed
        let days_since = now_local.date_naive().signed_duration_since(last_local.date_naive());
        let days_passed = days_since.num_days();
        
        // Reset if:
        // - More than 1 day passed (handles Friday->Monday)
        // - Exactly 1 day passed and we're on a weekday
        return days_passed >= 1;
    }
    
    // Determine reset period based on frequency
    let reset_period = match frequency {
        "5-minute" => Duration::minutes(5), // Testing frequency
        "daily" => Duration::days(1),
        "every-other-day" => Duration::days(2),
        "twice-weekly" => Duration::days(3), // Approximate
        "weekly" => Duration::days(7),
        "biweekly" => Duration::days(14),
        "monthly" => Duration::days(30), // Approximate
        _ => return false,
    };
    
    // Check if enough time has passed for a reset
    let should_reset = duration_since_action >= reset_period;
    
    
    if should_reset {
        log::info!("[SHOULD-RESET] Habit WILL reset: time_since_last={:?}, period={:?}", 
                   duration_since_action, reset_period);
    }
    
    should_reset
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
/// from their README.md files. Also syncs folder names with README titles.
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
                        let folder_name = path.file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        
                        // Read README.md to extract project metadata
                        let readme_path = path.join("README.md");
                        
                        let (mut title, description, due_date, status, created_date) = if readme_path.exists() {
                            match fs::read_to_string(&readme_path) {
                                Ok(content) => {
                                    let (desc, due, stat, created) = parse_project_readme(&content);
                                    // Extract title from README
                                    let readme_title = extract_readme_title(&content);
                                    (readme_title, desc, due, stat, created)
                                },
                                Err(_) => (
                                    folder_name.clone(),
                                    "No description available".to_string(),
                                    None,
                                    "in-progress".to_string(),
                                    "Unknown".to_string()
                                ),
                            }
                        } else {
                            (
                                folder_name.clone(),
                                "No description available".to_string(),
                                None,
                                "in-progress".to_string(),
                                "Unknown".to_string()
                            )
                        };
                        
                        // Sync folder name with README title if they don't match
                        // Prefer folder name as it was likely renamed intentionally
                        if title != folder_name && readme_path.exists() {
                            log::info!("Syncing project title: folder='{}', README title='{}'", folder_name, title);
                            
                            // Update README to match folder name
                            if let Ok(content) = fs::read_to_string(&readme_path) {
                                let updated_content = update_readme_title(&content, &folder_name);
                                if let Err(e) = fs::write(&readme_path, updated_content) {
                                    log::error!("Failed to sync README title with folder name: {}", e);
                                } else {
                                    log::info!("Updated README title to match folder name: {}", folder_name);
                                }
                            }
                            
                            // Use folder name as the project name
                            title = folder_name.clone();
                        }
                        
                        // Count action files in the project
                        let action_count = count_project_actions(&path);
                        
                        projects.push(GTDProject {
                            name: title,
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

/// Rename a GTD project folder and update its README title
///
/// Renames the project folder and updates the title in the README.md file
/// to maintain consistency between folder name and project title.
///
/// # Arguments
///
/// * `old_project_path` - Full path to the current project folder
/// * `new_project_name` - New name for the project (folder name)
///
/// # Returns
///
/// New project path or error message
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
/// 
/// const newPath = await invoke('rename_gtd_project', {
///   oldProjectPath: '/path/to/gtd/Projects/Old Name',
///   newProjectName: 'New Name'
/// });
/// ```
#[tauri::command]
pub fn rename_gtd_project(old_project_path: String, new_project_name: String) -> Result<String, String> {
    log::info!("Renaming GTD project from {} to {}", old_project_path, new_project_name);
    
    let old_path = Path::new(&old_project_path);
    
    // Validate old path exists and is a directory
    if !old_path.exists() {
        return Err("Project directory does not exist".to_string());
    }
    
    if !old_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    // Get parent directory (Projects folder)
    let parent = old_path.parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;
    
    // Create new path with the new name
    let new_path = parent.join(&new_project_name);
    
    // Check if new path already exists
    if new_path.exists() {
        return Err(format!("A project with name '{}' already exists", new_project_name));
    }
    
    // Rename the directory
    match fs::rename(&old_path, &new_path) {
        Ok(_) => {
            log::info!("Successfully renamed project folder to: {}", new_path.display());
            
            // Update the title in README.md
            let readme_path = new_path.join("README.md");
            if readme_path.exists() {
                match fs::read_to_string(&readme_path) {
                    Ok(content) => {
                        // Update the H1 title (first line starting with #)
                        let updated_content = update_readme_title(&content, &new_project_name);
                        
                        if let Err(e) = fs::write(&readme_path, updated_content) {
                            log::error!("Failed to update README title: {}", e);
                            // Don't fail the operation, folder is already renamed
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to read README for title update: {}", e);
                        // Don't fail the operation, folder is already renamed
                    }
                }
            }
            
            Ok(new_path.to_string_lossy().to_string())
        }
        Err(e) => {
            log::error!("Failed to rename project folder: {}", e);
            Err(format!("Failed to rename project: {}", e))
        }
    }
}

/// Rename a GTD action file based on its title
///
/// Renames an action markdown file to match its title.
/// Also updates the title inside the file if needed.
///
/// # Arguments
///
/// * `old_action_path` - Full path to the current action file
/// * `new_action_name` - New name for the action (without .md extension)
///
/// # Returns
///
/// The new full path of the renamed action file, or error message
///
/// # Examples
///
/// ```javascript
/// const newPath = await invoke('rename_gtd_action', {
///   oldActionPath: '/path/to/gtd/Projects/MyProject/Old Action.md',
///   newActionName: 'New Action'
/// });
/// ```
#[tauri::command]
pub fn rename_gtd_action(old_action_path: String, new_action_name: String) -> Result<String, String> {
    log::info!("Renaming GTD action from {} to {}", old_action_path, new_action_name);
    
    let old_path = Path::new(&old_action_path);
    
    // Validate old path exists and is a file
    if !old_path.exists() {
        return Err("Action file does not exist".to_string());
    }
    
    if !old_path.is_file() {
        return Err("Path is not a file".to_string());
    }
    
    // Get parent directory (project folder)
    let parent = old_path.parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;
    
    // Create new path with the new name (add .md extension if not present)
    let new_file_name = if new_action_name.ends_with(".md") {
        new_action_name.clone()
    } else {
        format!("{}.md", new_action_name)
    };
    
    let new_path = parent.join(&new_file_name);
    
    // Check if new path already exists
    if new_path.exists() && new_path != old_path {
        return Err(format!("An action with name '{}' already exists", new_file_name));
    }
    
    // If the path is the same, just update the title in the content
    if new_path == old_path {
        // Read the file content
        match fs::read_to_string(&old_path) {
            Ok(content) => {
                // Update the H1 title
                let updated_content = update_readme_title(&content, &new_action_name);
                
                // Write back the updated content
                if let Err(e) = fs::write(&old_path, updated_content) {
                    log::error!("Failed to update action title: {}", e);
                    return Err(format!("Failed to update action title: {}", e));
                }
                
                log::info!("Updated action title in file: {}", old_path.display());
                return Ok(old_path.to_string_lossy().to_string());
            }
            Err(e) => {
                log::error!("Failed to read action file: {}", e);
                return Err(format!("Failed to read action file: {}", e));
            }
        }
    }
    
    // Rename the file
    match fs::rename(&old_path, &new_path) {
        Ok(_) => {
            log::info!("Successfully renamed action file to: {}", new_path.display());
            
            // Update the title in the file content
            match fs::read_to_string(&new_path) {
                Ok(content) => {
                    // Update the H1 title
                    let updated_content = update_readme_title(&content, &new_action_name);
                    
                    if let Err(e) = fs::write(&new_path, updated_content) {
                        log::error!("Failed to update action title: {}", e);
                        // Don't fail the operation, file is already renamed
                    }
                }
                Err(e) => {
                    log::error!("Failed to read action file for title update: {}", e);
                    // Don't fail the operation, file is already renamed
                }
            }
            
            Ok(new_path.to_string_lossy().to_string())
        }
        Err(e) => {
            log::error!("Failed to rename action file: {}", e);
            Err(format!("Failed to rename action: {}", e))
        }
    }
}

/// Update the H1 title in README content
fn update_readme_title(content: &str, new_title: &str) -> String {
    let lines: Vec<&str> = content.lines().collect();
    let mut updated_lines = Vec::new();
    let mut title_updated = false;
    
    for line in lines {
        if !title_updated && line.trim().starts_with("# ") {
            // Replace the H1 title
            updated_lines.push(format!("# {}", new_title));
            title_updated = true;
        } else {
            updated_lines.push(line.to_string());
        }
    }
    
    // If no title was found, prepend one
    if !title_updated {
        updated_lines.insert(0, format!("# {}", new_title));
        updated_lines.insert(1, String::new()); // Add blank line after title
    }
    
    updated_lines.join("\n")
}

/// Extract the H1 title from README content
fn extract_readme_title(content: &str) -> String {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# ") {
            return trimmed[2..].trim().to_string();
        }
    }
    // If no title found, return a default
    "Untitled Project".to_string()
}

/// Parse project README.md to extract metadata
fn parse_project_readme(content: &str) -> (String, Option<String>, String, String) {
    let mut description = "No description available".to_string();
    let mut due_date = None;
    let mut status = "in-progress".to_string();
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
                    // Parse datetime syntax [!datetime:due_date:value]
                    if trimmed.starts_with("[!datetime:due_date:") {
                        if let Some(last_colon) = trimmed.rfind(':') {
                            if let Some(end_bracket) = trimmed.rfind(']') {
                                if last_colon < end_bracket {
                                    let value = &trimmed[last_colon + 1..end_bracket];
                                    if !value.is_empty() && value != "Not set" {
                                        due_date = Some(value.to_string());
                                    }
                                }
                            }
                        }
                    } else if trimmed != "Not set" && !trimmed.is_empty() {
                        // Fallback to raw text for backward compatibility
                        due_date = Some(trimmed.to_string());
                    }
                }
                "status" => {
                    // Parse singleselect or multiselect syntax
                    if trimmed.starts_with("[!singleselect:") || trimmed.starts_with("[!multiselect:") {
                        // Extract value from [!singleselect:project-status:value] or [!multiselect:project-status:value]
                        if let Some(last_colon) = trimmed.rfind(':') {
                            if let Some(end_bracket) = trimmed.rfind(']') {
                                if last_colon < end_bracket {
                                    let value = &trimmed[last_colon + 1..end_bracket];
                                    // Map value to display format
                                    status = match value {
                                        "in-progress" => "in-progress",
                                        "waiting" => "waiting",
                                        "completed" => "completed",
                                        _ => value
                                    }.to_string();
                                }
                            }
                        }
                    } else {
                        // Fallback to raw text
                        status = trimmed.to_string();
                    }
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