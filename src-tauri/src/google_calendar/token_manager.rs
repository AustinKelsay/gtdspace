use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
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

        storage_path.push("tokens.json");

        Ok(Self { storage_path })
    }

    pub fn save_tokens(&self, tokens: &StoredTokens) -> Result<(), Box<dyn std::error::Error>> {
        let json = serde_json::to_string_pretty(tokens)?;

        // Write to a temporary file first, then rename for atomic operation
        let temp_path = self.storage_path.with_extension("tmp");
        std::fs::write(&temp_path, &json)?;

        // Set restrictive permissions on Unix-like systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(&temp_path)?.permissions();
            perms.set_mode(0o600); // Read/write for owner only
            std::fs::set_permissions(&temp_path, perms)?;
        }

        // Atomic rename operation
        std::fs::rename(&temp_path, &self.storage_path)?;

        println!(
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

        let json = std::fs::read_to_string(&self.storage_path)?;
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

            println!("[TokenManager] Tokens securely deleted");
        }
        Ok(())
    }
}
