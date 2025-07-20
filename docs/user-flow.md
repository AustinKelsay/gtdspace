# User Flow - Tauri Markdown Editor

> **Purpose:** This document defines the user journey through different segments of the Tauri Markdown Editor application, mapping how features connect to guide project architecture and UI elements.

## Overview

The user flow is organized around **five core journey types** that correspond to the three development phases outlined in the project overview. Each flow shows feature connections and dependencies to guide implementation priorities.

## Primary User Flows

### 1. Initial Setup Flow (First-Time User Experience)

**Entry Point:** Application Launch → No Previous State

```
App Launch
    ↓
Theme Detection/Selection (System → Light/Dark)
    ↓
Folder Selection Dialog (Tauri Dialog API)
    ↓
File System Permission Prompt
    ↓
File Listing Generation (.md files)
    ↓
Initial UI Layout (Sidebar + Editor Area)
    ↓
Ready for Editing
```

**Feature Connections:**
- **Folder Selection** → **File Listing** → **Sidebar File Browser**
- **Theme Detection** → **Editor Themes** → **UI Styling**
- **File System Access** → **File Watching** → **Auto-reload Prompts**

**Phase 1 Dependencies:** Folder selection, file listing, basic UI layout

---

### 2. Daily Editing Flow (Core Productivity Loop)

**Entry Point:** Application Launch → Existing Workspace

```
App Launch
    ↓
Recent Files Loading (Phase 3)
    ↓
Workspace Restoration (Last opened folder)
    ↓
File Selection (Sidebar → Editor)
    ↓
[EDITING LOOP]
    Edit Content ←→ Auto-save ←→ Live Preview
         ↓              ↓           ↓
    Format Text    File Watching   Quick Switch
         ↓              ↓           ↓
    Keyboard      System Notify   Tab Management
    Shortcuts     (if changed)
    ↓
Save Confirmation/Status
```

**Feature Connections:**
- **File Selection** → **Tabbed Interface** → **Fast File Switching**
- **Auto-save** → **File Watching** → **System Notifications**
- **Editor** → **Split Preview** → **Live Formatting** (Phase 2)
- **Search** → **File Filtering** → **Content Navigation**

**Cross-Phase Dependencies:**
- Phase 1: Basic editor, auto-save, file switching
- Phase 2: WYSIWYG editor, live formatting, toolbar controls
- Phase 3: Recent files, word count stats, focus mode

---

### 3. File Management Flow (Organization & Creation)

**Entry Point:** File Operations from Sidebar or Menu

```
File Management Trigger
    ↓
[CREATE PATH]                    [MANAGE PATH]
New File → Template Selection → Create → Open in Editor
    ↓                                ↓
File Naming Dialog              Rename/Delete Operations
    ↓                                ↓
Auto-open in Editor            Confirmation Dialogs
                                     ↓
                              File List Refresh
                                     ↓
                              Update Recent Files (Phase 3)
```

**Feature Connections:**
- **File Operations** → **File List Refresh** → **File Watching**
- **File Templates** (Phase 3) → **New File Creation** → **Auto-open**
- **File Metadata** (Phase 3) → **File Operations** → **Status Display**
- **Bookmark System** (Phase 3) → **Quick Access** → **File Selection**

**Workflow Variations:**
- **Folder Tree Navigation** (Phase 3) → **Nested File Operations**
- **Global Search** (Phase 3) → **File Discovery** → **File Opening**

---

### 4. Advanced Editing Flow (Rich Content Creation)

**Entry Point:** WYSIWYG Mode Activation (Phase 2)

```
Basic Editor (Phase 1)
    ↓
Toggle WYSIWYG Mode (Phase 2)
    ↓
[RICH EDITING LOOP]
Block-based Editing ←→ Toolbar Controls ←→ Live Formatting
         ↓                    ↓                ↓
    Drag & Drop          Format Options    Markdown Sync
         ↓                    ↓                ↓
Content Restructure    Table Creation    Source Toggle
    ↓
[SPECIALIZED CONTENT]
Images → Link Management → Code Blocks → Math Support
    ↓           ↓              ↓            ↓
Local File   Auto-complete   Syntax      LaTeX
Display      Internal Links  Highlighting Rendering
```

