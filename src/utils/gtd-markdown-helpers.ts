import type {
  GTDAreaReviewCadence,
  GTDAreaStatus,
  GTDHabitFrequency,
  GTDHabitStatus,
  GTDGoalStatus,
  GTDVisionHorizon,
} from '@/types';

/**
 * @fileoverview Helper functions for generating GTD-specific markdown with select fields
 * @author Development Team
 * @created 2025-01-XX
 */

// Canonical token sets for validation
const STATUS_TOKENS = ['in-progress', 'waiting', 'completed'] as const;
const EFFORT_TOKENS = ['small', 'medium', 'large', 'extra-large'] as const;
const HABIT_FREQUENCY_TOKENS: ReadonlyArray<GTDHabitFrequency> = [
  '5-minute',
  'daily',
  'every-other-day',
  'twice-weekly',
  'weekly',
  'weekdays',
  'biweekly',
  'monthly',
] as const;
const AREA_STATUS_TOKENS: ReadonlyArray<GTDAreaStatus> = [
  'steady',
  'watch',
  'incubating',
  'delegated',
] as const;
const AREA_REVIEW_CADENCE_TOKENS: ReadonlyArray<GTDAreaReviewCadence> = [
  'weekly',
  'monthly',
  'quarterly',
  'annually',
] as const;
const GOAL_STATUS_TOKENS: ReadonlyArray<GTDGoalStatus> = [
  'in-progress',
  'waiting',
  'completed',
] as const;
const VISION_HORIZON_TOKENS: ReadonlyArray<GTDVisionHorizon> = [
  '3-years',
  '5-years',
  '10-years',
  'custom',
] as const;

export interface HabitReferenceGroups {
  projects: string[];
  areas: string[];
  goals: string[];
  vision: string[];
  purpose: string[];
}

export type AreaReferenceGroups = HabitReferenceGroups;

export interface GoalReferenceGroups {
  areas: string[];
  projects: string[];
  vision: string[];
  purpose: string[];
}

export interface VisionReferenceGroups {
  projects: string[];
  goals: string[];
  areas: string[];
  purpose: string[];
}

export const DEFAULT_HABIT_HISTORY_BODY =
  '*Track your habit completions below:*\n\n| Date | Time | Status | Action | Details |\n| --- | --- | --- | --- | --- |';

export const DEFAULT_AREA_DESCRIPTION =
  '*Summarize the scope, responsibilities, and commitments for this area.*';

export const DEFAULT_GOAL_DESCRIPTION =
  '*Describe the desired outcome, success criteria, and why this goal matters.*';

export const DEFAULT_VISION_NARRATIVE =
  '*Describe the vivid picture of your desired future state and the key themes you want to realize.*';

/**
 * Escapes special characters for safe inclusion in HTML attributes
 * @param str - The string to escape
 * @returns Escaped string safe for HTML attributes
 */
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes special characters for safe inclusion in HTML text content
 * @param str - The string to escape
 * @returns Escaped string safe for HTML text
 */
function escapeHtmlText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Normalizes a string into a slug format (lowercase, hyphenated)
 * @param str - The string to normalize
 * @returns Normalized slug string
 */
function normalizeSlug(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, '-');
}

/**
 * Escapes angle brackets for safe inclusion in plain Markdown text
 * @param str - The string to escape
 * @returns Escaped string safe for Markdown
 */
