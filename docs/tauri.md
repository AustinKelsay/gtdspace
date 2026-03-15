# Tauri Integration

This document details how GTD Space integrates with Tauri for native desktop functionality.

## Overview

Tauri provides the bridge between our React frontend and native system capabilities through:

- **IPC (Inter-Process Communication)** - Frontend ↔ Backend messaging
- **Commands** - Rust functions callable from JavaScript
- **Events** - Real-time notifications from backend to frontend
- **Plugins** - Extended native functionality

## Command System

### Command Definition (Rust)

All commands are defined in `src-tauri/src/commands/mod.rs`:

```rust
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    log::info!("Reading file: {}", path);

    let file_path = Path::new(&path);

    // Validation
    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }

    // Operation
    match fs::read_to_string(file_path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("Failed to read file: {}", e))
    }
}
```

### Command Invocation (TypeScript)

```typescript
import { invoke } from "@tauri-apps/api/core";

// Type-safe invocation
const content = await invoke<string>("read_file", {
  path: "/path/to/file.md",
});
```

### Error Handling Pattern

Always wrap invocations with error handling:

```typescript
const { withErrorHandling } = useErrorHandler();

const result = await withErrorHandling(
  async () => await invoke<string>("read_file", { path }),
  "Failed to read file"
);
```

## Available Commands

### File Operations

| Command               | Parameters                               | Returns               | Description                  |
| --------------------- | ---------------------------------------- | --------------------- | ---------------------------- |
| `select_folder`       | none                                     | `string`              | Opens native folder picker   |
| `list_markdown_files` | `path: string`                           | `MarkdownFile[]`      | Lists .md files in directory |
| `read_file`           | `path: string`                           | `string`              | Reads file content           |
| `save_file`           | `path: string, content: string`          | `string`              | Saves content to file        |
| `create_file`         | `directory: string, name: string`        | `FileOperationResult` | Creates new markdown file    |
| `rename_file`         | `old_path: string, new_name: string`     | `FileOperationResult` | Renames file                 |
| `delete_file`         | `path: string`                           | `FileOperationResult` | Deletes file                 |
| `copy_file`           | `source_path: string, dest_path: string` | `string`              | Copies file                  |
| `move_file`           | `source_path: string, dest_path: string` | `string`              | Moves file                   |

### Search Operations

| Command           | Parameters                                                     | Returns          | Description      |
| ----------------- | -------------------------------------------------------------- | ---------------- | ---------------- |
| `search_files`    | `query: string, directory: string, filters: SearchFilters`     | `SearchResponse` | Full-text search |
| `replace_in_file` | `file_path: string, search_term: string, replace_term: string` | `string`         | Find and replace |

### System Commands

| Command                      | Parameters | Returns            | Description                     |
| ---------------------------- | ---------- | ------------------ | ------------------------------- |
| `ping`                       | none       | `string`           | Tests IPC connection            |
| `get_app_version`            | none       | `string`           | Returns app version             |
| `check_permissions`          | none       | `PermissionStatus` | Checks file system access       |
| `get_default_gtd_space_path` | none       | `string`           | Platform default GTD space path |

### GTD Initialization & Seeding

| Command                    | Parameters           | Returns  | Description                                                  |
| -------------------------- | -------------------- | -------- | ------------------------------------------------------------ |
| `initialize_gtd_space`     | `space_path: string` | `string` | Creates `Projects/`, `Habits/`, `Someday Maybe/`, `Cabinet/` |
| `seed_example_gtd_content` | `space_path: string` | `string` | Seeds demo projects and actions if no projects exist         |

On app startup, the frontend:

- Calls `get_default_gtd_space_path` to derive a default path (e.g., `~/GTD Space`)
- Ensures a valid space via `initialize_gtd_space`
- Seeds examples via `seed_example_gtd_content` on first run

## Event System

### Backend Event Emission

```rust
// Emit event from Rust
app.emit("file-changed", FileChangeEvent {
    event_type: "modified".to_string(),
    file_path: path.to_string(),
    file_name: name.to_string(),
    timestamp: SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs(),
})?;
```

### Frontend Event Listening

```typescript
import { listen } from "@tauri-apps/api/event";

// Set up listener
const unlisten = await listen<FileChangeEvent>("file-changed", (event) => {
  console.log("File changed:", event.payload);
  handleFileChange(event.payload);
});

// Clean up
unlisten();
```

### Available Events

| Event              | Payload           | Description                  |
| ------------------ | ----------------- | ---------------------------- |
| `file-changed`     | `FileChangeEvent` | File system changes detected |
| `settings-updated` | `UserSettings`    | Settings changed             |

