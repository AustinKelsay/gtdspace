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
      
      // Replace elements directly in the DOM
      multiselects.forEach((element) => {
        const dataAttribute = element.getAttribute('data-multiselect');
        if (dataAttribute) {
          try {
            // Decode HTML entities and unescape quotes
            const jsonStr = dataAttribute
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/\\"/g, '"');
            
            const data = JSON.parse(jsonStr);
            // Validate and sanitize type with allowlist
            const rawType = typeof data.type === 'string' ? data.type.trim() : '';
            const allowed = new Set(['tags', 'contexts', 'categories', 'custom']);
            const type = allowed.has(rawType) ? rawType : 'tags';
            // Normalize value: handle arrays, strings, and other types
            let value = '';
            if (Array.isArray(data.value)) {
              value = data.value.join(',');
            } else if (typeof data.value === 'string') {
              value = data.value;
            } else if (data.value != null) {
              value = String(data.value);
            }
            const newMarker = `[!multiselect:${type}:${value}]`;
            
            // Replace the element with a text node containing the marker
            const textNode = doc.createTextNode(newMarker);
            element.replaceWith(textNode);
          } catch (e) {
            console.error('Error parsing multiselect data:', e, 'Data:', dataAttribute);
          }
        }
      });
      
      // Serialize the mutated DOM back to markdown while preserving legitimate inline HTML.
      // Extract just the body content (without the wrapper div we added) and sanitize it.
      const container = doc.body.firstElementChild as HTMLElement | null;
      if (container) {
        const html = container.innerHTML;
        processedMarkdown = sanitizeHtml(html);
      }
    } catch (e) {
      // Fallback to regex if DOMParser fails
      console.warn('DOMParser failed, falling back to regex:', e);
      const result = serializeMultiselectsToMarkersRegex(markdown);
      return sanitizeHtml(result);
    }
  } else {
    // Use regex fallback for non-browser environments
    const result = serializeMultiselectsToMarkersRegex(markdown);
    return sanitizeHtml(result);
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
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\\"/g, '"');
      
      const data = JSON.parse(jsonStr);
      // Validate and sanitize type with allowlist
      const rawType = typeof data.type === 'string' ? data.type.trim() : '';
      const allowed = new Set(['tags', 'contexts', 'categories', 'custom']);
      const type = allowed.has(rawType) ? rawType : 'tags';
      // Normalize value: handle arrays, strings, and other types
      let value = '';
      if (Array.isArray(data.value)) {
        value = data.value.join(',');
      } else if (typeof data.value === 'string') {
        value = data.value;
      } else if (data.value != null) {
        value = String(data.value);
      }
      const newMarker = `[!multiselect:${type}:${value}]`;

      // Replace the HTML with the marker
      processedMarkdown = processedMarkdown.replace(match[0], newMarker);
    } catch (e) {
      console.error('Error parsing multiselect HTML:', e, 'HTML:', match[0]);
    }
  }
  // Sanitize the output before returning
  return sanitizeHtml(processedMarkdown);
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
      // Validate and sanitize type
      const rawType = (match[1] || '').trim();
      const allowed = new Set(['tags', 'contexts', 'categories', 'custom']);
      const type = allowed.has(rawType) ? rawType : 'tags';
      
      // Parse and trim values
      const valueStr = match[2] || '';
      const values = valueStr
        ? valueStr.split(',').map(v => v.trim()).filter(Boolean)
        : [];
      
      // Create the HTML format that the editor expects
      const data = {
        type,
        value: values
      };
      
      // Escape JSON for HTML attribute and escape special chars
      const jsonStr = JSON.stringify(data).replace(/"/g, '\\"');
      const attrSafe = jsonStr
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/'/g, '&#39;');
      
      // Escape inner text
      const text = `${type}: ${values.join(', ')}`;
      const safeInner = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      const htmlBlock = `<div data-multiselect='${attrSafe}' class="multiselect-block">${safeInner}</div>`;
      
      // Replace the marker with HTML block
      processedMarkdown = processedMarkdown.replace(match[0], htmlBlock);
    } catch (e) {
      console.error('Error deserializing multiselect marker:', e, 'Marker:', match[0]);
    }
  }
  
  return sanitizeHtml(processedMarkdown);
}

/**
 * Sanitizes HTML while preserving legitimate inline markup.
 * - Prefers a global DOMPurify instance if available
 * - Falls back to a conservative DOM-based sanitizer in browsers
 * - Uses a minimal regex-based sanitizer when no DOM is available
 * @param html Raw HTML string
 * @returns Sanitized HTML string
 */
function sanitizeHtml(html: string): string {
  // Try DOMPurify if present on the global object
  try {
    const maybePurify = (typeof globalThis !== 'undefined' && (globalThis as { DOMPurify?: unknown }).DOMPurify) || null;
    if (maybePurify && typeof (maybePurify as { sanitize?: (html: string) => string }).sanitize === 'function') {
      return (maybePurify as { sanitize: (html: string) => string }).sanitize(html);
    }
  } catch {
    // ignore
  }

  // If document isn't available (SSR/Node), use a minimal regex-based sanitizer
  if (typeof document === 'undefined') {
    let sanitized = html;
    // Remove script blocks
    sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    // Remove event handler attributes like onclick="..."
    sanitized = sanitized.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    // Neutralize javascript: URLs
    sanitized = sanitized.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*(\2)/gi, '$1="#"');
    sanitized = sanitized.replace(/(href|src)\s*=\s*javascript:[^\s>]+/gi, '$1="#"');
    // Remove dangerous embedding elements
    sanitized = sanitized.replace(/<\/?(iframe|object|embed)[^>]*>/gi, '');
    return sanitized;
  }

  // DOM-based conservative sanitizer
  const template = document.createElement('template');
  template.innerHTML = html;

  // Remove dangerous nodes entirely
  template.content.querySelectorAll('script, iframe, object, embed').forEach((node) => {
    node.parentNode?.removeChild(node);
  });

  // Scrub dangerous attributes and protocols
  template.content.querySelectorAll('*').forEach((el) => {
    // Remove inline event handlers
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: Element type index
    Array.from(el.attributes).forEach((attr: Attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
        el.setAttribute(attr.name, '#');
      }
    });
  });

  return template.innerHTML;
}