function escapePlain(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes special characters for safe inclusion in Markdown inline text
 * This prevents headings/formatting from breaking when interpolating user-provided text
 * @param str - The string to escape
 * @returns Escaped string safe for Markdown inline contexts
 */
function escapeMarkdownInline(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\|/g, '\\|')
    .replace(/#/g, '\\#');
}

function encodeReferenceArray(values?: string[]): string {
  const normalized = (values ?? [])
    .map((ref) => ref.trim())
    .filter(Boolean)
    .map((ref) => ref.replace(/\\/g, '/'));

  if (normalized.length === 0) {
    return '';
  }

  try {
    return encodeURIComponent(JSON.stringify(normalized));
  } catch {
    return encodeURIComponent(normalized.join(','));
  }
}

/**
 * Generates HTML markup for a multiselect field that BlockNote can parse
 */
export function generateMultiSelectMarkup(
  type: 'tags' | 'contexts' | 'categories' | 'custom',
  label: string,
  value: string[],
  options?: { placeholder?: string; maxCount?: number }
): string {
  const data = JSON.stringify({
    type,
    value,
    label,
    placeholder: options?.placeholder,
    maxCount: options?.maxCount,
  });
  
  // Safely escape values for HTML
  const escapedData = escapeHtmlAttr(data);
  const escapedLabel = escapeHtmlText(label);
  const escapedValues = value.map(v => escapeHtmlText(v)).join(', ');
  const escapedType = escapeHtmlText(type);
  
  // Return HTML that BlockNote will parse into a multiselect block
  return `<div data-multiselect='${escapedData}' class="multiselect-block">${escapedLabel}: ${escapedValues || `[No ${escapedType} selected]`}</div>`;
}

/**
 * Generates HTML markup for a single select field that BlockNote can parse
 */
export function generateSingleSelectMarkup(
  type: 'status' | 'effort' | 'project-status' | 'habit-frequency' | 'habit-status',
  label: string,
  value: string,
  options?: { placeholder?: string }
): string {
  const data = JSON.stringify({
    type,
    value,
    label,
    placeholder: options?.placeholder,
  });
  
  // Safely escape values for HTML
  const escapedData = escapeHtmlAttr(data);
  const escapedLabel = escapeHtmlText(label);
  const escapedValue = escapeHtmlText(value);
  const escapedType = escapeHtmlText(type);
  
  // Return HTML that BlockNote will parse into a single select block
  return `<div data-singleselect='${escapedData}' class="singleselect-block">${escapedLabel}: ${escapedValue || `[No ${escapedType} selected]`}</div>`;
}

/**
 * Helper to generate project README with single select fields
 */
export function generateProjectReadmeWithSingleSelect(
  projectName: string,
  description: string,
  dueDate: string | null,
  createdDateTime: string
): string {
  // Always use valid default for project status
  const validStatus = 'in-progress'; // Already a valid token from PROJECT_STATUS_TOKENS
  const statusMarkup = generateSingleSelectMarkup('project-status', 'Status', validStatus);
  
  // Escape createdDateTime to prevent angle bracket injection
  const escapedCreatedDateTime = escapePlain(createdDateTime);
  
  return `# ${projectName}

## Description
${description}

## Due Date
${dueDate || 'Not set'}

${statusMarkup}

## Actions
Actions for this project are stored as individual markdown files in this directory.

### Action Template
Each action file contains:
- **Status**: Single select field for tracking progress
- **Focus Date**: When to work on this action
- **Due Date**: Optional deadline
- **Effort**: Single select field for time estimate

---
Created: ${escapedCreatedDateTime}`;
}

/**
 * Legacy helper - redirects to new single select version
 */
export function generateProjectReadmeWithMultiSelect(
  projectName: string,
  description: string,
  dueDate: string | null,
  createdDateTime: string
): string {
  return generateProjectReadmeWithSingleSelect(projectName, description, dueDate, createdDateTime);
}

/**
 * Helper to generate action file with single select fields
 */
export function generateActionFileWithSingleSelect(
  actionName: string,
  status: string,
  focusDate: string | null,
  dueDate: string | null,
  effort: string,
  createdDateTime: string
): string {
  // Properly normalize status and effort slugs using the normalizeSlug function
  let normalizedStatus = normalizeSlug(status);
  let normalizedEffort = normalizeSlug(effort);
  
  // Validate normalized values against canonical token sets
  if (!STATUS_TOKENS.includes(normalizedStatus as typeof STATUS_TOKENS[number])) {
    normalizedStatus = 'in-progress'; // Default to in-progress if invalid
  }
  if (!EFFORT_TOKENS.includes(normalizedEffort as typeof EFFORT_TOKENS[number])) {
    normalizedEffort = 'medium'; // Default to medium if invalid
  }
  
  const statusMarkup = generateSingleSelectMarkup('status', 'Status', normalizedStatus);
  const effortMarkup = generateSingleSelectMarkup('effort', 'Effort', normalizedEffort);
  
  // Format focus date for display
  let focusDateDisplay = 'Not set';
  if (focusDate) {
    // Parse ISO datetime and format for display
    if (focusDate.includes('T')) {
      try {
        const date = new Date(focusDate);
        focusDateDisplay = date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'numeric', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      } catch {
        focusDateDisplay = focusDate;
      }
    } else {
      focusDateDisplay = focusDate;
    }
  }
  
  // Escape createdDateTime to prevent angle bracket injection
  const escapedCreatedDateTime = escapePlain(createdDateTime);
  // Escape actionName for safe Markdown embedding
  const escapedActionName = escapeMarkdownInline(actionName);
  
  return `# ${escapedActionName}

${statusMarkup}

## Focus Date
${focusDateDisplay}

## Due Date
${dueDate || 'Not set'}

${effortMarkup}

## Notes
<!-- Add any additional notes or details about this action here -->

---
Created: ${escapedCreatedDateTime}`;
}

/**
 * Legacy helper - redirects to new single select version
 */
export function generateActionFileWithMultiSelect(
  actionName: string,
  status: string,
  focusDate: string | null,
  dueDate: string | null,
  effort: string,
  createdDateTime: string
): string {
  return generateActionFileWithSingleSelect(actionName, status, focusDate, dueDate, effort, createdDateTime);
}

/**
 * Maps legacy status values to new multiselect values
 */
export function mapLegacyStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Not Started': 'in-progress',  // Map old "Not Started" to new default "in-progress"
    'In Progress': 'in-progress',
    'Waiting': 'waiting',
    'Completed': 'completed',
    'Active': 'in-progress',  // Map old project status to new
    'Planning': 'in-progress',
    'On Hold': 'waiting',
    'Cancelled': 'cancelled',  // Keep cancelled as its own status
    'Canceled': 'cancelled',  // Map US spelling to UK spelling
  };
  
  return statusMap[status] || status.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Maps legacy effort values to new multiselect values
 */
