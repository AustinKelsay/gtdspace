use super::settings::UserSettings;
use aes_gcm::{
    aead::{
        stream::{DecryptorBE32, EncryptorBE32, StreamBE32},
        Aead, KeyInit,
    },
    Aes256Gcm, Nonce as AeadNonce,
};
use chrono::{DateTime, Utc};
use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use log::{debug, info, warn};
use mime_guess::MimeGuess;
use pbkdf2::pbkdf2_hmac;
use rand::RngExt;
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use similar::{ChangeTag, TextDiff};
use std::ffi::OsStr;
use std::fmt;
use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;
use tar::{Archive, Builder as TarBuilder};
use tempfile::Builder as TempDirBuilder;
use walkdir::WalkDir;

const LEGACY_MAGIC_HEADER: &[u8; 8] = b"GTDENC01";
const STREAM_MAGIC_HEADER: &[u8; 8] = b"GTDENC02";
const STREAM_NONCE_LEN: usize = 7;
const LEGACY_NONCE_LEN: usize = 12;
const PBKDF2_ITERATIONS: u32 = 600_000;
const REMOTE_NAME: &str = "origin";
const MIN_KEEP_HISTORY: usize = 1;
const MAX_KEEP_HISTORY: usize = 20;
const PLAINTEXT_CHUNK_SIZE: usize = 64 * 1024;
const TAG_SIZE: usize = 16;
const PREVIEW_MAX_CHANGED_FILES: usize = 500;
const PREVIEW_MAX_TEXT_BYTES_PER_SIDE: usize = 200 * 1024;
const PREVIEW_MAX_TOTAL_PAYLOAD_BYTES: usize = 2 * 1024 * 1024;
#[cfg(not(test))]
const SECURE_STORAGE_SERVICE: &str = "com.gtdspace.app";
#[cfg(not(test))]
const GIT_SYNC_ENCRYPTION_KEY_NAME: &str = "git_sync_encryption_key";

