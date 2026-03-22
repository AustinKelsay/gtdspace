//! Settings persistence and secure storage commands.

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;
use tauri_plugin_store::StoreBuilder;
use tokio::sync::Mutex as TokioMutex;

const SECURE_STORAGE_SERVICE: &str = "com.gtdspace.app";
const GIT_SYNC_ENCRYPTION_KEY_NAME: &str = "git_sync_encryption_key";
static SETTINGS_LOCK: Lazy<TokioMutex<()>> = Lazy::new(|| TokioMutex::new(()));

#[cfg(test)]
fn load_git_sync_encryption_key() -> Option<String> {
    None
}

fn default_settings_with_secure_key() -> UserSettings {
    let mut settings = get_default_settings();
    settings.git_sync_encryption_key = load_git_sync_encryption_key();
    settings
}

fn sync_git_sync_encryption_key(settings: &UserSettings) -> Result<(), String> {
    sync_git_sync_encryption_key_value(settings.git_sync_encryption_key.as_deref())
}

fn sync_git_sync_encryption_key_value(value: Option<&str>) -> Result<(), String> {
    let entry = keyring::Entry::new(SECURE_STORAGE_SERVICE, GIT_SYNC_ENCRYPTION_KEY_NAME)
        .map_err(|error| format!("Failed to access secure storage: {}", error))?;

    let value_to_store = value.filter(|candidate| !candidate.trim().is_empty());

    match value_to_store {
        Some(value) => entry
            .set_password(value)
            .map_err(|error| format!("Failed to store encryption key securely: {}", error)),
        None => match entry.delete_password() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!(
                "Failed to remove encryption key from secure storage: {}",
                error
            )),
        },
    }
}

fn restore_user_settings_value(
    store: &std::sync::Arc<tauri_plugin_store::Store<tauri::Wry>>,
    previous_value: Option<serde_json::Value>,
) {
    if let Some(value) = previous_value {
        store.set("user_settings", value);
    } else {
        store.delete("user_settings");
    }
}

#[cfg(not(test))]
fn load_git_sync_encryption_key() -> Option<String> {
    match keyring::Entry::new(SECURE_STORAGE_SERVICE, GIT_SYNC_ENCRYPTION_KEY_NAME) {
        Ok(entry) => match entry.get_password() {
            Ok(password) => Some(password),
            Err(keyring::Error::NoEntry) => None,
            Err(error) => {
                log::error!(
                    "Failed to load git sync encryption key from secure storage: {}",
                    error
                );
                None
            }
        },
        Err(error) => {
            log::error!("Failed to access git sync secure storage entry: {}", error);
            None
        }
    }
}

/// User settings structure for persistence
#[derive(Serialize, Deserialize, Clone)]
pub struct UserSettings {
    /// Theme preference: 'light', 'dark', or 'system'
    pub theme: String,
    /// Editor font size in pixels
    pub font_size: u32,
    /// Tab size for indentation
    pub tab_size: u32,
    /// Whether to wrap long lines
    pub word_wrap: bool,
    /// Preferred editor font family token
    #[serde(default = "default_font_family")]
    pub font_family: String,
    /// Editor line height multiplier
    #[serde(default = "default_line_height")]
    pub line_height: f32,
    /// Customizable keyboard shortcut map
    #[serde(default = "default_keybindings")]
    pub keybindings: HashMap<String, String>,
    /// Last opened folder path
    pub last_folder: Option<String>,
    /// Editor mode preference
    pub editor_mode: String,
    /// Window width (for future use)
    pub window_width: Option<u32>,
    /// Window height (for future use)
    pub window_height: Option<u32>,
    /// Maximum number of tabs to keep open
    #[serde(default)]
    pub max_tabs: Option<u32>,
    /// Whether to restore tabs on startup
    #[serde(default)]
    pub restore_tabs: Option<bool>,
    /// Auto-initialize default GTD space on startup (optional; defaults to true)
    pub auto_initialize: Option<bool>,
    /// Seed example content on first run (optional; defaults to true)
    pub seed_example_content: Option<bool>,
    /// Preferred default GTD space path override
    pub default_space_path: Option<String>,
    /// Enable git-based syncing and backups
    pub git_sync_enabled: Option<bool>,
    /// Path to the dedicated git repository for encrypted backups
    pub git_sync_repo_path: Option<String>,
    /// Optional override for which workspace path to archive
    pub git_sync_workspace_path: Option<String>,
    /// Remote URL used for push/pull actions
    pub git_sync_remote_url: Option<String>,
    /// Preferred branch name for remote backups
    pub git_sync_branch: Option<String>,
    /// Locally stored encryption key (never synced) - excluded from serialization, stored in secure storage
    #[serde(skip_serializing)]
    pub git_sync_encryption_key: Option<String>,
    /// Number of encrypted snapshots to retain
    pub git_sync_keep_history: Option<u32>,
    /// Optional git author override
    pub git_sync_author_name: Option<String>,
    /// Optional git email override
    pub git_sync_author_email: Option<String>,
    /// Timestamp of the last successful push
    pub git_sync_last_push: Option<String>,
    /// Timestamp of the last successful pull
    pub git_sync_last_pull: Option<String>,
    /// Optional automatic pull cadence
    pub git_sync_auto_pull_interval_minutes: Option<u32>,
}

