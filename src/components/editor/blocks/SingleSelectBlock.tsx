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
      
      const handleChange = (newValue: string) => {
        try {
          // Check if the block still exists in the document
          const blockStillExists = props.editor.document.some((b: any) => b.id === block.id);
          
          if (!blockStillExists) {
            console.warn('Block no longer exists in document, skipping update');
            return;
          }
          
          props.editor.updateBlock(block, {
            type: 'singleselect',
            props: {
              ...block.props,
              value: newValue,
            },
          });
        } catch (error) {
          console.error('Error updating single select block:', error);
          // Try to force a re-render by updating through the document
          try {
            const blocks = props.editor.document.map((b: any) => {
              if (b.id === block.id) {
                return {
                  ...b,
                  props: {
                    ...b.props,
                    value: newValue,
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
      const getOptions = () => {
        switch (type) {
          case 'status':
            return GTD_STATUS_OPTIONS;
          case 'effort':
            return GTD_EFFORT_OPTIONS;
          case 'project-status':
            return GTD_PROJECT_STATUS_OPTIONS;
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
      const { type, value, label, placeholder, customOptionsJson } = block.props;
      const customOptions = customOptionsJson ? JSON.parse(customOptionsJson) : [];
      const data = JSON.stringify({ type, value, label, placeholder, customOptions });
      return (
        <div data-singleselect={data} className="singleselect-block">
          {label && <strong>{label}:</strong>} {value || `[No ${type} selected]`}
        </div>
      );
    },
  }
);