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
  const match = markdown.match(/\[!datetime:([^:]+):([^\]]*)\]/);
  if (!match) return null;

  const type = match[1];
  const value = match[2];
  const includeTime = type.endsWith('_time');
  const baseType = includeTime ? type.replace('_time', '') : type;

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