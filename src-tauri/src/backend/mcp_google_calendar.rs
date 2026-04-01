use chrono::{DateTime, FixedOffset, Local, NaiveDate, TimeZone};
use rmcp::schemars;
use rmcp::schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::google_calendar::{load_google_calendar_cache, CachedEvents, GoogleCalendarEvent};

pub const GOOGLE_CALENDAR_EVENTS_RESOURCE_URI: &str =
    "gtdspace://integrations/google-calendar/events.json";

const DEFAULT_MAX_RESULTS: usize = 200;
const MAX_MAX_RESULTS: usize = 1000;

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarMcpEvent {
    pub id: String,
    pub summary: String,
    pub description: Option<String>,
    pub start: Option<String>,
    pub end: Option<String>,
    pub location: Option<String>,
    pub attendees: Vec<String>,
    pub meeting_link: Option<String>,
    pub status: String,
    pub color_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarMcpEnvelope {
    pub source: String,
    pub cache_available: bool,
    pub last_updated: Option<String>,
    pub cache_event_count: u32,
    pub matched_count: u32,
    pub returned_count: u32,
    pub truncated: bool,
    pub next_cursor: Option<String>,
    pub events: Vec<GoogleCalendarMcpEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, Default)]
#[serde(rename_all = "camelCase")]
pub struct GoogleCalendarListEventsRequest {
    pub time_min: Option<String>,
    pub time_max: Option<String>,
    pub query: Option<String>,
    pub include_cancelled: Option<bool>,
    pub cursor: Option<String>,
    pub limit: Option<u32>,
    pub max_results: Option<u32>,
}

pub async fn google_calendar_events_resource() -> Result<GoogleCalendarMcpEnvelope, String> {
    google_calendar_events_resource_from_cache(load_google_calendar_cache_async().await?)
}

pub async fn google_calendar_list_events(
    request: GoogleCalendarListEventsRequest,
) -> Result<GoogleCalendarMcpEnvelope, String> {
    google_calendar_list_events_from_cache(load_google_calendar_cache_async().await?, request)
}

async fn load_google_calendar_cache_async() -> Result<Option<CachedEvents>, String> {
    tokio::task::spawn_blocking(load_google_calendar_cache)
        .await
        .map_err(|error| format!("Failed to join Google Calendar cache load task: {}", error))?
}

fn google_calendar_events_resource_from_cache(
    cache: Option<CachedEvents>,
) -> Result<GoogleCalendarMcpEnvelope, String> {
    let Some(cache) = cache else {
        return Ok(empty_envelope());
    };

    let events = cache
        .events
        .iter()
        .map(GoogleCalendarMcpEvent::from)
        .collect::<Vec<_>>();
    let count = to_u32_len(events.len());

    Ok(GoogleCalendarMcpEnvelope {
        source: "cache".to_string(),
        cache_available: true,
        last_updated: Some(cache.last_updated.to_rfc3339()),
        cache_event_count: count,
        matched_count: count,
        returned_count: count,
        truncated: false,
        next_cursor: None,
        events,
    })
}

fn google_calendar_list_events_from_cache(
    cache: Option<CachedEvents>,
    request: GoogleCalendarListEventsRequest,
) -> Result<GoogleCalendarMcpEnvelope, String> {
    let Some(cache) = cache else {
        return Ok(empty_envelope());
    };

    let include_cancelled = request.include_cancelled.unwrap_or(false);
    let query = normalize_optional_string(request.query);
    let time_min = normalize_optional_string(request.time_min)
        .as_deref()
        .map(|value| parse_filter_bound(value, BoundKind::Min))
        .transpose()?;
    let time_max = normalize_optional_string(request.time_max)
        .as_deref()
        .map(|value| parse_filter_bound(value, BoundKind::Max))
        .transpose()?;
    let (time_min, time_max) = normalize_bounds(time_min, time_max);
    let offset = parse_cursor(request.cursor.as_deref())?;
    let limit = request
        .limit
        .or(request.max_results)
        .map(|value| value.clamp(1, MAX_MAX_RESULTS as u32) as usize)
        .unwrap_or(DEFAULT_MAX_RESULTS);

    let mut matched = Vec::new();
    for event in &cache.events {
        if !include_cancelled && event.status.eq_ignore_ascii_case("cancelled") {
            continue;
        }
        if let Some(query) = query.as_deref() {
            if !event_matches_query(event, query) {
                continue;
            }
        }
        if (time_min.is_some() || time_max.is_some())
            && !event_matches_time_bounds(event, time_min.as_ref(), time_max.as_ref())?
        {
            continue;
        }
        matched.push(GoogleCalendarMcpEvent::from(event));
    }

    let matched_count = matched.len();
    let returned = matched
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect::<Vec<_>>();
    let returned_count = returned.len();
    let next_cursor =
        (offset + returned_count < matched_count).then(|| (offset + returned_count).to_string());

    Ok(GoogleCalendarMcpEnvelope {
        source: "cache".to_string(),
        cache_available: true,
        last_updated: Some(cache.last_updated.to_rfc3339()),
        cache_event_count: to_u32_len(cache.events.len()),
        matched_count: to_u32_len(matched_count),
        returned_count: to_u32_len(returned_count),
        truncated: next_cursor.is_some(),
        next_cursor,
        events: returned,
    })
}

