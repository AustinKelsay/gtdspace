# Phase 2: Enhancement - Improved UX & Workflow

> **Goal:** Enhance the MVP with improved user experience, better file management, and workflow optimizations. This phase transforms the functional MVP into a polished, efficient tool that users will prefer over basic text editors.

## Phase Overview

**Duration:** 1-2 weeks  
**Status:** Enhanced Product  
**Value Delivered:** Significantly improved usability and workflow efficiency  
**User Experience:** Smooth, intuitive interface with advanced file management and better editing experience

## Success Criteria

- [x] File watching detects external changes and offers reload options
- [x] Tabbed interface allows multiple files open simultaneously
- [ ] Advanced file operations (copy, move, batch operations)
- [x] Enhanced editor with better markdown support and formatting helpers
- [ ] Improved search with content searching across all files
- [x] Keyboard shortcuts for all major operations

## Core Features

### 1. Tabbed File Interface
**Deliverable:** Multi-file editing with persistent tab state

**Steps:**
1. ✅ Create tabbed interface that maintains multiple open files simultaneously
2. ✅ Implement tab context menus (close, close others, close all)
3. [ ] Add tab reordering with drag-and-drop functionality
4. [ ] Persist open tabs between application sessions
5. ✅ Add unsaved changes indicators on tabs with close confirmation

**Components:**
- ✅ `TabManager.tsx` - Manages tab state and operations
- ✅ `FileTab.tsx` - Individual tab with close button and state indicators
- ✅ `TabContextMenu.tsx` - Right-click menu for tab operations (integrated into FileTab)

**Features:**
- ✅ Maximum 10 tabs with overflow scrolling
- ✅ Tab tooltips showing full file path
- ✅ Keyboard shortcuts (Ctrl+W to close, Ctrl+Tab to switch)
- ✅ Unsaved changes indicator (dot or asterisk on tab)

### 2. File Watching & External Changes
**Deliverable:** Real-time detection of file system changes

**Steps:**
1. ✅ Implement Rust file watching service using notify crate
2. ✅ Detect when open files are modified externally and prompt for reload
3. ✅ Handle file deletions, renames, and new file creations in current folder
4. [ ] Add conflict resolution for simultaneous internal and external edits
5. ✅ Update file list in real-time when folder contents change

**Rust Integration:**
```rust
// File watcher service
start_file_watcher(folder_path: String) -> Result<(), String>
stop_file_watcher() -> Result<(), String>
handle_file_changed(path: String) -> FileChangeEvent
```

**Features:**
- Non-intrusive notifications for external changes
- Auto-refresh file list when new files are added
- Conflict resolution dialog for simultaneous edits
- File rename detection with automatic tab updating

### 3. Advanced File Operations
**Deliverable:** Professional-grade file management capabilities

**Steps:**
1. [ ] Implement file copy and move operations within the workspace
2. [ ] Add support for creating and managing subdirectories
3. [ ] Create batch file operations (select multiple, bulk rename/delete/move)
4. [ ] Add file templates system with customizable templates
5. [ ] Implement file import/export (copy files from outside workspace)

**Components:**
- `FileOperations.tsx` - Context menu and bulk operation controls
- `DirectoryManager.tsx` - Folder creation and management
- `FileTemplates.tsx` - Template selection and management
- `BulkOperations.tsx` - Multi-select and batch operations

**New Rust Commands:**
```rust
copy_file(source: String, destination: String) -> Result<(), String>
move_file(source: String, destination: String) -> Result<(), String>
create_directory(path: String, name: String) -> Result<(), String>
get_file_templates() -> Result<Vec<FileTemplate>, String>
```

### 4. Enhanced Editor Experience
**Deliverable:** Improved markdown editing with better formatting support

**Steps:**
1. ✅ Upgrade to advanced CodeMirror configuration with markdown extensions
2. ✅ Add live preview with scroll synchronization between editor and preview
3. ✅ Implement markdown formatting shortcuts (Ctrl+B for bold, Ctrl+I for italic)
4. ✅ Add markdown-aware editing features (auto-complete headers, link suggestions)
5. [ ] Create distraction-free writing mode (hide sidebar, full-screen editor)

**Components:**
- ✅ `CodeMirrorEditor.tsx` - Enhanced CodeMirror integration
- ✅ `EnhancedTextEditor.tsx` - Preview with synchronized scrolling and mode switching
- ✅ `MarkdownHelpers.tsx` - Formatting shortcuts and auto-completion (integrated into CodeMirrorEditor)
- [ ] `WritingMode.tsx` - Distraction-free editing interface

