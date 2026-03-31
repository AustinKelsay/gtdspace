use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};

use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};

use crate::backend::mcp_workspace::{
    GtdItemReferenceSummary, GtdItemSummary, GtdItemType, WorkspaceFingerprint,
};
use crate::commands::filesystem::{read_file, MarkdownFile};
use crate::commands::gtd_projects::{list_gtd_projects, GTDProject};

pub(crate) fn build_fingerprint(root: &Path, files: &[MarkdownFile]) -> WorkspaceFingerprint {
    let mut latest_modified_unix = 0_u64;
    let mut hasher = Sha256::new();

    for file in files {
        latest_modified_unix = latest_modified_unix.max(file.last_modified);
        let relative = normalize_absolute_to_relative(root, &file.path);
        hasher.update(relative.as_bytes());
        hasher.update(file.last_modified.to_string().as_bytes());
    }

    WorkspaceFingerprint {
        normalized_root_path: normalize_path(root),
        latest_modified_unix,
        markdown_file_count: files.len(),
        aggregate_digest: format!("{:x}", hasher.finalize()),
    }
}

pub(crate) fn build_item_summaries(
    root: &Path,
    files: Vec<MarkdownFile>,
) -> Result<Vec<GtdItemSummary>, String> {
    let project_paths = list_gtd_projects(normalize_path(root))?
        .into_iter()
        .map(|project| {
            (
                normalize_path(Path::new(&project.path).join("README.md")),
                project,
            )
        })
        .collect::<HashMap<_, _>>();

    let mut items = Vec::new();
    for file in files {
        if let Some(item) = parse_item_summary(root, &file, &project_paths)? {
            items.push(item);
        }
    }
    items.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    Ok(items)
}

pub fn normalize_workspace_path<P: AsRef<Path>>(path: P) -> String {
    let normalized = path.as_ref().to_string_lossy().replace('\\', "/");
    normalized
        .strip_prefix("//?/")
        .or_else(|| normalized.strip_prefix("\\\\?/"))
        .unwrap_or(&normalized)
        .to_string()
}

pub(crate) fn normalize_path_components(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Normal(part) => normalized.push(part),
        }
    }
    normalized
}

pub(crate) fn path_is_within_workspace(path: &Path, root: &Path) -> bool {
    let normalized_root = normalize_path(root).trim_end_matches('/').to_string();
    let normalized_path = normalize_path(path);
    #[cfg(target_os = "windows")]
    let normalized_root = normalized_root.to_lowercase();
    #[cfg(target_os = "windows")]
    let normalized_path = normalized_path.to_lowercase();
    normalized_path == normalized_root || normalized_path.starts_with(&(normalized_root + "/"))
}

pub(crate) fn normalize_relative_input(path: &str) -> String {
    path.trim()
        .replace('\\', "/")
        .trim_start_matches("./")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::normalize_relative_input;

    #[test]
    fn normalize_relative_input_strips_windows_relative_prefix() {
        assert_eq!(normalize_relative_input(r".\foo\bar"), "foo/bar");
        assert_eq!(normalize_relative_input("./foo/bar"), "foo/bar");
    }
}

pub(crate) fn normalize_absolute_to_relative(root: &Path, path: &str) -> String {
    let absolute = Path::new(path);
    if absolute.is_absolute() {
        let stripped = absolute.strip_prefix(root).map(normalize_path);
        stripped
            .unwrap_or_else(|_| {
                let normalized_root = normalize_path(root).trim_end_matches('/').to_string();
                let normalized_absolute = normalize_path(absolute);
                normalized_absolute
                    .strip_prefix(&(normalized_root.clone() + "/"))
                    .or_else(|| normalized_absolute.strip_prefix(&normalized_root))
                    .map(str::to_string)
                    .unwrap_or(normalized_absolute)
            })
            .trim_start_matches('/')
            .to_string()
    } else {
        normalize_relative_input(path)
    }
}

pub(crate) fn item_type_key(kind: &GtdItemType) -> &'static str {
    match kind {
        GtdItemType::Project => "project",
        GtdItemType::Action => "action",
        GtdItemType::Habit => "habit",
        GtdItemType::Area => "area",
        GtdItemType::Goal => "goal",
        GtdItemType::Vision => "vision",
        GtdItemType::Purpose => "purpose",
        GtdItemType::CabinetNote => "cabinet-note",
        GtdItemType::SomedayNote => "someday-note",
        GtdItemType::HorizonOverview => "horizon-overview",
    }
}

pub(crate) fn project_similarity_keys(item: &GtdItemSummary) -> Vec<String> {
    let mut candidates = vec![
        normalize_similarity_key(&item.relative_path),
        normalize_similarity_key(&strip_project_readme_suffix(&item.relative_path)),
        normalize_similarity_key(&item.title),
    ];
    candidates.retain(|candidate| !candidate.is_empty());
    candidates.sort();
    candidates.dedup();
    candidates
}

