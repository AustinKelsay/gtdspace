/**
 * @fileoverview Custom BlockNote block for date and time selection
 * @author Development Team
 * @created 2025-01-17
 */

import React, { useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarIcon, Clock, X } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

export type DateTimeFieldType = 
  | 'created_date'
  | 'modified_date'
  | 'due_date'
  | 'focus_date'
  | 'completed_date'
  | 'custom';

// Define prop schema with proper types
const dateTimePropSchema = {
  type: {
    default: 'due_date' as DateTimeFieldType,
  },
  value: {
    default: '',  // ISO 8601 string or empty
  },
  label: {
    default: '',
  },
  includeTime: {
    default: false,  // Whether to show time picker
  },
  optional: {
    default: true,  // Whether the field is optional
  },
} satisfies PropSchema;

export const DateTimeSelectBlock = createReactBlockSpec(
  {
    type: 'datetime' as const,
    propSchema: dateTimePropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any;
      const { type, value, label, includeTime, optional } = block.props;
      
      const [open, setOpen] = useState(false);
      const [timeValue, setTimeValue] = useState('12:00');
      
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
        if (isValidDate && includeTime) {
          const hours = dateValue.getHours().toString().padStart(2, '0');
          const minutes = dateValue.getMinutes().toString().padStart(2, '0');
          setTimeValue(`${hours}:${minutes}`);
        }
      }, [value, includeTime, dateValue, isValidDate]);
      
      const handleDateChange = (newDate: Date | undefined) => {
        if (!newDate) {
          handleClear();
          return;
        }
        
        let isoString: string;
        if (includeTime) {
          // Parse time from input
          const [hours, minutes] = timeValue.split(':').map(Number);
          newDate.setHours(hours || 0, minutes || 0, 0, 0);
          isoString = newDate.toISOString();
        } else {
          // Date only - use YYYY-MM-DD format
          isoString = format(newDate, 'yyyy-MM-dd');
        }
        
        updateBlockValue(isoString);
        setOpen(false);
      };
      
      const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = e.target.value;
        setTimeValue(newTime);
        
        // If we have a date selected, update it with the new time
        if (isValidDate) {
          const [hours, minutes] = newTime.split(':').map(Number);
          const newDate = new Date(dateValue);
          newDate.setHours(hours || 0, minutes || 0, 0, 0);
          updateBlockValue(newDate.toISOString());
        }
      };
      
      const handleClear = () => {
        updateBlockValue('');
        setOpen(false);
      };
      
      const updateBlockValue = (newValue: string) => {
        // Find and update the block in the current document
        const findAndUpdateBlock = () => {
          const blocks = props.editor.document;
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const findBlock = (blocks: any[], targetId: string): any => {
            for (const block of blocks) {
              if (block.id === targetId) {
                return block;
              }
              if (block.children && block.children.length > 0) {
                const found = findBlock(block.children, targetId);
                if (found) return found;
              }
            }
            return null;
          };
          
          let targetBlock = findBlock(blocks, block.id);
          
          if (!targetBlock) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const findByContent = (blocks: any[]): any => {
              for (const b of blocks) {
                if (b.type === 'datetime' && 
                    (b.props as { type?: string; label?: string })?.type === block.props.type &&
                    (b.props as { type?: string; label?: string })?.label === block.props.label) {
                  return b;
                }
                if (b.children && b.children.length > 0) {
                  const found = findByContent(b.children);
                  if (found) return found;
                }
              }
              return null;
            };
            targetBlock = findByContent(blocks);
          }
          
          if (targetBlock) {
            try {
              props.editor.updateBlock(targetBlock, {
                props: {
                  ...targetBlock.props,
                  value: newValue,
                },
              });
              return true;
            } catch (e) {
              console.error('Failed to update date block:', e);
              return false;
            }
          }
          return false;
        };
        
        if (!findAndUpdateBlock()) {
          console.warn('Could not find date block to update');
        }
      };
      
      // Format display text based on type and value
      const getDisplayText = () => {
        if (!isValidDate) {
          return '';
        }
        
        if (includeTime) {
          return format(dateValue, 'MMM dd, yyyy HH:mm');
        } else {
          return format(dateValue, 'MMM dd, yyyy');
        }
      };
      
      const getPlaceholderText = () => {
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
      };
      
      const getFieldLabel = () => {
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
      };
      
      // Determine field styles based on type
      const getFieldStyles = () => {
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
      };

      return (
        <div className="inline-block align-middle mx-1">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  getFieldStyles(),
                  'font-normal hover:opacity-80 transition-opacity cursor-pointer focus:outline-none focus:ring-0',
                  !isValidDate && 'opacity-60'
                )}
              >
                <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium mr-1">{getFieldLabel()}:</span>
                <span className={!isValidDate ? 'text-muted-foreground italic' : ''}>
                  {isValidDate ? getDisplayText() : getPlaceholderText()}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <div className="flex flex-col items-center px-8">
                <Calendar
                  mode="single"
                  selected={isValidDate ? dateValue : undefined}
                  onSelect={handleDateChange}
                  initialFocus
                  className="rounded-md border-0"
                  defaultMonth={isValidDate ? dateValue : undefined}
                />
                  
                
                {includeTime && (
                  <div className="px-8 pb-3 pt-1 border-t border-border w-full">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        value={timeValue}
                        onChange={handleTimeChange}
                        className="flex-1"
                      />
                    </div>
                  </div>
                )}
                
                {optional && isValidDate && (
                  <div className="px-8 pb-3 pt-2 border-t border-border w-full">
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any;
      const { type, value, includeTime } = block.props;
      // Return the markdown format that can be parsed back
      const fieldType = includeTime ? `${type}_time` : type;
      const markdownFormat = `[!datetime:${fieldType}:${value || ''}]`;
      // Wrap in a paragraph to ensure it's preserved in the markdown
      return <p>{markdownFormat}</p>;
    },
  }
);