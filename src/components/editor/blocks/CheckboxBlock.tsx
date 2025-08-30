/**
 * @fileoverview Custom BlockNote block for checkbox fields (primarily for habit status)
 * @author Development Team
 * @created 2025-01-16
 */

import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// Define prop schema for checkbox block
const checkboxPropSchema = {
  type: {
    default: 'habit-status' as const, // Type of checkbox (for future extensibility)
  },
  checked: {
    default: false, // Boolean state of checkbox
  },
  label: {
    default: '', // Optional label text
  },
} satisfies PropSchema;

export const CheckboxBlock = createReactBlockSpec(
  {
    type: 'checkbox' as const,
    propSchema: checkboxPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any;
      const { type, checked, label } = block.props;
      
      // Local state for immediate UI feedback
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const [localChecked, setLocalChecked] = React.useState(checked);
      
      // Update local state when props change (from content reload)
      // eslint-disable-next-line react-hooks/rules-of-hooks
      React.useEffect(() => {
        setLocalChecked(checked);
      }, [checked]);
      
      const handleChange = async (newChecked: boolean) => {
        
        // Immediately update local state for visual feedback
        setLocalChecked(newChecked);
        
        // If this is a habit status checkbox, update the backend
        if (type === 'habit-status') {
          try {
            // Get the current file path from the editor or tab context
            const filePath = (window as Window & { currentFilePath?: string }).currentFilePath || '';
            
            if (filePath) {
              // Check if this is a habit file
              const isHabitFile = filePath.toLowerCase().includes('/habits/') || 
                                 filePath.toLowerCase().includes('\\habits\\');
              
              if (isHabitFile) {
                const { invoke } = await import('@tauri-apps/api/core');
                const { toast } = await import('@/hooks/use-toast');
                
                // Convert checkbox state to status values for backend
                const statusValue = newChecked ? 'completed' : 'todo';
                await invoke('update_habit_status', {
                  habitPath: filePath,
                  newStatus: statusValue,
                });
                
                // Show a toast notification
                const habitName = filePath.split('/').pop()?.replace('.md', '') || 'Habit';
                toast({
                  title: "Habit Recorded",
                  description: `${habitName} marked as ${newChecked ? 'completed' : 'to do'}`,
                });
                
                // Small delay to let the backend write the file
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Emit event to reload the file content for real-time update
                // This will cause the entire editor content to refresh with the latest state
                const reloadEvent = new CustomEvent('habit-content-changed', {
                  detail: { filePath }
                });
                window.dispatchEvent(reloadEvent);
                
                // Emit custom event to notify the app that habit status was updated
                const event = new CustomEvent('habit-status-updated', {
                  detail: { habitPath: filePath }
                });
                window.dispatchEvent(event);
              }
            }
          } catch (error) {
            console.error('[CheckboxBlock] Failed to update habit status in backend:', error);
          }
        }
      };
      
      // Determine display label based on type and state
      const getDisplayLabel = () => {
        if (label) return label;
        if (type === 'habit-status') {
          return localChecked ? 'Complete' : 'To Do';
        }
        return '';
      };
      
      return (
        <div className="inline-flex items-center gap-2 align-middle mx-1 my-1">
          <Checkbox
            checked={localChecked}
            onCheckedChange={handleChange}
            className={cn(
              "h-5 w-5",
              localChecked && type === 'habit-status' && "bg-green-600 border-green-600"
            )}
          />
          {getDisplayLabel() && (
            <label 
              className={cn(
                "text-sm select-none cursor-pointer",
                localChecked && "text-muted-foreground line-through"
              )}
              onClick={() => handleChange(!localChecked)}
            >
              {getDisplayLabel()}
            </label>
          )}
        </div>
      );
    },
    parse: (element) => {
      // Parse checkbox block from HTML
      if (element.tagName === 'DIV' && element.getAttribute('data-checkbox')) {
        try {
          const data = JSON.parse(element.getAttribute('data-checkbox') || '{}');
          return {
            type: data.type || 'habit-status',
            checked: data.checked || false,
            label: data.label || '',
          };
        } catch (e) {
          console.error('Error parsing checkbox data:', e);
          return;
        }
      }
    },
    toExternalHTML: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any;
      const { type, checked } = block.props;
      // Return the markdown format that can be parsed back
      // Use a special checkbox syntax for habits
      const markdownFormat = `[!checkbox:${type}:${checked}]`;
      // Wrap in a paragraph to ensure it's preserved in the markdown
      return <p>{markdownFormat}</p>;
    },
  }
);