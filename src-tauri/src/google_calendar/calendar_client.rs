use reqwest::header::AUTHORIZATION;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: String,
    pub summary: String,
    pub description: Option<String>,
    pub start: Option<String>,
    pub end: Option<String>,
    pub location: Option<String>,
    pub meeting_link: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GoogleCalendarListResponse {
    items: Vec<GoogleCalendarEvent>,
}

#[derive(Debug, Deserialize)]
struct GoogleCalendarEvent {
    id: String,
    summary: Option<String>,
    description: Option<String>,
    location: Option<String>,
    start: Option<EventDateTime>,
    end: Option<EventDateTime>,
    #[serde(rename = "hangoutLink")]
    hangout_link: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EventDateTime {
    #[serde(rename = "dateTime")]
    date_time: Option<String>,
    date: Option<String>,
}

pub async fn fetch_calendar_events(
    access_token: &str,
) -> Result<Vec<CalendarEvent>, Box<dyn std::error::Error>> {
    println!("[CalendarClient] Fetching calendar events...");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?;

    // Calculate time range (last 30 days to next 90 days)
    let time_min = chrono::Utc::now() - chrono::Duration::days(30);
    let time_max = chrono::Utc::now() + chrono::Duration::days(90);

    // Build URL with proper query parameters
    let url = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

    println!("[CalendarClient] Request URL: {}", url);
    println!(
        "[CalendarClient] Time range: {} to {}",
        time_min.to_rfc3339(),
        time_max.to_rfc3339()
    );

    let response = client
        .get(url)
        .header(AUTHORIZATION, format!("Bearer {}", access_token))
        .query(&[
            ("timeMin", time_min.to_rfc3339()),
            ("timeMax", time_max.to_rfc3339()),
            ("singleEvents", "true".to_string()),
            ("orderBy", "startTime".to_string()),
            ("maxResults", "250".to_string()),
        ])
        .send()
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await?;
        return Err(Box::new(std::io::Error::other(format!(
            "Failed to fetch events: {}",
            error_text
        ))));
    }

    let google_response: GoogleCalendarListResponse = response.json().await?;

    // Convert Google events to our format
    let events: Vec<CalendarEvent> = google_response
        .items
        .into_iter()
        .map(|event| {
            let start = event.start.and_then(|s| s.date_time.or(s.date));
            let end = event.end.and_then(|e| e.date_time.or(e.date));

            CalendarEvent {
                id: event.id,
                summary: event
                    .summary
                    .unwrap_or_else(|| "Untitled Event".to_string()),
                description: event.description,
                start,
                end,
                location: event.location,
                meeting_link: event.hangout_link,
            }
        })
        .collect();

    println!("[CalendarClient] Fetched {} events", events.len());
    Ok(events)
}

// Async wrapper for consistent API
#[allow(dead_code)]
pub async fn fetch_events_async(
    access_token: &str,
) -> Result<Vec<CalendarEvent>, Box<dyn std::error::Error + Send + Sync>> {
    fetch_calendar_events(access_token).await.map_err(
        |e| -> Box<dyn std::error::Error + Send + Sync> {
            Box::new(std::io::Error::other(e.to_string()))
        },
    )
}
