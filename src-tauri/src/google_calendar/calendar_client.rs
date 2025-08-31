use rand::Rng;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::sleep;

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
    #[serde(default)]
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
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

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

        let google_response: GoogleCalendarListResponse =
            get_with_retries(&client, url, access_token, &query_params, page_count).await?;

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
            #[allow(clippy::all)]
            Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                e.to_string(),
            ))
        },
    )
}

/// Executes an HTTP GET with bounded retries, exponential backoff, and jitter.
/// Retries on HTTP 429, any 5xx, and transient network errors (connect/timeouts).
async fn get_with_retries(
    client: &reqwest::Client,
    url: &str,
    access_token: &str,
    query_params: &[(String, String)],
    page_count: u32,
) -> Result<GoogleCalendarListResponse, Box<dyn std::error::Error>> {
    let max_attempts: u32 = 5;
    let base_delay_ms: u64 = 300;

    for attempt in 1..=max_attempts {
        let req = client
            .get(url)
            .bearer_auth(access_token)
            .query(query_params);

        match req.send().await {
            Ok(resp) => {
                let status = resp.status();
                if status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error() {
                    if attempt == max_attempts {
                        println!(
                            "[CalendarClient] Final failure (status {}) on page {} after {} attempts",
                            status,
                            page_count,
                            attempt
                        );
                        return Err(Box::new(std::io::Error::other(
                            format!(
                                "Failed to fetch events on page {}: HTTP status {}",
                                page_count, status
                            ),
                        )));
                    }

                    let backoff_ms = base_delay_ms.saturating_mul(1u64 << (attempt - 1));
                    let jitter_ms: u64 = rand::thread_rng().gen_range(0..=backoff_ms / 2 + 1);
                    let sleep_ms = backoff_ms + jitter_ms;
                    println!(
                        "[CalendarClient] Retry {} due to HTTP {} on page {}. Sleeping {} ms...",
                        attempt, status, page_count, sleep_ms
                    );
                    sleep(Duration::from_millis(sleep_ms)).await;
                    continue;
                }

                // Status is OK or other non-retryable 4xx
                match resp.json::<GoogleCalendarListResponse>().await {
                    Ok(parsed) => return Ok(parsed),
                    Err(e) => {
                        // Retry on transient network read errors
                        let is_transient = e.is_timeout() || e.is_connect();
                        if is_transient && attempt < max_attempts {
                            let backoff_ms = base_delay_ms.saturating_mul(1u64 << (attempt - 1));
                            let jitter_ms: u64 =
                                rand::thread_rng().gen_range(0..=backoff_ms / 2 + 1);
                            let sleep_ms = backoff_ms + jitter_ms;
                            println!(
                                "[CalendarClient] Retry {} due to body/network error on page {}: {}. Sleeping {} ms...",
                                attempt, page_count, e, sleep_ms
                            );
                            sleep(Duration::from_millis(sleep_ms)).await;
                            continue;
                        }
                        if is_transient {
                            println!(
                                "[CalendarClient] Final failure parsing response on page {} after {} attempts: {}",
                                page_count, attempt, e
                            );
                        }
                        return Err(Box::new(e) as Box<dyn std::error::Error>);
                    }
                }
            }
            Err(e) => {
                let mut retryable = e.is_timeout() || e.is_connect();
                if let Some(status) = e.status() {
                    retryable = retryable
                        || status == StatusCode::TOO_MANY_REQUESTS
                        || status.is_server_error();
                }

                if retryable && attempt < max_attempts {
                    let backoff_ms = base_delay_ms.saturating_mul(1u64 << (attempt - 1));
                    let jitter_ms: u64 = rand::thread_rng().gen_range(0..=backoff_ms / 2 + 1);
                    let sleep_ms = backoff_ms + jitter_ms;
                    println!(
                        "[CalendarClient] Retry {} due to network error on page {}: {}. Sleeping {} ms...",
                        attempt, page_count, e, sleep_ms
                    );
                    sleep(Duration::from_millis(sleep_ms)).await;
                    continue;
                }

                if retryable {
                    println!(
                        "[CalendarClient] Final failure (network) on page {} after {} attempts: {}",
                        page_count, attempt, e
                    );
                }
                return Err(Box::new(e) as Box<dyn std::error::Error>);
            }
        }
    }

    // Should be unreachable
    Err(Box::new(std::io::Error::other(
        format!(
            "Failed to fetch events on page {} after retries (unexpected fallthrough)",
            page_count
        ),
    )))
}