**Editor Features:**
- ✅ Bracket matching and auto-closing
- ✅ Smart indentation for lists and code blocks
- ✅ Live word count and reading time estimate
- ✅ Customizable editor themes (beyond just dark/light)

### 5. Content Search & Replace
**Deliverable:** Comprehensive search functionality across all files

**Steps:**
1. [ ] Implement full-text search across all markdown files in workspace
2. [ ] Add advanced search options (case sensitive, whole word, regex)
3. [ ] Create global find-and-replace functionality with preview
4. [ ] Add search result highlighting and navigation
5. [ ] Implement search history and saved searches

**Components:**
- `GlobalSearch.tsx` - Search across all files interface
- `SearchResults.tsx` - Display and navigation of search results
- `FindReplace.tsx` - Advanced find and replace with preview
- `SearchHistory.tsx` - Search history and saved searches

**Search Features:**
- Search results with file context and line numbers
- Jump to search results in editor
- Replace all with confirmation dialog
- Search within selected files or entire workspace

### 6. Improved Settings & Customization
**Deliverable:** Comprehensive settings system with advanced preferences

**Steps:**
1. ✅ Expand settings with editor customization options (themes, keybindings)
2. [ ] Add workspace-specific settings (per-folder preferences)
3. [ ] Implement keyboard shortcut customization
4. [ ] Create import/export settings functionality
5. ✅ Add advanced file handling preferences (auto-save interval, backup settings)

**Settings Categories:**
- **Editor:** Font family, size, line height, tab size, themes
- **Workspace:** Default templates, file extensions to show
- **Shortcuts:** Customizable keybindings for all operations
- **Performance:** Auto-save interval, file watching preferences
- **Advanced:** Debug mode, logging level, experimental features

## Technical Enhancements

### State Management Upgrade
```typescript
// Enhanced application state with tab management
interface EnhancedAppState extends AppState {
  tabs: {
    openTabs: FileTab[];
    activeTabId: string;
    maxTabs: number;
  };
  fileWatcher: {
    isActive: boolean;
    watchedPath: string;
    pendingChanges: FileChangeEvent[];
  };
  search: {
    query: string;
    results: SearchResult[];
    searchHistory: string[];
    filters: SearchFilters;
  };
  workspace: {
    templates: FileTemplate[];
    recentFolders: string[];
    workspaceSettings: WorkspaceSettings;
  };
}
```

### Performance Optimizations
- **Virtual scrolling** for large file lists (>100 files)
- **Debounced auto-save** to reduce write operations
- **Lazy loading** for file content (only load when tab becomes active)
- **Search indexing** for faster full-text search
- **Memory management** for tab content (unload inactive tabs after threshold)

### Enhanced File Structure
```
src/
├── components/
│   ├── tabs/
│   │   ├── TabManager.tsx
│   │   ├── FileTab.tsx
│   │   └── TabContextMenu.tsx
│   ├── file-operations/
│   │   ├── FileOperations.tsx
│   │   ├── DirectoryManager.tsx
│   │   ├── BulkOperations.tsx
│   │   └── FileTemplates.tsx
│   ├── editor/
│   │   ├── AdvancedEditor.tsx
│   │   ├── SyncedPreview.tsx
│   │   ├── MarkdownHelpers.tsx
│   │   └── WritingMode.tsx
│   ├── search/
│   │   ├── GlobalSearch.tsx
│   │   ├── SearchResults.tsx
│   │   ├── FindReplace.tsx
│   │   └── SearchHistory.tsx
│   └── settings/
│       ├── SettingsManager.tsx
│       ├── EditorSettings.tsx
│       ├── WorkspaceSettings.tsx
│       └── KeyboardShortcuts.tsx
├── services/
│   ├── fileWatcher.ts
│   ├── searchIndex.ts
│   └── templateManager.ts
└── hooks/
    ├── useTabManager.ts
    ├── useFileWatcher.ts
    ├── useGlobalSearch.ts
    └── useWorkspaceSettings.ts
```

### New Dependencies
```json
{
  "dependencies": {
    "@codemirror/lang-markdown": "^6.2.0",
    "@codemirror/theme-one-dark": "^6.1.0",
    "@codemirror/search": "^6.5.0",
    "react-hotkeys-hook": "^4.4.0",
    "lodash.debounce": "^4.0.8",
    "react-window": "^1.8.8"
  }
}
```

## User Experience Improvements

### Workflow Optimizations
1. **Quick Actions Bar:** Floating toolbar with most-used commands
2. **Command Palette:** Ctrl+Shift+P to access all commands by name
3. **File Explorer:** Tree view with expand/collapse for nested folders
4. **Recent Files:** Quick access to recently edited files
5. **Breadcrumb Navigation:** Show file path and allow navigation

