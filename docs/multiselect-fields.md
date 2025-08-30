# MultiSelect Fields in GTD Space

> **Note**: Single-select fields are now the primary implementation for Status, Effort, and Project Status. See [SingleSelect Fields](singleselect-fields.md) for the current approach. This document covers multi-select fields which are still supported for tags and legacy content.

## Overview

Multiselect fields are primarily used for associating multiple tags or categories with an item in your markdown files. While historically used for other fields like Status and Effort, these are now handled by single-select fields for better data consistency. Multiselect should be reserved for use cases where multiple, independent values are genuinely applicable, such as tags.

## Automatic Creation
All new projects and actions are automatically created with multiselect fields:

### Projects
- **Status**: Project status (Active, Planning, On Hold, Completed, Cancelled)

### Actions  
- **Status**: Action status (In Progress, Waiting, Completed) — legacy; use single-select
- **Effort**: Time estimate (Small <30min, Medium 30-90min, Large >90min, Extra Large >3hrs) — legacy; use single-select

## Markdown Syntax
Multiselect fields use a special marker syntax in markdown:
```
[\!multiselect:type:value]
```

Examples:
- `[\!multiselect:status:not-started]`
- `[\!multiselect:effort:medium]`
- `[\!multiselect:project-status:active]`

## Manual Insertion
You can manually insert multiselect fields using keyboard shortcuts:

- **Cmd+Shift+S** (Mac) / **Ctrl+Shift+S** (Windows/Linux): Insert Status field
- **Cmd+Shift+E** (Mac) / **Ctrl+Shift+E** (Windows/Linux): Insert Effort field  
- **Cmd+Shift+P** (Mac) / **Ctrl+Shift+P** (Windows/Linux): Insert Project Status field
- **Cmd+Shift+C** (Mac) / **Ctrl+Shift+C** (Windows/Linux): Insert Contexts field

## How It Works
1. When markdown files are loaded, the special markers are converted to interactive BlockNote multiselect blocks
2. The multiselect UI renders as a dropdown with predefined options
3. When saved, the selected values are preserved in the markdown using the marker syntax
4. This ensures fields cannot be accidentally overwritten with plain text

## Legacy HTML Support
Files created before this update may contain HTML-based multiselect fields. These are still supported and will be converted to the new format when edited.
