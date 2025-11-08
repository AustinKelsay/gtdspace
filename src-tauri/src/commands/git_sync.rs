use super::UserSettings;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use chrono::{DateTime, Utc};
use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use keyring;
use log::{debug, info, warn};
use pbkdf2::pbkdf2_hmac;
use rand::rngs::OsRng;
use rand::TryRngCore;
use serde::Serialize;
use serde_json::json;
use sha2::Sha256;
use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::{Cursor, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;
use tar::{Archive, Builder as TarBuilder};
use tempfile::Builder as TempDirBuilder;
use walkdir::WalkDir;

const MAGIC_HEADER: &[u8; 8] = b"GTDENC01";
const PBKDF2_ITERATIONS: u32 = 600_000;
const REMOTE_NAME: &str = "origin";
const MIN_KEEP_HISTORY: usize = 1;
const MAX_KEEP_HISTORY: usize = 20;

#[derive(Debug, Clone)]
pub struct GitSyncConfig {
    pub repo_path: PathBuf,
    pub workspace_path: PathBuf,
    pub remote_url: Option<String>,
    pub branch: String,
    pub encryption_key: String,
    pub keep_history: usize,
    pub author_name: Option<String>,
    pub author_email: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitOperationResultPayload {
    pub success: bool,
    pub message: String,
    pub backup_file: Option<String>,
    pub timestamp: Option<String>,
    pub pushed: bool,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncStatusResponse {
    pub enabled: bool,
    pub configured: bool,
    pub encryption_configured: bool,
    pub repo_path: Option<String>,
    pub workspace_path: Option<String>,
    pub remote_url: Option<String>,
    pub branch: Option<String>,
    pub last_push: Option<String>,
    pub last_pull: Option<String>,
    pub latest_backup_file: Option<String>,
    pub latest_backup_at: Option<String>,
    pub has_pending_commits: bool,
    pub has_remote: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone)]
struct BackupEntry {
    file_name: String,
    modified: SystemTime,
    _size: u64,
}

pub fn compute_git_status(
    settings: &UserSettings,
    workspace_override: Option<String>,
) -> GitSyncStatusResponse {
    let enabled = settings.git_sync_enabled.unwrap_or(false);
    // Check secure storage for encryption key; fall back to legacy settings value if needed
    let encryption_configured = {
        let service = "com.gtdspace.app";
        match keyring::Entry::new(service, "git_sync_encryption_key") {
            Ok(entry) => entry
                .get_password()
                .map(|v| !v.trim().is_empty())
                .unwrap_or_else(|err| {
                    if let Some(legacy_key) = &settings.git_sync_encryption_key {
                        warn!(
                            "Secure storage locked/unavailable ({}). Falling back to legacy encryption key for status",
                            err
                        );
                        !legacy_key.trim().is_empty()
                    } else {
                        false
                    }
                }),
            Err(err) => {
                if let Some(legacy_key) = &settings.git_sync_encryption_key {
                    warn!(
                        "Secure storage inaccessible ({}). Using legacy encryption key for status",
                        err
                    );
                    !legacy_key.trim().is_empty()
                } else {
                    false
                }
            }
        }
    };

    let workspace_path = workspace_override
        .filter(|v| !v.trim().is_empty())
        .or_else(|| settings.git_sync_workspace_path.clone())
        .or_else(|| settings.default_space_path.clone())
        .or_else(|| settings.last_folder.clone());

    let repo_path = settings.git_sync_repo_path.clone();

    let configured =
        enabled && repo_path.is_some() && workspace_path.is_some() && encryption_configured;

    let mut has_pending_commits = false;
    let mut has_remote = false;
    let mut latest_backup: Option<BackupEntry> = None;
    let mut message: Option<String> = None;

    if configured {
        if let Some(repo_str) = &repo_path {
            let repo_buf = PathBuf::from(repo_str);
            if repo_buf.exists() {
                let backups_dir = repo_buf.join("backups");
                match list_backups(&backups_dir) {
                    Ok(entries) => {
                        latest_backup = entries.into_iter().next();
                    }
                    Err(err) => {
                        message = Some(err);
                    }
                }

                if message.is_none() {
                    if backups_dir.exists() {
                        match run_git_command(&repo_buf, ["status", "--porcelain", "backups"]) {
                            Ok(output) => {
                                has_pending_commits = !output.trim().is_empty();
                            }
                            Err(err) => {
                                message = Some(err);
                            }
                        }
                    } else {
                        debug!(
                            "Skipping git status for missing backups directory at {}",
                            backups_dir.display()
                        );
                    }
                }

                if message.is_none() {
                    match run_git_command(&repo_buf, ["remote"]) {
                        Ok(remotes) => {
                            has_remote = remotes.lines().any(|line| line.trim() == REMOTE_NAME);
                        }
                        Err(_) => {
                            has_remote = false;
                        }
                    }
                }
            } else {
                message = Some("Git sync repository does not exist".to_string());
            }
        }
    } else if enabled {
        message =
            Some("Git sync requires repo path, workspace path, and encryption key".to_string());
    } else {
        message = Some("Git sync is disabled".to_string());
    }

    GitSyncStatusResponse {
        enabled,
        configured,
        encryption_configured,
        repo_path,
        workspace_path,
        remote_url: settings.git_sync_remote_url.clone(),
        branch: settings.git_sync_branch.clone(),
        last_push: settings.git_sync_last_push.clone(),
        last_pull: settings.git_sync_last_pull.clone(),
        latest_backup_file: latest_backup.as_ref().map(|entry| entry.file_name.clone()),
        latest_backup_at: latest_backup
            .as_ref()
            .and_then(|entry| system_time_to_iso(entry.modified)),
        has_pending_commits,
        has_remote,
        message,
    }
}

pub fn build_git_sync_config(
    settings: &UserSettings,
    workspace_override: Option<String>,
) -> Result<GitSyncConfig, String> {
    if !settings.git_sync_enabled.unwrap_or(false) {
        return Err("Git sync is disabled in settings".to_string());
    }

    let workspace_path = workspace_override
        .filter(|v| !v.trim().is_empty())
        .or_else(|| settings.git_sync_workspace_path.clone())
        .or_else(|| settings.default_space_path.clone())
        .or_else(|| settings.last_folder.clone())
        .ok_or_else(|| "Workspace path is not configured".to_string())?;

    let repo_path = settings
        .git_sync_repo_path
        .clone()
        .ok_or_else(|| "Git sync repository path is not configured".to_string())?;

    // Retrieve encryption key from secure storage (fall back to legacy settings key if migration hasn't completed)
    let encryption_key = {
        let service = "com.gtdspace.app";
        match keyring::Entry::new(service, "git_sync_encryption_key") {
            Ok(entry) => match entry.get_password() {
                Ok(password) => password,
                Err(err) => {
                    if let Some(legacy_key) = settings.git_sync_encryption_key.clone() {
                        warn!(
                            "Secure storage entry missing password ({}). Falling back to legacy encryption key.",
                            err
                        );
                        legacy_key
                    } else {
                        return Err("Encryption key has not been set".to_string());
                    }
                }
            },
            Err(err) => {
                if let Some(legacy_key) = settings.git_sync_encryption_key.clone() {
                    warn!(
                        "Secure storage unavailable ({}). Using legacy encryption key from settings until migration succeeds.",
                        err
                    );
                    legacy_key
                } else {
                    return Err(format!("Failed to access secure storage: {}", err));
                }
            }
        }
    };

    let encryption_key = encryption_key.trim().to_string();

    if encryption_key.is_empty() {
        return Err("Encryption key has not been set".to_string());
    }

    let branch = settings
        .git_sync_branch
        .clone()
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| "main".to_string());

    let keep_history = settings
        .git_sync_keep_history
        .map(|v| v as usize)
        .unwrap_or(5)
        .clamp(MIN_KEEP_HISTORY, MAX_KEEP_HISTORY);

    let workspace_buf = PathBuf::from(&workspace_path);
    if !workspace_buf.exists() || !workspace_buf.is_dir() {
        return Err("Workspace path does not exist or is not a directory".to_string());
    }

    let repo_buf = PathBuf::from(&repo_path);
    if !repo_buf.exists() {
        fs::create_dir_all(&repo_buf)
            .map_err(|e| format!("Failed to create repository path: {}", e))?;
    }

    let workspace_real = fs::canonicalize(&workspace_buf)
        .map_err(|e| format!("Failed to canonicalize workspace path: {}", e))?;
    let repo_real = fs::canonicalize(&repo_buf)
        .map_err(|e| format!("Failed to canonicalize repo path: {}", e))?;

    if repo_real.starts_with(&workspace_real) || workspace_real.starts_with(&repo_real) {
        return Err(
            "Repository path must be outside the workspace to avoid recursive backups".to_string(),
        );
    }

    Ok(GitSyncConfig {
        repo_path: repo_real,
        workspace_path: workspace_real,
        remote_url: settings.git_sync_remote_url.clone(),
        branch,
        encryption_key,
        keep_history,
        author_name: settings.git_sync_author_name.clone(),
        author_email: settings.git_sync_author_email.clone(),
    })
}

pub fn perform_git_push(config: GitSyncConfig) -> Result<GitOperationResultPayload, String> {
    ensure_repo(&config)?;
    ensure_gitignore(&config.repo_path)?;
    let backups_dir = config.repo_path.join("backups");
    fs::create_dir_all(&backups_dir)
        .map_err(|e| format!("Failed to create backups directory: {}", e))?;

    let archive_bytes = create_workspace_archive(&config.workspace_path)?;
    let encrypted = encrypt_bytes(&config.encryption_key, &archive_bytes)?;

    let now = Utc::now();
    let slug = now.format("%Y%m%dT%H%M%SZ").to_string();
    let backup_file = format!("backup-{}.tar.gz.enc", slug);
    let backup_path = backups_dir.join(&backup_file);

    fs::write(&backup_path, encrypted)
        .map_err(|e| format!("Failed to write encrypted snapshot: {}", e))?;

    prune_history(&backups_dir, config.keep_history)?;

    run_git_command(&config.repo_path, ["add", "backups"])?;

    let status_output = run_git_command(&config.repo_path, ["status", "--porcelain", "backups"])?;
    if status_output.trim().is_empty() {
        return Ok(GitOperationResultPayload {
            success: true,
            message: "Backup already up to date".to_string(),
            backup_file: Some(backup_file),
            timestamp: Some(now.to_rfc3339()),
            pushed: false,
            details: None,
        });
    }

    if let Some(name) = &config.author_name {
        run_git_command(&config.repo_path, ["config", "user.name", name])?;
    }
    if let Some(email) = &config.author_email {
        run_git_command(&config.repo_path, ["config", "user.email", email])?;
    }

    let commit_msg = format!("sync: backup {}", slug);
    run_git_command(&config.repo_path, ["commit", "-m", &commit_msg])?;

    let mut pushed = false;
    if let Some(remote_url) = &config.remote_url {
        if !remote_url.trim().is_empty() {
            ensure_remote(&config.repo_path, remote_url)?;
            let branch_ref = format!("HEAD:{}", config.branch);
            run_git_command(&config.repo_path, ["push", "-u", REMOTE_NAME, &branch_ref])?;
            pushed = true;
        }
    }

    Ok(GitOperationResultPayload {
        success: true,
        message: "Encrypted snapshot created".to_string(),
        backup_file: Some(backup_file),
        timestamp: Some(now.to_rfc3339()),
        pushed,
        details: Some(json!({
            "repoPath": config.repo_path,
            "workspacePath": config.workspace_path,
            "branch": config.branch,
        })),
    })
}

pub fn perform_git_pull(config: GitSyncConfig) -> Result<GitOperationResultPayload, String> {
    ensure_repo(&config)?;
    let backups_dir = config.repo_path.join("backups");
    fs::create_dir_all(&backups_dir)
        .map_err(|e| format!("Failed to create backups directory: {}", e))?;

    if let Some(remote_url) = &config.remote_url {
        if !remote_url.trim().is_empty() {
            ensure_remote(&config.repo_path, remote_url)?;
            run_git_command(&config.repo_path, ["fetch", REMOTE_NAME])?;
            run_git_command(
                &config.repo_path,
                ["pull", "--ff-only", REMOTE_NAME, &config.branch],
            )?;
        }
    }

    ensure_gitignore(&config.repo_path)?;

    let latest_backup = list_backups(&backups_dir)?
        .into_iter()
        .next()
        .ok_or_else(|| "No backups are available to restore".to_string())?;

    let backup_path = backups_dir.join(&latest_backup.file_name);
    let encrypted = fs::read(&backup_path)
        .map_err(|e| format!("Failed to read backup {}: {}", backup_path.display(), e))?;
    let decrypted = decrypt_bytes(&config.encryption_key, &encrypted)?;

    restore_workspace(&config.workspace_path, &decrypted)?;

    Ok(GitOperationResultPayload {
        success: true,
        message: "Workspace restored from encrypted backup".to_string(),
        backup_file: Some(latest_backup.file_name),
        timestamp: system_time_to_iso(latest_backup.modified),
        pushed: false,
        details: Some(json!({
            "workspacePath": config.workspace_path,
        })),
    })
}

fn ensure_repo(config: &GitSyncConfig) -> Result<(), String> {
    if config.repo_path.join(".git").exists() {
        return Ok(());
    }

    info!(
        "Initializing git repository for backups at {}",
        config.repo_path.display()
    );
    run_git_command(&config.repo_path, ["init"])?;
    Ok(())
}

fn ensure_gitignore(repo_path: &Path) -> Result<(), String> {
    let gitignore_path = repo_path.join(".gitignore");
    let desired = ["*", "!.gitignore", "!backups/", "!backups/**"];

    if !gitignore_path.exists() {
        let mut contents = String::from("# Generated by GTD Space\n");
        for line in desired {
            contents.push_str(line);
            contents.push('\n');
        }
        fs::write(&gitignore_path, contents)
            .map_err(|e| format!("Failed to write .gitignore: {}", e))?;
        return Ok(());
    }

    let existing = fs::read_to_string(&gitignore_path)
        .map_err(|e| format!("Failed to read .gitignore: {}", e))?;
    let mut missing = Vec::new();
    for line in desired {
        if !existing.lines().any(|l| l.trim() == line) {
            missing.push(line);
        }
    }

    if !missing.is_empty() {
        let mut file = OpenOptions::new()
            .append(true)
            .open(&gitignore_path)
            .map_err(|e| format!("Failed to open .gitignore: {}", e))?;
        for line in missing {
            writeln!(file, "{}", line)
                .map_err(|e| format!("Failed to update .gitignore: {}", e))?;
        }
    }

    Ok(())
}

fn create_workspace_archive(workspace: &Path) -> Result<Vec<u8>, String> {
    if !workspace.is_dir() {
        return Err("Workspace must be a directory".to_string());
    }

    let buffer = Vec::new();
    let encoder = GzEncoder::new(buffer, Compression::default());
    let mut builder = TarBuilder::new(encoder);

    for entry in WalkDir::new(workspace).into_iter() {
        let entry = entry.map_err(|e| format!("Failed to walk workspace: {}", e))?;
        let path = entry.path();

        if path == workspace {
            continue;
        }

        let relative = path
            .strip_prefix(workspace)
            .map_err(|e| format!("Failed to determine relative path: {}", e))?;

        if should_skip_path(relative) {
            if entry.file_type().is_dir() {
                debug!("Skipping directory during archive: {}", relative.display());
            }
            continue;
        }

        if entry.file_type().is_dir() {
            builder
                .append_dir(relative, path)
                .map_err(|e| format!("Failed to append directory {}: {}", relative.display(), e))?;
        } else if entry.file_type().is_file() {
            let mut file = File::open(path)
                .map_err(|e| format!("Failed to open {}: {}", path.display(), e))?;
            builder
                .append_file(relative, &mut file)
                .map_err(|e| format!("Failed to append file {}: {}", relative.display(), e))?;
        }
    }

    let encoder = builder
        .into_inner()
        .map_err(|e| format!("Failed to finalize archive: {}", e))?;
    encoder
        .finish()
        .map_err(|e| format!("Failed to finish compression: {}", e))
}

fn should_skip_path(relative: &Path) -> bool {
    relative.components().any(|component| {
        if let Some(name) = component.as_os_str().to_str() {
            name == ".git" || name == ".gtdsync"
        } else {
            false
        }
    })
}

fn encrypt_bytes(passphrase: &str, plaintext: &[u8]) -> Result<Vec<u8>, String> {
    if passphrase.trim().is_empty() {
        return Err("Encryption key cannot be empty".to_string());
    }

    let mut salt = [0u8; 16];
    let mut nonce_bytes = [0u8; 12];
    let mut rng = OsRng;
    rng.try_fill_bytes(&mut salt)
        .map_err(|e| format!("Failed to generate random salt: {}", e))?;
    rng.try_fill_bytes(&mut nonce_bytes)
        .map_err(|e| format!("Failed to generate random nonce: {}", e))?;

    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(passphrase.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key);

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Failed to initialize cipher: {}", e))?;
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("Encryption failed: {}", e))?;

    let mut output =
        Vec::with_capacity(MAGIC_HEADER.len() + salt.len() + nonce_bytes.len() + ciphertext.len());
    output.extend_from_slice(MAGIC_HEADER);
    output.extend_from_slice(&salt);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

fn decrypt_bytes(passphrase: &str, data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < MAGIC_HEADER.len() + 16 + 12 {
        return Err("Encrypted payload is too short".to_string());
    }

    if &data[..MAGIC_HEADER.len()] != MAGIC_HEADER {
        return Err("Invalid encrypted payload header".to_string());
    }

    let salt_start = MAGIC_HEADER.len();
    let nonce_start = salt_start + 16;
    let cipher_start = nonce_start + 12;

    let salt = &data[salt_start..nonce_start];
    let nonce_bytes = &data[nonce_start..cipher_start];
    let ciphertext = &data[cipher_start..];

    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(passphrase.as_bytes(), salt, PBKDF2_ITERATIONS, &mut key);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Failed to initialize cipher: {}", e))?;
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))
}

