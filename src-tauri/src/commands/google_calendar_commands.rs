//! Tauri commands that wrap the Google Calendar integration module.

use crate::google_calendar::{GoogleCalendarEvent, GoogleCalendarManager, SyncStatus};
use lazy_static::lazy_static;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::Mutex as TokioMutex;

lazy_static! {
    static ref GOOGLE_CALENDAR_MANAGER: TokioMutex<Option<Arc<GoogleCalendarManager>>> =
        TokioMutex::new(None);
}

async fn get_or_init_google_calendar_manager(
    app: AppHandle,
) -> Result<Arc<GoogleCalendarManager>, String> {
    let mut manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;

    if let Some(manager) = manager_guard.as_ref() {
        return Ok(manager.clone());
    }

    println!("[GoogleCalendar] Attempting to initialize Google Calendar manager...");

    let (client_id, client_secret) = load_google_oauth_credentials(app.clone())?;
    println!("[GoogleCalendar] Credentials loaded successfully");

    let manager = Arc::new(
        GoogleCalendarManager::new(app, client_id, client_secret)
            .await
            .map_err(|e| {
                println!("[GoogleCalendar] Failed to create manager: {}", e);
                format!("Failed to create Google Calendar manager: {}", e)
            })?,
    );

    *manager_guard = Some(manager.clone());
    println!("[GoogleCalendar] Manager initialized successfully");
    Ok(manager)
}

async fn clear_google_calendar_manager() {
    let mut manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;
    *manager_guard = None;
}

/// Helper function to load Google OAuth credentials from secure storage or environment variables.
///
/// This function consolidates the credential loading logic used across multiple commands.
/// It first attempts to load from secure storage (for production use), then falls back to
/// environment variables (for development).
///
/// # Returns
///
/// A tuple of (client_id, client_secret) on success, or an error message
fn load_google_oauth_credentials(app: AppHandle) -> Result<(String, String), String> {
    use crate::google_calendar::config_manager::GoogleConfigManager;

    let config_manager = GoogleConfigManager::new(app.clone())
        .map_err(|e| format!("Failed to create config manager: {}", e))?;

    match config_manager.get_config() {
        Ok(Some(config)) => {
            println!("[GoogleCalendar] Using stored OAuth configuration");
            Ok((config.client_id, config.client_secret))
        }
        Ok(None) => {
            // Fallback to environment variables for development
            println!("[GoogleCalendar] No stored config found, trying environment variables...");
            println!(
                "[GoogleCalendar] Working directory: {:?}",
                std::env::current_dir()
            );

            // Try to load .env file manually from the project root for development
            let env_path = std::env::current_dir()
                .map(|mut p| {
                    // Go up from src-tauri if we're there
                    if p.ends_with("src-tauri") {
                        p.pop();
                    }
                    p.push(".env");
                    p
                })
                .ok();

            if let Some(path) = &env_path {
                println!("[GoogleCalendar] Looking for .env file at: {:?}", path);
                if path.exists() {
                    println!("[GoogleCalendar] .env file found, loading...");
                    dotenv::from_path(path).ok();
                } else {
                    println!("[GoogleCalendar] .env file not found at {:?}", path);
                }
            }

            let client_id = std::env::var("GOOGLE_CALENDAR_CLIENT_ID")
                .or_else(|_| std::env::var("VITE_GOOGLE_CALENDAR_CLIENT_ID"))
                .map_err(|_| {
                    #[cfg(debug_assertions)]
                    {
                        println!("[GoogleCalendar] Failed to get client ID from environment");
                        println!("[GoogleCalendar] Available GOOGLE/VITE env vars (keys only):");
                        for key in std::env::vars().map(|(k, _)| k) {
                            if key.contains("GOOGLE") || key.contains("VITE") {
                                println!("  {} = <redacted>", key);
                            }
                        }
                    }
                    "Google Calendar client ID not found. Please configure OAuth credentials in Settings.".to_string()
                })?;

            let client_secret = std::env::var("GOOGLE_CALENDAR_CLIENT_SECRET")
                .or_else(|_| std::env::var("VITE_GOOGLE_CALENDAR_CLIENT_SECRET"))
                .map_err(|_| {
                    #[cfg(debug_assertions)]
                    {
                        println!("[GoogleCalendar] Failed to get client secret from environment");
                    }
                    "Google Calendar client secret not found. Please configure OAuth credentials in Settings.".to_string()
                })?;

            println!("[GoogleCalendar] Using environment variables (development mode)");
            Ok((client_id, client_secret))
        }
        Err(e) => Err(format!("Failed to load OAuth configuration: {}", e)),
    }
}

// Simple test command to verify Tauri is working
#[cfg(debug_assertions)]
#[tauri::command]
pub fn google_calendar_test() -> Result<String, String> {
    println!("[GoogleCalendar] TEST COMMAND CALLED!");

    // Check if environment variables are present
    let has_client_id = std::env::var("GOOGLE_CALENDAR_CLIENT_ID").is_ok();
    let has_client_secret = std::env::var("GOOGLE_CALENDAR_CLIENT_SECRET").is_ok();

    let message = format!(
        "Test successful! Credentials present: {}",
        has_client_id && has_client_secret
    );

    println!("[GoogleCalendar] {}", message);
    Ok(message)
}