fn empty_envelope() -> GoogleCalendarMcpEnvelope {
    GoogleCalendarMcpEnvelope {
        source: "cache".to_string(),
        cache_available: false,
        last_updated: None,
        cache_event_count: 0,
        matched_count: 0,
        returned_count: 0,
        truncated: false,
        next_cursor: None,
        events: Vec::new(),
    }
}

fn parse_cursor(value: Option<&str>) -> Result<usize, String> {
    match value.map(str::trim).filter(|entry| !entry.is_empty()) {
        None => Ok(0),
        Some(raw) => raw.parse::<usize>().map_err(|_| {
            format!(
                "Invalid cursor '{}'. Expected a non-negative integer offset.",
                raw
            )
        }),
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
}

fn normalize_bounds(
    time_min: Option<DateTime<FixedOffset>>,
    time_max: Option<DateTime<FixedOffset>>,
) -> (Option<DateTime<FixedOffset>>, Option<DateTime<FixedOffset>>) {
    match (time_min, time_max) {
        (Some(min), Some(max)) if min > max => (Some(max), Some(min)),
        other => other,
    }
}

fn event_matches_query(event: &GoogleCalendarEvent, query: &str) -> bool {
    let query = query.to_lowercase();

    event.summary.to_lowercase().contains(&query)
        || event
            .description
            .as_deref()
            .map(|value| value.to_lowercase().contains(&query))
            .unwrap_or(false)
        || event
            .location
            .as_deref()
            .map(|value| value.to_lowercase().contains(&query))
            .unwrap_or(false)
        || event
            .attendees
            .iter()
            .any(|value| value.to_lowercase().contains(&query))
}

fn event_matches_time_bounds(
    event: &GoogleCalendarEvent,
    time_min: Option<&DateTime<FixedOffset>>,
    time_max: Option<&DateTime<FixedOffset>>,
) -> Result<bool, String> {
    let Some(start) = event.start.as_deref() else {
        return Ok(false);
    };

    let start = match parse_event_start(start) {
        Ok(start) => start,
        Err(error) => {
            log::warn!(
                "Skipping cached Google Calendar event '{}' with unparseable start '{}': {}",
                event.id,
                start,
                error
            );
            return Ok(false);
        }
    };
    let has_explicit_end = event.end.is_some();
    let end = match event.end.as_deref() {
        Some(end) => match parse_event_end(end) {
            Ok(end) => end,
            Err(error) => {
                log::warn!(
                    "Skipping cached Google Calendar event '{}' with unparseable end '{}': {}",
                    event.id,
                    end,
                    error
                );
                return Ok(false);
            }
        },
        None => start,
    };

    if let Some(min) = time_min {
        if (has_explicit_end && end <= *min) || (!has_explicit_end && end < *min) {
            return Ok(false);
        }
    }
    if let Some(max) = time_max {
        if start > *max {
            return Ok(false);
        }
    }
    Ok(true)
}

fn parse_event_start(value: &str) -> Result<DateTime<FixedOffset>, String> {
    parse_filter_value(value, BoundKind::Min).map_err(|error| {
        format!(
            "Failed to parse cached Google Calendar event start '{}': {}",
            value, error
        )
    })
}

fn parse_event_end(value: &str) -> Result<DateTime<FixedOffset>, String> {
    let bound_kind = if value.contains('T') || value.contains('t') {
        BoundKind::Max
    } else {
        BoundKind::Min
    };
    parse_filter_value(value, bound_kind).map_err(|error| {
        format!(
            "Failed to parse cached Google Calendar event end '{}': {}",
            value, error
        )
    })
}

fn parse_filter_bound(value: &str, bound_kind: BoundKind) -> Result<DateTime<FixedOffset>, String> {
    parse_filter_value(value, bound_kind).map_err(|error| {
        format!(
            "Invalid Google Calendar filter bound '{}': {}",
            value, error
        )
    })
}

fn parse_filter_value(value: &str, bound_kind: BoundKind) -> Result<DateTime<FixedOffset>, String> {
    if let Ok(date_time) = DateTime::parse_from_rfc3339(value) {
        return Ok(date_time);
    }

    let date = NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| "expected RFC3339 date-time or YYYY-MM-DD".to_string())?;
    local_day_boundary(date, bound_kind)
}

