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
import { format, parseISO, isValid } from 'date-fns';

// Component for the DateTimeSelect block
interface DateTimeSelectComponentProps {
  block: {
    id: string;
    props: {
      type: string;
      value: string;
      label?: string;
      includeTime?: boolean;
      optional?: boolean;
    };
  };
  editor: {
    updateBlock: (id: string, block: unknown) => void;
  };
}

const DateTimeSelectComponent: React.FC<DateTimeSelectComponentProps> = (props) => {
  const { type, value, label, includeTime, optional } = props.block.props;
  
  const [open, setOpen] = React.useState(false);
  const [timeValue, setTimeValue] = React.useState('12:00');
  const [localTimeEnabled, setLocalTimeEnabled] = React.useState(() => {
    // Initialize based on whether the value has time
    return includeTime || (value && value.includes('T'));
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
    } catch (e) {
      // Silently handle parse errors
    }
  }
  const isValidDate = dateValue !== null && isValid(dateValue);
  
  // Extract time if value includes it
  React.useEffect(() => {
    if (isValidDate && value && value.includes('T')) {
      const date = new Date(value);
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      setTimeValue(`${hours}:${minutes}`);
    }
  }, [value, isValidDate]);
  
  const updateBlockValue = (newValue: string) => {
    try {
      props.editor.updateBlock(props.block.id, {
        type: 'datetime',
        props: {
          ...props.block.props,
          value: newValue,
        },
      });
    } catch (error) {
      console.error('Error updating datetime block:', error);
    }
  };
  
  const handleDateChange = (newDate: Date | undefined) => {
    if (!newDate) return;
    
    let isoString: string;
    if (localTimeEnabled) {
      // Parse time value and create UTC date with time
      const [hours, minutes] = timeValue.split(':').map(Number);
      const utcDate = new Date(Date.UTC(
        newDate.getFullYear(),
        newDate.getMonth(),
        newDate.getDate(),
        hours || 0,
        minutes || 0,
        0,
        0
      ));
      isoString = utcDate.toISOString();
    } else {
      // Create UTC date at midnight
      const utcDate = new Date(Date.UTC(
        newDate.getFullYear(),
        newDate.getMonth(),
        newDate.getDate(),
        0, 0, 0, 0
      ));
      isoString = utcDate.toISOString().slice(0, 10);
    }
    
    updateBlockValue(isoString);
  };
  
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeValue(newTime);
    
    if (isValidDate && localTimeEnabled) {
      const [hours, minutes] = newTime.split(':').map(Number);
      const utcDate = new Date(Date.UTC(
        dateValue.getFullYear(),
        dateValue.getMonth(),
        dateValue.getDate(),
        hours || 0,
        minutes || 0,
        0,
        0
      ));
      updateBlockValue(utcDate.toISOString());
    }
  };
  
  const handleClear = () => {
    updateBlockValue('');
    setOpen(false);
  };
  
  // Format display text based on type and value
  const displayText = React.useMemo(() => {
    if (!isValidDate) {
      return '';
    }
    
    if (value.includes('T')) {
      return format(dateValue, 'MMM dd, yyyy h:mm a');
    } else {
      return format(dateValue, 'MMM dd, yyyy');
    }
  }, [isValidDate, value, dateValue]);
  
  const handleTimeToggle = (checked: boolean) => {
    setLocalTimeEnabled(checked);
  };
  
  const placeholderText = React.useMemo(() => {
    switch (type) {
      case 'created_date':
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
      case 'created_date':
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
          const currentHasTime = value && value.includes('T');
          setLocalTimeEnabled(currentHasTime || includeTime);
        } else if (!newOpen && isValidDate) {
          // When closing, update the value if time toggle was changed
          const currentHasTime = value && value.includes('T');
          if (localTimeEnabled !== currentHasTime) {
            let isoString: string;
            if (localTimeEnabled) {
              // Add time to existing date using UTC
              const [hours, minutes] = timeValue.split(':').map(Number);
              const utcDate = new Date(Date.UTC(
                dateValue.getFullYear(),
                dateValue.getMonth(),
                dateValue.getDate(),
                hours || 0,
                minutes || 0,
                0,
                0
              ));
              isoString = utcDate.toISOString();
            } else {
              // Remove time from existing date - use UTC date at midnight
              const utcDate = new Date(Date.UTC(
                dateValue.getFullYear(),
                dateValue.getMonth(),
                dateValue.getDate(),
                0, 0, 0, 0
              ));
              isoString = utcDate.toISOString().slice(0, 10);
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
            
            {/* Time toggle */}
            <div className="p-3 border-t">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="include-time"
                  checked={localTimeEnabled}
                  onChange={(e) => handleTimeToggle(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="include-time" className="text-sm font-medium">
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
};

// Define the datetime block spec
export const DateTimeSelectBlock = createReactBlockSpec(
  {
    type: 'datetime',
    propSchema: {
      type: {
        default: 'due_date',
        values: ['created_date', 'modified_date', 'due_date', 'focus_date', 'completed_date'],
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
            includeTime: data.includeTime || false,
            optional: data.optional !== undefined ? data.optional : true,
          };
        } catch (e) {
          console.error('Error parsing datetime data:', e);
          return;
        }
      }
    },
    toExternalHTML: (props) => {
      const block = props.block as {props: {type: string; value: string; includeTime?: boolean}};
      const { type, value, includeTime } = block.props;
      // Return the markdown format that can be parsed back
      const fieldType = includeTime ? `${type}_time` : type;
      const markdownFormat = `[!datetime:${fieldType}:${value || ''}]`;
      // Return raw markdown string instead of JSX
      return markdownFormat;
    },
  }
);