fn restore_workspace(workspace: &Path, archive: &[u8]) -> Result<(), String> {
    let workspace_parent = workspace
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));

    if !workspace_parent.exists() {
        fs::create_dir_all(&workspace_parent)
            .map_err(|e| format!("Failed to prepare workspace parent directory: {}", e))?;
    }

    let temp_dir = TempDirBuilder::new()
        .prefix("gtdspace-restore-")
        .tempdir_in(&workspace_parent)
        .map_err(|e| format!("Failed to create temporary restore directory: {}", e))?;

    {
        let cursor = Cursor::new(archive);
        let decoder = GzDecoder::new(cursor);
        let mut tar = Archive::new(decoder);
        tar.unpack(temp_dir.path())
            .map_err(|e| format!("Failed to unpack archive: {}", e))?;
    }

    #[allow(deprecated)]
    let temp_restore_path = temp_dir.into_path();
    let mut backup_path: Option<PathBuf> = None;

    if workspace.exists() {
        let backup_dir = TempDirBuilder::new()
            .prefix("gtdspace-workspace-backup-")
            .tempdir_in(&workspace_parent)
            .map_err(|e| format!("Failed to prepare workspace backup directory: {}", e))?;
        #[allow(deprecated)]
        let backup_dir_path = backup_dir.into_path();
        fs::remove_dir(&backup_dir_path)
            .map_err(|e| format!("Failed to prepare workspace backup path: {}", e))?;
        fs::rename(workspace, &backup_dir_path)
            .map_err(|e| format!("Failed to back up existing workspace: {}", e))?;
        backup_path = Some(backup_dir_path);
    }

    match fs::rename(&temp_restore_path, workspace) {
        Ok(()) => {
            if let Some(backup) = backup_path {
                if let Err(err) = fs::remove_dir_all(&backup) {
                    warn!(
                        "Failed to remove temporary workspace backup {}: {}",
                        backup.display(),
                        err
                    );
                }
            }
            Ok(())
        }
        Err(err) => {
            if let Some(backup) = &backup_path {
                if let Err(revert_err) = fs::rename(backup, workspace) {
                    warn!(
                        "Failed to restore original workspace from backup {}: {}",
                        backup.display(),
                        revert_err
                    );
                }
            }

            if let Err(clean_err) = fs::remove_dir_all(&temp_restore_path) {
                warn!(
                    "Failed to clean temporary restore directory {}: {}",
                    temp_restore_path.display(),
                    clean_err
                );
            }

            Err(format!(
                "Failed to replace workspace after restore: {}",
                err
            ))
        }
    }
}

