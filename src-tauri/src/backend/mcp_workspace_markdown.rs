use std::path::{Path, PathBuf};

use chrono::Utc;

use crate::backend::mcp_workspace::{GtdItemSummary, HorizonPageType};
use crate::backend::mcp_workspace_index::{
    extract_multiselect, extract_reference_list, extract_section_body, normalize_reference_list,
    normalize_workspace_path,
};
use crate::commands::gtd_habits_domain::DEFAULT_HISTORY_TEMPLATE;
use crate::commands::seed_data::{
    generate_area_of_focus_template_with_refs, generate_goal_template_with_refs,
    generate_project_readme_with_refs, generate_vision_document_template_with_refs,
    ProjectReadmeParams,
};

#[derive(Debug)]
pub(super) struct ProjectBuildInput {
    pub(super) title: String,
    pub(super) description: String,
    pub(super) due_date: Option<String>,
    pub(super) status: String,
    pub(super) areas: Vec<String>,
    pub(super) goals: Vec<String>,
    pub(super) vision: Vec<String>,
    pub(super) purpose: Vec<String>,
    pub(super) general_references: Vec<String>,
    pub(super) created_date_time: String,
    pub(super) additional_content: Option<String>,
}

#[derive(Debug)]
pub(super) struct ActionBuildInput {
    pub(super) title: String,
    pub(super) status: String,
    pub(super) focus_date: Option<String>,
    pub(super) due_date: Option<String>,
    pub(super) effort: String,
    pub(super) contexts: Vec<String>,
    pub(super) general_references: Vec<String>,
    pub(super) notes: Option<String>,
    pub(super) created_date_time: String,
}

#[derive(Debug)]
pub(super) struct HabitBuildInput {
    pub(super) title: String,
    pub(super) frequency: String,
    pub(super) focus_time: Option<String>,
    pub(super) projects: Vec<String>,
    pub(super) areas: Vec<String>,
    pub(super) goals: Vec<String>,
    pub(super) vision: Vec<String>,
    pub(super) purpose: Vec<String>,
    pub(super) created_date_time: String,
}

#[derive(Debug)]
pub(super) struct HorizonBuildInput {
    pub(super) title: String,
    pub(super) status: Option<String>,
    pub(super) review_cadence: Option<String>,
    pub(super) target_date: Option<String>,
    pub(super) horizon: Option<String>,
    pub(super) description: Option<String>,
    pub(super) projects: Vec<String>,
    pub(super) areas: Vec<String>,
    pub(super) goals: Vec<String>,
    pub(super) vision: Vec<String>,
    pub(super) purpose: Vec<String>,
    pub(super) general_references: Vec<String>,
    pub(super) created_date_time: String,
    pub(super) trailing_content: Option<String>,
}

#[derive(Debug)]
pub(super) struct ProjectUpdateSeed {
    pub(super) title: String,
    pub(super) description: Option<String>,
    pub(super) due_date: Option<String>,
    pub(super) status: String,
    pub(super) areas: Vec<String>,
    pub(super) goals: Vec<String>,
    pub(super) vision: Vec<String>,
    pub(super) purpose: Vec<String>,
    pub(super) general_references: Vec<String>,
    pub(super) created_date_time: String,
    pub(super) additional_content: Option<String>,
}

#[derive(Debug)]
pub(super) struct ActionUpdateSeed {
    pub(super) title: String,
    pub(super) status: String,
    pub(super) focus_date: Option<String>,
    pub(super) due_date: Option<String>,
    pub(super) effort: String,
    pub(super) contexts: Vec<String>,
    pub(super) general_references: Vec<String>,
    pub(super) notes: Option<String>,
    pub(super) created_date_time: String,
}