#[cfg(test)]
fn load_secure_encryption_key() -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(not(test))]
fn load_secure_encryption_key() -> Result<Option<String>, String> {
    match keyring::Entry::new(SECURE_STORAGE_SERVICE, GIT_SYNC_ENCRYPTION_KEY_NAME) {
        Ok(entry) => match entry.get_password() {
            Ok(password) => Ok(Some(password)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(err) => Err(err.to_string()),
        },
        Err(err) => Err(err.to_string()),
    }
}

#[derive(Clone)]
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

impl fmt::Debug for GitSyncConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("GitSyncConfig")
            .field("repo_path", &self.repo_path)
            .field("workspace_path", &self.workspace_path)
            .field("remote_url", &self.remote_url)
            .field("branch", &self.branch)
            .field("encryption_key", &"<redacted>")
            .field("keep_history", &self.keep_history)
            .field("author_name", &self.author_name)
            .field("author_email", &self.author_email)
            .finish()
    }
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

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncPreviewResponse {
    pub has_baseline: bool,
    pub baseline_backup_file: Option<String>,
    pub baseline_timestamp: Option<String>,
    pub summary: GitSyncPreviewSummary,
    pub entries: Vec<GitSyncDiffEntry>,
    pub truncated: bool,
    pub warnings: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncPreviewSummary {
    pub total_entries: usize,
    pub added: usize,
    pub modified: usize,
    pub deleted: usize,
    pub renamed: usize,
    pub unchanged_excluded: usize,
    pub text_diffs: usize,
    pub binary_diffs: usize,
    pub before_bytes: Option<u64>,
    pub after_bytes: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncDiffEntry {
    pub id: String,
    pub path: String,
    pub change_type: String,
    pub kind: String,
    pub old_path: Option<String>,
    pub is_truncated: Option<bool>,
    pub text: Option<GitSyncTextDiff>,
    pub binary: Option<GitSyncBinaryDiff>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncTextDiff {
    pub before_hash: Option<String>,
    pub after_hash: Option<String>,
    pub before_bytes: u64,
    pub after_bytes: u64,
    pub hunks: Vec<GitSyncTextHunk>,
    pub line_stats: GitSyncLineStats,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncTextHunk {
    pub old_start: usize,
    pub old_lines: usize,
    pub new_start: usize,
    pub new_lines: usize,
    pub lines: Vec<GitSyncDiffLine>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncDiffLine {
    pub kind: String,
    pub old_line_number: Option<usize>,
    pub new_line_number: Option<usize>,
    pub content: String,
}

#[derive(Debug, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncLineStats {
    pub added: usize,
    pub removed: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitSyncBinaryDiff {
    pub before_hash: Option<String>,
    pub after_hash: Option<String>,
    pub before_bytes: Option<u64>,
    pub after_bytes: Option<u64>,
    pub mime: Option<String>,
}

#[derive(Debug, Clone)]
struct ManifestEntry {
    relative_path: String,
    size: u64,
    hash: String,
    is_text: bool,
    text: Option<String>,
    mime: Option<String>,
}

#[derive(Debug)]
struct PreviewComputation {
    summary: GitSyncPreviewSummary,
    entries: Vec<GitSyncDiffEntry>,
    truncated: bool,
    warnings: Vec<String>,
}

pub fn compute_git_status(
    settings: &UserSettings,
    workspace_override: Option<String>,
) -> GitSyncStatusResponse {
    let enabled = settings.git_sync_enabled.unwrap_or(false);
    let encryption_configured = if enabled {
        // Check secure storage for encryption key; fall back to legacy settings value if needed
        match load_secure_encryption_key() {
            Ok(Some(value)) if !value.trim().is_empty() => true,
            Ok(Some(_)) | Ok(None) => settings
                .git_sync_encryption_key
                .as_ref()
                .map(|legacy_key| !legacy_key.trim().is_empty())
                .unwrap_or(false),
            Err(err) => {
                if let Some(legacy_key) = &settings.git_sync_encryption_key {
                    warn!(
                        "Secure storage locked/unavailable ({}). Falling back to legacy encryption key for status",
                        err
                    );
                    !legacy_key.trim().is_empty()
                } else {
                    false
                }
            }
        }
    } else {
        settings
            .git_sync_encryption_key
            .as_ref()
            .map(|legacy_key| !legacy_key.trim().is_empty())
            .unwrap_or(false)
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
    let encryption_key = match load_secure_encryption_key() {
        Ok(Some(password)) if !password.trim().is_empty() => password,
        Ok(Some(_)) | Ok(None) => settings
            .git_sync_encryption_key
            .clone()
            .ok_or_else(|| "Encryption key has not been set".to_string())?,
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
    };

    if encryption_key.trim().is_empty() {
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

/// Verify that only encrypted backup files are staged in git
fn verify_only_encrypted_files_staged(repo_path: &Path) -> Result<(), String> {
    let staged_output = run_git_command(repo_path, ["diff", "--cached", "--name-only"])?;

    if staged_output.trim().is_empty() {
        return Ok(()); // Nothing staged, which is fine
    }

    for line in staged_output.lines() {
        let path = line.trim();
        if path.is_empty() {
            continue;
        }

        // Only allow .gitignore and files in backups/ directory
        if path == ".gitignore" {
            continue;
        }

        if !path.starts_with("backups/") {
            return Err(format!(
                "Safety check failed: Non-backup file staged: {}. Only encrypted backups should be committed.",
                path
            ));
        }

        // Verify the file has .enc extension
        if !path.ends_with(".enc") {
            return Err(format!(
                "Safety check failed: File in backups/ does not have .enc extension: {}. Only encrypted files are allowed.",
                path
            ));
        }
    }

    Ok(())
}

pub fn preview_git_push(config: GitSyncConfig) -> Result<GitSyncPreviewResponse, String> {
    let backups_dir = config.repo_path.join("backups");
    if !config.repo_path.exists() {
        return Err("Git sync repository does not exist".to_string());
    }

    let latest_backup = list_backups(&backups_dir)?.into_iter().next();
    let current_manifest = build_workspace_manifest(&config.workspace_path)?;

    let (has_baseline, baseline_backup_file, baseline_timestamp, baseline_manifest) =
        if let Some(backup) = latest_backup {
            let backup_path = backups_dir.join(&backup.file_name);
            let temp_decrypt_dir = TempDirBuilder::new()
                .prefix("gtdspace-preview-decrypt-")
                .tempdir()
                .map_err(|e| format!("Failed to prepare temporary decrypt directory: {}", e))?;
            let decrypted_archive = temp_decrypt_dir.path().join("workspace.tar.gz");
            decrypt_file_to_path(&config.encryption_key, &backup_path, &decrypted_archive)?;

            let temp_extract_dir = TempDirBuilder::new()
                .prefix("gtdspace-preview-baseline-")
                .tempdir()
                .map_err(|e| format!("Failed to prepare temporary baseline directory: {}", e))?;
            extract_archive_to_dir(&decrypted_archive, temp_extract_dir.path())?;

            (
                true,
                Some(backup.file_name),
                system_time_to_iso(backup.modified),
                build_workspace_manifest(temp_extract_dir.path())?,
            )
        } else {
            (false, None, None, Vec::new())
        };

    let PreviewComputation {
        summary,
        entries,
        truncated,
        warnings,
    } = compare_manifests(&baseline_manifest, &current_manifest);

    Ok(GitSyncPreviewResponse {
        has_baseline,
        baseline_backup_file,
        baseline_timestamp,
        summary,
        entries,
        truncated,
        warnings: (!warnings.is_empty()).then_some(warnings),
    })
}

pub fn perform_git_push(
    config: GitSyncConfig,
    force: bool,
) -> Result<GitOperationResultPayload, String> {
    ensure_repo(&config)?;
    ensure_gitignore(&config.repo_path)?;
    let backups_dir = config.repo_path.join("backups");
    fs::create_dir_all(&backups_dir)
        .map_err(|e| format!("Failed to create backups directory: {}", e))?;

    let temp_archive_dir = TempDirBuilder::new()
        .prefix("gtdspace-archive-")
        .tempdir()
        .map_err(|e| format!("Failed to prepare temporary archive directory: {}", e))?;
    let archive_path = temp_archive_dir.path().join("workspace.tar.gz");
    create_workspace_archive(&config.workspace_path, &archive_path)?;

    let now = Utc::now();
    let slug = format!(
        "{}{:03}",
        now.format("%Y%m%dT%H%M%S"),
        now.timestamp_subsec_millis()
    );
    let backup_file = format!("backup-{}.tar.gz.enc", slug);
    let backup_path = backups_dir.join(&backup_file);

    encrypt_file_to_path(&config.encryption_key, &archive_path, &backup_path)?;

    prune_history(&backups_dir, config.keep_history)?;

    run_git_command(&config.repo_path, ["add", "backups"])?;

    // Safety check: verify only encrypted files are staged
    verify_only_encrypted_files_staged(&config.repo_path)?;

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

            if force {
                // Force push with lease to avoid overwriting if remote has new commits
                // --force-with-lease is safer than --force as it checks remote refs
                match run_git_command(
                    &config.repo_path,
                    ["push", "--force-with-lease", "-u", REMOTE_NAME, &branch_ref],
                ) {
                    Ok(_) => {
                        pushed = true;
                    }
                    Err(e) => {
                        // If --force-with-lease fails, fall back to regular --force
                        // but only after warning
                        warn!(
                            "Force-with-lease failed: {}. Attempting regular force push.",
                            e
                        );
                        run_git_command(
                            &config.repo_path,
                            ["push", "--force", "-u", REMOTE_NAME, &branch_ref],
                        )?;
                        pushed = true;
                    }
                }
            } else {
                run_git_command(&config.repo_path, ["push", "-u", REMOTE_NAME, &branch_ref])?;
                pushed = true;
            }
        }
    }

    Ok(GitOperationResultPayload {
        success: true,
        message: if force {
            "Encrypted snapshot created and force pushed".to_string()
        } else {
            "Encrypted snapshot created".to_string()
        },
        backup_file: Some(backup_file),
        timestamp: Some(now.to_rfc3339()),
        pushed,
        details: Some(json!({
            "repoPath": config.repo_path,
            "workspacePath": config.workspace_path,
            "branch": config.branch,
            "force": force,
        })),
    })
}

fn build_workspace_manifest(root: &Path) -> Result<Vec<ManifestEntry>, String> {
    let mut entries = Vec::new();

    for entry in WalkDir::new(root).into_iter() {
        let entry = entry.map_err(|e| format!("Failed to walk workspace: {}", e))?;
        let path = entry.path();
        if path == root {
            continue;
        }

        let relative = path
            .strip_prefix(root)
            .map_err(|e| format!("Failed to determine relative path: {}", e))?;

        if should_skip_path(relative) {
            continue;
        }

        if !entry.file_type().is_file() {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata for {}: {}", path.display(), e))?;
        let relative_path = relative.to_string_lossy().replace('\\', "/");
        let mime = guess_mime(&relative_path);
        let size = metadata.len();

        let (hash, is_text, text) = if size as usize > PREVIEW_MAX_TEXT_BYTES_PER_SIDE {
            let (hash, sample) = hash_file_with_sample(path, PREVIEW_MAX_TEXT_BYTES_PER_SIDE)?;
            let is_text = classify_text(&sample).is_some();
            (hash, is_text, None)
        } else {
            let bytes = fs::read(path)
                .map_err(|e| format!("Failed to read workspace file {}: {}", path.display(), e))?;
            let hash = hash_bytes(&bytes);
            let text = classify_text(&bytes);
            let is_text = text.is_some();
            (hash, is_text, text)
        };

        entries.push(ManifestEntry {
            relative_path,
            size,
            hash,
            is_text,
            text,
            mime,
        });
    }

    entries.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(entries)
}

fn compare_manifests(before: &[ManifestEntry], after: &[ManifestEntry]) -> PreviewComputation {
    let before_map: std::collections::HashMap<String, &ManifestEntry> = before
        .iter()
        .map(|entry| (entry.relative_path.clone(), entry))
        .collect();
    let after_map: std::collections::HashMap<String, &ManifestEntry> = after
        .iter()
        .map(|entry| (entry.relative_path.clone(), entry))
        .collect();

    let mut all_paths: Vec<String> = before_map.keys().chain(after_map.keys()).cloned().collect();
    all_paths.sort();
    all_paths.dedup();

    let mut summary = GitSyncPreviewSummary::default();
    let before_total_bytes = before.iter().map(|entry| entry.size).sum::<u64>();
    let after_total_bytes = after.iter().map(|entry| entry.size).sum::<u64>();
    summary.before_bytes = Some(before_total_bytes);
    summary.after_bytes = Some(after_total_bytes);

    let mut modified_entries = Vec::new();
    let mut deleted_entries = Vec::new();
    let mut added_entries = Vec::new();
    let mut unchanged_excluded = 0usize;

    for path in &all_paths {
        match (before_map.get(path), after_map.get(path)) {
            (Some(left), Some(right)) => {
                if left.hash == right.hash {
                    unchanged_excluded += 1;
                } else {
                    modified_entries.push(build_diff_entry(Some(left), Some(right), "modified"));
                }
            }
            (Some(left), None) => deleted_entries.push((*left).clone()),
            (None, Some(right)) => added_entries.push((*right).clone()),
            (None, None) => {}
        }
    }

    let mut rename_entries = Vec::new();
    let mut remaining_deleted = Vec::new();
    let mut remaining_added = Vec::new();

    let mut deleted_by_hash: std::collections::HashMap<&str, Vec<&ManifestEntry>> =
        std::collections::HashMap::new();
    let mut added_by_hash: std::collections::HashMap<&str, Vec<&ManifestEntry>> =
        std::collections::HashMap::new();

    for entry in &deleted_entries {
        deleted_by_hash
            .entry(entry.hash.as_str())
            .or_default()
            .push(entry);
    }
    for entry in &added_entries {
        added_by_hash
            .entry(entry.hash.as_str())
            .or_default()
            .push(entry);
    }

    let mut consumed_deleted = std::collections::HashSet::new();
    let mut consumed_added = std::collections::HashSet::new();

    for (hash, deleted) in &deleted_by_hash {
        if let Some(added) = added_by_hash.get(hash) {
            if deleted.len() == 1 && added.len() == 1 {
                let left = deleted[0];
                let right = added[0];
                consumed_deleted.insert(left.relative_path.clone());
                consumed_added.insert(right.relative_path.clone());
                rename_entries.push(build_diff_entry(Some(left), Some(right), "renamed"));
            }
        }
    }

    for entry in deleted_entries {
        if !consumed_deleted.contains(&entry.relative_path) {
            remaining_deleted.push(entry);
        }
    }
    for entry in added_entries {
        if !consumed_added.contains(&entry.relative_path) {
            remaining_added.push(entry);
        }
    }

    rename_entries.sort_by(|a, b| a.path.cmp(&b.path));
    modified_entries.sort_by(|a, b| a.path.cmp(&b.path));
    remaining_added.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    remaining_deleted.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    let mut entries = Vec::new();
    entries.extend(rename_entries);
    entries.extend(modified_entries);
    entries.extend(
        remaining_added
            .iter()
            .map(|entry| build_diff_entry(None, Some(entry), "added")),
    );
    entries.extend(
        remaining_deleted
            .iter()
            .map(|entry| build_diff_entry(Some(entry), None, "deleted")),
    );

    summary.total_entries = entries.len();
    summary.unchanged_excluded = unchanged_excluded;
    summary.renamed = entries
        .iter()
        .filter(|entry| entry.change_type == "renamed")
        .count();
    summary.modified = entries
        .iter()
        .filter(|entry| entry.change_type == "modified")
        .count();
    summary.added = entries
        .iter()
        .filter(|entry| entry.change_type == "added")
        .count();
    summary.deleted = entries
        .iter()
        .filter(|entry| entry.change_type == "deleted")
        .count();
    summary.text_diffs = entries.iter().filter(|entry| entry.kind == "text").count();
    summary.binary_diffs = entries
        .iter()
        .filter(|entry| entry.kind == "binary")
        .count();

    let mut warnings = Vec::new();
    let mut truncated = entries
        .iter()
        .any(|entry| entry.is_truncated.unwrap_or(false));

    if entries.len() > PREVIEW_MAX_CHANGED_FILES {
        entries.truncate(PREVIEW_MAX_CHANGED_FILES);
        truncated = true;
        warnings.push(format!(
            "Preview limited to the first {} changed files.",
            PREVIEW_MAX_CHANGED_FILES
        ));
    }

    let mut payload_bytes = 0usize;
    for entry in &mut entries {
        let mut entry_bytes = estimate_entry_payload_bytes(entry);
        if payload_bytes.saturating_add(entry_bytes) > PREVIEW_MAX_TOTAL_PAYLOAD_BYTES
            && !entry.is_truncated.unwrap_or(false)
        {
            entry.is_truncated = Some(true);
            entry.text = None;
            entry.binary = entry.binary.take();
            truncated = true;
            entry_bytes = estimate_entry_payload_bytes(entry);
        }

        if entry.is_truncated.unwrap_or(false) {
            truncated = true;
            entry_bytes = 0;
        }

        payload_bytes = payload_bytes.saturating_add(entry_bytes);
    }

    if entries
        .iter()
        .any(|entry| entry.is_truncated.unwrap_or(false))
    {
        truncated = true;
    }

    if truncated && !warnings.iter().any(|warning| warning.contains("truncated")) {
        warnings
            .push("Preview contains truncated entries to keep the diff responsive.".to_string());
    }

    PreviewComputation {
        summary,
        entries,
        truncated,
        warnings,
    }
}

fn build_diff_entry(
    before: Option<&ManifestEntry>,
    after: Option<&ManifestEntry>,
    change_type: &str,
) -> GitSyncDiffEntry {
    let path = after
        .map(|entry| entry.relative_path.clone())
        .or_else(|| before.map(|entry| entry.relative_path.clone()))
        .unwrap_or_default();
    let old_path = (change_type == "renamed").then(|| {
        before
            .map(|entry| entry.relative_path.clone())
            .unwrap_or_default()
    });

    let effective_entry = after
        .or(before)
        .expect("diff entry requires at least one side");
    let kind = if before.map(|entry| entry.is_text).unwrap_or(false)
        || after.map(|entry| entry.is_text).unwrap_or(false)
    {
        "text"
    } else {
        "binary"
    };

    let mut entry = GitSyncDiffEntry {
        id: format!("{}:{}", change_type, path),
        path,
        change_type: change_type.to_string(),
        kind: kind.to_string(),
        old_path,
        is_truncated: None,
        text: None,
        binary: None,
    };

    if kind == "text" {
        let before_bytes = before.map(|item| item.size).unwrap_or(0);
        let after_bytes = after.map(|item| item.size).unwrap_or(0);
        let before_text = before.and_then(|item| item.text.as_deref()).unwrap_or("");
        let after_text = after.and_then(|item| item.text.as_deref()).unwrap_or("");

        let should_truncate = before_bytes as usize > PREVIEW_MAX_TEXT_BYTES_PER_SIDE
            || after_bytes as usize > PREVIEW_MAX_TEXT_BYTES_PER_SIDE;

        if should_truncate {
            entry.is_truncated = Some(true);
        } else {
            entry.text = Some(build_text_diff(before, after, before_text, after_text));
        }
    } else {
        entry.binary = Some(GitSyncBinaryDiff {
            before_hash: before.map(|item| item.hash.clone()),
            after_hash: after.map(|item| item.hash.clone()),
            before_bytes: before.map(|item| item.size),
            after_bytes: after.map(|item| item.size),
            mime: after
                .and_then(|item| item.mime.clone())
                .or_else(|| before.and_then(|item| item.mime.clone()))
                .or_else(|| effective_entry.mime.clone()),
        });
    }

    entry
}

fn build_text_diff(
    before: Option<&ManifestEntry>,
    after: Option<&ManifestEntry>,
    before_text: &str,
    after_text: &str,
) -> GitSyncTextDiff {
    let diff = TextDiff::from_lines(before_text, after_text);
    let mut line_stats = GitSyncLineStats::default();
    let mut hunks = Vec::new();

    for group in diff.grouped_ops(3) {
        let mut lines = Vec::new();
        let mut old_start = 0usize;
        let mut old_lines = 0usize;
        let mut new_start = 0usize;
        let mut new_lines = 0usize;
        let mut first = true;

        for op in group {
            if first {
                old_start = op.old_range().start + 1;
                old_lines = op.old_range().len();
                new_start = op.new_range().start + 1;
                new_lines = op.new_range().len();
                first = false;
            } else {
                old_lines += op.old_range().len();
                new_lines += op.new_range().len();
            }

            for change in diff.iter_changes(&op) {
                let kind = match change.tag() {
                    ChangeTag::Delete => {
                        line_stats.removed += 1;
                        "remove"
                    }
                    ChangeTag::Insert => {
                        line_stats.added += 1;
                        "add"
                    }
                    ChangeTag::Equal => "context",
                };
                lines.push(GitSyncDiffLine {
                    kind: kind.to_string(),
                    old_line_number: change.old_index().map(|index| index + 1),
                    new_line_number: change.new_index().map(|index| index + 1),
                    content: sanitize_diff_line_content(change.as_str().unwrap_or("")),
                });
            }
        }

        hunks.push(GitSyncTextHunk {
            old_start,
            old_lines,
            new_start,
            new_lines,
            lines,
        });
    }

    GitSyncTextDiff {
        before_hash: before.map(|entry| entry.hash.clone()),
        after_hash: after.map(|entry| entry.hash.clone()),
        before_bytes: before.map(|entry| entry.size).unwrap_or(0),
        after_bytes: after.map(|entry| entry.size).unwrap_or(0),
        hunks,
        line_stats,
    }
}

fn sanitize_diff_line_content(value: &str) -> String {
    value
        .trim_end_matches('\n')
        .trim_end_matches('\r')
        .to_string()
}

fn classify_text(bytes: &[u8]) -> Option<String> {
    if bytes.contains(&0) {
        return None;
    }

    String::from_utf8(bytes.to_vec()).ok()
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    encode_hex(&hasher.finalize())
}

fn hash_file_with_sample(path: &Path, sample_limit: usize) -> Result<(String, Vec<u8>), String> {
    let file = File::open(path)
        .map_err(|e| format!("Failed to open file for hashing {}: {}", path.display(), e))?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut sample = Vec::with_capacity(sample_limit.min(PLAINTEXT_CHUNK_SIZE));
    let mut buffer = vec![0u8; PLAINTEXT_CHUNK_SIZE];

    loop {
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|e| format!("Failed to hash file {}: {}", path.display(), e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
        if sample.len() < sample_limit {
            let remaining = sample_limit - sample.len();
            let sample_bytes = remaining.min(bytes_read);
            sample.extend_from_slice(&buffer[..sample_bytes]);
        }
    }

    Ok((encode_hex(&hasher.finalize()), sample))
}

fn encode_hex(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        use std::fmt::Write as _;
        let _ = write!(&mut output, "{:02x}", byte);
    }
    output
}

fn guess_mime(path: &str) -> Option<String> {
    MimeGuess::from_path(path)
        .first_raw()
        .map(std::string::ToString::to_string)
}

fn estimate_entry_payload_bytes(entry: &GitSyncDiffEntry) -> usize {
    let mut total = entry.id.len() + entry.path.len() + entry.change_type.len() + entry.kind.len();
    if let Some(old_path) = &entry.old_path {
        total += old_path.len();
    }
    if let Some(text) = &entry.text {
        total += text
            .hunks
            .iter()
            .flat_map(|hunk| hunk.lines.iter())
            .map(|line| line.content.len() + line.kind.len() + 16)
            .sum::<usize>();
    }
    if let Some(binary) = &entry.binary {
        total += binary.before_hash.as_deref().unwrap_or("").len();
        total += binary.after_hash.as_deref().unwrap_or("").len();
        total += binary.mime.as_deref().unwrap_or("").len();
    }
    total
}

pub fn perform_git_pull(
    config: GitSyncConfig,
    force: bool,
) -> Result<GitOperationResultPayload, String> {
    ensure_repo(&config)?;
    let backups_dir = config.repo_path.join("backups");
    fs::create_dir_all(&backups_dir)
        .map_err(|e| format!("Failed to create backups directory: {}", e))?;

    if let Some(remote_url) = &config.remote_url {
        if !remote_url.trim().is_empty() {
            ensure_remote(&config.repo_path, remote_url)?;
            run_git_command(&config.repo_path, ["fetch", REMOTE_NAME])?;

            if force {
                // Force pull: reset local branch to match remote exactly
                let remote_ref = format!("{}/{}", REMOTE_NAME, config.branch);
                run_git_command(&config.repo_path, ["reset", "--hard", &remote_ref])?;
            } else {
                // Normal pull: only fast-forward merge
                run_git_command(
                    &config.repo_path,
                    ["pull", "--ff-only", REMOTE_NAME, &config.branch],
                )?;
            }
        }
    }

    ensure_gitignore(&config.repo_path)?;

    let latest_backup = list_backups(&backups_dir)?
        .into_iter()
        .next()
        .ok_or_else(|| "No backups are available to restore".to_string())?;

    let backup_path = backups_dir.join(&latest_backup.file_name);
    let temp_decrypt_dir = TempDirBuilder::new()
        .prefix("gtdspace-decrypt-")
        .tempdir()
        .map_err(|e| format!("Failed to prepare temporary decrypt directory: {}", e))?;
    let decrypted_archive = temp_decrypt_dir.path().join("workspace.tar.gz");
    decrypt_file_to_path(&config.encryption_key, &backup_path, &decrypted_archive)?;

    restore_workspace(&config.workspace_path, &decrypted_archive)?;

    Ok(GitOperationResultPayload {
        success: true,
        message: if force {
            "Workspace force restored from encrypted backup (local changes discarded)".to_string()
        } else {
            "Workspace restored from encrypted backup".to_string()
        },
        backup_file: Some(latest_backup.file_name),
        timestamp: system_time_to_iso(latest_backup.modified),
        pushed: false,
        details: Some(json!({
            "workspacePath": config.workspace_path,
            "force": force,
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

fn create_workspace_archive(workspace: &Path, output_path: &Path) -> Result<(), String> {
    if !workspace.is_dir() {
        return Err("Workspace must be a directory".to_string());
    }

    let file = File::create(output_path).map_err(|e| {
        format!(
            "Failed to prepare archive file {}: {}",
            output_path.display(),
            e
        )
    })?;
    let buf_writer = BufWriter::new(file);
    let encoder = GzEncoder::new(buf_writer, Compression::default());
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
    let mut writer = encoder
        .finish()
        .map_err(|e| format!("Failed to finish compression: {}", e))?;
    writer
        .flush()
        .map_err(|e| format!("Failed to flush archive writer: {}", e))?;
    writer
        .into_inner()
        .map_err(|e| format!("Failed to finalize archive file: {}", e))?
        .sync_all()
        .map_err(|e| format!("Failed to sync archive file: {}", e))?;
    Ok(())
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

fn encrypt_file_to_path(
    passphrase: &str,
    input_path: &Path,
    output_path: &Path,
) -> Result<(), String> {
    if passphrase.trim().is_empty() {
        return Err("Encryption key cannot be empty".to_string());
    }

    let input_file = File::open(input_path)
        .map_err(|e| format!("Failed to open archive {}: {}", input_path.display(), e))?;
    let total_len = input_file
        .metadata()
        .map_err(|e| format!("Failed to read archive metadata: {}", e))?
        .len();
    let mut reader = BufReader::new(input_file);

    let output_file = File::create(output_path)
        .map_err(|e| format!("Failed to create backup {}: {}", output_path.display(), e))?;
    let mut writer = BufWriter::new(output_file);

    let mut salt = [0u8; 16];
    let mut nonce_bytes = [0u8; STREAM_NONCE_LEN];
    let mut rng = rand::rng();
    rng.fill(&mut salt);
    rng.fill(&mut nonce_bytes);

    writer
        .write_all(STREAM_MAGIC_HEADER)
        .map_err(|e| format!("Failed to write backup header: {}", e))?;
    writer
        .write_all(&salt)
        .map_err(|e| format!("Failed to write salt: {}", e))?;
    writer
        .write_all(&nonce_bytes)
        .map_err(|e| format!("Failed to write nonce: {}", e))?;

    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(passphrase.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Failed to initialize cipher: {}", e))?;

    let nonce = StreamNonce::from_slice(&nonce_bytes);
    let mut encryptor = EncryptorBE32::from_aead(cipher, nonce);

    if total_len == 0 {
        let chunk = encryptor
            .encrypt_last(&[] as &[u8])
            .map_err(|_| "Encryption failed when finalizing empty archive".to_string())?;
        writer
            .write_all(&chunk)
            .map_err(|e| format!("Failed to write encrypted chunk: {}", e))?;
    } else {
        let mut current = vec![0u8; PLAINTEXT_CHUNK_SIZE];
        let mut current_len = read_chunk(&mut reader, &mut current)
            .map_err(|e| format!("Failed to read archive data: {}", e))?;
        if current_len == 0 {
            let chunk = encryptor
                .encrypt_last(&[] as &[u8])
                .map_err(|_| "Encryption failed when finalizing empty archive".to_string())?;
            writer
                .write_all(&chunk)
                .map_err(|e| format!("Failed to write encrypted chunk: {}", e))?;
        } else {
            let mut next_buf = vec![0u8; PLAINTEXT_CHUNK_SIZE];
            loop {
                let next_len = read_chunk(&mut reader, &mut next_buf)
                    .map_err(|e| format!("Failed to read archive data: {}", e))?;
                if next_len == 0 {
                    let chunk = encryptor
                        .encrypt_last(&current[..current_len])
                        .map_err(|_| "Encryption failed while finalizing backup".to_string())?;
                    writer
                        .write_all(&chunk)
                        .map_err(|e| format!("Failed to write encrypted chunk: {}", e))?;
                    break;
                } else {
                    let chunk = encryptor
                        .encrypt_next(&current[..current_len])
                        .map_err(|_| "Encryption failed while streaming backup".to_string())?;
                    writer
                        .write_all(&chunk)
                        .map_err(|e| format!("Failed to write encrypted chunk: {}", e))?;
                    std::mem::swap(&mut current, &mut next_buf);
                    current_len = next_len;
                }
            }
        }
    }

    writer
        .flush()
        .map_err(|e| format!("Failed to flush encrypted backup: {}", e))?;
    writer
        .into_inner()
        .map_err(|e| format!("Failed to finalize encrypted backup: {}", e))?
        .sync_all()
        .map_err(|e| format!("Failed to sync encrypted backup: {}", e))
}

fn decrypt_file_to_path(
    passphrase: &str,
    backup_path: &Path,
    output_path: &Path,
) -> Result<(), String> {
    let backup_file = File::open(backup_path)
        .map_err(|e| format!("Failed to open backup {}: {}", backup_path.display(), e))?;
    let total_len = backup_file
        .metadata()
        .map_err(|e| format!("Failed to read backup metadata: {}", e))?
        .len();
    if total_len < (STREAM_MAGIC_HEADER.len() + 16 + STREAM_NONCE_LEN) as u64 {
        return Err("Encrypted payload is too short".to_string());
    }

    let mut reader = BufReader::new(backup_file);
    let mut header = [0u8; STREAM_MAGIC_HEADER.len()];
    reader
        .read_exact(&mut header)
        .map_err(|e| format!("Failed to read backup header: {}", e))?;
    enum BackupFormat {
        Legacy,
        Stream,
    }
    let format = if header == *STREAM_MAGIC_HEADER {
        BackupFormat::Stream
    } else if header == *LEGACY_MAGIC_HEADER {
        BackupFormat::Legacy
    } else {
        return Err("Invalid encrypted payload header".to_string());
    };

    let mut salt = [0u8; 16];
    reader
        .read_exact(&mut salt)
        .map_err(|e| format!("Failed to read salt: {}", e))?;

    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(passphrase.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key);

    let mut writer = BufWriter::new(
        File::create(output_path)
            .map_err(|e| format!("Failed to create decrypted archive: {}", e))?,
    );

    match format {
        BackupFormat::Stream => {
            let mut nonce_bytes = [0u8; STREAM_NONCE_LEN];
            reader
                .read_exact(&mut nonce_bytes)
                .map_err(|e| format!("Failed to read nonce: {}", e))?;

            let cipher = Aes256Gcm::new_from_slice(&key)
                .map_err(|e| format!("Failed to initialize cipher: {}", e))?;
            let nonce = StreamNonce::from_slice(&nonce_bytes);
            let mut decryptor = DecryptorBE32::from_aead(cipher, nonce);

            let mut remaining = total_len
                .checked_sub((STREAM_MAGIC_HEADER.len() + 16 + STREAM_NONCE_LEN) as u64)
                .ok_or_else(|| "Encrypted payload is too short".to_string())?;
            let chunk_with_tag = PLAINTEXT_CHUNK_SIZE + TAG_SIZE;
            let mut buffer = vec![0u8; chunk_with_tag];

            while remaining > 0 {
                let chunk_len = if remaining as usize > chunk_with_tag {
                    chunk_with_tag
                } else {
                    remaining as usize
                };

                reader
                    .read_exact(&mut buffer[..chunk_len])
                    .map_err(|e| format!("Failed to read encrypted chunk: {}", e))?;
                remaining -= chunk_len as u64;

                if remaining == 0 {
                    let plaintext = decryptor
                        .decrypt_last(&buffer[..chunk_len])
                        .map_err(|_| "Decryption failed while finalizing backup".to_string())?;
                    writer
                        .write_all(&plaintext)
                        .map_err(|e| format!("Failed to write decrypted chunk: {}", e))?;
                    break;
                } else {
                    let plaintext = decryptor
                        .decrypt_next(&buffer[..chunk_len])
                        .map_err(|_| "Decryption failed while streaming backup".to_string())?;
                    writer
                        .write_all(&plaintext)
                        .map_err(|e| format!("Failed to write decrypted chunk: {}", e))?;
                }
            }
        }
        BackupFormat::Legacy => {
            let mut nonce_bytes = [0u8; LEGACY_NONCE_LEN];
            reader
                .read_exact(&mut nonce_bytes)
                .map_err(|e| format!("Failed to read nonce: {}", e))?;

            let mut ciphertext = Vec::new();
            reader
                .read_to_end(&mut ciphertext)
                .map_err(|e| format!("Failed to read legacy encrypted payload: {}", e))?;

            let cipher = Aes256Gcm::new_from_slice(&key)
                .map_err(|e| format!("Failed to initialize cipher: {}", e))?;
            let nonce = AeadNonce::from_slice(&nonce_bytes);

            let plaintext = cipher
                .decrypt(nonce, ciphertext.as_ref())
                .map_err(|e| format!("Decryption failed for legacy backup: {}", e))?;
            writer
                .write_all(&plaintext)
                .map_err(|e| format!("Failed to write decrypted chunk: {}", e))?;
            writer
                .flush()
                .map_err(|e| format!("Failed to flush decrypted archive: {}", e))?;
            writer
                .into_inner()
                .map_err(|e| format!("Failed to finalize decrypted archive: {}", e))?
                .sync_all()
                .map_err(|e| format!("Failed to sync decrypted archive: {}", e))?;
            return Ok(());
        }
    }

    writer
        .flush()
        .map_err(|e| format!("Failed to flush decrypted archive: {}", e))?;
    writer
        .into_inner()
        .map_err(|e| format!("Failed to finalize decrypted archive: {}", e))?
        .sync_all()
        .map_err(|e| format!("Failed to sync decrypted archive: {}", e))
}

fn read_chunk<R: Read>(reader: &mut R, buffer: &mut [u8]) -> std::io::Result<usize> {
    let mut total = 0;
    while total < buffer.len() {
        match reader.read(&mut buffer[total..])? {
            0 => break,
            n => total += n,
        }
    }
    Ok(total)
}

fn restore_workspace(workspace: &Path, archive_path: &Path) -> Result<(), String> {
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

    extract_archive_to_dir(archive_path, temp_dir.path())?;

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

fn extract_archive_to_dir(archive_path: &Path, output_dir: &Path) -> Result<(), String> {
    let archive_file = File::open(archive_path).map_err(|e| {
        format!(
            "Failed to open decrypted archive {}: {}",
            archive_path.display(),
            e
        )
    })?;
    let decoder = GzDecoder::new(archive_file);
    let mut tar = Archive::new(decoder);
    tar.unpack(output_dir)
        .map_err(|e| format!("Failed to unpack archive: {}", e))
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

#[cfg(target_family = "unix")]
fn askpass_stub() -> &'static OsStr {
    OsStr::new("/bin/true")
}

#[cfg(target_family = "windows")]
fn askpass_stub() -> &'static OsStr {
    use once_cell::sync::Lazy;

    static STUB_PATH: Lazy<PathBuf> = Lazy::new(|| {
        let mut path = std::env::temp_dir();
        path.push("gtdspace-askpass-stub.cmd");

        if !path.exists() {
            if let Err(err) = fs::write(&path, b"@echo off\r\nexit /b 1\r\n") {
                warn!(
                    "Failed to write Windows askpass stub at {}: {}",
                    path.display(),
                    err
                );
            }
        }

        path
    });

    STUB_PATH.as_os_str()
}

fn should_force_batch_mode_ssh() -> bool {
    #[cfg(target_os = "windows")]
    {
        false
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var_os("GIT_SSH_COMMAND").is_none() && std::env::var_os("GIT_SSH").is_none()
    }
}

fn run_git_command<I, S>(repo_path: &Path, args: I) -> Result<String, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut command = Command::new("git");
    command
        .current_dir(repo_path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", askpass_stub())
        .env("SSH_ASKPASS", askpass_stub());

    if should_force_batch_mode_ssh() {
        command.env("GIT_SSH_COMMAND", "ssh -oBatchMode=yes");
    }

    let output = command
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
type StreamNonce = aes_gcm::aead::stream::Nonce<Aes256Gcm, StreamBE32<Aes256Gcm>>;

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::path::Path;
    use tempfile::tempdir;

    fn base_settings() -> UserSettings {
        UserSettings {
            theme: "system".to_string(),
            font_size: 14,
            tab_size: 2,
            word_wrap: true,
            font_family: "inter".to_string(),
            line_height: 1.4,
            keybindings: HashMap::new(),
            last_folder: None,
            editor_mode: "edit".to_string(),
            window_width: None,
            window_height: None,
            max_tabs: None,
            restore_tabs: None,
            auto_initialize: Some(true),
            seed_example_content: Some(true),
            default_space_path: None,
            git_sync_enabled: Some(false),
            git_sync_repo_path: None,
            git_sync_workspace_path: None,
            git_sync_remote_url: None,
            git_sync_branch: None,
            git_sync_encryption_key: None,
            git_sync_keep_history: None,
            git_sync_author_name: None,
            git_sync_author_email: None,
            git_sync_last_push: None,
            git_sync_last_pull: None,
            git_sync_auto_pull_interval_minutes: None,
            mcp_server_workspace_path: None,
            mcp_server_read_only: Some(false),
            mcp_server_log_level: Some("info".to_string()),
        }
    }

    fn build_test_config(
        repo_path: PathBuf,
        workspace_path: PathBuf,
        keep_history: usize,
    ) -> GitSyncConfig {
        GitSyncConfig {
            repo_path,
            workspace_path,
            remote_url: None,
            branch: "main".to_string(),
            encryption_key: "unit-test-encryption-key".to_string(),
            keep_history,
            author_name: Some("GTD Space Tests".to_string()),
            author_email: Some("tests@gtdspace.local".to_string()),
        }
    }

    fn write_workspace_file(workspace_path: &Path, relative_path: &str, content: &str) {
        let file_path = workspace_path.join(relative_path);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).expect("create parent directories");
        }
        fs::write(file_path, content).expect("write workspace file");
    }

    #[test]
    fn should_skip_path_filters_sync_and_git_dirs() {
        assert!(should_skip_path(Path::new(".git/config")));
        assert!(should_skip_path(Path::new("Workspace/.gtdsync/state.json")));
        assert!(!should_skip_path(Path::new("Projects/Alpha/README.md")));
    }

    #[test]
    fn ensure_gitignore_creates_expected_defaults() {
        let dir = tempdir().expect("tempdir");

        ensure_gitignore(dir.path()).expect("create gitignore");

        let gitignore = fs::read_to_string(dir.path().join(".gitignore")).expect("read gitignore");
        assert!(gitignore.contains("# Generated by GTD Space"));
        assert!(gitignore.contains("*"));
        assert!(gitignore.contains("!.gitignore"));
        assert!(gitignore.contains("!backups/"));
        assert!(gitignore.contains("!backups/**"));
    }

    #[test]
    fn ensure_gitignore_appends_missing_lines_without_removing_existing_content() {
        let dir = tempdir().expect("tempdir");
        let gitignore_path = dir.path().join(".gitignore");
        fs::write(&gitignore_path, "# custom\n!.gitignore\n").expect("seed existing gitignore");

        ensure_gitignore(dir.path()).expect("update gitignore");

        let gitignore = fs::read_to_string(gitignore_path).expect("read updated gitignore");
        assert!(gitignore.contains("# custom"));
        assert!(gitignore.contains("!backups/"));
        assert!(gitignore.contains("!backups/**"));
    }

    #[test]
    fn list_backups_only_includes_encrypted_files() {
        let dir = tempdir().expect("tempdir");
        let backups_dir = dir.path().join("backups");
        fs::create_dir_all(&backups_dir).expect("create backups dir");

        fs::write(backups_dir.join("backup-1.tar.gz.enc"), b"one").expect("write enc one");
        fs::write(backups_dir.join("backup-2.tar.gz.enc"), b"two").expect("write enc two");
        fs::write(backups_dir.join("notes.txt"), b"ignore").expect("write txt file");

        let entries = list_backups(&backups_dir).expect("list backups");
        assert_eq!(entries.len(), 2);
        assert!(entries
            .iter()
            .all(|entry| entry.file_name.ends_with(".enc")));
    }

    #[test]
    fn prune_history_keeps_only_requested_number_of_backups() {
        let dir = tempdir().expect("tempdir");
        let backups_dir = dir.path().join("backups");
        fs::create_dir_all(&backups_dir).expect("create backups dir");

        fs::write(backups_dir.join("backup-a.tar.gz.enc"), b"a").expect("write a");
        std::thread::sleep(std::time::Duration::from_millis(5));
        fs::write(backups_dir.join("backup-b.tar.gz.enc"), b"b").expect("write b");
        std::thread::sleep(std::time::Duration::from_millis(5));
        fs::write(backups_dir.join("backup-c.tar.gz.enc"), b"c").expect("write c");

        prune_history(&backups_dir, 2).expect("prune history");

        let entries = list_backups(&backups_dir).expect("list after prune");
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn build_git_sync_config_rejects_disabled_sync() {
        let settings = base_settings();
        let result = build_git_sync_config(&settings, None);
        assert!(result.is_err());
        assert!(result
            .expect_err("expected disabled error")
            .contains("Git sync is disabled"));
    }

    #[test]
    fn build_git_sync_config_defaults_branch_and_clamps_keep_history() {
        let dir = tempdir().expect("tempdir");
        let workspace_path = dir.path().join("workspace");
        let repo_path = dir.path().join("repo");
        fs::create_dir_all(&workspace_path).expect("create workspace");

        let mut settings = base_settings();
        settings.git_sync_enabled = Some(true);
        settings.git_sync_workspace_path = Some(workspace_path.to_string_lossy().to_string());
        settings.git_sync_repo_path = Some(repo_path.to_string_lossy().to_string());
        settings.git_sync_branch = None;
        settings.git_sync_keep_history = Some(10_000);
        settings.git_sync_encryption_key = Some("legacy-local-key".to_string());

        let config = build_git_sync_config(&settings, None).expect("build config");
        assert_eq!(config.branch, "main");
        assert_eq!(config.keep_history, 20);
        assert!(config.workspace_path.exists());
        assert!(config.repo_path.exists());
    }

    #[test]
    fn build_git_sync_config_rejects_repo_inside_workspace() {
        let dir = tempdir().expect("tempdir");
        let workspace_path = dir.path().join("workspace");
        let nested_repo = workspace_path.join(".gtd-backups");
        fs::create_dir_all(&workspace_path).expect("create workspace");

        let mut settings = base_settings();
        settings.git_sync_enabled = Some(true);
        settings.git_sync_workspace_path = Some(workspace_path.to_string_lossy().to_string());
        settings.git_sync_repo_path = Some(nested_repo.to_string_lossy().to_string());
        settings.git_sync_encryption_key = Some("legacy-local-key".to_string());

        let result = build_git_sync_config(&settings, None);
        assert!(result.is_err());
        assert!(result
            .expect_err("expected nested repo error")
            .contains("outside the workspace"));
    }

    #[test]
    fn compute_git_status_returns_disabled_message_by_default() {
        let settings = base_settings();
        let status = compute_git_status(&settings, None);

        assert!(!status.enabled);
        assert!(!status.configured);
        assert_eq!(status.message.as_deref(), Some("Git sync is disabled"));
    }

    #[test]
    fn perform_git_push_creates_encrypted_backup_and_commit() {
        let dir = tempdir().expect("tempdir");
        let workspace_path = dir.path().join("workspace");
        let repo_path = dir.path().join("repo");
        fs::create_dir_all(&workspace_path).expect("create workspace");
        fs::create_dir_all(&repo_path).expect("create repo dir");
        write_workspace_file(
            &workspace_path,
            "Projects/Alpha/README.md",
            "# Alpha\nContent",
        );

        let config = build_test_config(repo_path.clone(), workspace_path, 5);
        let result = perform_git_push(config, false).expect("perform git push");

        assert!(result.success);
        assert!(!result.pushed);
        assert!(result
            .backup_file
            .as_deref()
            .map(|name| name.ends_with(".enc"))
            .unwrap_or(false));
        assert!(repo_path.join(".git").exists());
        assert!(!list_backups(&repo_path.join("backups"))
            .expect("list backups")
            .is_empty());

        let git_log = run_git_command(&repo_path, ["log", "--oneline"]).expect("git log");
        assert!(git_log.contains("sync: backup"));
    }

    #[test]
    fn preview_git_push_without_baseline_marks_all_files_as_added() {
        let dir = tempdir().expect("tempdir");
        let workspace_path = dir.path().join("workspace");
        let repo_path = dir.path().join("repo");
        fs::create_dir_all(&workspace_path).expect("create workspace");
        fs::create_dir_all(&repo_path).expect("create repo");

        write_workspace_file(
            &workspace_path,
            "Projects/Alpha/README.md",
            "# Alpha\nHello",
        );
        write_workspace_file(&workspace_path, "assets/logo.bin", "\0PNG");

        let preview = preview_git_push(build_test_config(repo_path, workspace_path, 5))
            .expect("preview push");

        assert!(!preview.has_baseline);
        assert_eq!(preview.summary.added, 2);
        assert_eq!(preview.summary.total_entries, 2);
        assert!(preview
            .entries
            .iter()
            .all(|entry| entry.change_type == "added"));
    }

    #[test]
    fn preview_git_push_returns_text_diff_against_latest_backup() {
        let dir = tempdir().expect("tempdir");
        let workspace_path = dir.path().join("workspace");
        let repo_path = dir.path().join("repo");
        fs::create_dir_all(&workspace_path).expect("create workspace");
        fs::create_dir_all(&repo_path).expect("create repo");

        write_workspace_file(
            &workspace_path,
            "Projects/Alpha/README.md",
            "# Alpha\nOriginal",
        );
        let config = build_test_config(repo_path.clone(), workspace_path.clone(), 5);
        perform_git_push(config.clone(), false).expect("create baseline backup");

        write_workspace_file(
            &workspace_path,
            "Projects/Alpha/README.md",
            "# Alpha\nUpdated",
        );
        write_workspace_file(&workspace_path, ".git/ignored.txt", "skip me");
        write_workspace_file(&workspace_path, ".gtdsync/ignored.json", "{}");

        let preview = preview_git_push(config).expect("preview push");
        assert!(preview.has_baseline);
        assert_eq!(preview.summary.modified, 1);
        assert_eq!(preview.summary.total_entries, 1);

        let entry = preview.entries.first().expect("modified entry");
        assert_eq!(entry.path, "Projects/Alpha/README.md");
        assert_eq!(entry.change_type, "modified");
        assert_eq!(entry.kind, "text");
        assert_eq!(
            entry.text.as_ref().map(|diff| diff.line_stats.added),
            Some(1)
        );
        assert_eq!(
            entry.text.as_ref().map(|diff| diff.line_stats.removed),
            Some(1)
        );
    }

    #[test]
    fn preview_git_push_detects_exact_rename_when_hashes_match() {
        let dir = tempdir().expect("tempdir");
        let workspace_path = dir.path().join("workspace");
        let repo_path = dir.path().join("repo");
        fs::create_dir_all(&workspace_path).expect("create workspace");
        fs::create_dir_all(&repo_path).expect("create repo");

        write_workspace_file(
            &workspace_path,
            "Projects/Alpha/README.md",
            "# Alpha\nStable",
        );
        let config = build_test_config(repo_path.clone(), workspace_path.clone(), 5);
        perform_git_push(config.clone(), false).expect("create baseline backup");

        fs::rename(
            workspace_path.join("Projects/Alpha/README.md"),
            workspace_path.join("Projects/Alpha/Renamed.md"),
        )
        .expect("rename file");

        let preview = preview_git_push(config).expect("preview push");
        assert_eq!(preview.summary.renamed, 1);
        assert_eq!(preview.summary.total_entries, 1);
        let entry = preview.entries.first().expect("rename entry");
        assert_eq!(entry.change_type, "renamed");
        assert_eq!(entry.old_path.as_deref(), Some("Projects/Alpha/README.md"));
        assert_eq!(entry.path, "Projects/Alpha/Renamed.md");
    }

    #[test]
    fn perform_git_pull_restores_workspace_from_latest_backup() {
        let dir = tempdir().expect("tempdir");
        let workspace_path = dir.path().join("workspace");
        let repo_path = dir.path().join("repo");
        fs::create_dir_all(&workspace_path).expect("create workspace");
        fs::create_dir_all(&repo_path).expect("create repo dir");

        let readme_relative = "Projects/Alpha/README.md";
        write_workspace_file(&workspace_path, readme_relative, "# Alpha\nOriginal");

        let config = build_test_config(repo_path, workspace_path.clone(), 5);
        perform_git_push(config.clone(), false).expect("initial push");

        write_workspace_file(&workspace_path, readme_relative, "# Alpha\nModified");
        write_workspace_file(&workspace_path, "scratch.md", "temporary");

        let result = perform_git_pull(config, false).expect("perform git pull restore");
        assert!(result.success);

        let restored =
            fs::read_to_string(workspace_path.join(readme_relative)).expect("read restored file");
        assert_eq!(restored, "# Alpha\nOriginal");
        assert!(!workspace_path.join("scratch.md").exists());
    }

    #[test]
    fn perform_git_push_respects_keep_history_limit() {
        let dir = tempdir().expect("tempdir");
        let workspace_path = dir.path().join("workspace");
        let repo_path = dir.path().join("repo");
        fs::create_dir_all(&workspace_path).expect("create workspace");
        fs::create_dir_all(&repo_path).expect("create repo dir");

        let config = build_test_config(repo_path.clone(), workspace_path.clone(), 1);

        write_workspace_file(&workspace_path, "Projects/Alpha/README.md", "# Alpha\nv1");
        perform_git_push(config.clone(), false).expect("first push");

        std::thread::sleep(std::time::Duration::from_millis(10));
        write_workspace_file(&workspace_path, "Projects/Alpha/README.md", "# Alpha\nv2");
        perform_git_push(config, false).expect("second push");

        let backups = list_backups(&repo_path.join("backups")).expect("list backups");
        assert_eq!(backups.len(), 1);
    }

    #[test]
    fn safety_check_rejects_non_backup_staged_files() {
        let repo_dir = tempdir().expect("tempdir");
        run_git_command(repo_dir.path(), ["init"]).expect("git init");
        fs::write(repo_dir.path().join("notes.txt"), "plain text").expect("write notes");
        run_git_command(repo_dir.path(), ["add", "notes.txt"]).expect("git add notes");

        let err = verify_only_encrypted_files_staged(repo_dir.path())
            .expect_err("expected safety failure");
        assert!(err.contains("Non-backup file staged"));
    }

    #[test]
    fn safety_check_rejects_unencrypted_files_inside_backups_dir() {
        let repo_dir = tempdir().expect("tempdir");
        run_git_command(repo_dir.path(), ["init"]).expect("git init");
        fs::create_dir_all(repo_dir.path().join("backups")).expect("create backups dir");
        fs::write(
            repo_dir.path().join("backups/backup.tar.gz"),
            "not encrypted",
        )
        .expect("write unencrypted backup");
        run_git_command(repo_dir.path(), ["add", "backups/backup.tar.gz"]).expect("git add backup");

        let err = verify_only_encrypted_files_staged(repo_dir.path())
            .expect_err("expected extension failure");
        assert!(err.contains(".enc extension"));
    }
}
