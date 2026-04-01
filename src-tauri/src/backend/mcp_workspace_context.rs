use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tempfile::NamedTempFile;

use crate::backend::mcp_workspace::{
    ContextPack, FolderMeaning, GtdItemSummary, MarkerDefinition, WorkspaceFingerprint,
};
use crate::backend::mcp_workspace_index::item_type_key;
use crate::backend::normalize_workspace_path;
use crate::backend::{encode_hex, gtdspace_server_version};

const CONTEXT_PACK_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ContextPackManifest {
    workspace_path_hash: String,
    generated_at: String,
    generator_version: u32,
    fingerprint: WorkspaceFingerprint,
}

#[derive(Debug, Clone)]
pub(crate) struct CachedContextPack {
    pub pack: ContextPack,
    pub markdown: String,
    pub cache_paths: CachePaths,
    pub source: String,
}

#[derive(Debug, Clone)]
pub(crate) struct CachePaths {
    pub root: PathBuf,
    pub manifest: PathBuf,
    pub json: PathBuf,
    pub markdown: PathBuf,
}

pub(crate) fn build_context_pack(
    fingerprint: WorkspaceFingerprint,
    item_counts: BTreeMap<String, usize>,
    items: Vec<GtdItemSummary>,
    workspace_root: String,
) -> ContextPack {
    ContextPack {
        version: CONTEXT_PACK_VERSION,
        server_version: gtdspace_server_version().to_string(),
        generated_at: chrono::Utc::now().to_rfc3339(),
        workspace_root,
        fingerprint,
        top_level_folders: vec![
            FolderMeaning {
                folder: "Projects".to_string(),
                meaning: "Project folders with canonical README.md files and sibling action files."
                    .to_string(),
            },
            FolderMeaning {
                folder: "Habits".to_string(),
                meaning: "One markdown file per habit.".to_string(),
            },
            FolderMeaning {
                folder: "Areas of Focus".to_string(),
                meaning: "Area pages plus a folder overview README.".to_string(),
            },
            FolderMeaning {
                folder: "Goals".to_string(),
                meaning: "Goal pages plus a folder overview README.".to_string(),
            },
            FolderMeaning {
                folder: "Vision".to_string(),
                meaning: "Vision pages plus a folder overview README.".to_string(),
            },
            FolderMeaning {
                folder: "Purpose & Principles".to_string(),
                meaning: "Purpose pages plus a folder overview README.".to_string(),
            },
            FolderMeaning {
                folder: "Someday Maybe".to_string(),
                meaning: "Flat idea/reference note area.".to_string(),
            },
            FolderMeaning {
                folder: "Cabinet".to_string(),
                meaning: "Flat reference storage area.".to_string(),
            },
        ],
        marker_glossary: vec![
            MarkerDefinition {
                family: "singleselect".to_string(),
                syntax: "[!singleselect:<field>:<value>]".to_string(),
                notes: "Canonical enum-like GTD metadata.".to_string(),
            },
            MarkerDefinition {
                family: "multiselect".to_string(),
                syntax: "[!multiselect:<field>:a,b,c]".to_string(),
                notes: "Used for contexts and selected multi-value fields.".to_string(),
            },
            MarkerDefinition {
                family: "checkbox".to_string(),
                syntax: "[!checkbox:habit-status:true|false]".to_string(),
                notes: "Canonical habit completion marker.".to_string(),
            },
            MarkerDefinition {
                family: "datetime".to_string(),
                syntax: "[!datetime:<field>:<value>]".to_string(),
                notes: "Dates and timestamps such as due dates and created timestamps.".to_string(),
            },
            MarkerDefinition {
                family: "references".to_string(),
                syntax: "[!areas-references:...] / [!references:...]".to_string(),
                notes: "Typed and generic links between GTD items.".to_string(),
            },
        ],
        item_counts,
        items,
        operation_guidance: vec![
            "Prefer GTD semantic tools over raw file edits.".to_string(),
            "All write tools dry-run first and require change_apply.".to_string(),
            "If a project path is unclear, call workspace_list_items({\"itemType\":\"project\"}) before action_create."
                .to_string(),
            "Planned changes do not modify files until change_apply succeeds.".to_string(),
            "Paths in tool requests should be workspace-relative unless otherwise noted."
                .to_string(),
        ],
    }
}