#[derive(Debug)]
pub(super) struct HorizonUpdateSeed {
    pub(super) title: String,
    pub(super) status: Option<String>,
    pub(super) review_cadence: Option<String>,
    pub(super) target_date: Option<String>,
    pub(super) horizon: Option<String>,
    pub(super) description: Option<String>,
    pub(super) projects: Vec<String>,
    pub(super) areas: Vec<String>,
    pub(super) goals: Vec<String>,
    pub(super) vision: Vec<String>,
    pub(super) purpose: Vec<String>,
    pub(super) general_references: Vec<String>,
    pub(super) created_date_time: String,
    pub(super) trailing_content: Option<String>,
}

pub(super) fn preview_write(action: &str, path: &str, content: &str) -> String {
    format!(
        "{}\n- path: {}\n- bytes: {}\n\n{}",
        action,
        path,
        content.len(),
        content.lines().take(20).collect::<Vec<_>>().join("\n")
    )
}

pub(super) fn project_directory_from_readme(readme_path: &str) -> Result<String, String> {
    let path = Path::new(readme_path);
    let Some(parent) = path.parent() else {
        return Err("Project README path has no parent directory".to_string());
    };
    Ok(normalize_workspace_path(parent))
}

pub(super) fn resolve_project_readme_in_directory(project_dir: &Path) -> Option<PathBuf> {
    let md_path = project_dir.join("README.md");
    if md_path.exists() {
        return Some(md_path);
    }

    let markdown_path = project_dir.join("README.markdown");
    if markdown_path.exists() {
        return Some(markdown_path);
    }

    None
}

pub(super) fn build_project_markdown(input: ProjectBuildInput) -> Result<String, String> {
    let areas_refs = encode_reference_array(&input.areas)
        .map_err(|error| format!("Failed to encode project references: {}", error))?;
    let goals_refs = encode_reference_array(&input.goals)
        .map_err(|error| format!("Failed to encode project references: {}", error))?;
    let vision_refs = encode_reference_array(&input.vision)
        .map_err(|error| format!("Failed to encode project references: {}", error))?;
    let purpose_refs = encode_reference_array(&input.purpose)
        .map_err(|error| format!("Failed to encode project references: {}", error))?;
    let mut content = generate_project_readme_with_refs(ProjectReadmeParams {
        name: &input.title,
        description: &input.description,
        due_date: input.due_date.clone(),
        status: &input.status,
        areas_refs: &areas_refs,
        goals_refs: &goals_refs,
        vision_refs: &vision_refs,
        purpose_refs: &purpose_refs,
        general_refs: &encode_reference_csv(&input.general_references),
    });
    content = replace_datetime_marker(content, "created_date_time", &input.created_date_time);
    if let Some(extra) = input
        .additional_content
        .filter(|value| !value.trim().is_empty())
    {
        content.push('\n');
        content.push_str(extra.trim());
        content.push('\n');
    }
    Ok(content)
}

pub(super) fn build_action_markdown(input: ActionBuildInput) -> String {
    let references = encode_reference_csv(&input.general_references);
    let contexts = input
        .contexts
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect::<Vec<_>>()
        .join(",");
    let notes = input.notes.unwrap_or_else(|| {
        "<!-- Add any additional notes or details about this action here -->".to_string()
    });
    format!(
        "# {title}\n\n## Status\n[!singleselect:status:{status}]\n\n## Focus Date\n[!datetime:focus_date:{focus}]\n\n## Due Date\n[!datetime:due_date:{due}]\n\n## Effort\n[!singleselect:effort:{effort}]\n\n## Contexts\n[!multiselect:contexts:{contexts}]\n\n## References\n[!references:{references}]\n\n## Notes\n{notes}\n\n---\n## Created\n[!datetime:created_date_time:{created}]\n",
        title = input.title,
        status = input.status,
        focus = input.focus_date.unwrap_or_default(),
        due = input.due_date.unwrap_or_default(),
        effort = input.effort,
        contexts = contexts,
        references = references,
        notes = notes.trim_end(),
        created = input.created_date_time
    )
}

