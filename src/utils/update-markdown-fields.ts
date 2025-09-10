/**
 * @fileoverview Utility for updating various fields in markdown content
 * @author Development Team
 * @created 2025-01-20
 */

/**
 * Updates a datetime field in markdown content
 * @param content - The markdown content to update
 * @param fieldType - The type of date field to update (due_date or focus_date)
 * @param newDate - The new date value (ISO string format)
 * @returns Updated markdown content
 */
export function updateMarkdownDate(
  content: string,
  fieldType: 'due_date' | 'focus_date',
  newDate: string
): string {
  // Pattern to match the datetime field
  const pattern = new RegExp(`\\[!datetime:${fieldType}:([^\\]]*)\\]`, 'g');
  
  // Check if the field exists in the content
  const fieldExists = pattern.test(content);
  
  // Reset the regex lastIndex after test
  pattern.lastIndex = 0;
  
  if (fieldExists) {
    // Replace existing field with new date
    return content.replace(pattern, `[!datetime:${fieldType}:${newDate}]`);
  } else {
    // Add the field if it doesn't exist
    // Try to add it after the title (# heading) if one exists
    const titleMatch = content.match(/^#\s+.+$/m);
    
    if (titleMatch && titleMatch.index !== undefined) {
      // Find the end of the title line
      const titleEndIndex = titleMatch.index + titleMatch[0].length;
      
      // Insert the new field on a new line after the title
      return (
        content.slice(0, titleEndIndex) +
        '\n' +
        `[!datetime:${fieldType}:${newDate}]` +
        content.slice(titleEndIndex)
      );
    } else {
      // No title found, add at the beginning of the file
      return `[!datetime:${fieldType}:${newDate}]\n\n` + content;
    }
  }
}

/**
 * Determines which date field should be updated based on event type
 * @param eventType - The type of calendar event (due, focus, habit, google)
 * @returns The field type to update
 */
export function getDateFieldForEventType(
  eventType: 'due' | 'focus' | 'habit' | 'google'
): 'due_date' | 'focus_date' {
  // Habits and focus events update focus_date
  // Due events update due_date
  // Google events should not be draggable, but if they are, default to focus_date
  return eventType === 'due' ? 'due_date' : 'focus_date';
}

/**
 * Formats a date for display while preserving time if present
 * @param date - The date to format
 * @param includeTime - Whether to include time in the output
 * @returns ISO string format suitable for markdown
 */
export function formatDateForMarkdown(date: Date, includeTime: boolean = false): string {
  if (includeTime) {
    // Return full ISO string with time
    return date.toISOString();
  } else {
    // Return date only (YYYY-MM-DD format)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

/**
 * Updates the effort field in markdown content
 * @param content - The markdown content to update
 * @param newEffort - The new effort value (small, medium, large, extra-large)
 * @returns Updated markdown content
 */
export function updateMarkdownEffort(
  content: string,
  newEffort: 'small' | 'medium' | 'large' | 'extra-large'
): string {
  // Pattern to match the effort field
  const pattern = /\[!singleselect:effort:([^\]]*)\]/g;
  
  // Check if the field exists in the content
  const fieldExists = pattern.test(content);
  
  // Reset the regex lastIndex after test
  pattern.lastIndex = 0;
  
  if (fieldExists) {
    // Replace existing field with new effort
    return content.replace(pattern, `[!singleselect:effort:${newEffort}]`);
  } else {
    // Add the field if it doesn't exist
    // Try to add it after the status field if one exists
    const statusMatch = content.match(/\[!singleselect:status:[^\]]+\]/);
    
    if (statusMatch && statusMatch.index !== undefined) {
      // Find the end of the status field
      const statusEndIndex = statusMatch.index + statusMatch[0].length;
      
      // Insert the new field on a new line after the status
      return (
        content.slice(0, statusEndIndex) +
        '\n' +
        `[!singleselect:effort:${newEffort}]` +
        content.slice(statusEndIndex)
      );
    } else {
      // Try to add after title if exists
      const titleMatch = content.match(/^#\s+.+$/m);
      
      if (titleMatch && titleMatch.index !== undefined) {
        const titleEndIndex = titleMatch.index + titleMatch[0].length;
        return (
          content.slice(0, titleEndIndex) +
          '\n' +
          `[!singleselect:effort:${newEffort}]` +
          content.slice(titleEndIndex)
        );
      } else {
        // Add at the beginning of the file
        return `[!singleselect:effort:${newEffort}]\n\n` + content;
      }
    }
  }
}

/**
 * Maps pixel height to effort level
 * @param pixels - Height in pixels
 * @returns Effort level
 */
export function getEffortFromHeight(pixels: number): 'small' | 'medium' | 'large' | 'extra-large' {
  // In week view, each hour = 80px
  if (pixels <= 40) return 'small';      // ≤30 min
  if (pixels <= 80) return 'medium';     // ≤1 hour  
  if (pixels <= 160) return 'large';     // ≤2 hours
  return 'extra-large';                  // >2 hours
}

/**
 * Maps effort level to pixel height
 * @param effort - Effort level
 * @returns Height in pixels
 */
export function getHeightFromEffort(effort: string): number {
  switch (effort?.toLowerCase()) {
    case 'small':
      return 40;  // 30 minutes
    case 'medium':
      return 80;  // 1 hour
    case 'large':
      return 160; // 2 hours
    case 'extra-large':
      return 240; // 3 hours
    default:
      return 40;  // Default to small
  }
}