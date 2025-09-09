use chrono::{DateTime, Utc};
use google_calendar3::api::Event;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

pub mod auth;
pub mod calendar_client;
pub mod config_manager;
pub mod oauth_server;
pub mod simple_auth;
pub mod storage;
pub mod sync;
pub mod token_manager;

use auth::GoogleAuthManager;
use storage::TokenStorage;
use sync::CalendarSyncManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleCalendarEvent {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleCalendarConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub auth_uri: String,
    pub token_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub is_connected: bool,
    pub last_sync: Option<DateTime<Utc>>,
    pub sync_in_progress: bool,
    pub error: Option<String>,
}

pub struct GoogleCalendarManager {
    auth_manager: Arc<Mutex<GoogleAuthManager>>,
    sync_manager: Arc<Mutex<CalendarSyncManager>>,
    token_storage: Arc<TokenStorage>,
    #[allow(dead_code)]
    config: GoogleCalendarConfig,
}

impl GoogleCalendarManager {
    pub async fn new(
        app_handle: tauri::AppHandle,
        client_id: String,
        client_secret: String,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let config = GoogleCalendarConfig {
            client_id: client_id.clone(),
            client_secret: client_secret.clone(),
            redirect_uri: "http://localhost:9898/callback".to_string(),
            auth_uri: "https://accounts.google.com/o/oauth2/auth".to_string(),
            token_uri: "https://oauth2.googleapis.com/token".to_string(),
        };

        let token_storage = Arc::new(TokenStorage::new(app_handle.clone()));
        let auth_manager = Arc::new(Mutex::new(
            GoogleAuthManager::new(config.clone(), token_storage.clone()).await?,
        ));
        let sync_manager = Arc::new(Mutex::new(CalendarSyncManager::new(app_handle.clone())));

        Ok(Self {
            auth_manager,
            sync_manager,
            token_storage,
            config,
        })
    }

    pub async fn connect(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut auth = self.auth_manager.lock().await;
        auth.authenticate().await?;
        Ok(())
    }

    pub async fn disconnect(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut auth = self.auth_manager.lock().await;
        auth.revoke_token().await?;
        self.token_storage.delete_token().await?;
        Ok(())
    }

    pub async fn sync_events(
        &self,
        time_min: Option<DateTime<Utc>>,
        time_max: Option<DateTime<Utc>>,
    ) -> Result<Vec<GoogleCalendarEvent>, Box<dyn std::error::Error>> {
        // Get the hub while holding the auth lock
        let hub = {
            let auth = self.auth_manager.lock().await;
            auth.get_calendar_hub().await?
        }; // auth lock is dropped here

        // Now acquire the sync lock without holding auth lock
        let mut sync = self.sync_manager.lock().await;
        sync.sync_events(hub, time_min, time_max).await
    }

    pub async fn get_status(&self) -> Result<SyncStatus, Box<dyn std::error::Error>> {
        let auth = self.auth_manager.lock().await;
        let sync = self.sync_manager.lock().await;

        Ok(SyncStatus {
            is_connected: auth.is_authenticated().await,
            last_sync: sync.get_last_sync_time(),
            sync_in_progress: sync.is_syncing(),
            error: None,
        })
    }

    pub async fn get_cached_events(
        &self,
    ) -> Result<Vec<GoogleCalendarEvent>, Box<dyn std::error::Error>> {
        let sync = self.sync_manager.lock().await;
        sync.get_cached_events()
    }
}

impl From<Event> for GoogleCalendarEvent {
    fn from(event: Event) -> Self {
        let start = event.start.and_then(|s| {
            s.date_time
                .map(|dt| dt.to_rfc3339())
                .or_else(|| s.date.map(|d| d.to_string()))
        });
        let end = event.end.and_then(|e| {
            e.date_time
                .map(|dt| dt.to_rfc3339())
                .or_else(|| e.date.map(|d| d.to_string()))
        });

        let attendees = event
            .attendees
            .unwrap_or_default()
            .iter()
            .filter_map(|a| a.email.clone())
            .collect();

        let meeting_link = event.conference_data.as_ref().and_then(|cd| {
            cd.entry_points.as_ref().and_then(|eps| {
                eps.iter()
                    .find(|ep| ep.entry_point_type == Some("video".to_string()))
                    .and_then(|ep| ep.uri.clone())
            })
        });

        GoogleCalendarEvent {
            id: event.id.unwrap_or_default(),
            summary: event
                .summary
                .unwrap_or_else(|| "Untitled Event".to_string()),
            description: event.description,
            start,
            end,
            location: event.location,
            attendees,
            meeting_link,
            status: event.status.unwrap_or_else(|| "confirmed".to_string()),
            color_id: event.color_id,
        }
    }
}