pub(crate) fn build_context_pack_markdown(pack: &ContextPack) -> String {
    let mut lines = vec![
        "# GTD Space Context Pack".to_string(),
        String::new(),
        format!("- Server version: `{}`", pack.server_version),
        format!("- Workspace: `{}`", pack.workspace_root),
        format!("- Generated: `{}`", pack.generated_at),
        format!(
            "- Files indexed: `{}`",
            pack.fingerprint.markdown_file_count
        ),
        String::new(),
        "## Folder Semantics".to_string(),
    ];
    for folder in &pack.top_level_folders {
        lines.push(format!("- `{}`: {}", folder.folder, folder.meaning));
    }
    lines.push(String::new());
    lines.push("## Item Counts".to_string());
    for (key, value) in &pack.item_counts {
        lines.push(format!("- `{}`: {}", key, value));
    }
    lines.push(String::new());
    lines.push("## Tool Guidance".to_string());
    for entry in &pack.operation_guidance {
        lines.push(format!("- {}", entry));
    }
    lines.push(String::new());
    lines.push("## Items".to_string());
    for item in &pack.items {
        lines.push(format!(
            "- `{}` [{}] {}",
            item.relative_path,
            item_type_key(&item.item_type),
            item.title
        ));
    }
    format!("{}\n", lines.join("\n"))
}

pub(crate) fn read_cached_context_pack(
    cache_paths: &CachePaths,
    fingerprint: &WorkspaceFingerprint,
) -> Result<Option<CachedContextPack>, String> {
    if !cache_paths.manifest.exists() {
        return Ok(None);
    }
    let manifest = match fs::read_to_string(&cache_paths.manifest) {
        Ok(manifest) => manifest,
        Err(_) => return Ok(None),
    };
    let manifest = match serde_json::from_str::<ContextPackManifest>(&manifest) {
        Ok(manifest) => manifest,
        Err(_) => return Ok(None),
    };
    if manifest.generator_version != CONTEXT_PACK_VERSION || manifest.fingerprint != *fingerprint {
        return Ok(None);
    }
    let json = match fs::read_to_string(&cache_paths.json) {
        Ok(json) => json,
        Err(_) => return Ok(None),
    };
    let markdown = match fs::read_to_string(&cache_paths.markdown) {
        Ok(markdown) => markdown,
        Err(_) => return Ok(None),
    };
    let pack = match serde_json::from_str::<ContextPack>(&json) {
        Ok(pack) => pack,
        Err(_) => return Ok(None),
    };
    if pack.version != CONTEXT_PACK_VERSION || pack.fingerprint != *fingerprint {
        return Ok(None);
    }
    Ok(Some(CachedContextPack {
        pack,
        markdown,
        cache_paths: cache_paths.clone(),
        source: "cache".to_string(),
    }))
}

pub(crate) fn write_cached_context_pack(
    cache_paths: &CachePaths,
    pack: &ContextPack,
    markdown: &str,
) -> Result<(), String> {
    fs::create_dir_all(&cache_paths.root)
        .map_err(|error| format!("Failed to create context cache directory: {}", error))?;
    let mut hasher = Sha256::new();
    hasher.update(pack.workspace_root.as_bytes());
    let manifest = ContextPackManifest {
        workspace_path_hash: encode_hex(hasher.finalize()),
        generated_at: pack.generated_at.clone(),
        generator_version: CONTEXT_PACK_VERSION,
        fingerprint: pack.fingerprint.clone(),
    };
    if cache_paths.manifest.exists() {
        fs::remove_file(&cache_paths.manifest)
            .map_err(|error| format!("Failed to clear stale context manifest: {}", error))?;
    }
    write_bytes_atomically(
        &cache_paths.json,
        &serde_json::to_vec_pretty(pack).map_err(|error| error.to_string())?,
        "context JSON",
    )?;
    write_bytes_atomically(
        &cache_paths.markdown,
        markdown.as_bytes(),
        "context markdown",
    )?;
    write_bytes_atomically_synced(
        &cache_paths.manifest,
        &serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?,
        "context manifest",
    )?;
    Ok(())
}

fn write_bytes_atomically(path: &PathBuf, bytes: &[u8], label: &str) -> Result<(), String> {
    let temp_dir = path.parent().unwrap_or(cache_dir_root_fallback());
    let mut temp_file = NamedTempFile::new_in(temp_dir)
        .map_err(|error| format!("Failed to create temporary {} file: {}", label, error))?;
    temp_file
        .write_all(bytes)
        .map_err(|error| format!("Failed to write temporary {} file: {}", label, error))?;
    temp_file
        .flush()
        .map_err(|error| format!("Failed to flush temporary {} file: {}", label, error))?;
    temp_file
        .persist(path)
        .map_err(|error| format!("Failed to replace {} atomically: {}", label, error.error))?;
    Ok(())
}

fn write_bytes_atomically_synced(path: &PathBuf, bytes: &[u8], label: &str) -> Result<(), String> {
    let temp_dir = path.parent().unwrap_or(cache_dir_root_fallback());
    let mut temp_file = NamedTempFile::new_in(temp_dir)
        .map_err(|error| format!("Failed to create temporary {} file: {}", label, error))?;
    temp_file
        .write_all(bytes)
        .map_err(|error| format!("Failed to write temporary {} file: {}", label, error))?;
    temp_file
        .flush()
        .map_err(|error| format!("Failed to flush temporary {} file: {}", label, error))?;
    temp_file
        .as_file()
        .sync_all()
        .map_err(|error| format!("Failed to sync temporary {} file: {}", label, error))?;
    temp_file
        .persist(path)
        .map_err(|error| format!("Failed to replace {} atomically: {}", label, error.error))?;
    Ok(())
}

