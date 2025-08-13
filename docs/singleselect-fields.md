# SingleSelect Fields in GTD Space

## Overview
GTD Space uses interactive single-select fields for standardized properties like Status, Effort, and Project Status. These fields work like Notion's select fields - they cannot be accidentally overwritten with text and provide a consistent dropdown interface.

## Automatic Creation
All new projects and actions are automatically created with single-select fields:

### Projects
- **Status**: Project status (in-progress, waiting, completed)

### Actions  
- **Status**: Action status (in-progress, waiting, complete)
- **Effort**: Time estimate (small <30min, medium 30-90min, large >90min, extra-large >3hrs)

## Markdown Syntax
Single-select fields use a special marker syntax in markdown:
```
[!singleselect:type:value]
```

Examples:
- `[!singleselect:status:in-progress]`
- `[!singleselect:effort:medium]`
- `[!singleselect:project-status:waiting]`

## Manual Insertion
You can manually insert single-select fields using keyboard shortcuts:

- **Cmd+Alt+S** (Mac) / **Ctrl+Alt+S** (Windows/Linux): Insert Status field
- **Cmd+Alt+E** (Mac) / **Ctrl+Alt+E** (Windows/Linux): Insert Effort field  
- **Cmd+Alt+P** (Mac) / **Ctrl+Alt+P** (Windows/Linux): Insert Project Status field

## How It Works
1. When markdown files are loaded, the special markers are converted to interactive BlockNote single-select blocks
2. The single-select UI renders as a dropdown with predefined options
3. When saved, the selected value is preserved in the markdown using the marker syntax
4. This ensures fields cannot be accidentally overwritten with plain text

## Legacy MultiSelect Support
The system still supports multi-select fields for backwards compatibility:
- `[!multiselect:tags:value1,value2]` - For tags and categories
- These are primarily used for legacy content and specific use cases where multiple selections are needed

## Real-time Updates
- Status changes are immediately reflected in the sidebar
- The Content Event Bus ensures all UI components stay synchronized
- Changes trigger metadata events that update the project/action lists

## Bidirectional Title Sync
When you change the title in a document:
1. The title is extracted from the markdown metadata
2. On save, if the title differs from the filename/folder name, it automatically renames
3. Projects rename their folders, actions rename their files
4. Open tabs automatically update to the new paths
5. The sidebar immediately reflects the new names