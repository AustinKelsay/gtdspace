/**
 * @fileoverview Hook for aggregating all dated GTD items for calendar view
 * @author Development Team
 * @created 2025-01-17
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { GTDSpace, MarkdownFile } from '@/types';

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
              const content = await invoke<string>('read_file', { path: file.path });
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
              const content = await invoke<string>('read_file', { path: file.path });
              const pathParts = file.path.split('/');
              const projectName = file.path.split('/Projects/')[1]?.split('/')[0] || '';
              const actionName = pathParts[pathParts.length - 1].replace('.md', '');
              
              // Parse all possible date fields
              const focusDateTime = parseDateTimeField(content, 'focus_date_time');
              const focusDate = parseDateTimeField(content, 'focus_date');
              const dueDate = parseDateTimeField(content, 'due_date');
              const status = parseSingleSelectField(content, 'status') || 'in-progress';
              const effort = parseSingleSelectField(content, 'effort');
              
              const finalFocusDate = focusDateTime || focusDate;
              
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
              const content = await invoke<string>('read_file', { path: file.path });
              const habitName = file.path.split('/').pop()?.replace('.md', '') || '';
              
              // Parse habit fields
              const habitStatus = parseCheckboxField(content, 'habit-status') ? 'complete' : 'todo';
              const frequency = parseSingleSelectField(content, 'habit-frequency') || 'daily';
              
              // Parse focus time for the habit
              const focusDateTime = parseDateTimeField(content, 'focus_date_time');
              
              // Parse created date using the existing DateTime parser
              let createdDateTime: string | undefined;
              const createdDateTimeRaw = parseDateTimeField(content, 'created_date_time');
              if (createdDateTimeRaw) {
                // Parse and normalize to ISO format
                try {
                  const parsed = new Date(createdDateTimeRaw);
                  if (!isNaN(parsed.getTime())) {
                    createdDateTime = parsed.toISOString();
                  } else {
                    // Invalid date - log warning and leave undefined
                    console.warn(`[CalendarData] Invalid created_date_time value in habit "${habitName}": "${createdDateTimeRaw}" - skipping`);
                    createdDateTime = undefined;
                  }
                } catch (error) {
                  // Parsing threw an error - log warning and leave undefined
                  console.warn(`[CalendarData] Failed to parse created_date_time in habit "${habitName}": "${createdDateTimeRaw}" - ${error}`);
                  createdDateTime = undefined;
                }
              } else {
                // Try to parse from ## Created header as fallback (handles CRLF and flexible spacing)
                const createdHeaderMatch = content.match(/##\s*Created\s*(?:\r?\n|\s+)\s*([0-9]{4}-[0-9]{2}-[0-9]{2}(?:\s+[0-9]{1,2}:[0-9]{2}(?:\s*(?:AM|PM))?)?)/i);
                if (createdHeaderMatch && createdHeaderMatch[1]) {
                  try {
                    const parsedDate = new Date(createdHeaderMatch[1]);
                    if (!isNaN(parsedDate.getTime())) {
                      createdDateTime = parsedDate.toISOString();
                    }
                  } catch {
                    // If parsing fails, leave undefined
                  }
                }
                
                // Legacy fallback: Try to parse old marker format [!datetime:created_date:YYYY-MM-DD]
                if (!createdDateTime) {
                  const legacyMatch = content.match(/\[!datetime:created_date:([0-9]{4})-([0-9]{2})-([0-9]{2})\]/i);
                  if (legacyMatch && legacyMatch[1] && legacyMatch[2] && legacyMatch[3]) {
                    try {
                      // Extract year, month, day and parse as integers to avoid timezone drift
                      const year = parseInt(legacyMatch[1], 10);
                      const month = parseInt(legacyMatch[2], 10);
                      const day = parseInt(legacyMatch[3], 10);
                      
                      // Validate the parsed integers
                      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                        // Use Date.UTC to create date in UTC (month is 0-based)
                        const parsed = new Date(Date.UTC(year, month - 1, day));
                        if (!isNaN(parsed.getTime())) {
                          createdDateTime = parsed.toISOString();
                          console.log(`[CalendarData] Found legacy created_date format in habit "${habitName}": ${legacyMatch[1]}-${legacyMatch[2]}-${legacyMatch[3]}`);
                        }
                      }
                    } catch {
                      // If parsing fails, leave undefined
                    }
                  }
                }
              }
              
              console.log(`[CalendarData] Habit ${habitName}: freq=${frequency}, created=${createdDateTime}, focus=${focusDateTime}`);
              
              // Only add the habit if we have a created date (required for recurring generation)
              if (createdDateTime) {
                allItems.push({
                  id: `habit-${habitName}-${fileIndex}`,
                  name: habitName,
                  path: file.path,
                  type: 'habit',
                  status: habitStatus,
                  due_date: undefined,
                  focus_date: focusDateTime, // Now includes the parsed focus time
                  projectName: undefined,
                  frequency: frequency,
                  createdDateTime: createdDateTime
                });
              } else {
                console.warn(`[CalendarData] Habit ${habitName} skipped - no created date found`);
              }
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
              status: project.status?.[0] || 'in-progress',
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