/**
 * @fileoverview Helper functions for MultiSelect blocks
 * @author Development Team
 * @created 2025-01-XX
 */

import { Option } from '@/components/ui/multi-select';

export type MultiSelectBlockType = 'status' | 'effort' | 'project-status' | 'contexts' | 'categories' | 'custom';

// Helper function to create multiselect blocks
export const createMultiSelectBlock = (
  type: MultiSelectBlockType,
  label: string,
  value: string[] = [],
  options?: { placeholder?: string; maxCount?: number; customOptions?: Option[] }
) => ({
  type: 'multiselect' as const,
  props: {
    type,
    value: value.join(','),
    label,
    placeholder: options?.placeholder || '',
    maxCount: options?.maxCount || 0,
    customOptionsJson: JSON.stringify(options?.customOptions || []),
  },
});