# Phase 1: MVP - Core Functionality

> **Goal:** Create a minimal but usable markdown editor that allows users to select a folder, browse markdown files, edit content, and save changes. This phase delivers the core value proposition and represents the first truly functional version.

## Phase Overview

**Duration:** 1-2 weeks  
**Status:** Minimal Viable Product  
**Value Delivered:** Basic markdown editing with file management  
**User Experience:** Users can open a folder, edit markdown files, and save changes

## Success Criteria

- [ ] Users can select a folder containing markdown files
- [ ] File list displays all .md files with basic metadata (name, size, date)
- [ ] Users can open files for editing in a basic text editor
- [ ] Changes are automatically saved with visual feedback
- [ ] File search/filtering works across filenames
- [ ] Basic error handling for file operations

## Core Features

### 1. Folder Selection & File Listing
**Deliverable:** Working file browser that discovers and displays markdown files

**Steps:**
1. Implement Tauri dialog API for folder selection with proper permissions
2. Create Rust command to scan directory and return markdown file list
3. Build React component to display file list with name, size, and modification date
4. Add loading states during file discovery and error handling for permission issues
5. Implement file list sorting (name, date, size) with persistent user preference

**Components:**
- `FolderSelector.tsx` - Folder selection dialog trigger
- `FileList.tsx` - Displays discovered markdown files
- `FileItem.tsx` - Individual file list item with metadata

**Rust Commands:**
```rust
select_folder() -> Result<String, String>
list_markdown_files(path: String) -> Result<Vec<MarkdownFile>, String>
```

### 2. Basic Text Editor
**Deliverable:** Simple but functional markdown editor with syntax highlighting

**Steps:**
1. Integrate basic text editor (HTML textarea with enhancements or simple CodeMirror)
2. Add markdown syntax highlighting for headers, links, bold, italic
3. Implement basic keyboard shortcuts (Ctrl+S for save, Ctrl+F for find)
4. Add line numbers and basic editor preferences (font size, tab size)
5. Create split-view toggle between editor and rendered preview

**Components:**
- `TextEditor.tsx` - Main editing interface
- `MarkdownPreview.tsx` - Basic rendered markdown display
- `EditorToolbar.tsx` - Simple formatting controls

**Features:**
- Syntax highlighting for markdown elements
- Find functionality within current file
- Tab support for indentation
- Word wrap toggle

### 3. File Operations
**Deliverable:** Create, save, rename, and delete file functionality

**Steps:**
1. Implement auto-save functionality that saves changes every 2-3 seconds
2. Add manual save with visual feedback (save status indicator)
3. Create new file dialog with template content (basic markdown structure)
4. Implement file rename functionality with validation
5. Add delete file confirmation dialog with proper error handling

**Rust Commands:**
```rust
read_file(path: String) -> Result<String, String>
save_file(path: String, content: String) -> Result<(), String>
create_file(path: String, name: String) -> Result<String, String>
rename_file(old_path: String, new_name: String) -> Result<String, String>
delete_file(path: String) -> Result<(), String>
```

**UI Elements:**
- Auto-save indicator (spinning icon when saving, checkmark when saved)
- File context menu (right-click for rename/delete)
- New file button with name input dialog

### 4. Basic Search & Navigation
**Deliverable:** Search across filenames and quick file switching

**Steps:**
1. Add search input that filters file list based on filename matching
2. Implement fuzzy search algorithm for flexible filename matching
3. Create keyboard shortcut (Ctrl+P) for quick file switcher dialog
4. Add recent files tracking for faster access to commonly edited files
5. Implement basic find-in-file functionality (Ctrl+F) for current editor

**Components:**
- `FileSearch.tsx` - Search input with real-time filtering
- `QuickSwitcher.tsx` - Modal dialog for fast file switching
- `FindInFile.tsx` - In-editor search overlay

**Features:**
- Real-time file list filtering
- Keyboard navigation in file list (up/down arrows, enter to open)
- Find and highlight text in current file
- Escape key to close search/switcher

### 5. Settings & Preferences
**Deliverable:** Basic user preferences that persist between sessions

**Steps:**
1. Create settings storage using Tauri's built-in storage APIs
2. Add theme toggle (dark/light mode) with system theme detection
3. Implement editor preferences (font size, tab size, word wrap)
4. Add window state persistence (remember size, position, and last opened folder)
5. Create simple settings dialog with form controls for all preferences

**Settings Schema:**
```typescript
interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lastFolder: string;
  windowState: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
}
```

