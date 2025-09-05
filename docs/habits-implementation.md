# Habits Implementation

## Overview

The GTD Space habit tracking system automatically manages recurring habits with configurable frequencies. It tracks completion status, records history, handles automatic resets, and supports bidirectional relationships with Projects and all GTD Horizon levels.

## Core Features

### Frequency Options

All frequencies calculate their reset boundaries using system local time:

- **Daily** - Resets at midnight (12:00 AM) local time
- **Weekdays (Mon-Fri)** - Resets at midnight Monday through Friday only, skips weekends
  - A Friday habit completed at 11:59 PM resets Monday 12:00 AM
- **Every Other Day** - Resets every 48 hours from last reset (midnight-aligned)
- **Twice a Week** - Resets approximately every 3-4 days
- **Weekly** - Resets every 7 days at the same local time
- **Biweekly** - Resets every 14 days at the same local time
- **Monthly** - Resets on the same day each calendar month at the same local time
  - **End-of-month handling**: If created on Jan 31, resets to Feb 28/29, then Mar 31
- **5 Minutes (Testing)** - Resets every 5 minutes for testing the system

### Bidirectional Relationships

Habits can reference and be referenced by any GTD Horizon level:

- **Projects** - Link habits to specific project outcomes
- **Areas of Focus** - Connect habits to ongoing responsibilities
- **Goals** - Align habits with 1-2 year objectives
- **Vision** - Link habits to 3-5 year vision
- **Purpose & Principles** - Connect habits to life mission and values

When a habit references a Project or Horizon item:
1. The habit shows reference fields linking to those items
2. The referenced items display a "Related Habits" section showing all connected habits
3. Clicking on a related habit opens that habit file

### Timezones and Reset Times

**All habit resets use system local time**, not UTC or workspace-specific timezones:
- **Reset Time**: Frequency boundaries are calculated using your system's local timezone
- **"Midnight"**: Refers to 12:00 AM in your system's local time
- **DST Transitions**: Handled automatically by the system clock
  - Spring forward: A "day" may be 23 hours
  - Fall back: A "day" may be 25 hours
  - Monthly resets maintain the same wall-clock time

**Examples**:
- **Daily habit in New York**: Resets at 12:00 AM EST/EDT
- **Weekly habit during DST change**: Still resets exactly 7 days later at local midnight
- **Monthly habit**: Jan 15 3:00 PM → Feb 15 3:00 PM (same local time)

### Automatic Tracking

1. **Manual Updates**: When you check/uncheck the habit checkbox, it's recorded immediately with a history entry
2. **Status Persistence**: Habits maintain their checked state until the next frequency window begins
3. **Auto-Reset**: When entering a new frequency window, the system:
   - Creates a "New period" history entry with local timestamp
   - Resets the checkbox to unchecked (todo) state
   - Preserves the completion history from the previous period
4. **Backfilling**: When the app starts after being offline, it:
   - Calculates missed frequency windows based on local time
   - Creates "Backfill - Missed - app offline" entries for historical periods
   - Creates appropriate entries for the current period

### History Format

Each habit maintains a complete history as formatted list entries:

**Markdown Format:**

```markdown
- **2025-01-16** at **2:00 PM**: Complete (Manual - Changed from To Do)
- **2025-01-16** at **2:05 PM**: To Do (Auto-Reset - New period)
- **2025-01-16** at **2:10 PM**: Complete (Manual - Changed from To Do)
- **2025-01-16** at **2:15 PM**: To Do (Backfill - Missed - app offline)
```

**History Entry Types:**
- `Complete (Manual - Changed from To Do)` - User manually checked the habit
- `To Do (Manual - Changed from Complete)` - User manually unchecked the habit
- `To Do (Auto-Reset - New period)` - System reset when entering new frequency window
- `To Do (Backfill - Missed - app offline)` - Historical entry for periods while app was closed

**Display Format:**
The history entries are displayed with visual formatting using emojis:

- 📅 2025-01-16 • 🕐 2:00 PM • ✅ Complete • Manual - Changed from To Do
- 📅 2025-01-16 • 🕐 2:05 PM • ⏳ To Do • Auto-Reset - New period
- 📅 2025-01-16 • 🕐 2:10 PM • ✅ Complete • Manual - Changed from To Do
- 📅 2025-01-16 • 🕐 2:15 PM • ⏳ To Do • Backfill - Missed - app offline

## File Format

```markdown
# Habit Name

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:daily]

## Horizon References

[!projects-references:["/path/to/project"]]
[!areas-references:["/path/to/area.md"]]
[!goals-references:["/path/to/goal.md"]]
[!vision-references:["/path/to/vision.md"]]
[!purpose-references:["/path/to/purpose.md"]]

## Created
[!datetime:created_date_time:2025-01-17T10:00:00Z]

## History

*Track your habit completions below:*

- **2025-01-17** at **10:00 AM**: Complete (Manual - Changed from To Do)
- **2025-01-18** at **12:00 AM**: To Do (Auto-Reset - New period)

### Monthly Reset Example:
- **2025-01-31** at **10:00 AM**: Complete (Manual - Changed from To Do)
- **2025-02-28** at **12:00 AM**: To Do (Auto-Reset - Monthly boundary, adjusted for February)
- **2025-03-31** at **12:00 AM**: To Do (Auto-Reset - Back to day 31)
```

### Reference Field Formats