pub(crate) fn sanitize_title(input: &str, fallback: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

pub(crate) fn extract_multiselect(content: &str, field: &str) -> Vec<String> {
    extract_marker(content, &format!("[!multiselect:{}:", field))
        .map(|value| {
            value
                .split(',')
                .map(|entry| entry.trim().to_string())
                .filter(|entry| !entry.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

pub(crate) fn extract_section_body(content: &str, heading: &str) -> Option<String> {
    let mut active = false;
    let mut buffer = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.eq_ignore_ascii_case(&format!("## {}", heading)) {
            active = true;
            continue;
        }
        if active && trimmed.starts_with("## ") {
            break;
        }
        if active {
            buffer.push(line);
        }
    }

    let value = buffer.join("\n").trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

pub(crate) fn extract_reference_list(content: &str, tag: &str) -> Vec<String> {
    let marker = format!("[!{}:", tag);
    let Some(start) = content.find(&marker) else {
        return Vec::new();
    };
    let remainder = &content[start + marker.len()..];
    let Some(end) = remainder.find(']') else {
        return Vec::new();
    };
    parse_reference_list(&remainder[..end])
}

pub(crate) fn parse_reference_list(raw: &str) -> Vec<String> {
    let decoded = decode_loose(raw.trim());
    if decoded.is_empty() {
        return Vec::new();
    }

    if decoded.starts_with('[') {
        if let Ok(list) = serde_json::from_str::<Vec<String>>(&decoded) {
            return normalize_reference_list(list);
        }
    }

    normalize_reference_list(
        decoded
            .trim_matches(['[', ']'])
            .split(',')
            .map(|value| {
                value
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .to_string()
            })
            .collect(),
    )
}

pub(crate) fn parse_reference_note(content: &str) -> (String, String) {
    let title = extract_h1(content).unwrap_or_else(|| "Untitled Note".to_string());
    let body = content
        .lines()
        .skip_while(|line| !line.trim().starts_with("# "))
        .skip(1)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();
    (title, body)
}

fn parse_item_summary(
    root: &Path,
    file: &MarkdownFile,
    project_readmes: &HashMap<String, GTDProject>,
) -> Result<Option<GtdItemSummary>, String> {
    let relative_path = normalize_absolute_to_relative(root, &file.path);
    let normalized = relative_path.replace('\\', "/");
    let content = read_file(file.path.clone())?;
    let title = extract_h1(&content).unwrap_or_else(|| strip_markdown_extension(&file.name));
    let references = extract_all_reference_groups(&content);
    let created_fallback = Some(unix_to_rfc3339(file.last_modified));

    let summary = if is_horizon_overview(&normalized) {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::HorizonOverview,
            title,
            status: None,
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: extract_single_select(&content, "horizon-altitude"),
            review_cadence: extract_single_select(&content, "horizon-review-cadence"),
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "How to work this horizon in GTD Space"),
            references,
        })
    } else if is_project_readme(&normalized) {
        let project = project_readmes.get(&normalize_path(&file.path));
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Project,
            title,
            status: extract_single_select(&content, "project-status")
                .or_else(|| extract_single_select(&content, "status")),
            due_date: extract_datetime(&content, "due_date"),
            focus_date: None,
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: project.map(|entry| normalize_path(&entry.path)),
            description: extract_section_body(&content, "Desired Outcome")
                .or_else(|| extract_section_body(&content, "Description")),
            references,
        })
    } else if normalized.starts_with("Projects/") {
        let project_path = Path::new(&normalized)
            .parent()
            .map(normalize_path)
            .unwrap_or_default();
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Action,
            title,
            status: extract_single_select(&content, "status"),
            due_date: extract_datetime(&content, "due_date"),
            focus_date: extract_datetime(&content, "focus_date")
                .or_else(|| extract_datetime(&content, "focus_date_time")),
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: extract_single_select(&content, "effort"),
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: Some(project_path),
            description: extract_section_body(&content, "Notes"),
            references,
        })
    } else if normalized.starts_with("Habits/") {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Habit,
            title,
            status: extract_checkbox_status(&content),
            due_date: None,
            focus_date: extract_datetime(&content, "focus_date"),
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: extract_single_select(&content, "habit-frequency"),
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "Notes"),
            references,
        })
    } else if normalized.starts_with("Areas of Focus/") {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Area,
            title,
            status: extract_single_select(&content, "area-status"),
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: None,
            review_cadence: extract_single_select(&content, "area-review-cadence"),
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "Description"),
            references,
        })
    } else if normalized.starts_with("Goals/") {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Goal,
            title,
            status: extract_single_select(&content, "goal-status"),
            due_date: None,
            focus_date: None,
            target_date: extract_datetime(&content, "goal-target-date")
                .or_else(|| extract_datetime(&content, "target_date")),
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "Description"),
            references,
        })
    } else if normalized.starts_with("Vision/") {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Vision,
            title,
            status: None,
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: extract_single_select(&content, "vision-horizon"),
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "Narrative"),
            references,
        })
    } else if normalized.starts_with("Purpose & Principles/") {
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::Purpose,
            title,
            status: None,
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: extract_datetime(&content, "created_date_time").or(created_fallback),
            parent_project_path: None,
            description: extract_section_body(&content, "Description"),
            references,
        })
    } else if normalized.starts_with("Cabinet/") {
        let (_, body) = parse_reference_note(&content);
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::CabinetNote,
            title,
            status: None,
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: created_fallback,
            parent_project_path: None,
            description: Some(body),
            references,
        })
    } else if normalized.starts_with("Someday Maybe/") {
        let (_, body) = parse_reference_note(&content);
        Some(GtdItemSummary {
            relative_path: normalized.clone(),
            absolute_path: normalize_path(&file.path),
            item_type: GtdItemType::SomedayNote,
            title,
            status: None,
            due_date: None,
            focus_date: None,
            target_date: None,
            horizon: None,
            review_cadence: None,
            frequency: None,
            effort: None,
            created_date_time: created_fallback,
            parent_project_path: None,
            description: Some(body),
            references,
        })
    } else {
        None
    };

    Ok(summary)
}

