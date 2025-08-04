# GTD Implementation Guide

This guide explains how GTD Space implements David Allen's Getting Things Done (GTD) methodology.

**Updated**: January 2025 - GTD-First Architecture

## Overview

GTD Space is a GTD-first application where the Getting Things Done methodology is the primary experience, not an add-on feature. The entire UI is designed around GTD workflows, with markdown editing as a supporting capability.

## GTD Space Structure

When you initialize a GTD space, the following directory structure is created:

```
Your GTD Space/
├── Projects/           # Active projects with actions
├── Habits/            # Recurring habits and routines
├── Someday Maybe/     # Ideas for future consideration
├── Cabinet/           # Reference materials
└── Welcome to GTD Space.md
```

## Projects

Projects are outcome-focused goals that require multiple actions to complete.

### Project Structure

Each project is a folder containing:

- `README.md` - Project metadata and description
- Action files - Individual markdown files for each action

### Project README Format

```markdown
# Project Name

## Description

What is the desired outcome of this project?

## Due Date

YYYY-MM-DD or "Not set"

## Status

Active | On Hold | Complete | Cancelled

## Actions

Actions for this project are stored as individual markdown files in this directory.
```

### Creating Projects

Use the GTD Project dialog or create manually:

```typescript
// Via UI
- Click "Initialize GTD Space" button
- Select folder
- Use "Create Project" dialog

// Project fields
- Name: Clear, outcome-focused title
- Description: Desired end result
- Due Date: Optional deadline
- Status: Automatically set to "Active"
```

## Actions

Actions are concrete next steps that move projects forward.

### Action File Format

```markdown
# Action Name

## Status

Not Started | In Progress | Complete

## Due Date

YYYY-MM-DD or "Not set"

## Effort

Small (<30 min) | Medium (30-90 min) | Large (>90 min)

## Notes

Additional details about this action
```

### Creating Actions

Actions must be created within a project folder:

```typescript
// Via UI
- Select a project
- Click "Add Action"
- Fill in details

// Action fields
- Name: Clear, actionable description
- Status: Track progress
- Due Date: Optional deadline
- Effort: Time estimate for planning
```

## GTD Workflow

### 1. Capture

- Create projects for any outcome requiring multiple steps
- Add actions as you think of them
- Use "Someday Maybe" for ideas (coming soon)

### 2. Clarify

- Write clear project descriptions focused on outcomes
- Make action names specific and actionable
- Estimate effort to help with planning

### 3. Organize

- Projects folder contains all active work
- Use status fields to track progress
- Due dates help prioritize

### 4. Review

- Regular review of all projects and actions
- Update statuses as work progresses
- Move completed projects to archive (manual)

## Backend Implementation

### Tauri Commands

**Rust Backend (snake_case parameters):**

```rust
// Initialize GTD space
initialize_gtd_space(space_path: String) -> Result<String, String>

// Create new project
create_gtd_project(
    space_path: String,
    project_name: String,
    description: String,
    due_date: Option<String>
) -> Result<String, String>

// Create new action
create_gtd_action(
    project_path: String,
    action_name: String,
    status: String,
    due_date: Option<String>,
    effort: String
) -> Result<String, String>

// List projects with metadata
list_gtd_projects(space_path: String) -> Result<Vec<GTDProject>, String>
```

**TypeScript Frontend (camelCase parameters):**

```typescript
// Initialize GTD space
await invoke('initialize_gtd_space', { spacePath });

// Create new project
await invoke('create_gtd_project', {
  spacePath,
  projectName,
  description,
  dueDate,
});

// Create new action
await invoke('create_gtd_action', {
  projectPath,
  actionName,
  status,
  dueDate,
  effort,
});

// List projects
await invoke('list_gtd_projects', { spacePath });
```

**Note:** Tauri automatically converts camelCase parameters to snake_case when calling Rust functions.

### Data Structures

**TypeScript interfaces (snake_case to match Rust backend):**

```typescript
// Project
interface GTDProject {
  name: string;
  description: string;
  due_date?: string | null; // snake_case to match Rust
  status: GTDProjectStatus;
  path: string;
  created_date: string; // snake_case to match Rust
  action_count?: number; // snake_case to match Rust
}

// Action
interface GTDAction {
  name: string;
  path: string;
  status: GTDActionStatus;
  due_date?: string | null; // snake_case to match Rust
  effort: GTDActionEffort;
  notes?: string;
  created_date: string; // snake_case to match Rust
  project_path: string; // snake_case to match Rust
}
```

**Note:** Data structures use snake_case to maintain consistency with the Rust backend serialization.

## UI Components

### GTD-First Architecture

The application starts with GTD as the primary interface:

- **No generic file browser by default** - GTD workspace is the main view
- **Automatic initialization prompt** - When selecting a non-GTD folder
- **Persistent sidebar state** - GTD workspace remains loaded when sidebar is toggled
- **Smart empty states** - Clear CTAs for folder selection and space initialization

### GTDWorkspaceSidebar

- **Projects with expandable actions** - Click chevron to see all actions
- **Direct action access** - Click any action to open in editor
- **Project README auto-open** - Clicking project opens its README.md
- **Inline action creation** - Plus button on each project
- **Search functionality** - Filter projects by name/description
- **Workspace switching** - Change between GTD spaces easily

### GTDDashboard

- **Overview statistics** - Active projects, total actions, completion rates
- **Attention required section** - Overdue projects and upcoming deadlines
- **Active projects list** - Quick access to all active work
- **Progress visualization** - See project completion at a glance

