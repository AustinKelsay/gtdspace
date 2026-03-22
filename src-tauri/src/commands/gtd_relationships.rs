//! GTD relationship lookup commands.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const MARKDOWN_EXTENSIONS: [&str; 2] = ["md", "markdown"];

fn normalize_habit_status_value(value: &str) -> String {
    match value.trim().to_ascii_lowercase().as_str() {
        "true" | "completed" | "complete" => "completed".to_string(),
        _ => "todo".to_string(),
    }
}

fn extract_habit_status(content: &str) -> String {
    for marker in ["[!checkbox:habit-status:", "[!singleselect:habit-status:"] {
        if let Some(idx) = content.find(marker) {
            let after_start = &content[idx + marker.len()..];
            if let Some(end) = after_start.find(']') {
                return normalize_habit_status_value(&after_start[..end]);
            }
        }
    }

    "todo".to_string()
}

fn is_markdown_file(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|segment| segment.to_str()) else {
        return false;
    };

    let normalized = extension.to_ascii_lowercase();
    MARKDOWN_EXTENSIONS.contains(&normalized.as_str())
}

fn find_readme_file(dir: &Path) -> Option<PathBuf> {
    for extension in MARKDOWN_EXTENSIONS {
        let candidate = dir.join(format!("README.{}", extension));
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn strip_project_readme_suffix(path: &str) -> Option<String> {
    ["/README.md", "/README.markdown"]
        .into_iter()
        .find_map(|suffix| path.strip_suffix(suffix).map(|value| value.to_string()))
}

fn extract_reference_block(content: &str, tag: &str) -> Option<String> {
    let marker = format!("[!{}:", tag);
    let start_idx = content.find(&marker)?;
    let value_start = start_idx + marker.len();
    let remaining = &content[value_start..];
    let mut nested_brackets = 0usize;

    for (idx, ch) in remaining.char_indices() {
        match ch {
            '[' => nested_brackets += 1,
            ']' if nested_brackets == 0 => return Some(remaining[..idx].to_string()),
            ']' => nested_brackets = nested_brackets.saturating_sub(1),
            _ => {}
        }
    }

    None
}

fn decode_reference_block(raw: &str) -> String {
    let mut decoded = raw.trim().to_string();

    for _ in 0..3 {
        if !(decoded.contains("%25")
            || decoded.contains("%5B")
            || decoded.contains("%22")
            || decoded.contains("%2F"))
        {
            break;
        }

        match urlencoding::decode(&decoded) {
            Ok(value) => decoded = value.into_owned(),
            Err(_) => break,
        }
    }

    decoded
}

fn parse_reference_paths(raw: &str) -> Vec<String> {
    let decoded = decode_reference_block(raw);

    if decoded.starts_with('[') && decoded.ends_with(']') {
        match serde_json::from_str::<Vec<String>>(&decoded) {
            Ok(paths) => paths
                .into_iter()
                .map(|path| path.replace('\\', "/"))
                .collect(),
            Err(_) => decoded
                .trim_start_matches('[')
                .trim_end_matches(']')
                .split(',')
                .map(|path| path.trim().trim_matches('"').replace('\\', "/"))
                .filter(|path| !path.is_empty())
                .collect(),
        }
    } else {
        decoded
            .split(',')
            .map(|path| path.trim().replace('\\', "/"))
            .filter(|path| !path.is_empty())
            .collect()
    }
}

fn normalize_reference_target(path: &str) -> String {
    path.replace('\\', "/")
        .replace("/README.markdown", "")
        .replace("/README.md", "")
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
    log::debug!("=== find_reverse_relationships START ===");
    log::debug!("Target path: {}", target_path);
    log::debug!("Space path: {}", space_path);
    log::debug!("Filter type: {}", filter_type);

    let mut relationships = Vec::new();
    let space_root = Path::new(&space_path);
    let target = Path::new(&target_path);

    // Normalize the target path for comparison - handle both absolute and relative paths
    let target_normalized = normalize_reference_target(&target_path);
    log::debug!("Target normalized: {}", target_normalized);

    // Determine which directories to search based on filter type
    let search_dirs = match filter_type.as_str() {
        "projects" => vec!["Projects"],
        "areas" => vec!["Areas of Focus"],
        "goals" => vec!["Goals"],
        "visions" => vec!["Vision"],
        "purpose" => vec!["Purpose & Principles"],
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

        // For Projects directory, look inside each project folder for a README markdown file.
        let mut files_to_check = Vec::new();

        if dir_name == "Projects" {
            log::debug!("Searching in Projects directory: {}", dir_path.display());
            // Look for README markdown files inside project folders
            if let Ok(entries) = fs::read_dir(&dir_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(readme_path) = find_readme_file(&path) {
                            log::debug!("Found project README: {}", readme_path.display());
                            files_to_check.push(readme_path);
                        }
                    } else if is_markdown_file(&path) {
                        // Also check standalone markdown files in Projects
                        log::debug!("Found standalone project file: {}", path.display());
                        files_to_check.push(path);
                    }
                }
            } else {
                log::warn!("Could not read Projects directory");
            }
        } else {
            // For other directories, just look for markdown files at the root level
            if let Ok(entries) = fs::read_dir(&dir_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if is_markdown_file(&path) {
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
                // Log what we're checking
                log::debug!("Checking file: {}", path.display());

                // Log any horizon references found
                for ref_type in &[
                    "areas-references",
                    "goals-references",
                    "vision-references",
                    "purpose-references",
                ] {
                    let marker = format!("[!{}:", ref_type);
                    if content.contains(&marker) {
                        log::debug!("File contains {} block", ref_type);
                        // Extract the reference to see what it contains
                        if let Some(start) = content.find(&marker) {
                            let after_start = &content[start + marker.len()..];
                            if let Some(end) = after_start.find(']') {
                                let refs = &after_start[..end];
                                log::debug!("  {} content: {}", ref_type, refs);
                                log::debug!("  Comparing with target: {}", target_normalized);
                            }
                        }
                    }
                }

                let has_reference = {
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
                        if extract_reference_block(&content, tag)
                            .map(|block| {
                                parse_reference_paths(&block)
                                    .into_iter()
                                    .map(|path| normalize_reference_target(&path))
                                    .any(|path| path == target_normalized)
                            })
                            .unwrap_or(false)
                        {
                            found_any = true;
                            break;
                        }
                    }

                    if found_any {
                        log::debug!("Found reference match for: {}", target_normalized);
                    }
                    found_any
                };

                if has_reference {
                    log::debug!("Found reference in file: {}", path.display());

                    // Extract all references from this file
                    let mut references = Vec::new();

                    let reference_tags = [
                        "areas-references",
                        "goals-references",
                        "vision-references",
                        "purpose-references",
                        "references",
                    ];

                    for tag in &reference_tags {
                        if let Some(block) = extract_reference_block(&content, tag) {
                            for path in parse_reference_paths(&block) {
                                let normalized_path = normalize_reference_target(&path);
                                if normalized_path == target_normalized {
                                    references.push(normalized_path);
                                }
                            }
                        }
                    }

                    let file_type = match dir_name {
                        "Projects" => "project",
                        "Areas of Focus" => "area",
                        "Goals" => "goal",
                        "Vision" => "vision",
                        "Purpose & Principles" => "purpose",
                        _ => "unknown",
                    };

                    // For projects, use the parent folder name instead of "README.md"
                    let display_name = if dir_name == "Projects"
                        && matches!(
                            path.file_name().and_then(|n| n.to_str()),
                            Some("README.md" | "README.markdown")
                        ) {
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

    log::debug!("=== find_reverse_relationships END ===");
    log::debug!("Found {} files referencing the target", relationships.len());
    for rel in &relationships {
        log::debug!("  - {} ({})", rel.file_name, rel.file_type);
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
    log::debug!("=== find_habits_referencing START ===");
    log::debug!("Target path: {}", target_path);
    log::debug!("Space path: {}", space_path);

    let mut habit_references = Vec::new();
    let space_root = Path::new(&space_path);
    let habits_dir = space_root.join("Habits");

    if !habits_dir.exists() {
        log::debug!("Habits directory does not exist");
        return Ok(habit_references);
    }

    // Normalize the target path for comparison
    let target_normalized = normalize_reference_target(&target_path);
    log::debug!("Target normalized: {}", target_normalized);

    // For project README files, also check against the project folder path
    let alt_target = strip_project_readme_suffix(&target_normalized)
        .map(|path| normalize_reference_target(&path));
    if let Some(ref alt) = alt_target {
        log::debug!("Also checking against project folder path: {}", alt);
    }

    // Search through all habit files
    if let Ok(entries) = fs::read_dir(&habits_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if is_markdown_file(&path) {
                log::debug!("Checking habit file: {}", path.display());
                // Read habit file content
                if let Ok(content) = fs::read_to_string(&path) {
                    // Check if this habit references the target file
                    let has_reference = {
                        // Check all possible reference fields
                        let tags = [
                            "projects-references",
                            "areas-references",
                            "goals-references",
                            "vision-references",
                            "purpose-references",
                        ];

                        let mut found = false;
                        for tag in &tags {
                            if let Some(block) = extract_reference_block(&content, tag) {
                                log::debug!("Found [!{}:] raw content: {}", tag, block);
                                let paths = parse_reference_paths(&block);

                                // Check if any path matches the target
                                log::debug!(
                                    "Checking {} paths for match with target: {}",
                                    paths.len(),
                                    target_normalized
                                );
                                for candidate in &paths {
                                    let candidate_normalized =
                                        normalize_reference_target(candidate);
                                    log::debug!(
                                        "  Comparing: '{}' == '{}'",
                                        candidate_normalized,
                                        target_normalized
                                    );
                                    if candidate_normalized == target_normalized {
                                        log::debug!("  MATCH FOUND!");
                                    }
                                    if let Some(ref alt) = alt_target {
                                        if candidate_normalized == *alt {
                                            log::debug!("  MATCH FOUND (alt target)!");
                                        }
                                    }
                                }
                                if paths.iter().any(|p| {
                                    let candidate_normalized = normalize_reference_target(p);
                                    candidate_normalized == target_normalized
                                        || alt_target
                                            .as_ref()
                                            .is_some_and(|alt| candidate_normalized == *alt)
                                }) {
                                    found = true;
                                    log::debug!(
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
                        log::debug!("Found habit referencing target: {}", path.display());

                        // Extract habit metadata
                        let habit_name = path
                            .file_stem()
                            .and_then(|n| n.to_str())
                            .unwrap_or("Unknown")
                            .to_string();

                        let status = extract_habit_status(&content);

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

    log::debug!("=== find_habits_referencing END ===");
    log::debug!(
        "Found {} habits referencing the target",
        habit_references.len()
    );
    for hab in &habit_references {
        log::debug!("  - {} ({})", hab.habit_name, hab.status);
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
