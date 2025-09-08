/**
 * @fileoverview Custom BlockNote block for date and time selection
 * @author Development Team
 * @created 2025-01-17
 */

import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { format, parseISO, isValid, parse } from 'date-fns';

// Component for the DateTimeSelect block
interface DateTimeSelectComponentProps {
  block: {
    id: string;
    props: {
      type: string;
      value: string;
      label?: string;
      optional?: boolean;
    };
  };
  editor: {
    updateBlock: (block: unknown, update: { props: Record<string, unknown> }) => void;
  };
}

const DateTimeSelectComponent = React.memo<DateTimeSelectComponentProps>(function DateTimeSelectComponent(props) {
  const { type, value, label, optional } = props.block.props;

  // Determine if field is date-only (no time component allowed)
  const isDateOnlyField = React.useMemo(() => {
    // Date-only fields
    return type === 'due_date' || type === 'modified_date' || type === 'completed_date';
  }, [type]);

  const [open, setOpen] = React.useState(false);
  const [timeValue, setTimeValue] = React.useState('12:00');
  const [localTimeEnabled, setLocalTimeEnabled] = React.useState(() => {
    // Initialize based solely on whether the current value has time
    // Date-only fields never have time enabled
    return !isDateOnlyField && Boolean(value && value.includes('T'));
  });

  // Parse the ISO date value - handle empty strings gracefully
  let dateValue: Date | null = null;
  if (value && value.trim() !== '') {
    try {
      // Try parsing as ISO date
      const parsed = parseISO(value);
      if (isValid(parsed)) {
        dateValue = parsed;
      }
    } catch (_e) {
      // Silently handle parse errors
    }
  }
  const isValidDate = dateValue !== null && isValid(dateValue);

  // Sync localTimeEnabled with value changes and extract time if present
  React.useEffect(() => {
    // Date-only fields never have time enabled
    if (isDateOnlyField) {
      setLocalTimeEnabled(false);
      return;
    }

    // Update localTimeEnabled based on whether value contains time
    const hasTime = Boolean(value && value.includes('T'));
    setLocalTimeEnabled(hasTime);

    // Extract time if value includes it
    if (isValidDate && hasTime) {
      const date = new Date(value);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      setTimeValue(`${hours}:${minutes}`);
    }
  }, [value, isValidDate, isDateOnlyField]);

  const updateBlockValue = React.useCallback((newValue: string) => {
    try {
      props.editor.updateBlock(props.block, {
        props: {
          ...props.block.props,
          value: newValue,
        },
      });
    } catch (error) {
      console.error('Error updating datetime block:', error);
    }
  }, [props.editor, props.block]);

  const handleDateChange = React.useCallback((newDate: Date | undefined) => {
    if (!newDate) return;

    let isoString: string;
    // For date-only fields, always emit date string without time
    if (isDateOnlyField || !localTimeEnabled) {
      // Create local date string without time component
      const year = newDate.getFullYear();
      const month = (newDate.getMonth() + 1).toString().padStart(2, '0');
      const day = newDate.getDate().toString().padStart(2, '0');
      isoString = `${year}-${month}-${day}`;
    } else {
      // Parse time value and create local date with time
      const parts = (timeValue || '').split(':');
      let hours = Number(parts[0]);
      let minutes = Number(parts[1]);
      hours = isNaN(hours) ? 0 : hours;
      minutes = isNaN(minutes) ? 0 : minutes;
      const localDate = new Date(
        newDate.getFullYear(),
        newDate.getMonth(),
        newDate.getDate(),
        hours,
        minutes,
        0,
        0
      );
      isoString = localDate.toISOString();
    }

    updateBlockValue(isoString);
  }, [isDateOnlyField, localTimeEnabled, timeValue, updateBlockValue]);

  const handleTimeChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Skip time updates for date-only fields
    if (isDateOnlyField) return;

    const newTime = e.target.value;

    // Validate time format
    if (!newTime) {
      setTimeValue('');
      return;
    }

    // Check time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(newTime)) {
      console.warn('Invalid time format:', newTime);
      return; // Don't update if invalid format
    }

    setTimeValue(newTime);

    if (isValidDate && localTimeEnabled) {
      const [hours, minutes] = newTime.split(':').map(Number);

      // Additional validation for parsed values
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        console.warn('Invalid time values:', { hours, minutes });
        return;
      }

      // If the raw value is date-only, parse it properly to avoid timezone shifts
      let year: number, month: number, day: number;
      if (!value.includes('T')) {
        // Parse the date-only string to get correct local values
        const parts = value.split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) {
          console.error('Invalid date format:', value);
          return;
        }
        year = parts[0];
        month = parts[1] - 1; // Month is 0-indexed for Date constructor
        day = parts[2];
      } else {
        // Use the existing dateValue getters for datetime values
        year = dateValue.getFullYear();
        month = dateValue.getMonth();
        day = dateValue.getDate();
      }

      const localDate = new Date(
        year,
        month,
        day,
        hours || 0,
        minutes || 0,
        0,
        0
      );
      updateBlockValue(localDate.toISOString());
    }
  }, [isDateOnlyField, localTimeEnabled, isValidDate, value, dateValue, updateBlockValue]);

  const handleClear = React.useCallback(() => {
    updateBlockValue('');
    setOpen(false);
  }, [updateBlockValue]);

  // Format display text based on type and value
  const displayText = React.useMemo(() => {
    if (!isValidDate) {
      return '';
    }

    if (!isDateOnlyField && value.includes('T')) {
      return format(dateValue, 'MMM dd, yyyy h:mm a');
    } else {
      // Parse as local date to avoid TZ shift
      const localOnly = parse(value, 'yyyy-MM-dd', new Date());
      return format(localOnly, 'MMM dd, yyyy');
    }
  }, [isValidDate, value, dateValue, isDateOnlyField]);

  const handleTimeToggle = React.useCallback((checked: boolean) => {
    // Date-only fields cannot have time enabled
    if (isDateOnlyField) return;
    setLocalTimeEnabled(checked);
  }, [isDateOnlyField]);

  const placeholderText = React.useMemo(() => {
    switch (type) {
      case 'created_date_time':
        return 'No date set';
      case 'modified_date':
        return 'No date set';
      case 'due_date':
        return 'No due date';
      case 'focus_date':
        return 'No focus date';
      case 'completed_date':
        return 'Not completed';
      default:
        return 'No date';
    }
  }, [type]);

  const fieldLabel = React.useMemo(() => {
    if (label) return label;

    switch (type) {
      case 'created_date_time':
        return 'Created';
      case 'modified_date':
        return 'Modified';
      case 'due_date':
        return 'Due Date';
      case 'focus_date':
        return 'Focus Date';
      case 'completed_date':
        return 'Completed';
      default:
        return 'Date';
    }
  }, [type, label]);

  // Determine field styles based on type
  const fieldStyles = React.useMemo(() => {
    let baseClasses = 'inline-flex items-center gap-2 px-2 py-1 rounded-md text-sm border-0 outline-none ring-0 ';

    switch (type) {
      case 'due_date':
        if (isValidDate && dateValue < new Date()) {
          baseClasses += 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400';
        } else {
          baseClasses += 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400';
        }
        break;
      case 'focus_date':
        baseClasses += 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400';
        break;
      case 'completed_date':
        baseClasses += 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400';
        break;
      default:
        baseClasses += 'bg-muted/50 dark:bg-muted/20 text-foreground';
    }

    return baseClasses;
  }, [type, isValidDate, dateValue]);

  return (
    <div className="inline-block align-middle mx-1">
      <Popover open={open} onOpenChange={(newOpen) => {
        if (newOpen) {
          // When opening, sync local state with current value
          // Date-only fields never have time
          const currentHasTime = !!(!isDateOnlyField && value && value.includes('T'));
          setLocalTimeEnabled(currentHasTime);
        } else if (!newOpen && isValidDate) {
          // When closing, update the value if time toggle was changed
          const currentHasTime = !!(value && value.includes('T'));
          if (localTimeEnabled !== currentHasTime && !isDateOnlyField) {
            let isoString: string;
            if (localTimeEnabled) {
              // Add time to existing date using local time
              const parts = (timeValue || '').split(':');
              let hours = Number(parts[0]);
              let minutes = Number(parts[1]);
              hours = isNaN(hours) ? 0 : hours;
              minutes = isNaN(minutes) ? 0 : minutes;
              const localDate = new Date(dateValue);
              localDate.setHours(hours, minutes, 0, 0);
              isoString = localDate.toISOString();
            } else {
              // Remove time from existing date - construct date string from local parts
              const year = dateValue.getFullYear();
              const month = (dateValue.getMonth() + 1).toString().padStart(2, '0');
              const day = dateValue.getDate().toString().padStart(2, '0');
              isoString = `${year}-${month}-${day}`;
            }
            updateBlockValue(isoString);
          }
        }
        setOpen(newOpen);
      }}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              fieldStyles,
              'font-normal hover:opacity-80 transition-opacity cursor-pointer focus:outline-none focus:ring-0',
              !isValidDate && 'opacity-60'
            )}
          >
            <CalendarIcon className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium mr-1">{fieldLabel}:</span>
            <span className={!isValidDate ? 'text-muted-foreground italic' : ''}>
              {isValidDate ? displayText : placeholderText}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[320px] p-0"
          align="start"
          sideOffset={5}
          onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex flex-col">
            <Calendar
              mode="single"
              selected={isValidDate ? dateValue : undefined}
              onSelect={handleDateChange}
              className="rounded-md border-0 w-full"
              defaultMonth={isValidDate ? dateValue : undefined}
            />

            {/* Time toggle - hide for date-only fields */}
            {!isDateOnlyField && (
              <div className="p-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id={`${props.block.id}-include-time`}
                    checked={localTimeEnabled}
                    onChange={(e) => handleTimeToggle(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor={`${props.block.id}-include-time`} className="text-sm font-medium">
                    Include time
                  </label>
                </div>
                {localTimeEnabled && (
                  <input
                    type="time"
                    value={timeValue}
                    onChange={handleTimeChange}
                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                )}
              </div>
            )}

            {/* Clear button */}
            {optional && isValidDate && (
              <div className="p-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="w-full justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear date
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});

// Define the datetime block spec
export const DateTimeSelectBlock = createReactBlockSpec(
  {
    type: 'datetime',
    propSchema: {
      type: {
        default: 'due_date',
        values: ['due_date', 'focus_date', 'completed_date', 'created_date_time', 'modified_date', 'custom'],
      },
      value: {
        default: '',
      },
      label: {
        default: '',
      },
      includeTime: {
        default: false,
      },
      optional: {
        default: true,
      },
    } as const satisfies PropSchema,
    content: 'none',
  },
  {
    render: (props) => {
      return <DateTimeSelectComponent {...props} />;
    },
    parse: (element) => {
      // Check for datetime format
      if (element.tagName === 'DIV' && element.getAttribute('data-datetime')) {
        try {
          const data = JSON.parse(element.getAttribute('data-datetime') || '{}');
          return {
            type: data.type || 'due_date',
            value: data.value || '',
            label: data.label || '',
            optional: data.optional !== undefined ? data.optional : true,
          };
        } catch (e) {
          console.error('Error parsing datetime data:', e);
          return;
        }
      }
    },
    toExternalHTML: (props) => {
      const block = props.block as { props: { type: string; value: string } };
      const { type, value } = block.props;
      // Return the markdown format that can be parsed back
      // Determine if value contains time to decide on field type
      const hasTime = (value || '').includes('T');
      // Special case for focus_date - always keep as 'focus_date'
      let fieldType: string;
      if (type === 'focus_date') {
        fieldType = 'focus_date';
      } else if (type.endsWith('_time')) {
        fieldType = type;
      } else {
        fieldType = hasTime ? `${type}_time` : type;
      }
      const markdownFormat = `[!datetime:${fieldType}:${value || ''}]`;
      // Return raw markdown string instead of JSX
      return markdownFormat;
    },
  }
);