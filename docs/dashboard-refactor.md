# GTD Dashboard Refactor Documentation

## Overview
This document details the comprehensive refactor of the GTD Dashboard from a 4-tab layout to an enhanced 5-tab layout with improved data utilization and filtering capabilities.

## Architecture Changes

### Previous Structure (4 tabs)
- Overview - General stats and quick access
- Today's Focus - Time-based project view
- Habits - Basic habit tracking
- Horizons - GTD levels hierarchy

### New Structure (5 tabs)
1. **Overview** - Comprehensive high-level statistics and trends
2. **Actions** - All next actions with advanced filtering
3. **Projects** - Complete project management view
4. **Habits** - Enhanced habit tracking with history and analytics
5. **Horizons** - Relationship mapping between GTD levels

## Component Structure

```
src/components/dashboard/
├── DashboardOverview.tsx    # High-level stats and visualizations
├── DashboardActions.tsx     # Filterable actions list
├── DashboardProjects.tsx    # Filterable projects list
├── DashboardHabits.tsx      # Habits with history tracking
├── DashboardHorizons.tsx    # Horizons relationship viewer
├── DashboardFilters.tsx     # Shared filtering components
├── DashboardStats.tsx       # Reusable stat card components
└── index.ts                 # Barrel exports
```

## Data Hooks

### New Hooks Created
- `useActionsData` - Loads all actions across projects with full metadata
- `useProjectsData` - Enhanced project loading with all metadata fields
- `useHabitsHistory` - Tracks habit completion history and statistics
- `useHorizonsRelationships` - Maps connections between GTD horizon levels

## Tab Specifications

### Overview Tab
**Purpose**: Provide a comprehensive snapshot of the entire GTD system

**Features**:
- Total counts for projects, actions, habits, and horizon items
- Completion rates and trend graphs
- Overdue items alert panel
- Quick stats for each GTD level (50k ft to runway)
- Recent activity timeline
- Weekly/monthly progress comparison

**Data Displayed**:
- Active vs completed project ratio
- Action distribution by status
- Habit streak information
- Upcoming deadlines summary

### Actions Tab
**Purpose**: Central hub for all next actions with powerful filtering

**Features**:
- Comprehensive list of all actions across all projects
- Advanced filtering system
- Multiple sort options
- Inline status updates
- Bulk operations support

**Filters**:
- Status (in-progress, waiting, completed, cancelled)
- Effort (small, medium, large, extra-large)
- Project association
- Due date ranges
- Focus date ranges
- Contexts/tags
- Has references (yes/no)

**Sort Options**:
- Due date (ascending/descending)
- Focus date
- Created date
- Project name
- Effort level
- Status

**Display Columns**:
- Action name
- Project
- Status (with quick toggle)
- Effort estimate
- Due date
- Focus date
- Contexts
- References count

### Projects Tab
**Purpose**: Complete project portfolio management

**Features**:
- All projects with detailed metadata
- Visual progress indicators
- Horizon linkage display
- Action count and completion percentage
- Expandable detail panels

**Filters**:
- Status (in-progress, waiting, completed)
- Due date ranges
- Has linked horizons
- Action count ranges
- Completion percentage ranges

**Sort Options**:
- Due date
- Created date
- Action count
- Completion percentage
- Name (alphabetical)

**Display Information**:
- Project name and description
- Status with visual indicator
- Progress bar (based on action completion)
- Total actions / Completed actions
- Due date with overdue highlighting
- Linked Areas of Focus
- Linked Goals
- Quick action buttons (add action, edit, archive)

### Habits Tab
**Purpose**: Advanced habit tracking with analytics

**Features**:
- Current habit status grid
- Completion history calendar
- Success/failure statistics
- Reset timing predictions
- Streak tracking
- Performance trends

**Display Components**:
- Habit cards with:
  - Name and frequency
  - Current status (checkbox)
  - Current streak
  - Success rate percentage
  - Last completed timestamp
  - Next reset time
- History view:
  - Calendar heat map
  - Completion graph over time
  - Best/current/average streaks
- Statistics panel:
  - Overall completion rate
  - Best performing habits
  - Habits needing attention
  - Weekly/monthly trends

**Habit Frequencies Supported**:
- daily
- every-other-day
- twice-weekly
- weekly
- weekdays
- biweekly
- monthly

### Horizons Tab
**Purpose**: Visualize and navigate GTD horizon relationships

**Features**:
- Hierarchical tree view of all horizons
- Relationship mapping
- Quick navigation
- Item counts at each level
- Search within horizons