### Visual Enhancements
1. **Smooth Animations:** Subtle transitions for tab switching and panel changes
2. **Loading States:** Better loading indicators for all async operations
3. **Status Bar:** File info, cursor position, word count, selection stats
4. **Minimap:** Code minimap for large files (optional)
5. **Focus Indicators:** Clear visual feedback for all interactive elements

### Keyboard Shortcuts (Complete Set)
```typescript
const keyboardShortcuts = {
  // File Operations
  'Ctrl+N': 'New File',
  'Ctrl+O': 'Open Folder',
  'Ctrl+S': 'Save File',
  'Ctrl+Shift+S': 'Save All',
  'Ctrl+W': 'Close Tab',
  'Ctrl+Shift+W': 'Close All Tabs',
  'Ctrl+Shift+T': 'Reopen Closed Tab',
  
  // Navigation
  'Ctrl+P': 'Quick File Switcher',
  'Ctrl+Shift+P': 'Command Palette',
  'Ctrl+Tab': 'Next Tab',
  'Ctrl+Shift+Tab': 'Previous Tab',
  'Ctrl+1-9': 'Jump to Tab Number',
  
  // Search
  'Ctrl+F': 'Find in File',
  'Ctrl+Shift+F': 'Find in All Files',
  'Ctrl+H': 'Replace in File',
  'Ctrl+Shift+H': 'Replace in All Files',
  
  // Editor
  'Ctrl+B': 'Bold',
  'Ctrl+I': 'Italic',
  'Ctrl+K': 'Insert Link',
  'Ctrl+Shift+M': 'Toggle Preview',
  'F11': 'Toggle Writing Mode',
  
  // View
  'Ctrl+`': 'Toggle Sidebar',
  'Ctrl+Shift+`': 'Toggle Search Panel',
  'Ctrl++': 'Increase Font Size',
  'Ctrl+-': 'Decrease Font Size',
};
```

## Error Handling & Edge Cases

### File System Edge Cases
- **Network Drives:** Handle slow or disconnected network storage
- **Permission Changes:** Detect when file permissions change during editing
- **Disk Space:** Warn users when disk space is low before saving
- **File Locks:** Handle files locked by other applications
- **Symlinks:** Proper handling of symbolic links in file browsing

### User Experience Edge Cases
- **Large Files:** Progressive loading and editing for files >50MB
- **Many Tabs:** Tab overflow with scrolling and "show all tabs" menu
- **Long Filenames:** Truncation with tooltip showing full name
- **Rapid File Changes:** Batch notifications to avoid spam
- **Conflicting Shortcuts:** Resolution when custom shortcuts conflict

## Testing Strategy

### Automated Testing
- **File Operations:** Unit tests for all file manipulation functions
- **State Management:** Tests for tab management and file watching
- **Search Functionality:** Performance tests for search across large file sets
- **Keyboard Shortcuts:** Integration tests for all shortcut combinations

### Manual Testing Scenarios
- Open 10+ tabs and verify performance remains acceptable
- Edit files externally while app is open, verify change detection
- Test drag-and-drop file operations within the app
- Verify search works across files with various markdown content
- Test all keyboard shortcuts in different application states

### Performance Benchmarks
- **Tab Switching:** Under 100ms between any two tabs
- **File List Update:** Real-time updates complete within 500ms
- **Global Search:** Results appear within 2 seconds for 100+ files
- **Auto-Save:** Background saves complete without UI blocking

## Success Metrics

- **User Retention:** Users continue using app after initial trial period
- **Feature Usage:** Advanced features are discovered and used regularly
- **Performance:** App remains responsive under heavy usage
- **Error Rate:** Significant reduction in file operation errors
- **User Feedback:** Positive feedback about improved workflow efficiency

## Known Limitations

- **Memory Usage:** Multiple open tabs increase memory consumption
- **File Watching:** High CPU usage with very large folders (1000+ files)
- **Search Performance:** Full-text search may be slow with very large files
- **Platform Differences:** Some features may behave differently across OS
- **Learning Curve:** Advanced features require user education

## Next Phase Prerequisites

Before moving to Phase 3 (Advanced Features), ensure:
1. All enhancement features are stable and performant
2. User feedback indicates workflow improvements are valuable
3. Memory usage and performance remain within acceptable limits
4. Error handling covers all identified edge cases
5. Keyboard shortcuts and UX patterns are consistent

---

**Previous Phase:** [Phase 1: MVP](./phase-1-mvp.md) - Core functionality  
**Next Phase:** [Phase 3: Advanced Features](./phase-3-advanced.md) - Rich editing and WYSIWYG capabilities 