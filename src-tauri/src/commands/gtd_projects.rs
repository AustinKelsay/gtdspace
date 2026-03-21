//! GTD project and action commands.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path};

use super::seed_data::{generate_action_template, generate_project_readme};

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

    let safe_project_name = validate_project_name(&project_name)?;

    // Create project folder
    let project_path = projects_path.join(&safe_project_name);

    if project_path.exists() {
        return Err(format!("Project '{}' already exists", safe_project_name));
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

    if let Err(e) = fs::create_dir_all(&project_path) {
        return Err(format!("Failed to create project directory: {}", e));
    }

    // Create README.md with project template
    let readme_path = project_path.join("README.md");
    let project_status = status.unwrap_or_else(|| "in-progress".to_string());
    let readme_content =
        generate_project_readme(&safe_project_name, &description, due_date, &project_status);

    if let Err(e) = fs::write(&readme_path, readme_content) {
        // Clean up project directory if README creation fails
        let _ = fs::remove_dir(&project_path);
        return Err(format!("Failed to create project README: {}", e));
    }

    log::info!("Successfully created project: {}", safe_project_name);
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
///   status: 'in-progress',
///   due_date: '2024-11-15',
///   focus_date: '2024-11-14T14:30:00',
///   effort: 'Medium'
/// });
/// ```
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn create_gtd_action(
    project_path: String,
    action_name: String,
    status: String,
    due_date: Option<String>,
    focus_date: Option<String>,
    effort: String,
    contexts: Option<Vec<String>>,
    notes: Option<String>,
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
    let file_name = format!("{}.md", sanitize_markdown_file_stem(&action_name));
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
        notes,
    );

    match fs::write(&action_path, action_content) {
        Ok(_) => {
            log::info!("Successfully created action: {}", action_name);
            Ok(action_path.to_string_lossy().to_string())
        }
        Err(e) => Err(format!("Failed to create action file: {}", e)),
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
    pub created_date_time: String,
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
pub fn list_gtd_projects(space_path: String) -> Result<Vec<GTDProject>, String> {
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

                    let (title, description, due_date, status, mut created_date_time) =
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

                    // Count action files in the project
                    let action_count = count_project_actions(&path);

                    projects.push(GTDProject {
                        name: if title != folder_name {
                            folder_name.clone()
                        } else {
                            title
                        },
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

    let safe_project_name = validate_project_name(&new_project_name)?;

    // Create new path with the new name
    let new_path = parent.join(&safe_project_name);

    // Check if new path already exists and is not this same project with different casing
    if new_path.exists() && !paths_refer_to_same_entry(old_path, &new_path) {
        return Err(format!(
            "A project with name '{}' already exists",
            safe_project_name
        ));
    }

    // Rename the directory
    match rename_path(old_path, &new_path) {
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
                        let updated_content = update_readme_title(&content, &safe_project_name);

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
    let sanitized_name = sanitize_markdown_file_stem(&new_action_name);
    let new_file_name = if new_action_name.ends_with(".markdown") {
        format!("{}.markdown", sanitized_name)
    } else {
        format!("{}.md", sanitized_name)
    };

    let new_path = parent.join(&new_file_name);

    // Check if new path already exists and is not this same action with different casing
    if new_path.exists() && !paths_refer_to_same_entry(old_path, &new_path) {
        return Err(format!(
            "An action with name '{}' already exists",
            new_file_name
        ));
    }

    // If the path is the same, just update the title in the content
    if paths_refer_to_same_entry(old_path, &new_path) {
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

                let old_file_name = old_path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or_default();
                let new_file_name = new_path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or_default();

                if old_file_name != new_file_name {
                    rename_path(old_path, &new_path)
                        .map_err(|e| format!("Failed to rename action file: {}", e))?;
                    return Ok(new_path.to_string_lossy().to_string());
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
    match rename_path(old_path, &new_path) {
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

fn validate_project_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Project name cannot be empty".to_string());
    }

    if trimmed.starts_with('.') {
        return Err("Project name cannot start with '.'".to_string());
    }

    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Project name cannot contain path separators".to_string());
    }

    let path = Path::new(trimmed);
    if path.is_absolute() {
        return Err("Project name cannot be an absolute path".to_string());
    }

    match path.components().next() {
        Some(Component::Normal(_)) if path.components().count() == 1 => {}
        _ => return Err("Project name must be a single directory name".to_string()),
    }

    Ok(trimmed.to_string())
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

fn sanitize_markdown_file_stem(name: &str) -> String {
    let sanitized = name
        .trim()
        .trim_end_matches(".md")
        .trim_end_matches(".markdown")
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => ch,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();

    if sanitized.is_empty() {
        "untitled".to_string()
    } else {
        sanitized
    }
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

    let case_only_rename = paths_refer_to_same_entry(old_path, new_path);
    if !case_only_rename {
        return fs::rename(old_path, new_path);
    }

    let parent = old_path
        .parent()
        .ok_or_else(|| std::io::Error::other("Cannot determine parent directory"))?;
    let old_name = old_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("item");
    let mut temp_counter = 0u32;

    loop {
        if temp_counter > 100 {
            return Err(std::io::Error::other(
                "Failed to allocate temporary rename path",
            ));
        }

        let temp_path = parent.join(format!(".{}.rename-temp-{}", old_name, temp_counter));
        temp_counter += 1;

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
        if trimmed.starts_with("## Desired Outcome") || trimmed.starts_with("## Description") {
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
                        if let Some(value) = extract_marker_value(trimmed, "[!datetime:due_date:") {
                            if !value.is_empty() && value != "Not set" {
                                due_date = Some(value.to_string());
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
                        if let Some(value) = extract_marker_value(trimmed, "[!singleselect:status:")
                            .or_else(|| {
                                extract_marker_value(trimmed, "[!singleselect:project-status:")
                            })
                            .or_else(|| extract_marker_value(trimmed, "[!multiselect:status:"))
                            .or_else(|| {
                                extract_marker_value(trimmed, "[!multiselect:project-status:")
                            })
                        {
                            status = match value {
                                "in-progress" => "in-progress",
                                "waiting" => "waiting",
                                "completed" => "completed",
                                other => other,
                            }
                            .to_string();
                        }
                    } else {
                        // Fallback to raw text
                        status = trimmed.to_string();
                    }
                }
                "created" => {
                    if trimmed.starts_with("[!datetime:created_date_time:") {
                        if let Some(value) =
                            extract_marker_value(trimmed, "[!datetime:created_date_time:")
                        {
                            if !value.is_empty() {
                                created_date_time = value.to_string();
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

fn extract_marker_value<'a>(line: &'a str, prefix: &str) -> Option<&'a str> {
    line.strip_prefix(prefix)?.strip_suffix(']')
}

/// Count the number of action files in a project directory
fn count_project_actions(project_path: &Path) -> u32 {
    let mut count = 0;

    if let Ok(entries) = fs::read_dir(project_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(extension) = path.extension() {
                    if (extension == "md" || extension == "markdown")
                        && path.file_name() != Some(std::ffi::OsStr::new("README.md"))
                        && path.file_name() != Some(std::ffi::OsStr::new("README.markdown"))
                    {
                        count += 1;
                    }
                }
            }
        }
    }

    count
}
