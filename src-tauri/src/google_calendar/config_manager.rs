//! Configuration manager for Google Calendar OAuth credentials.
//!
//! The client ID is stored in Tauri's plugin store, while the client secret is
//! persisted in the OS-backed secure storage via `keyring`.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreExt};

const GOOGLE_CALENDAR_SECURE_STORAGE_SERVICE: &str = "com.gtdspace.app";
const GOOGLE_CALENDAR_CLIENT_SECRET_KEY: &str = "google_calendar_client_secret";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredGoogleOAuthConfig {
    client_id: String,
}

pub struct GoogleConfigManager {
    store: Arc<Store<tauri::Wry>>,
}

impl GoogleConfigManager {
    fn client_secret_entry(&self) -> Result<keyring::Entry, Box<dyn std::error::Error>> {
        keyring::Entry::new(
            GOOGLE_CALENDAR_SECURE_STORAGE_SERVICE,
            GOOGLE_CALENDAR_CLIENT_SECRET_KEY,
        )
        .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)
    }

    pub fn new(app_handle: AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        // Create a store for Google OAuth config
        let store = app_handle
            .store("google-oauth-config.json")
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

        Ok(Self { store })
    }

    /// Store Google OAuth configuration
    pub fn store_config(
        &self,
        config: &GoogleOAuthConfig,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let stored_config = StoredGoogleOAuthConfig {
            client_id: config.client_id.clone(),
        };
        self.store
            .set("oauth_config", serde_json::to_value(&stored_config)?);

        self.store
            .save()
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
        self.client_secret_entry()?
            .set_password(&config.client_secret)?;

        println!("[GoogleConfigManager] OAuth configuration stored");
        Ok(())
    }

    /// Retrieve Google OAuth configuration from storage
    pub fn get_config(&self) -> Result<Option<GoogleOAuthConfig>, Box<dyn std::error::Error>> {
        let secure_secret = match self.client_secret_entry()?.get_password() {
            Ok(secret) => Some(secret),
            Err(keyring::Error::NoEntry) => None,
            Err(error) => return Err(Box::new(error)),
        };

        if let Some(config_value) = self.store.get("oauth_config") {
            if let Ok(config) =
                serde_json::from_value::<StoredGoogleOAuthConfig>(config_value.clone())
            {
                if let Some(client_secret) = secure_secret {
                    return Ok(Some(GoogleOAuthConfig {
                        client_id: config.client_id,
                        client_secret,
                    }));
                }
                return Ok(None);
            }

            let legacy_config: GoogleOAuthConfig = serde_json::from_value(config_value.clone())?;
            self.store_config(&legacy_config)?;
            return Ok(Some(legacy_config));
        }

        let client_id = self.store.get("client_id");
        let client_secret = self.store.get("client_secret");

        match (client_id, client_secret) {
            (Some(id_value), Some(secret_value)) => {
                let client_id: String = serde_json::from_value(id_value.clone())?;
                let client_secret: String = serde_json::from_value(secret_value.clone())?;

                let config = GoogleOAuthConfig {
                    client_id,
                    client_secret,
                };

                self.store_config(&config)?;
                self.store.delete("client_id");
                self.store.delete("client_secret");
                self.store
                    .save()
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

                Ok(Some(config))
            }
            _ => {
                println!("[GoogleConfigManager] No OAuth configuration found in storage");
                Ok(None)
            }
        }
    }

    /// Clear Google OAuth configuration from storage
    pub fn clear_config(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.store.delete("oauth_config");
        self.store.delete("client_id");
        self.store.delete("client_secret");
        match self.client_secret_entry()?.delete_password() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(error) => return Err(Box::new(error)),
        }

        self.store
            .save()
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

        println!("[GoogleConfigManager] OAuth configuration cleared from storage");
        Ok(())
    }

    /// Check if OAuth configuration is stored
    pub fn has_config(&self) -> bool {
        let has_secure_secret = match self.client_secret_entry() {
            Ok(entry) => entry
                .get_password()
                .map(|value| !value.is_empty())
                .unwrap_or(false),
            Err(_) => false,
        };

        if self.store.get("oauth_config").is_some() {
            return has_secure_secret;
        }
        self.store.get("client_id").is_some() && self.store.get("client_secret").is_some()
    }

    /// Validate OAuth configuration (basic validation)
    pub fn validate_config(config: &GoogleOAuthConfig) -> Result<(), Box<dyn std::error::Error>> {
        if config.client_id.is_empty() {
            return Err("Client ID cannot be empty".into());
        }

        if config.client_secret.is_empty() {
            return Err("Client secret cannot be empty".into());
        }

        // Basic format validation for Google OAuth client ID
        if !config.client_id.ends_with(".apps.googleusercontent.com") {
            return Err("Client ID must be a valid Google OAuth client ID (ending with .apps.googleusercontent.com)".into());
        }

        Ok(())
    }
}
