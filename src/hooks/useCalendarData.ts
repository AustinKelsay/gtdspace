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
  type: 'project' | 'action' | 'habit';
  status?: string;
  due_date?: string;
  focus_date?: string;
  projectName?: string;
  frequency?: string; // For habits
  createdDate?: string; // For habits
}

interface UseCalendarDataReturn {
  items: CalendarItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
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
              
              const finalFocusDate = focusDateTime || focusDate;
              
              console.log(`[CalendarData] Action ${actionName}: focus=${finalFocusDate}, due=${dueDate}`);
              
              if (finalFocusDate || dueDate) {
                allItems.push({
                  id: `action-${projectName}-${actionName}-${fileIndex}`,
                  name: actionName,
                  path: file.path,
                  type: 'action',
                  status: status,
                  due_date: dueDate,
                  focus_date: finalFocusDate,
                  projectName: projectName
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
              
              // Parse created date using the existing DateTime parser
              let createdDate: string;
              const createdDateRaw = parseDateTimeField(content, 'created_date');
              if (createdDateRaw) {
                // Extract just the date part (YYYY-MM-DD) from the parsed value
                createdDate = createdDateRaw.split('T')[0];
              } else {
                // Fallback to current date if not found
                createdDate = new Date().toISOString().split('T')[0];
              }
              
              console.log(`[CalendarData] Habit ${habitName}: freq=${frequency}, created=${createdDate}`);
              
              // Add the habit with frequency and created date info
              allItems.push({
                id: `habit-${habitName}-${fileIndex}`,
                name: habitName,
                path: file.path,
                type: 'habit',
                status: habitStatus,
                due_date: undefined,
                focus_date: undefined, // Will be generated in CalendarView
                projectName: undefined,
                frequency: frequency,
                createdDate: createdDate
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
              status: project.status?.[0] || 'in-progress',
              due_date: project.due_date,
              focus_date: undefined,
              projectName: undefined
            });
            gtdProjectIndex++;
          }
        }
      }
      
      console.log(`[CalendarData] Loaded ${allItems.length} total calendar items`);
      console.log('[CalendarData] Items by type:', {
        projects: allItems.filter(i => i.type === 'project').length,
        actions: allItems.filter(i => i.type === 'action').length,
        habits: allItems.filter(i => i.type === 'habit').length
      });
      
      setItems(allItems);
    } catch (err) {
      console.error('[CalendarData] Failed to load calendar data:', err);
      setError('Failed to load calendar data');
    } finally {
      setIsLoading(false);
    }
  }, [spacePath, gtdSpace, files]);

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