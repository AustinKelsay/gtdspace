/**
 * @fileoverview Utility for extracting metadata from markdown content
 * Provides a scalable system for parsing various metadata fields
 */

import { parseReferenceList } from '@/utils/gtd-reference-utils';

export interface FileMetadata {
  title?: string;
  status?: string;
  projectStatus?: string;
  effort?: string;
  focusDate?: string;
  dueDate?: string;
  tags?: string[];
  [key: string]: string | string[] | undefined; // Allow for future metadata fields
}

export interface MetadataExtractor {
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => { key: string; value: string | string[] } | null;
}

function decodeHtmlAttribute(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function mapSingleSelectField(fieldName: string): string {
  const fieldMap: Record<string, string> = {
    'status': 'status',
    'effort': 'effort',
    'project-status': 'projectStatus',
    'habit-status': 'habitStatus',
    'habit-frequency': 'habitFrequency',
    'area-status': 'areaStatus',
    'area-review-cadence': 'areaReviewCadence',
    'goal-status': 'goalStatus',
    'vision-horizon': 'visionHorizon',
    'horizon-altitude': 'horizonAltitude',
    'horizon-review-cadence': 'horizonReviewCadence',
  };

  return fieldMap[fieldName] || fieldName;
}

function mapDateTimeField(fieldName: string): string {
  const fieldMap: Record<string, string> = {
    'due_date': 'dueDate',
    'focus_date': 'focusDate',
    'due_date_time': 'dueDate',
    'focus_date_time': 'focusDate',
    'created_date': 'createdDateTime',
    'created_date_time': 'createdDateTime',
    'modified_date': 'modifiedDate',
    'modified_date_time': 'modifiedDateTime',
    'completed_date': 'completedDate',
    'completed_date_time': 'completedDate',
    'target_date': 'targetDate',
    'goal-target-date': 'goalTargetDate',
  };

  return fieldMap[fieldName] || fieldName;
}

/**
 * Default extractors for common metadata patterns
 * Can be extended with custom extractors for new field types
 */
export const DEFAULT_EXTRACTORS: MetadataExtractor[] = [
  // Single select fields: [!singleselect:fieldname:value]
  // Note: fieldname can contain hyphens (e.g., project-status)
  {
    pattern: /\[!singleselect:([\w-]+):([^\]]+)\]/g,
    extract: (match) => {
      const field = mapSingleSelectField(match[1]);
      return { key: field, value: match[2] };
    }
  },
  {
    pattern: /\[!checkbox:(habit-status):(true|false)\]/g,
    extract: (match) => ({
      key: mapSingleSelectField(match[1]),
      value: match[2].toLowerCase() === 'true' ? 'completed' : 'todo',
    })
  },
  {
    pattern: /<div\s+data-singleselect='([^']+)'\s+class="singleselect-block">[^<]*<\/div>/g,
    extract: (match) => {
      try {
        const decoded = decodeHtmlAttribute(match[1]);
        const parsed = JSON.parse(decoded) as { type?: string; value?: string };
        const field = mapSingleSelectField(parsed.type ?? '');
        return { key: field, value: parsed.value ?? '' };
      } catch {
        return null;
      }
    }
  },

  // Datetime fields: [!datetime:fieldname:value]
  // Map common field names to camelCase keys used in the app's metadata
  {
    pattern: /\[!datetime:([\w-]+):([^\]]*)\]/g,
    extract: (match) => {
      const field = mapDateTimeField(match[1]);
      return { key: field, value: match[2] };
    }
  },
  {
    pattern: /<div\s+data-datetime='([^']+)'\s+class="datetime-block">[^<]*<\/div>/g,
    extract: (match) => {
      try {
        const decoded = decodeHtmlAttribute(match[1]);
        const parsed = JSON.parse(decoded) as { type?: string; value?: string };
        const field = mapDateTimeField(parsed.type ?? '');
        return { key: field, value: parsed.value ?? '' };
      } catch {
        return null;
      }
    }
  },
  
  // Multi select fields: [!multiselect:fieldname:value1,value2]
  {
    pattern: /\[!multiselect:([\w-]+):([^\]]+)\]/g,
    extract: (match) => {
      // Map multiselect field names to their canonical metadata keys
      const fieldMap: Record<string, string> = {
        'tags': 'tags',
        'contexts': 'contexts',
        'categories': 'categories',
        'area-stewards': 'areaStewards',
      };
      const field = fieldMap[match[1]] || match[1];
      const values = match[2].split(',').map(v => v.trim());
      return { key: field, value: values };
    }
  },

  // Create horizon reference extractors dynamically
  ...[
    { pattern: 'areas-references', key: 'areasReferences' },
    { pattern: 'goals-references', key: 'goalsReferences' },
    { pattern: 'vision-references', key: 'visionReferences' },
    { pattern: 'purpose-references', key: 'purposeReferences' },
    { pattern: 'projects-references', key: 'projectsReferences' },
    { pattern: 'references', key: 'references' }
  ].map(({ pattern, key }) => ({
    pattern: new RegExp(`\\[!${pattern}:(.*?)\\]`, 'gs'),
    extract: (match: RegExpMatchArray) => {
      if (!match[1]) return { key, value: [] };
      return { key, value: parseReferenceList(match[1]) };
    }
  })),
  
  // H1 title extraction
  {
    pattern: /^#\s+(.+)$/m,
    extract: (match) => ({ key: 'title', value: match[1].trim() })
  },
  
  // Focus date: Focus: YYYY-MM-DD or Focus Date: YYYY-MM-DD
  {
    pattern: /Focus(?:\s+Date)?:\s*(\d{4}-\d{2}-\d{2})/i,
    extract: (match) => ({ key: 'focusDate', value: match[1] })
  },
  
  // Due date: Due: YYYY-MM-DD or Due Date: YYYY-MM-DD
  {
    pattern: /Due(?:\s+Date)?:\s*(\d{4}-\d{2}-\d{2})/i,
    extract: (match) => ({ key: 'dueDate', value: match[1] })
  }
];

