//! GTD habit commands.

use super::gtd_habits_domain::{
    apply_status_marker, calculate_missed_periods, format_history_entry, insert_history_entry,
    parse_habit_state, should_reset_habit, HabitFrequency, HabitStatus, DEFAULT_HISTORY_TEMPLATE,
};
use super::utils::sanitize_markdown_file_stem;
use chrono::{Local, NaiveTime};
use serde::Deserialize;
use std::fs::{self, OpenOptions};
use std::io::{self, ErrorKind, Write};
use std::path::Path;
use tempfile::NamedTempFile;

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub struct HabitReferenceInput {
    #[serde(default)]
    projects: Vec<String>,
    #[serde(default)]
    areas: Vec<String>,
    #[serde(default)]
    goals: Vec<String>,
    #[serde(default)]
    vision: Vec<String>,
    #[serde(default)]
    purpose: Vec<String>,
}

fn atomic_write_habit_file(path: &Path, content: &str) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::other("Failed to determine habit file parent directory"))?;
    let mut temp_file = NamedTempFile::new_in(parent)?;
    temp_file.write_all(content.as_bytes())?;
    temp_file.flush()?;
    temp_file.as_file().sync_all()?;
    temp_file
        .persist(path)
        .map(|_| ())
        .map_err(|error| error.error)
}

#[tauri::command]
pub fn create_gtd_habit(
    space_path: String,
    habit_name: String,
    frequency: String,
    focus_time: Option<String>,
    references: Option<HabitReferenceInput>,
) -> Result<String, String> {
    log::info!("Creating GTD habit: {}", habit_name);

    let habits_path = Path::new(&space_path).join("Habits");
    if !habits_path.exists() {
        return Err("Habits directory does not exist. Initialize GTD space first.".to_string());
    }

    let file_name = format!("{}.md", sanitize_markdown_file_stem(&habit_name));
    let habit_path = habits_path.join(&file_name);

    let frequency_value = HabitFrequency::from_create_input(&frequency)?.as_marker_token();
    let now = Local::now();
    let reference_values = references.unwrap_or_default();

    let render_reference_token = |items: &[String]| -> String {
        let normalized: Vec<String> = items
            .iter()
            .map(|value| value.trim().replace('\\', "/"))
            .filter(|value| !value.is_empty())
            .collect();

        if normalized.is_empty() {
            String::new()
        } else {
            match serde_json::to_string(&normalized) {
                Ok(json) => urlencoding::encode(&json).into_owned(),
                Err(_) => urlencoding::encode(&normalized.join(",")).into_owned(),
            }
        }
    };

    let focus_time_section = if let Some(time) = focus_time {
        let trimmed = time.trim();
        let parsed_time = NaiveTime::parse_from_str(trimmed, "%H:%M").map_err(|_| {
            format!(
                "Invalid focus time '{}'. Expected HH:MM in 24-hour format",
                time
            )
        })?;
        format!(
            "\n## Focus Date\n[!datetime:focus_date:{}T{}:00]\n\n",
            now.format("%Y-%m-%d"),
            parsed_time.format("%H:%M")
        )
    } else {
        "\n".to_string()
    };

    let habit_content = format!(
        r#"# {}

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:{}]
{}## Projects References
[!projects-references:{}]

## Areas References
[!areas-references:{}]

## Goals References
[!goals-references:{}]

## Vision References
[!vision-references:{}]

## Purpose & Principles References
[!purpose-references:{}]

## Created
[!datetime:created_date_time:{}]

## History
{}
"#,
        habit_name,
        frequency_value,
        focus_time_section,
        render_reference_token(&reference_values.projects),
        render_reference_token(&reference_values.areas),
        render_reference_token(&reference_values.goals),
        render_reference_token(&reference_values.vision),
        render_reference_token(&reference_values.purpose),
        now.to_rfc3339(),
        DEFAULT_HISTORY_TEMPLATE
    );

    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&habit_path)
        .map_err(|error| {
            if error.kind() == ErrorKind::AlreadyExists {
                format!("Habit '{}' already exists", habit_name)
            } else {
                format!("Failed to create habit file: {}", error)
            }
        })?;

    match file.write_all(habit_content.as_bytes()) {
        Ok(()) => {}
        Err(error) => {
            drop(file);
            if let Err(remove_error) = fs::remove_file(&habit_path) {
                log::warn!(
                    "Failed to clean up partially created habit file {}: {}",
                    habit_path.display(),
                    remove_error
                );
            }
            return Err(format!("Failed to create habit file: {}", error));
        }
    }

    Ok(habit_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn update_habit_status(habit_path: String, new_status: String) -> Result<bool, String> {
    let next_status = HabitStatus::from_input(&new_status)?;
    let canonical_habit_path = Path::new(&habit_path)
        .canonicalize()
        .map_err(|error| format!("Failed to resolve habit file: {}", error))?;
    let is_markdown_habit = canonical_habit_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("md"))
        .unwrap_or(false);
    if !is_markdown_habit {
        return Err("Habit path must point to a .md file inside the Habits folder".to_string());
    }
    let is_in_habits = canonical_habit_path.ancestors().any(|ancestor| {
        ancestor
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("Habits"))
            .unwrap_or(false)
    });
    if !is_in_habits {
        return Err("Habit path must be inside the Habits folder".to_string());
    }

    let content = fs::read_to_string(&canonical_habit_path)
        .map_err(|error| format!("Failed to read habit file: {}", error))?;
    let parsed = parse_habit_state(&content)?;

    if parsed.status == next_status {
        log::info!(
            "Habit status unchanged (current='{}', new='{}'), skipping history update",
            parsed.status.marker_token(),
            next_status.marker_token()
        );
        return Ok(false);
    }

    let now = Local::now().naive_local();
    let history_entry = format_history_entry(
        now,
        next_status,
        "Manual",
        &format!("Changed from {}", parsed.status.history_label()),
    );
    let updated_content = apply_status_marker(&content, next_status, parsed.status_format);
    let final_content = insert_history_entry(&updated_content, &history_entry)?;

    atomic_write_habit_file(&canonical_habit_path, &final_content)
        .map_err(|error| format!("Failed to write habit file: {}", error))?;

    Ok(true)
}

