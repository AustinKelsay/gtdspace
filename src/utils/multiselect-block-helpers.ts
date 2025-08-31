/**
 * @fileoverview Helper functions for MultiSelect blocks
 * Note: Status, Effort, and Project Status now use SingleSelectBlock
 * MultiSelect is for fields that support multiple values (tags, contexts, categories)
 * @author Development Team
 * @created 2025-01-XX
 */

import { Option } from '@/components/ui/multi-select';

export type MultiSelectBlockType = 'tags' | 'contexts' | 'categories' | 'custom';

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

/**
 * Serializes legacy HTML multiselect blocks into the new marker format.
 * This is used during the save process to ensure all multiselects are stored
 * in the standardized marker format.
 * @param markdown The markdown content potentially containing legacy HTML multiselects.
 * @returns Markdown content with legacy HTML multiselects converted to markers.
 */
export function serializeMultiselectsToMarkers(markdown: string): string {
  const multiSelectHTMLPattern = /<div\s+data-multiselect='([^']+)'[^>]*class="multiselect-block">.*?<\/div>/g;
  let processedMarkdown = markdown;
  let match;

  while ((match = multiSelectHTMLPattern.exec(markdown)) !== null) {
    try {
      let jsonStr = match[1];
      // Replace escaped quotes with regular quotes if they exist
      if (jsonStr.includes('\\"')) {
        jsonStr = jsonStr.replace(/\\"/g, '"');
      }
      const data = JSON.parse(jsonStr);
      const type = data.type || 'tags';
      const value = (data.value || []).join(',');
      const newMarker = `[!multiselect:${type}:${value}]`;

      // Replace only the matched HTML string to avoid issues with global replace on processedMarkdown
      processedMarkdown = processedMarkdown.replace(match[0], newMarker);
    } catch (e) {
      console.error('Error serializing multiselect HTML:', e, 'JSON string:', match[1]);
    }
  }
  return processedMarkdown;
}