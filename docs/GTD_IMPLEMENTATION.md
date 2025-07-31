# GTD Implementation Guide

This guide explains how GTD Space implements David Allen's Getting Things Done (GTD) methodology.

## Overview

GTD Space provides built-in support for organizing your work using the GTD system. The implementation focuses on the core components: Projects, Actions, and structured organization.

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

### Data Structures

```typescript
// Project
interface GTDProject {
  name: string;
  description: string;
  due_date?: string | null;
  status: GTDProjectStatus;
  path: string;
  created_date: string;
  action_count?: number;
}

// Action
interface GTDAction {
  name: string;
  path: string;
  status: GTDActionStatus;
  due_date?: string | null;
  effort: GTDActionEffort;
  notes?: string;
  created_date: string;
  project_path: string;
}
```

## UI Components

### GTDInitDialog
- Initialize new GTD space
- Shows structure preview
- Creates all directories

### GTDProjectDialog
- Create new projects
- Enforces required fields
- Generates README.md

### GTDActionDialog
- Create actions within projects
- Status and effort selection
- Optional due dates

### GTDProjectList
- Display all projects
- Show status indicators
- Action counts
- Click to open project

## Hook: useGTDSpace

Manages all GTD operations:

```typescript
const {
  gtdSpace,        // Current space state
  isLoading,       // Loading indicator
  initializeSpace, // Create new space
  createProject,   // Add project
  createAction,    // Add action
  checkGTDSpace,   // Verify space
  loadProjects     // Load project list
} = useGTDSpace();
```

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