/**
 * @fileoverview Date formatting utilities with proper timezone handling
 */

/**
 * Format a date string as a relative date (Today, Tomorrow, etc.)
 * Handles timezone issues by comparing dates at start of day
 */
export const formatRelativeDate = (dateString?: string | null): string | null => {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  
  const now = new Date();
  
  // Reset times to start of day (midnight) for accurate day comparison
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((dateStart.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24));
  
  // Return relative formatting
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
  
  // For dates further out, return formatted date
  return date.toLocaleDateString();
};

/**
 * Format a date for compact display (used in projects)
 */
export const formatCompactDate = (dateString?: string | null): string | null => {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  
  const now = new Date();
  
  // Reset times to start of day for accurate day comparison
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((dateStart.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays < 7) return `${diffDays}d`;
  
  // Return month and day for dates further out
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Format a past date as relative time (e.g., "2 days ago")
 */
export const formatRelativeTime = (timeString?: string): string => {
  if (!timeString) return 'Never';
  
  const date = new Date(timeString);
  if (isNaN(date.getTime())) return 'Never';
  
  const now = new Date();
  
  // Reset times to start of day for accurate day comparison
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((nowStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString();
};

/**
 * Get a date that is N days from now
 * Properly handles timezone by working with date components
 */
export const getDateFromNow = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

/**
 * Check if a date is within a range (inclusive)
 * Compares dates at start of day to avoid timezone issues
 */
export const isDateInRange = (dateString: string, startDate: Date, endDate: Date): boolean => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  
  // Reset all dates to start of day
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const rangeStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const rangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  return dateStart >= rangeStart && dateStart <= rangeEnd;
};