fn local_day_boundary(
    date: NaiveDate,
    bound_kind: BoundKind,
) -> Result<DateTime<FixedOffset>, String> {
    let naive = match bound_kind {
        BoundKind::Min => date
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| format!("Invalid local start-of-day for {}", date))?,
        BoundKind::Max => date
            .and_hms_nano_opt(23, 59, 59, 999_999_999)
            .ok_or_else(|| format!("Invalid local end-of-day for {}", date))?,
    };
    let mapped = Local.from_local_datetime(&naive);
    let date_time = match bound_kind {
        BoundKind::Min => mapped
            .earliest()
            .or_else(|| mapped.single())
            .or_else(|| mapped.latest()),
        BoundKind::Max => mapped
            .latest()
            .or_else(|| mapped.single())
            .or_else(|| mapped.earliest()),
    }
    .ok_or_else(|| format!("Failed to resolve local date boundary for {}", date))?;

    Ok(date_time.fixed_offset())
}

fn to_u32_len(len: usize) -> u32 {
    u32::try_from(len).unwrap_or(u32::MAX)
}

#[derive(Debug, Clone, Copy)]
enum BoundKind {
    Min,
    Max,
}

impl From<&GoogleCalendarEvent> for GoogleCalendarMcpEvent {
    fn from(value: &GoogleCalendarEvent) -> Self {
        Self {
            id: value.id.clone(),
            summary: value.summary.clone(),
            description: value.description.clone(),
            start: value.start.clone(),
            end: value.end.clone(),
            location: value.location.clone(),
            attendees: value.attendees.clone(),
            meeting_link: value.meeting_link.clone(),
            status: value.status.clone(),
            color_id: value.color_id.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        google_calendar_list_events_from_cache, GoogleCalendarListEventsRequest,
        GoogleCalendarMcpEnvelope,
    };
    use crate::google_calendar::{CachedEvents, GoogleCalendarEvent};
    use chrono::Utc;

    fn sample_cache() -> CachedEvents {
        CachedEvents {
            events: vec![
                GoogleCalendarEvent {
                    id: "evt-1".to_string(),
                    summary: "Team sync".to_string(),
                    description: Some("Alice reviews priorities".to_string()),
                    start: Some("2026-03-29T09:00:00-05:00".to_string()),
                    end: Some("2026-03-29T09:30:00-05:00".to_string()),
                    location: Some("HQ".to_string()),
                    attendees: vec!["alice@example.com".to_string()],
                    meeting_link: Some("https://meet.example.com/sync".to_string()),
                    status: "confirmed".to_string(),
                    color_id: Some("1".to_string()),
                },
                GoogleCalendarEvent {
                    id: "evt-2".to_string(),
                    summary: "Company offsite".to_string(),
                    description: Some("All hands".to_string()),
                    start: Some("2026-03-30".to_string()),
                    end: Some("2026-03-31".to_string()),
                    location: Some("Austin".to_string()),
                    attendees: vec!["team@example.com".to_string()],
                    meeting_link: None,
                    status: "confirmed".to_string(),
                    color_id: Some("2".to_string()),
                },
                GoogleCalendarEvent {
                    id: "evt-3".to_string(),
                    summary: "Retro".to_string(),
                    description: Some("Cancelled meeting".to_string()),
                    start: Some("2026-03-31T16:00:00-05:00".to_string()),
                    end: Some("2026-03-31T17:00:00-05:00".to_string()),
                    location: Some("Remote".to_string()),
                    attendees: vec!["bob@example.com".to_string()],
                    meeting_link: Some("https://meet.example.com/retro".to_string()),
                    status: "cancelled".to_string(),
                    color_id: Some("3".to_string()),
                },
            ],
            last_updated: Utc::now(),
        }
    }

    fn list(request: GoogleCalendarListEventsRequest) -> GoogleCalendarMcpEnvelope {
        google_calendar_list_events_from_cache(Some(sample_cache()), request).unwrap()
    }

    #[test]
    fn google_calendar_list_events_filters_by_query() {
        let response = list(GoogleCalendarListEventsRequest {
            query: Some("alice".to_string()),
            ..GoogleCalendarListEventsRequest::default()
        });

        assert_eq!(response.matched_count, 1);
        assert_eq!(response.events[0].id, "evt-1");
    }

    #[test]
    fn google_calendar_list_events_filters_by_local_calendar_day() {
        let response = list(GoogleCalendarListEventsRequest {
            time_min: Some("2026-03-30".to_string()),
            time_max: Some("2026-03-30".to_string()),
            ..GoogleCalendarListEventsRequest::default()
        });

        assert_eq!(response.matched_count, 1);
        assert_eq!(response.events[0].id, "evt-2");
    }

    #[test]
    fn google_calendar_list_events_excludes_all_day_event_on_exclusive_end_date() {
        let response = list(GoogleCalendarListEventsRequest {
            time_min: Some("2026-03-31".to_string()),
            time_max: Some("2026-03-31".to_string()),
            ..GoogleCalendarListEventsRequest::default()
        });

        assert_eq!(response.matched_count, 0);
    }

    #[test]
    fn google_calendar_list_events_includes_events_that_overlap_the_requested_window() {
        let mut cache = sample_cache();
        cache.events.push(GoogleCalendarEvent {
            id: "evt-4".to_string(),
            summary: "Multi-day workshop".to_string(),
            description: Some("Spans the entire query window".to_string()),
            start: Some("2026-03-28T23:00:00-05:00".to_string()),
            end: Some("2026-03-30T01:00:00-05:00".to_string()),
            location: Some("Chicago".to_string()),
            attendees: vec!["team@example.com".to_string()],
            meeting_link: None,
            status: "confirmed".to_string(),
            color_id: Some("4".to_string()),
        });

        let response = google_calendar_list_events_from_cache(
            Some(cache),
            GoogleCalendarListEventsRequest {
                time_min: Some("2026-03-29".to_string()),
                time_max: Some("2026-03-29".to_string()),
                include_cancelled: Some(true),
                ..GoogleCalendarListEventsRequest::default()
            },
        )
        .unwrap();

        assert_eq!(response.matched_count, 2);
        assert!(response.events.iter().any(|event| event.id == "evt-1"));
        assert!(response.events.iter().any(|event| event.id == "evt-4"));
    }

    #[test]
    fn google_calendar_list_events_excludes_cancelled_by_default() {
        let response = list(GoogleCalendarListEventsRequest::default());

        assert_eq!(response.matched_count, 2);
        assert!(response.events.iter().all(|event| event.id != "evt-3"));
    }

    #[test]
    fn google_calendar_list_events_excludes_cancelled_when_requested() {
        let response = list(GoogleCalendarListEventsRequest {
            include_cancelled: Some(false),
            ..GoogleCalendarListEventsRequest::default()
        });

        assert_eq!(response.matched_count, 2);
        assert!(response.events.iter().all(|event| event.id != "evt-3"));
    }

    #[test]
    fn google_calendar_list_events_reports_truncation() {
        let response = list(GoogleCalendarListEventsRequest {
            include_cancelled: Some(true),
            max_results: Some(1),
            ..GoogleCalendarListEventsRequest::default()
        });

        assert_eq!(response.cache_event_count, 3);
        assert_eq!(response.matched_count, 3);
        assert_eq!(response.returned_count, 1);
        assert!(response.truncated);
    }

    #[test]
    fn google_calendar_list_events_skips_malformed_event_start_when_filtering() {
        let mut cache = sample_cache();
        cache.events[0].start = Some("not-a-date".to_string());

        let response = google_calendar_list_events_from_cache(
            Some(cache),
            GoogleCalendarListEventsRequest {
                include_cancelled: Some(true),
                time_min: Some("2026-03-29".to_string()),
                time_max: Some("2026-03-31".to_string()),
                ..GoogleCalendarListEventsRequest::default()
            },
        )
        .unwrap();

        assert_eq!(response.matched_count, 2);
        assert!(response.events.iter().all(|event| event.id != "evt-1"));
    }
}
