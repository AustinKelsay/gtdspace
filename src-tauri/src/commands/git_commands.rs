//! Tauri command wrappers for git sync.

use chrono::Utc;
use once_cell::sync::Lazy;
use tauri::AppHandle;
use tokio::sync::Mutex as TokioMutex;
use tokio::task;

use super::git_sync::{
    build_git_sync_config, compute_git_status, perform_git_pull, perform_git_push,
    preview_git_push, GitOperationResultPayload, GitSyncPreviewResponse, GitSyncStatusResponse,
};
use super::settings::{load_settings, update_settings};

static GIT_SYNC_METADATA_LOCK: Lazy<TokioMutex<()>> = Lazy::new(|| TokioMutex::new(()));

/// Retrieve current git sync status information
#[tauri::command]
pub async fn git_sync_status(
    app: AppHandle,
    workspace_override: Option<String>,
) -> Result<GitSyncStatusResponse, String> {
    let settings = load_settings(app).await?;
    task::spawn_blocking(move || compute_git_status(&settings, workspace_override))
        .await
        .map_err(|e| format!("Git status task failed: {}", e))
}

/// Create an encrypted snapshot and push it via git
#[tauri::command]
pub async fn git_sync_push(
    app: AppHandle,
    workspace_override: Option<String>,
    force: Option<bool>,
) -> Result<GitOperationResultPayload, String> {
    let _guard = GIT_SYNC_METADATA_LOCK.lock().await;
    let settings_snapshot = load_settings(app.clone()).await?;
    let force_push = force.unwrap_or(false);
    let outcome = task::spawn_blocking(move || {
        let config = build_git_sync_config(&settings_snapshot, workspace_override)?;
        perform_git_push(config, force_push)
    })
    .await
    .map_err(|e| format!("Git push task failed: {}", e))??;

    if let Err(error) = update_settings(app, |settings| {
        settings.git_sync_last_push = outcome.timestamp.clone();
    })
    .await
    {
        log::warn!("Failed to persist git sync push metadata: {}", error);
    }

    Ok(outcome)
}

/// Prepare a read-only diff preview for the next encrypted snapshot push
#[tauri::command]
pub async fn git_sync_preview_push(
    app: AppHandle,
    workspace_override: Option<String>,
) -> Result<GitSyncPreviewResponse, String> {
    let _guard = GIT_SYNC_METADATA_LOCK.lock().await;
    let settings_snapshot = load_settings(app).await?;
    task::spawn_blocking(move || {
        let config = build_git_sync_config(&settings_snapshot, workspace_override)?;
        preview_git_push(config)
    })
    .await
    .map_err(|e| format!("Git push preview task failed: {}", e))?
}

/// Pull the latest encrypted snapshot and restore the workspace
#[tauri::command]
pub async fn git_sync_pull(
    app: AppHandle,
    workspace_override: Option<String>,
    force: Option<bool>,
) -> Result<GitOperationResultPayload, String> {
    let _guard = GIT_SYNC_METADATA_LOCK.lock().await;
    let settings_snapshot = load_settings(app.clone()).await?;
    let force_pull = force.unwrap_or(false);
    let outcome = task::spawn_blocking(move || {
        let config = build_git_sync_config(&settings_snapshot, workspace_override)?;
        perform_git_pull(config, force_pull)
    })
    .await
    .map_err(|e| format!("Git pull task failed: {}", e))??;

    if let Err(error) = update_settings(app, |settings| {
        settings.git_sync_last_pull = Some(Utc::now().to_rfc3339());
    })
    .await
    {
        log::warn!("Failed to persist git sync pull metadata: {}", error);
    }

    Ok(outcome)
}
