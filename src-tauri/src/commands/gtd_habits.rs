//! GTD habit commands and habit-specific parsing helpers.

use chrono::Timelike;
use once_cell::sync::Lazy;
use regex::Regex;
use serde::Deserialize;
use std::fs;
use std::path::Path;

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
    Regex::new(r"## Created\s*\n\s*\[!datetime:created_date_time:([^\]]+)\]")
        .expect("Invalid habit created date regex pattern")
});

/// Regex for extracting habit status field
/// Format: [!singleselect:habit-status:VALUE]
static HABIT_STATUS_FIELD_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[!singleselect:habit-status:([^\]]+)\]")
        .expect("Invalid habit status field regex pattern")
});

/// Regex for extracting checkbox-based habit status fields
/// Format: [!checkbox:habit-status:true|false]
static HABIT_CHECKBOX_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[!checkbox:habit-status:([^\]]+)\]")
        .expect("Invalid habit checkbox regex pattern")
});

/// Regex for extracting habit frequency field
/// Format: [!singleselect:habit-frequency:VALUE]
static HABIT_FREQUENCY_FIELD_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[!singleselect:habit-frequency:([^\]]+)\]")
        .expect("Invalid habit frequency field regex pattern")
});

/// Regex for converting legacy list-format history entries into table rows.
static LIST_TO_TABLE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^- \*\*(\d{4}-\d{2}-\d{2})\*\* at \*\*([^*]+)\*\*: ([^(]+) \(([^)]+) - ([^)]+)\)$")
        .expect("Invalid list-to-table habit history regex pattern")
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
            // Handle both padded ("07:26 PM") and unpadded ("7:26 PM") hours
            // by preprocessing the time string to ensure consistent padding
            let padded_time = if time_str.chars().nth(1) == Some(':') {
                // Single digit hour like "7:26 PM" -> "07:26 PM"
                format!("0{}", time_str)
            } else {
                time_str.to_string()
            };
            let padded_datetime = format!("{} {}", date_str, padded_time);
            chrono::NaiveDateTime::parse_from_str(&padded_datetime, "%Y-%m-%d %I:%M %p")
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
                let date_str = date_str.as_str();

                // Try multiple date formats to handle incomplete dates
                // First try RFC3339
                if let Ok(datetime) = chrono::DateTime::parse_from_rfc3339(date_str) {
                    last_action_time = Some(datetime.naive_local());
                    log::debug!(
                        "[HABIT-PARSE] Parsed created date (RFC3339): {:?}",
                        datetime
                    );
                }
                // Try with :00:00Z appended for incomplete timestamps like 2025-09-06T15
                else if let Ok(datetime) =
                    chrono::DateTime::parse_from_rfc3339(&format!("{}:00:00Z", date_str))
                {
                    last_action_time = Some(datetime.naive_local());
                    log::debug!(
                        "[HABIT-PARSE] Parsed created date (with :00:00Z): {:?}",
                        datetime
                    );
                }
                // Try with :00Z for timestamps like 2025-09-06T15:00
                else if let Ok(datetime) =
                    chrono::DateTime::parse_from_rfc3339(&format!("{}:00Z", date_str))
                {
                    last_action_time = Some(datetime.naive_local());
                    log::debug!(
                        "[HABIT-PARSE] Parsed created date (with :00Z): {:?}",
                        datetime
                    );
                }
                // Try parsing as date only and assume start of day
                else if let Ok(date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                    last_action_time = Some(date.and_hms_opt(0, 0, 0).unwrap());
                    log::debug!("[HABIT-PARSE] Parsed created date (date only): {:?}", date);
                } else {
                    log::warn!("[HABIT-PARSE] Failed to parse created date: {}", date_str);
                }
            }
        }
    }

    last_action_time
}

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