**Components:**
- `SettingsDialog.tsx` - Modal settings configuration
- `ThemeToggle.tsx` - Theme switching control

## Technical Implementation

### Enhanced File Structure
```
src/
├── components/
│   ├── file-browser/
│   │   ├── FolderSelector.tsx
│   │   ├── FileList.tsx
│   │   └── FileItem.tsx
│   ├── editor/
│   │   ├── TextEditor.tsx
│   │   ├── MarkdownPreview.tsx
│   │   └── EditorToolbar.tsx
│   ├── search/
│   │   ├── FileSearch.tsx
│   │   ├── QuickSwitcher.tsx
│   │   └── FindInFile.tsx
│   ├── settings/
│   │   ├── SettingsDialog.tsx
│   │   └── ThemeToggle.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Modal.tsx
├── hooks/
│   ├── useFileManager.ts
│   ├── useSettings.ts
│   └── useAutoSave.ts
├── types/
│   ├── file.ts
│   └── settings.ts
└── utils/
    ├── fileUtils.ts
    └── searchUtils.ts
```

### Key Dependencies Added
```json
{
  "dependencies": {
    "react-markdown": "^8.0.7",
    "fuse.js": "^7.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "codemirror": "^6.0.1"
  }
}
```

### State Management
```typescript
// Main application state structure
interface AppState {
  currentFolder: string | null;
  files: MarkdownFile[];
  currentFile: MarkdownFile | null;
  fileContent: string;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  searchQuery: string;
  settings: UserSettings;
}
```

## User Experience Flow

### First-Time User Journey
1. **App Launch:** User sees welcome screen with "Select Folder" button
2. **Folder Selection:** User clicks button, system folder dialog opens
3. **File Discovery:** App scans folder, shows loading indicator, displays markdown files
4. **File Opening:** User clicks on a file, content loads in editor
5. **Editing:** User makes changes, sees auto-save indicator
6. **Navigation:** User can switch between files using sidebar or Ctrl+P

### Daily Usage Flow
1. **App Launch:** App remembers last folder and opens file list
2. **Quick Access:** Recent files appear at top of list
3. **File Switching:** Ctrl+P for quick switcher, or click in sidebar
4. **Content Search:** Ctrl+F to find text within current file
5. **File Management:** Right-click for rename/delete, "+" button for new file

## Error Handling

### File System Errors
- **Permission Denied:** Clear error message with suggestion to select different folder
- **File Not Found:** Remove from file list and show notification
- **Save Failures:** Retry mechanism with user notification
- **Large File Warning:** Warn users before opening files >10MB

### User Input Validation
- **File Names:** Validate against OS restrictions, suggest corrections
- **Folder Selection:** Verify folder exists and is readable
- **Content Safety:** Basic validation for extremely large content

## Testing Strategy

### Manual Testing Checklist
- [ ] Can select folder with markdown files successfully
- [ ] File list displays correct information and updates when files change externally
- [ ] Can create new files with valid names
- [ ] Can open, edit, and save changes to existing files
- [ ] Auto-save works consistently without data loss
- [ ] Search filters files correctly and performance is acceptable
- [ ] Settings persist across application restarts
- [ ] Error states display helpful messages to users

### Performance Requirements
- **File List Loading:** Display under 1 second for folders with <100 files
- **File Opening:** Content appears within 500ms for files <1MB
- **Auto-Save:** Completes within 200ms for typical file sizes
- **Search:** Results update in real-time as user types

## Known Limitations

- **Single Folder:** Can only work with one folder at a time
- **Basic Editor:** No rich text formatting or advanced editor features
- **No File Watching:** Changes made outside the app require manual refresh
- **Limited File Types:** Only supports .md files, ignores other markdown extensions
- **No Backup:** No automatic backup or version history

## Success Metrics

- **Functionality:** All core features work without crashes
- **Usability:** New users can open a folder and edit files within 2 minutes
- **Performance:** App feels responsive for typical usage patterns
- **Data Safety:** No reports of data loss during normal operations
- **Cross-Platform:** Works identically on Windows, macOS, and Linux

## Next Phase Prerequisites

Before moving to Phase 2 (Enhancement), ensure:
1. All MVP features are stable and well-tested
2. User feedback indicates core value proposition is met
3. Performance meets stated requirements
4. Error handling provides clear guidance to users
5. Code architecture can support additional features

---

**Previous Phase:** [Phase 0: Setup](./phase-0-setup.md) - Barebones application foundation  
**Next Phase:** [Phase 2: Enhancement](./phase-2-enhancement.md) - Improved UX and workflow optimizations 