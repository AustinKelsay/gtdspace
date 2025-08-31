/**
 * @fileoverview Hook for aggregating all dated GTD items for calendar view
 * @author Development Team
 * @created 2025-01-17
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { GTDSpace, MarkdownFile } from '@/types';
import { migrateMarkdownContent, needsMigration } from '@/utils/data-migration';

export interface CalendarItem {
  id: string;
  name: string;
  path: string;
  type: 'project' | 'action' | 'habit' | 'google-event';
  source?: 'gtd' | 'google';
  status?: string;
  due_date?: string;
  focus_date?: string;
  end_date?: string; // For Google events
  projectName?: string;
  frequency?: string; // For habits
  createdDateTime?: string; // For habits
  effort?: string; // For actions
  // Google Calendar specific fields
  googleEventId?: string;
  attendees?: string[];
  location?: string;
  meetingLink?: string;
  description?: string;
  colorId?: string;
}

interface UseCalendarDataReturn {
  items: CalendarItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

// Google Calendar event payload as received from the Tauri backend/local cache
// Kept at top-level to avoid re-declaration on every render of the hook
interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  location?: string;
  meeting_link?: string;
  meetingLink?: string;
  attendees?: string[];
  status?: string;
  color_id?: string;
  colorId?: string;
}

// Pre-compile regex patterns for better performance
const DATETIME_REGEX_CACHE = new Map<string, RegExp>();
const SINGLESELECT_REGEX_CACHE = new Map<string, RegExp>();
const CHECKBOX_REGEX_CACHE = new Map<string, RegExp>();

// Get or create regex for datetime field
const getDateTimeRegex = (fieldName: string): RegExp => {
  if (!DATETIME_REGEX_CACHE.has(fieldName)) {
    DATETIME_REGEX_CACHE.set(fieldName, new RegExp(`\\[!datetime:${fieldName}:([^\\]]+)\\]`, 'i'));
  }
  return DATETIME_REGEX_CACHE.get(fieldName)!;
};

// Get or create regex for single select field
const getSingleSelectRegex = (fieldName: string): RegExp => {
  if (!SINGLESELECT_REGEX_CACHE.has(fieldName)) {
    SINGLESELECT_REGEX_CACHE.set(fieldName, new RegExp(`\\[!singleselect:${fieldName}:([^\\]]+)\\]`, 'i'));
  }
  return SINGLESELECT_REGEX_CACHE.get(fieldName)!;
};

// Get or create regex for checkbox field
const getCheckboxRegex = (fieldName: string): RegExp => {
  if (!CHECKBOX_REGEX_CACHE.has(fieldName)) {
    CHECKBOX_REGEX_CACHE.set(fieldName, new RegExp(`\\[!checkbox:${fieldName}:(true|false)\\]`, 'i'));
  }
  return CHECKBOX_REGEX_CACHE.get(fieldName)!;
};

// Parse datetime field from markdown content
const parseDateTimeField = (content: string, fieldName: string): string | undefined => {
  const regex = getDateTimeRegex(fieldName);
  const match = content.match(regex);
  if (!match || !match[1] || match[1].trim() === '') return undefined;
  return match[1];
};

// Parse single select field from markdown content
const parseSingleSelectField = (content: string, fieldName: string): string | undefined => {
  const regex = getSingleSelectRegex(fieldName);
  const match = content.match(regex);
  if (!match || !match[1] || match[1].trim() === '') return undefined;
  return match[1];
};

// Parse checkbox field from markdown content
const parseCheckboxField = (content: string, fieldName: string): boolean => {
  const regex = getCheckboxRegex(fieldName);
  const match = content.match(regex);
  return match ? match[1] === 'true' : false;
};

// Helper function to convert file.last_modified to ISO string
const fileLastModifiedToISO = (lastModified: number | undefined, habitName: string): string => {
  if (typeof lastModified === 'number' && Number.isFinite(lastModified)) {
    // Detect if file.last_modified is in seconds or milliseconds
    // TODO: Standardize all MarkdownFile.last_modified producers to emit seconds consistently
    const timestamp = lastModified >= 1e12 ? lastModified : lastModified * 1000;
    return new Date(timestamp).toISOString();
  } else {
    console.warn(`[CalendarData] Invalid file.last_modified for habit ` + `"` + `${habitName}` + `"` + `, using current time`);
    return new Date().toISOString();
  }
};

export const useCalendarData = (
  spacePath: string, 
  gtdSpace?: GTDSpace | null,
  files?: MarkdownFile[]
): UseCalendarDataReturn => {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);

  // Listen for Google Calendar sync events
  useEffect(() => {
    // Listen for custom window events from settings
    const handleGoogleCalendarSync = (event: CustomEvent) => {
      console.log('[CalendarData] Received Google Calendar sync event from window:', event.detail);
      if (Array.isArray(event.detail)) {
        setGoogleEvents(event.detail);
      }
    };
    
    window.addEventListener('google-calendar-synced', handleGoogleCalendarSync as EventListener);

    // Load cached Google events from localStorage
    console.log('[CalendarData] Attempting to load cached Google events...');
    const storedEvents = localStorage.getItem('google-calendar-events');
    if (storedEvents) {
      try {
        const events = JSON.parse(storedEvents);
        console.log('[CalendarData] Loaded', events.length, 'Google events from localStorage');
        setGoogleEvents(events);
      } catch (error) {
        console.error('[CalendarData] Failed to parse stored events:', error);
      }
    }

    return () => {
      window.removeEventListener('google-calendar-synced', handleGoogleCalendarSync as EventListener);
    };
  }, []);

  const loadAllCalendarItems = useCallback(async () => {
    if (!spacePath) {
      console.log('[CalendarData] No space path provided');
      return;
    }

    setIsLoading(true);
    setError(null);
    const allItems: CalendarItem[] = [];

    try {
      console.log('[CalendarData] Starting comprehensive calendar data load...');
      
      // 1. Load all project README files directly
      if (files) {
        for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
          const file = files[fileIndex];
          // Check if it's a project README
          if (file.path.includes('/Projects/') && file.path.endsWith('README.md')) {
            try {
              let content = await invoke<string>('read_file', { path: file.path });
              
              // Apply migrations in-memory only (don't auto-save to avoid file churn)
              if (needsMigration(content)) {
                content = migrateMarkdownContent(content);
                // Note: Migration is applied for display only, not saved to disk
              }
              
              const projectName = file.path.split('/Projects/')[1]?.split('/')[0] || '';
              
              // Parse dates from project README
              const dueDate = parseDateTimeField(content, 'due_date');
              const status = parseSingleSelectField(content, 'project-status') || 'in-progress';
              
              console.log(`[CalendarData] Project ${projectName}: due_date=${dueDate}`);
              
              if (dueDate) {
                allItems.push({
                  id: `project-${projectName}-${fileIndex}`,
                  name: projectName,
                  path: file.path,
                  type: 'project',
                  status: status,
                  due_date: dueDate,
                  focus_date: undefined,
                  projectName: undefined
                });
              }
            } catch (err) {
              console.error(`[CalendarData] Failed to read project ${file.path}:`, err);
            }
          }
          
          // Check if it's an action file (in Projects but not README)
          if (file.path.includes('/Projects/') && !file.path.includes('README') && file.path.endsWith('.md')) {
            try {
              let content = await invoke<string>('read_file', { path: file.path });
              
              // Apply migrations in-memory only (don't auto-save to avoid file churn)
              if (needsMigration(content)) {
                content = migrateMarkdownContent(content);
                // Note: Migration is applied for display only, not saved to disk
              }
              
              const pathParts = file.path.split('/');
              const projectName = file.path.split('/Projects/')[1]?.split('/')[0] || '';
              const actionName = pathParts[pathParts.length - 1].replace('.md', '');
              
              // Parse focus date field (can include time)
              // Try both field names for backward compatibility
              const focusDate = parseDateTimeField(content, 'focus_date') || 
                                parseDateTimeField(content, 'focus_date_time');
              const dueDate = parseDateTimeField(content, 'due_date');
              const status = parseSingleSelectField(content, 'status') || 'in-progress';
              const effort = parseSingleSelectField(content, 'effort');
              
              const finalFocusDate = focusDate;
              
              console.log(`[CalendarData] Action ${actionName}: focus=${finalFocusDate}, due=${dueDate}, effort=${effort}`);
              
              if (finalFocusDate || dueDate) {
                allItems.push({
                  id: `action-${projectName}-${actionName}-${fileIndex}`,
                  name: actionName,
                  path: file.path,
                  type: 'action',
                  status: status,
                  due_date: dueDate,
                  focus_date: finalFocusDate,
                  projectName: projectName,
                  effort: effort
                });
              }
            } catch (err) {
              console.error(`[CalendarData] Failed to read action ${file.path}:`, err);
            }
          }
          
          // Check if it's a habit file
          if (file.path.includes('/Habits/') && file.path.endsWith('.md')) {
            try {
              let content = await invoke<string>('read_file', { path: file.path });
              
              // Apply migrations in-memory only (don't auto-save to avoid file churn)
              if (needsMigration(content)) {
                content = migrateMarkdownContent(content);
                // Note: Migration is applied for display only, not saved to disk
              }
              
              const habitName = file.path.split('/').pop()?.replace('.md', '') || '';
              
              // Parse habit fields
              const habitStatus = parseCheckboxField(content, 'habit-status') ? 'completed' : 'todo';
              const frequency = parseSingleSelectField(content, 'habit-frequency') || 'daily';
              
              // Parse focus date for the habit (can include time)
              const focusDate = parseDateTimeField(content, 'focus_date');
              
              // Parse created date using the existing DateTime parser
              let createdDateTime: string | undefined;
              const createdDateTimeRaw = parseDateTimeField(content, 'created_date_time');
              if (createdDateTimeRaw) {
                // Parse and normalize to ISO format
                try {
                  let parsed: Date;
                  
                  // Check if it's a numeric timestamp
                  const timestamp = Number(createdDateTimeRaw);
                  if (!isNaN(timestamp) && /^\d+$/.test(createdDateTimeRaw)) {
                    // Only treat as timestamp if it's exactly 10 or 13 digits
                    const digitCount = createdDateTimeRaw.length;
                    if (digitCount === 10) {
                      // Unix timestamp in seconds
                      parsed = new Date(timestamp * 1000);
                    } else if (digitCount === 13) {
                      // Unix timestamp in milliseconds
                      parsed = new Date(timestamp);
                    } else {
                      // Not a standard timestamp format, parse as date string
                      parsed = new Date(createdDateTimeRaw);
                    }
                  } else {
                    // Parse as date string
                    parsed = new Date(createdDateTimeRaw);
                  }
                    
                  if (!isNaN(parsed.getTime())) {
                    createdDateTime = parsed.toISOString();
                  } else {
                    // Invalid date - log warning and use file.last_modified
                    console.warn(`[CalendarData] Invalid created_date_time value in habit "${habitName}": "${createdDateTimeRaw}" - using file.last_modified`);
                    createdDateTime = fileLastModifiedToISO(file.last_modified, habitName);
                  }
                } catch (error) {
                  // Parsing threw an error - use file.last_modified
                  console.warn(`[CalendarData] Failed to parse created_date_time in habit "${habitName}": "${createdDateTimeRaw}" - ${error} - using file.last_modified`);
                  createdDateTime = fileLastModifiedToISO(file.last_modified, habitName);
                }
              } else {
                // Try to parse from ## Created header as fallback
                const createdHeaderMatch = content.match(/##\s*Created\s*\r?\n\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)?)/i);
                if (createdHeaderMatch && createdHeaderMatch[1]) {
                  try {
                    const dateStr = createdHeaderMatch[1].trim();
                    
                    // Parse date components explicitly for cross-browser consistency
                    // Format: YYYY-MM-DD [HH:MM [AM/PM]]
                    const dateTimeRegex = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i;
                    const match = dateStr.match(dateTimeRegex);
                    
                    if (!match) {
                      throw new Error('Invalid date format');
                    }
                    
                    const year = parseInt(match[1], 10);
                    const month = parseInt(match[2], 10);
                    const day = parseInt(match[3], 10);
                    let hour = match[4] ? parseInt(match[4], 10) : 0;
                    const minute = match[5] ? parseInt(match[5], 10) : 0;
                    const meridiem = match[6]?.toUpperCase();
                    
                    // Validate ranges
                    if (year < 1900 || year > 2100 || 
                        month < 1 || month > 12 || 
                        day < 1 || day > 31 ||
                        hour < 0 || hour > 23 ||
                        minute < 0 || minute > 59) {
                      throw new Error('Invalid date components');
                    }
                    
                    // Convert 12-hour to 24-hour format if AM/PM is present
                    if (meridiem) {
                      if (hour < 1 || hour > 12) {
                        throw new Error('Invalid hour for 12-hour format');
                      }
                      if (meridiem === 'PM' && hour !== 12) {
                        hour += 12;
                      } else if (meridiem === 'AM' && hour === 12) {
                        hour = 0;
                      }
                    }
                    
                    // Create date using UTC to ensure consistency
                    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
                    if (isNaN(utcDate.getTime())) {
                      throw new Error('Invalid date');
                    }
                    
                    createdDateTime = utcDate.toISOString();
                  } catch {
                    // If parsing fails, use file.last_modified
                    createdDateTime = fileLastModifiedToISO(file.last_modified, habitName);
                  }
                } else {
                  // No created date found in content, use file.last_modified
                  createdDateTime = fileLastModifiedToISO(file.last_modified, habitName);
                  if (typeof file.last_modified === 'number' && Number.isFinite(file.last_modified)) {
                    console.log(`[CalendarData] Habit ${habitName} missing created_date_time - using file.last_modified: ${createdDateTime}`);
                  }
                }
              }

              console.log(`[CalendarData] Habit ${habitName}: freq=${frequency}, created=${createdDateTime}, focus=${focusDate}`);
              
              // Always add habits now that we have fallback to file.last_modified
              allItems.push({
                id: `habit-${habitName}-${fileIndex}`,
                name: habitName,
                path: file.path,
                type: 'habit',
                status: habitStatus,
                due_date: undefined,
                focus_date: focusDate, // Can include time if specified
                projectName: undefined,
                frequency: frequency,
                createdDateTime: createdDateTime
              });
            } catch (err) {
              console.error(`[CalendarData] Failed to read habit ${file.path}:`, err);
            }
          }
        }
      }
      
      // 2. Also add project data from gtdSpace if available (as backup)
      if (gtdSpace?.projects) {
        let gtdProjectIndex = 0;
        for (const project of gtdSpace.projects) {
          if (project.due_date && !allItems.some(item => 
            item.type === 'project' && item.name === project.name
          )) {
            console.log(`[CalendarData] Adding project from gtdSpace: ${project.name}`);
            allItems.push({
              id: `project-gtd-${project.name}-${gtdProjectIndex}`,
              name: project.name,
              path: project.path,
              type: 'project',
              status: project.status || 'in-progress',
              due_date: project.due_date,
              focus_date: undefined,
              projectName: undefined
            });
            gtdProjectIndex++;
          }
        }
      }
      
      // Add Google Calendar events to the list
      console.log('[CalendarData] Adding', googleEvents.length, 'Google events to calendar');
      googleEvents.forEach((event) => {
        // Convert Google event to CalendarItem format
        const calendarItem: CalendarItem = {
          id: `google-${event.id}`,
          name: event.summary || 'Untitled Event',
          path: '', // Google events don't have a file path
          type: 'google-event',
          source: 'google',
          status: 'confirmed',
          due_date: event.end || event.start, // Use end time, fallback to start
          focus_date: event.start,
          end_date: event.end, // Add end_date for duration calculation
          googleEventId: event.id,
          attendees: event.attendees,
          location: event.location,
          meetingLink: event.meeting_link || event.meetingLink,
          description: event.description,
          colorId: event.color_id || event.colorId
        };
        console.info({
          level: 'info',
          ts: new Date().toISOString(),
          event: 'add_google_event',
          name: calendarItem.name,
          focus_date: calendarItem.focus_date,
          end_date: calendarItem.end_date,
          source: 'CalendarData'
        });
        allItems.push(calendarItem);
      });

      console.log(`[CalendarData] Loaded ${allItems.length} total calendar items`);
      console.log('[CalendarData] Items by type:', {
        projects: allItems.filter(i => i.type === 'project').length,
        actions: allItems.filter(i => i.type === 'action').length,
        habits: allItems.filter(i => i.type === 'habit').length,
        googleEvents: allItems.filter(i => i.type === 'google-event').length
      });
      
      setItems(allItems);
    } catch (err) {
      console.error('[CalendarData] Failed to load calendar data:', err);
      setError('Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  }, [spacePath, gtdSpace, files, googleEvents]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadAllCalendarItems();
  }, [loadAllCalendarItems]);

  const refresh = useCallback(() => {
    loadAllCalendarItems();
  }, [loadAllCalendarItems]);

  return {
    items,
    isLoading,
    error,
    refresh
  };
};