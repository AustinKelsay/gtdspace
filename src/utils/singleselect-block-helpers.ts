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

// Normalize status strings to canonical form
const normalizeStatusString = (status: string): string => {
  const normalized = status.trim().toLowerCase().replace(/\s+/g, '-');
  // Map both spellings of canceled/cancelled to canonical "cancelled"
  if (normalized === 'canceled') {
    return 'cancelled';
  }
  return normalized;
};

// Map status values for consistency
export const mapStatusValue = (status: string): string => {
  // Normalize the input status first
  const normalized = normalizeStatusString(status);
  
  const statusMap: Record<string, string> = {
    'not-started': 'in-progress',  // Map old "Not Started" to new default "in-progress"
    'in-progress': 'in-progress',
    'waiting': 'waiting',
    'completed': 'completed',
    'active': 'in-progress',
    'planning': 'in-progress',
    'on-hold': 'waiting',
    'cancelled': 'completed',  // Remap cancelled/canceled to completed
    'done': 'completed',
    'complete': 'completed',
    'todo': 'in-progress',
  };
  
  const mapped = statusMap[normalized];
  if (mapped) {
    return mapped;
  }
  
  // Log unmapped values for diagnostics
  if (import.meta.env.DEV) {
    console.warn(`[SingleSelect] Unmapped status value encountered: "${status}" (normalized: "${normalized}"), defaulting to "in-progress"`);
  }
  
  // Always return safe default for unknown values
  return 'in-progress';
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