References can be stored in three formats:
1. **JSON Array** (preferred): `["/path/to/file.md","/path/to/other.md"]`
2. **CSV** (legacy): `/path/to/file.md,/path/to/other.md`
3. **URL-Encoded** (for special characters): `%2Fpath%2Fto%2Ffile.md`

The system automatically handles all formats, URL decoding, and path normalization.

## UI Components

### Habit Checkbox

- **Interactive checkbox** replaces dropdown for cleaner UX
- **Real-time updates** without file reload
- **Visual feedback** with subtle green highlight animation
- **Toast notifications** showing "Habit Recorded: [Habit Name]"

### Horizon References Fields

Each horizon type has its own reference field:
- Allows selecting multiple items from that horizon level
- Shows file browser for selection
- Supports both files (.md) and folders (for Projects)

### Related Habits Section

On Project and Horizon pages, a collapsible "Related Habits" section shows:
- Count of habits referencing this item
- List of habit names with their current status (✅ Complete or ⭕ To Do)
- Frequency badge for each habit
- Click to open any related habit

The component (`HabitsListBlock`) features:
- Collapsible/expandable interface
- Refresh button to reload habits
- Loading states and error handling
- Automatic updates when habits change

## Implementation Details

### Backend (Rust)

**Core Commands:**
- `create_gtd_habit` - Creates new habit with initial structure
- `update_habit_status` - Records manual status changes
- `check_and_reset_habits` - Runs periodically to handle auto-resets
- `find_habits_referencing` - Finds habits that reference a specific file/folder

**Reset Logic:**
- Checks last action time from history entries
- Calculates if frequency interval has passed
- Handles special cases:
  - **Weekdays**: Skips weekends (Sat/Sun)
  - **Monthly**: Uses calendar month boundaries, not fixed 30-day intervals
    - Example: Jan 15 → Feb 15 → Mar 15 (same day each month)
    - End-of-month: Jan 31 → Feb 28/29 → Mar 31 (adjusts for shorter months)
- Creates appropriate history entries for the transition

**History Management:**
- Appends entries as markdown list items
- Format: `- **YYYY-MM-DD** at **H:MM AM/PM**: Status (Action - Details)`
- Preserves all historical data for pattern analysis

**Reference Processing:**
- Supports all three reference field formats (see Reference Field Formats section above)
- Handles URL decoding for special characters
- Normalizes paths for cross-platform compatibility (converts backslashes to forward slashes)

### Frontend (React/TypeScript)

**Components:**
- `CheckboxBlock` - Renders interactive habit status checkbox
- `HabitsListBlock` - Shows habits referencing current file
- `HorizonReferencesBlock` - Manages references to each horizon level
- `useHabitTracking` - Hook for habit status updates and scheduling

**Scheduler:**
- Runs every minute to check for habits needing reset
- Only processes habits in current space
- Updates UI automatically when resets occur
- Handles backfilling for offline periods

**Event System:**
- `habit-status-updated` - Fired when habit status changes
- `habits-reset` - Fired when habits are auto-reset
- Events trigger UI updates across all components

**Keyboard Shortcuts:**
- Cmd/Ctrl+Alt+F - Insert habit frequency field
- Cmd/Ctrl+Shift+H - Toggle habit status (when checkbox selected)

### Data Processing

**Markdown Preprocessing:**
- Converts `[!checkbox:habit-status:*]` markers to CheckboxBlock
- Converts `[!*-references:*]` markers to reference blocks
- Handles `[!habits-list]` marker for related habits display
- Prevents duplicate block rendering

**Reference Extraction:**
- Parses all five horizon reference types
- Handles nested brackets in JSON arrays
- Supports URL decoding for encoded paths
- Validates file existence

## Usage Workflow

### Creating a Habit

1. Create new habit in Habits folder
2. Set desired frequency
3. Add horizon references to connect with your GTD system
4. Habit automatically appears in "Related Habits" on referenced items

### Daily Use

1. Check habits when completed - checkbox turns green briefly
2. Status persists until next frequency window
3. Review history to track patterns and consistency
4. Use "Related Habits" sections to see habits in context

### Managing Relationships

1. Open habit file to add/remove references
2. Use reference field UI to browse and select items
3. References update immediately in both directions
4. Navigate between related items easily

## Technical Notes

### Context Field Handling

- Frontend sends contexts with `@` prefix (e.g., `@computer`, `@phone`)
- Backend normalizes by removing `@` and converting to lowercase
- Ensures consistent storage regardless of input format

### URL Encoding

- Project folders may be double-encoded in references
- System handles multiple decode attempts automatically
- Preserves special characters in file paths

### Performance Optimizations

- Habits check runs with 500ms debounce
- Reference lookups are cached for efficiency
- History rendering optimized for large logs
- Parallel file reads for calendar data aggregation

## Troubleshooting

### Habits Not Resetting

- Check that frequency is set correctly
- Verify habit scheduler is running (every minute)
- Check console for reset operation logs

### References Not Showing

- Ensure file paths are absolute, not relative
- Check that referenced files exist
- Verify proper JSON array format in references

### History Not Recording

- Ensure file has write permissions
- Check that history section exists in file
- Verify proper markdown list format

### Related Habits Not Appearing

- Confirm habit has proper reference fields
- Check that target file is in a GTD horizon folder
- Try refresh button on Related Habits section

## Future Enhancements

Potential improvements being considered:
- Habit streaks and statistics
- Habit templates for common patterns
- Bulk habit operations
- Advanced filtering in Related Habits
- Habit completion notifications
- Integration with calendar for time-based habits