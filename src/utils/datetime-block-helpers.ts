/**
 * @fileoverview Helper functions for datetime blocks in BlockNote
 * @author Development Team
 * @created 2025-01-17
 */

export type DateTimeFieldType = 
  | 'created_date_time'
  | 'created_date' // Legacy support - will be normalized to created_date_time
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
  value?: string
) {
  return {
    type: 'datetime',
    props: {
      type,
      value: value || '',
      label: label || getDefaultLabel(type),
      optional: true,
    },
  };
}

/**
 * Gets the default label for a datetime field type
 */
function getDefaultLabel(type: DateTimeFieldType): string {
  switch (type) {
    case 'created_date_time':
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
} | null {
  // Match patterns like:
  // [!datetime:due_date:2025-01-17]
  // [!datetime:focus_date:2025-01-17T10:30:00]
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
  
  // Normalize the type - special case for created_date_time
  let normalizedType: string;
  if (rawType === 'created_date' || rawType === 'created_date_time') {
    normalizedType = 'created_date_time';
  } else {
    // For other types, strip _time suffix if present
    normalizedType = rawType.replace(/_time$/, '');
  }
  
  // Validate against DateTimeFieldType union
  const validTypes: DateTimeFieldType[] = ['created_date_time', 'modified_date', 'due_date', 'focus_date', 'completed_date', 'custom'];
  const finalType: DateTimeFieldType = validTypes.includes(normalizedType as DateTimeFieldType) 
    ? normalizedType as DateTimeFieldType 
    : 'custom';

  return {
    type: finalType,
    value,
  };
}

/**
 * Converts a datetime block to markdown format
 */
export function dateTimeBlockToMarkdown(
  type: DateTimeFieldType,
  value: string
): string {
  const hasTime = value.includes('T');
  let fieldType: string;
  let outValue = value;
  
  if (type === 'focus_date') {
    fieldType = 'focus_date';
  } else if (type === 'due_date' || type === 'completed_date' || type === 'modified_date') {
    fieldType = type;
    // enforce date-only for due_date, completed_date, and modified_date
    outValue = value && hasTime ? value.split('T')[0] : value;
  } else if (type === 'created_date' || type === 'created_date_time') {
    // Canonicalize both created_date and created_date_time to created_date_time
    fieldType = 'created_date_time';
  } else if ((type as string).endsWith('_time')) {
    fieldType = String(type);
  } else if (type === 'custom') {
    // Preserve custom types exactly as they are
    fieldType = type;
  } else {
    fieldType = hasTime ? `${type}_time` : type;
  }
  
  return `[!datetime:${fieldType}:${outValue}]`;
}