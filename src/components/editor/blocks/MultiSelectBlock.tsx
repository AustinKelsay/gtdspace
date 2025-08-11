/**
 * @fileoverview Custom BlockNote block for multiselect fields
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import { MultiSelect, Option } from '@/components/ui/multi-select';
import { GTDTagSelector } from '@/components/gtd/GTDTagSelector';
import type { MultiSelectBlockType } from '@/utils/multiselect-block-helpers';

// Define status options for GTD
const GTD_STATUS_OPTIONS: Option[] = [
  { value: 'in-progress', label: 'In Progress', group: 'Status' },
  { value: 'waiting', label: 'Waiting', group: 'Status' },
  { value: 'complete', label: 'Complete', group: 'Status' },
];

// Define effort options for GTD
const GTD_EFFORT_OPTIONS: Option[] = [
  { value: 'small', label: 'Small (<30 min)', group: 'Effort' },
  { value: 'medium', label: 'Medium (30-90 min)', group: 'Effort' },
  { value: 'large', label: 'Large (>90 min)', group: 'Effort' },
  { value: 'extra-large', label: 'Extra Large (>3 hours)', group: 'Effort' },
];

// Define project status options
const GTD_PROJECT_STATUS_OPTIONS: Option[] = [
  { value: 'in-progress', label: 'In Progress', group: 'Project Status' },
  { value: 'waiting', label: 'Waiting', group: 'Project Status' },
  { value: 'completed', label: 'Completed', group: 'Project Status' },
];

// Define prop schema with proper types
const multiSelectPropSchema = {
  type: {
    default: 'status' as MultiSelectBlockType,
  },
  value: {
    default: '',  // Store as comma-separated string
  },
  label: {
    default: '',
  },
  placeholder: {
    default: '',
  },
  maxCount: {
    default: 0,  // 0 means no limit
  },
  customOptionsJson: {
    default: '',  // Store options as JSON string
  },
} satisfies PropSchema;

export const MultiSelectBlock = createReactBlockSpec(
  {
    type: 'multiselect' as const,
    propSchema: multiSelectPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      // console.log('MultiSelectBlock render called with props:', props);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any; // Type assertion needed for BlockNote v0.35
      const { type, value, label, placeholder, maxCount, customOptionsJson } = block.props;
      // console.log('Block props:', { type, value, label, placeholder, maxCount, customOptionsJson });
      
      // Parse value from comma-separated string
      const parsedValue = value ? value.split(',').filter(Boolean) : [];
      
      // Parse custom options from JSON
      const customOptions: Option[] = customOptionsJson ? JSON.parse(customOptionsJson) : [];
      
      const handleChange = (newValue: string[]) => {
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
                if (b.type === 'multiselect' && 
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
                  value: newValue.join(','),
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
      const getOptions = (): Option[] => {
        switch (type) {
          case 'status':
            return GTD_STATUS_OPTIONS;
          case 'effort':
            return GTD_EFFORT_OPTIONS;
          case 'project-status':
            return GTD_PROJECT_STATUS_OPTIONS;
          case 'contexts':
          case 'categories':
            // Use GTDTagSelector for these types
            return [];
          case 'custom':
            return customOptions || [];
          default:
            return [];
        }
      };

      // Use GTDTagSelector for context and category types
      if (type === 'contexts' || type === 'categories') {
        return (
          <div className="inline-block min-w-[200px] align-middle mx-1">
            {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
            <GTDTagSelector
              type={type}
              value={parsedValue}
              onValueChange={handleChange}
              placeholder={placeholder}
              maxCount={maxCount}
              className="w-full"
            />
          </div>
        );
      }

      // Use regular MultiSelect for other types
      return (
        <div className="inline-block min-w-[200px] align-middle mx-1">
          {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
          <MultiSelect
            options={getOptions()}
            value={parsedValue}
            onValueChange={handleChange}
            placeholder={placeholder || `Select ${type}...`}
            maxCount={maxCount}
            className="w-full"
          />
        </div>
      );
    },
    parse: (element) => {
      console.log('MultiSelectBlock parse called with element:', element.tagName, element.outerHTML?.substring(0, 100));
      if (element.tagName === 'DIV' && element.getAttribute('data-multiselect')) {
        try {
          const data = JSON.parse(element.getAttribute('data-multiselect') || '{}');
          // console.log('Parsed multiselect data:', data);
          return {
            type: data.type || 'status',
            value: (data.value || []).join(','),
            label: data.label || '',
            placeholder: data.placeholder || '',
            maxCount: data.maxCount || 0,
            customOptionsJson: JSON.stringify(data.customOptions || []),
          };
        } catch (e) {
          console.error('Error parsing multiselect data:', e);
          return;
        }
      }
    },
    toExternalHTML: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any;
      const { type, value } = block.props;
      // Return the markdown format that can be parsed back
      const markdownFormat = `[!multiselect:${type}:${value || ''}]`;
      // Wrap in a paragraph to ensure it's preserved in the markdown
      return <p>{markdownFormat}</p>;
    },
  }
);