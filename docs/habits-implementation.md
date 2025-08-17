# Habits Implementation

## Overview
The GTD Space habit tracking system automatically manages recurring habits with configurable frequencies. It tracks completion status, records history, and handles automatic resets.

## Features

### Frequency Options
- **Daily** - Resets every day
- **Weekdays (Mon-Fri)** - Resets Monday through Friday only, skips weekends
- **Every Other Day** - Resets every 2 days
- **Twice a Week** - Resets approximately every 3 days
- **Weekly** - Resets every 7 days
- **Biweekly** - Resets every 14 days
- **Monthly** - Resets every 30 days
- **5 Minutes (Testing)** - For testing the system

### Automatic Tracking
1. **Manual Updates**: When you change status (todo ↔ complete), it's recorded immediately
2. **Auto-Reset**: At the frequency interval, the system:
   - Records the current status (complete or missed)
   - Resets the status to "todo"
3. **Backfilling**: When the app starts, it backfills any missed periods while offline

### History Format
Each habit maintains a complete history table:
```
| Date | Time | Status | Action | Notes |
|------|------|--------|--------|-------|
| 2025-01-16 | 14:00 | Complete | Manual | Changed from To Do |
| 2025-01-16 | 14:05 | Complete | Auto-Reset | Completed |
| 2025-01-16 | 14:10 | To Do | Auto-Reset | Missed habit |
| 2025-01-16 | 14:15 | To Do | Backfill | Missed (app offline) |
```

## Implementation Details

### Backend (Rust)
- **Commands**: `create_gtd_habit`, `update_habit_status`, `check_and_reset_habits`
- **Reset Logic**: Checks last action time from history, calculates if frequency interval passed
- **History Management**: Appends entries to markdown table in habit file

### Frontend (React)
- **Checkbox UI**: Interactive checkbox for status (replaces dropdown for cleaner UX)
- **Real-time Updates**: History log updates immediately without closing/reopening files
- **Visual Feedback**: Subtle green highlight animation when habit updates
- **Toast Notifications**: Shows "Habit Recorded" with habit name when status changes
- **Scheduler**: Runs every minute to check habits
- **UI Updates**: Automatically refreshes sidebar and open tabs when habits reset
- **Keyboard Shortcuts**: 
  - Cmd/Ctrl+Alt+F for habit frequency
  - Cmd/Ctrl+Alt+H for habit status (legacy)

### File Format
```markdown
# Habit Name

## Status
[!checkbox:habit-status:false]

## Frequency
[!singleselect:habit-frequency:daily]

## Created
2025-01-16

## History
| Date | Time | Status | Action | Notes |
|------|------|--------|--------|-------|
| ... history entries ... |
```

## Usage
1. Create a habit with desired frequency
2. Mark as complete when done
3. System automatically tracks and resets based on frequency
4. Review history to see patterns and consistency