fn list_backups(backups_dir: &Path) -> Result<Vec<BackupEntry>, String> {
    if !backups_dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(backups_dir).map_err(|e| format!("Failed to list backups: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to enumerate backups: {}", e))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if path.extension().and_then(|ext| ext.to_str()) != Some("enc") {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata for {}: {}", path.display(), e))?;
        let modified = metadata.modified().unwrap_or_else(|_| SystemTime::now());
        entries.push(BackupEntry {
            file_name: path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| "backup.enc".to_string()),
            modified,
            _size: metadata.len(),
        });
    }

    entries.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(entries)
}

fn prune_history(backups_dir: &Path, keep: usize) -> Result<(), String> {
    let entries = list_backups(backups_dir)?;
    if entries.len() <= keep {
        return Ok(());
    }

    for entry in entries.into_iter().skip(keep) {
        let path = backups_dir.join(&entry.file_name);
        if let Err(err) = fs::remove_file(&path) {
            warn!("Failed to delete old backup {}: {}", path.display(), err);
        }
    }

    Ok(())
}

fn ensure_remote(repo_path: &Path, remote_url: &str) -> Result<(), String> {
    let remotes = run_git_command(repo_path, ["remote"]).unwrap_or_default();
    if remotes.lines().any(|line| line.trim() == REMOTE_NAME) {
        run_git_command(repo_path, ["remote", "set-url", REMOTE_NAME, remote_url])?;
    } else {
        run_git_command(repo_path, ["remote", "add", REMOTE_NAME, remote_url])?;
    }
    Ok(())
}

fn run_git_command<I, S>(repo_path: &Path, args: I) -> Result<String, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let output = Command::new("git")
        .current_dir(repo_path)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Git command failed: {}", stderr.trim()))
    }
}

fn system_time_to_iso(time: SystemTime) -> Option<String> {
    let datetime: DateTime<Utc> = time.into();
    Some(datetime.to_rfc3339())
}
