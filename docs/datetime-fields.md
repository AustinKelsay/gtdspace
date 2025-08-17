# DateTime Fields Documentation

## Overview

GTD Space now includes beautiful, interactive date and time selection components that seamlessly integrate with the BlockNote editor. These components provide an intuitive way to manage dates across projects, actions, and habits.

## Features

### Visual Date Picker

- **Calendar Component**: Uses shadcn/ui's calendar component with a clean, modern design
- **Time Selection**: Optional time picker for fields that need specific times
- **Theme Support**: Automatically adapts to light/dark theme
- **Color Coding**: Different field types have distinct colors:
  - Due Dates: Orange/Red (red when overdue)
  - Focus Dates: Blue
  - Completed Dates: Green
  - Created/Modified: Gray

### Field Types

The system supports multiple datetime field types:

- `created_date` - When an item was created
- `modified_date` - Last modification time
- `due_date` - Deadline for completion (date only)
- `focus_date` - When to work on the item (includes time)
- `completed_date` - When the item was completed

### Markdown Format

DateTime fields are stored in markdown using a special syntax:

```markdown
[!datetime:due_date:2025-01-17]
[!datetime:focus_date_time:2025-01-17T14:30:00]
[!datetime:created_date_time:2025-01-17T10:00:00Z]
```

The `_time` suffix indicates fields that include time components.

## Usage

### Keyboard Shortcuts

- **Cmd/Ctrl+Alt+D** - Insert Due Date field
- **Cmd/Ctrl+Alt+T** - Insert Focus Date with Time
- **Cmd/Ctrl+Alt+C** - Insert Created Date (auto-fills current time)

### In the Editor

1. Click on any date field to open the calendar picker
2. Select a date from the calendar
3. For time-enabled fields, adjust the time using the time input
4. Click "Clear date" to remove an optional date

### Programmatic Usage

```typescript
// Import helpers for creating and inserting datetime blocks
import {
  createDateTimeBlock,
  type DateTimeFieldType,
} from "@/utils/datetime-block-helpers";
import { useDateTimeInsertion } from "@/hooks/useDateTimeInsertion";

// Valid DateTimeFieldType values you can use:
// 'due_date' | 'focus_date' | 'created_date' | 'modified_date'

// Create a datetime field block
const block = createDateTimeBlock("due_date", "Due Date", "2025-01-20", false);

// Insert using the hook (editor is your BlockNote editor instance)
const { insertDateTime } = useDateTimeInsertion(editor);
insertDateTime("focus_date", true, "2025-01-20T14:00:00");
```

## GTD Integration

### Actions

Actions now use datetime fields for:

- **Focus Date**: When you plan to work on the action (includes time)
- **Due Date**: The deadline for the action (date only)
- **Created Date**: Automatically set when the action is created

### Projects

Projects can have:

- **Due Date**: Project deadline
- **Created Date**: When the project was started
- **Completed Date**: When the project was finished

### Habits

Habits track:

- **Last Completed**: When the habit was last marked complete
- **Next Due**: Calculated based on frequency

## Backend Updates

The Rust backend has been updated to:

- Generate datetime fields in action templates
- Parse and validate ISO date strings
- Support both date-only and datetime formats

Example action template:

```markdown
# Action Name

## Status

[!singleselect:status:in-progress]

## Focus Date

[!datetime:focus_date_time:]

## Due Date

[!datetime:due_date:]

## Effort

[!singleselect:effort:medium]

## Notes

<!-- Add any additional notes or details about this action here -->

---

[!datetime:created_date_time:2025-01-17T10:00:00Z]
```

## Technical Details

### Dependencies

- `react-day-picker`: Calendar component base
- `date-fns`: Date manipulation and formatting
- `lucide-react`: Icons for the UI
- `@radix-ui/react-popover`: Popover container

### Component Structure

```
DateTimeSelectBlock
├── Popover (container)
├── Button (trigger with icon and formatted date)
├── Calendar (date selection)
├── Time Input (optional)
└── Clear Button (optional)
```

### Styling

The component uses CSS variables for theming:

- Inherits all theme colors from the global theme system
- Special field-type-specific background colors
- Smooth transitions and hover states

## Future Enhancements

Potential improvements for the datetime system:

- Recurring dates for habits and repeated tasks
- Date range selection for project timelines
- Natural language date parsing ("next Monday", "in 2 weeks")
- Calendar view of all dated items
- Reminder notifications for upcoming dates
- Time zone support for distributed teams
