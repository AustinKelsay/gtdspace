/**
 * @fileoverview Date formatting utilities with proper timezone handling
 */

/**
 * Format a date string as a relative date (Today, Tomorrow, etc.)
 * Handles timezone issues by comparing dates at start of day
 */
// Parse a date string using local calendar day semantics.
// - 'YYYY-MM-DD' -> new Date(year, monthIndex, day) at local midnight
// - ISO datetime (contains 'T') -> new Date(dateString)
// - Fallback: new Date(dateString)
export const parseLocalDate = (dateString: string): Date => {
  const ymd = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]) - 1; // 0-based
    const day = Number(ymd[3]);
    return new Date(year, month, day);
  }
  return new Date(dateString);
};

export const startOfLocalDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isDateOverdue = (dateString?: string | null, referenceDate: Date = new Date()): boolean => {
  if (!dateString) return false;

  const date = parseLocalDate(dateString);
  if (isNaN(date.getTime())) return false;

  return startOfLocalDay(date) < startOfLocalDay(referenceDate);
};

export const isDateToday = (dateString?: string | null, referenceDate: Date = new Date()): boolean => {
  if (!dateString) return false;

  const date = parseLocalDate(dateString);
  if (isNaN(date.getTime())) return false;

  return startOfLocalDay(date).getTime() === startOfLocalDay(referenceDate).getTime();
};

export const formatRelativeDate = (dateString?: string | null): string | null => {
  if (!dateString) return null;
  
  const date = parseLocalDate(dateString);
  if (isNaN(date.getTime())) return null;
  
  const nowStart = startOfLocalDay(new Date());
  const dateStart = startOfLocalDay(date);
  const diffDays = Math.floor((dateStart.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24));
  
  // Return relative formatting
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) {
    const n = Math.abs(diffDays);
    return `${n} day${n === 1 ? '' : 's'} overdue`;
  }
  if (diffDays > 1 && diffDays < 7) return `in ${diffDays} days`;
  
  // For dates further out, return formatted date
  return date.toLocaleDateString();
};

/**
 * Format a date for compact display (used in projects)
 */
export const formatCompactDate = (dateString?: string | null): string | null => {
  if (!dateString) return null;
  
  const date = parseLocalDate(dateString);
  if (isNaN(date.getTime())) return null;
  
  const nowStart = startOfLocalDay(new Date());
  const dateStart = startOfLocalDay(date);
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
  
  const date = parseLocalDate(timeString);
  if (isNaN(date.getTime())) return 'Never';
  
  const nowStart = startOfLocalDay(new Date());
  const dateStart = startOfLocalDay(date);
  const diffDays = Math.floor((nowStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  
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
  const date = parseLocalDate(dateString);
  if (isNaN(date.getTime())) return false;
  
  const dateStart = startOfLocalDay(date);
  const rangeStart = startOfLocalDay(startDate);
  const rangeEnd = startOfLocalDay(endDate);
  
  return dateStart >= rangeStart && dateStart <= rangeEnd;
};
