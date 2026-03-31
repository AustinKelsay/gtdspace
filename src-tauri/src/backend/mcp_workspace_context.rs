use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::backend::gtdspace_server_version;
use crate::backend::mcp_workspace::{
    ContextPack, FolderMeaning, GtdItemSummary, MarkerDefinition, WorkspaceFingerprint,
};
use crate::backend::mcp_workspace_index::item_type_key;
use crate::backend::normalize_workspace_path;

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
    if !cache_paths.manifest.exists()
        || !cache_paths.json.exists()
        || !cache_paths.markdown.exists()
    {
        return Ok(None);
    }
    let manifest = fs::read_to_string(&cache_paths.manifest)
        .map_err(|error| format!("Failed to read context manifest: {}", error))?;
    let manifest = serde_json::from_str::<ContextPackManifest>(&manifest)
        .map_err(|error| format!("Failed to parse context manifest: {}", error))?;
    if manifest.generator_version != CONTEXT_PACK_VERSION || manifest.fingerprint != *fingerprint {
        return Ok(None);
    }
    let json = fs::read_to_string(&cache_paths.json)
        .map_err(|error| format!("Failed to read cached context JSON: {}", error))?;
    let markdown = fs::read_to_string(&cache_paths.markdown)
        .map_err(|error| format!("Failed to read cached context markdown: {}", error))?;
    let pack = serde_json::from_str::<ContextPack>(&json)
        .map_err(|error| format!("Failed to parse cached context JSON: {}", error))?;
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
        workspace_path_hash: format!("{:x}", hasher.finalize()),
        generated_at: pack.generated_at.clone(),
        generator_version: CONTEXT_PACK_VERSION,
        fingerprint: pack.fingerprint.clone(),
    };
    fs::write(
        &cache_paths.manifest,
        serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Failed to write context manifest: {}", error))?;
    fs::write(
        &cache_paths.json,
        serde_json::to_vec_pretty(pack).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Failed to write context JSON: {}", error))?;
    fs::write(&cache_paths.markdown, markdown)
        .map_err(|error| format!("Failed to write context markdown: {}", error))?;
    Ok(())
}

pub(crate) fn to_public_cache_paths(cache_paths: &CachePaths) -> (String, String, String, String) {
    (
        normalize_workspace_path(&cache_paths.root),
        normalize_workspace_path(&cache_paths.manifest),
        normalize_workspace_path(&cache_paths.json),
        normalize_workspace_path(&cache_paths.markdown),
    )
}
