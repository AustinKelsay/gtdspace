use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime, Timelike};
use once_cell::sync::Lazy;
use regex::Regex;

pub(crate) const DEFAULT_HISTORY_TEMPLATE: &str =
    "*Track your habit completions below:*\n\n| Date | Time | Status | Action | Details |\n|------|------|--------|--------|---------|";

static HABIT_CREATED_DATE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"## Created\s*\n\s*\[!datetime:created_date_time:([^\]]+)\]")
        .expect("Invalid habit created date regex pattern")
});

static HABIT_STATUS_FIELD_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[!singleselect:habit-status:([^\]]+)\]")
        .expect("Invalid habit status field regex pattern")
});

static HABIT_CHECKBOX_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[!checkbox:habit-status:([^\]]+)\]")
        .expect("Invalid habit checkbox regex pattern")
});

static HABIT_FREQUENCY_FIELD_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[!singleselect:habit-frequency:([^\]]+)\]")
        .expect("Invalid habit frequency field regex pattern")
});

static LIST_TO_TABLE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^- \*\*(\d{4}-\d{2}-\d{2})\*\* at \*\*([^*]+)\*\*: ([^(]+) \(([^)]+) - ([^)]+)\)$")
        .expect("Invalid list-to-table habit history regex pattern")
});

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum HabitStatus {
    Todo,
    Completed,
}

impl HabitStatus {
    pub(crate) fn from_input(value: &str) -> Result<Self, String> {
        match value.trim().to_lowercase().as_str() {
            "completed" | "complete" | "done" => Ok(Self::Completed),
            "todo" | "to-do" | "pending" => Ok(Self::Todo),
            other => Err(format!("Invalid habit status: {}", other)),
        }
    }

    pub(crate) fn from_checkbox_token(value: &str) -> Self {
        if value.trim().eq_ignore_ascii_case("true") {
            Self::Completed
        } else {
            Self::Todo
        }
    }

    pub(crate) fn from_singleselect_token(value: &str) -> Self {
        match value.trim().to_lowercase().as_str() {
            "completed" | "complete" | "done" => Self::Completed,
            _ => Self::Todo,
        }
    }