### GTDInitDialog

- Initialize new GTD space
- Shows structure preview
- Creates all directories
- **Auto-appears for non-GTD folders**

### GTDProjectDialog

- Create new projects
- Enforces required fields
- Generates README.md
- **Success feedback with toast notifications**

### GTDActionDialog

- Create actions within projects
- Status and effort selection
- Optional due dates
- **Creates markdown files with proper structure**

### GTDQuickActions (Floating Action Button)

- **Context-aware creation** - Shows project creation at root, action creation in projects
- **Quick access menu** - Hover for creation options
- **Keyboard-friendly** - Accessible via shortcuts

## Hook: useGTDSpace

Manages all GTD operations with improved state management:

```typescript
const {
  gtdSpace, // Current space state with root_path tracking
  isLoading, // Loading indicator
  initializeSpace, // Create new space
  createProject, // Add project with toast feedback
  createAction, // Add action with toast feedback
  checkGTDSpace, // Verify space (smart subdirectory handling)
  loadProjects, // Load project list with action counts
} = useGTDSpace();
```

### Key Improvements

- **Root path tracking** - Maintains GTD space context across navigation
- **Success notifications** - User feedback for all operations
- **Deduplication** - Prevents duplicate toasts in React StrictMode
- **Smart path handling** - Correctly handles subdirectory navigation

## Recent Improvements (January 2025)

### UI/UX Enhancements

1. **GTD-First Experience**

   - Removed mode switching - GTD is now the default
   - Automatic GTD initialization prompts
   - Simplified navigation flow

2. **Sidebar Improvements**

   - Actions visible directly under projects
   - Persistent state when toggling sidebar
   - Expandable project sections
   - Click actions to open in editor

3. **Better Feedback**

   - Toast notifications for all operations
   - Deduplication to prevent double notifications
   - File change notifications with smart deduping

4. **Navigation Fixes**
   - Correct path handling for GTD sections
   - Project README auto-opens when selected
   - Subdirectory navigation preserves GTD context

### Technical Improvements

1. **Parameter Fixes**

   - Clarified naming conventions: Rust uses snake_case, TypeScript uses camelCase
   - Tauri automatically handles parameter conversion between languages
   - Proper TypeScript interfaces for MarkdownFile

2. **State Management**

   - GTD space state persists across navigation
   - Smart detection prevents re-initialization prompts
   - Root path tracking for correct operations

3. **Performance**
   - Sidebar stays mounted when hidden
   - Deduplication prevents excessive re-renders
   - Efficient action list loading

## Best Practices

### Project Names

- Use outcome-focused language
- Be specific: "Launch Company Blog" not "Blog"
- Avoid vague terms: "Improve X" → "Implement X System"

### Action Names

- Start with a verb
- Be specific enough to act on
- One clear next step
- Examples:
  - ✅ "Draft blog post outline"
  - ✅ "Call John about budget"
  - ❌ "Blog stuff"
  - ❌ "Budget"

### Status Management

- Update statuses regularly
- "In Progress" = actively working
- Complete actions promptly
- Review "On Hold" projects weekly

### Effort Estimation

- Small: Quick tasks, under 30 minutes
- Medium: Focused work sessions, 30-90 minutes
- Large: Major tasks, plan for multiple sessions

## Future Enhancements

### Planned Features

1. **Habits Directory**

   - Recurring tasks
   - Tracking streaks
   - Habit templates

2. **Someday Maybe**

   - Idea capture
   - Regular review prompts
   - Easy promotion to projects

3. **Cabinet**

   - Reference materials
   - Project archives
   - Resource organization

4. **Advanced Features**
   - Project templates
   - Batch operations
   - Progress analytics
   - Calendar integration
   - Context tags (@computer, @phone, etc.)

### Integration Ideas

- Weekly review checklist
- Project archiving
- Action dependencies
- Time tracking
- Export to task managers

## Troubleshooting

### Common Issues

1. **Duplicate notifications**

   - This is fixed with deduplication logic
   - 100ms window prevents React StrictMode duplicates
   - Both toasts and file notifications are deduped

2. **Actions not showing in sidebar**

   - Click the chevron next to project name
   - Actions load dynamically when project is expanded
   - README.md is filtered out from action list

3. **GTD initialization dialog appears in GTD space**
   - Fixed with smart path detection
   - Root path is tracked to prevent false negatives
   - Subdirectories correctly identified as part of GTD space

### Fixed Issues

1. **Projects not showing**

   - Ensure README.md exists in project folder
   - Check file permissions
   - Verify GTD space initialization

2. **Actions not counted**

   - Actions must be .md files
   - Must be in project directory
   - Exclude README.md from count

3. **Can't create files**
   - Check folder permissions
   - Verify Tauri file system access
   - Try running as administrator

### Debug Tips

```typescript
// Check GTD space
const isValid = await checkGTDSpace('/path/to/space');

// Manually verify structure
ls -la "Your GTD Space/"

// Check Rust logs
npm run tauri:dev
// Look for [commands/mod.rs] entries
```

## Philosophy

GTD Space implements core GTD principles:

1. **Capture everything** - Easy project/action creation
2. **Clarify outcomes** - Project descriptions focus on results
3. **Organize by context** - Structured folders
4. **Review regularly** - Status tracking enables reviews
5. **Engage with confidence** - Clear next actions

The implementation stays simple and focused, avoiding feature creep that could complicate the GTD workflow.