#[tauri::command]
pub fn check_and_reset_habits(space_path: String) -> Result<Vec<String>, String> {
    let habits_path = Path::new(&space_path).join("Habits");
    if !habits_path.exists() {
        return Ok(Vec::new());
    }

    let now = Local::now().naive_local();
    let mut reset_habits = Vec::new();
    let entries = fs::read_dir(&habits_path)
        .map_err(|error| format!("Failed to read Habits directory: {}", error))?;

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                log::warn!(
                    "Skipping unreadable directory entry in {:?}: {}",
                    habits_path,
                    error
                );
                continue;
            }
        };
        let path = entry.path();

        let is_markdown = path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| matches!(value.to_ascii_lowercase().as_str(), "md" | "markdown"))
            .unwrap_or(false);

        if !is_markdown {
            continue;
        }

        let content = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(error) => {
                log::warn!("Skipping habit {:?}: {}", path, error);
                continue;
            }
        };
        let parsed = match parse_habit_state(&content) {
            Ok(parsed) => parsed,
            Err(error) => {
                log::warn!("Skipping habit {:?}: {}", path, error);
                continue;
            }
        };

        let Some(anchor) = parsed.reset_anchor else {
            log::debug!("Skipping habit {:?}: no reset anchor available", path);
            continue;
        };

        if !should_reset_habit(parsed.frequency, anchor, now) {
            continue;
        }

        let missed_periods = calculate_missed_periods(anchor, parsed.frequency, now);
        if missed_periods.is_empty() {
            continue;
        }

        // Apply a stricter write cap than the domain-layer scan cap so one wake-up
        // does not flood a habit file with an extreme number of backfilled rows.
        let periods_to_process = if missed_periods.len() > 100 {
            &missed_periods[missed_periods.len() - 100..]
        } else {
            &missed_periods[..]
        };

        let mut content_with_history = content.clone();
        let mut should_skip_habit = false;
        for (index, period_time) in periods_to_process.iter().enumerate() {
            let is_catchup = index < periods_to_process.len() - 1;
            let history_entry = format_history_entry(
                *period_time,
                HabitStatus::Todo,
                if is_catchup { "Backfill" } else { "Auto-Reset" },
                if is_catchup {
                    "Missed - app offline"
                } else {
                    "New period"
                },
            );
            match insert_history_entry(&content_with_history, &history_entry) {
                Ok(next_content) => {
                    content_with_history = next_content;
                }
                Err(error) => {
                    log::warn!("Skipping habit {:?}: {}", path, error);
                    should_skip_habit = true;
                    break;
                }
            }
        }

        if should_skip_habit {
            continue;
        }

        let final_content = apply_status_marker(
            &content_with_history,
            HabitStatus::Todo,
            parsed.status_format,
        );
        if let Err(error) = atomic_write_habit_file(&path, &final_content) {
            log::warn!("Skipping habit {:?}: {}", path, error);
            continue;
        }

        reset_habits.push(
            path.file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("unknown")
                .to_string(),
        );
    }

    Ok(reset_habits)
}