export function mapLegacyEffort(effort: string): string {
  const effortMap: Record<string, string> = {
    'Small': 'small',
    'Medium': 'medium',
    'Large': 'large',
  };
  
  return effortMap[effort] || effort.toLowerCase();
}

/**
 * Builds canonical markdown for a habit file with standardized ordering.
 */
export function buildHabitMarkdown({
  title,
  status,
  frequency,
  focusDateTime,
  references,
  createdDateTime,
  notes,
  history,
}: {
  title: string;
  status: GTDHabitStatus;
  frequency: GTDHabitFrequency;
  focusDateTime?: string | null;
  references: HabitReferenceGroups;
  createdDateTime: string;
  notes?: string;
  history: string;
}): string {
  const parts: string[] = [];

  const safeTitle = title?.trim() || 'Untitled';
  const normalizedStatus = status === 'completed' ? 'true' : 'false';
  const normalizedFrequency = HABIT_FREQUENCY_TOKENS.includes(frequency) ? frequency : 'daily';

  parts.push(`# ${safeTitle}`);

  parts.push('\n\n## Status\n');
  parts.push(`[!checkbox:habit-status:${normalizedStatus}]\n`);

  parts.push('\n\n## Frequency\n');
  parts.push(`[!singleselect:habit-frequency:${normalizedFrequency}]\n`);

  const focusValue = focusDateTime?.trim() ?? '';
  if (focusValue.length > 0) {
    parts.push('\n\n## Focus Date\n');
    parts.push(`[!datetime:focus_date:${focusValue}]\n`);
  }

  parts.push('\n\n## Projects References\n');
  parts.push(`[!projects-references:${encodeReferenceArray(references.projects)}]\n`);

  parts.push('\n\n## Areas References\n');
  parts.push(`[!areas-references:${encodeReferenceArray(references.areas)}]\n`);

  parts.push('\n\n## Goals References\n');
  parts.push(`[!goals-references:${encodeReferenceArray(references.goals)}]\n`);

  parts.push('\n\n## Vision References\n');
  parts.push(`[!vision-references:${encodeReferenceArray(references.vision)}]\n`);

  parts.push('\n\n## Purpose & Principles References\n');
  parts.push(`[!purpose-references:${encodeReferenceArray(references.purpose)}]\n`);

  parts.push('\n\n## Created\n');
  parts.push(`[!datetime:created_date_time:${createdDateTime}]\n`);

  const cleanNotes = notes?.trim() ?? '';
  if (cleanNotes.length > 0) {
    parts.push('\n\n## Notes\n');
    parts.push(`${cleanNotes.replace(/\s+$/g, '')}\n`);
  }

  const historyBody = history?.trim().length ? history.trim() : DEFAULT_HABIT_HISTORY_BODY;
  parts.push('\n\n## History\n');
  parts.push(`${historyBody.replace(/\s+$/g, '')}\n`);

  return `${parts.join('').trimEnd()}\n`;
}

