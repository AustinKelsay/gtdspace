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
use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode, DebouncedEventKind};
use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreBuilder;
use tokio::sync::Mutex as TokioMutex;

// Import seed data module
mod seed_data;
use seed_data::{
    generate_action_template, generate_area_of_focus_template_with_refs,
    generate_goal_template_with_refs, generate_project_readme, generate_project_readme_with_refs,
    generate_vision_document_template_with_refs, generate_weekly_review_habit, ProjectReadmeParams,
    AREAS_OF_FOCUS_OVERVIEW_TEMPLATE, CABINET_GTD_PRINCIPLES_TEMPLATE, CORE_VALUES_TEMPLATE,
    GOALS_OVERVIEW_TEMPLATE, LIFE_MISSION_TEMPLATE, PURPOSE_PRINCIPLES_OVERVIEW_TEMPLATE,
    SOMEDAY_LEARN_LANGUAGE_TEMPLATE, VISION_OVERVIEW_TEMPLATE, WELCOME_TEMPLATE,
};

// ===== REGEX PATTERNS FOR HABIT PARSING =====
// Define regex patterns as static constants to avoid duplication and ensure consistency

/// Regex for parsing habit history entries (supports both table and list formats)
/// List format: - **2025-09-01** at **7:26 PM**: Complete (Manual - Changed from To Do)
/// Table format: | 2025-09-01 | 7:26 PM | Complete | Manual | Changed from To Do |
static HABIT_HISTORY_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?:- \*\*(\d{4}-\d{2}-\d{2})\*\* at \*\*(\d{1,2}:\d{2} [AP]M)\*\*:|\| (\d{4}-\d{2}-\d{2}) \| (\d{1,2}:\d{2}(?: [AP]M)?) \|)")
        .expect("Invalid habit history regex pattern")
});