    pub(crate) fn marker_token(self) -> &'static str {
        match self {
            Self::Todo => "todo",
            Self::Completed => "completed",
        }
    }

    pub(crate) fn checkbox_token(self) -> &'static str {
        match self {
            Self::Todo => "false",
            Self::Completed => "true",
        }
    }

    pub(crate) fn history_label(self) -> &'static str {
        match self {
            Self::Todo => "To Do",
            Self::Completed => "Complete",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum HabitStatusFormat {
    Checkbox,
    SingleSelect,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum HabitFrequency {
    FiveMinute,
    Daily,
    EveryOtherDay,
    TwiceWeekly,
    Weekly,
    Weekdays,
    Biweekly,
    Monthly,
}

impl HabitFrequency {
    pub(crate) fn from_marker(value: &str) -> Result<Self, String> {
        match value.trim() {
            "5-minute" => Ok(Self::FiveMinute),
            "daily" => Ok(Self::Daily),
            "every-other-day" => Ok(Self::EveryOtherDay),
            "twice-weekly" => Ok(Self::TwiceWeekly),
            "weekly" => Ok(Self::Weekly),
            "weekdays" => Ok(Self::Weekdays),
            "biweekly" => Ok(Self::Biweekly),
            "monthly" => Ok(Self::Monthly),
            other => Err(format!("Unknown habit frequency '{}'", other)),
        }
    }

    pub(crate) fn from_create_input(value: &str) -> Result<Self, String> {
        match value.trim() {
            "Every 5 Minutes (Testing)" | "5-minute" => Ok(Self::FiveMinute),
            "Every Day" | "daily" => Ok(Self::Daily),
            "Weekdays (Mon-Fri)" | "weekdays" => Ok(Self::Weekdays),
            "Every Other Day" | "every-other-day" => Ok(Self::EveryOtherDay),
            "Twice a Week" | "twice-weekly" => Ok(Self::TwiceWeekly),
            "Once Every Week" | "weekly" => Ok(Self::Weekly),
            "Once Every Other Week" | "biweekly" => Ok(Self::Biweekly),
            "Once a Month" | "monthly" => Ok(Self::Monthly),
            other => Err(format!("Unrecognized habit frequency token '{}'", other)),
        }
    }

    pub(crate) fn as_marker_token(self) -> &'static str {
        match self {
            Self::FiveMinute => "5-minute",
            Self::Daily => "daily",
            Self::EveryOtherDay => "every-other-day",
            Self::TwiceWeekly => "twice-weekly",
            Self::Weekly => "weekly",
            Self::Weekdays => "weekdays",
            Self::Biweekly => "biweekly",
            Self::Monthly => "monthly",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct HistoryRecord {
    pub timestamp: NaiveDateTime,
    pub action: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ParsedHabitState {
    pub status: HabitStatus,
    pub status_format: HabitStatusFormat,
    pub frequency: HabitFrequency,
    pub reset_anchor: Option<NaiveDateTime>,
}

fn parse_history_timestamp(date: &str, time: &str) -> Option<NaiveDateTime> {
    let trimmed = time.trim();
    if trimmed.contains("AM") || trimmed.contains("PM") {
        let padded = if trimmed.chars().nth(1) == Some(':') {
            format!("0{}", trimmed)
        } else {
            trimmed.to_string()
        };
        NaiveDateTime::parse_from_str(&format!("{} {}", date, padded), "%Y-%m-%d %I:%M %p").ok()
    } else {
        NaiveDateTime::parse_from_str(&format!("{} {}", date, trimmed), "%Y-%m-%d %H:%M").ok()
    }
}

fn parse_created_at(content: &str) -> Option<NaiveDateTime> {
    let captures = HABIT_CREATED_DATE_REGEX.captures(content)?;
    let raw = captures.get(1)?.as_str();

    if let Ok(datetime) = chrono::DateTime::parse_from_rfc3339(raw) {
        return Some(datetime.naive_local());
    }
    if let Ok(datetime) = chrono::DateTime::parse_from_rfc3339(&format!("{}:00:00Z", raw)) {
        return Some(datetime.naive_local());
    }
    if let Ok(datetime) = chrono::DateTime::parse_from_rfc3339(&format!("{}:00Z", raw)) {
        return Some(datetime.naive_local());
    }
    if let Ok(datetime) = NaiveDateTime::parse_from_str(raw, "%Y-%m-%dT%H:%M:%S") {
        return Some(datetime);
    }
    if let Ok(datetime) = NaiveDateTime::parse_from_str(raw, "%Y-%m-%dT%H:%M") {
        return Some(datetime);
    }
    if let Ok(date) = NaiveDate::parse_from_str(raw, "%Y-%m-%d") {
        return date.and_hms_opt(0, 0, 0);
    }

    None
}

fn parse_history_record_from_table(line: &str) -> Option<HistoryRecord> {
    if !line.trim_start().starts_with('|') {
        return None;
    }

    let parts: Vec<String> = line
        .trim()
        .trim_matches('|')
        .split('|')
        .map(|part| part.trim().to_string())
        .collect();

    if parts.len() < 5 || parts.first()?.eq_ignore_ascii_case("Date") {
        return None;
    }
    if parts.first()?.starts_with("---") {
        return None;
    }

    let timestamp = parse_history_timestamp(parts.first()?, parts.get(1)?)?;
    Some(HistoryRecord {
        timestamp,
        action: parts.get(3).cloned().unwrap_or_default(),
    })
}

fn parse_history_record_from_legacy_list(line: &str) -> Option<HistoryRecord> {
    let captures = LIST_TO_TABLE_REGEX.captures(line)?;
    let date = captures.get(1)?.as_str();
    let time = captures.get(2)?.as_str();
    let action = captures.get(4)?.as_str().trim().to_string();
    let timestamp = parse_history_timestamp(date, time)?;

    Some(HistoryRecord { timestamp, action })
}

fn is_history_table_row_line(line: &str) -> bool {
    let trimmed = line.trim_start();
    trimmed.starts_with('|') && trimmed.matches('|').count() >= 2
}

fn is_history_heading_line(line: &str) -> bool {
    line.trim().eq_ignore_ascii_case("## history")
}

fn parse_history_records(content: &str) -> Vec<HistoryRecord> {
    let Some(history_index) = content.lines().position(is_history_heading_line) else {
        return Vec::new();
    };

    content
        .lines()
        .skip(history_index + 1)
        .take_while(|line| {
            let trimmed = line.trim();
            trimmed.is_empty() || !trimmed.starts_with('#')
        })
        .filter_map(|line| {
            parse_history_record_from_table(line)
                .or_else(|| parse_history_record_from_legacy_list(line))
        })
        .collect()
}

fn is_reset_action(action: &str) -> bool {
    let normalized = action.trim().to_lowercase();
    normalized.contains("reset") || normalized.contains("backfill")
}

pub(crate) fn parse_habit_state(content: &str) -> Result<ParsedHabitState, String> {
    let (status, status_format) = if let Some(captures) = HABIT_CHECKBOX_REGEX.captures(content) {
        (
            HabitStatus::from_checkbox_token(
                captures.get(1).map(|m| m.as_str()).unwrap_or("false"),
            ),
            HabitStatusFormat::Checkbox,
        )
    } else if let Some(captures) = HABIT_STATUS_FIELD_REGEX.captures(content) {
        (
            HabitStatus::from_singleselect_token(
                captures.get(1).map(|m| m.as_str()).unwrap_or("todo"),
            ),
            HabitStatusFormat::SingleSelect,
        )
    } else {
        return Err("Could not find current status in habit file".to_string());
    };

    let frequency_token = HABIT_FREQUENCY_FIELD_REGEX
        .captures(content)
        .and_then(|captures| captures.get(1))
        .map(|value| value.as_str())
        .ok_or_else(|| "Could not find frequency in habit file".to_string())?;
    let frequency = HabitFrequency::from_marker(frequency_token)?;

    let history_records = parse_history_records(content);
    let reset_anchor = history_records
        .iter()
        .filter(|record| is_reset_action(&record.action))
        .max_by_key(|record| record.timestamp)
        .map(|record| record.timestamp)
        .or_else(|| history_records.iter().map(|record| record.timestamp).max())
        .or_else(|| parse_created_at(content));

    Ok(ParsedHabitState {
        status,
        status_format,
        frequency,
        reset_anchor,
    })
}

pub(crate) fn format_history_entry(
    timestamp: NaiveDateTime,
    status: HabitStatus,
    action: &str,
    details: &str,
) -> String {
    format!(
        "| {} | {} | {} | {} | {} |",
        timestamp.format("%Y-%m-%d"),
        format_history_time(timestamp),
        status.history_label(),
        action,
        details
    )
}

pub(crate) fn format_history_time(timestamp: NaiveDateTime) -> String {
    let hour = timestamp.hour();
    if hour == 0 {
        format!("12:{:02} AM", timestamp.minute())
    } else if hour < 12 {
        format!("{}:{:02} AM", hour, timestamp.minute())
    } else if hour == 12 {
        format!("12:{:02} PM", timestamp.minute())
    } else {
        format!("{}:{:02} PM", hour - 12, timestamp.minute())
    }
}

pub(crate) fn apply_status_marker(
    content: &str,
    status: HabitStatus,
    format: HabitStatusFormat,
) -> String {
    match format {
        HabitStatusFormat::Checkbox => HABIT_CHECKBOX_REGEX
            .replace(
                content,
                format!("[!checkbox:habit-status:{}]", status.checkbox_token()).as_str(),
            )
            .to_string(),
        HabitStatusFormat::SingleSelect => HABIT_STATUS_FIELD_REGEX
            .replace(
                content,
                format!("[!singleselect:habit-status:{}]", status.marker_token()).as_str(),
            )
            .to_string(),
    }
}

pub(crate) fn insert_history_entry(content: &str, entry: &str) -> Result<String, String> {
    let lines: Vec<&str> = content.lines().collect();
    let mut last_history_line_idx = None;
    let mut in_history_section = false;
    let mut history_section_idx = None;
    let mut has_table_header = false;
    let mut table_separator_idx = None;
    let mut has_old_list_format = false;
    let mut old_list_entries: Vec<(usize, &str)> = Vec::new();

    for (i, line) in lines.iter().enumerate() {
        if is_history_heading_line(line) {
            in_history_section = true;
            history_section_idx = Some(i);
            continue;
        }

        if in_history_section {
            if line.starts_with("*Track your habit completions")
                || line.starts_with("*Track your habit")
            {
                continue;
            } else if line.contains("| Date") && line.contains("| Time") {
                has_table_header = true;
                continue;
            } else if line.contains("|---") || line.contains("| ---") {
                table_separator_idx = Some(i);
                continue;
            } else if is_history_table_row_line(line) {
                last_history_line_idx = Some(i);
            } else if line.trim_start().starts_with("##") {
                break;
            } else if !line.trim().is_empty() {
                has_old_list_format = true;
                old_list_entries.push((i, line));
                if last_history_line_idx.is_none() || i > last_history_line_idx.unwrap() {
                    last_history_line_idx = Some(i);
                }
            }
        }
    }

    fn convert_list_to_table_row(list_entry: &str) -> Option<String> {
        let captures = LIST_TO_TABLE_REGEX.captures(list_entry)?;
        Some(format!(
            "| {} | {} | {} | {} | {} |",
            &captures[1],
            &captures[2],
            captures[3].trim(),
            &captures[4],
            &captures[5]
        ))
    }

    let result = if has_old_list_format && !has_table_header {
        let mut new_lines = Vec::new();
        let mut migrated_history_lines = Vec::new();

        for (_, list_entry) in &old_list_entries {
            if let Some(table_row) = convert_list_to_table_row(list_entry) {
                migrated_history_lines.push(table_row);
            } else {
                migrated_history_lines.push((*list_entry).to_string());
            }
        }

        if let Some(idx) = history_section_idx {
            new_lines.extend_from_slice(&lines[..=idx]);
            new_lines.push("");
            new_lines.push("*Track your habit completions below:*");
            new_lines.push("");
            new_lines.push("| Date | Time | Status | Action | Details |");
            new_lines.push("|------|------|--------|--------|---------|");
            for row in &migrated_history_lines {
                new_lines.push(row);
            }
            new_lines.push(entry);

            let skip_until = last_history_line_idx.map(|idx| idx + 1).unwrap_or(idx + 1);
            if skip_until < lines.len() {
                let mut cursor = skip_until;
                while cursor < lines.len()
                    && (lines[cursor].starts_with("- ") || lines[cursor].trim().is_empty())
                {
                    cursor += 1;
                }
                if cursor < lines.len() {
                    new_lines.extend_from_slice(&lines[cursor..]);
                }
            }

            new_lines.join("\n")
        } else {
            format!(
                "{}\n\n## History\n\n{}\n{}",
                content.trim_end(),
                DEFAULT_HISTORY_TEMPLATE,
                entry
            )
        }
    } else if let Some(idx) = last_history_line_idx {
        let mut new_lines = lines[..=idx].to_vec();
        new_lines.push(entry);
        new_lines.extend_from_slice(&lines[idx + 1..]);
        new_lines.join("\n")
    } else if let Some(separator_idx) = table_separator_idx {
        let mut new_lines = Vec::new();
        new_lines.extend_from_slice(&lines[..=separator_idx]);
        new_lines.push(entry);
        if separator_idx + 1 < lines.len() {
            new_lines.extend_from_slice(&lines[separator_idx + 1..]);
        }
        new_lines.join("\n")
    } else if let Some(idx) = history_section_idx {
        let mut new_lines = lines[..=idx].to_vec();
        new_lines.push("");
        new_lines.push("*Track your habit completions below:*");
        new_lines.push("");
        if !has_table_header {
            new_lines.push("| Date | Time | Status | Action | Details |");
            new_lines.push("|------|------|--------|--------|---------|");
        }
        new_lines.push(entry);

        let mut cursor = idx + 1;
        while cursor < lines.len()
            && (lines[cursor].trim().is_empty() || lines[cursor].starts_with("*Track"))
        {
            cursor += 1;
        }
        if cursor < lines.len() {
            new_lines.extend_from_slice(&lines[cursor..]);
        }

        new_lines.join("\n")
    } else {
        format!(
            "{}\n\n## History\n\n{}\n{}",
            content.trim_end(),
            DEFAULT_HISTORY_TEMPLATE,
            entry
        )
    };

    Ok(result)
}

fn start_of_day(moment: NaiveDateTime) -> NaiveDateTime {
    moment.date().and_hms_opt(0, 0, 0).expect("valid midnight")
}

fn add_days(moment: NaiveDateTime, days: i64) -> NaiveDateTime {
    moment + Duration::days(days)
}

fn start_of_week_monday(moment: NaiveDateTime) -> NaiveDateTime {
    let weekday = moment.weekday().num_days_from_monday() as i64;
    start_of_day(moment) - Duration::days(weekday)
}

fn next_scheduled_day(after: NaiveDateTime, allowed_days_from_sunday: &[u32]) -> NaiveDateTime {
    let base = start_of_day(after);
    for offset in 0..=14 {
        let candidate = add_days(base, offset);
        if candidate <= after {
            continue;
        }
        if allowed_days_from_sunday.contains(&candidate.weekday().num_days_from_sunday()) {
            return candidate;
        }
    }

    add_days(base, 1)
}

fn next_five_minute_boundary(after: NaiveDateTime) -> NaiveDateTime {
    let base = after
        .with_second(0)
        .and_then(|value| value.with_nanosecond(0))
        .unwrap_or(after);
    let remainder = base.minute() % 5;
    let minutes_to_add = if remainder == 0 { 5 } else { 5 - remainder } as i64;
    let mut next = base + Duration::minutes(minutes_to_add);
    if next <= after {
        next += Duration::minutes(5);
    }
    next
}

pub(crate) fn next_reset_after(frequency: HabitFrequency, anchor: NaiveDateTime) -> NaiveDateTime {
    // Keep this logic in sync with the frontend helper:
    // `calculateNextHabitReset` in `src/utils/gtd-habit-markdown.ts`.
    // Shared semantics:
    // - twice-weekly uses Tuesday/Friday windows
    // - weekly/biweekly anchor to Monday-based weeks
    // - weekdays excludes weekends
    // - monthly resets on the first day of the next month
    match frequency {
        HabitFrequency::FiveMinute => next_five_minute_boundary(anchor),
        HabitFrequency::Daily => add_days(start_of_day(anchor), 1),
        HabitFrequency::EveryOtherDay => add_days(start_of_day(anchor), 2),
        HabitFrequency::TwiceWeekly => next_scheduled_day(anchor, &[2, 5]),
        HabitFrequency::Weekly => add_days(start_of_week_monday(anchor), 7),
        HabitFrequency::Weekdays => next_scheduled_day(anchor, &[1, 2, 3, 4, 5]),
        HabitFrequency::Biweekly => {
            let candidate = add_days(start_of_week_monday(anchor), 14);
            if candidate > anchor {
                candidate
            } else {
                add_days(candidate, 14)
            }
        }
        HabitFrequency::Monthly => {
            let date = anchor.date();
            let (year, month) = if date.month() == 12 {
                (date.year() + 1, 1)
            } else {
                (date.year(), date.month() + 1)
            };
            NaiveDate::from_ymd_opt(year, month, 1)
                .and_then(|value| value.and_hms_opt(0, 0, 0))
                .expect("valid first day of month")
        }
    }
}

pub(crate) fn calculate_missed_periods(
    anchor: NaiveDateTime,
    frequency: HabitFrequency,
    now: NaiveDateTime,
) -> Vec<NaiveDateTime> {
    const MAX_PERIODS: usize = 1000;

    let mut periods = Vec::new();
    let mut cursor = next_reset_after(frequency, anchor);

    while cursor <= now && periods.len() < MAX_PERIODS {
        periods.push(cursor);
        cursor = next_reset_after(frequency, cursor);
    }

    periods
}

pub(crate) fn should_reset_habit(
    frequency: HabitFrequency,
    anchor: NaiveDateTime,
    now: NaiveDateTime,
) -> bool {
    next_reset_after(frequency, anchor) <= now
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dt(year: i32, month: u32, day: u32, hour: u32, minute: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(year, month, day)
            .and_then(|date| date.and_hms_opt(hour, minute, 0))
            .unwrap()
    }

    #[test]
    fn twice_weekly_resets_on_calendar_days() {
        let monday_evening = dt(2026, 3, 2, 20, 0);
        let tuesday_midnight = dt(2026, 3, 3, 0, 0);
        let friday_midnight = dt(2026, 3, 6, 0, 0);

        assert_eq!(
            next_reset_after(HabitFrequency::TwiceWeekly, monday_evening),
            tuesday_midnight
        );
        assert_eq!(
            next_reset_after(HabitFrequency::TwiceWeekly, tuesday_midnight),
            friday_midnight
        );
    }

    #[test]
    fn monthly_resets_on_first_of_next_month() {
        let anchor = dt(2026, 1, 31, 18, 45);
        let expected = dt(2026, 2, 1, 0, 0);

        assert_eq!(next_reset_after(HabitFrequency::Monthly, anchor), expected);
    }

    #[test]
    fn calculate_missed_periods_backfills_calendar_boundaries() {
        let anchor = dt(2026, 3, 2, 9, 0);
        let now = dt(2026, 3, 9, 12, 0);

        assert_eq!(
            calculate_missed_periods(anchor, HabitFrequency::TwiceWeekly, now),
            vec![dt(2026, 3, 3, 0, 0), dt(2026, 3, 6, 0, 0)]
        );
    }

    #[test]
    fn parse_habit_state_prefers_reset_anchor_over_manual_history() {
        let content = r#"# Habit

## Status
[!checkbox:habit-status:true]

## Frequency
[!singleselect:habit-frequency:daily]

## Created
[!datetime:created_date_time:2026-03-01T09:00:00Z]

## History
| Date | Time | Status | Action | Details |
|------|------|--------|--------|---------|
| 2026-03-02 | 12:00 PM | Complete | Manual | Done |
| 2026-03-03 | 12:00 AM | To Do | Auto-Reset | New period |
| 2026-03-03 | 6:00 PM | Complete | Manual | Done again |
"#;

        let parsed = parse_habit_state(content).unwrap();
        assert_eq!(parsed.status, HabitStatus::Completed);
        assert_eq!(parsed.frequency, HabitFrequency::Daily);
        assert_eq!(parsed.reset_anchor, Some(dt(2026, 3, 3, 0, 0)));
    }

    #[test]
    fn parse_habit_state_accepts_local_created_timestamp_without_timezone() {
        let content = r#"# Habit

## Status
[!singleselect:habit-status:complete]

## Frequency
[!singleselect:habit-frequency:weekly]

## Created
[!datetime:created_date_time:2026-03-01T09:30]

## History
| Date | Time | Status | Action | Details |
|------|------|--------|--------|---------|
"#;

        let parsed = parse_habit_state(content).unwrap();
        assert_eq!(parsed.status, HabitStatus::Completed);
        assert_eq!(parsed.frequency, HabitFrequency::Weekly);
        assert_eq!(parsed.reset_anchor, Some(dt(2026, 3, 1, 9, 30)));
    }

    #[test]
    fn parse_habit_state_reads_history_from_trimmed_case_insensitive_heading() {
        let content = r#"# Habit

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:weekly]

## Created
[!datetime:created_date_time:2026-03-01T09:30]

   ## history
| Date | Time | Status | Action | Details |
|------|------|--------|--------|---------|
| 2026-03-04 | 8:15 PM | To Do | Manual | |
"#;

        let parsed = parse_habit_state(content).unwrap();
        assert_eq!(parsed.reset_anchor, Some(dt(2026, 3, 4, 20, 15)));
    }

    #[test]
    fn parse_habit_state_uses_latest_manual_history_before_created() {
        let content = r#"# Habit

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:weekly]

## Created
[!datetime:created_date_time:2026-03-01T09:30]

## History
| Date | Time | Status | Action | Details |
|------|------|--------|--------|---------|
| 2026-03-02 | 7:45 AM | Complete | Manual | Done |
| 2026-03-04 | 8:15 PM | To Do | Manual | Missed |
"#;

        let parsed = parse_habit_state(content).unwrap();
        assert_eq!(parsed.reset_anchor, Some(dt(2026, 3, 4, 20, 15)));
    }

    #[test]
    fn parse_habit_state_preserves_empty_table_cells() {
        let content = r#"# Habit

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:weekly]

## Created
[!datetime:created_date_time:2026-03-01T09:30]

## History
| Date | Time | Status | Action | Details |
|------|------|--------|--------|---------|
| 2026-03-04 | 8:15 PM | To Do | Manual | |
"#;

        let parsed = parse_habit_state(content).unwrap();
        assert_eq!(parsed.reset_anchor, Some(dt(2026, 3, 4, 20, 15)));
    }

    #[test]
    fn insert_history_entry_migrates_legacy_lists() {
        let content = r#"# Habit

## History

- **2026-03-01** at **7:30 AM**: Complete (Manual - Done)
"#;

        let updated = insert_history_entry(
            content,
            "| 2026-03-02 | 12:00 AM | To Do | Auto-Reset | New period |",
        )
        .unwrap();

        assert!(updated.contains("| Date | Time | Status | Action | Details |"));
        assert!(updated.contains("| 2026-03-01 | 7:30 AM | Complete | Manual | Done |"));
        assert!(updated.contains("| 2026-03-02 | 12:00 AM | To Do | Auto-Reset | New period |"));
    }

    #[test]
    fn insert_history_entry_preserves_unmatched_legacy_lines() {
        let content = r#"# Habit

## History

- **2026-03-01** at **7:30 AM**: Complete (Manual - Done)
- freeform note that does not match the legacy pattern
"#;

        let updated = insert_history_entry(
            content,
            "| 2026-03-02 | 12:00 AM | To Do | Auto-Reset | New period |",
        )
        .unwrap();

        assert!(updated.contains("| 2026-03-01 | 7:30 AM | Complete | Manual | Done |"));
        assert!(updated.contains("- freeform note that does not match the legacy pattern"));
        assert!(updated.contains("| 2026-03-02 | 12:00 AM | To Do | Auto-Reset | New period |"));
    }

    #[test]
    fn insert_history_entry_preserves_plain_legacy_history_lines() {
        let content = r#"# Habit

## History

Reminder: keep this note with the migrated history.
- **2026-03-01** at **7:30 AM**: Complete (Manual - Done)

## Notes
Still here
"#;

        let updated = insert_history_entry(
            content,
            "| 2026-03-02 | 12:00 AM | To Do | Auto-Reset | New period |",
        )
        .unwrap();

        assert!(updated.contains("Reminder: keep this note with the migrated history."));
        assert!(updated.contains("| 2026-03-01 | 7:30 AM | Complete | Manual | Done |"));
        assert!(updated.contains("## Notes\nStill here"));
    }

    #[test]
    fn insert_history_entry_creates_history_section_when_missing() {
        let updated = insert_history_entry(
            "# Habit\n\n## Status\n[!checkbox:habit-status:false]",
            "| 2026-03-02 | 12:00 AM | To Do | Auto-Reset | New period |",
        )
        .unwrap();

        assert!(updated.contains("## History"));
        assert!(updated.contains(DEFAULT_HISTORY_TEMPLATE));
        assert!(updated.contains("| 2026-03-02 | 12:00 AM | To Do | Auto-Reset | New period |"));
    }
}