/**
 * Builds canonical markdown for an Area of Focus file with standardized ordering.
 */
export function buildAreaMarkdown({
  title,
  status,
  reviewCadence,
  references,
  createdDateTime,
  description,
}: {
  title: string;
  status: GTDAreaStatus;
  reviewCadence: GTDAreaReviewCadence;
  references: AreaReferenceGroups;
  createdDateTime: string;
  description?: string;
}): string {
  const safeTitle = title?.trim() || 'Untitled Area';
  const normalizedStatus = AREA_STATUS_TOKENS.includes(status) ? status : 'steady';
  const normalizedCadence = AREA_REVIEW_CADENCE_TOKENS.includes(reviewCadence)
    ? reviewCadence
    : 'monthly';

  const parts: string[] = [];
  parts.push(`# ${safeTitle}`);

  parts.push('\n\n## Status\n');
  parts.push(`[!singleselect:area-status:${normalizedStatus}]\n`);

  parts.push('\n\n## Review Cadence\n');
  parts.push(`[!singleselect:area-review-cadence:${normalizedCadence}]\n`);

  parts.push('\n\n## Projects References\n');
  parts.push(`[!projects-references:${encodeReferenceArray(references.projects)}]\n`);

  const encodedAreas = encodeReferenceArray(references.areas);
  if (encodedAreas) {
    parts.push('\n\n## Areas References (optional)\n');
    parts.push(`[!areas-references:${encodedAreas}]\n`);
  }

  parts.push('\n\n## Goals References\n');
  parts.push(`[!goals-references:${encodeReferenceArray(references.goals)}]\n`);

  const encodedVision = encodeReferenceArray(references.vision);
  if (encodedVision) {
    parts.push('\n\n## Vision References (optional)\n');
    parts.push(`[!vision-references:${encodedVision}]\n`);
  }

  const encodedPurpose = encodeReferenceArray(references.purpose);
  if (encodedPurpose) {
    parts.push('\n\n## Purpose & Principles References (optional)\n');
    parts.push(`[!purpose-references:${encodedPurpose}]\n`);
  }

  parts.push('\n\n## Created\n');
  parts.push(`[!datetime:created_date_time:${createdDateTime}]\n`);

  const cleanDescription = (description ?? '').trim();
  parts.push('\n\n## Description\n');
  parts.push(
    `${(cleanDescription.length > 0 ? cleanDescription : DEFAULT_AREA_DESCRIPTION).replace(/\s+$/g, '')}\n`
  );

  return `${parts.join('').trimEnd()}\n`;
}

/**
 * Builds canonical markdown for a Goal file with standardized ordering.
 */