impl std::fmt::Debug for UserSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("UserSettings")
            .field("theme", &self.theme)
            .field("font_size", &self.font_size)
            .field("tab_size", &self.tab_size)
            .field("word_wrap", &self.word_wrap)
            .field("font_family", &self.font_family)
            .field("line_height", &self.line_height)
            .field("keybindings", &self.keybindings)
            .field("last_folder", &self.last_folder)
            .field("editor_mode", &self.editor_mode)
            .field("window_width", &self.window_width)
            .field("window_height", &self.window_height)
            .field("max_tabs", &self.max_tabs)
            .field("restore_tabs", &self.restore_tabs)
            .field("auto_initialize", &self.auto_initialize)
            .field("seed_example_content", &self.seed_example_content)
            .field("default_space_path", &self.default_space_path)
            .field("git_sync_enabled", &self.git_sync_enabled)
            .field("git_sync_repo_path", &self.git_sync_repo_path)
            .field("git_sync_workspace_path", &self.git_sync_workspace_path)
            .field("git_sync_remote_url", &self.git_sync_remote_url)
            .field("git_sync_branch", &self.git_sync_branch)
            .field(
                "git_sync_encryption_key",
                &self
                    .git_sync_encryption_key
                    .as_ref()
                    .map(|_| "<redacted>")
                    .unwrap_or("<none>"),
            )
            .finish()
    }
}

