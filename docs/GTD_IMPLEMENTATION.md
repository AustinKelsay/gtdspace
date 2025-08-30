# GTD Implementation Guide

This guide explains how GTD Space implements David Allen's Getting Things Done (GTD) methodology.

**Updated**: January 2025 - GTD-First Architecture

## Overview

GTD Space is a GTD-first application where the Getting Things Done methodology is the primary experience, not an add-on feature. The entire UI is designed around GTD workflows, with markdown editing as a supporting capability.

## GTD Space Structure

When you initialize a GTD space, the following directory structure is created:

```
Your GTD Space/
├── Horizons/          # Higher-level GTD perspectives
│   ├── Areas of Focus.md        # 20,000 ft - Ongoing responsibilities
│   ├── Goals (1-2 Years).md     # 30,000 ft - Medium-term objectives
│   ├── Vision (3-5 Years).md    # 40,000 ft - Long-term aspirations
│   └── Purpose & Principles.md  # 50,000 ft - Core values and mission
├── Projects/           # Active projects with actions
├── Habits/            # Recurring habits and routines
├── Someday Maybe/     # Ideas for future consideration
├── Cabinet/           # Reference materials
└── Welcome to GTD Space.md
```

## Horizons of Focus

The Horizons of Focus provide higher-level perspectives that guide your projects and actions:

### Areas of Focus (20,000 ft)
Ongoing responsibilities and roles you maintain in life. These never "complete" but require continuous attention:
- Personal areas (health, family, finances)
- Professional areas (role responsibilities, team leadership)
- Life management (home, admin, community)

### Goals (30,000 ft)
Specific achievements to accomplish within 1-2 years. These provide direction for your projects:
- Personal goals (health targets, learning objectives)
- Professional goals (career advancement, skill development)
- Relationship goals (family experiences, social connections)

### Vision (40,000 ft)
A vivid picture of where you want to be in 3-5 years. This guides your goal-setting:
- Life snapshot (where you're living, what you're doing)
- Key themes (patterns and values expressed)
- Success factors (capabilities and resources needed)

### Purpose & Principles (50,000 ft)
Your core values and life mission that drive everything else:
- Life mission statement (why you exist, what you contribute)
- Core values (top 5-7 principles)
- Decision filters (questions to align choices)

Each horizon file includes comprehensive templates to guide your planning and reflection.

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

A project uses a SingleSelect block to track its status. The block stores a canonical token representing the status.

The canonical status tokens are:
- `in-progress`
- `waiting`
- `completed`

Example: `[!singleselect:project-status:in-progress]`

**Note:** The UI may display more user-friendly labels (e.g., "Active" for `in-progress`). The code should map these display labels to the correct canonical tokens to ensure data consistency, as seen in hooks like `useCalendarData`.

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
- Status: Automatically set to "Active" (canonical token: `in-progress`)
```

## Actions

Actions are concrete next steps that move projects forward.

### Action File Format

```markdown
# Action Name

## Status

Display: In Progress | Waiting | Completed
Canonical tokens: `in-progress` | `waiting` | `completed`

## Focus Date

YYYY-MM-DD HH:MM AM/PM or "Not set"

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
- Focus Date: When you will work on this action (date and time)
- Due Date: Optional deadline (date only)
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
    due_date: Option<String>,
    status: Option<String>
) -> Result<String, String>

// Create new action
create_gtd_action(
    project_path: String,
    action_name: String,
    status: String,
    focus_date: Option<String>,
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
  status: 'in-progress',
});

// Create new action
await invoke('create_gtd_action', {
  projectPath,
  actionName,
  status,
  focusDate,
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
  created_date_time: string; // snake_case to match Rust
  action_count?: number; // snake_case to match Rust
}

// Action
interface GTDAction {
  name: string;
  path: string;
  status: GTDActionStatus;
  focus_date?: string | null; // snake_case to match Rust, ISO datetime
  due_date?: string | null; // snake_case to match Rust, ISO date
  effort: GTDActionEffort;
  notes?: string;
  created_date_time: string; // snake_case to match Rust
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

## Habits

Habits are recurring routines that automatically reset based on their frequency, providing a self-contained tracking system.

### Habit Structure

Each habit is a markdown file in the `Habits/` folder containing:

```markdown
# Habit Name

## Status
[!singleselect:habit-status:todo]

## Frequency
[!singleselect:habit-frequency:daily]

## Created
YYYY-MM-DD

## Notes
Description and details about the habit

## History
| Date | Time | Status | Action | Notes |
|------|------|--------|--------|-------|
| 2025-01-13 | 14:30 | To Do | Created | Initial habit creation |
| 2025-01-13 | 16:45 | Complete | Manual | Changed from To Do |
| 2025-01-14 | 00:01 | To Do | Auto-Reset | Was Complete, reset per daily schedule |
```

### Habit System Features

1. **Two-State System**: Habits have only 'todo' and 'complete' status
2. **Automatic Reset**: Status resets to 'todo' based on frequency at 00:01 daily
3. **History Tracking**: Every status change is recorded in a markdown table
4. **Self-Contained**: Each habit file contains its complete history

### Frequency Options

- **Daily**: Resets every day
- **Every Other Day**: Resets every 2 days
- **Twice Weekly**: Resets approximately every 3 days
- **Weekly**: Resets every 7 days
- **Biweekly**: Resets every 14 days
- **Monthly**: Resets every 30 days

### Creating Habits

```typescript
// Via UI
- Click "Create Habit" button
- Enter habit name
- Select frequency
- Habit automatically starts as 'todo'

// Backend command
await invoke('create_gtd_habit', {
  spacePath,
  habitName,
  frequency,
  status: 'todo' // Always starts as todo
});
```

### Habit Status Updates

When you change a habit's status through the UI:

1. The SingleSelectBlock updates the visual status
2. Backend records the change in the history table
3. History entry includes date, time, old/new status

```typescript
// Automatic backend call when status changes
await invoke('update_habit_status', {
  habitPath,
  newStatus: 'complete' // or 'todo'
});
```

### Automatic Reset System

The application handles habit resets in two ways:

#### Scheduled Reset (If App is Running)
- Checks every minute at 00:01
- Resets habits that have passed their frequency interval
- Records as "Auto-Reset" in the history table

#### Catch-up Reset (On App Startup)
- Immediately checks all habits when the app starts
- Catches up on any missed resets if the app wasn't running
- Records as "Catch-up Reset" in the history table
- Ensures habits are always current regardless of app uptime

The reset logic:
1. Only resets habits currently marked as 'complete'
2. Checks time since last action (not just resets)
3. Respects the frequency interval (daily, weekly, etc.)
4. Records all resets with timestamp for full traceability

### Keyboard Shortcuts

- **Cmd/Ctrl+Alt+F**: Insert Frequency field
- **Cmd/Ctrl+Alt+H**: Insert Habit Status field

### Example Habits

The system seeds 5 example habits:
- **Morning Exercise**: Daily physical activity routine
- **Weekly GTD Review**: Weekly system maintenance
- **Reading Practice**: Daily learning habit
- **Mindfulness Meditation**: Twice-weekly stress reduction
- **Evening Journal**: Daily reflection

## Future Enhancements

### Planned Features

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