**Feature Connections:**
- **WYSIWYG Toggle** → **Markdown Serialization** → **Source View**
- **Block Editing** → **Drag & Drop** → **Content Reordering**
- **Toolbar Controls** → **Keyboard Shortcuts** → **Custom Shortcuts** (Phase 2)
- **Extension System** (Phase 2) → **Custom Content Types** → **Modular Features**

**Export/Output Flow:**
```
Rich Content Creation
    ↓
Export Options (Phase 2)
    ↓
[OUTPUT FORMATS]
PDF ← HTML ← Styled Markdown ← Print Support
```

---

### 5. Search & Navigation Flow (Content Discovery)

**Entry Point:** Search Activation (Multiple Triggers)

```
Search Triggers
    ↓
[SEARCH TYPES]
File Search ←→ Content Search ←→ Global Search (Phase 3)
    ↓              ↓                ↓
File Filtering  Current File    All Files in Workspace
    ↓              ↓                ↓
Quick Switch   Find & Replace   Full-text Results
                   ↓                ↓
              Regex Support    Search Navigation
                                   ↓
                              File Opening
```

**Feature Connections:**
- **Search Functionality** → **File Filtering** → **Quick Navigation**
- **Global Search** (Phase 3) → **Content Discovery** → **File Opening**
- **Document Outline** (Phase 3) → **Header Navigation** → **Content Jumping**
- **Find & Replace** (Phase 3) → **Content Modification** → **Auto-save**

**Navigation Enhancement Flow:**
```
Content Navigation
    ↓
Document Outline (Phase 3) ←→ Bookmark System (Phase 3)
    ↓                              ↓
Header-based TOC              Pinned Files
    ↓                              ↓
Quick Jumping                 Quick Access
```

---

## Feature Integration Map

### Core Feature Dependencies

**Phase 1 Foundation:**
```
Folder Selection → File System Access → File Listing → File Operations
        ↓                ↓                 ↓             ↓
   UI Layout    →   File Watching   →  Auto-save  → Editor Integration
```

**Phase 2 Rich Editing:**
```
Phase 1 Editor → WYSIWYG Toggle → Rich Components → Export Features
       ↓              ↓               ↓             ↓
  Syntax Support → Live Preview → Content Blocks → Output Generation
```

**Phase 3 Advanced Features:**
```
File Management → Global Search → Productivity Features → System Integration
       ↓              ↓               ↓                    ↓
   Metadata      → Content Discovery → Focus Tools → Native Menus
```

### Cross-Phase Feature Connections

1. **Search System Evolution:**
   - Phase 1: Basic file search + content search (current file)
   - Phase 3: Global search (all files) + advanced find/replace

2. **File Management Progression:**
   - Phase 1: Basic file operations + file watching
   - Phase 3: Templates + bookmarks + metadata + tree view

3. **Editor Enhancement Path:**
   - Phase 1: Basic markdown editor + split preview
   - Phase 2: WYSIWYG + rich formatting + specialized content
   - Phase 3: Focus mode + document outline + word count

## Critical User Journey Questions

Based on the project overview, I have several clarifying questions to ensure the user flow accurately reflects the intended experience:

1. **File Selection Persistence:** When users reopen the application, should it:
   - Remember the last selected folder and restore the file list?
   - Remember which specific files were open in tabs?
   - Both of the above?

2. **WYSIWYG Mode Switching:** In Phase 2, when users toggle between WYSIWYG and source mode:
   - Should this be per-file or a global application setting?
   - Should the mode choice persist across application restarts?

3. **Search Scope Progression:** The evolution from basic search to global search:
   - Should basic search (Phase 1) include both filename and content search?
   - How should the search UI evolve to accommodate global search in Phase 3?

4. **Template System Integration:** For Phase 3 file templates:
   - Should templates be available during the "New File" flow from Phase 1?
   - Should templates be customizable by users or predefined only?

5. **Cross-Platform Feature Variations:** Given the mention of platform differences:
   - Are there specific features that should behave differently on macOS vs Windows vs Linux?
   - Should the user flow account for platform-specific UI patterns?

These questions will help refine the user flow and ensure the architecture properly supports the intended user experience across all development phases. 