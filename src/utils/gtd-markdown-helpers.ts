/**
 * @fileoverview Helper functions for generating GTD-specific markdown with select fields
 * @author Development Team
 * @created 2025-01-XX
 */

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
  const statusMarkup = generateSingleSelectMarkup('project-status', 'Status', 'in-progress');
  
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
  const normalizedStatus = normalizeSlug(status);
  const normalizedEffort = normalizeSlug(effort);
  
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
  
  return `# ${actionName}

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
    'Cancelled': 'completed',  // Map cancelled to completed as it's a terminal state
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