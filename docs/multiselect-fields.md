# MultiSelect Fields in GTD Space

> **Note**: Single-select fields are now the primary implementation for Status, Effort, and Project Status. See [SingleSelect Fields](singleselect-fields.md) for the current approach. This document covers multi-select fields which are still supported for tags and legacy content.

## Overview

Multiselect fields are primarily used for associating multiple tags or categories with an item in your markdown files. While historically used for other fields like Status and Effort, these are now handled by single-select fields for better data consistency. Multiselect should be reserved for use cases where multiple, independent values are genuinely applicable, such as tags.

## Automatic Creation
New projects and actions are no longer created with multiselect fields for status or effort. Instead, they use **single-select** fields to ensure data consistency.

For details on how these fields are implemented, see [SingleSelect Fields](singleselect-fields.md).

## Markdown Syntax
Multiselect fields use a special marker syntax in markdown, primarily for `tags` and `contexts`.
```
[!multiselect:type:value,value2]
```

Examples:
- `[!multiselect:tags:urgent,home]`
- `[!multiselect:contexts:work,deep]`

**Important Note on Legacy MultiSelect Markers:**

The legacy `!multiselect:status`, `!multiselect:effort`, and `!multiselect:project-status` markers are **no longer parsed, migrated, or preserved**. When a file containing these markers is loaded, they will be skipped and effectively dropped from the document.

**Example of Dropped Input:**
If your markdown contains:
```
[!multiselect:status:in-progress,waiting]
```
This marker will be ignored and removed when the file is loaded in the editor.

**Recommended Migration:**
To preserve this information, you must manually convert these to the new single-select format or recreate the options. For example, `[!multiselect:status:in-progress,waiting]` should be manually converted to `[!singleselect:status:in-progress]` (if only one status is desired) or the information should be re-entered using the appropriate single-select fields.

## Manual Insertion
You can manually insert multiselect fields for `contexts` using a keyboard shortcut:

- **Cmd+Shift+C** (Mac) / **Ctrl+Shift+C** (Windows/Linux): Insert Contexts field

Shortcuts for `status`, `effort`, and `project-status` now insert single-select fields. See [SingleSelect Fields](singleselect-fields.md) for more information.

## How It Works
1. When markdown files are loaded, the special markers are converted to interactive BlockNote multiselect blocks
2. The multiselect UI renders as a dropdown with predefined options
3. When saved, the selected values are preserved in the markdown using the marker syntax
4. This ensures fields cannot be accidentally overwritten with plain text

## Legacy HTML Support
Files created before this update may contain HTML-based multiselect fields. These are still supported and will be converted to the new format when edited.