pub(super) fn build_habit_markdown(input: HabitBuildInput) -> Result<String, String> {
    let projects = encode_reference_array(&input.projects)
        .map_err(|error| format!("Failed to encode habit references: {}", error))?;
    let areas = encode_reference_array(&input.areas)
        .map_err(|error| format!("Failed to encode habit references: {}", error))?;
    let goals = encode_reference_array(&input.goals)
        .map_err(|error| format!("Failed to encode habit references: {}", error))?;
    let vision = encode_reference_array(&input.vision)
        .map_err(|error| format!("Failed to encode habit references: {}", error))?;
    let purpose = encode_reference_array(&input.purpose)
        .map_err(|error| format!("Failed to encode habit references: {}", error))?;
    let focus_section = if let Some(time) = input.focus_time.as_deref() {
        format!(
            "\n## Focus Date\n[!datetime:focus_date:{}T{}:00]\n",
            Utc::now().format("%Y-%m-%d"),
            time
        )
    } else {
        String::new()
    };
    Ok(format!(
        "# {title}\n\n## Status\n[!checkbox:habit-status:false]\n\n## Frequency\n[!singleselect:habit-frequency:{frequency}]{focus}\
\n## Projects References\n[!projects-references:{projects}]\n\n## Areas References\n[!areas-references:{areas}]\n\n## Goals References\n[!goals-references:{goals}]\n\n## Vision References\n[!vision-references:{vision}]\n\n## Purpose & Principles References\n[!purpose-references:{purpose}]\n\n## Created\n[!datetime:created_date_time:{created}]\n\n## History\n{history}\n",
        title = input.title,
        frequency = input.frequency,
        focus = focus_section,
        projects = projects,
        areas = areas,
        goals = goals,
        vision = vision,
        purpose = purpose,
        created = input.created_date_time,
        history = DEFAULT_HISTORY_TEMPLATE
    ))
}

pub(super) fn build_horizon_markdown(
    page_type: &HorizonPageType,
    input: HorizonBuildInput,
) -> Result<String, String> {
    let content = match page_type {
        HorizonPageType::Area => {
            let goals_refs = encode_reference_array(&input.goals)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            let vision_refs = encode_reference_array(&input.vision)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            let purpose_refs = encode_reference_array(&input.purpose)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            let mut body = generate_area_of_focus_template_with_refs(
                &input.title,
                input
                    .description
                    .as_deref()
                    .unwrap_or("Define the standard for this area."),
                "",
                &goals_refs,
                &vision_refs,
                &purpose_refs,
            );
            body = replace_marker(
                body,
                "[!singleselect:area-status:",
                &input.status.unwrap_or_else(|| "steady".to_string()),
            );
            body = replace_marker(
                body,
                "[!singleselect:area-review-cadence:",
                &input
                    .review_cadence
                    .unwrap_or_else(|| "monthly".to_string()),
            );
            body = replace_reference_marker(body, "projects-references", &input.projects)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            body = replace_reference_marker(body, "areas-references", &input.areas)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            body = replace_reference_marker(body, "references", &input.general_references)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            body
        }
        HorizonPageType::Goal => {
            let vision_refs = encode_reference_array(&input.vision)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            let purpose_refs = encode_reference_array(&input.purpose)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            let mut body = generate_goal_template_with_refs(
                &input.title,
                input.target_date.as_deref(),
                input
                    .description
                    .as_deref()
                    .unwrap_or("Describe the desired outcome for this goal."),
                &vision_refs,
                &purpose_refs,
            );
            body = replace_marker(
                body,
                "[!singleselect:goal-status:",
                &input.status.unwrap_or_else(|| "in-progress".to_string()),
            );
            body = replace_reference_marker(body, "projects-references", &input.projects)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            body = replace_reference_marker(body, "areas-references", &input.areas)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            body = replace_reference_marker(body, "references", &input.general_references)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            body
        }
        HorizonPageType::Vision => {
            let purpose_refs = encode_reference_array(&input.purpose)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            let mut body = generate_vision_document_template_with_refs(&purpose_refs);
            body = replace_h1(body, &input.title);
            body = replace_marker(
                body,
                "[!singleselect:vision-horizon:",
                &input.horizon.unwrap_or_else(|| "3-years".to_string()),
            );
            body = replace_reference_marker(body, "projects-references", &input.projects)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            body = replace_reference_marker(body, "goals-references", &input.goals)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            body = replace_reference_marker(body, "areas-references", &input.areas)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            body = replace_reference_marker(body, "references", &input.general_references)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            if let Some(narrative) = input.description {
                body = replace_section_body(body, "Narrative", &narrative);
            }
            body
        }
        HorizonPageType::Purpose => {
            let projects_refs = encode_reference_array(&input.projects)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            let goals_refs = encode_reference_array(&input.goals)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            let vision_refs = encode_reference_array(&input.vision)
                .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
            let areas_section = if input.areas.is_empty() {
                String::new()
            } else {
                let areas_refs = encode_reference_array(&input.areas)
                    .map_err(|error| format!("Failed to encode horizon references: {}", error))?;
                format!(
                    "## Areas References (optional)\n[!areas-references:{}]\n\n",
                    areas_refs
                )
            };
            format!(
                "# {}\n\n## Projects References\n[!projects-references:{}]\n\n## Goals References\n[!goals-references:{}]\n\n## Vision References\n[!vision-references:{}]\n{}\n## References (optional)\n[!references:{}]\n\n## Created\n[!datetime:created_date_time:{}]\n\n## Description\n{}\n",
                input.title,
                projects_refs,
                goals_refs,
                vision_refs,
                areas_section,
                encode_reference_csv(&input.general_references),
                input.created_date_time,
                input
                    .description
                    .unwrap_or_else(|| "Describe your purpose and principles.".to_string())
            )
        }
    };

    let mut content =
        replace_datetime_marker(content, "created_date_time", &input.created_date_time);
    if let Some(trailing) = input
        .trailing_content
        .filter(|value| !value.trim().is_empty())
    {
        if !content.ends_with('\n') {
            content.push('\n');
        }
        content.push('\n');
        content.push_str(trailing.trim());
        content.push('\n');
    }
    Ok(content)
}

