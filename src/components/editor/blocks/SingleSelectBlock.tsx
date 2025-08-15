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
  { value: '5-minute', label: 'Every 5 Minutes (Testing)', group: 'Frequency' },
  { value: 'daily', label: 'Every Day', group: 'Frequency' },
  { value: 'every-other-day', label: 'Every Other Day', group: 'Frequency' },
  { value: 'twice-weekly', label: 'Twice a Week', group: 'Frequency' },
  { value: 'weekly', label: 'Once Every Week', group: 'Frequency' },
  { value: 'biweekly', label: 'Once Every Other Week', group: 'Frequency' },
  { value: 'monthly', label: 'Once a Month', group: 'Frequency' },
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
        console.log('[SingleSelectBlock] handleChange called with:', { type, newValue, value });
        
        // If this is a habit status field, update the backend
        if (type === 'habit-status') {
          try {
            // Get the current file path from the editor or tab context
            // This assumes the editor has access to the file path
            const filePath = (window as any).currentFilePath || '';
            console.log('[SingleSelectBlock] Habit status change detected');
            console.log('[SingleSelectBlock] Window object:', window);
            console.log('[SingleSelectBlock] Window.currentFilePath:', (window as any).currentFilePath);
            console.log('[SingleSelectBlock] Current file path:', filePath);
            console.log('[SingleSelectBlock] New status value:', newValue);
            console.log('[SingleSelectBlock] Old status value:', value);
            
            if (filePath) {
              // Check if this is a habit file (case-insensitive and handle both forward and back slashes)
              const isHabitFile = filePath.toLowerCase().includes('/habits/') || 
                                 filePath.toLowerCase().includes('\\habits\\');
              console.log('[SingleSelectBlock] Is habit file?', isHabitFile);
              
              if (isHabitFile) {
                console.log('[SingleSelectBlock] Calling update_habit_status backend...');
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('update_habit_status', {
                  habitPath: filePath,  // Use camelCase for Tauri 2.0
                  newStatus: newValue,   // Use camelCase for Tauri 2.0
                });
                console.log('[SingleSelectBlock] Habit status updated in backend successfully');
              } else {
                console.log('[SingleSelectBlock] Not a habit file, skipping backend update');
              }
            } else {
              console.log('[SingleSelectBlock] File path not set, skipping backend update');
            }
          } catch (error) {
            console.error('[SingleSelectBlock] Failed to update habit status in backend:', error);
          }
        }
        
        // Find and update the block in the current document
        const findAndUpdateBlock = () => {
          const blocks = props.editor.document;
          
          // Recursively search for the block with matching properties
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
            const findByContent = (blocks: any[]): any => {
              for (const b of blocks) {
                if (b.type === 'singleselect' && 
                    b.props?.type === block.props.type &&
                    b.props?.label === block.props.label) {
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
      console.log('SingleSelectBlock parse called with element:', element.tagName, element.outerHTML?.substring(0, 100));
      
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