export function buildGoalMarkdown({
  title,
  status,
  targetDate,
  references,
  createdDateTime,
  description,
}: {
  title: string;
  status: GTDGoalStatus;
  targetDate?: string | null;
  references: GoalReferenceGroups;
  createdDateTime: string;
  description?: string;
}): string {
  const safeTitle = title?.trim() || 'Untitled Goal';
  const normalizedStatus = GOAL_STATUS_TOKENS.includes(status) ? status : 'in-progress';
  const targetDateValue = targetDate?.trim() ?? '';

  const parts: string[] = [];
  parts.push(`# ${safeTitle}`);

  parts.push('\n\n## Status\n');
  parts.push(`[!singleselect:goal-status:${normalizedStatus}]\n`);

  const hasTargetDate = targetDateValue.length > 0;
  if (hasTargetDate) {
    parts.push('\n\n## Target Date (optional)\n');
    parts.push(`[!datetime:goal-target-date:${targetDateValue}]\n`);
  }

  parts.push('\n\n## Projects References\n');
  parts.push(`[!projects-references:${encodeReferenceArray(references.projects)}]\n`);

  parts.push('\n\n## Areas References\n');
  parts.push(`[!areas-references:${encodeReferenceArray(references.areas)}]\n`);

  const encodedVision = encodeReferenceArray(references.vision);
  if (encodedVision) {
    parts.push('\n\n## Vision References (optional)\n');
    parts.push(`[!vision-references:${encodedVision}]\n`);
  }

  const encodedPurpose = encodeReferenceArray(references.purpose);
  if (encodedPurpose) {
    parts.push('\n\n## Purpose & Principles References (optional)\n');
    parts.push(`[!purpose-references:${encodedPurpose}]\n`);
  }

  parts.push('\n\n## Created\n');
  parts.push(`[!datetime:created_date_time:${createdDateTime}]\n`);

  const cleanDescription = (description ?? '').trim();
  parts.push('\n\n## Description\n');
  parts.push(
    `${(cleanDescription.length > 0 ? cleanDescription : DEFAULT_GOAL_DESCRIPTION).replace(/\s+$/g, '')}\n`
  );

  return `${parts.join('').trimEnd()}\n`;
}

/**
 * Builds canonical markdown for a Vision file with standardized ordering.
 */
export function buildVisionMarkdown({
  title,
  horizon,
  references,
  createdDateTime,
  narrative,
}: {
  title: string;
  horizon: GTDVisionHorizon;
  references: VisionReferenceGroups;
  createdDateTime: string;
  narrative?: string;
}): string {
  const safeTitle = title?.trim() || 'Untitled Vision';
  const normalizedHorizon = VISION_HORIZON_TOKENS.includes(horizon) ? horizon : '3-years';

  const parts: string[] = [];
  parts.push(`# ${safeTitle}`);

  parts.push('\n\n## Horizon\n');
  parts.push(`[!singleselect:vision-horizon:${normalizedHorizon}]\n`);

  parts.push('\n\n## Projects References\n');
  parts.push(`[!projects-references:${encodeReferenceArray(references.projects ?? [])}]\n`);

  parts.push('\n\n## Goals References\n');
  parts.push(`[!goals-references:${encodeReferenceArray(references.goals ?? [])}]\n`);

  parts.push('\n\n## Areas References\n');
  parts.push(`[!areas-references:${encodeReferenceArray(references.areas ?? [])}]\n`);

  const encodedPurpose = encodeReferenceArray(references.purpose);
  if (encodedPurpose) {
    parts.push('\n\n## Purpose & Principles References (optional)\n');
    parts.push(`[!purpose-references:${encodedPurpose}]\n`);
  }

  parts.push('\n\n## Created\n');
  parts.push(`[!datetime:created_date_time:${createdDateTime}]\n`);

  const cleanNarrative = (narrative ?? '').trim();
  parts.push('\n\n## Narrative\n');
  parts.push(
    `${(cleanNarrative.length > 0 ? cleanNarrative : DEFAULT_VISION_NARRATIVE).replace(/\s+$/g, '')}\n`
  );

  return `${parts.join('').trimEnd()}\n`;
}