fn normalize_path<P: AsRef<Path>>(path: P) -> String {
    normalize_workspace_path(path)
}

fn strip_markdown_extension(name: &str) -> String {
    let lowered = name.to_ascii_lowercase();
    if lowered.ends_with(".markdown") {
        name[..name.len() - ".markdown".len()].to_string()
    } else if lowered.ends_with(".md") {
        name[..name.len() - ".md".len()].to_string()
    } else {
        name.to_string()
    }
}

pub(crate) fn normalize_similarity_key(value: &str) -> String {
    strip_markdown_extension(&normalize_relative_input(value))
        .to_ascii_lowercase()
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect()
}

fn strip_project_readme_suffix(path: &str) -> String {
    path.strip_suffix("/README.md")
        .or_else(|| path.strip_suffix("/README.markdown"))
        .unwrap_or(path)
        .to_string()
}

fn is_project_readme(path: &str) -> bool {
    path.starts_with("Projects/") && path.split('/').count() == 3 && path.ends_with("README.md")
        || path.starts_with("Projects/")
            && path.split('/').count() == 3
            && path.ends_with("README.markdown")
}

fn is_horizon_overview(path: &str) -> bool {
    matches!(
        path,
        "Areas of Focus/README.md"
            | "Goals/README.md"
            | "Vision/README.md"
            | "Purpose & Principles/README.md"
    )
}

fn extract_h1(content: &str) -> Option<String> {
    content.lines().find_map(|line| {
        line.trim()
            .strip_prefix("# ")
            .map(|value| value.trim().to_string())
    })
}

fn extract_single_select(content: &str, field: &str) -> Option<String> {
    extract_marker(content, &format!("[!singleselect:{}:", field))
        .or_else(|| extract_marker(content, &format!("[!multiselect:{}:", field)))
}

fn extract_checkbox_status(content: &str) -> Option<String> {
    extract_marker(content, "[!checkbox:habit-status:").map(|value| {
        if value.eq_ignore_ascii_case("true") {
            "completed".to_string()
        } else {
            "todo".to_string()
        }
    })
}

fn extract_datetime(content: &str, field: &str) -> Option<String> {
    extract_marker(content, &format!("[!datetime:{}:", field))
}

fn extract_marker(content: &str, prefix: &str) -> Option<String> {
    let start = content.find(prefix)?;
    let remaining = &content[start + prefix.len()..];
    let end = remaining.find(']')?;
    Some(remaining[..end].trim().to_string())
}

fn extract_all_reference_groups(content: &str) -> Vec<GtdItemReferenceSummary> {
    let groups = [
        ("projects", "projects-references"),
        ("areas", "areas-references"),
        ("goals", "goals-references"),
        ("vision", "vision-references"),
        ("purpose", "purpose-references"),
        ("references", "references"),
    ];
    groups
        .into_iter()
        .filter_map(|(kind, tag)| {
            let paths = extract_reference_list(content, tag);
            if paths.is_empty() {
                None
            } else {
                Some(GtdItemReferenceSummary {
                    kind: kind.to_string(),
                    paths,
                })
            }
        })
        .collect()
}

pub(crate) fn normalize_reference_list(values: Vec<String>) -> Vec<String> {
    let mut output = values
        .into_iter()
        .map(|value| value.replace('\\', "/"))
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    output.sort();
    output.dedup();
    output
}

fn decode_loose(input: &str) -> String {
    let mut current = input.to_string();
    for _ in 0..3 {
        match urlencoding::decode(&current) {
            Ok(decoded) if decoded != current => current = decoded.into_owned(),
            _ => break,
        }
    }
    current
}

fn unix_to_rfc3339(timestamp: u64) -> String {
    let seconds = i64::try_from(timestamp).unwrap_or(i64::MAX);
    DateTime::<Utc>::from_timestamp(seconds, 0)
        .unwrap_or_else(Utc::now)
        .to_rfc3339()
}
