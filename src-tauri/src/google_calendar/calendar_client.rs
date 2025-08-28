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
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
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

    let mut all_events: Vec<CalendarEvent> = Vec::new();
    let mut page_token: Option<String> = None;
    let mut page_count = 0;
    const MAX_RESULTS_PER_PAGE: u32 = 250;

    // Loop through all pages
    loop {
        page_count += 1;
        println!("[CalendarClient] Fetching page {}...", page_count);

        let mut query_params = vec![
            ("timeMin".to_string(), time_min.to_rfc3339()),
            ("timeMax".to_string(), time_max.to_rfc3339()),
            ("singleEvents".to_string(), "true".to_string()),
            ("orderBy".to_string(), "startTime".to_string()),
            ("maxResults".to_string(), MAX_RESULTS_PER_PAGE.to_string()),
        ];

        // Add page token if we have one (for subsequent pages)
        if let Some(token) = &page_token {
            query_params.push(("pageToken".to_string(), token.clone()));
        }

        let response = client
            .get(url)
            .header(AUTHORIZATION, format!("Bearer {}", access_token))
            .query(&query_params)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(Box::new(std::io::Error::other(format!(
                "Failed to fetch events on page {}: {}",
                page_count, error_text
            ))));
        }

        let google_response: GoogleCalendarListResponse = response.json().await?;

        // Convert Google events to our format
        let page_events: Vec<CalendarEvent> = google_response
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

        println!(
            "[CalendarClient] Page {} returned {} events",
            page_count,
            page_events.len()
        );
        all_events.extend(page_events);

        // Check if there are more pages
        match google_response.next_page_token {
            Some(token) => {
                page_token = Some(token);
                println!("[CalendarClient] More pages available, continuing...");
            }
            None => {
                println!("[CalendarClient] No more pages, pagination complete");
                break;
            }
        }

        // Safety limit to prevent infinite loops (Google Calendar API has a max of 2500 events per query)
        if page_count > 10 {
            println!("[CalendarClient] Warning: Reached maximum page limit, stopping pagination");
            break;
        }
    }

    println!(
        "[CalendarClient] Total events fetched: {}",
        all_events.len()
    );
    Ok(all_events)
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
