/**
 * @fileoverview Google Calendar integration types
 * @author Development Team
 * @created 2025-01-23
 */

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start?: string;
  end?: string;
  location?: string;
  attendees: string[];
  meeting_link?: string;
  status: string;
  color_id?: string;
}

// Backend returns snake_case fields
export interface GoogleCalendarSyncStatus {
  is_connected: boolean;
  last_sync?: string;
  sync_in_progress: boolean;
  error?: string;
}

// Frontend uses camelCase fields
export interface SyncStatus {
  isConnected: boolean;
  lastSync?: string;
  syncInProgress: boolean;
  error?: string;
}

// Mapper function to convert from backend snake_case to frontend camelCase
export function mapGoogleCalendarSyncStatus(status: GoogleCalendarSyncStatus): SyncStatus {
  return {
    isConnected: status.is_connected,
    lastSync: status.last_sync,
    syncInProgress: status.sync_in_progress,
    error: status.error,
  };
}

// GTD task/project statuses
export type GtdTaskStatus =
  | 'in-progress'
  | 'completed'
  | 'waiting';

// Habit statuses
export type HabitStatus = 'todo' | 'completed';

// Google Calendar event statuses
export type GoogleEventStatus =
  | 'confirmed'
  | 'tentative'
  | 'cancelled';

// Google Calendar attendee response statuses
export type AttendeeResponseStatus = 
  | 'needsAction'
  | 'declined'
  | 'tentative'
  | 'accepted';

// Combined type for backward compatibility
// TODO: Refactor to use separate fields for GTD vs Google status
export type CalendarItemStatus = GtdTaskStatus | GoogleEventStatus;

export interface ExtendedCalendarItem {
  id: string;
  name: string;
  path: string;
  type: 'project' | 'action' | 'habit' | 'google-event';
  source?: 'gtd' | 'google';
  status?: CalendarItemStatus;
  dueDate?: string;
  focusDate?: string;
  endDate?: string;  // Add end date for Google events
  projectName?: string;
  frequency?: string;
  createdDateTime?: string;
  // Google Calendar specific fields
  googleEventId?: string;
  attendees?: string[];
  location?: string;
  meetingLink?: string;
  description?: string;
  colorId?: string;
}