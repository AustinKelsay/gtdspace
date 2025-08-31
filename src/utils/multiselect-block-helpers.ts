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
  let processedMarkdown = markdown;
  
  // Use DOMParser if available (browser environment)
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      // Wrap in a container to parse fragments
      const doc = parser.parseFromString(`<div>${markdown}</div>`, 'text/html');
      
      // Find all divs with data-multiselect attribute and multiselect-block class
      const multiselects = doc.querySelectorAll('div[data-multiselect].multiselect-block');
      
      multiselects.forEach((element) => {
        const dataAttribute = element.getAttribute('data-multiselect');
        if (dataAttribute) {
          try {
            // Decode HTML entities and unescape quotes
            const jsonStr = dataAttribute
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .replace(/\\"/g, '"');
            
            const data = JSON.parse(jsonStr);
            const type = data.type || 'tags';
            const value = (data.value || []).join(',');
            const newMarker = `[!multiselect:${type}:${value}]`;
            
            // Replace the original HTML in the markdown
            processedMarkdown = processedMarkdown.replace(element.outerHTML, newMarker);
          } catch (e) {
            console.error('Error parsing multiselect data:', e, 'Data:', dataAttribute);
          }
        }
      });
    } catch (e) {
      // Fallback to regex if DOMParser fails
      console.warn('DOMParser failed, falling back to regex:', e);
      return serializeMultiselectsToMarkersRegex(markdown);
    }
  } else {
    // Use regex fallback for non-browser environments
    return serializeMultiselectsToMarkersRegex(markdown);
  }
  
  return processedMarkdown;
}

// Fallback regex-based implementation for non-browser environments
function serializeMultiselectsToMarkersRegex(markdown: string): string {
  // More robust regex that handles both single and double quotes, any attribute order
  const multiSelectHTMLPattern = /<div(?=\s)(?=.*?class=["'][^"']*multiselect-block[^"']*["'])(?=.*?data-multiselect=["']([^"']+)["'])[^>]*>[\s\S]*?<\/div>/gi;
  let processedMarkdown = markdown;
  let match;

  while ((match = multiSelectHTMLPattern.exec(markdown)) !== null) {
    try {
      let jsonStr = match[1];
      // Decode HTML entities and unescape quotes
      jsonStr = jsonStr
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\\"/g, '"');
      
      const data = JSON.parse(jsonStr);
      const type = data.type || 'tags';
      const value = (data.value || []).join(',');
      const newMarker = `[!multiselect:${type}:${value}]`;

      // Replace the HTML with the marker
      processedMarkdown = processedMarkdown.replace(match[0], newMarker);
    } catch (e) {
      console.error('Error parsing multiselect HTML:', e, 'HTML:', match[0]);
    }
  }
  return processedMarkdown;
}

/**
 * Deserializes multiselect markers back into HTML format for the editor.
 * This is the reverse of serializeMultiselectsToMarkers.
 * Safe to run multiple times - returns input unchanged if no markers present.
 * @param markdown The markdown content potentially containing multiselect markers.
 * @returns Markdown content with multiselect markers converted to HTML blocks.
 */
export function deserializeMarkersToMultiselects(markdown: string): string {
  // Pattern to match multiselect markers like [!multiselect:tags:urgent,important]
  const multiSelectMarkerPattern = /\[!multiselect:([^:]+):([^\]]*)\]/g;
  let processedMarkdown = markdown;
  let match;
  
  while ((match = multiSelectMarkerPattern.exec(markdown)) !== null) {
    try {
      const type = match[1];
      const valueStr = match[2] || '';
      const values = valueStr ? valueStr.split(',').filter(v => v.trim()) : [];
      
      // Create the HTML format that the editor expects
      const data = {
        type,
        value: values
      };
      
      // Escape quotes in JSON string for HTML attribute
      const jsonStr = JSON.stringify(data)
        .replace(/"/g, '\\"')
        .replace(/'/g, '&#39;');  // Also escape single quotes to prevent breaking the HTML attribute
      const htmlBlock = `<div data-multiselect='${jsonStr}' class="multiselect-block">${type}: ${values.join(', ')}</div>`;
      
      // Replace the marker with HTML block
      processedMarkdown = processedMarkdown.replace(match[0], htmlBlock);
    } catch (e) {
      console.error('Error deserializing multiselect marker:', e, 'Marker:', match[0]);
    }
  }
  
  return processedMarkdown;
}