#[tauri::command]
pub fn create_gtd_habit(
    space_path: String,
    habit_name: String,
    frequency: String,
    _status: String,            // Always 'todo', kept for API compatibility
    focus_time: Option<String>, // Optional focus time (HH:MM format)
    references: Option<HabitReferenceInput>,
) -> Result<String, String> {
    log::info!("Creating GTD habit: {}", habit_name);

    let habits_path = Path::new(&space_path).join("Habits");

    // Ensure Habits directory exists
    if !habits_path.exists() {
        return Err("Habits directory does not exist. Initialize GTD space first.".to_string());
    }

    // Sanitize habit name for filename
    let file_name = format!("{}.md", sanitize_markdown_file_stem(&habit_name));
    let habit_path = habits_path.join(&file_name);

    if habit_path.exists() {
        return Err(format!("Habit '{}' already exists", habit_name));
    }

    // Map frequency and status to single select values
    let frequency_value = match frequency.as_str() {
        "Every 5 Minutes (Testing)" | "5-minute" => "5-minute",
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

    let reference_values = references.unwrap_or_default();
    log::debug!(
        "create_gtd_habit references -> projects: {:?}, areas: {:?}, goals: {:?}, vision: {:?}, purpose: {:?}",
        reference_values.projects,
        reference_values.areas,
        reference_values.goals,
        reference_values.vision,
        reference_values.purpose
    );
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

    let projects_token = render_reference_token(&reference_values.projects);
    let areas_token = render_reference_token(&reference_values.areas);
    let goals_token = render_reference_token(&reference_values.goals);
    let vision_token = render_reference_token(&reference_values.vision);
    let purpose_token = render_reference_token(&reference_values.purpose);

    // Format focus time if provided
    let focus_time_section = if let Some(time) = focus_time {
        // Validate time format (HH:MM)
        if time.len() == 5 && time.chars().nth(2) == Some(':') {
            // Create a datetime with today's date and the specified time
            format!(
                "\n## Focus Date\n[!datetime:focus_date:{}T{}:00]\n\n",
                now.format("%Y-%m-%d"),
                time
            )
        } else {
            "\n".to_string()
        }
    } else {
        "\n".to_string()
    };

    let history_template = "*Track your habit completions below:*\n\n| Date | Time | Status | Action | Details |\n|------|------|--------|--------|---------|";

    let habit_content = format!(
        r#"# {}

## Status
[!checkbox:habit-status:{}]

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
        checkbox_value,
        frequency_value,
        focus_time_section,
        projects_token,
        areas_token,
        goals_token,
        vision_token,
        purpose_token,
        now.to_rfc3339(),
        history_template
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
/// * `Ok(true)` if status changed and history entry added
/// * `Ok(false)` if status was already the desired value
/// * `Err(String)` with error message if operation fails
#[tauri::command]
pub fn update_habit_status(habit_path: String, new_status: String) -> Result<bool, String> {
    use chrono::Local;

    let normalized_status = match new_status.as_str() {
        "completed" | "complete" | "done" => "completed".to_string(),
        "todo" | "to-do" | "pending" => "todo".to_string(),
        other => {
            log::error!("Invalid habit status received: {}", other);
            return Err(format!("Invalid habit status: {}", other));
        }
    };

    log::info!(
        "Updating habit status: path={}, new_status={}",
        habit_path,
        normalized_status
    );

    // Read and validate habit file
    let content =
        fs::read_to_string(&habit_path).map_err(|e| format!("Failed to read habit file: {}", e))?;

    // Check for new checkbox format first
    let (current_status, is_checkbox_format) =
        if let Some(cap) = HABIT_CHECKBOX_REGEX.captures(&content) {
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
    if current_status == normalized_status {
        log::info!(
            "Habit status unchanged (current='{}', new='{}'), skipping history update",
            current_status,
            normalized_status
        );
        return Ok(false);
    }

    log::info!(
        "Habit status changing from '{}' to '{}' (checkbox format: {})",
        current_status,
        normalized_status,
        is_checkbox_format
    );

    // Create history entry for the manual status change
    let now = Local::now();
    let status_display = if normalized_status == "todo" {
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
    // Format time without leading zero if hour < 10
    let hour = now.hour();
    let time_str = if hour == 0 {
        format!("12:{:02} AM", now.minute())
    } else if hour < 12 {
        format!("{}:{:02} AM", hour, now.minute())
    } else if hour == 12 {
        format!("12:{:02} PM", now.minute())
    } else {
        format!("{}:{:02} PM", hour - 12, now.minute())
    };

    let history_entry = format!(
        "| {} | {} | {} | Manual | Changed from {} |",
        now.format("%Y-%m-%d"),
        time_str,
        status_display,
        old_status_display
    );

    // Keep the actual status that was set - don't auto-reset
    // The habit should remain checked until the next frequency window
    let final_status = normalized_status.as_str();

    // Update the status field in the content based on format
    let updated_content = if is_checkbox_format {
        // Convert status to checkbox value
        let checkbox_value = if final_status == "completed" || final_status == "complete" {
            "true"
        } else {
            "false"
        };
        HABIT_CHECKBOX_REGEX
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
    log::debug!(
        "Final content length: {} bytes (original: {} bytes)",
        final_content.len(),
        content.len()
    );

    // OLD complex regex code removed - using simpler line-based approach above

    // Removed - using simpler line-based approach above

    // Write the updated file with proper error handling
    match fs::write(&habit_path, &final_content) {
        Ok(_) => {
            log::info!(
                "Successfully wrote habit file: {} ({} bytes)",
                habit_path,
                final_content.len()
            );

            // Verify the write by reading back
            if let Ok(verify_content) = fs::read_to_string(&habit_path) {
                if verify_content.contains(&history_entry) {
                    log::info!("Verified: History entry successfully written to file");
                } else {
                    log::error!("WARNING: History entry not found in file after write!");
                    log::debug!("Expected entry: {}", history_entry);
                    log::debug!("File content length after write: {}", verify_content.len());
                }
            }
        }
        Err(e) => {
            log::error!("Failed to write habit file {}: {}", habit_path, e);
            return Err(format!("Failed to write habit file: {}", e));
        }
    }
    Ok(true)
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
                if let Some(cap) = HABIT_CHECKBOX_REGEX.captures(&content) {
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

                        // Format time without leading zero if hour < 10
                        let hour = period_time.hour();
                        let time_str = if hour == 0 {
                            format!("12:{:02} AM", period_time.minute())
                        } else if hour < 12 {
                            format!("{}:{:02} AM", hour, period_time.minute())
                        } else if hour == 12 {
                            format!("12:{:02} PM", period_time.minute())
                        } else {
                            format!("{}:{:02} PM", hour - 12, period_time.minute())
                        };

                        // Use table row format for history entry
                        let history_entry = format!(
                            "| {} | {} | {} | {} | {} |",
                            period_time.format("%Y-%m-%d"),
                            time_str,
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
                        HABIT_CHECKBOX_REGEX
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
    log::debug!("[INSERT-HISTORY] Starting to insert entry: {}", entry);
    let lines: Vec<&str> = content.lines().collect();
    let mut last_history_line_idx = None;
    let mut in_history_section = false;
    let mut history_section_idx = None;
    let mut has_table_header = false;
    let mut table_separator_idx = None;
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
                table_separator_idx = Some(i);
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
        if let Some(caps) = LIST_TO_TABLE_REGEX.captures(list_entry) {
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
    } else if let Some(sep_idx) = table_separator_idx {
        // Header and separator exist but no data rows yet; insert right after separator
        log::debug!(
            "[INSERT-HISTORY] Inserting first row after separator at line {}",
            sep_idx
        );
        let mut new_lines = Vec::new();
        new_lines.extend_from_slice(&lines[..=sep_idx]);
        new_lines.push(entry);
        if sep_idx + 1 < lines.len() {
            new_lines.extend_from_slice(&lines[sep_idx + 1..]);
        }
        new_lines.join("\n")
    } else if let Some(idx) = history_section_idx {
        // History section exists but no entries yet
        log::debug!(
            "[INSERT-HISTORY] Found empty history section at line {}",
            idx
        );
        let mut new_lines = lines[..=idx].to_vec();
        new_lines.push("");
        new_lines.push("*Track your habit completions below:*");
        new_lines.push("");

        if !has_table_header {
            // Add table header
            log::debug!("[INSERT-HISTORY] Adding table header");
            new_lines.push("| Date | Time | Status | Action | Details |");
            new_lines.push("|------|------|--------|--------|---------|");
        }

        new_lines.push(entry);
        log::debug!("[INSERT-HISTORY] Added entry to history section");

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

    log::debug!("[INSERT-HISTORY] Result length: {} bytes", result.len());
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
