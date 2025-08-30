/**
 * @fileoverview Helper functions for SingleSelect blocks
 * @author Development Team
 * @created 2025-01-XX
 */

export type SingleSelectBlockType = 'status' | 'effort' | 'project-status' | 'habit-frequency' | 'habit-status' | 'custom';

export interface SingleSelectOption {
  value: string;
  label: string;
  group?: string;
}

// Helper function to create singleselect blocks
export const createSingleSelectBlock = (
  type: SingleSelectBlockType,
  label: string,
  value: string = '',
  options?: { placeholder?: string; customOptions?: SingleSelectOption[] }
) => ({
  type: 'singleselect' as const,
  props: {
    type,
    value,
    label,
    placeholder: options?.placeholder || '',
    customOptionsJson: JSON.stringify(options?.customOptions || []),
  },
});

// Convert old multiselect values to single select
export const convertToSingleValue = (multiValue: string[] | string): string => {
  if (Array.isArray(multiValue)) {
    return multiValue[0] || '';
  }
  return multiValue || '';
};

// Map status values for consistency
export const mapStatusValue = (status: string): string => {
  const statusMap: Record<string, string> = {
    'Not Started': 'in-progress',  // Map old "Not Started" to new default "in-progress"
    'In Progress': 'in-progress',
    'Waiting': 'waiting',
    'Completed': 'completed',
    'Active': 'in-progress',
    'Planning': 'in-progress',
    'On Hold': 'waiting',
    'Cancelled': 'cancelled',
  };
  
  return statusMap[status] || status.toLowerCase().replace(/\s+/g, '-');
};

// Map effort values for consistency
export const mapEffortValue = (effort: string): string => {
  const effortMap: Record<string, string> = {
    'Small': 'small',
    'Medium': 'medium',
    'Large': 'large',
    'Extra Large': 'extra-large',
  };
  
  return effortMap[effort] || effort.toLowerCase().replace(/\s+/g, '-');
};