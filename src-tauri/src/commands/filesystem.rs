//! File system commands and shared file operation payloads.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path};

fn generate_stable_file_id(path: &Path) -> String {
    path.to_string_lossy()
        .as_bytes()
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect()
}

fn strip_markdown_extension(name: &str) -> &str {
    name.strip_suffix(".markdown")
        .or_else(|| name.strip_suffix(".md"))
        .unwrap_or(name)
}

fn extract_safe_file_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("File name cannot be empty".to_string());
    }

    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("File name cannot contain path separators".to_string());
    }

    let path = Path::new(trimmed);
    if path.is_absolute() {
        return Err("File name cannot be an absolute path".to_string());
    }

    match path.components().next() {
        Some(Component::Normal(_)) if path.components().count() == 1 => {}
        _ => return Err("File name must be a single path component".to_string()),
    }

    let file_name = path
        .file_name()
        .and_then(|segment| segment.to_str())
        .ok_or_else(|| "File name contains unsupported characters".to_string())?;

    if file_name == "." || file_name == ".." {
        return Err("File name cannot be '.' or '..'".to_string());
    }

    Ok(file_name.to_string())
}

fn paths_refer_to_same_entry(left: &Path, right: &Path) -> bool {
    match (fs::canonicalize(left), fs::canonicalize(right)) {
        (Ok(left_canonical), Ok(right_canonical)) => left_canonical == right_canonical,
        _ => false,
    }
}

fn rename_path(old_path: &Path, new_path: &Path) -> Result<(), std::io::Error> {
    if old_path == new_path {
        return Ok(());
    }

    if !paths_refer_to_same_entry(old_path, new_path) {
        return fs::rename(old_path, new_path);
    }

    let parent = old_path
        .parent()
        .ok_or_else(|| std::io::Error::other("Cannot determine parent directory"))?;
    let old_name = old_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("file");

    for counter in 0..=100 {
        let temp_path = parent.join(format!(".{}.rename-temp-{}", old_name, counter));
        if temp_path.exists() {
            continue;
        }

        fs::rename(old_path, &temp_path)?;
        match fs::rename(&temp_path, new_path) {
            Ok(()) => return Ok(()),
            Err(error) => {
                let _ = fs::rename(&temp_path, old_path);
                return Err(error);
            }
        }
    }

    Err(std::io::Error::other(
        "Failed to allocate temporary rename path",
    ))
}