pub(super) fn build_reference_note_markdown(
    title: &str,
    new_body: Option<String>,
    existing_body: Option<String>,
) -> String {
    let body = new_body
        .or(existing_body)
        .unwrap_or_else(|| "<!-- Add note body -->".to_string());
    format!("# {}\n\n{}\n", title.trim(), body.trim_end())
}

pub(super) fn parse_project_update_seed(content: &str, item: &GtdItemSummary) -> ProjectUpdateSeed {
    ProjectUpdateSeed {
        title: item.title.clone(),
        description: item.description.clone(),
        due_date: item.due_date.clone(),
        status: item
            .status
            .clone()
            .unwrap_or_else(|| "in-progress".to_string()),
        areas: extract_reference_list(content, "areas-references"),
        goals: extract_reference_list(content, "goals-references"),
        vision: extract_reference_list(content, "vision-references"),
        purpose: extract_reference_list(content, "purpose-references"),
        general_references: extract_reference_list(content, "references"),
        created_date_time: item
            .created_date_time
            .clone()
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
        additional_content: extract_tail_after(content, "[!habits-list]"),
    }
}

pub(super) fn parse_action_update_seed(content: &str, item: &GtdItemSummary) -> ActionUpdateSeed {
    ActionUpdateSeed {
        title: item.title.clone(),
        status: item
            .status
            .clone()
            .unwrap_or_else(|| "in-progress".to_string()),
        focus_date: item.focus_date.clone(),
        due_date: item.due_date.clone(),
        effort: item.effort.clone().unwrap_or_else(|| "medium".to_string()),
        contexts: extract_multiselect(content, "contexts"),
        general_references: extract_reference_list(content, "references"),
        notes: extract_section_body(content, "Notes"),
        created_date_time: item
            .created_date_time
            .clone()
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
    }
}

