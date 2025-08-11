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
        try {
          // Check if the block still exists in the document
          const blockStillExists = props.editor.document.some((b: any) => b.id === block.id);
          
          if (!blockStillExists) {
            console.warn('Block no longer exists in document, skipping update');
            return;
          }
          
          props.editor.updateBlock(block, {
            type: 'multiselect',
            props: {
              ...block.props,
              value: newValue.join(','),
            },
          });
        } catch (error) {
          console.error('Error updating multi select block:', error);
          // Try to force a re-render by updating through the document
          try {
            const blocks = props.editor.document.map((b: any) => {
              if (b.id === block.id) {
                return {
                  ...b,
                  props: {
                    ...b.props,
                    value: newValue.join(','),
                  },
                };
              }
              return b;
            });
            props.editor.replaceBlocks(props.editor.document, blocks);
          } catch (fallbackError) {
            console.error('Fallback update also failed:', fallbackError);
          }
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
      const { type, value, label, placeholder, maxCount, customOptionsJson } = block.props;
      const parsedValue = value ? value.split(',').filter(Boolean) : [];
      const customOptions = customOptionsJson ? JSON.parse(customOptionsJson) : [];
      const data = JSON.stringify({ type, value: parsedValue, label, placeholder, maxCount, customOptions });
      return (
        <div data-multiselect={data} className="multiselect-block">
          {label && <strong>{label}:</strong>} {parsedValue.join(', ') || `[No ${type} selected]`}
        </div>
      );
    },
  }
);