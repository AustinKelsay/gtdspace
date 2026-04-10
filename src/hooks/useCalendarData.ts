/**
 * @fileoverview Hook for aggregating all dated GTD items for calendar view
 * @author Development Team
 * @created 2025-01-17
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import type { GTDSpace, MarkdownFile } from '@/types';
import { migrateMarkdownContent, needsMigration } from '@/utils/data-migration';
import { onMetadataChange, onContentSaved } from '@/utils/content-event-bus';
import { parseHabitContent, toHabitPeriodHistory } from '@/utils/gtd-habit-markdown';

export interface CalendarItem {
  id: string;
  name: string;
  path: string;
  type: 'project' | 'action' | 'habit' | 'google-event';
  source?: 'gtd' | 'google';
  status?: string;
  dueDate?: string;
  focusDate?: string;
  endDate?: string; // For Google events
  projectName?: string;
  frequency?: string; // For habits
  createdDateTime?: string; // For habits
  habitPeriodHistory?: Array<{ date: string; time?: string; completed: boolean; action?: string; note?: string }>;
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
  refresh: (options?: { forceFileScan?: boolean }) => void;
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

const normalizeFsPath = (value: string | undefined | null): string =>
  (value ?? '').replace(/\\/g, '/');

const CREATED_AT_FALLBACK_WINDOW_MS = 5_000;

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

// Helper function to convert file.last_modified to ISO string
const fileLastModifiedToISO = (lastModified: number | undefined, habitName: string): string | undefined => {
  if (typeof lastModified === 'number' && Number.isFinite(lastModified)) {
    // Detect if file.last_modified is in seconds or milliseconds
    // TODO: Standardize all MarkdownFile.last_modified producers to emit seconds consistently
    const timestamp = lastModified >= 1e12 ? lastModified : lastModified * 1000;
    return new Date(timestamp).toISOString();
  } else {
    console.warn(`[CalendarData] Invalid file.last_modified for habit ` + `"` + `${habitName}` + `"` + `, skipping timestamp`);
    return undefined;
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
  const reloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cache the most recent Markdown file listing so we can diff quickly without
  // hammering the Tauri backend on every metadata edit. A structural event flips
  // the flag below, forcing the next load to re-query disk.
  const filesCacheRef = useRef<MarkdownFile[] | null>(files ?? null);
  const forceFileRefreshRef = useRef(false);
  const fileScanVersionRef = useRef(0);
  const normalizedSpacePath = useMemo(() => normalizeFsPath(spacePath).toLowerCase(), [spacePath]);

  const isPathInSpace = useCallback((candidate?: string) => {
    if (!candidate || !normalizedSpacePath) return false;
    return normalizeFsPath(candidate).toLowerCase().startsWith(normalizedSpacePath);
  }, [normalizedSpacePath]);

  useEffect(() => {
    if (Array.isArray(files)) {
      filesCacheRef.current = files;
    }
  }, [files]);

  // When the user switches GTD spaces, clear the cached file list so the next
  // load performs a fresh scan against the new directory.
  useEffect(() => {
    filesCacheRef.current = null;
    forceFileRefreshRef.current = true;
    fileScanVersionRef.current += 1;
  }, [spacePath]);

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

      // Ensure we have an up-to-date file snapshot
      let effectiveFiles = filesCacheRef.current;
      const needsFreshScan = !effectiveFiles || forceFileRefreshRef.current;
      const scanVersionAtStart = fileScanVersionRef.current;

      if (needsFreshScan) {
        console.log('[CalendarData] Refreshing markdown file list from disk...');
        const fetchedFiles = await safeInvoke<MarkdownFile[]>('list_markdown_files', { path: spacePath }, []);
        if (Array.isArray(fetchedFiles)) {
          filesCacheRef.current = fetchedFiles;
          effectiveFiles = fetchedFiles;
        } else {
          effectiveFiles = [];
        }
        if (fileScanVersionRef.current === scanVersionAtStart) {
          forceFileRefreshRef.current = false;
        }
      }

      // 1. Load all project README files directly
      if (effectiveFiles) {
        for (let fileIndex = 0; fileIndex < effectiveFiles.length; fileIndex++) {
          const file = effectiveFiles[fileIndex];
          // Normalize path for cross-platform compatibility (Windows uses backslashes)
          const normalizedPath = file.path.replace(/\\/g, '/');
          // Create lowercase version for case-insensitive comparisons
          const normalizedPathLower = normalizedPath.toLowerCase();
          
          // Check if it's a project README (case-insensitive check)
          if (normalizedPathLower.includes('/projects/') && normalizedPathLower.endsWith('readme.md')) {
            try {
              let content = await safeInvoke<string>('read_file', { path: file.path }, '');
              
              // Apply migrations in-memory only (don't auto-save to avoid file churn)
              if (needsMigration(content)) {
                content = migrateMarkdownContent(content);
                // Note: Migration is applied for display only, not saved to disk
              }
              
              // Extract project name using case-insensitive search but preserving original casing
              const projectsIndex = normalizedPathLower.indexOf('/projects/');
              let projectName = '';
              if (projectsIndex !== -1) {
                const startIndex = projectsIndex + '/projects/'.length;
                const pathAfterProjects = normalizedPath.slice(startIndex);
                const segments = pathAfterProjects.split('/');
                projectName = segments[0] || '';
              }
              
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
                  dueDate: dueDate,
                  focusDate: undefined,
                  projectName: undefined
                });
              }
            } catch (err) {
              console.error(`[CalendarData] Failed to read project ${file.path}:`, err);
            }
          }
          
          // Check if it's an action file (in Projects but not README) - case-insensitive check
          if (normalizedPathLower.includes('/projects/') && !normalizedPathLower.includes('readme') && normalizedPathLower.endsWith('.md')) {
            try {
              let content = await safeInvoke<string>('read_file', { path: file.path }, '');
              
              // Apply migrations in-memory only (don't auto-save to avoid file churn)
              if (needsMigration(content)) {
                content = migrateMarkdownContent(content);
                // Note: Migration is applied for display only, not saved to disk
              }
              
              const pathParts = normalizedPath.split('/');
              // Find project name using case-insensitive lookup but preserve original casing
              const projectsIndex = normalizedPathLower.indexOf('/projects/');
              let projectName = '';
              if (projectsIndex !== -1) {
                const startIndex = projectsIndex + '/projects/'.length;
                const pathAfterProjects = normalizedPath.slice(startIndex);
                const segments = pathAfterProjects.split('/');
                projectName = segments[0] || '';
              }
              const actionName = pathParts[pathParts.length - 1].replace('.md', '') || '';
              
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
                  dueDate: dueDate,
                  focusDate: finalFocusDate,
                  projectName: projectName,
                  effort: effort
                });
              }
            } catch (err) {
              console.error(`[CalendarData] Failed to read action ${file.path}:`, err);
            }
          }
          
          // Check if it's a habit file - case-insensitive check
          if (normalizedPathLower.includes('/habits/') && normalizedPathLower.endsWith('.md')) {
            try {
              let content = await safeInvoke<string>('read_file', { path: file.path }, '');
              
              // Apply migrations in-memory only (don't auto-save to avoid file churn)
              if (needsMigration(content)) {
                content = migrateMarkdownContent(content);
                // Note: Migration is applied for display only, not saved to disk
              }
              
              const fallbackName = normalizedPath.split('/').pop()?.replace(/\.(md|markdown)$/i, '') || '';
              const parsedHabit = parseHabitContent(content);
              const habitName =
                parsedHabit.title && parsedHabit.title !== 'Untitled'
                  ? parsedHabit.title
                  : fallbackName;
              const habitStatus = parsedHabit.status;
              const frequency = parsedHabit.frequency;
              const focusDate = parsedHabit.focusDateTime || undefined;
              const habitPeriodHistory = toHabitPeriodHistory(parsedHabit.historyRows);

              // Parse created date using the parsed habit content first, then normalize to ISO.
              let createdDateTime: string | undefined;
              const createdDateTimeRaw = parsedHabit.createdDateTime;
              if (createdDateTimeRaw) {
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
                    if (Math.abs(Date.now() - parsed.getTime()) <= CREATED_AT_FALLBACK_WINDOW_MS) {
                      const maybeLastModified = fileLastModifiedToISO(
                        file.last_modified,
                        habitName
                      );
                      createdDateTime = maybeLastModified ?? parsed.toISOString();
                    } else {
                      createdDateTime = parsed.toISOString();
                    }
                  } else {
                    console.warn(`[CalendarData] Invalid created_date_time value in habit "${habitName}": "${createdDateTimeRaw}" - using file.last_modified`);
                    const fallback = fileLastModifiedToISO(file.last_modified, habitName);
                    if (fallback) {
                      createdDateTime = fallback;
                    }
                  }
                } catch (error) {
                  // Parsing threw an error - use file.last_modified
                  console.warn(`[CalendarData] Failed to parse created_date_time in habit "${habitName}": "${createdDateTimeRaw}" - ${error} - using file.last_modified`);
                  const fallback = fileLastModifiedToISO(file.last_modified, habitName);
                  if (fallback) {
                    createdDateTime = fallback;
                  }
                }
              } else {
                const fallback = fileLastModifiedToISO(file.last_modified, habitName);
                if (fallback) {
                  createdDateTime = fallback;
                }
              }

              
              // Only add habits if we have a valid createdDateTime
              if (createdDateTime) {
                allItems.push({
                  id: `habit-${habitName}-${fileIndex}`,
                  name: habitName,
                  path: file.path,
                  type: 'habit',
                  status: habitStatus,
                  dueDate: undefined,
                  focusDate: focusDate, // Can include time if specified
                  projectName: undefined,
                  frequency: frequency,
                  createdDateTime: createdDateTime,
                  habitPeriodHistory
                });
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
          if (project.dueDate && !allItems.some(item => 
            item.type === 'project' && item.name === project.name
          )) {
            console.log(`[CalendarData] Adding project from gtdSpace: ${project.name}`);
            allItems.push({
              id: `project-gtd-${project.name}-${gtdProjectIndex}`,
              name: project.name,
              path: project.path,
              type: 'project',
              status: project.status || 'in-progress',
              dueDate: project.dueDate,
              focusDate: undefined,
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
          dueDate: event.end || event.start, // Use end time, fallback to start
          focusDate: event.start,
          endDate: event.end, // Add end_date for duration calculation
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
          focusDate: calendarItem.focusDate,
          endDate: calendarItem.endDate,
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
  }, [spacePath, gtdSpace, googleEvents]);

  const scheduleCalendarReload = useCallback((reason: string) => {
    if (!spacePath) return;
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
    }

    reloadTimeoutRef.current = setTimeout(() => {
      console.log('[CalendarData] Reloading calendar due to', reason);
      loadAllCalendarItems();
    }, 250);
  }, [spacePath, loadAllCalendarItems]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadAllCalendarItems();
  }, [loadAllCalendarItems]);

  // Listen for metadata/content events to refresh calendar immediately when GTD fields change
  useEffect(() => {
    if (!spacePath) return;

    const isRelevantFile = (filePathRaw: string | undefined): boolean => {
      if (!filePathRaw || !isPathInSpace(filePathRaw)) {
        return false;
      }
      const normalizedLower = normalizeFsPath(filePathRaw).toLowerCase();
      return normalizedLower.includes('/projects/') || normalizedLower.includes('/habits/');
    };

    const metadataUnsubscribe = onMetadataChange((event) => {
      if (!isRelevantFile(event.filePath)) {
        return;
      }

      const changedFields = event.changedFields;
      if (!changedFields) {
        return;
      }

      const relevantChange = Object.keys(changedFields).some((key) => {
        const normalizedKey = key.toLowerCase();
        return (
          normalizedKey.includes('focus') ||
          normalizedKey.includes('due') ||
          normalizedKey.includes('created') ||
          normalizedKey.includes('habit') ||
          normalizedKey.includes('frequency')
        );
      });

      if (relevantChange) {
        scheduleCalendarReload(`metadata change in ${event.filePath}`);
      }
    });

    const contentSavedUnsubscribe = onContentSaved((event) => {
      if (!isRelevantFile(event.filePath)) {
        return;
      }
      scheduleCalendarReload(`content saved for ${event.filePath}`);
    });

    return () => {
      metadataUnsubscribe?.();
      contentSavedUnsubscribe?.();
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
    };
  }, [spacePath, scheduleCalendarReload, isPathInSpace]);

  // Listen for structural events (create/rename/delete) to force file list refreshes
  useEffect(() => {
    if (!spacePath) return;

    const shouldHandleDetail = (detail?: Record<string, string | undefined>): boolean => {
      if (!detail) return true;
      const candidateKeys = ['path', 'projectPath', 'actionPath', 'oldPath', 'newPath'];
      const hasMatch = candidateKeys.some((key) => isPathInSpace(detail[key]));
      return hasMatch || Object.keys(detail).length === 0;
    };

    const structuralEvents: string[] = [
      'gtd-action-created',
      'gtd-project-created',
      'project-renamed',
      'action-renamed',
      'section-file-renamed',
      'file-deleted'
    ];

    const unsubscribers = structuralEvents.map((eventName) => {
      const handler: EventListener = (event) => {
        const detail = (event as CustomEvent<Record<string, string | undefined>>).detail;
        if (!shouldHandleDetail(detail)) {
          return;
        }
        forceFileRefreshRef.current = true;
        fileScanVersionRef.current += 1;
        scheduleCalendarReload(`${eventName} event`);
      };
      window.addEventListener(eventName, handler);
      return () => window.removeEventListener(eventName, handler);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [spacePath, isPathInSpace, scheduleCalendarReload]);

  const refresh = useCallback((options?: { forceFileScan?: boolean }) => {
    if (options?.forceFileScan !== false) {
      forceFileRefreshRef.current = true;
      fileScanVersionRef.current += 1;
    }
    loadAllCalendarItems();
  }, [loadAllCalendarItems]);

  return {
    items,
    isLoading,
    error,
    refresh
  };
};