/// Legacy Google Calendar auth command.
///
/// This `#[tauri::command]` returns `Result<String, String>` for compatibility,
/// but the old OAuth flow is disabled. Callers should use the newer Connect flow instead.
#[tauri::command]
pub async fn google_calendar_start_auth(_app: AppHandle) -> Result<String, String> {
    Err("Legacy OAuth flow disabled; use Connect to start auth".to_string())
}

// Async test command to verify async commands work
#[cfg(debug_assertions)]
#[tauri::command]
pub async fn google_calendar_test_async() -> Result<String, String> {
    println!("[GoogleCalendar] ASYNC TEST COMMAND CALLED!");

    // Simple async delay
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    println!("[GoogleCalendar] ASYNC TEST COMPLETED!");
    Ok("Async test successful!".to_string())
}

/// Check if the user is authenticated with Google Calendar.
///
/// This is a synchronous wrapper to avoid async/AppHandle issues.
/// Checks whether a stored token file exists.
///
/// # Returns
///
/// - `true` if a stored token file exists
/// - `false` if no tokens found or error occurred
#[tauri::command]
pub fn google_calendar_is_authenticated(app: AppHandle) -> Result<bool, String> {
    use crate::google_calendar::storage::TokenStorage;

    // Create token storage instance
    let token_storage = TokenStorage::new(app);

    // Check if token file exists
    let token_path = token_storage.get_token_path();
    let is_authenticated = token_path.exists();

    println!(
        "[GoogleCalendar] Authentication check: token file exists = {}",
        is_authenticated
    );
    Ok(is_authenticated)
}

/// Fetch Google Calendar events for the user.
///
/// Async command that fetches events using the ambient Tokio runtime.
///
/// # Implementation Details
///
/// Uses the existing runtime; no ad-hoc runtime creation or blocking occurs.
///
/// # Returns
///
/// Vector of calendar events or error message
#[tauri::command]
pub async fn google_calendar_fetch_events(
    app: AppHandle,
) -> Result<Vec<GoogleCalendarEvent>, String> {
    println!("[GoogleCalendar] Fetching calendar events (async command)...");

    let manager = get_or_init_google_calendar_manager(app).await?;

    // Sync events using the manager
    let events = manager
        .sync_events(None, None)
        .await
        .map_err(|e| format!("Failed to fetch Google Calendar events: {}", e))?;

    println!(
        "[GoogleCalendar] Successfully fetched {} events",
        events.len()
    );
    Ok(events)
}

#[tauri::command]
pub async fn google_calendar_connect(app: AppHandle) -> Result<String, String> {
    println!("[GoogleCalendar] ========================================");
    println!(
        "[GoogleCalendar] Connect command called at {:?}",
        std::time::SystemTime::now()
    );
    println!("[GoogleCalendar] ========================================");

    // Try to load credentials from storage or environment
    // The load_google_oauth_credentials function will:
    // 1. First check stored credentials from Settings UI
    // 2. Fall back to environment variables for development
    // This ensures production builds work with stored credentials
    println!("[GoogleCalendar] Checking for OAuth credentials...");

    let manager = get_or_init_google_calendar_manager(app).await?;

    println!("[GoogleCalendar] Calling manager.connect()...");
    manager.connect().await.map_err(|e| {
        println!("[GoogleCalendar] Connect failed: {}", e);
        format!("Failed to connect to Google Calendar: {}", e)
    })?;

    println!("[GoogleCalendar] Successfully connected!");
    Ok("Successfully connected to Google Calendar".to_string())
}

