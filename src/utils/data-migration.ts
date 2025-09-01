/**
 * @fileoverview Data migration utilities for handling breaking changes
 * @author Development Team
 * @created 2025-01-30
 */

/**
 * Migrates markdown content from old field formats to new formats
 * Handles the following migrations:
 * 1. created_date -> created_date_time
 * 2. status arrays -> single status value
 */
export function migrateMarkdownContent(content: string): string {
  let migrated = content;
  
  // Migration 1: Rename created_date to created_date_time
  // Handle both [!datetime:created_date:...] and plain text patterns
  migrated = migrated.replace(
    /\[!datetime:created_date:([^\]]+)\]/g,
    '[!datetime:created_date_time:$1]'
  );
  
  // Also handle ## Created Date headers that might exist
  migrated = migrated.replace(
    /^##\s*Created Date\s*$/gm,
    '## Created Date/Time'
  );
  
  // Migration 1b: Rename focus_date_time to focus_date (newer convention)
  migrated = migrated.replace(
    /\[!datetime:focus_date_time:([^\]]*)\]/g,
    '[!datetime:focus_date:$1]'
  );
  
  // Migration 2: Convert status arrays to single values
  // If we find a multiselect status with multiple values, take the first one
  migrated = migrated.replace(
    /\[!multiselect:status:([^\]]+)\]/g,
    (match, values) => {
      const statusList = values.split(',').map((s: string) => s.trim());
      const primaryStatus = statusList[0] || 'in-progress';
      // Convert to single select format
      return `[!singleselect:status:${primaryStatus}]`;
    }
  );
  
  // Migration 3: Convert project-status arrays to single values
  migrated = migrated.replace(
    /\[!multiselect:project-status:([^\]]+)\]/g,
    (match, values) => {
      const statusList = values.split(',').map((s: string) => s.trim());
      const primaryStatus = statusList[0] || 'in-progress';
      // Convert to single select format
      return `[!singleselect:project-status:${primaryStatus}]`;
    }
  );
  
  // Migration 4: Convert effort multiselect to singleselect (effort should be single value)
  migrated = migrated.replace(
    /\[!multiselect:effort:([^\]]+)\]/g,
    (match, values) => {
      const effortList = values.split(',').map((s: string) => s.trim());
      const primaryEffort = effortList[0] || 'medium';
      // Convert to single select format
      return `[!singleselect:effort:${primaryEffort}]`;
    }
  );
  
  // Migration 5: Map old status values to canonical tokens
  const statusMappings: Record<string, string> = {
    'not-started': 'in-progress',
    'active': 'in-progress',
    'planning': 'in-progress',
    'on-hold': 'waiting',
    'waiting-for': 'waiting',
    'cancelled': 'completed', // Map cancelled to completed since we only have 3 states
    'done': 'completed',
    'complete': 'completed', // Map complete to completed
  };
  
  // Apply status mappings to singleselect fields
  migrated = migrated.replace(
    /\[!singleselect:(status|project-status):([^\]]+)\]/g,
    (match, fieldType, value) => {
      const normalizedValue = value.toLowerCase().trim().replace(/\s+/g, '-');
      // Use normalized value as fallback to ensure proper casing
      const mappedValue = statusMappings[normalizedValue] || normalizedValue;
      return `[!singleselect:${fieldType}:${mappedValue}]`;
    }
  );
  
  return migrated;
}

/**
 * Checks if content needs migration
 */
export function needsMigration(content: string): boolean {
  return (
    // Check for old created_date field
    content.includes('[!datetime:created_date:') ||
    // Check for old focus_date_time field (should be focus_date)
    content.includes('[!datetime:focus_date_time:') ||
    // Check for multiselect status fields (should be singleselect)
    content.includes('[!multiselect:status:') ||
    content.includes('[!multiselect:project-status:') ||
    // Check for multiselect effort field (should be singleselect)
    content.includes('[!multiselect:effort:') ||
    // Check for old status values (excluding 'completed' which is canonical)
    /\[!singleselect:(?:status|project-status):(?:not-started|active|planning|on-hold|waiting-for|cancelled|done)\]/i.test(content)
  );
}

/**
 * Migrates a GTD object's field names for backward compatibility
 * Used when loading data from backend that might have old field names
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateGTDObject<T extends Record<string, any>>(obj: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const migrated: any = { ...obj };
  
  // Migrate created_date to created_date_time
  if ('created_date' in migrated && !('created_date_time' in migrated)) {
    migrated.created_date_time = migrated.created_date;
    delete migrated.created_date;
  }
  
  // Ensure status is a single value, not an array
  if ('status' in migrated && Array.isArray(migrated.status)) {
    migrated.status = migrated.status[0] || 'in-progress';
  }
  
  // Map old status values to canonical tokens
  if ('status' in migrated && typeof migrated.status === 'string') {
    const statusMappings: Record<string, string> = {
      'not-started': 'in-progress',
      'active': 'in-progress',
      'planning': 'in-progress',
      'on-hold': 'waiting',
      'waiting-for': 'waiting',
      'cancelled': 'completed',
      'done': 'completed',
      'complete': 'completed',
    };
    
    const normalizedStatus = migrated.status.toLowerCase().replace(/\s+/g, '-');
    // Use normalized value as fallback to ensure proper casing
    migrated.status = statusMappings[normalizedStatus] || normalizedStatus;
  }
  
  return migrated as T;
}

/**
 * Batch migrate an array of GTD objects
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateGTDObjects<T extends Record<string, any>>(objects: T[]): T[] {
  return objects.map(obj => migrateGTDObject(obj));
}