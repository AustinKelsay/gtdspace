use google_calendar3::oauth2::authenticator::Authenticator;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
}

pub struct TokenStorage {
    app_handle: AppHandle,
}

impl TokenStorage {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    /// Get the app data directory, with proper error handling and fallback
    fn get_app_data_dir(&self) -> Result<PathBuf, Box<dyn std::error::Error>> {
        self.app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data directory: {}", e).into())
    }

    /// Get the app data directory with fallback to temp directory
    fn get_app_data_dir_or_fallback(&self) -> PathBuf {
        match self.get_app_data_dir() {
            Ok(dir) => dir,
            Err(e) => {
                log::error!(
                    "Failed to get app data directory: {}. Using temp directory as fallback.",
                    e
                );
                std::env::temp_dir()
                    .join("gtdspace")
                    .join("google_calendar")
            }
        }
    }

    pub fn get_token_path(&self) -> PathBuf {
        let app_dir = self.get_app_data_dir_or_fallback();

        // Ensure directory exists with proper error handling
        if let Err(e) = std::fs::create_dir_all(&app_dir) {
            log::error!(
                "Failed to create app data directory '{}': {}",
                app_dir.display(),
                e
            );
            // Continue anyway - the actual file operations will fail with proper errors
        } else {
            // Set restrictive permissions on the directory for Unix-like systems
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(metadata) = std::fs::metadata(&app_dir) {
                    let mut perms = metadata.permissions();
                    perms.set_mode(0o700); // Read/write/execute for owner only
                    let _ = std::fs::set_permissions(&app_dir, perms);
                }
            }
        }

        app_dir.join("google_calendar_token.json")
    }

    fn get_sync_metadata_path(&self) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let app_dir = self.get_app_data_dir()?;
        Ok(app_dir.join("google_calendar_sync.json"))
    }

    pub async fn save_token(&self, token: StoredToken) -> Result<(), Box<dyn std::error::Error>> {
        let path = self.get_token_path();
        let json = serde_json::to_string_pretty(&token)?;

        // Write to a temporary file first for atomic operation
        let temp_path = path.with_extension("tmp");
        fs::write(&temp_path, &json).await?;

        // Set restrictive permissions on Unix-like systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = tokio::fs::metadata(&temp_path).await?;
            let mut perms = metadata.permissions();
            perms.set_mode(0o600); // Read/write for owner only
            tokio::fs::set_permissions(&temp_path, perms).await?;
        }

        // Atomic rename operation
        tokio::fs::rename(&temp_path, &path).await?;

        log::debug!("Token saved securely to {:?}", path);
        Ok(())
    }

    pub async fn load_token(&self) -> Result<Option<StoredToken>, Box<dyn std::error::Error>> {
        let path = self.get_token_path();

        if !path.exists() {
            return Ok(None);
        }

        // On Unix systems, verify and fix file permissions if needed
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = tokio::fs::metadata(&path).await?;
            let mode = metadata.permissions().mode();

            // Check if permissions are too permissive (world or group readable)
            if mode & 0o077 != 0 {
                // Fix permissions
                let mut perms = metadata.permissions();
                perms.set_mode(0o600);
                tokio::fs::set_permissions(&path, perms).await?;

                log::warn!("Token file had insecure permissions, fixed to 0600");
            }
        }

        let content = fs::read_to_string(&path).await?;
        let token: StoredToken = serde_json::from_str(&content)?;
        Ok(Some(token))
    }

    pub async fn delete_token(&self) -> Result<(), Box<dyn std::error::Error>> {
        let path = self.get_token_path();
        if path.exists() {
            // Securely overwrite the file contents before deletion
            let metadata = tokio::fs::metadata(&path).await?;
            let file_size = metadata.len();
            if file_size > 0 {
                // Overwrite with zeros
                let zeros = vec![0u8; file_size as usize];
                fs::write(&path, zeros).await?;
            }

            // Now remove the file
            fs::remove_file(&path).await?;

            log::debug!("Token securely deleted");
        }
        Ok(())
    }

    pub async fn has_token(&self) -> bool {
        self.get_token_path().exists()
    }

    pub async fn save_authenticator<T>(
        &self,
        _authenticator: &Authenticator<T>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // The authenticator automatically persists tokens to disk
        // using the path we provided in persist_tokens_to_disk()
        // This method is here for future extensions if needed
        Ok(())
    }
}

// Store sync metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMetadata {
    pub last_sync: Option<chrono::DateTime<chrono::Utc>>,
    pub sync_token: Option<String>,
    pub calendars: Vec<String>,
}

impl TokenStorage {
    pub async fn save_sync_metadata(
        &self,
        metadata: &SyncMetadata,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let path = self.get_sync_metadata_path()?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                log::error!("Failed to create directory '{}': {}", parent.display(), e);
                return Err(format!("Failed to create directory: {}", e).into());
            }

            // Set restrictive permissions on the directory for Unix-like systems
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(metadata) = std::fs::metadata(parent) {
                    let mut perms = metadata.permissions();
                    perms.set_mode(0o700); // Read/write/execute for owner only
                    let _ = std::fs::set_permissions(parent, perms);
                }
            }
        }

        let json = serde_json::to_string_pretty(&metadata)?;

        // Write to a temporary file first for atomic operation
        let temp_path = path.with_extension("tmp");
        fs::write(&temp_path, &json).await?;

        // Set restrictive permissions on Unix-like systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = tokio::fs::metadata(&temp_path).await?;
            let mut perms = metadata.permissions();
            perms.set_mode(0o600); // Read/write for owner only
            tokio::fs::set_permissions(&temp_path, perms).await?;
        }

        // Atomic rename operation
        tokio::fs::rename(&temp_path, &path).await?;

        Ok(())
    }

    pub async fn load_sync_metadata(
        &self,
    ) -> Result<Option<SyncMetadata>, Box<dyn std::error::Error>> {
        let path = self.get_sync_metadata_path()?;

        if !path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&path).await?;
        let metadata: SyncMetadata = serde_json::from_str(&content)?;
        Ok(Some(metadata))
    }
}
