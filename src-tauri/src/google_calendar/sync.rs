use chrono::{DateTime, Utc};
use google_calendar3::{
    hyper, hyper_rustls,
    CalendarHub,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use std::sync::atomic::{AtomicBool, Ordering};

use super::GoogleCalendarEvent;

// Default time window used when no explicit bounds are provided
const DEFAULT_SYNC_DAYS_PAST: i64 = 30;
const DEFAULT_SYNC_DAYS_FUTURE: i64 = 90;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedEvents {
    pub events: Vec<GoogleCalendarEvent>,
    pub last_updated: DateTime<Utc>,
}

pub struct CalendarSyncManager {
    app_handle: AppHandle,
    cached_events: Option<CachedEvents>,
    last_sync_time: Option<DateTime<Utc>>,
    is_syncing: AtomicBool,
}

impl CalendarSyncManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            cached_events: None,
            last_sync_time: None,
            is_syncing: AtomicBool::new(false),
        }
    }


    pub async fn sync_events(
        &mut self,
        hub: CalendarHub<hyper_rustls::HttpsConnector<hyper::client::HttpConnector>>,
        time_min: Option<DateTime<Utc>>,
        time_max: Option<DateTime<Utc>>,
    ) -> Result<Vec<GoogleCalendarEvent>, Box<dyn std::error::Error>> {
        if self.is_syncing.swap(true, Ordering::SeqCst) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Google Calendar sync already in progress",
            )
            .into());
        }
        let result: Result<Vec<GoogleCalendarEvent>, Box<dyn std::error::Error>> = (async {
            let mut all_events = Vec::new();

            // Get the primary calendar (we can extend this to multiple calendars later)
            let calendar_id = "primary";

            // Fetch events with pagination
            let mut page_token: Option<String> = None;
            loop {
                // Recreate the call for each page
                let mut call = hub
                    .events()
                    .list(calendar_id)
                    .single_events(true)
                    .order_by("startTime");
                
                // Re-apply time range
                if let Some(min) = time_min {
                    call = call.time_min(min);
                } else {
                    let default_min = Utc::now() - chrono::Duration::days(DEFAULT_SYNC_DAYS_PAST);
                    call = call.time_min(default_min);
                }
                
                if let Some(max) = time_max {
                    call = call.time_max(max);
                } else {
                    let default_max = Utc::now() + chrono::Duration::days(DEFAULT_SYNC_DAYS_FUTURE);
                    call = call.time_max(default_max);
                }
                
                if let Some(token) = &page_token {
                    call = call.page_token(token);
                }

                let (_, event_list) = call.doit().await?;

                if let Some(items) = event_list.items {
                    for event in items {
                        all_events.push(GoogleCalendarEvent::from(event));
                    }
                }

                // Check if there are more pages
                page_token = event_list.next_page_token;
                if page_token.is_none() {
                    break;
                }
            }

            // Update cache
            self.cached_events = Some(CachedEvents {
                events: all_events.clone(),
                last_updated: Utc::now(),
            });
            self.last_sync_time = Some(Utc::now());

            // Save cache to disk for persistence
            self.save_cache().await?;

            // Emit event to frontend
            self.app_handle
                .emit("google-calendar-synced", &all_events)
                .ok();

            Ok(all_events)
        }).await;

        // Always clear the syncing flag
        self.is_syncing.store(false, Ordering::SeqCst);
        // Return the inner result (success or error)
        result
    }

    pub async fn get_calendars(
        &self,
        hub: CalendarHub<hyper_rustls::HttpsConnector<hyper::client::HttpConnector>>,
    ) -> Result<Vec<CalendarInfo>, Box<dyn std::error::Error>> {
        let (_, calendar_list) = hub.calendar_list().list().doit().await?;

        let calendars = calendar_list
            .items
            .unwrap_or_default()
            .into_iter()
            .map(|cal| CalendarInfo {
                id: cal.id.unwrap_or_default(),
                summary: cal.summary.unwrap_or_else(|| "Unnamed Calendar".to_string()),
                description: cal.description,
                color_id: cal.color_id,
                selected: cal.selected.unwrap_or(false),
            })
            .collect();

        Ok(calendars)
    }

    pub fn get_cached_events(&self) -> Result<Vec<GoogleCalendarEvent>, Box<dyn std::error::Error>> {
        Ok(self
            .cached_events
            .as_ref()
            .map(|c| c.events.clone())
            .unwrap_or_default())
    }

    pub fn get_last_sync_time(&self) -> Option<DateTime<Utc>> {
        self.last_sync_time
    }

    pub fn is_syncing(&self) -> bool {
        self.is_syncing.load(Ordering::SeqCst)
    }

    async fn save_cache(&self) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(cache) = &self.cached_events {
            let app_dir = self
                .app_handle
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data directory: {}", e))?;

            // Ensure directory exists
            tokio::fs::create_dir_all(&app_dir).await?;

            let path = app_dir.join("google_calendar_cache.json");
            let json = serde_json::to_string_pretty(&cache)?;
            tokio::fs::write(&path, json).await?;
        }
        Ok(())
    }

    pub async fn load_cache(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let app_dir = self
            .app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data directory: {}", e))?;

        let path = app_dir.join("google_calendar_cache.json");

        if path.exists() {
            let content = tokio::fs::read_to_string(&path).await?;
            let cache: CachedEvents = serde_json::from_str(&content)?;
            self.cached_events = Some(cache.clone());
            self.last_sync_time = Some(cache.last_updated);
        }

        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarInfo {
    pub id: String,
    pub summary: String,
    pub description: Option<String>,
    pub color_id: Option<String>,
    pub selected: bool,
}