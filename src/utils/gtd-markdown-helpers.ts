/**
 * @fileoverview Helper functions for generating GTD-specific markdown with select fields
 * @author Development Team
 * @created 2025-01-XX
 */

/**
 * Generates HTML markup for a multiselect field that BlockNote can parse
 */
export function generateMultiSelectMarkup(
  type: 'status' | 'effort' | 'project-status',
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
  
  // Return HTML that BlockNote will parse into a multiselect block
  return `<div data-multiselect='${data}' class="multiselect-block">${label}: ${value.join(', ') || `[No ${type} selected]`}</div>`;
}

/**
 * Generates HTML markup for a single select field that BlockNote can parse
 */
export function generateSingleSelectMarkup(
  type: 'status' | 'effort' | 'project-status',
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
  
  // Return HTML that BlockNote will parse into a single select block
  return `<div data-singleselect='${data}' class="singleselect-block">${label}: ${value || `[No ${type} selected]`}</div>`;
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
Created: ${createdDateTime}`;
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
  const statusMarkup = generateSingleSelectMarkup('status', 'Status', status.toLowerCase().replace(' ', '-'));
  const effortMarkup = generateSingleSelectMarkup('effort', 'Effort', effort.toLowerCase());
  
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
Created: ${createdDateTime}`;
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
    'Complete': 'complete',
    'Active': 'in-progress',  // Map old project status to new
    'Planning': 'in-progress',
    'On Hold': 'waiting',
    'Completed': 'completed',
    'Cancelled': 'completed',  // Map cancelled to completed
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