/// Load user settings from persistent storage
///
/// Loads user preferences from the store. If settings don't exist, returns default values.
///
/// # Arguments
///
/// * `app` - Tauri application handle for accessing the store
///
/// # Returns
///
/// UserSettings struct with current or default settings
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
///
/// const settings = await invoke('load_settings');
/// console.log('Current theme:', settings.theme);
/// ```
fn load_settings_unlocked(app: &AppHandle) -> Result<UserSettings, String> {
    log::info!("Loading user settings");

    // Get or create store
    let store = match tauri_plugin_store::StoreExt::get_store(
        app,
        std::path::PathBuf::from("settings.json"),
    ) {
        Some(store) => store,
        None => {
            // Create new store if it doesn't exist
            match StoreBuilder::new(app, std::path::PathBuf::from("settings.json")).build() {
                Ok(store) => store,
                Err(e) => {
                    log::error!("Failed to create settings store: {}", e);
                    return Ok(default_settings_with_secure_key());
                }
            }
        }
    };

    // Load settings from store
    let settings = match store.get("user_settings") {
        Some(value) => {
            // Check if git_sync_encryption_key exists in the old format for migration
            let mut value_to_deserialize = value.clone();
            let mut legacy_encryption_key: Option<String> = None;

            if let Some(key_str) = value
                .get("git_sync_encryption_key")
                .and_then(|val| val.as_str())
            {
                if !key_str.trim().is_empty() {
                    legacy_encryption_key = Some(key_str.to_string());
                    log::info!("Migrating encryption key from settings.json to secure storage");
                    match keyring::Entry::new(SECURE_STORAGE_SERVICE, GIT_SYNC_ENCRYPTION_KEY_NAME)
                    {
                        Ok(entry) => match entry.get_password() {
                            Ok(existing_secret) if !existing_secret.trim().is_empty() => {
                                log::info!(
                                    "Secure storage already has an encryption key; skipping legacy migration overwrite"
                                );
                                if let Some(settings_obj) = value_to_deserialize.as_object_mut() {
                                    settings_obj.remove("git_sync_encryption_key");
                                    store.set("user_settings", value_to_deserialize.clone());
                                    if let Err(error) = store.save() {
                                        log::warn!(
                                            "Failed to remove legacy encryption key from settings.json after secure-store migration: {}",
                                            error
                                        );
                                    }
                                }
                                legacy_encryption_key = None;
                            }
                            Ok(_) | Err(keyring::Error::NoEntry) => {
                                if let Some(settings_obj) = value_to_deserialize.as_object_mut() {
                                    let original_settings =
                                        store.get("user_settings").unwrap_or_else(|| {
                                            serde_json::Value::Object(settings_obj.clone())
                                        });
                                    match entry.set_password(key_str) {
                                        Ok(_) => {
                                            settings_obj.remove("git_sync_encryption_key");
                                            store
                                                .set("user_settings", value_to_deserialize.clone());
                                            if let Err(e) = store.save() {
                                                log::warn!(
                                                    "Failed to save settings after migration: {}",
                                                    e
                                                );
                                                store.set("user_settings", original_settings);
                                                legacy_encryption_key = Some(key_str.to_string());
                                                if let Some(settings_obj) =
                                                    value_to_deserialize.as_object_mut()
                                                {
                                                    settings_obj.insert(
                                                        "git_sync_encryption_key".to_string(),
                                                        serde_json::Value::String(
                                                            key_str.to_string(),
                                                        ),
                                                    );
                                                }
                                            } else {
                                                log::info!(
                                                    "Successfully migrated encryption key to secure storage"
                                                );
                                                legacy_encryption_key = None;
                                            }
                                        }
                                        Err(e) => {
                                            log::warn!(
                                                "Failed to migrate key to secure storage: {}. Keeping legacy value.",
                                                e
                                            );
                                            legacy_encryption_key = Some(key_str.to_string());
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                log::warn!(
                                    "Unable to inspect secure storage for migration: {}. Keeping legacy value.",
                                    e
                                );
                            }
                        },
                        Err(e) => {
                            log::warn!(
                                "Unable to access secure storage for migration: {}. Keeping legacy value.",
                                e
                            );
                        }
                    }
                }
            }

            // Now deserialize without the encryption key field (it will be re-attached via legacy_encryption_key)
            match serde_json::from_value::<UserSettings>(value_to_deserialize) {
                Ok(mut s) => {
                    s.git_sync_encryption_key =
                        legacy_encryption_key.or_else(load_git_sync_encryption_key);
                    log::info!("Loaded existing settings");
                    s
                }
                Err(e) => {
                    log::warn!("Failed to parse settings, using defaults: {}", e);
                    default_settings_with_secure_key()
                }
            }
        }
        None => {
            log::info!("No existing settings found, using defaults");
            default_settings_with_secure_key()
        }
    };

    Ok(settings)
}

#[tauri::command]
pub async fn load_settings(app: AppHandle) -> Result<UserSettings, String> {
    let _guard = SETTINGS_LOCK.lock().await;
    load_settings_unlocked(&app)
}

/// Save user settings to persistent storage
///
/// Saves the provided user settings to the store for persistence across sessions.
///
/// # Arguments
///
/// * `app` - Tauri application handle for accessing the store
/// * `settings` - UserSettings struct to save
///
/// # Returns
///
/// Success message or error details
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
///
/// const settings = {
///   theme: 'dark',
///   font_size: 14,
///   // ... other settings
/// };
///
/// await invoke('save_settings', { settings });
/// ```
fn save_settings_unlocked(app: &AppHandle, settings: &UserSettings) -> Result<String, String> {
    log::info!("Saving user settings");

    // Get or create store
    let store = match tauri_plugin_store::StoreExt::get_store(
        app,
        std::path::PathBuf::from("settings.json"),
    ) {
        Some(store) => store,
        None => {
            // Create new store if it doesn't exist
            match StoreBuilder::new(app, std::path::PathBuf::from("settings.json")).build() {
                Ok(store) => store,
                Err(e) => {
                    log::error!("Failed to create settings store: {}", e);
                    return Err(format!("Failed to create settings store: {}", e));
                }
            }
        }
    };

    // Save settings to store
    match serde_json::to_value(settings) {
        Ok(value) => {
            let previous_value = store.get("user_settings");
            let previous_git_sync_encryption_key = load_git_sync_encryption_key();
            store.set("user_settings", value);

            if let Err(error) = sync_git_sync_encryption_key(settings) {
                restore_user_settings_value(&store, previous_value);
                return Err(error);
            }

            if let Err(e) = store.save() {
                restore_user_settings_value(&store, previous_value);
                if let Err(restore_error) =
                    sync_git_sync_encryption_key_value(previous_git_sync_encryption_key.as_deref())
                {
                    log::error!(
                        "Failed to restore git sync encryption key after settings save failure: {}",
                        restore_error
                    );
                }
                return Err(format!("Failed to persist settings: {}", e));
            }

            log::info!("Settings saved successfully");
            Ok("Settings saved successfully".to_string())
        }
        Err(e) => {
            log::error!("Failed to serialize settings: {}", e);
            Err(format!("Failed to serialize settings: {}", e))
        }
    }
}

pub(crate) async fn update_settings<F>(app: AppHandle, updater: F) -> Result<UserSettings, String>
where
    F: FnOnce(&mut UserSettings),
{
    let _guard = SETTINGS_LOCK.lock().await;
    let mut settings = load_settings_unlocked(&app)?;
    updater(&mut settings);
    save_settings_unlocked(&app, &settings)?;
    Ok(settings)
}

#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: UserSettings) -> Result<String, String> {
    let _guard = SETTINGS_LOCK.lock().await;
    save_settings_unlocked(&app, &settings)
}

/// Store a secret value in the OS keychain/credential manager
///
/// Stores sensitive data like encryption keys securely using the platform's
/// native credential storage (macOS Keychain, Windows Credential Manager, etc.)
///
/// # Arguments
///
/// * `key` - Unique identifier for the secret
/// * `value` - Secret value to store
///
/// # Returns
///
/// Success message or error details
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
///
/// await invoke('secure_store_set', { key: 'git_sync_encryption_key', value: 'my-secret-key' });
/// ```
#[tauri::command]
pub async fn secure_store_set(key: String, value: String) -> Result<String, String> {
    log::debug!("Storing secret in secure storage: {}", key);
    let _guard = SETTINGS_LOCK.lock().await;

    if key == GIT_SYNC_ENCRYPTION_KEY_NAME {
        sync_git_sync_encryption_key_value(Some(value.as_str()))?;
        log::debug!("Secret stored successfully: {}", key);
        return Ok("Secret stored successfully".to_string());
    }

    let entry = match keyring::Entry::new(SECURE_STORAGE_SERVICE, &key) {
        Ok(entry) => entry,
        Err(e) => {
            log::error!("Failed to create keyring entry: {}", e);
            return Err(format!("Failed to access secure storage: {}", e));
        }
    };

    match entry.set_password(&value) {
        Ok(_) => {
            log::debug!("Secret stored successfully: {}", key);
            Ok("Secret stored successfully".to_string())
        }
        Err(e) => {
            log::error!("Failed to store secret: {}", e);
            Err(format!("Failed to store secret: {}", e))
        }
    }
}

/// Retrieve a secret value from the OS keychain/credential manager
///
/// Retrieves sensitive data from secure storage.
///
/// # Arguments
///
/// * `key` - Unique identifier for the secret
///
/// # Returns
///
/// Secret value or error if not found
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
///
/// const key = await invoke<string>('secure_store_get', { key: 'git_sync_encryption_key' });
/// ```
#[tauri::command]
pub async fn secure_store_get(key: String) -> Result<String, String> {
    log::debug!("Retrieving secret from secure storage: {}", key);
    let _guard = SETTINGS_LOCK.lock().await;

    let entry = match keyring::Entry::new(SECURE_STORAGE_SERVICE, &key) {
        Ok(entry) => entry,
        Err(e) => {
            log::error!("Failed to create keyring entry: {}", e);
            return Err(format!("Failed to access secure storage: {}", e));
        }
    };

    match entry.get_password() {
        Ok(value) => {
            log::debug!("Secret retrieved successfully: {}", key);
            Ok(value)
        }
        Err(keyring::Error::NoEntry) => {
            log::debug!("Secret not found: {}", key);
            Err("Secret not found".to_string())
        }
        Err(e) => {
            log::error!("Failed to retrieve secret: {}", e);
            Err(format!("Failed to retrieve secret: {}", e))
        }
    }
}

/// Remove a secret value from the OS keychain/credential manager
///
/// Deletes sensitive data from secure storage.
///
/// # Arguments
///
/// * `key` - Unique identifier for the secret
///
/// # Returns
///
/// Success message or error details
///
/// # Examples
///
/// ```typescript
/// import { invoke } from '@tauri-apps/api/core';
///
/// await invoke('secure_store_remove', { key: 'git_sync_encryption_key' });
/// ```
#[tauri::command]
pub async fn secure_store_remove(key: String) -> Result<String, String> {
    log::debug!("Removing secret from secure storage: {}", key);
    let _guard = SETTINGS_LOCK.lock().await;

    let entry = match keyring::Entry::new(SECURE_STORAGE_SERVICE, &key) {
        Ok(entry) => entry,
        Err(e) => {
            log::error!("Failed to create keyring entry: {}", e);
            return Err(format!("Failed to access secure storage: {}", e));
        }
    };

    match entry.delete_password() {
        Ok(_) => {
            log::debug!("Secret removed successfully: {}", key);
            Ok("Secret removed successfully".to_string())
        }
        Err(keyring::Error::NoEntry) => {
            log::debug!("Secret not found (already removed): {}", key);
            Ok("Secret not found (already removed)".to_string())
        }
        Err(e) => {
            log::error!("Failed to remove secret: {}", e);
            Err(format!("Failed to remove secret: {}", e))
        }
    }
}

/// Get default settings values
///
/// Returns a UserSettings struct with sensible defaults for new users.
fn default_font_family() -> String {
    "inter".to_string()
}

fn default_line_height() -> f32 {
    1.5
}

fn default_keybindings() -> HashMap<String, String> {
    let mut bindings = HashMap::new();
    bindings.insert("save".to_string(), "mod+s".to_string());
    bindings.insert("open".to_string(), "mod+o".to_string());
    bindings.insert("commandPalette".to_string(), "mod+k".to_string());
    bindings.insert("newNote".to_string(), "mod+shift+n".to_string());
    bindings
}

pub fn get_default_settings() -> UserSettings {
    UserSettings {
        theme: "dark".to_string(),
        font_size: 14,
        tab_size: 2,
        word_wrap: true,
        font_family: default_font_family(),
        line_height: default_line_height(),
        keybindings: default_keybindings(),
        last_folder: None,
        editor_mode: "split".to_string(),
        window_width: Some(1200),
        window_height: Some(800),
        max_tabs: None,
        restore_tabs: None,
        auto_initialize: Some(true),
        seed_example_content: Some(true),
        default_space_path: None,
        git_sync_enabled: Some(false),
        git_sync_repo_path: None,
        git_sync_workspace_path: None,
        git_sync_remote_url: None,
        git_sync_branch: Some("main".to_string()),
        git_sync_encryption_key: None,
        git_sync_keep_history: Some(5),
        git_sync_author_name: None,
        git_sync_author_email: None,
        git_sync_last_push: None,
        git_sync_last_pull: None,
        git_sync_auto_pull_interval_minutes: None,
    }
}