pub(super) fn parse_horizon_update_seed(
    page_type: &HorizonPageType,
    content: &str,
    item: &GtdItemSummary,
) -> HorizonUpdateSeed {
    let trailing_heading = match page_type {
        HorizonPageType::Area | HorizonPageType::Goal | HorizonPageType::Purpose => "Description",
        HorizonPageType::Vision => "Narrative",
    };
    HorizonUpdateSeed {
        title: item.title.clone(),
        status: item.status.clone(),
        review_cadence: item.review_cadence.clone(),
        target_date: item.target_date.clone(),
        horizon: item.horizon.clone(),
        description: item.description.clone(),
        projects: extract_reference_list(content, "projects-references"),
        areas: extract_reference_list(content, "areas-references"),
        goals: extract_reference_list(content, "goals-references"),
        vision: extract_reference_list(content, "vision-references"),
        purpose: extract_reference_list(content, "purpose-references"),
        general_references: extract_reference_list(content, "references"),
        created_date_time: item
            .created_date_time
            .clone()
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
        trailing_content: extract_additional_after_section(content, trailing_heading),
    }
}

fn encode_reference_array(values: &[String]) -> Result<String, serde_json::Error> {
    let normalized = normalize_reference_list(values.to_vec());
    if normalized.is_empty() {
        Ok(String::new())
    } else {
        serde_json::to_string(&normalized).map(|json| urlencoding::encode(&json).into_owned())
    }
}

fn encode_reference_csv(values: &[String]) -> String {
    normalize_reference_list(values.to_vec()).join(",")
}

fn replace_marker(mut content: String, prefix: &str, value: &str) -> String {
    if let Some(start) = content.find(prefix) {
        let remainder = &content[start + prefix.len()..];
        if let Some(end) = remainder.find(']') {
            let end_index = start + prefix.len() + end;
            content.replace_range(start + prefix.len()..end_index, value);
        }
    }
    content
}

fn replace_reference_marker(
    content: String,
    tag: &str,
    values: &[String],
) -> Result<String, serde_json::Error> {
    let encoded = if tag == "references" {
        encode_reference_csv(values)
    } else {
        encode_reference_array(values)?
    };
    Ok(replace_marker(content, &format!("[!{}:", tag), &encoded))
}

fn replace_datetime_marker(content: String, field: &str, value: &str) -> String {
    replace_marker(content, &format!("[!datetime:{}:", field), value)
}

fn replace_h1(content: String, title: &str) -> String {
    let mut lines = content.lines().map(str::to_string).collect::<Vec<_>>();
    if let Some(first) = lines.iter_mut().find(|line| line.trim().starts_with("# ")) {
        *first = format!("# {}", title.trim());
    } else {
        lines.insert(0, format!("# {}", title.trim()));
    }
    format!("{}\n", lines.join("\n"))
}

fn replace_section_body(content: String, heading: &str, new_body: &str) -> String {
    let mut output = Vec::new();
    let mut active = false;
    let mut replaced = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.eq_ignore_ascii_case(&format!("## {}", heading)) {
            active = true;
            replaced = true;
            output.push(line.to_string());
            output.push(new_body.trim_end().to_string());
            continue;
        }
        if active && trimmed.starts_with("## ") {
            active = false;
        }
        if !active {
            output.push(line.to_string());
        }
    }
    if !replaced {
        output.push(String::new());
        output.push(format!("## {}", heading));
        output.push(new_body.trim_end().to_string());
    }
    format!("{}\n", output.join("\n"))
}

fn extract_tail_after(content: &str, marker: &str) -> Option<String> {
    let start = content.find(marker)?;
    let tail = &content[start + marker.len()..];
    let value = tail.trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn extract_additional_after_section(content: &str, heading: &str) -> Option<String> {
    let marker = format!("## {}", heading);
    let start = content.find(&marker)?;
    let tail = &content[start..];
    let rest = tail.split_once('\n')?.1;
    let value = rest.trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}