fn cache_dir_root_fallback() -> &'static std::path::Path {
    std::path::Path::new(".")
}

pub(crate) fn to_public_cache_paths(cache_paths: &CachePaths) -> (String, String, String, String) {
    (
        normalize_workspace_path(&cache_paths.root),
        normalize_workspace_path(&cache_paths.manifest),
        normalize_workspace_path(&cache_paths.json),
        normalize_workspace_path(&cache_paths.markdown),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::write_test_file;
    use std::collections::BTreeMap;

    fn sample_fingerprint() -> WorkspaceFingerprint {
        WorkspaceFingerprint {
            normalized_root_path: "/tmp/workspace".to_string(),
            latest_modified_unix: 1_743_379_200,
            markdown_file_count: 1,
            aggregate_digest: "digest".to_string(),
        }
    }

    fn sample_pack() -> ContextPack {
        ContextPack {
            version: CONTEXT_PACK_VERSION,
            server_version: "test".to_string(),
            generated_at: "2026-03-31T00:00:00Z".to_string(),
            workspace_root: "/tmp/workspace".to_string(),
            fingerprint: sample_fingerprint(),
            top_level_folders: Vec::new(),
            marker_glossary: Vec::new(),
            item_counts: BTreeMap::new(),
            items: Vec::new(),
            operation_guidance: vec!["Prefer semantic tools".to_string()],
        }
    }

    fn sample_cache_paths(root: &std::path::Path) -> CachePaths {
        CachePaths {
            root: root.to_path_buf(),
            manifest: root.join("manifest.json"),
            json: root.join("gtd-context.json"),
            markdown: root.join("gtd-context.md"),
        }
    }

    #[test]
    fn malformed_cached_context_is_treated_as_cache_miss() -> Result<(), String> {
        let temp_dir = tempfile::tempdir().map_err(|error| error.to_string())?;
        let cache_paths = sample_cache_paths(temp_dir.path());
        let fingerprint = sample_fingerprint();
        write_test_file(&cache_paths.manifest, "{not valid json")?;
        write_test_file(&cache_paths.json, "{not valid json")?;
        write_test_file(&cache_paths.markdown, "stale markdown")?;

        let cached = read_cached_context_pack(&cache_paths, &fingerprint)?;

        assert!(cached.is_none());
        Ok(())
    }

    #[test]
    fn cached_context_requires_manifest_even_if_payloads_exist() -> Result<(), String> {
        let temp_dir = tempfile::tempdir().map_err(|error| error.to_string())?;
        let cache_paths = sample_cache_paths(temp_dir.path());
        let pack = sample_pack();
        write_test_file(
            &cache_paths.json,
            &serde_json::to_string_pretty(&pack).map_err(|error| error.to_string())?,
        )?;
        write_test_file(&cache_paths.markdown, "cached markdown")?;

        let cached = read_cached_context_pack(&cache_paths, &pack.fingerprint)?;

        assert!(cached.is_none());
        Ok(())
    }

    #[test]
    fn cached_context_requires_matching_pack_version_and_fingerprint() -> Result<(), String> {
        let temp_dir = tempfile::tempdir().map_err(|error| error.to_string())?;
        let cache_paths = sample_cache_paths(temp_dir.path());
        let mut pack = sample_pack();
        let manifest = ContextPackManifest {
            workspace_path_hash: "workspace".to_string(),
            generated_at: pack.generated_at.clone(),
            generator_version: CONTEXT_PACK_VERSION,
            fingerprint: pack.fingerprint.clone(),
        };

        write_test_file(
            &cache_paths.manifest,
            &serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?,
        )?;
        write_test_file(&cache_paths.markdown, "cached markdown")?;

        pack.version = CONTEXT_PACK_VERSION + 1;
        write_test_file(
            &cache_paths.json,
            &serde_json::to_string_pretty(&pack).map_err(|error| error.to_string())?,
        )?;

        let cached = read_cached_context_pack(&cache_paths, &sample_fingerprint())?;
        assert!(cached.is_none());

        let mut stale_fingerprint_pack = sample_pack();
        stale_fingerprint_pack.fingerprint.aggregate_digest = "stale".to_string();
        write_test_file(
            &cache_paths.json,
            &serde_json::to_string_pretty(&stale_fingerprint_pack)
                .map_err(|error| error.to_string())?,
        )?;

        let cached = read_cached_context_pack(&cache_paths, &sample_fingerprint())?;
        assert!(cached.is_none());
        Ok(())
    }
}
