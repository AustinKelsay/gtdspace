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
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::{StoreExt, StoreBuilder};

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