/// Regex for extracting creation date from habit file
/// Format: ## Created\n[!datetime:created_date_time:YYYY-MM-DDTHH:MM:SS]
static HABIT_CREATED_DATE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"## Created\n[!datetime:created_date_time:([^\]]+)]")
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

    // Parse history entries (supports both list and table formats)
    for cap in HABIT_HISTORY_REGEX.captures_iter(content) {
        // Try list format first (groups 1 and 2)
        let (date_str, time_str) = if let (Some(d), Some(t)) = (cap.get(1), cap.get(2)) {
            (d.as_str(), t.as_str())
        } else if let (Some(d), Some(t)) = (cap.get(3), cap.get(4)) {
            // Try table format (groups 3 and 4)
            (d.as_str(), t.as_str())
        } else {
            continue;
        };

        // Parse the datetime
        let datetime_str = format!("{} {}", date_str, time_str);

        // Try parsing with 12-hour format first (e.g., "7:26 PM")
        let parsed_time = if time_str.contains("AM") || time_str.contains("PM") {
            chrono::NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%d %-I:%M %p").or_else(
                |_| chrono::NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%d %I:%M %p"),
            )
        } else {
            // Fall back to 24-hour format
            chrono::NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%d %H:%M")
        };

        if let Ok(time) = parsed_time {
            log::debug!(
                "[HABIT-PARSE] Found history entry: {} -> {:?}",
                datetime_str,
                time
            );
            if last_action_time.is_none() || last_action_time < Some(time) {
                last_action_time = Some(time);
            }
        } else {
            log::debug!(
                "[HABIT-PARSE] Failed to parse history entry: {}",
                datetime_str
            );
        }
    }

    // If no history entries found, check the Created date
    if last_action_time.is_none() {
        if let Some(cap) = HABIT_CREATED_DATE_REGEX.captures(content) {
            if let Some(date_str) = cap.get(1) {
                if let Ok(datetime) = chrono::DateTime::parse_from_rfc3339(date_str.as_str()) {
                    last_action_time = Some(datetime.naive_local());
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

/// Test folder selection
#[tauri::command]
pub fn test_select_folder() -> Result<String, String> {
    println!("=== test_select_folder called ===");
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
/// import { invoke } from '@tauri-apps/api/tauri';
///
/// const version = await invoke('get_app_version');
/// console.log(`App version: ${version}`);
/// ```
#[tauri::command]
pub fn get_app_version(app: AppHandle) -> Result<String, String> {
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
pub fn check_permissions() -> Result<PermissionStatus, String> {
    log::info!("Permission check requested");

    // For Phase 0, we'll return a basic permission check
    // In Phase 1, this will involve actual file system testing
    let status = PermissionStatus {
        can_read_files: true,   // Assumed true for now
        can_write_files: true,  // Assumed true for now
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
    println!("=== select_folder command called (async with thread) ===");
    log::info!("Folder selection dialog requested");

    // Use std::thread::spawn instead of tokio::task::spawn_blocking
    let handle = std::thread::spawn(move || {
        let dialog = app.dialog().file();
        let dialog = dialog.set_title("Select Folder with Markdown Files");

        println!("Opening folder dialog in separate thread...");

        dialog.blocking_pick_folder()
    });

    // Wait for the thread to complete
    let result = handle
        .join()
        .map_err(|_| "Failed to join thread".to_string())?;

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
            .arg("/select,")
            .arg(&file_path)
            .spawn()
    } else if cfg!(target_os = "macos") {
        // On macOS, we can use open -R to reveal the file
        Command::new("open").arg("-R").arg(&file_path).spawn()
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
pub fn get_default_gtd_space_path() -> Result<String, String> {
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
            for entry_result in entries {
                let entry = entry_result
                    .map_err(|e| format!("Failed to read entry in {:?}: {}", dir_path, e))?;
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
                                let file_name = path
                                    .file_name()
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
pub fn list_markdown_files(path: String) -> Result<Vec<MarkdownFile>, String> {
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
pub fn list_project_actions(project_path: String) -> Result<Vec<MarkdownFile>, String> {
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
            for entry in entries.flatten() {
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
pub fn create_file(directory: String, name: String) -> Result<FileOperationResult, String> {
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

    // Check which GTD horizon we're in
    let is_in_projects = dir_path.components().any(|c| c.as_os_str() == "Projects");
    let is_in_vision = dir_path.components().any(|c| c.as_os_str() == "Vision");
    let is_in_goals = dir_path.components().any(|c| c.as_os_str() == "Goals");
    let is_in_areas = dir_path
        .components()
        .any(|c| c.as_os_str() == "Areas of Focus");
    let is_in_purpose = dir_path
        .components()
        .any(|c| c.as_os_str() == "Purpose & Principles");
    let is_in_habits = dir_path.components().any(|c| c.as_os_str() == "Habits");

    // Check if this is a project directory (has README.md)
    let is_project_dir = dir_path.join("README.md").exists();

    // Create appropriate template content based on GTD horizon
    let clean_name = name.trim_end_matches(".md");
    let template_content = if is_in_projects && is_project_dir {
        // Use GTD action template with single select and datetime fields
        format!(
            r#"# {}

## Status
[!singleselect:status:in-progress]

## Focus Date
[!datetime:focus_date:]

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
    } else if is_in_vision {
        // Vision template with purpose references
        format!(
            r#"# {}

## Living My Purpose

[!purpose-references:]

## The Picture of Success
*Describe what success looks like in 3-5 years...*

## Supporting Goals

[!goals-list]

## Supporting Areas

[!areas-list]

## Supporting Projects

[!projects-list]

## Related Habits

[!habits-list]

---
[!datetime:created_date_time:{}]
"#,
            clean_name,
            chrono::Local::now().to_rfc3339()
        )
    } else if is_in_goals {
        // Goals template with vision and purpose references
        format!(
            r#"# {}

## Target Date

[!datetime:target_date:]

## Outcome
*What specific outcome will be achieved?*

## Aligned With

[!vision-references:]

[!purpose-references:]

## Supporting Areas

[!areas-list]

## Projects

[!projects-list]

## Related Habits

[!habits-list]

---
[!datetime:created_date_time:{}]
"#,
            clean_name,
            chrono::Local::now().to_rfc3339()
        )
    } else if is_in_areas {
        // Areas of Focus template with all horizon references
        format!(
            r#"# {}

## Purpose
*Why is this area important?*

## Standards
*What does excellence look like in this area?*

## Aligned With

[!goals-references:]

[!vision-references:]

[!purpose-references:]

## Supporting Projects

[!projects-list]

## Related Habits

[!habits-list]

## References

[!references:]

---
[!datetime:created_date_time:{}]
"#,
            clean_name,
            chrono::Local::now().to_rfc3339()
        )
    } else if is_in_purpose {
        // Purpose & Principles template
        format!(
            r#"# {}

## Core Principle
*What fundamental truth or value does this represent?*

## Why It Matters
*How does this guide your decisions and actions?*

## Living This Principle
*What does it look like when you embody this?*

## Supporting Visions

[!visions-list]

## Supporting Goals

[!goals-list]

## Supporting Areas

[!areas-list]

## Supporting Projects

[!projects-list]

## Related Habits

[!habits-list]

---
[!datetime:created_date_time:{}]
"#,
            clean_name,
            chrono::Local::now().to_rfc3339()
        )
    } else if is_in_habits {
        // Habits template
        format!(
            r#"# {}

## Habit Tracking

[!checkbox:habit-status:false]

## Frequency

[!singleselect:habit-frequency:daily]

## Focus Time

[!datetime:focus_date:]

## Why This Habit?
*What benefit does this habit provide?*

## Success Looks Like
*How will you know you're doing it right?*

## History
| Date | Time | Status | Action | Notes |
|------|------|--------|--------|-------|

---
[!datetime:created_date_time:{}]
"#,
            clean_name,
            chrono::Local::now().to_rfc3339()
        )
    } else {
        // Use basic template for non-GTD files (Cabinet, Someday Maybe, etc.)
        format!(
            r#"# {}

---
[!datetime:created_date_time:{}]
"#,
            clean_name,
            chrono::Local::now().to_rfc3339()
        )
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
pub fn rename_file(old_path: String, new_name: String) -> Result<FileOperationResult, String> {
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
    let store = match tauri_plugin_store::StoreExt::get_store(
        &app,
        std::path::PathBuf::from("settings.json"),
    ) {
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
        Some(value) => match serde_json::from_value::<UserSettings>(value) {
            Ok(settings) => {
                log::info!("Loaded existing settings");
                Ok(settings)
            }
            Err(e) => {
                log::warn!("Failed to parse settings, using defaults: {}", e);
                Ok(get_default_settings())
            }
        },
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
    let store = match tauri_plugin_store::StoreExt::get_store(
        &app,
        std::path::PathBuf::from("settings.json"),
    ) {
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
pub fn copy_file(source_path: String, dest_path: String) -> Result<String, String> {
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
            log::error!(
                "Failed to create destination directory {}: {}",
                parent.display(),
                e
            );
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
            log::info!(
                "Successfully copied file: {} ({} bytes)",
                dest_path,
                bytes_copied
            );
            Ok(format!("File copied successfully ({} bytes)", bytes_copied))
        }
        Err(e) => {
            log::error!(
                "Failed to copy file from {} to {}: {}",
                source_path,
                dest_path,
                e
            );
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
pub fn move_file(source_path: String, dest_path: String) -> Result<String, String> {
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
            log::error!(
                "Failed to create destination directory {}: {}",
                parent.display(),
                e
            );
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
            log::error!(
                "Failed to move file from {} to {}: {}",
                source_path,
                dest_path,
                e
            );
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
        for entry in entries.flatten() {
            let path = entry.path();

            if path.is_file() {
                if let Some(extension) = path.extension() {
                    let ext_str = extension.to_string_lossy().to_lowercase();
                    if markdown_extensions.contains(&ext_str.as_str()) {
                        files_searched += 1;

                        if let Ok(content) = fs::read_to_string(&path) {
                            let file_name = path
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();
                            let file_path = path.to_string_lossy().to_string();

                            // Search in file name if enabled
                            if filters.include_file_names {
                                if let Some(match_result) =
                                    search_in_text(&file_name, &query, &filters, &regex_pattern)
                                {
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
                                if let Some(match_result) =
                                    search_in_text(line, &query, &filters, &regex_pattern)
                                {
                                    let context_before = if line_number > 0 {
                                        Some(
                                            lines
                                                .get(line_number.saturating_sub(2)..line_number)
                                                .unwrap_or(&[])
                                                .iter()
                                                .map(|s| s.to_string())
                                                .collect(),
                                        )
                                    } else {
                                        None
                                    };

                                    let context_after = if line_number < lines.len() - 1 {
                                        Some(
                                            lines
                                                .get(
                                                    line_number + 1
                                                        ..std::cmp::min(
                                                            line_number + 3,
                                                            lines.len(),
                                                        ),
                                                )
                                                .unwrap_or(&[])
                                                .iter()
                                                .map(|s| s.to_string())
                                                .collect(),
                                        )
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
                                        log::info!(
                                            "Search completed with {} results in {}ms (truncated)",
                                            results.len(),
                                            duration
                                        );
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

    let duration = start_time.elapsed().as_millis() as u64;
    log::info!(
        "Search completed with {} results in {}ms",
        results.len(),
        duration
    );

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

    let search_text = if filters.case_sensitive {
        text
    } else {
        &text.to_lowercase()
    };
    let search_query = if filters.case_sensitive {
        query
    } else {
        &query.to_lowercase()
    };

    if filters.whole_word {
        // Find word boundaries
        let words: Vec<&str> = search_text.split_whitespace().collect();
        for (i, word) in words.iter().enumerate() {
            if word == &search_query {
                // Calculate position in original text
                let mut pos = 0;
                for word in words.iter().take(i) {
                    pos += word.len() + 1; // +1 for space
                }
                return Some((pos, pos + query.len()));
            }
        }
        None
    } else {
        search_text
            .find(search_query)
            .map(|start| (start, start + query.len()))
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

/// Find files that reference a target file (reverse relationships)
///
/// Searches through GTD horizon files to find which ones reference the target file.
/// This is used to build downward-looking lists in the GTD hierarchy.
///
/// # Arguments
///
/// * `target_path` - Path to the file to find references to
/// * `space_path` - Root path of the GTD space
/// * `filter_type` - Type of files to return ("projects", "areas", "goals", "visions")
///
/// # Returns
///
/// List of files that reference the target file
#[tauri::command]
pub fn find_reverse_relationships(
    target_path: String,
    space_path: String,
    filter_type: String,
) -> Result<Vec<ReverseRelationship>, String> {
    log::info!("=== find_reverse_relationships START ===");
    log::info!("Target path: {}", target_path);
    log::info!("Space path: {}", space_path);
    log::info!("Filter type: {}", filter_type);

    let mut relationships = Vec::new();
    let space_root = Path::new(&space_path);
    let target = Path::new(&target_path);

    // Normalize the target path for comparison - handle both absolute and relative paths
    let target_normalized = target_path.replace('\\', "/");
    log::info!("Target normalized: {}", target_normalized);

    // Determine which directories to search based on filter type
    let search_dirs = match filter_type.as_str() {
        "projects" => vec!["Projects"],
        "areas" => vec!["Areas of Focus"],
        "goals" => vec!["Goals"],
        "visions" => vec!["Vision"],
        _ => vec![
            "Projects",
            "Areas of Focus",
            "Goals",
            "Vision",
            "Purpose & Principles",
        ],
    };

    // Search through each directory
    for dir_name in search_dirs {
        let dir_path = space_root.join(dir_name);
        if !dir_path.exists() {
            continue;
        }

        // For Projects directory, we need to look inside each project folder for README.md
        let mut files_to_check = Vec::new();

        if dir_name == "Projects" {
            log::info!("Searching in Projects directory: {}", dir_path.display());
            // Look for README.md files inside project folders
            if let Ok(entries) = fs::read_dir(&dir_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        // This is a project folder, look for README.md inside
                        let readme_path = path.join("README.md");
                        if readme_path.exists() {
                            log::info!("Found project README: {}", readme_path.display());
                            files_to_check.push(readme_path);
                        }
                    } else if path.extension().and_then(|s| s.to_str()) == Some("md") {
                        // Also check standalone .md files in Projects
                        log::info!("Found standalone project file: {}", path.display());
                        files_to_check.push(path);
                    }
                }
            } else {
                log::warn!("Could not read Projects directory");
            }
        } else {
            // For other directories, just look for .md files at the root level
            if let Ok(entries) = fs::read_dir(&dir_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|s| s.to_str()) == Some("md") {
                        files_to_check.push(path);
                    }
                }
            }
        }

        // Now check each file for references
        for path in files_to_check {
            // Skip the target file itself
            if path == target {
                continue;
            }

            // Read file content
            if let Ok(content) = fs::read_to_string(&path) {
                // Normalize content paths for comparison
                let content_normalized = content.replace('\\', "/");

                // Log what we're checking
                log::info!("Checking file: {}", path.display());

                // Log any horizon references found
                for ref_type in &[
                    "areas-references",
                    "goals-references",
                    "vision-references",
                    "purpose-references",
                ] {
                    let marker = format!("[!{}:", ref_type);
                    if content.contains(&marker) {
                        log::info!("File contains {} block", ref_type);
                        // Extract the reference to see what it contains
                        if let Some(start) = content.find(&marker) {
                            let after_start = &content[start + marker.len()..];
                            if let Some(end) = after_start.find(']') {
                                let refs = &after_start[..end];
                                log::info!("  {} content: {}", ref_type, refs);
                                log::info!("  Comparing with target: {}", target_normalized);
                            }
                        }
                    }
                }

                // Check for references in various formats
                // Need to check for both JSON array format and CSV format
                let has_reference = {
                    // Check for JSON array format: ["path"]
                    let json_format = format!(r#""{}""#, target_normalized);
                    // CSV format is the normalized path itself
                    let csv_format = target_normalized.clone();

                    // Helper to test a single reference tag
                    let matches_tag = |tag: &str| {
                        let start = format!("[!{}:", tag);
                        content_normalized.contains(&start)
                            && (content_normalized.contains(&json_format)
                                || content_normalized.contains(&format!("{}{}", start, csv_format)))
                    };

                    // Determine which tags to check
                    let tags_projects = [
                        "areas-references",
                        "goals-references",
                        "vision-references",
                        "purpose-references",
                    ];
                    let tags_all = [
                        "areas-references",
                        "goals-references",
                        "vision-references",
                        "purpose-references",
                        "references",
                    ];
                    let tags: &[&str] = if filter_type == "projects" && dir_name == "Projects" {
                        &tags_projects
                    } else {
                        &tags_all
                    };

                    let mut found_any = false;
                    for tag in tags {
                        if matches_tag(tag) {
                            found_any = true;
                            break;
                        }
                    }

                    if found_any {
                        log::info!("Found reference match for: {}", target_normalized);
                    }
                    found_any
                };

                if has_reference {
                    log::info!("Found reference in file: {}", path.display());

                    // Extract all references from this file
                    let mut references = Vec::new();

                    // Extract references using regex
                    let reference_patterns = [
                        r"\[!areas-references:([^\]]*)\]",
                        r"\[!goals-references:([^\]]*)\]",
                        r"\[!vision-references:([^\]]*)\]",
                        r"\[!purpose-references:([^\]]*)\]",
                        r"\[!references:([^\]]*)\]",
                    ];

                    for pattern in &reference_patterns {
                        if let Ok(re) = Regex::new(pattern) {
                            for cap in re.captures_iter(&content) {
                                if let Some(refs) = cap.get(1) {
                                    let refs_str = refs.as_str().trim();

                                    // Handle both JSON array format and CSV format
                                    let paths: Vec<String> =
                                        if refs_str.starts_with('[') && refs_str.ends_with(']') {
                                            // JSON array format: ["path1","path2"]
                                            // Parse as JSON array
                                            match serde_json::from_str::<Vec<String>>(refs_str) {
                                                Ok(json_paths) => json_paths
                                                    .into_iter()
                                                    .map(|p| p.replace('\\', "/"))
                                                    .collect(),
                                                Err(_) => {
                                                    // Fallback: try to extract paths manually
                                                    refs_str
                                                        .trim_start_matches('[')
                                                        .trim_end_matches(']')
                                                        .split(',')
                                                        .map(|p| {
                                                            p.trim()
                                                                .trim_matches('"')
                                                                .replace('\\', "/")
                                                        })
                                                        .filter(|p| !p.is_empty())
                                                        .map(|p| p.to_string())
                                                        .collect()
                                                }
                                            }
                                        } else {
                                            // CSV format: path1,path2
                                            refs_str
                                                .split(',')
                                                .map(|p| p.trim().replace('\\', "/"))
                                                .filter(|p| !p.is_empty())
                                                .map(|p| p.to_string())
                                                .collect()
                                        };

                                    // Check if any path matches the target
                                    for path in paths {
                                        if path == target_normalized {
                                            references.push(path);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    let file_type = match dir_name {
                        "Projects" => "project",
                        "Areas of Focus" => "area",
                        "Goals" => "goal",
                        "Vision" => "vision",
                        _ => "unknown",
                    };

                    // For projects, use the parent folder name instead of "README.md"
                    let display_name = if dir_name == "Projects"
                        && path.file_name().and_then(|n| n.to_str()) == Some("README.md")
                    {
                        path.parent()
                            .and_then(|p| p.file_name())
                            .and_then(|n| n.to_str())
                            .unwrap_or("Unknown")
                            .to_string()
                    } else {
                        path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("Unknown")
                            .to_string()
                    };

                    relationships.push(ReverseRelationship {
                        file_path: path.to_string_lossy().to_string(),
                        file_name: display_name,
                        file_type: file_type.to_string(),
                        references,
                    });
                }
            }
        }
    }

    log::info!("=== find_reverse_relationships END ===");
    log::info!("Found {} files referencing the target", relationships.len());
    for rel in &relationships {
        log::info!("  - {} ({})", rel.file_name, rel.file_type);
    }
    Ok(relationships)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReverseRelationship {
    pub file_path: String,
    pub file_name: String,
    pub file_type: String,
    pub references: Vec<String>,
}

/// Find habits that reference a specific file
///
/// Searches through the Habits directory for habits that reference the target file
/// in their habits-references field.
///
/// # Arguments
///
/// * `target_path` - Path to the file to find references to
/// * `space_path` - Root path of the GTD space
///
/// # Returns
///
/// List of habits that reference the target file
#[tauri::command]
pub fn find_habits_referencing(
    target_path: String,
    space_path: String,
) -> Result<Vec<HabitReference>, String> {
    log::info!("=== find_habits_referencing START ===");
    log::info!("Target path: {}", target_path);
    log::info!("Space path: {}", space_path);

    let mut habit_references = Vec::new();
    let space_root = Path::new(&space_path);
    let habits_dir = space_root.join("Habits");

    if !habits_dir.exists() {
        log::info!("Habits directory does not exist");
        return Ok(habit_references);
    }

    // Normalize the target path for comparison
    let target_normalized = target_path.replace('\\', "/");
    log::info!("Target normalized: {}", target_normalized);

    // For project README files, also check against the project folder path
    let alt_target = if target_normalized.ends_with("/README.md") {
        Some(target_normalized.trim_end_matches("/README.md").to_string())
    } else {
        None
    };
    if let Some(ref alt) = alt_target {
        log::info!("Also checking against project folder path: {}", alt);
    }

    // Search through all habit files
    if let Ok(entries) = fs::read_dir(&habits_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("md") {
                log::info!("Checking habit file: {}", path.display());
                // Read habit file content
                if let Ok(content) = fs::read_to_string(&path) {
                    // Normalize content paths for comparison
                    let content_normalized = content.replace('\\', "/");

                    // Check if this habit references the target file
                    let has_reference = {
                        // Check all possible reference fields
                        let markers = [
                            "[!projects-references:",
                            "[!areas-references:",
                            "[!goals-references:",
                            "[!vision-references:",
                            "[!purpose-references:",
                        ];

                        let mut found = false;
                        for marker in &markers {
                            if let Some(start_idx) = content_normalized.find(marker) {
                                let after_start = &content_normalized[start_idx + marker.len()..];
                                // Find the last ']' which closes the [!marker:...] block
                                // Look for either "]]" (end of line has two brackets) or "]\n" (single bracket at end)
                                let end_idx = if let Some(double_bracket_idx) =
                                    after_start.find("]]")
                                {
                                    // Found "]]", take content up to the first ']'
                                    double_bracket_idx + 1
                                } else if let Some(newline_idx) = after_start.find('\n') {
                                    // Find the last ']' before the newline
                                    if let Some(bracket_idx) = after_start[..newline_idx].rfind(']')
                                    {
                                        bracket_idx
                                    } else {
                                        continue;
                                    }
                                } else {
                                    // No newline, find the last ']' in the remaining content
                                    if let Some(bracket_idx) = after_start.rfind(']') {
                                        bracket_idx
                                    } else {
                                        continue;
                                    }
                                };

                                let refs_str_raw = &after_start[..end_idx];
                                log::info!("Found {} raw content: {}", marker, refs_str_raw);

                                // Decode URL-encoded content - handle multiple levels of encoding
                                let mut refs_str = refs_str_raw.to_string();
                                let mut decode_attempts = 0;
                                while (refs_str.contains("%25")
                                    || refs_str.contains("%5B")
                                    || refs_str.contains("%22")
                                    || refs_str.contains("%2F"))
                                    && decode_attempts < 3
                                {
                                    match urlencoding::decode(&refs_str) {
                                        Ok(decoded) => {
                                            refs_str = decoded.into_owned();
                                            decode_attempts += 1;
                                            log::info!(
                                                "After decode attempt {}: {}",
                                                decode_attempts,
                                                refs_str
                                            );
                                        }
                                        Err(_) => break,
                                    }
                                }

                                // Handle both JSON array format and CSV format
                                let paths: Vec<String> = if refs_str.starts_with('[')
                                    && refs_str.ends_with(']')
                                {
                                    // JSON array format
                                    match serde_json::from_str::<Vec<String>>(&refs_str) {
                                        Ok(json_paths) => json_paths
                                            .into_iter()
                                            .map(|p| p.replace('\\', "/"))
                                            .collect(),
                                        Err(_) => {
                                            // Fallback: try to extract paths manually
                                            refs_str
                                                .trim_start_matches('[')
                                                .trim_end_matches(']')
                                                .split(',')
                                                .map(|p| {
                                                    p.trim().trim_matches('"').replace('\\', "/")
                                                })
                                                .filter(|p| !p.is_empty())
                                                .map(|p| p.to_string())
                                                .collect()
                                        }
                                    }
                                } else {
                                    // CSV format
                                    refs_str
                                        .split(',')
                                        .map(|p| p.trim().replace('\\', "/"))
                                        .filter(|p| !p.is_empty())
                                        .map(|p| p.to_string())
                                        .collect()
                                };

                                // Check if any path matches the target
                                log::info!(
                                    "Checking {} paths for match with target: {}",
                                    paths.len(),
                                    target_normalized
                                );
                                for path in &paths {
                                    log::info!(
                                        "  Comparing: '{}' == '{}'",
                                        path,
                                        target_normalized
                                    );
                                    if path == &target_normalized {
                                        log::info!("  MATCH FOUND!");
                                    }
                                    if let Some(ref alt) = alt_target {
                                        if path == alt {
                                            log::info!("  MATCH FOUND (alt target)!");
                                        }
                                    }
                                }
                                if paths.iter().any(|p| {
                                    p == &target_normalized
                                        || (alt_target.is_some()
                                            && p == alt_target.as_ref().unwrap())
                                }) {
                                    found = true;
                                    log::info!(
                                        "Reference match confirmed for habit: {}",
                                        path.display()
                                    );
                                    break;
                                }
                            }
                        }
                        found
                    };

                    if has_reference {
                        log::info!("Found habit referencing target: {}", path.display());

                        // Extract habit metadata
                        let habit_name = path
                            .file_stem()
                            .and_then(|n| n.to_str())
                            .unwrap_or("Unknown")
                            .to_string();

                        // Extract status (checkbox value)
                        let status = if content.contains("[!checkbox:habit-status:true]") {
                            "completed".to_string()
                        } else {
                            "todo".to_string()
                        };

                        // Extract frequency
                        let marker = "[!singleselect:habit-frequency:";
                        let frequency = if let Some(idx) = content.find(marker) {
                            let after_start = &content[idx + marker.len()..];
                            if let Some(end) = after_start.find(']') {
                                after_start[..end].to_string()
                            } else {
                                "daily".to_string()
                            }
                        } else {
                            "daily".to_string()
                        };

                        habit_references.push(HabitReference {
                            file_path: path.to_string_lossy().to_string(),
                            habit_name,
                            status,
                            frequency,
                        });
                    }
                }
            }
        }
    }

    log::info!("=== find_habits_referencing END ===");
    log::info!(
        "Found {} habits referencing the target",
        habit_references.len()
    );
    for hab in &habit_references {
        log::info!("  - {} ({})", hab.habit_name, hab.status);
    }
    Ok(habit_references)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HabitReference {
    pub file_path: String,
    pub habit_name: String,
    pub status: String,
    pub frequency: String,
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
pub fn replace_in_file(
    file_path: String,
    search_term: String,
    replace_term: String,
) -> Result<String, String> {
    log::info!(
        "Replacing '{}' with '{}' in file: {}",
        search_term,
        replace_term,
        file_path
    );

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
    let new_content =
        if search_term.contains("\\") || search_term.contains(".*") || search_term.contains("+") {
            // Treat as regex if it contains regex special characters
            match regex::Regex::new(&search_term) {
                Ok(regex) => regex
                    .replace_all(&content, replace_term.as_str())
                    .to_string(),
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
        return Ok(format!(
            "No matches found for '{}' in {}",
            search_term,
            path.file_name().unwrap_or_default().to_string_lossy()
        ));
    }

    // Write the updated content back to the file
    match fs::write(path, new_content) {
        Ok(_) => {
            log::info!(
                "Successfully replaced {} occurrence(s) in {}",
                replacements_made,
                file_path
            );
            Ok(format!(
                "Replaced {} occurrence(s) of '{}' with '{}' in {}",
                replacements_made,
                search_term,
                replace_term,
                path.file_name().unwrap_or_default().to_string_lossy()
            ))
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
pub fn check_is_gtd_space(path: String) -> Result<bool, String> {
    log::info!("Checking if directory is a GTD space: {}", path);
    println!("[check_is_gtd_space] Checking path: {}", path);

    let root_path = Path::new(&path);

    // Check if the path exists and is a directory
    if !root_path.exists() {
        println!("[check_is_gtd_space] Path does not exist: {}", path);
        return Ok(false);
    }

    if !root_path.is_dir() {
        println!("[check_is_gtd_space] Path is not a directory: {}", path);
        return Ok(false);
    }

    // Check for key GTD directories
    // Making Projects the only truly required directory
    let required_dirs = ["Projects"];
    let optional_dirs = [
        "Areas of Focus",
        "Goals",
        "Vision",
        "Purpose & Principles",
        "Habits",
        "Someday Maybe",
        "Cabinet",
    ];

    let mut required_found = 0;
    let mut missing_required = Vec::new();
    for dir in &required_dirs {
        let dir_path = root_path.join(dir);
        if dir_path.exists() && dir_path.is_dir() {
            required_found += 1;
            println!("[check_is_gtd_space] Found required directory: {}", dir);
        } else {
            missing_required.push(dir.to_string());
            println!("[check_is_gtd_space] Missing required directory: {}", dir);
        }
    }

    // Count optional directories
    let mut optional_found = 0;
    for dir in &optional_dirs {
        let dir_path = root_path.join(dir);
        if dir_path.exists() && dir_path.is_dir() {
            optional_found += 1;
            println!("[check_is_gtd_space] Found optional directory: {}", dir);
        }
    }

    // Consider it a GTD space if it has all required directories (Projects),
    // or if it has at least 3 of the GTD directories total
    let is_gtd_space =
        required_found == required_dirs.len() || (required_found + optional_found) >= 3;

    println!(
        "[check_is_gtd_space] Result: {} (required: {}/{}, optional: {}/{}, total: {})",
        if is_gtd_space {
            "IS GTD SPACE"
        } else {
            "NOT GTD SPACE"
        },
        required_found,
        required_dirs.len(),
        optional_found,
        optional_dirs.len(),
        required_found + optional_found
    );

    if !is_gtd_space && !missing_required.is_empty() {
        println!(
            "[check_is_gtd_space] Missing required directories: {:?}",
            missing_required
        );
    }

    log::info!(
        "Directory {} GTD space (required: {}/{}, optional: {}/{})",
        if is_gtd_space { "is a" } else { "is not a" },
        required_found,
        required_dirs.len(),
        optional_found,
        optional_dirs.len()
    );

    Ok(is_gtd_space)
}

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
        "Areas of Focus",
        "Goals",
        "Vision",
        "Purpose & Principles",
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
            "Areas of Focus" => {
                // Create overview page
                let overview_file = dir_path.join("README.md");
                if !overview_file.exists() {
                    if let Err(e) = fs::write(&overview_file, AREAS_OF_FOCUS_OVERVIEW_TEMPLATE) {
                        log::warn!("Failed to create Areas of Focus overview: {}", e);
                    } else {
                        log::info!("Created Areas of Focus overview");
                    }
                }

                // Create area AFTER we know Goals will exist
                // We'll create the actual area content later after Goals are created
                // For now, just note that this directory exists
            }
            "Goals" => {
                // Create overview page
                let overview_file = dir_path.join("README.md");
                if !overview_file.exists() {
                    if let Err(e) = fs::write(&overview_file, GOALS_OVERVIEW_TEMPLATE) {
                        log::warn!("Failed to create Goals overview: {}", e);
                    } else {
                        log::info!("Created Goals overview");
                    }
                }

                // Create MINIMAL goal with MAXIMUM relationships
                let next_year = chrono::Local::now().year() + 1;
                let space_path_str = root_path.to_string_lossy();
                let vision_base = format!("{}/Vision", space_path_str);
                let purpose_base = format!("{}/Purpose & Principles", space_path_str);

                // Goals reference → Vision AND both Purpose docs
                let vision_ref = format!("{}/My 3-5 Year Vision.md", vision_base);
                let life_mission_ref = format!("{}/Life Mission.md", purpose_base);
                let core_values_ref = format!("{}/Core Values.md", purpose_base);
                let purpose_refs = format!("{},{}", life_mission_ref, core_values_ref);

                // Just ONE goal with ALL possible references
                let goal_name = "Build Financial Freedom";
                let file_path = dir_path.join(format!("{}.md", goal_name));
                if !file_path.exists() {
                    let content = generate_goal_template_with_refs(
                        goal_name,
                        Some(&format!("{}-12-31", next_year)),
                        "Generate $10K/month passive income through multiple revenue streams",
                        &vision_ref,   // References Vision
                        &purpose_refs, // References BOTH Purpose documents
                    );
                    if let Err(e) = fs::write(&file_path, content) {
                        log::warn!("Failed to create goal '{}': {}", goal_name, e);
                    }
                }
            }
            "Vision" => {
                // Create overview page
                let overview_file = dir_path.join("README.md");
                if !overview_file.exists() {
                    if let Err(e) = fs::write(&overview_file, VISION_OVERVIEW_TEMPLATE) {
                        log::warn!("Failed to create Vision overview: {}", e);
                    } else {
                        log::info!("Created Vision overview");
                    }
                }

                // Create vision document with references to Purpose
                let vision_file = dir_path.join("My 3-5 Year Vision.md");
                if !vision_file.exists() {
                    let space_path_str = root_path.to_string_lossy();
                    let purpose_base = format!("{}/Purpose & Principles", space_path_str);
                    let life_mission_ref = format!("{}/Life Mission.md", purpose_base);
                    let core_values_ref = format!("{}/Core Values.md", purpose_base);
                    let purpose_refs = format!("{},{}", life_mission_ref, core_values_ref);

                    let content = generate_vision_document_template_with_refs(&purpose_refs);
                    if let Err(e) = fs::write(&vision_file, content) {
                        log::warn!("Failed to create vision document: {}", e);
                    } else {
                        log::info!("Created vision document with Purpose references");
                    }
                }
            }
            "Purpose & Principles" => {
                // Create overview page
                let overview_file = dir_path.join("README.md");
                if !overview_file.exists() {
                    if let Err(e) = fs::write(&overview_file, PURPOSE_PRINCIPLES_OVERVIEW_TEMPLATE)
                    {
                        log::warn!("Failed to create Purpose & Principles overview: {}", e);
                    } else {
                        log::info!("Created Purpose & Principles overview");
                    }
                }

                // Create Life Mission document
                let mission_file = dir_path.join("Life Mission.md");
                if !mission_file.exists() {
                    if let Err(e) = fs::write(&mission_file, LIFE_MISSION_TEMPLATE) {
                        log::warn!("Failed to create life mission document: {}", e);
                    } else {
                        log::info!("Created life mission document");
                    }
                }

                // Create Core Values document
                let values_file = dir_path.join("Core Values.md");
                if !values_file.exists() {
                    if let Err(e) = fs::write(&values_file, CORE_VALUES_TEMPLATE) {
                        log::warn!("Failed to create core values document: {}", e);
                    } else {
                        log::info!("Created core values document");
                    }
                }
            }
            "Someday Maybe" => {
                let example_file = dir_path.join("Learn a New Language.md");
                if !example_file.exists() {
                    if let Err(e) = fs::write(&example_file, SOMEDAY_LEARN_LANGUAGE_TEMPLATE) {
                        log::warn!("Failed to create example Someday Maybe page: {}", e);
                    } else {
                        log::info!("Created example Someday Maybe page: Learn a New Language.md");
                    }
                }
            }
            "Cabinet" => {
                let example_file = dir_path.join("GTD Principles Reference.md");
                if !example_file.exists() {
                    if let Err(e) = fs::write(&example_file, CABINET_GTD_PRINCIPLES_TEMPLATE) {
                        log::warn!("Failed to create example Cabinet page: {}", e);
                    } else {
                        log::info!("Created example Cabinet page: GTD Principles Reference.md");
                    }
                }
            }
            _ => {}
        }
    }

    // NOW create the Area of Focus with all references (after Goals, Vision, Purpose exist)
    let areas_dir = root_path.join("Areas of Focus");
    if areas_dir.exists() {
        let goals_base = root_path.join("Goals");
        let vision_base = root_path.join("Vision");
        let purpose_base = root_path.join("Purpose & Principles");

        // Build all reference paths
        let goal_ref = format!(
            "{}/Build Financial Freedom.md",
            goals_base.to_string_lossy()
        );
        let vision_ref = format!("{}/My 3-5 Year Vision.md", vision_base.to_string_lossy());
        let life_mission_ref = format!("{}/Life Mission.md", purpose_base.to_string_lossy());
        let core_values_ref = format!("{}/Core Values.md", purpose_base.to_string_lossy());

        // Combine Purpose references
        let purpose_refs = format!("{},{}", life_mission_ref, core_values_ref);

        // Create ONE area with ALL references
        let area_name = "Professional Excellence";
        let area_file = areas_dir.join(format!("{}.md", area_name));
        if !area_file.exists() {
            let content = generate_area_of_focus_template_with_refs(
                area_name,
                "Delivering exceptional value through my work",
                "- Meet all commitments\n- Continuous improvement\n- Build strong relationships",
                &goal_ref,     // References Goal
                &vision_ref,   // References Vision
                &purpose_refs, // References BOTH Purpose docs
            );
            if let Err(e) = fs::write(&area_file, content) {
                log::warn!("Failed to create area '{}': {}", area_name, e);
            } else {
                log::info!("Created area with full references: {}", area_name);
            }
        }
    }

    // Create a welcome file in the root directory
    let welcome_path = root_path.join("Welcome to GTD Space.md");
    if !welcome_path.exists() {
        if let Err(e) = fs::write(&welcome_path, WELCOME_TEMPLATE) {
            log::warn!("Failed to create welcome file: {}", e);
        } else {
            log::info!("Created welcome file");
        }
    }

    let message = if created_dirs.is_empty() {
        "GTD space already initialized".to_string()
    } else {
        format!(
            "GTD space initialized. Created directories: {}",
            created_dirs.join(", ")
        )
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
    fn ensure_project(
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
        ) {
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

    // MINIMAL Project with MAXIMUM references (Project → Area + Goal)
    let next_week = (chrono::Local::now() + chrono::Duration::days(7))
        .with_hour(17)
        .unwrap()
        .with_minute(0)
        .unwrap()
        .with_second(0)
        .unwrap();

    let project_name = "Launch Side Business";
    let project1_path = ensure_project(
        &space_path,
        project_name,
        "Create and launch consulting business for passive income generation",
        Some(next_week.to_rfc3339()),
        Some("in-progress".to_string()),
    )?;

    // Update with references to BOTH Area and Goal
    let areas_ref = format!("{}/Areas of Focus/Professional Excellence.md", &space_path);
    let goals_ref = format!("{}/Goals/Build Financial Freedom.md", &space_path);
    let vision_ref = format!("{}/Vision/10 Year Vision.md", &space_path);
    let purpose_ref = format!("{}/Purpose & Principles/Core Values.md", &space_path);
    let cabinet_ref = format!("{}/Cabinet/GTD Quick Reference.md", &space_path);

    let readme_path = Path::new(&project1_path).join("README.md");
    let readme_params = ProjectReadmeParams {
        name: project_name,
        description: "Create and launch consulting business for passive income generation",
        due_date: Some(next_week.to_rfc3339()),
        status: "in-progress",
        areas_refs: &areas_ref,     // References Area
        goals_refs: &goals_ref,     // References Goal
        vision_refs: &vision_ref,   // References Vision
        purpose_refs: &purpose_ref, // References Purpose & Principles
        general_refs: &cabinet_ref, // References Cabinet
    };
    let readme_content = generate_project_readme_with_refs(readme_params);
    let _ = fs::write(&readme_path, readme_content);

    // Just 2 simple actions
    let _ = create_gtd_action(
        project1_path.clone(),
        "Define service offerings".to_string(),
        "in-progress".to_string(),
        None,
        Some(chrono::Local::now().to_rfc3339()),
        "medium".to_string(),
        None, // No contexts specified
    );

    let _ = create_gtd_action(
        project1_path.clone(),
        "Create landing page".to_string(),
        "waiting".to_string(),
        Some(next_week.to_rfc3339()),
        None,
        "large".to_string(),
        None, // No contexts specified
    );

    // That's it - just ONE project with maximum connections!

    // Create just ONE example habit
    let habits_dir = Path::new(&space_path).join("Habits");
    if habits_dir.exists() {
        let weekly_review = habits_dir.join("Weekly GTD Review.md");
        if !weekly_review.exists() {
            let content = generate_weekly_review_habit();
            let _ = fs::write(&weekly_review, content);
        }
    }

    // Create just ONE Someday Maybe example
    let someday_dir = Path::new(&space_path).join("Someday Maybe");
    if someday_dir.exists() {
        let someday_example = someday_dir.join("Write a Book.md");
        if !someday_example.exists() {
            let content = r#"# Write a Book

**Topic**: Practical guide to building sustainable business systems

## When I'm ready:
- [ ] Outline key chapters
- [ ] Research publishers vs self-publishing
- [ ] Build audience platform first
- [ ] Dedicate 2 hours daily to writing

*Will support my Financial Freedom goal when activated*
"#;
            let _ = fs::write(&someday_example, content);
        }
    }

    // Create just ONE Cabinet reference (that the project references)
    let cabinet_dir = Path::new(&space_path).join("Cabinet");
    if cabinet_dir.exists() {
        // Only create the GTD Quick Reference that our project references
        let gtd_ref = cabinet_dir.join("GTD Quick Reference.md");
        if !gtd_ref.exists() {
            // Using the existing CABINET_GTD_PRINCIPLES_TEMPLATE
            if let Err(e) = fs::write(&gtd_ref, CABINET_GTD_PRINCIPLES_TEMPLATE) {
                log::warn!("Failed to create GTD Quick Reference: {}", e);
            }
        }
    }

    // Note: Horizons are now created as top-level folders during initialization
    // No need to recreate them here

    // Habits already created above - removed duplicates

    // Write seed marker
    let _ = fs::write(
        &seed_marker,
        format!("seeded: {}", chrono::Local::now().to_rfc3339()),
    );

    Ok("Seeded example projects, actions, horizons, habits, and reference materials".to_string())
}

/// Initialize default GTD space and optionally seed example content in one call
#[tauri::command]
pub async fn initialize_default_gtd_space(app: AppHandle) -> Result<String, String> {
    // Load settings to determine behavior
    let settings = load_settings(app.clone())
        .await
        .unwrap_or_else(|_| get_default_settings());

    // Resolve default path (settings override or platform default)
    let target_path = if let Some(path) = settings.default_space_path.clone() {
        path
    } else {
        get_default_gtd_space_path()?
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
pub fn check_directory_exists(path: String) -> Result<bool, String> {
    log::info!("Checking if directory exists: {}", path);
    let dir_path = Path::new(&path);
    let exists = dir_path.exists() && dir_path.is_dir();
    log::info!("Directory {} exists: {}", path, exists);
    Ok(exists)
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
pub fn create_directory(path: String) -> Result<String, String> {
    log::info!("Creating directory: {}", path);
    let dir_path = Path::new(&path);

    // Validate path doesn't contain dangerous patterns
    if path.contains("..") {
        return Err("Path cannot contain '..' for security reasons".to_string());
    }

    // Optionally validate the path is within expected workspace
    // This depends on your security requirements

    fs::create_dir_all(dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;

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
pub fn create_gtd_project(
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

    // Validate status if provided
    if let Some(ref status_value) = status {
        let valid_statuses = ["in-progress", "waiting", "completed"];
        if !valid_statuses.contains(&status_value.as_str()) {
            return Err(format!(
                "Invalid status '{}'. Must be one of: {}",
                status_value,
                valid_statuses.join(", ")
            ));
        }
    }

    // Create README.md with project template
    let readme_path = project_path.join("README.md");
    let project_status = status.unwrap_or_else(|| "in-progress".to_string());
    let readme_content =
        generate_project_readme(&project_name, &description, due_date, &project_status);

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
/// * `status` - Initial status (In Progress / Waiting / Completed)
/// * `due_date` - Optional due date (ISO format: YYYY-MM-DD)
/// * `effort` - Effort estimate (Small / Medium / Large / Extra Large)
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
pub fn create_gtd_action(
    project_path: String,
    action_name: String,
    status: String,
    due_date: Option<String>,
    focus_date: Option<String>,
    effort: String,
    contexts: Option<Vec<String>>,
) -> Result<String, String> {
    log::info!(
        "Creating GTD action: {} in project: {}",
        action_name,
        project_path
    );

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

    // Validate status
    let status_value = status.as_str();
    let valid_statuses = ["in-progress", "waiting", "completed"];
    if !valid_statuses.contains(&status_value) {
        return Err(format!(
            "Invalid status '{}'. Must be one of: {}",
            status,
            valid_statuses.join(", ")
        ));
    }

    let effort_value = match effort.as_str() {
        "Small" | "small" => "small",
        "Medium" | "medium" => "medium",
        "Large" | "large" => "large",
        "Extra Large" | "ExtraLarge" | "extra-large" | "extra_large" => "extra-large",
        _ => {
            log::warn!("Unknown effort value '{}', defaulting to 'medium'", effort);
            "medium"
        }
    };

    // Map contexts to normalized values for multiselect
    let contexts_value = contexts.map(|ctx_vec| {
        ctx_vec
            .iter()
            .map(|c| {
                // Remove @ prefix and normalize
                let normalized = c.to_lowercase().replace('@', "").replace(' ', "-");
                match normalized.as_str() {
                    "home" => "home".to_string(),
                    "office" => "office".to_string(),
                    "computer" => "computer".to_string(),
                    "phone" => "phone".to_string(),
                    "errands" => "errands".to_string(),
                    "anywhere" => "anywhere".to_string(),
                    _ => normalized,
                }
            })
            .collect::<Vec<String>>()
    });

    // Create action file with template using single select and datetime fields
    let action_content = generate_action_template(
        &action_name,
        status_value,
        focus_date,
        due_date,
        effort_value,
        contexts_value,
    );

    match fs::write(&action_path, action_content) {
        Ok(_) => {
            log::info!("Successfully created action: {}", action_name);
            Ok(action_path.to_string_lossy().to_string())
        }
        Err(e) => Err(format!("Failed to create action file: {}", e)),
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
    _status: String,            // Always 'todo', kept for API compatibility
    focus_time: Option<String>, // Optional focus time (HH:MM format)
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
        _ => "daily",
    };

    // Habits always start as 'todo' (false in checkbox format)
    let checkbox_value = "false";

    // Create habit file with template using checkbox for status
    let now = chrono::Local::now();

    // Format focus time if provided
    let focus_time_section = if let Some(time) = focus_time {
        // Validate time format (HH:MM)
        if time.len() == 5 && time.chars().nth(2) == Some(':') {
            // Create a datetime with today's date and the specified time
            format!(
                "\n## Focus Date\n[!datetime:focus_date:{}T{}:00]\n",
                now.format("%Y-%m-%d"),
                time
            )
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    let habit_content = format!(
        r#"# {}

## Status
[!checkbox:habit-status:{}]

## Frequency
[!singleselect:habit-frequency:{}]
{}
## Horizon References

[!projects-references:]

[!areas-references:]

[!goals-references:]

[!vision-references:]

[!purpose-references:]

## Created
[!datetime:created_date_time:{}]

## History

*Track your habit completions below:*

"#,
        habit_name,
        checkbox_value,
        frequency_value,
        focus_time_section,
        now.to_rfc3339()
    );

    match fs::write(&habit_path, habit_content) {
        Ok(_) => {
            log::info!("Successfully created habit: {}", habit_name);
            Ok(habit_path.to_string_lossy().to_string())
        }
        Err(e) => Err(format!("Failed to create habit file: {}", e)),
    }
}

/// Updates a habit's status and records it in the history
///
/// This function handles manual status changes made by the user through the UI.
/// It records the change in the habit's history table with proper timestamps.
///
/// # Arguments
/// * `habit_path` - Full path to the habit markdown file
/// * `new_status` - New status value ("todo" or "completed")
///
/// # Returns
/// * `Ok(())` if successful
/// * `Err(String)` with error message if operation fails
#[tauri::command]
pub fn update_habit_status(habit_path: String, new_status: String) -> Result<(), String> {
    use chrono::Local;

    log::info!(
        "Updating habit status: path={}, new_status={}",
        habit_path,
        new_status
    );

    // Read and validate habit file
    let content =
        fs::read_to_string(&habit_path).map_err(|e| format!("Failed to read habit file: {}", e))?;

    // Check for new checkbox format first
    let checkbox_regex = Regex::new(r"\[!checkbox:habit-status:([^\]]+)\]").unwrap();
    let (current_status, is_checkbox_format) = if let Some(cap) = checkbox_regex.captures(&content)
    {
        let checkbox_value = cap.get(1).map(|m| m.as_str()).unwrap_or("false");
        // Convert checkbox values to status values for internal processing
        let status = if checkbox_value == "true" {
            "completed"
        } else {
            "todo"
        };
        log::info!(
            "Found checkbox format: value='{}', converted to status='{}'",
            checkbox_value,
            status
        );
        (status.to_string(), true)
    } else {
        // Fall back to old format
        let status = HABIT_STATUS_FIELD_REGEX
            .captures(&content)
            .and_then(|cap| cap.get(1))
            .map(|m| m.as_str())
            .ok_or("Could not find current status in habit file")?;
        (status.to_string(), false)
    };

    let _frequency = HABIT_FREQUENCY_FIELD_REGEX
        .captures(&content)
        .and_then(|cap| cap.get(1))
        .map(|m| m.as_str())
        .ok_or("Could not find frequency in habit file")?;

    // Skip if status isn't changing
    if current_status == new_status {
        log::info!(
            "Habit status unchanged (current='{}', new='{}'), skipping history update",
            current_status,
            new_status
        );
        return Ok(());
    }

    log::info!(
        "Habit status changing from '{}' to '{}' (checkbox format: {})",
        current_status,
        new_status,
        is_checkbox_format
    );

    // Create history entry for the manual status change
    let now = Local::now();
    let status_display = if new_status == "todo" {
        "To Do"
    } else {
        "Complete"
    };
    let old_status_display = if current_status == "todo" {
        "To Do"
    } else {
        "Complete"
    };
    // Use table row format for history entry
    let history_entry = format!(
        "| {} | {} | {} | Manual | Changed from {} |",
        now.format("%Y-%m-%d"),
        now.format("%-I:%M %p"),
        status_display,
        old_status_display
    );

    // Keep the actual status that was set - don't auto-reset
    // The habit should remain checked until the next frequency window
    let final_status = new_status.as_str();

    // Update the status field in the content based on format
    let updated_content = if is_checkbox_format {
        // Convert status to checkbox value
        let checkbox_value = if final_status == "completed" || final_status == "complete" {
            "true"
        } else {
            "false"
        };
        checkbox_regex
            .replace(
                &content,
                format!("[!checkbox:habit-status:{}]", checkbox_value).as_str(),
            )
            .to_string()
    } else {
        // Use old format
        HABIT_STATUS_FIELD_REGEX
            .replace(
                &content,
                format!("[!singleselect:habit-status:{}]", final_status).as_str(),
            )
            .to_string()
    };

    // Insert the history entry using our standardized function
    let final_content = insert_history_entry(&updated_content, &history_entry)?;

    log::info!(
        "About to write habit file with history entry: {}",
        history_entry
    );

    // OLD complex regex code removed - using simpler line-based approach above

    // Removed - using simpler line-based approach above

    // Write the updated file with proper error handling
    fs::write(&habit_path, &final_content)
        .map_err(|e| format!("Failed to write habit file: {}", e))?;

    log::info!(
        "Successfully updated habit status for: {} (wrote {} bytes)",
        habit_path,
        final_content.len()
    );
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

    log::info!(
        "[HABIT-CHECK] Starting habit check for space: {}",
        space_path
    );

    let habits_path = Path::new(&space_path).join("Habits");
    if !habits_path.exists() {
        return Ok(Vec::new());
    }

    let mut reset_habits = Vec::new();

    // Pre-compile regex outside the loop
    let checkbox_regex = Regex::new(r"\[!checkbox:habit-status:([^\]]+)\]").unwrap();

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
            let frequency = HABIT_FREQUENCY_FIELD_REGEX
                .captures(&content)
                .and_then(|cap| cap.get(1))
                .map(|m| m.as_str());

            // Check for new checkbox format first
            let (current_status, is_checkbox_format) =
                if let Some(cap) = checkbox_regex.captures(&content) {
                    let checkbox_value = cap.get(1).map(|m| m.as_str()).unwrap_or("false");
                    // Convert checkbox values to status values
                    let status = if checkbox_value == "true" {
                        "completed"
                    } else {
                        "todo"
                    };
                    (Some(status), true)
                } else {
                    // Fall back to old format
                    let status = HABIT_STATUS_FIELD_REGEX
                        .captures(&content)
                        .and_then(|cap| cap.get(1))
                        .map(|m| m.as_str());
                    (status, false)
                };

            if let (Some(freq), Some(status)) = (frequency, current_status) {
                let habit_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown");

                log::debug!(
                    "[HABIT-CHECK] Checking habit '{}': frequency={}, status={}",
                    habit_name,
                    freq,
                    status
                );

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

                    log::debug!(
                        "Processing {} periods for habit '{}'",
                        missed_periods.len(),
                        habit_name
                    );

                    let mut history_entries = Vec::new();

                    // Create history entries for each missed period
                    // Limit backfilling to prevent excessive entries (max 100)
                    let periods_to_process = if missed_periods.len() > 100 {
                        log::warn!(
                            "Limiting backfill to 100 entries for habit '{}' (found {})",
                            habit_name,
                            missed_periods.len()
                        );
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
                            notes = "Missed - app offline";
                        } else {
                            // Current period - we're entering a NEW frequency window
                            // The previous period's completion was already recorded when it happened
                            // This entry represents the START of the new period, so it's always "To Do"
                            period_status = "To Do";
                            notes = "New period";
                        }

                        // Determine if this is a catch-up reset (backfilling) or regular auto-reset
                        let is_catchup = i < periods_to_process.len() - 1;
                        let action_type = if is_catchup { "Backfill" } else { "Auto-Reset" };

                        // Use table row format for history entry
                        let history_entry = format!(
                            "| {} | {} | {} | {} | {} |",
                            period_time.format("%Y-%m-%d"),
                            period_time.format("%-I:%M %p"),
                            period_status,
                            action_type,
                            notes
                        );
                        history_entries.push(history_entry);
                    }

                    // Start with current content and insert history entries first
                    let mut content_with_history = content.clone();

                    for history_entry in history_entries {
                        content_with_history =
                            insert_history_entry(&content_with_history, &history_entry)
                                .map_err(|e| format!("Failed to insert history entry: {}", e))?;
                    }

                    // ALWAYS update status to 'todo' after a reset (do this AFTER inserting history)
                    let final_content = if is_checkbox_format {
                        // Use checkbox format
                        checkbox_regex
                            .replace(
                                &content_with_history,
                                "[!checkbox:habit-status:false]", // false = todo
                            )
                            .to_string()
                    } else {
                        // Use old format
                        HABIT_STATUS_FIELD_REGEX
                            .replace(&content_with_history, "[!singleselect:habit-status:todo]")
                            .to_string()
                    };

                    // Write updated file
                    fs::write(&path, final_content)
                        .map_err(|e| format!("Failed to write habit file: {}", e))?;

                    log::info!(
                        "Reset habit '{}': status was '{}', now 'todo'",
                        habit_name,
                        status
                    );

                    reset_habits.push(
                        path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("unknown")
                            .to_string(),
                    );
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
    let mut last_history_line_idx = None;
    let mut in_history_section = false;
    let mut history_section_idx = None;
    let mut has_table_header = false;
    let mut has_old_list_format = false;
    let mut old_list_entries: Vec<(usize, &str)> = Vec::new();

    // Find the history section and last history entry
    for (i, line) in lines.iter().enumerate() {
        if line.starts_with("## History") {
            in_history_section = true;
            history_section_idx = Some(i);
            continue;
        }

        if in_history_section {
            // Skip the descriptive text line
            if line.starts_with("*Track your habit completions")
                || line.starts_with("*Track your habit")
            {
                continue;
            }
            // Check for table header
            else if line.contains("| Date") && line.contains("| Time") {
                has_table_header = true;
                continue;
            }
            // Skip table separator line
            else if line.contains("|---") || line.contains("| ---") {
                continue;
            }
            // Look for table rows (new format)
            else if line.starts_with("|") && line.contains(" | ") {
                last_history_line_idx = Some(i);
            }
            // Look for list items (old format)
            else if line.starts_with("- ") {
                has_old_list_format = true;
                old_list_entries.push((i, line));
                if last_history_line_idx.is_none() || i > last_history_line_idx.unwrap() {
                    last_history_line_idx = Some(i);
                }
            } else if line.starts_with("##") {
                // Hit another section, stop looking
                break;
            }
        }
    }

    // Helper function to convert old list entry to table row
    fn convert_list_to_table_row(list_entry: &str) -> Option<String> {
        // Parse old format: - **YYYY-MM-DD** at **HH:MM AM/PM**: Status (Action - Details)
        let re = regex::Regex::new(
            r"^- \*\*(\d{4}-\d{2}-\d{2})\*\* at \*\*([^*]+)\*\*: ([^(]+) \(([^)]+) - ([^)]+)\)$",
        )
        .ok()?;
        if let Some(caps) = re.captures(list_entry) {
            return Some(format!(
                "| {} | {} | {} | {} | {} |",
                &caps[1],       // Date
                &caps[2],       // Time
                caps[3].trim(), // Status
                &caps[4],       // Action
                &caps[5]        // Details
            ));
        }
        None
    }

    // Build the result based on whether we need to migrate or not
    let result = if has_old_list_format && !has_table_header {
        // Need to migrate from list format to table format
        let mut new_lines = Vec::new();
        let mut table_rows = Vec::new();

        // Convert all old list entries to table rows
        for (_, list_entry) in &old_list_entries {
            if let Some(table_row) = convert_list_to_table_row(list_entry) {
                table_rows.push(table_row);
            }
        }

        // Build the new content with table format
        if let Some(idx) = history_section_idx {
            // Add everything up to and including the history header
            new_lines.extend_from_slice(&lines[..=idx]);
            new_lines.push("");
            new_lines.push("*Track your habit completions below:*");
            new_lines.push("");
            new_lines.push("| Date | Time | Status | Action | Details |");
            new_lines.push("|------|------|--------|--------|---------|");

            // Add all converted rows
            for row in &table_rows {
                new_lines.push(row);
            }

            // Add the new entry
            new_lines.push(entry);

            // Add everything after the old entries
            let skip_until = if let Some(last_idx) = last_history_line_idx {
                last_idx + 1
            } else {
                idx + 1
            };

            if skip_until < lines.len() {
                // Skip any remaining old list entries and empty lines
                let mut i = skip_until;
                while i < lines.len() && (lines[i].starts_with("- ") || lines[i].trim().is_empty())
                {
                    i += 1;
                }
                if i < lines.len() {
                    new_lines.extend_from_slice(&lines[i..]);
                }
            }

            new_lines.join("\n")
        } else {
            // Shouldn't happen, but fallback to creating new section
            format!(
                "{}\n\n## History\n\n*Track your habit completions below:*\n\n| Date | Time | Status | Action | Details |\n|------|------|--------|--------|---------|\n{}",
                content.trim_end(),
                entry
            )
        }
    } else if let Some(idx) = last_history_line_idx {
        // Table already exists, insert after the last entry
        let mut new_lines = lines[..=idx].to_vec();
        new_lines.push(entry);
        new_lines.extend_from_slice(&lines[idx + 1..]);
        new_lines.join("\n")
    } else if let Some(idx) = history_section_idx {
        // History section exists but no entries yet
        let mut new_lines = lines[..=idx].to_vec();
        new_lines.push("");
        new_lines.push("*Track your habit completions below:*");
        new_lines.push("");

        if !has_table_header {
            // Add table header
            new_lines.push("| Date | Time | Status | Action | Details |");
            new_lines.push("|------|------|--------|--------|---------|");
        }

        new_lines.push(entry);

        // Add remaining content
        let skip_from = idx + 1;
        let mut i = skip_from;
        while i < lines.len() && (lines[i].trim().is_empty() || lines[i].starts_with("*Track")) {
            i += 1;
        }
        if i < lines.len() {
            new_lines.extend_from_slice(&lines[i..]);
        }

        new_lines.join("\n")
    } else {
        // No history section, create it with table format
        format!(
            "{}\n\n## History\n\n*Track your habit completions below:*\n\n| Date | Time | Status | Action | Details |\n|------|------|--------|--------|---------|\n{}",
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
fn calculate_missed_periods(
    last_action_time: chrono::NaiveDateTime,
    frequency: &str,
) -> Vec<chrono::DateTime<chrono::Local>> {
    use chrono::{Datelike, Duration, Local, TimeZone};

    let mut missed_periods = Vec::new();
    let now = Local::now();

    // Special handling for weekdays frequency
    if frequency == "weekdays" {
        // Convert to local time
        let mut check_time = Local
            .from_local_datetime(&last_action_time)
            .single()
            .unwrap_or_else(Local::now);

        // Move to next day
        check_time += Duration::days(1);

        // Add all weekdays between last action and now
        while check_time <= now {
            // Only add if it's a weekday (Monday = 0, Friday = 4)
            if check_time.weekday().num_days_from_monday() < 5 {
                missed_periods.push(check_time);
            }
            check_time += Duration::days(1);

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
        "twice-weekly" => Duration::days(3), // Simplified approximation
        "weekly" => Duration::days(7),
        "biweekly" => Duration::days(14),
        "monthly" => Duration::days(30), // Simplified approximation
        _ => {
            log::warn!(
                "Unknown frequency '{}' for missed periods calculation",
                frequency
            );
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
                check_time
                    .with_month(1)
                    .and_then(|t| t.with_year(check_time.year() + 1))
            } else {
                check_time.with_month(check_time.month() + 1)
            };

            check_time = next_month.unwrap_or(check_time + Duration::days(30));
        } else {
            check_time += reset_period;
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
    use chrono::{Datelike, Duration, Local, TimeZone};

    // Use the helper function to get the last action time
    let last_action_time = parse_last_habit_action_time(content);

    let Some(last_action) = last_action_time else {
        log::debug!("[HABIT-RESET] No last action time found, not resetting");
        return false; // Can't determine, don't reset
    };

    log::debug!(
        "[HABIT-RESET] Last action: {:?}, frequency: {}",
        last_action,
        frequency
    );

    // Always reset habits at their frequency interval, regardless of status
    // This ensures we record missed habits (when status is still "todo")
    // and completed habits (when status is "complete")

    let now = Local::now().naive_local();
    let duration_since_action = now.signed_duration_since(last_action);

    // Special handling for weekdays frequency
    if frequency == "weekdays" {
        // Convert last action to local time for day checking
        let last_local = Local
            .from_local_datetime(&last_action)
            .single()
            .unwrap_or_else(Local::now);
        let now_local = Local::now();

        // Check if it's currently a weekday (Monday = 1, Friday = 5)
        let is_weekday = now_local.weekday().num_days_from_monday() < 5;

        if !is_weekday {
            return false; // Don't reset on weekends
        }

        // If last action was on Friday and now it's Monday, should reset
        // If last action was earlier today, don't reset yet
        // Otherwise check if at least 1 day has passed
        let days_since = now_local
            .date_naive()
            .signed_duration_since(last_local.date_naive());
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
        log::info!(
            "[SHOULD-RESET] Habit WILL reset: time_since_last={:?}, period={:?}",
            duration_since_action,
            reset_period
        );
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
    pub created_date_time: String,
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
            for entry in entries.flatten() {
                let path = entry.path();

                // Only process directories
                if path.is_dir() {
                    let folder_name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    // Read README.md to extract project metadata
                    let readme_path = path.join("README.md");

                    let (mut title, description, due_date, status, mut created_date_time) =
                        if readme_path.exists() {
                            match fs::read_to_string(&readme_path) {
                                Ok(content) => {
                                    let (desc, due, stat, created) = parse_project_readme(&content);
                                    // Extract title from README
                                    let readme_title = extract_readme_title(&content);
                                    (readme_title, desc, due, stat, created)
                                }
                                Err(_) => (
                                    folder_name.clone(),
                                    "No description available".to_string(),
                                    None,
                                    "in-progress".to_string(),
                                    String::new(),
                                ),
                            }
                        } else {
                            (
                                folder_name.clone(),
                                "No description available".to_string(),
                                None,
                                "in-progress".to_string(),
                                String::new(),
                            )
                        };

                    // If created_date_time is empty, use file metadata timestamp as fallback
                    if created_date_time.is_empty() {
                        if let Ok(metadata) = fs::metadata(&readme_path) {
                            if let Ok(created_time) =
                                metadata.created().or_else(|_| metadata.modified())
                            {
                                if let Ok(duration) =
                                    created_time.duration_since(std::time::SystemTime::UNIX_EPOCH)
                                {
                                    let timestamp = chrono::DateTime::from_timestamp(
                                        duration.as_secs() as i64,
                                        0,
                                    )
                                    .unwrap_or_else(chrono::Utc::now);
                                    created_date_time = timestamp.to_rfc3339();
                                    log::debug!(
                                        "Using file metadata timestamp for project {}: {}",
                                        folder_name,
                                        created_date_time
                                    );
                                }
                            }
                        }
                        // Final fallback to current time if metadata isn't available
                        if created_date_time.is_empty() {
                            created_date_time = chrono::Utc::now().to_rfc3339();
                            log::debug!(
                                "Using current timestamp for project {}: {}",
                                folder_name,
                                created_date_time
                            );
                        }
                    }

                    // Sync folder name with README title if they don't match
                    // Prefer folder name as it was likely renamed intentionally
                    if title != folder_name && readme_path.exists() {
                        log::info!(
                            "Syncing project title: folder='{}', README title='{}'",
                            folder_name,
                            title
                        );

                        // Update README to match folder name
                        if let Ok(content) = fs::read_to_string(&readme_path) {
                            let updated_content = update_readme_title(&content, &folder_name);
                            if let Err(e) = fs::write(&readme_path, updated_content) {
                                log::error!("Failed to sync README title with folder name: {}", e);
                            } else {
                                log::info!(
                                    "Updated README title to match folder name: {}",
                                    folder_name
                                );
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
                        created_date_time,
                        action_count,
                    });
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
pub fn rename_gtd_project(
    old_project_path: String,
    new_project_name: String,
) -> Result<String, String> {
    log::info!(
        "Renaming GTD project from {} to {}",
        old_project_path,
        new_project_name
    );

    let old_path = Path::new(&old_project_path);

    // Validate old path exists and is a directory
    if !old_path.exists() {
        return Err("Project directory does not exist".to_string());
    }

    if !old_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    // Get parent directory (Projects folder)
    let parent = old_path
        .parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;

    // Create new path with the new name
    let new_path = parent.join(&new_project_name);

    // Check if new path already exists
    if new_path.exists() {
        return Err(format!(
            "A project with name '{}' already exists",
            new_project_name
        ));
    }

    // Rename the directory
    match fs::rename(old_path, &new_path) {
        Ok(_) => {
            log::info!(
                "Successfully renamed project folder to: {}",
                new_path.display()
            );

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
pub fn rename_gtd_action(
    old_action_path: String,
    new_action_name: String,
) -> Result<String, String> {
    log::info!(
        "Renaming GTD action from {} to {}",
        old_action_path,
        new_action_name
    );

    let old_path = Path::new(&old_action_path);

    // Validate old path exists and is a file
    if !old_path.exists() {
        return Err("Action file does not exist".to_string());
    }

    if !old_path.is_file() {
        return Err("Path is not a file".to_string());
    }

    // Get parent directory (project folder)
    let parent = old_path
        .parent()
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
        return Err(format!(
            "An action with name '{}' already exists",
            new_file_name
        ));
    }

    // If the path is the same, just update the title in the content
    if new_path == old_path {
        // Read the file content
        match fs::read_to_string(old_path) {
            Ok(content) => {
                // Update the H1 title
                let updated_content = update_readme_title(&content, &new_action_name);

                // Write back the updated content
                if let Err(e) = fs::write(old_path, updated_content) {
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
    match fs::rename(old_path, &new_path) {
        Ok(_) => {
            log::info!(
                "Successfully renamed action file to: {}",
                new_path.display()
            );

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
        if let Some(stripped) = trimmed.strip_prefix("# ") {
            return stripped.trim().to_string();
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
    let mut created_date_time = String::new();

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
        } else if trimmed.starts_with("## Created") {
            current_section = "created";
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
                    if trimmed.starts_with("[!singleselect:")
                        || trimmed.starts_with("[!multiselect:")
                    {
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
                                        _ => value,
                                    }
                                    .to_string();
                                }
                            }
                        }
                    } else {
                        // Fallback to raw text
                        status = trimmed.to_string();
                    }
                }
                "created" => {
                    if trimmed.starts_with("[!datetime:created_date_time:") {
                        if let Some(last_colon) = trimmed.rfind(':') {
                            if let Some(end_bracket) = trimmed.rfind(']') {
                                if last_colon < end_bracket {
                                    let value = &trimmed[last_colon + 1..end_bracket];
                                    if !value.is_empty() {
                                        created_date_time = value.to_string();
                                    }
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }

    (description, due_date, status, created_date_time)
}

/// Count the number of action files in a project directory
fn count_project_actions(project_path: &Path) -> u32 {
    let mut count = 0;

    if let Ok(entries) = fs::read_dir(project_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(extension) = path.extension() {
                    if extension == "md"
                        && path.file_name() != Some(std::ffi::OsStr::new("README.md"))
                    {
                        count += 1;
                    }
                }
            }
        }
    }

    count
}

// ===== GOOGLE CALENDAR INTEGRATION =====

use super::google_calendar::{GoogleCalendarEvent, GoogleCalendarManager, SyncStatus};
use lazy_static::lazy_static;

lazy_static! {
    static ref GOOGLE_CALENDAR_MANAGER: Arc<TokioMutex<Option<Arc<GoogleCalendarManager>>>> =
        Arc::new(TokioMutex::new(None));
}

// Simple test command to verify Tauri is working
#[tauri::command]
pub fn google_calendar_test() -> Result<String, String> {
    println!("[GoogleCalendar] TEST COMMAND CALLED!");

    // Check if environment variables are present
    let has_client_id = std::env::var("GOOGLE_CALENDAR_CLIENT_ID").is_ok();
    let has_client_secret = std::env::var("GOOGLE_CALENDAR_CLIENT_SECRET").is_ok();

    let message = format!(
        "Test successful! Credentials present: {}",
        has_client_id && has_client_secret
    );

    println!("[GoogleCalendar] {}", message);
    Ok(message)
}

/// Start Google Calendar OAuth authentication flow.
///
/// This is a synchronous wrapper because async Tauri commands with AppHandle parameter
/// were experiencing issues where they would hang silently without returning. This is a
/// known limitation when using AppHandle in async contexts with Tauri.
///
/// The function handles the OAuth 2.0 flow by:
/// 1. Starting an OAuth callback server in a separate thread
/// 2. Opening the user's browser to Google's authorization page
/// 3. Waiting for the authorization code from the callback
/// 4. Exchanging the code for access and refresh tokens
/// 5. Securely storing the tokens for future use
///
/// # Implementation Details
///
/// Uses a single shared Tokio runtime to avoid resource leaks from creating multiple
/// runtimes. The OAuth server runs in a separate OS thread but shares the same runtime
/// instance through Arc for efficient resource usage.
///
/// # Security
///
/// - Tokens are stored with atomic writes and restrictive file permissions
/// - Client credentials are loaded from environment variables
/// - OAuth state parameter is used to prevent CSRF attacks
///
/// # Returns
///
/// Success message on successful authentication or error details if any step fails
///
/// # Errors
///
/// - Missing environment variables for Google OAuth credentials
/// - Failed to create Tokio runtime
/// - Browser failed to open
/// - OAuth callback timeout or failure
/// - Token exchange failure
/// - Token storage failure
#[tauri::command]
pub async fn google_calendar_start_auth(app: AppHandle) -> Result<String, String> {
    use super::google_calendar::oauth_server::run_oauth_server;
    use super::google_calendar::simple_auth::{
        start_oauth_flow, BrowserOpenError, SimpleAuthConfig,
    };
    use super::google_calendar::token_manager::{StoredTokens, TokenManager};

    println!("[GoogleCalendar] Starting OAuth flow (async command)...");

    // Load credentials
    let client_id = match std::env::var("GOOGLE_CALENDAR_CLIENT_ID") {
        Ok(id) => {
            println!("[GoogleCalendar] Client ID loaded");
            id
        }
        Err(_) => {
            return Err("Google Calendar client ID not found in environment variables".to_string());
        }
    };

    let client_secret = match std::env::var("GOOGLE_CALENDAR_CLIENT_SECRET") {
        Ok(secret) => {
            println!("[GoogleCalendar] Client secret loaded");
            secret
        }
        Err(_) => {
            return Err(
                "Google Calendar client secret not found in environment variables".to_string(),
            );
        }
    };

    let config = SimpleAuthConfig {
        client_id: client_id.clone(),
        client_secret: client_secret.clone(),
        redirect_uri: "http://localhost:9898/callback".to_string(),
        auth_uri: "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
        token_uri: "https://oauth2.googleapis.com/token".to_string(),
    };

    // Use ambient Tokio runtime provided by Tauri for async operations

    // Open browser (do not log raw state or full URL)
    println!("[GoogleCalendar] Opening browser...");
    let start_result = match start_oauth_flow(&config) {
        Ok(res) => {
            println!("[GoogleCalendar] Browser opened");
            println!(
                "[GoogleCalendar] Authorization URL (redacted): {}",
                res.redacted_auth_url
            );
            res
        }
        Err(e) => {
            // If this is a BrowserOpenError, serialize details for UI manual fallback
            if let Some(browser_err) = e.downcast_ref::<BrowserOpenError>() {
                // Build a JSON string containing fields needed for manual OAuth fallback.
                // Do not log this payload; it is returned to the UI only.
                let payload = serde_json::json!({
                    "type": "browser_open_error",
                    "message": e.to_string(),
                    "redacted_auth_url": browser_err.redacted_auth_url,
                    // Sensitive fields included for UI manual flow:
                    "auth_url": browser_err.auth_url(),
                    "state": browser_err.state(),
                    "code_verifier": browser_err.code_verifier(),
                })
                .to_string();
                return Err(payload);
            }

            // Fallback: return stringified error
            return Err(e.to_string());
        }
    };

    // Restart the server with the expected state so CSRF can be validated
    let state = start_result.state().to_string();
    let code_verifier = start_result.code_verifier().to_string();
    let server_handle = tokio::spawn(async move {
        println!("[GoogleCalendar] Restarting OAuth callback server with expected state...");
        run_oauth_server(Some(state))
            .await
            .map_err(|e| e.to_string())
    });

    // Wait for the OAuth server to receive the code (with timeout)
    println!("[GoogleCalendar] Waiting for OAuth callback...");

    match server_handle.await {
        Ok(Ok(code)) => {
            println!("[GoogleCalendar] Received authorization code!");

            // Exchange code for tokens
            let token_response = config.exchange_code(&code, &code_verifier).await;

            match token_response {
                Ok(tokens) => {
                    println!("[GoogleCalendar] Token exchange successful!");

                    // Store tokens
                    let token_manager = TokenManager::new(app).map_err(|e| e.to_string())?;
                    let stored_tokens = StoredTokens {
                        access_token: tokens.access_token.clone(),
                        refresh_token: tokens.refresh_token.clone(),
                        expires_at: Some(chrono::Utc::now().timestamp() + tokens.expires_in),
                    };

                    token_manager
                        .save_tokens(&stored_tokens)
                        .map_err(|e| e.to_string())?;
                    println!("[GoogleCalendar] Tokens saved successfully!");

                    Ok(
                        "Authentication successful! You can now sync your Google Calendar."
                            .to_string(),
                    )
                }
                Err(e) => {
                    eprintln!("[GoogleCalendar] Failed to exchange code: {}", e);
                    Err(format!("Failed to exchange authorization code: {}", e))
                }
            }
        }
        Ok(Err(e)) => {
            eprintln!("[GoogleCalendar] OAuth server error: {}", e);
            Err(format!("OAuth callback failed: {}", e))
        }
        Err(e) => {
            eprintln!("[GoogleCalendar] OAuth server task join error: {}", e);
            Err("OAuth server task failed".to_string())
        }
    }
}

// Async test command to verify async commands work
#[tauri::command]
pub async fn google_calendar_test_async() -> Result<String, String> {
    println!("[GoogleCalendar] ASYNC TEST COMMAND CALLED!");

    // Simple async delay
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    println!("[GoogleCalendar] ASYNC TEST COMPLETED!");
    Ok("Async test successful!".to_string())
}

/// Check if the user is authenticated with Google Calendar.
///
/// This is a synchronous wrapper to avoid async/AppHandle issues.
/// Checks for the presence of valid stored tokens.
///
/// # Returns
///
/// - `true` if valid tokens exist
/// - `false` if no tokens found or error occurred
#[tauri::command]
pub fn google_calendar_is_authenticated(app: AppHandle) -> Result<bool, String> {
    use super::google_calendar::token_manager::TokenManager;

    let token_manager = TokenManager::new(app).map_err(|e| e.to_string())?;
    match token_manager.load_tokens() {
        Ok(Some(_)) => Ok(true),
        Ok(None) => Ok(false),
        Err(e) => {
            println!("[GoogleCalendar] Error checking auth status: {}", e);
            Ok(false)
        }
    }
}

/// Fetch Google Calendar events for the user.
///
/// Async command that fetches events using the ambient Tokio runtime.
///
/// # Implementation Details
///
/// Uses the existing runtime; no ad-hoc runtime creation or blocking occurs.
///
/// # Returns
///
/// Vector of calendar events or error message
#[tauri::command]
pub async fn google_calendar_fetch_events(
    app: AppHandle,
) -> Result<Vec<super::google_calendar::calendar_client::CalendarEvent>, String> {
    use super::google_calendar::calendar_client::fetch_calendar_events;
    use super::google_calendar::token_manager::TokenManager;

    println!("[GoogleCalendar] Fetching calendar events (async command)...");

    // Load stored tokens
    let token_manager = TokenManager::new(app).map_err(|e| e.to_string())?;
    let tokens = token_manager
        .load_tokens()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Not authenticated. Please connect to Google Calendar first.".to_string())?;

    println!("[GoogleCalendar] Token loaded, fetching events...");

    // Fetch events using the access token with ambient Tokio runtime
    let events = fetch_calendar_events(&tokens.access_token)
        .await
        .map_err(|e| format!("Failed to fetch events: {}", e))?;

    println!(
        "[GoogleCalendar] Successfully fetched {} events",
        events.len()
    );
    Ok(events)
}

/// Initialize Google Calendar manager with credentials
async fn init_google_calendar_manager(app: AppHandle) -> Result<(), String> {
    println!("[GoogleCalendar] Attempting to initialize Google Calendar manager...");
    println!(
        "[GoogleCalendar] Working directory: {:?}",
        std::env::current_dir()
    );

    // Try to load .env file manually from the project root
    let env_path = std::env::current_dir()
        .map(|mut p| {
            // Go up from src-tauri if we're there
            if p.ends_with("src-tauri") {
                p.pop();
            }
            p.push(".env");
            p
        })
        .ok();

    if let Some(path) = &env_path {
        println!("[GoogleCalendar] Looking for .env file at: {:?}", path);
        if path.exists() {
            println!("[GoogleCalendar] .env file found, loading...");
            dotenv::from_path(path).ok();
        } else {
            println!("[GoogleCalendar] .env file not found at {:?}", path);
        }
    }

    let client_id = std::env::var("GOOGLE_CALENDAR_CLIENT_ID")
        .or_else(|_| std::env::var("VITE_GOOGLE_CALENDAR_CLIENT_ID"))
        .map_err(|e| {
            println!("[GoogleCalendar] Failed to get client ID: {:?}", e);
            println!("[GoogleCalendar] Available env vars:");
            for (key, val) in std::env::vars() {
                if key.contains("GOOGLE") || key.contains("VITE") {
                    println!("  {} = {}", key, val);
                }
            }
            "Google Calendar client ID not found in environment variables"
        })?;

    let client_secret = std::env::var("GOOGLE_CALENDAR_CLIENT_SECRET")
        .or_else(|_| std::env::var("VITE_GOOGLE_CALENDAR_CLIENT_SECRET"))
        .map_err(|e| {
            println!("[GoogleCalendar] Failed to get client secret: {:?}", e);
            "Google Calendar client secret not found in environment variables"
        })?;

    println!("[GoogleCalendar] Credentials loaded successfully");

    let manager = GoogleCalendarManager::new(app, client_id, client_secret)
        .await
        .map_err(|e| {
            println!("[GoogleCalendar] Failed to create manager: {}", e);
            format!("Failed to create Google Calendar manager: {}", e)
        })?;

    let mut global_manager = GOOGLE_CALENDAR_MANAGER.lock().await;
    *global_manager = Some(Arc::new(manager));

    println!("[GoogleCalendar] Manager initialized successfully");
    Ok(())
}

#[tauri::command]
pub async fn google_calendar_connect(app: AppHandle) -> Result<String, String> {
    println!("[GoogleCalendar] ========================================");
    println!(
        "[GoogleCalendar] Connect command called at {:?}",
        std::time::SystemTime::now()
    );
    println!("[GoogleCalendar] ========================================");

    // First, let's check if .env file exists and try to load it
    let project_root = std::env::current_dir()
        .map(|mut p| {
            if p.ends_with("src-tauri") {
                p.pop();
            }
            p
        })
        .unwrap_or_else(|_| std::path::PathBuf::from("."));

    let env_file = project_root.join(".env");
    println!("[GoogleCalendar] Looking for .env at: {:?}", env_file);
    println!("[GoogleCalendar] .env exists: {}", env_file.exists());

    if env_file.exists() {
        println!("[GoogleCalendar] Loading .env file...");
        match dotenv::from_path(&env_file) {
            Ok(_) => println!("[GoogleCalendar] .env loaded successfully"),
            Err(e) => println!("[GoogleCalendar] Failed to load .env: {}", e),
        }
    }

    // Check environment variables
    println!("[GoogleCalendar] Checking environment variables...");
    let has_client_id = std::env::var("GOOGLE_CALENDAR_CLIENT_ID").is_ok();
    let has_client_secret = std::env::var("GOOGLE_CALENDAR_CLIENT_SECRET").is_ok();
    println!(
        "[GoogleCalendar] Credentials present: {}",
        has_client_id && has_client_secret
    );

    if !has_client_id || !has_client_secret {
        return Err("Google Calendar credentials not found. Please ensure credentials are set in your .env file".to_string());
    }

    // Initialize manager if not already done
    let needs_init = {
        let manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;
        manager_guard.is_none()
    };

    println!("[GoogleCalendar] Manager needs init: {}", needs_init);

    if needs_init {
        println!("[GoogleCalendar] Initializing manager...");
        match init_google_calendar_manager(app.clone()).await {
            Ok(_) => println!("[GoogleCalendar] Manager initialized successfully"),
            Err(e) => {
                println!("[GoogleCalendar] Failed to initialize manager: {}", e);
                return Err(e);
            }
        }
    }

    // Clone the Arc reference before the await
    let manager = {
        let manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;
        manager_guard
            .as_ref()
            .ok_or_else(|| "Google Calendar manager not initialized".to_string())?
            .clone()
    };

    println!("[GoogleCalendar] Calling manager.connect()...");
    manager.connect().await.map_err(|e| {
        println!("[GoogleCalendar] Connect failed: {}", e);
        format!("Failed to connect to Google Calendar: {}", e)
    })?;

    println!("[GoogleCalendar] Successfully connected!");
    Ok("Successfully connected to Google Calendar".to_string())
}

/// Disconnect from Google Calendar by removing stored tokens.
///
/// This is a synchronous wrapper to avoid async/AppHandle issues.
/// Securely deletes the stored OAuth tokens, effectively logging the user out.
///
/// # Security
///
/// Uses secure deletion to remove tokens from disk storage.
///
/// # Returns
///
/// Success message or error if token deletion fails
#[tauri::command]
pub fn google_calendar_disconnect_simple(app: AppHandle) -> Result<String, String> {
    use super::google_calendar::token_manager::TokenManager;

    println!("[GoogleCalendar] Disconnecting...");

    let token_manager = TokenManager::new(app).map_err(|e| e.to_string())?;
    token_manager.delete_tokens().map_err(|e| e.to_string())?;

    println!("[GoogleCalendar] Tokens deleted, disconnected successfully");
    Ok("Successfully disconnected from Google Calendar".to_string())
}

#[tauri::command]
pub async fn google_calendar_disconnect() -> Result<String, String> {
    let manager = {
        let manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;
        manager_guard
            .as_ref()
            .ok_or_else(|| "Google Calendar manager not initialized".to_string())?
            .clone()
    };

    manager
        .disconnect()
        .await
        .map_err(|e| format!("Failed to disconnect from Google Calendar: {}", e))?;

    Ok("Successfully disconnected from Google Calendar".to_string())
}

#[tauri::command]
pub async fn google_calendar_sync(app: AppHandle) -> Result<Vec<GoogleCalendarEvent>, String> {
    // Initialize manager if not already done
    let needs_init = {
        let manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;
        manager_guard.is_none()
    };

    if needs_init {
        init_google_calendar_manager(app.clone()).await?;
    }

    let manager = {
        let manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;
        manager_guard
            .as_ref()
            .ok_or_else(|| "Google Calendar manager not initialized".to_string())?
            .clone()
    };

    let events = manager
        .sync_events(None, None)
        .await
        .map_err(|e| format!("Failed to sync Google Calendar events: {}", e))?;

    Ok(events)
}

#[tauri::command]
pub async fn google_calendar_get_status(app: AppHandle) -> Result<SyncStatus, String> {
    // Initialize manager if not already done
    let needs_init = {
        let manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;
        manager_guard.is_none()
    };

    if needs_init {
        init_google_calendar_manager(app.clone()).await?;
    }

    let manager = {
        let manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;
        manager_guard
            .as_ref()
            .ok_or_else(|| "Google Calendar manager not initialized".to_string())?
            .clone()
    };

    let status = manager
        .get_status()
        .await
        .map_err(|e| format!("Failed to get Google Calendar status: {}", e))?;

    Ok(status)
}

#[tauri::command]
pub async fn google_calendar_get_cached_events(
    app: AppHandle,
) -> Result<Vec<GoogleCalendarEvent>, String> {
    // Initialize manager if not already done
    let needs_init = {
        let manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;
        manager_guard.is_none()
    };

    if needs_init {
        init_google_calendar_manager(app.clone()).await?;
    }

    let manager = {
        let manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;
        manager_guard
            .as_ref()
            .ok_or_else(|| "Google Calendar manager not initialized".to_string())?
            .clone()
    };

    let events = manager
        .get_cached_events()
        .await
        .map_err(|e| format!("Failed to get cached Google Calendar events: {}", e))?;

    Ok(events)
}