**Display Structure**:
```
Purpose & Principles (50,000 ft)
├── [Files/Pages listed]
│
Vision (40,000 ft)
├── [Files/Pages listed]
│   └── Linked to: [Purpose items]
│
Goals (30,000 ft)
├── [Files/Pages listed]
│   └── Linked to: [Vision items]
│
Areas of Focus (20,000 ft)
├── [Files/Pages listed]
│   └── Linked to: [Goals]
│
Projects (Runway)
├── [Project folders]
    └── Linked to: [Areas of Focus]
```

**Interactive Features**:
- Click to expand/collapse levels
- Click items to open in editor
- Visual connection lines between related items
- Hover to see relationship details
- Filter by relationship existence

## State Management

### Filter State
```typescript
interface DashboardFilters {
  // Actions filters
  actionStatus?: string[];
  actionEffort?: string[];
  actionProjects?: string[];
  actionDueDateRange?: { start: Date; end: Date };
  actionFocusDateRange?: { start: Date; end: Date };
  actionContexts?: string[];
  
  // Projects filters
  projectStatus?: string[];
  projectDueDateRange?: { start: Date; end: Date };
  projectHasHorizons?: boolean;
  projectCompletionRange?: { min: number; max: number };
  
  // Habits filters
  habitFrequency?: string[];
  habitStatus?: string[];
  habitSuccessRateRange?: { min: number; max: number };
  
  // Global
  searchQuery?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
```

## Performance Optimizations

1. **Virtual Scrolling**: Implemented for lists with >50 items
2. **Memoization**: Heavy computations cached with React.memo and useMemo
3. **Lazy Loading**: Tab content loaded only when activated
4. **Debounced Filtering**: 300ms debounce on filter inputs
5. **Pagination**: Optional pagination for very large datasets
6. **Background Loading**: Initial data load happens in parallel

## Data Loading Strategy

### Parallel Loading
All data hooks fire simultaneously on dashboard mount:
```typescript
Promise.all([
  loadProjects(),
  loadAllActions(),
  loadHabits(),
  loadHorizons()
])
```

### Incremental Updates
- File watcher integration for real-time updates
- Optimistic UI updates for status changes
- Background refresh every 30 seconds for Google Calendar data

## User Experience Enhancements

1. **Loading States**: Skeleton loaders for each section
2. **Empty States**: Helpful messages and action buttons when no data
3. **Error Handling**: Graceful degradation with retry options
4. **Transitions**: Smooth animations between tabs and state changes
5. **Responsive Design**: Optimized layouts for desktop, tablet, and mobile
6. **Export Options**: CSV/JSON export for filtered data
7. **Keyboard Shortcuts**: Quick navigation and actions

## Migration Notes

### Breaking Changes
- Dashboard props interface changed
- Tab navigation state management updated
- Some event handlers renamed for consistency

### Backwards Compatibility
- Old dashboard component kept as `GTDDashboardLegacy.tsx` during transition
- Settings migration for any stored dashboard preferences
- Gradual rollout with feature flag if needed

## Quality Assurance

To maintain documentation quality and consistency, a new CI validation step will be implemented.

1.  **Markdown Linting**:
    *   A new CI job will be added to the pipeline to lint all Markdown files.
    *   The job will execute `npx -y markdownlint-cli2 "docs/**/*.md" "AGENTS.md" "CLAUDE.md"`.
    *   The pipeline will fail if any linting violations are found, ensuring all committed documentation adheres to the defined standards.
    *   An optional, separate job or a manual flag (`--fix`) can be used to automatically correct linting errors and commit the fixes.
    *   Linting rules will be configured in a new `.markdownlint.json` file at the repository root to tune settings for our specific documentation style.

## Testing Checklist

- [ ] All tabs load without errors
- [ ] Filters work correctly on each tab
- [ ] Sort functions properly
- [ ] Data updates reflect in real-time
- [ ] Performance acceptable with 100+ projects
- [ ] Mobile responsive layout works
- [ ] Keyboard navigation functional
- [ ] Export features work correctly
- [ ] Error states handle gracefully
- [ ] Loading states display properly
- [ ] Table of contents updated (e.g., via `doctoc`)

## Future Enhancements

1. **Dashboard Customization**: User-configurable widgets
2. **Advanced Analytics**: Productivity metrics and insights
3. **Saved Filter Sets**: Quick access to common filter combinations
4. **Collaboration Features**: Shared project views
5. **AI Insights**: Suggested focus areas based on patterns
6. **Time Tracking Integration**: Actual vs estimated effort
7. **Batch Operations**: Multi-select actions for bulk updates
8. **Dashboard Templates**: Pre-configured layouts for different workflows