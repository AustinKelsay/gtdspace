/**
 * @fileoverview Custom BlockNote block for single select fields
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SingleSelectBlockType } from '@/utils/singleselect-block-helpers';

// Define status options for GTD
const GTD_STATUS_OPTIONS = [
  { value: 'in-progress', label: 'In Progress', group: 'Status' },
  { value: 'waiting', label: 'Waiting', group: 'Status' },
  { value: 'complete', label: 'Complete', group: 'Status' },
];

// Define effort options for GTD
const GTD_EFFORT_OPTIONS = [
  { value: 'small', label: 'Small (<30 min)', group: 'Effort' },
  { value: 'medium', label: 'Medium (30-90 min)', group: 'Effort' },
  { value: 'large', label: 'Large (>90 min)', group: 'Effort' },
  { value: 'extra-large', label: 'Extra Large (>3 hours)', group: 'Effort' },
];

// Define project status options
const GTD_PROJECT_STATUS_OPTIONS = [
  { value: 'in-progress', label: 'In Progress', group: 'Project Status' },
  { value: 'waiting', label: 'Waiting', group: 'Project Status' },
  { value: 'completed', label: 'Completed', group: 'Project Status' },
];

// Define habit frequency options
const HABIT_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Every Day', group: 'Frequency' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)', group: 'Frequency' },
  { value: 'every-other-day', label: 'Every Other Day', group: 'Frequency' },
  { value: 'twice-weekly', label: 'Twice a Week', group: 'Frequency' },
  { value: 'weekly', label: 'Once Every Week', group: 'Frequency' },
  { value: 'biweekly', label: 'Once Every Other Week', group: 'Frequency' },
  { value: 'monthly', label: 'Once a Month', group: 'Frequency' },
  { value: '5-minute', label: 'Every 5 Minutes (Testing)', group: 'Frequency' },
];

// Define habit status options
const HABIT_STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do', group: 'Habit Status' },
  { value: 'complete', label: 'Complete', group: 'Habit Status' },
];

// Define prop schema with proper types
const singleSelectPropSchema = {
  type: {
    default: 'status' as SingleSelectBlockType,
  },
  value: {
    default: '',  // Single string value
  },
  label: {
    default: '',
  },
  placeholder: {
    default: '',
  },
  customOptionsJson: {
    default: '',  // Store options as JSON string
  },
} satisfies PropSchema;

export const SingleSelectBlock = createReactBlockSpec(
  {
    type: 'singleselect' as const,
    propSchema: singleSelectPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any; // Type assertion needed for BlockNote v0.35
      const { type, value, label, placeholder, customOptionsJson } = block.props;
      
      // Parse custom options from JSON
      const customOptions = customOptionsJson ? JSON.parse(customOptionsJson) : [];
      
      const handleChange = async (newValue: string) => {
        // If this is a habit status field, update the backend
        if (type === 'habit-status') {
          try {
            // Get the current file path from the editor or tab context
            // This assumes the editor has access to the file path
            const filePath = (window as Window & { currentFilePath?: string }).currentFilePath || '';
            
            if (filePath) {
              // Check if this is a habit file (case-insensitive and handle both forward and back slashes)
              const isHabitFile = filePath.toLowerCase().includes('/habits/') || 
                                 filePath.toLowerCase().includes('\\habits\\');
              
              if (isHabitFile) {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('update_habit_status', {
                  habitPath: filePath,  // Use camelCase for Tauri 2.0
                  newStatus: newValue,   // Use camelCase for Tauri 2.0
                });
                
                // After marking as complete, backend immediately resets to "todo"
                // Update the UI to reflect this
                if (newValue === 'complete') {
                  // Give a brief moment to show the completion, then reset UI
                  setTimeout(() => {
                    newValue = 'todo';
                    // Update the block to show "todo"
                    const findAndUpdateBlock = () => {
                      const blocks = props.editor.document;
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
                        const findByContent = (blocks: any[]): any => {
                          for (const b of blocks) {
                            if (b.type === 'singleselect' && 
                                (b.props as { type?: string })?.type === block.props.type) {
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
                        props.editor.updateBlock(targetBlock, {
                          props: {
                            ...targetBlock.props,
                            value: 'todo',
                          },
                        });
                      }
                    };
                    findAndUpdateBlock();
                  }, 500); // Brief delay to show completion
                }
                
                // Emit custom event to notify the app that habit status was updated
                const event = new CustomEvent('habit-status-updated', {
                  detail: { habitPath: filePath }
                });
                window.dispatchEvent(event);
              }
            }
          } catch (error) {
            console.error('[SingleSelectBlock] Failed to update habit status in backend:', error);
          }
        }
        
        // Find and update the block in the current document
        const findAndUpdateBlock = () => {
          const blocks = props.editor.document;
          
          // Recursively search for the block with matching properties
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
          
          // Try to find the block by ID first
          let targetBlock = findBlock(blocks, block.id);
          
          // If not found by ID, try to find by content and type
          if (!targetBlock) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const findByContent = (blocks: any[]): any => {
              for (const b of blocks) {
                if (b.type === 'singleselect' && 
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
              console.error('Failed to update found block:', e);
              return false;
            }
          }
          return false;
        };
        
        // Try the update
        if (!findAndUpdateBlock()) {
          console.warn('Could not find block to update, value may not persist');
        }
      };

      // Get options based on type
      const getOptions = () => {
        switch (type) {
          case 'status':
            return GTD_STATUS_OPTIONS;
          case 'effort':
            return GTD_EFFORT_OPTIONS;
          case 'project-status':
            return GTD_PROJECT_STATUS_OPTIONS;
          case 'habit-frequency':
            return HABIT_FREQUENCY_OPTIONS;
          case 'habit-status':
            return HABIT_STATUS_OPTIONS;
          case 'custom':
            return customOptions || [];
          default:
            return [];
        }
      };

      const options = getOptions();

      return (
        <div className="inline-block min-w-[200px] align-middle mx-1">
          {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
          <Select value={value || ''} onValueChange={handleChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={placeholder || `Select ${type}...`} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.length > 0 && options[0].group && (
                  <SelectLabel>{options[0].group}</SelectLabel>
                )}
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      );
    },
    parse: (element) => {
      // Check for new single select format
      if (element.tagName === 'DIV' && element.getAttribute('data-singleselect')) {
        try {
          const data = JSON.parse(element.getAttribute('data-singleselect') || '{}');
          return {
            type: data.type || 'status',
            value: data.value || '',
            label: data.label || '',
            placeholder: data.placeholder || '',
            customOptionsJson: JSON.stringify(data.customOptions || []),
          };
        } catch (e) {
          console.error('Error parsing singleselect data:', e);
          return;
        }
      }
    },
    toExternalHTML: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any;
      const { type, value } = block.props;
      // Return the markdown format that can be parsed back
      const markdownFormat = `[!singleselect:${type}:${value || ''}]`;
      // Wrap in a paragraph to ensure it's preserved in the markdown
      return <p>{markdownFormat}</p>;
    },
  }
);