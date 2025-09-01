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

export interface GoogleCalendarSyncStatus {
  is_connected: boolean;
  last_sync?: string;
  sync_in_progress: boolean;
  error?: string;
}

export type CalendarItemStatus =
  | 'in-progress'
  | 'completed'
  | 'todo'
  | 'confirmed'
  | 'tentative'
  | 'cancelled'
  | 'needsAction';

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