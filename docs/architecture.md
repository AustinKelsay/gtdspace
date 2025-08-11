# Architecture Overview

GTD Space follows a clean architecture pattern with clear separation between the frontend (React/TypeScript) and backend (Rust/Tauri).

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
├─────────────────────────────────────────────────────────┤
│  Components  │     Hooks      │   Types   │   Utils    │
│              │                │           │            │
│  - Editor    │  - useFile...  │  - File   │  - Error   │
│  - Browser   │  - useTab...   │  - Tab    │  - Format  │
│  - Settings  │  - useModal... │  - Search │  - Platform│
└──────────────┴────────┬───────┴───────────┴────────────┘
                        │
                    Tauri IPC
                        │
┌───────────────────────┴─────────────────────────────────┐
│                   Backend (Rust)                         │
├─────────────────────────────────────────────────────────┤
│   Commands   │   File System  │   Store   │   Events   │
│              │                │           │            │
│  - File Ops  │  - Read/Write  │  - Prefs  │  - Watcher │
│  - Search    │  - Watch       │  - State  │  - Changes │
│  - Settings  │  - Permissions │           │            │
└──────────────┴────────────────┴───────────┴────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
App.tsx
├── AppHeader
│   ├── FileInfo
│   ├── ActionButtons
│   └── ThemeToggle
├── FileBrowserSidebar
│   ├── FolderSelector
│   ├── FileTree
│   └── FileContextMenu
├── TabManager
│   ├── TabBar
│   └── TabItem
└── EnhancedTextEditor
    ├── BlockNoteEditor
    └── MarkdownPreview
```

### State Management

GTD Space uses a **custom hooks pattern** for state management instead of Redux or MobX:

```typescript
// Each domain has its own hook
const { state, actions } = useFileManager();

// Hooks compose other hooks
const useTabManager = () => {
  const { saveFile } = useFileManager();
  const { showError } = useErrorHandler();
  // ... tab logic
};
```

### Hook Architecture

1. **Domain Hooks** - Handle specific features

   - `useFileManager` - File operations
   - `useTabManager` - Tab state and persistence
   - `useSettings` - User preferences

2. **Infrastructure Hooks** - Provide services

   - `useErrorHandler` - Error handling wrapper
   - `useModalManager` - Modal state control
   - `useKeyboardShortcuts` - Hotkey registration

3. **Integration Hooks** - Connect to backend
   - `useFileWatcher` - File system monitoring
   - `useGlobalSearch` - Search functionality
   - `useGTDSpace` - GTD space lifecycle (default path, init, project/actions)

### Default GTD Space Lifecycle

On startup (`App.tsx`):

- Derive default path via `get_default_gtd_space_path`
- If not a valid space, call `initialize_gtd_space`
- Seed examples via `seed_example_gtd_content` if no projects exist
- Load the space and projects automatically (no manual folder selection)

## Backend Architecture

### Command Structure

All Tauri commands follow a consistent pattern:

```rust
#[tauri::command]
pub async fn command_name(
    app: AppHandle,
    param1: String,
    param2: Option<String>
) -> Result<ReturnType, String> {
    // Validation
    // Business logic
    // Error handling
}
```

### File System Operations

```
src-tauri/src/commands/
├── file_ops.rs     # CRUD operations
├── search.rs       # Search functionality
├── watcher.rs      # File monitoring
└── settings.rs     # Preferences
```

### Error Handling

Both frontend and backend use Result types:

**Frontend:**

```typescript
const result = await withErrorHandling(
  async () => await invoke("command"),
  "User-friendly message"
);
```

**Backend:**

```rust
match operation() {
    Ok(value) => Ok(value),
    Err(e) => Err(format!("Operation failed: {}", e))
}
```

## Data Flow

### Opening a File

```
1. User clicks file in sidebar
2. FileBrowserSidebar calls onFileSelect
3. App.tsx handleFileSelect → openTab
4. useTabManager checks if already open
5. If not, invoke('read_file')
6. Create new tab with content
7. Activate tab
8. Start auto-save timer
```

### Saving a File

```
1. User types in editor
2. BlockNoteEditor onChange fired
3. useTabManager updateTabContent
4. Mark tab as unsaved
5. Debounced auto-save (2s)
6. invoke('save_file')
7. Update tab saved state
8. Show save indicator
```

## IPC Communication

### Frontend → Backend

```typescript
// Type-safe invoke
const files = await invoke<MarkdownFile[]>("list_markdown_files", {
  path: "/folder/path",
});
```

### Backend → Frontend

```rust
// Emit events
app.emit("file-changed", FileChangeEvent {
    event_type: "modified",
    file_path: path.to_string(),
    timestamp: now()
})?;
```

```typescript
// Listen for events
listen<FileChangeEvent>("file-changed", (event) => {
  handleFileChange(event.payload);
});
```

## Performance Considerations

1. **Lazy Loading**

   - Modals loaded on demand
   - Code splitting for large components

2. **Debouncing**

   - Auto-save: 2 seconds
   - File watcher: 500ms
   - Search: 300ms

3. **Resource Limits**
   - Max file size: 10MB
   - Max open tabs: 10
   - Non-recursive file watching

## Security

1. **File System Access**

   - All paths validated in Rust
   - No arbitrary file access
   - Scoped to user-selected folders

2. **Content Security**

   - No eval() in renderer
   - Sanitized markdown rendering
   - CSP headers in production

3. **IPC Security**
   - Commands validated
   - No raw SQL or shell execution
   - Error messages sanitized

## Testing Strategy

### Unit Tests (Not yet implemented)

- Hook logic isolation
- Component rendering
- Rust command logic

### Integration Tests (Planned)

- File operations flow
- Tab management
- Search functionality

### E2E Tests (Future)

- Full user workflows
- Cross-platform testing
- Performance benchmarks