/// Disconnect from Google Calendar by removing stored tokens.
///
/// This is a synchronous wrapper to avoid async/AppHandle issues.
/// Securely deletes the stored OAuth tokens, effectively logging the user out.
///
/// # Security
///
/// Uses secure deletion to remove tokens from disk storage.
///
/// # Returns
///
/// Success message or error if token deletion fails
#[tauri::command]
pub async fn google_calendar_disconnect_simple(app: AppHandle) -> Result<String, String> {
    use crate::google_calendar::token_manager::TokenManager;

    println!("[GoogleCalendar] Disconnecting...");

    tokio::task::spawn_blocking(move || {
        let token_manager = TokenManager::new(app).map_err(|e| e.to_string())?;
        token_manager.delete_tokens().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Failed to disconnect Google Calendar: {}", e))??;
    clear_google_calendar_manager().await;

    println!("[GoogleCalendar] Tokens deleted, disconnected successfully");
    Ok("Successfully disconnected from Google Calendar".to_string())
}

#[tauri::command]
pub async fn google_calendar_disconnect() -> Result<String, String> {
    let manager = {
        let manager_guard = GOOGLE_CALENDAR_MANAGER.lock().await;
        manager_guard
            .as_ref()
            .ok_or_else(|| "Google Calendar manager not initialized".to_string())?
            .clone()
    };

    manager
        .disconnect()
        .await
        .map_err(|e| format!("Failed to disconnect from Google Calendar: {}", e))?;
    clear_google_calendar_manager().await;

    Ok("Successfully disconnected from Google Calendar".to_string())
}

#[tauri::command]
pub async fn google_calendar_sync(app: AppHandle) -> Result<Vec<GoogleCalendarEvent>, String> {
    let manager = get_or_init_google_calendar_manager(app).await?;

    let events = manager
        .sync_events(None, None)
        .await
        .map_err(|e| format!("Failed to sync Google Calendar events: {}", e))?;

    Ok(events)
}

#[tauri::command]
pub async fn google_calendar_get_status(app: AppHandle) -> Result<SyncStatus, String> {
    let manager = get_or_init_google_calendar_manager(app).await?;

    let status = manager
        .get_status()
        .await
        .map_err(|e| format!("Failed to get Google Calendar status: {}", e))?;

    Ok(status)
}

#[tauri::command]
pub async fn google_calendar_get_cached_events(
    app: AppHandle,
) -> Result<Vec<GoogleCalendarEvent>, String> {
    let manager = get_or_init_google_calendar_manager(app).await?;

    let events = manager
        .get_cached_events()
        .await
        .map_err(|e| format!("Failed to get cached Google Calendar events: {}", e))?;

    Ok(events)
}

// ===== GOOGLE CALENDAR OAUTH CONFIGURATION =====

/// Store Google OAuth configuration
///
/// Persists client ID and client secret via `tauri-plugin-store` to a local JSON file.
/// Note: not encrypted at rest; treat as user-local secrets.
///
/// # Arguments
///
/// * `client_id` - Google OAuth client ID
/// * `client_secret` - Google OAuth client secret
///
/// # Returns
///
/// Success message or error details
#[tauri::command]
pub async fn google_oauth_store_config(
    app: AppHandle,
    client_id: String,
    client_secret: String,
) -> Result<String, String> {
    use crate::google_calendar::config_manager::{GoogleConfigManager, GoogleOAuthConfig};

    let config_manager = GoogleConfigManager::new(app)
        .map_err(|e| format!("Failed to create config manager: {}", e))?;

    let oauth_config = GoogleOAuthConfig {
        client_id,
        client_secret,
    };

    // Validate configuration before storing
    GoogleConfigManager::validate_config(&oauth_config)
        .map_err(|e| format!("Invalid configuration: {}", e))?;

    // Store configuration
    config_manager
        .store_config(&oauth_config)
        .map_err(|e| format!("Failed to store configuration: {}", e))?;
    clear_google_calendar_manager().await;

    Ok("Google OAuth configuration saved".to_string())
}

/// Retrieve Google OAuth configuration from storage
///
/// Attempts to load the stored OAuth configuration from the local JSON store.
/// Returns null if no configuration is found.
///
/// # Returns
///
/// OAuth configuration object or null if not found
#[tauri::command]
pub async fn google_oauth_get_config(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    use crate::google_calendar::config_manager::GoogleConfigManager;

    let config_manager = GoogleConfigManager::new(app)
        .map_err(|e| format!("Failed to create config manager: {}", e))?;

    match config_manager.get_config() {
        Ok(Some(config)) => {
            // Return config as JSON value for frontend consumption
            // Never expose the actual client_secret to the frontend
            let json_config = serde_json::json!({
                "client_id": config.client_id,
                "has_secret": !config.client_secret.is_empty()
            });
            Ok(Some(json_config))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Failed to retrieve configuration: {}", e)),
    }
}

/// Clear Google OAuth configuration from storage
///
/// Removes all stored OAuth configuration from the local JSON store.
/// This will require the user to re-enter their credentials.
///
/// # Returns
///
/// Success message or error details
#[tauri::command]
pub async fn google_oauth_clear_config(app: AppHandle) -> Result<String, String> {
    use crate::google_calendar::config_manager::GoogleConfigManager;

    let config_manager = GoogleConfigManager::new(app)
        .map_err(|e| format!("Failed to create config manager: {}", e))?;

    config_manager
        .clear_config()
        .map_err(|e| format!("Failed to clear configuration: {}", e))?;
    clear_google_calendar_manager().await;

    Ok("Google OAuth configuration cleared".to_string())
}

/// Check if Google OAuth configuration exists in storage
///
/// Quick check to determine if the user has configured OAuth credentials
/// in the local JSON store. Used by the UI to decide whether to show
/// configuration prompts.
///
/// # Returns
///
/// True if configuration exists, false otherwise
#[tauri::command]
pub async fn google_oauth_has_config(app: AppHandle) -> Result<bool, String> {
    use crate::google_calendar::config_manager::GoogleConfigManager;

    let config_manager = GoogleConfigManager::new(app)
        .map_err(|e| format!("Failed to create config manager: {}", e))?;

    Ok(config_manager.has_config())
}