/**
 * Registry for custom extractors and a Set to ensure deduplication.
 * Seed the Set with the default extractor patterns so callers cannot
 * re-register an equivalent extractor.
 */
const CUSTOM_EXTRACTORS: MetadataExtractor[] = [];
const REGISTERED_EXTRACTOR_KEYS: Set<string> = new Set(
  DEFAULT_EXTRACTORS.map((e) => e.pattern.toString())
);

/**
 * Get the complete ordered list of extractors.
 * Defaults first, then custom extractors in registration order.
 */
export function getAllExtractors(): MetadataExtractor[] {
  return [...DEFAULT_EXTRACTORS, ...CUSTOM_EXTRACTORS];
}

/**
 * Extract metadata from markdown content
 * @param content - The markdown content to parse
 * @param extractors - Optional extractors list (defaults to the merged registry via getAllExtractors)
 * @returns Extracted metadata object
 */
export function extractMetadata(
  content: string,
  extractors: MetadataExtractor[] = getAllExtractors()
): FileMetadata {
  const metadata: FileMetadata = {};
  
  for (const extractor of extractors) {
    const regex = new RegExp(extractor.pattern);
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const extracted = extractor.extract(match);
      if (!extracted) {
        if (!regex.global) {
          break;
        }
        continue;
      }
      const { key, value } = extracted;
      
      // Handle multiple values for the same key
      const existingValue = metadata[key];
      if (existingValue !== undefined) {
        if (Array.isArray(existingValue)) {
          const valuesToAppend = Array.isArray(value) ? value : [value];
          existingValue.push(...valuesToAppend);
        } else if (Array.isArray(value)) {
          metadata[key] = [existingValue, ...value];
        } else {
          // For single values, last one wins
          metadata[key] = value;
        }
      } else {
        metadata[key] = value;
      }
      
      // Break for non-global patterns
      if (!regex.global) {
        break;
      }
    }
  }
  
  return metadata;
}

/**
 * Compare two metadata objects and return what changed
 * @param oldMetadata - Previous metadata
 * @param newMetadata - New metadata
 * @returns Object containing only changed fields
 */
export function getMetadataChanges(
  oldMetadata: FileMetadata,
  newMetadata: FileMetadata
): Partial<FileMetadata> {
  const changes: Partial<FileMetadata> = {};
  
  // Check for new or changed fields
  for (const key in newMetadata) {
    const oldValue = oldMetadata[key];
    const newValue = newMetadata[key];
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = newValue;
    }
  }
  
  // Check for removed fields
  for (const key in oldMetadata) {
    if (!(key in newMetadata)) {
      changes[key] = undefined;
    }
  }
  
  return changes;
}

/**
 * Extract project status from README content
 */
export function extractProjectStatus(content: string): string {
  const metadata = extractMetadata(content);
  // Handle both projectStatus and status fields
  return metadata.projectStatus || metadata.status || 'in-progress';
}

/**
 * Extract horizon references from content
 */
export function extractHorizonReferences(content: string): {
  areas: string[];
  goals: string[];
  vision: string[];
  purpose: string[];
  projects: string[];
  references: string[];
} {
  const metadata = extractMetadata(content);
  
  return {
    areas: Array.isArray(metadata.areasReferences) ? metadata.areasReferences : [],
    goals: Array.isArray(metadata.goalsReferences) ? metadata.goalsReferences : [],
    vision: Array.isArray(metadata.visionReferences) ? metadata.visionReferences : [],
    purpose: Array.isArray(metadata.purposeReferences) ? metadata.purposeReferences : [],
    projects: Array.isArray(metadata.projectsReferences) ? metadata.projectsReferences : [],
    references: Array.isArray(metadata.references) ? metadata.references : []
  };
}

/**
 * Extract action status from action file content
 */
export function extractActionStatus(content: string): string {
  const metadata = extractMetadata(content);
  return metadata.status || 'in-progress';
}

/**
 * Add a custom extractor for new metadata types
 */
export function addCustomExtractor(extractor: MetadataExtractor): () => void {
  const key = extractor.pattern.toString();
  if (REGISTERED_EXTRACTOR_KEYS.has(key)) {
    throw new Error(
      `Duplicate metadata extractor pattern detected: ${key}`
    );
  }

  REGISTERED_EXTRACTOR_KEYS.add(key);
  CUSTOM_EXTRACTORS.push(extractor);

  // Return unregister/cleanup function
  return function unregister(): void {
    const index = CUSTOM_EXTRACTORS.indexOf(extractor);
    if (index !== -1) CUSTOM_EXTRACTORS.splice(index, 1);
    REGISTERED_EXTRACTOR_KEYS.delete(key);
  };
}