## Type Definitions

### Rust Types

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarkdownFile {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub last_modified: u64,
    pub extension: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileOperationResult {
    pub success: bool,
    pub path: Option<String>,
    pub message: Option<String>,
}
```

### TypeScript Types

```typescript
export interface MarkdownFile {
  id: string;
  name: string;
  path: string;
  size: number;
  last_modified: number;
  extension: string;
}

export interface FileOperationResult {
  success: boolean;
  path?: string;
  message?: string;
}
```

## File Watcher Integration

The file watcher uses the `notify` crate with debouncing:

```rust
// Start watching
#[tauri::command]
pub async fn start_file_watcher(
    app: AppHandle,
    folder_path: String
) -> Result<String, String> {
    // Create debounced watcher (500ms)
    let mut debouncer = new_debouncer(
        Duration::from_millis(500),
        move |result| {
            // Handle file events
        }
    )?;

    // Watch directory (non-recursive)
    debouncer.watcher().watch(
        Path::new(&folder_path),
        RecursiveMode::NonRecursive
    )?;
}
```

## Plugin Configuration

### Dialog Plugin

Used for native file/folder selection:

```rust
// Cargo.toml
[dependencies]
tauri-plugin-dialog = "2.0.0"

// main.rs
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
```

### Store Plugin

For persistent settings storage:

```rust
// Cargo.toml
[dependencies]
tauri-plugin-store = "2.0.0"

// Usage
let store = StoreBuilder::new(
    &app,
    PathBuf::from("settings.json")
).build()?;

store.set("user_settings", settings_value);
store.save()?;
```

### FS Plugin

For file system operations:

```rust
// Cargo.toml
[dependencies]
tauri-plugin-fs = "2.0.0"

// Configured with allowed scopes
```

## Security Considerations

### Path Validation

All file paths are validated:

```rust
let path = Path::new(&input_path);

// Check existence
if !path.exists() {
    return Err("Path does not exist".to_string());
}

// Check file type
if !path.is_file() {
    return Err("Path is not a file".to_string());
}
```

### Command Allowlist

Only explicitly defined commands are exposed:

```rust
// main.rs
.invoke_handler(tauri::generate_handler![
    ping,
    get_app_version,
    check_permissions,
    select_folder,
    list_markdown_files,
    read_file,
    save_file,
    // ... other commands
])
```

### Content Security Policy

Configured in `tauri.conf.json`:

```json
{
  "app": {
    "security": {
      "csp": null // Uses default secure CSP
    }
  }
}
```

## Performance Optimization

### Async Commands

All I/O operations are async:

```rust
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    // Non-blocking file read
    tokio::fs::read_to_string(path).await
        .map_err(|e| e.to_string())
}
```

### Debouncing

File watcher events are debounced:

```rust
// 500ms debounce for file changes
let mut debouncer = new_debouncer(
    Duration::from_millis(500),
    event_handler
)?;
```

### Resource Limits

- Maximum file size: 10MB (checked before reading)
- File watcher: Non-recursive to limit CPU usage
- Search results: Limited to prevent memory issues

## Development Tips

### 1. Logging

Enable Rust logging for debugging:

```bash
RUST_LOG=debug npm run tauri:dev
```

### 2. Error Messages

Provide user-friendly error messages:

```rust
// ✅ Good
Err("File is too large. Maximum size is 10MB".to_string())

// ❌ Bad
Err(format!("{:?}", e))
```

### 3. Type Safety

Always define types for command parameters and returns:

```rust
#[derive(Deserialize)]
struct SearchParams {
    query: String,
    directory: String,
    filters: SearchFilters,
}

#[tauri::command]
pub async fn search_files(params: SearchParams) -> Result<SearchResponse, String> {
    // Implementation
}
```

### 4. Testing Commands

Test commands directly from the DevTools console:

```javascript
// In browser console
await window.__TAURI__.invoke("ping");
// Returns: "pong"
```

## Troubleshooting

### Common Issues

1. **"window.**TAURI** is not defined"**

   - Running with `npm run dev` instead of `npm run tauri:dev`
   - Tauri APIs only available in Tauri context

2. **"Command not found"**

   - Command not added to `invoke_handler` in main.rs
   - Typo in command name

3. **"Failed to serialize/deserialize"**

   - Mismatch between Rust and TypeScript types
   - Missing `Serialize`/`Deserialize` derives

4. **File operations fail silently**
   - Check Rust logs: `RUST_LOG=debug`
   - Verify file permissions
   - Check path validation logic
