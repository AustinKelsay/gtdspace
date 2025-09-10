/**
 * @fileoverview Configuration manager for Google Calendar OAuth credentials.
 * This module uses Tauri's store plugin to save credentials to a local JSON file.
 * It does not use the OS keychain and does not encrypt data at rest, so the
 * stored credentials are accessible to the local user.
 */
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_store::{Store, StoreExt};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
}

pub struct GoogleConfigManager {
    store: Arc<Store<tauri::Wry>>,
}

impl GoogleConfigManager {
    pub fn new(app_handle: AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        // Create a store for Google OAuth config
        let store = app_handle
            .store("google-oauth-config.json")
            .map_err(|e| format!("Failed to create store: {}", e))?;

        Ok(Self { store })
    }

    /// Store Google OAuth configuration
    pub fn store_config(
        &self,
        config: &GoogleOAuthConfig,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Store as a single atomic operation
        self.store
            .set("oauth_config", serde_json::to_value(config)?);

        // Save the store to persist changes
        self.store
            .save()
            .map_err(|e| format!("Failed to save OAuth config: {}", e))?;

        println!("[GoogleConfigManager] OAuth configuration stored");
        Ok(())
    }

    /// Retrieve Google OAuth configuration from storage
    pub fn get_config(&self) -> Result<Option<GoogleOAuthConfig>, Box<dyn std::error::Error>> {
        // First try to get the new atomic config
        if let Some(config_value) = self.store.get("oauth_config") {
            let config: GoogleOAuthConfig = serde_json::from_value(config_value.clone())
                .map_err(|e| format!("Failed to deserialize OAuth config: {}", e))?;
            return Ok(Some(config));
        }

        // Fall back to legacy separate keys for backward compatibility
        let client_id = self.store.get("client_id");
        let client_secret = self.store.get("client_secret");

        match (client_id, client_secret) {
            (Some(id_value), Some(secret_value)) => {
                let client_id: String = serde_json::from_value(id_value.clone())
                    .map_err(|e| format!("Failed to deserialize client_id: {}", e))?;
                let client_secret: String = serde_json::from_value(secret_value.clone())
                    .map_err(|e| format!("Failed to deserialize client_secret: {}", e))?;

                let config = GoogleOAuthConfig {
                    client_id,
                    client_secret,
                };

                // Migrate to new format automatically
                println!(
                    "[GoogleConfigManager] Migrating OAuth configuration to new atomic format"
                );
                self.store
                    .set("oauth_config", serde_json::to_value(&config)?);
                // Clean up legacy keys
                self.store.delete("client_id");
                self.store.delete("client_secret");
                // Save the migration
                self.store
                    .save()
                    .map_err(|e| format!("Failed to save migrated OAuth config: {}", e))?;

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
        // Delete the new atomic config
        self.store.delete("oauth_config");
        // Also clean up legacy keys if they exist
        self.store.delete("client_id");
        self.store.delete("client_secret");

        // Save the store to persist changes
        self.store
            .save()
            .map_err(|e| format!("Failed to save after clearing OAuth config: {}", e))?;

        println!("[GoogleConfigManager] OAuth configuration cleared from storage");
        Ok(())
    }

    /// Check if OAuth configuration is stored
    pub fn has_config(&self) -> bool {
        // Check for new atomic config first
        if self.store.get("oauth_config").is_some() {
            return true;
        }
        // Fall back to checking legacy keys for backward compatibility
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
