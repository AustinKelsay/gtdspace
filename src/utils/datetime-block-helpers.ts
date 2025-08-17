/**
 * @fileoverview Helper functions for datetime blocks in BlockNote
 * @author Development Team
 * @created 2025-01-17
 */

export type DateTimeFieldType = 
  | 'created_date'
  | 'modified_date'
  | 'due_date'
  | 'focus_date'
  | 'completed_date'
  | 'custom';

/**
 * Creates a datetime block for BlockNote
 */
export function createDateTimeBlock(
  type: DateTimeFieldType,
  label?: string,
  value?: string,
  includeTime = false
) {
  return {
    type: 'datetime',
    props: {
      type,
      value: value || '',
      label: label || getDefaultLabel(type),
      includeTime,
      optional: true,
    },
  };
}

/**
 * Gets the default label for a datetime field type
 */
function getDefaultLabel(type: DateTimeFieldType): string {
  switch (type) {
    case 'created_date':
      return 'Created';
    case 'modified_date':
      return 'Modified';
    case 'due_date':
      return 'Due Date';
    case 'focus_date':
      return 'Focus Date';
    case 'completed_date':
      return 'Completed';
    default:
      return 'Date';
  }
}

/**
 * Parses a datetime field from markdown format
 * @param markdown - String like "[!datetime:due_date:2025-01-17T10:30:00]"
 */
export function parseDateTimeField(markdown: string): {
  type: DateTimeFieldType;
  value: string;
  includeTime: boolean;
} | null {
  // Match patterns like:
  // [!datetime:due_date:2025-01-17]
  // [!datetime:due_date_time:2025-01-17T10:30:00]
  // Captures:
  //  - Group 1: base type (e.g., "due_date")
  //  - Group 2: optional suffix "_time" if present
  //  - Group 3: value (may contain colons)
  const match = markdown.match(/\[!datetime:([^:\]]+?)(?:(_time))?:([^\]]*)\]/);
  if (!match) return null;

  const capturedBaseType = match[1];
  const capturedSuffix = match[2];
  const value = match[3];

  const rawType = capturedBaseType + (capturedSuffix || '');
  const includeTime = Boolean(capturedSuffix) || rawType.endsWith('_time');
  const baseType = includeTime ? rawType.replace(/_time$/, '') : rawType;

  return {
    type: baseType as DateTimeFieldType,
    value,
    includeTime,
  };
}

/**
 * Converts a datetime block to markdown format
 */
export function dateTimeBlockToMarkdown(
  type: DateTimeFieldType,
  value: string,
  includeTime: boolean
): string {
  const fieldType = includeTime ? `${type}_time` : type;
  return `[!datetime:${fieldType}:${value}]`;
}