fn is_cross_device_rename_error(error: &std::io::Error) -> bool {
    #[cfg(target_family = "unix")]
    {
        matches!(error.raw_os_error(), Some(18))
    }
    #[cfg(target_family = "windows")]
    {
        matches!(error.raw_os_error(), Some(17))
    }
    #[cfg(not(any(target_family = "unix", target_family = "windows")))]
    {
        let _ = error;
        false
    }
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

/// Helper function to recursively scan directories for markdown files
fn scan_directory_recursive(dir_path: &Path, files: &mut Vec<MarkdownFile>) -> Result<(), String> {
    let markdown_extensions = ["md", "markdown"];

    match fs::read_dir(dir_path) {
        Ok(entries) => {
            for entry_result in entries {
                let entry = entry_result
                    .map_err(|e| format!("Failed to read entry in {:?}: {}", dir_path, e))?;
                let path = entry.path();
                let metadata = fs::symlink_metadata(&path)
                    .map_err(|e| format!("Failed to read metadata for {:?}: {}", path, e))?;

                // Recursively scan subdirectories
                if metadata.file_type().is_symlink() {
                    continue;
                } else if metadata.file_type().is_dir() {
                    // Skip hidden directories (starting with .)
                    if let Some(dir_name) = path.file_name() {
                        if !dir_name.to_string_lossy().starts_with('.') {
                            scan_directory_recursive(&path, files)?;
                        }
                    }
                } else if metadata.file_type().is_file() {
                    // Process markdown files
                    if let Some(extension) = path.extension() {
                        let ext_str = extension.to_string_lossy().to_lowercase();
                        if markdown_extensions.contains(&ext_str.as_str()) {
                            let file_name = path
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();

                            files.push(MarkdownFile {
                                id: generate_stable_file_id(&path),
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
/// Skips the project's README (README.md/README.markdown)
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
            for entry_result in entries {
                let entry = match entry_result {
                    Ok(entry) => entry,
                    Err(error) => {
                        log::warn!(
                            "Skipping unreadable entry in {}: {}",
                            dir_path.display(),
                            error
                        );
                        continue;
                    }
                };
                let path = entry.path();
                if path.is_file() {
                    if let Some(extension) = path.extension() {
                        let ext_str = extension.to_string_lossy().to_lowercase();
                        if ext_str == "md" || ext_str == "markdown" {
                            let is_readme = path
                                .file_name()
                                .and_then(|name| name.to_str())
                                .map(|name| {
                                    let lower = name.to_ascii_lowercase();
                                    lower == "readme.md" || lower == "readme.markdown"
                                })
                                .unwrap_or(false);
                            if is_readme {
                                continue;
                            }
                            if let Ok(metadata) = entry.metadata() {
                                files.push(MarkdownFile {
                                    id: generate_stable_file_id(&path),
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

    let safe_name = match extract_safe_file_name(&name) {
        Ok(name) => name,
        Err(message) => {
            return Ok(FileOperationResult {
                success: false,
                path: None,
                message: Some(message),
            });
        }
    };

    // Add .md extension if not present
    let file_name = if safe_name.ends_with(".md") || safe_name.ends_with(".markdown") {
        safe_name.clone()
    } else {
        format!("{}.md", safe_name)
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

    // Normalize horizon detection
    let is_in_projects = dir_path.components().any(|c| c.as_os_str() == "Projects");
    let is_in_habits = dir_path.components().any(|c| c.as_os_str() == "Habits");
    let is_in_vision = dir_path.components().any(|c| c.as_os_str() == "Vision");
    let is_in_goals = dir_path.components().any(|c| c.as_os_str() == "Goals");
    let is_in_areas = dir_path
        .components()
        .any(|c| c.as_os_str() == "Areas of Focus");
    let is_in_purpose = dir_path
        .components()
        .any(|c| c.as_os_str() == "Purpose & Principles");

    // For project actions, require README.md to distinguish from project root creation
    let is_project_dir = dir_path.join("README.md").exists();

    // Create appropriate template content based on GTD horizon
    let clean_name = strip_markdown_extension(&safe_name);
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
        format!(
            r#"# {}

## Horizon
[!singleselect:vision-horizon:3-years]

## Projects References
[!projects-references:]

## Goals References
[!goals-references:]

## Areas References
[!areas-references:]

## Purpose & Principles References (optional)
[!purpose-references:]

## Created
[!datetime:created_date_time:{}]

## Narrative
*Describe the vivid picture of your desired future state and the key themes you want to realize.*
"#,
            clean_name,
            chrono::Local::now().to_rfc3339()
        )
    } else if is_in_goals {
        format!(
            r#"# {}

## Status
[!singleselect:goal-status:in-progress]

## Target Date (optional)
[!datetime:goal-target-date:]

## Projects References
[!projects-references:]

## Areas References
[!areas-references:]

## Vision References (optional)
[!vision-references:]

## Purpose & Principles References (optional)
[!purpose-references:]

## Created
[!datetime:created_date_time:{}]

## Description
*Describe the desired outcome, success criteria, and why this goal matters.*
"#,
            clean_name,
            chrono::Local::now().to_rfc3339()
        )
    } else if is_in_areas {
        format!(
            r#"# {}

## Status
[!singleselect:area-status:steady]

## Review Cadence
[!singleselect:area-review-cadence:monthly]

## Projects References
[!projects-references:]

## Goals References
[!goals-references:]

## Vision References (optional)
[!vision-references:]

## Purpose & Principles References (optional)
[!purpose-references:]

## Created
[!datetime:created_date_time:{}]

## Description
*Summarize the scope, responsibilities, and commitments for this area.*
"#,
            clean_name,
            chrono::Local::now().to_rfc3339()
        )
    } else if is_in_purpose {
        format!(
            r#"# {}

## Projects References
[!projects-references:]

## Goals References
[!goals-references:]

## Vision References
[!vision-references:]

## Areas References (optional)
[!areas-references:]

## Created
[!datetime:created_date_time:{}]

## Description
*Capture the purpose and guiding principles that anchor your commitments.*
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

    let safe_name = match extract_safe_file_name(&new_name) {
        Ok(name) => name,
        Err(message) => {
            return Ok(FileOperationResult {
                success: false,
                path: None,
                message: Some(message),
            });
        }
    };

    // Add .md extension if not present
    let file_name = if safe_name.ends_with(".md") || safe_name.ends_with(".markdown") {
        safe_name
    } else {
        format!("{}.md", safe_name)
    };

    let new_file_path = directory.join(&file_name);

    // Check if target file already exists
    if new_file_path.exists() && !paths_refer_to_same_entry(old_file_path, &new_file_path) {
        return Ok(FileOperationResult {
            success: false,
            path: None,
            message: Some("A file with that name already exists".to_string()),
        });
    }

    match rename_path(old_file_path, &new_file_path) {
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
    use std::io::ErrorKind;
    use std::thread::sleep;
    use std::time::Duration;

    log::info!("Deleting file: {}", path);

    let file_path = Path::new(&path);

    if !file_path.exists() {
        // Idempotent delete: treat as success if file is already gone
        return Ok(FileOperationResult {
            success: true,
            path: Some(path.clone()),
            message: Some("File deleted successfully".to_string()),
        });
    }

    if !file_path.is_file() {
        return Ok(FileOperationResult {
            success: false,
            path: None,
            message: Some("Path is not a file".to_string()),
        });
    }

    let mut attempt: u32 = 0;
    let attempts: [u64; 3] = [50, 150, 300]; // backoff in ms
    #[allow(unused_mut)] // target is reassigned in the rename workaround branch
    let mut target = file_path.to_path_buf();

    loop {
        match fs::remove_file(&target) {
            Ok(_) => {
                log::info!("Successfully deleted file: {}", path);
                return Ok(FileOperationResult {
                    success: true,
                    path: Some(path.clone()),
                    message: Some("File deleted successfully".to_string()),
                });
            }
            Err(e) => {
                if e.kind() == ErrorKind::NotFound {
                    log::info!("File already gone (NotFound): {}", path);
                    return Ok(FileOperationResult {
                        success: true,
                        path: Some(path.clone()),
                        message: Some("File deleted successfully".to_string()),
                    });
                }
                log::warn!("Attempt {} to delete file failed: {}", attempt + 1, e);

                // Windows: EPERM/locked file fallback — try rename + delete
                #[cfg(target_os = "windows")]
                {
                    if e.kind() == ErrorKind::PermissionDenied {
                        let mut tmp = target.clone();
                        let mut suffix_counter = 0u32;
                        // Create a unique temp name next to the file
                        loop {
                            if suffix_counter > 100 {
                                log::error!(
                                    "Exceeded temporary rename attempts while deleting {}",
                                    path
                                );
                                break;
                            }
                            let ext = format!(
                                "delete{}.tmp",
                                if suffix_counter == 0 {
                                    String::new()
                                } else {
                                    format!("-{}", suffix_counter)
                                }
                            );
                            tmp.set_extension(ext);
                            if !tmp.exists() {
                                break;
                            }
                            suffix_counter += 1;
                        }
                        match fs::rename(&target, &tmp) {
                            Ok(_) => {
                                match fs::remove_file(&tmp) {
                                    Ok(_) => {
                                        log::info!("Deleted file via rename workaround: {}", path);
                                        return Ok(FileOperationResult {
                                            success: true,
                                            path: Some(path.clone()),
                                            message: Some("File deleted successfully".to_string()),
                                        });
                                    }
                                    Err(e2) => {
                                        log::error!(
                                            "Failed to remove renamed temp file {:?}: {}",
                                            tmp,
                                            e2
                                        );
                                        // Keep trying to remove the renamed target in subsequent attempts
                                        target = tmp;
                                    }
                                }
                            }
                            Err(e1) => {
                                log::warn!("Failed to rename locked file for deletion: {}", e1);
                            }
                        }
                    }
                }

                if (attempt as usize) < attempts.len() {
                    sleep(Duration::from_millis(attempts[attempt as usize]));
                    attempt += 1;
                    continue;
                }

                log::error!("Failed to delete file {} after retries: {}", path, e);
                return Ok(FileOperationResult {
                    success: false,
                    path: None,
                    message: Some(format!("Failed to delete file: {}", e)),
                });
            }
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
            if is_cross_device_rename_error(&e) {
                log::info!(
                    "Rename crossed devices; falling back to copy-and-delete for {}",
                    source_path
                );

                fs::copy(source, dest).map_err(|copy_error| {
                    format!(
                        "Failed to copy file during cross-device move: {}",
                        copy_error
                    )
                })?;
                fs::remove_file(source).map_err(|remove_error| {
                    let _ = fs::remove_file(dest);
                    format!(
                        "Copied file but failed to remove original during move: {}",
                        remove_error
                    )
                })?;

                log::info!("Successfully moved file to: {}", dest_path);
                return Ok("File moved successfully".to_string());
            }

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
    is_regex: Option<bool>,
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

    if search_term.is_empty() {
        return Err("search term cannot be empty".to_string());
    }

    // Perform replacement
    let treat_as_regex = is_regex.unwrap_or(false);
    let (new_content, replacements_made) = if treat_as_regex {
        let regex =
            regex::Regex::new(&search_term).map_err(|e| format!("Invalid regex pattern: {}", e))?;
        let match_count = regex.find_iter(&content).count();
        (
            regex
                .replace_all(&content, replace_term.as_str())
                .to_string(),
            match_count,
        )
    } else {
        let match_count = content.matches(&search_term).count();
        (content.replace(&search_term, &replace_term), match_count)
    };

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

/// Check if a file exists at the specified path
///
/// Checks for file existence without reading the file content.
/// This is more efficient than reading the file and safer than
/// catching read errors to determine existence.
///
/// # Arguments
///
/// * `file_path` - The path to the file to check
///
/// # Returns
///
/// True if the file exists and is a file (not a directory), false otherwise
///
/// # Example
///
/// ```javascript
/// import { invoke } from '@tauri-apps/api/core';
///
/// const exists = await invoke('check_file_exists', { filePath: '/path/to/file.md' });
/// ```
#[tauri::command]
pub fn check_file_exists(file_path: String) -> Result<bool, String> {
    log::info!("Checking if file exists: {}", file_path);
    let path = Path::new(&file_path);
    let exists = path.exists() && path.is_file();
    log::info!("File exists: {} -> {}", file_path, exists);
    Ok(exists)
}
