use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
}

/// Helper function to retry file reads on Windows with transient failures
fn read_to_string_retry(
    path: &std::path::Path,
    attempts: u32,
    delay_ms: u64,
) -> std::io::Result<String> {
    if attempts == 0 {
        return Err(std::io::Error::other("attempts must be > 0"));
    }
    for attempt in 1..=attempts {
        match std::fs::read_to_string(path) {
            Ok(content) => return Ok(content),
            Err(e) => {
                let should_retry = matches!(
                    e.kind(),
                    std::io::ErrorKind::PermissionDenied
                        | std::io::ErrorKind::NotFound
                        | std::io::ErrorKind::Interrupted
                );

                if should_retry && attempt < attempts {
                    log::debug!(
                        "[TokenManager] File read attempt {}/{} failed: {}, retrying in {}ms",
                        attempt,
                        attempts,
                        e,
                        delay_ms
                    );
                    std::thread::sleep(Duration::from_millis(delay_ms));
                    continue;
                } else {
                    return Err(e);
                }
            }
        }
    }
    Err(std::io::Error::other("exhausted attempts without success"))
}

pub struct TokenManager {
    storage_path: PathBuf,
}

impl TokenManager {
    pub fn new(app_handle: tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let mut storage_path = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        storage_path.push("google-calendar");
        std::fs::create_dir_all(&storage_path)?;

        // Set restrictive permissions on the directory for Unix-like systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&storage_path)?.permissions();
            perms.set_mode(0o700); // Read/write/execute for owner only
            std::fs::set_permissions(&storage_path, perms)?;
        }

        storage_path.push("google_calendar_tokens.json");

        Ok(Self { storage_path })
    }

    #[allow(dead_code)]
    pub fn save_tokens(&self, tokens: &StoredTokens) -> Result<(), Box<dyn std::error::Error>> {
        let json = serde_json::to_string_pretty(tokens)?;

        // Create a temporary file in the same directory as the target file
        let parent_dir = self
            .storage_path
            .parent()
            .ok_or_else(|| std::io::Error::other("Invalid storage path"))?;
        let mut temp_file = tempfile::NamedTempFile::new_in(parent_dir)?;

        // Write to temp file
        use std::io::Write;
        temp_file.write_all(json.as_bytes())?;
        temp_file.flush()?;

        // Ensure data is written to disk
        temp_file.as_file().sync_all()?;

        // Set restrictive permissions on Unix-like systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let temp_path = temp_file.path().to_path_buf();
            let mut perms = std::fs::metadata(&temp_path)?.permissions();
            perms.set_mode(0o600); // Read/write for owner only
            std::fs::set_permissions(&temp_path, perms)?;
        }

        // Persist the temp file to the final location (atomic rename)
        // Handle Windows-specific errors where destination file already exists or permission issues
        match temp_file.persist(&self.storage_path) {
            Ok(_) => {}
            Err(persist_err) => {
                // On Windows, persist can fail if destination already exists or has permission issues
                // Check if it's an AlreadyExists or PermissionDenied error
                let error_kind = persist_err.error.kind();
                if error_kind == std::io::ErrorKind::AlreadyExists
                    || error_kind == std::io::ErrorKind::PermissionDenied
                {
                    log::warn!(
                        "[TokenManager] Persist failed with {:?}, attempting to remove existing file and retry",
                        error_kind
                    );

                    // Try to delete the existing file
                    if let Err(remove_err) = std::fs::remove_file(&self.storage_path) {
                        log::error!(
                            "[TokenManager] Failed to remove existing file: {}",
                            remove_err
                        );
                    }

                    // Recover the temp file from the error and retry once
                    let temp_file = persist_err.file;
                    temp_file.persist(&self.storage_path)?;
                } else {
                    // For other error types, propagate as-is
                    return Err(persist_err.error.into());
                }
            }
        }

        // After successful persist, fsync the parent directory for durability
        if let Some(parent) = self.storage_path.parent() {
            if let Ok(dir_file) = std::fs::File::open(parent) {
                if let Err(sync_err) = dir_file.sync_all() {
                    // Log but don't fail - this is best-effort
                    log::warn!("[TokenManager] Failed to sync directory: {}", sync_err);
                }
            }
        }

        log::debug!(
            "[TokenManager] Tokens saved securely to {:?}",
            self.storage_path
        );
        Ok(())
    }

    pub fn load_tokens(&self) -> Result<Option<StoredTokens>, Box<dyn std::error::Error>> {
        if !self.storage_path.exists() {
            return Ok(None);
        }

        // On Unix systems, verify file permissions haven't been tampered with
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let metadata = std::fs::metadata(&self.storage_path)?;
            let mode = metadata.permissions().mode();

            // Check if permissions are too permissive (world or group readable)
            if mode & 0o077 != 0 {
                // Attempt to fix permissions
                let mut perms = metadata.permissions();
                perms.set_mode(0o600);
                std::fs::set_permissions(&self.storage_path, perms)?;

                log::warn!("[TokenManager] Token file had insecure permissions, fixed to 0600");
            }
        }

        let json = read_to_string_retry(&self.storage_path, 5, 20)?;
        let tokens: StoredTokens = serde_json::from_str(&json)?;
        Ok(Some(tokens))
    }

    pub fn delete_tokens(&self) -> Result<(), Box<dyn std::error::Error>> {
        if self.storage_path.exists() {
            // Securely overwrite the file contents before deletion
            let file_size = std::fs::metadata(&self.storage_path)?.len();
            if file_size > 0 {
                // Overwrite with zeros
                let zeros = vec![0u8; file_size as usize];
                std::fs::write(&self.storage_path, zeros)?;
            }

            // Now remove the file
            std::fs::remove_file(&self.storage_path)?;

            log::debug!("[TokenManager] Tokens securely deleted");
        }
        Ok(())
    }
}
