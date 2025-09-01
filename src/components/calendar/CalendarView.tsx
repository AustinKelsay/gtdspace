/**
 * @fileoverview Full-view calendar component displaying GTD items as event blocks
 * @author Development Team
 * @created 2025-01-17
 */

import React, { useState, useMemo, useEffect } from 'react';
// import { Card } from '@/components/ui/card';  // Removed: unused
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Cloud
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, parseISO, isValid, startOfWeek, endOfWeek,
  isSameMonth, isToday, addDays, addWeeks, addMonths,
  isMonday, isTuesday, isWednesday,
  isThursday, isFriday, setHours
} from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import { useCalendarData } from '@/hooks/useCalendarData';
import type { MarkdownFile, GTDSpace } from '@/types';
import type { GoogleCalendarSyncStatus, CalendarItemStatus } from '@/types/google-calendar';
import { cn } from '@/lib/utils';
import { EventDetailModal } from './EventDetailModal';

interface CalendarViewProps {
  onFileSelect: (file: MarkdownFile) => void;
  spacePath: string;
  gtdSpace?: GTDSpace | null;
  files?: MarkdownFile[];
}

interface CalendarEvent {
  id: string;
  title: string;
  type: 'project' | 'action' | 'habit' | 'google-event';
  status?: string;
  eventType: 'due' | 'focus' | 'habit' | 'google';
  date: Date;
  time?: string;
  endDate?: Date;  // Add end date for Google events
  endTime?: string; // Add end time display string
  duration?: number; // Duration in minutes for positioning
  path: string;
  projectName?: string;
  effort?: string; // Effort level for actions
  // Google Calendar specific
  location?: string;
  attendees?: string[];
  meetingLink?: string;
  description?: string;
}


const getEventColorClass = (type: 'project' | 'action' | 'habit' | 'google-event', eventType: 'due' | 'focus' | 'habit' | 'google') => {
  if (type === 'google-event' || eventType === 'google') {
    return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700';
  }
  if (type === 'habit') {
    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700';
  }
  if (eventType === 'due') {
    return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700';
  }
  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700';
};

// Map effort levels to duration in minutes for calendar display
const getEffortDuration = (effort?: string): number => {
  switch (effort?.toLowerCase()) {
    case 'small':
      return 30;  // 30 minutes
    case 'medium':
      return 60;  // 1 hour
    case 'large':
      return 120; // 2 hours
    case 'extra-large':
      return 180; // 3 hours
    default:
      return 30;  // Default to 30 minutes
  }
};


/**
 * Generate recurring dates for habits based on frequency - optimized for view window
 * 
 * Performance optimization: Only generates dates within the specified view window
 * instead of generating all dates from creation and then filtering.
 * 
 * For a daily habit created 1 year ago:
 * - Old approach: Generate 365+ dates, then filter to ~30 for month view
 * - New approach: Generate only the ~30 dates needed for the current view
 * 
 * @param createdDateTime - The date the habit was created (ISO string)
 * @param frequency - The recurrence frequency of the habit
 * @param viewStart - Start of the current view window
 * @param viewEnd - End of the current view window
 * @returns Array of dates when the habit should appear in the current view
 */
const generateHabitDates = (
  createdDateTime: string,
  frequency: string,
  viewStart: Date,
  viewEnd: Date
): Date[] => {
  const dates: Date[] = [];
  const created = parseISO(createdDateTime);
  if (!isValid(created)) return dates;

  // Add a small buffer to handle edge cases at view boundaries
  const bufferDays = 1;
  const bufferedStart = addDays(viewStart, -bufferDays);
  const bufferedEnd = addDays(viewEnd, bufferDays);

  // Calculate the first occurrence within or after the view start
  let currentDate = created;

  // Fast-forward to the view window based on frequency
  if (created < bufferedStart) {
    const daysDiff = Math.floor((viewStart.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

    switch (frequency) {
      case 'daily':
        currentDate = addDays(created, daysDiff);
        break;

      case 'weekdays':
        // Approximate - will be adjusted in the loop
        currentDate = addDays(created, daysDiff);
        break;

      case 'every-other-day': {
        const cycles = Math.floor(daysDiff / 2);
        currentDate = addDays(created, cycles * 2);
        break;
      }

      case 'twice-weekly': {
        const twiceWeeklyCycles = Math.floor(daysDiff / 3);
        currentDate = addDays(created, twiceWeeklyCycles * 3);
        break;
      }

      case 'weekly': {
        const weeks = Math.floor(daysDiff / 7);
        currentDate = addWeeks(created, weeks);
        break;
      }

      case 'biweekly': {
        const biweeks = Math.floor(daysDiff / 14);
        currentDate = addWeeks(created, biweeks * 2);
        break;
      }

      case 'monthly': {
        const monthsDiff = Math.floor(daysDiff / 30);
        currentDate = addMonths(created, monthsDiff);
        break;
      }

      default:
        currentDate = addDays(created, daysDiff);
        break;
    }
  }

  // Generate dates only within the view window (with buffer)
  while (currentDate <= bufferedEnd) {
    // Only include dates that are actually within the view (not in buffer)
    if (currentDate >= viewStart && currentDate <= viewEnd) {
      switch (frequency) {
        case 'daily':
          dates.push(new Date(currentDate));
          break;

        case 'weekdays':
          // Only Monday through Friday
          if (isMonday(currentDate) || isTuesday(currentDate) ||
            isWednesday(currentDate) || isThursday(currentDate) ||
            isFriday(currentDate)) {
            dates.push(new Date(currentDate));
          }
          break;

        case 'every-other-day':
        case 'twice-weekly':
        case 'weekly':
        case 'biweekly':
        case 'monthly':
        default:
          dates.push(new Date(currentDate));
          break;
      }
    }

    // Move to next occurrence
    switch (frequency) {
      case 'daily':
      case 'weekdays':
        currentDate = addDays(currentDate, 1);
        break;

      case 'every-other-day':
        currentDate = addDays(currentDate, 2);
        break;

      case 'twice-weekly':
        currentDate = addDays(currentDate, 3);
        break;

      case 'weekly':
        currentDate = addWeeks(currentDate, 1);
        break;

      case 'biweekly':
        currentDate = addWeeks(currentDate, 2);
        break;

      case 'monthly':
        currentDate = addMonths(currentDate, 1);
        break;

      default:
        currentDate = addDays(currentDate, 1);
        break;
    }
  }

  return dates;
};

type ViewMode = 'month' | 'week';

export const CalendarView: React.FC<CalendarViewProps> = ({
  onFileSelect,
  spacePath,
  gtdSpace,
  files
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [googleSyncStatus, setGoogleSyncStatus] = useState<GoogleCalendarSyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modal and filter state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventFilters, setEventFilters] = useState({
    due: true,
    focus: true,
    habit: true,
    google: true
  });

  // Get all dated items from the hook
  const { items, refresh } = useCalendarData(spacePath, gtdSpace, files);

  // Load Google Calendar status
  useEffect(() => {
    const loadGoogleStatus = async () => {
      console.log('[CalendarView] Loading Google Calendar status...');
      try {
        const status = await invoke<GoogleCalendarSyncStatus>('google_calendar_get_status');
        console.log('[CalendarView] Google Calendar status:', status);
        setGoogleSyncStatus(status);
      } catch (error) {
        console.error('[CalendarView] Failed to load Google Calendar status:', error);
      }
    };
    loadGoogleStatus();
  }, []);

  // Handle Google Calendar sync
  const handleGoogleSync = async () => {
    setIsSyncing(true);
    try {
      await invoke('google_calendar_sync');
      // Refresh calendar data after sync
      refresh();
      // Update sync status
      const status = await invoke<GoogleCalendarSyncStatus>('google_calendar_get_status');
      setGoogleSyncStatus(status);
    } catch (error) {
      console.error('Failed to sync Google Calendar:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Update current time every minute for the time indicator
  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to 7am when week view loads
  useEffect(() => {
    if (viewMode === 'week') {
      // Find the ScrollArea's viewport element specifically in the week time grid
      // ScrollArea creates a div with data-radix-scroll-area-viewport
      const scrollToMorning = () => {
        // More specific selector to target the week grid ScrollArea
        const weekGrid = document.getElementById('week-time-grid');
        if (weekGrid) {
          const scrollViewport = weekGrid.querySelector('[data-radix-scroll-area-viewport]');

          if (scrollViewport && scrollViewport instanceof HTMLElement) {
            // Each hour row is 80px (h-20), scroll to 7am
            const targetHour = 7;
            const scrollPosition = targetHour * 80;
            scrollViewport.scrollTop = scrollPosition;
          }
        }
      };

      // Use requestAnimationFrame to ensure DOM is painted
      requestAnimationFrame(() => {
        // Additional delay for ScrollArea to fully initialize
        setTimeout(scrollToMorning, 200);
      });
    }
  }, [viewMode, currentMonth]); // Re-scroll when changing weeks or switching to week view

  // Process items into calendar events
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    // Calculate view range for habit generation based on view mode
    const viewStart = viewMode === 'week'
      ? startOfWeek(currentMonth)
      : startOfWeek(startOfMonth(currentMonth));
    const viewEnd = viewMode === 'week'
      ? endOfWeek(currentMonth)
      : endOfWeek(endOfMonth(currentMonth));

    items.forEach(item => {
      // Handle Google Calendar events
      if (item.type === 'google-event') {
        const startDate = item.focus_date || item.due_date;
        const endDate = item.end_date || item.due_date;  // Use end_date or fallback to due_date

        if (startDate) {
          const date = typeof startDate === 'string' ? parseISO(startDate) : startDate;
          const end = endDate ? (typeof endDate === 'string' ? parseISO(endDate) : endDate) : null;

          if (isValid(date)) {
            // Format time from the Date object to get local time, not UTC
            let formattedTime: string | undefined;
            // Check if this has a time component (not just a date)
            if (startDate.includes('T') && !startDate.endsWith('T00:00:00')) {
              const hours = date.getHours();
              const minutes = date.getMinutes();
              const period = hours >= 12 ? 'PM' : 'AM';
              const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
              formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
            }

            // Calculate duration in minutes if we have an end time
            let duration: number | undefined;
            let endTimeFormatted: string | undefined;
            if (end && isValid(end)) {
              duration = Math.round((end.getTime() - date.getTime()) / (1000 * 60)); // Duration in minutes

              // Format end time from Date object for local time
              if (endDate && typeof endDate === 'string' && endDate.includes('T') && !endDate.endsWith('T00:00:00')) {
                const endHours = end.getHours();
                const endMinutes = end.getMinutes();
                const endPeriod = endHours >= 12 ? 'PM' : 'AM';
                const displayEndHours = endHours === 0 ? 12 : endHours > 12 ? endHours - 12 : endHours;
                endTimeFormatted = `${displayEndHours}:${endMinutes.toString().padStart(2, '0')} ${endPeriod}`;
              }
            }

            events.push({
              id: item.id,
              title: item.name,
              type: 'google-event',
              status: item.status,
              eventType: 'google',
              date: date,
              time: formattedTime,
              endDate: end || undefined,
              endTime: endTimeFormatted,
              duration: duration,
              path: item.path,
              location: item.location,
              attendees: item.attendees,
              meetingLink: item.meetingLink,
              description: item.description
            });
          }
        }
        return; // Skip to next item
      }

      // Handle habits separately - generate recurring events
      if (item.type === 'habit' && item.frequency && item.createdDateTime) {
        // Generate dates only for the current view window
        const habitDates = generateHabitDates(item.createdDateTime, item.frequency, viewStart, viewEnd);

        // Extract time from focus_date if available
        let timeString: string | undefined;
        let formattedTime: string | undefined;
        if (item.focus_date && item.focus_date.includes('T') && !item.focus_date.endsWith('T00:00:00')) {
          // Parse the date to get local time
          const focusDate = parseISO(item.focus_date);
          if (isValid(focusDate)) {
            const hours = focusDate.getHours();
            const minutes = focusDate.getMinutes();
            timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            // Convert to 12-hour format for display
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
            formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
          }
        }

        // Process the generated dates (already filtered to view window)
        habitDates
          .forEach((date, _index) => {
            // Apply the time to the date if available
            let eventDate = date;
            if (timeString) {
              const [hours, minutes] = timeString.split(':').map(Number);
              eventDate = new Date(date);
              eventDate.setHours(hours, minutes, 0, 0);
            }

            events.push({
              id: `${item.path}-habit-${_index}-${date.getTime()}`,
              title: item.name,
              type: 'habit',
              status: item.status,
              eventType: 'habit',
              date: eventDate,
              path: item.path,
              projectName: undefined,
              time: formattedTime // Include the formatted time for display
            });
          });
      } else {
        // Handle projects and actions
        if (item.due_date) {
          const dueDate = typeof item.due_date === 'string' ? parseISO(item.due_date) : item.due_date;
          if (isValid(dueDate)) {
            // Format time from the Date object to get local time, not UTC
            let formattedTime: string | undefined;
            // Check if this has a time component (not just a date)
            if (item.due_date.includes('T') && !item.due_date.endsWith('T00:00:00')) {
              const hours = dueDate.getHours();
              const minutes = dueDate.getMinutes();
              const period = hours >= 12 ? 'PM' : 'AM';
              const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
              formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
            }
            events.push({
              id: `${item.path}-due`,
              title: item.name,
              type: item.type,
              status: item.status,
              eventType: 'due',
              date: dueDate,
              time: formattedTime,
              path: item.path,
              projectName: item.projectName
            });
          }
        }

        if (item.focus_date) {
          const focusDate = typeof item.focus_date === 'string' ? parseISO(item.focus_date) : item.focus_date;
          if (isValid(focusDate)) {
            // Format time from the Date object to get local time, not UTC
            let formattedTime: string | undefined;
            // Check if this has a time component (not just a date)
            if (item.focus_date.includes('T') && !item.focus_date.endsWith('T00:00:00')) {
              const hours = focusDate.getHours();
              const minutes = focusDate.getMinutes();
              const period = hours >= 12 ? 'PM' : 'AM';
              const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
              formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
            }

            // Calculate duration based on effort for actions with focus dates
            let duration: number | undefined;
            let endDate: Date | undefined;
            let endTimeFormatted: string | undefined;

            if (item.type === 'action' && item.effort) {
              duration = getEffortDuration(item.effort);

              // Calculate end date/time based on duration
              endDate = new Date(focusDate.getTime() + duration * 60 * 1000);

              // Format end time from Date object for local time
              const endHours = endDate.getHours();
              const endMinutes = endDate.getMinutes();
              const endPeriod = endHours >= 12 ? 'PM' : 'AM';
              const displayEndHours = endHours === 0 ? 12 : endHours > 12 ? endHours - 12 : endHours;
              endTimeFormatted = `${displayEndHours}:${endMinutes.toString().padStart(2, '0')} ${endPeriod}`;
            }

            events.push({
              id: `${item.path}-focus`,
              title: item.name,
              type: item.type,
              status: item.status,
              eventType: 'focus',
              date: focusDate,
              time: formattedTime,
              endDate: endDate,
              endTime: endTimeFormatted,
              duration: duration,
              path: item.path,
              projectName: item.projectName,
              effort: item.effort
            });
          }
        }
      }
    });

    return events;
  }, [items, currentMonth, viewMode]);

  // Get calendar days for current view
  const calendarDays = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentMonth);
      const end = endOfWeek(currentMonth);
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(startOfMonth(currentMonth));
      const end = endOfWeek(endOfMonth(currentMonth));
      return eachDayOfInterval({ start, end });
    }
  }, [currentMonth, viewMode]);

  // Get hours for weekly view
  const weekHours = useMemo(() => {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(i);
    }
    return hours;
  }, []);

  // Filter events based on active filters
  const filteredEvents = useMemo(() => {
    return calendarEvents.filter(event => {
      if (event.eventType === 'due' && !eventFilters.due) return false;
      if (event.eventType === 'focus' && !eventFilters.focus) return false;
      if (event.eventType === 'habit' && !eventFilters.habit) return false;
      if (event.eventType === 'google' && !eventFilters.google) return false;
      return true;
    });
  }, [calendarEvents, eventFilters]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();

    filteredEvents.forEach(event => {
      const dateKey = format(event.date, 'yyyy-MM-dd');
      const existing = grouped.get(dateKey) || [];
      existing.push(event);
      grouped.set(dateKey, existing);
    });

    // Sort events within each day
    grouped.forEach((events) => {
      events.sort((a, b) => {
        // Timed events first
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        // Then by type: habits, actions, projects, google-events
        const typeOrder: Record<string, number> = {
          'habit': 0,
          'action': 1,
          'project': 2,
          'google-event': 3
        };
        return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
      });
    });

    return grouped;
  }, [filteredEvents]);

  const handleEventClick = (event: CalendarEvent) => {
    // Open modal for all event types
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setSelectedEvent(null);
    setIsModalOpen(false);
  };


  const navigate = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'week') {
        // Navigate by week
        if (direction === 'prev') {
          return addWeeks(newDate, -1);
        } else {
          return addWeeks(newDate, 1);
        }
      } else {
        // Navigate by month
        if (direction === 'prev') {
          newDate.setMonth(newDate.getMonth() - 1);
        } else {
          newDate.setMonth(newDate.getMonth() + 1);
        }
        return newDate;
      }
    });
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Calendar Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">GTD Calendar</h1>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('prev')}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <h2 className="text-lg font-medium w-48 text-center">
              {viewMode === 'week'
                ? `Week of ${format(startOfWeek(currentMonth), 'MMM d, yyyy')}`
                : format(currentMonth, 'MMMM yyyy')}
            </h2>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('next')}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Google Calendar Sync Status */}
          {googleSyncStatus?.is_connected && (
            <div className="flex items-center gap-2 mr-2">
              <Badge variant="outline" className="gap-1.5">
                <Cloud className="h-3 w-3" />
                Google Calendar
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoogleSync}
                disabled={isSyncing || googleSyncStatus.sync_in_progress}
                className="h-7 w-7"
                title="Sync Google Calendar"
              >
                <RefreshCw className={cn(
                  "h-3.5 w-3.5",
                  (isSyncing || googleSyncStatus.sync_in_progress) && "animate-spin"
                )} />
              </Button>
            </div>
          )}

          <div className="flex rounded-lg border bg-muted p-1">
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
              className="h-7 px-3"
            >
              Month
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
              className="h-7 px-3"
            >
              Week
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 p-4 overflow-hidden">
        {viewMode === 'month' ? (
          /* Month View */
          <div className="h-full bg-card rounded-lg border">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div
                  key={day}
                  className="p-2 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 h-[calc(100%-2.5rem)]">
              {calendarDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelectedDay = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r border-b last:border-r-0 p-1 overflow-hidden",
                      "hover:bg-accent/5 transition-colors cursor-pointer",
                      !isCurrentMonth && "bg-muted/30",
                      isSelectedDay && "bg-accent/10",
                      isTodayDate && "bg-blue-50/50 dark:bg-blue-950/20"
                    )}
                    onClick={() => setSelectedDate(day)}
                  >
                    {/* Day Number */}
                    <div className={cn(
                      "text-sm font-medium mb-1 px-1",
                      !isCurrentMonth && "text-muted-foreground",
                      isTodayDate && "text-blue-600 dark:text-blue-400"
                    )}>
                      {format(day, 'd')}
                    </div>

                    {/* Events */}
                    <ScrollArea className="h-[calc(100%-1.5rem)]">
                      <div className="space-y-1 px-1">
                        {dayEvents.slice(0, 4).map(event => (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(event);
                            }}
                            className={cn(
                              "px-1.5 py-0.5 rounded text-xs truncate cursor-pointer",
                              "border transition-all hover:shadow-sm hover:scale-105",
                              getEventColorClass(event.type, event.eventType)
                            )}
                            title={`${event.time || ''} ${event.title}${event.projectName ? ` (${event.projectName})` : ''}`}
                          >
                            <div className="flex items-center gap-1">
                              {event.time && (
                                <span className="font-medium shrink-0">
                                  {event.time}
                                </span>
                              )}
                              <span className="truncate">{event.title}</span>
                            </div>
                          </div>
                        ))}

                        {dayEvents.length > 4 && (
                          <div className="text-xs text-muted-foreground px-1">
                            +{dayEvents.length - 4} more
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Week View */
          <div className="h-full bg-card rounded-lg border overflow-hidden flex flex-col">
            {/* Week Day Headers */}
            <div className="grid grid-cols-8 border-b bg-card z-10">
              <div className="p-2 text-xs font-medium text-muted-foreground border-r">
                {/* Empty corner for time column */}
              </div>
              {calendarDays.map(day => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "p-2 text-center border-r last:border-r-0",
                    isToday(day) && "bg-blue-50/50 dark:bg-blue-950/20"
                  )}
                >
                  <div className="text-xs text-muted-foreground">
                    {format(day, 'EEE')}
                  </div>
                  <div className={cn(
                    "text-lg font-medium",
                    isToday(day) && "text-blue-600 dark:text-blue-400"
                  )}>
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>

            {/* No time events row */}
            <div className="grid grid-cols-8 border-b min-h-[3rem] bg-muted/30">
              <div className="p-2 text-xs text-muted-foreground border-r">
                No time
              </div>
              {calendarDays.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate.get(dateKey) || [];
                const allDayEvents = dayEvents.filter(event => !event.time);

                return (
                  <div
                    key={`${day.toISOString()}-allday`}
                    className={cn(
                      "border-r last:border-r-0 p-1",
                      isToday(day) && "bg-blue-50/30 dark:bg-blue-950/10"
                    )}
                  >
                    <div className="space-y-1">
                      {allDayEvents.map(event => (
                        <div
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className={cn(
                            "px-2 py-1 rounded text-xs cursor-pointer",
                            "border transition-all hover:shadow-md hover:scale-105",
                            getEventColorClass(event.type, event.eventType)
                          )}
                          title={`${event.title}${event.projectName ? ` (${event.projectName})` : ''}`}
                        >
                          <div className="font-medium truncate">
                            {event.title}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time Grid */}
            <ScrollArea className="flex-1 h-full" id="week-time-grid">
              <div className="relative">
                {/* Current Time Indicator */}
                {(() => {
                  const now = currentTime;
                  const currentHour = now.getHours();
                  const currentMinutes = now.getMinutes();
                  // Each hour is 80px (h-20), calculate position
                  const topPosition = (currentHour * 80) + (currentMinutes / 60 * 80);
                  const todayIndex = calendarDays.findIndex(day => isToday(day));

                  // Only show the indicator if today is in the current week view
                  if (todayIndex >= 0 && currentHour >= 0 && currentHour < 24) {
                    // Calculate the exact left position for today's column
                    // First column is time (12.5%), then each day is 12.5%
                    const leftPosition = (todayIndex + 1) * 12.5; // +1 to skip time column

                    return (
                      <>
                        {/* Time label positioned close to the bar */}
                        <div
                          className="absolute z-20 pointer-events-none"
                          style={{
                            top: `${topPosition}px`,
                            left: `calc(${leftPosition}% - 55px)`, // Closer to the bar
                            transform: 'translateY(-50%)',
                          }}
                        >
                          <span className="text-xs font-medium text-red-500 bg-background px-1 rounded whitespace-nowrap">
                            {format(now, 'h:mm a')}
                          </span>
                        </div>

                        {/* Line across today's column only */}
                        <div
                          className="absolute z-20 pointer-events-none"
                          style={{
                            top: `${topPosition}px`,
                            left: `${leftPosition}%`,
                            width: '12.5%',
                            transform: 'translateY(-50%)', // Center the line vertically
                          }}
                        >
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-red-500 rounded-full" />
                            <div className="flex-1 h-0.5 bg-red-500" />
                          </div>
                        </div>
                      </>
                    );
                  }
                  return null;
                })()}
                {weekHours.map(hour => (
                  <div key={hour} className="grid grid-cols-8 border-b h-20">
                    <div className="p-2 text-xs text-muted-foreground border-r">
                      {format(setHours(new Date(), hour), 'ha')}
                    </div>
                    {calendarDays.map(day => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const dayEvents = eventsByDate.get(dateKey) || [];
                      const hourEvents = dayEvents.filter(event => {
                        if (!event.time) return false; // All-day events handled separately
                        const eventStartHour = event.date.getHours();
                        const eventEndHour = event.endDate ? event.endDate.getHours() : eventStartHour;
                        const eventEndMinute = event.endDate ? event.endDate.getMinutes() : event.date.getMinutes();

                        // Check if this event starts in this hour or spans across this hour
                        if (eventStartHour === hour) {
                          return true; // Event starts in this hour
                        }

                        // Check if event spans across this hour (for multi-hour events)
                        if (event.duration && eventStartHour < hour) {
                          const endHour = eventEndMinute > 0 ? eventEndHour : eventEndHour - 1;
                          return hour <= endHour;
                        }

                        return false;
                      });

                      return (
                        <div
                          key={`${day.toISOString()}-${hour}`}
                          className={cn(
                            "relative border-r last:border-r-0 p-1",
                            "hover:bg-accent/5 transition-colors",
                            isToday(day) && "bg-blue-50/30 dark:bg-blue-950/10"
                          )}
                        >
                          {(() => {
                            // Only render events that start in this hour (not spanning ones)
                            const startingEvents = hourEvents.filter(ev => ev.date.getHours() === hour);

                            // Group events by minute within this hour for side-by-side layout
                            const groupsByMinute = new Map<number, typeof startingEvents>();
                            for (const ev of startingEvents) {
                              const minute = ev.date.getMinutes();
                              const arr = groupsByMinute.get(minute) || [];
                              arr.push(ev);
                              groupsByMinute.set(minute, arr);
                            }
                            const minuteKeys = Array.from(groupsByMinute.keys()).sort((a, b) => a - b);

                            return (
                              <>
                                {minuteKeys.map((min) => {
                                  const group = groupsByMinute.get(min)!;
                                  return group.map((event, index) => {
                                    // Calculate event height based on duration
                                    let eventHeight = 'auto';
                                    const minuteOffset = (min / 60) * 80; // Convert minutes to pixels

                                    if (event.duration) {
                                      // Each hour slot is 80px (h-20), calculate height based on duration
                                      const heightInPixels = (event.duration / 60) * 80;
                                      eventHeight = `${Math.max(20, heightInPixels)}px`; // Min height of 20px
                                    }

                                    // Calculate left position for side-by-side events
                                    const width = group.length > 1 ? `${100 / group.length}%` : '100%';
                                    const left = group.length > 1 ? `${(100 / group.length) * index}%` : '0';

                                    return (
                                      <div
                                        key={event.id}
                                        onClick={() => handleEventClick(event)}
                                        className={cn(
                                          "absolute px-2 py-1 rounded text-xs cursor-pointer overflow-hidden",
                                          "border transition-all hover:shadow-md hover:scale-105 hover:z-10",
                                          getEventColorClass(event.type, event.eventType)
                                        )}
                                        style={{
                                          top: `${minuteOffset}px`,
                                          height: eventHeight,
                                          minHeight: '20px',
                                          left: left,
                                          width: width,
                                          right: index === group.length - 1 ? '4px' : 'auto'
                                        }}
                                        title={`${event.time || ''} ${event.title}${event.projectName ? ` (${event.projectName})` : ''}${event.endTime ? ` - ${event.endTime}` : ''}`}
                                      >
                                        <div className="flex items-center gap-1 min-w-0">
                                          {event.time && (
                                            <span className="font-medium shrink-0 text-[10px]">
                                              {event.time}
                                            </span>
                                          )}
                                          <span className="truncate font-medium">
                                            {event.title}
                                          </span>
                                        </div>
                                        {event.endTime && event.duration && event.duration > 30 && (
                                          <div className="text-[10px] opacity-75">
                                            {event.endTime}
                                          </div>
                                        )}
                                        {event.projectName && event.duration && event.duration > 45 && (
                                          <div className="text-[10px] opacity-75 truncate">
                                            {event.projectName}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  });
                                })}
                              </>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Filter Checkboxes at Bottom */}
      <div className="px-6 py-2 border-t bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEventFilters(prev => ({ ...prev, due: !prev.due }))}
              className={cn(
                "group flex items-center gap-2 px-2.5 py-1 rounded-md transition-all duration-200",
                "hover:bg-background/60",
                !eventFilters.due && "opacity-50 hover:opacity-75"
              )}
            >
              <div className={cn(
                "relative w-4 h-4 rounded-sm transition-all duration-200",
                "ring-1 ring-inset",
                eventFilters.due
                  ? "bg-orange-500 ring-orange-500 dark:bg-orange-500 dark:ring-orange-500"
                  : "bg-background ring-border group-hover:ring-orange-500/50"
              )}>
                {eventFilters.due && (
                  <svg className="absolute inset-0 w-4 h-4 text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                eventFilters.due ? "text-foreground" : "text-muted-foreground"
              )}>Due Dates</span>
            </button>

            <button
              onClick={() => setEventFilters(prev => ({ ...prev, focus: !prev.focus }))}
              className={cn(
                "group flex items-center gap-2 px-2.5 py-1 rounded-md transition-all duration-200",
                "hover:bg-background/60",
                !eventFilters.focus && "opacity-50 hover:opacity-75"
              )}
            >
              <div className={cn(
                "relative w-4 h-4 rounded-sm transition-all duration-200",
                "ring-1 ring-inset",
                eventFilters.focus
                  ? "bg-blue-500 ring-blue-500 dark:bg-blue-500 dark:ring-blue-500"
                  : "bg-background ring-border group-hover:ring-blue-500/50"
              )}>
                {eventFilters.focus && (
                  <svg className="absolute inset-0 w-4 h-4 text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                eventFilters.focus ? "text-foreground" : "text-muted-foreground"
              )}>Focus Dates</span>
            </button>

            <button
              onClick={() => setEventFilters(prev => ({ ...prev, habit: !prev.habit }))}
              className={cn(
                "group flex items-center gap-2 px-2.5 py-1 rounded-md transition-all duration-200",
                "hover:bg-background/60",
                !eventFilters.habit && "opacity-50 hover:opacity-75"
              )}
            >
              <div className={cn(
                "relative w-4 h-4 rounded-sm transition-all duration-200",
                "ring-1 ring-inset",
                eventFilters.habit
                  ? "bg-green-500 ring-green-500 dark:bg-green-500 dark:ring-green-500"
                  : "bg-background ring-border group-hover:ring-green-500/50"
              )}>
                {eventFilters.habit && (
                  <svg className="absolute inset-0 w-4 h-4 text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                eventFilters.habit ? "text-foreground" : "text-muted-foreground"
              )}>Habits</span>
            </button>

            <button
              onClick={() => setEventFilters(prev => ({ ...prev, google: !prev.google }))}
              className={cn(
                "group flex items-center gap-2 px-2.5 py-1 rounded-md transition-all duration-200",
                "hover:bg-background/60",
                !eventFilters.google && "opacity-50 hover:opacity-75"
              )}
            >
              <div className={cn(
                "relative w-4 h-4 rounded-sm transition-all duration-200",
                "ring-1 ring-inset",
                eventFilters.google
                  ? "bg-purple-500 ring-purple-500 dark:bg-purple-500 dark:ring-purple-500"
                  : "bg-background ring-border group-hover:ring-purple-500/50"
              )}>
                {eventFilters.google && (
                  <svg className="absolute inset-0 w-4 h-4 text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                eventFilters.google ? "text-foreground" : "text-muted-foreground"
              )}>Google Calendar</span>
            </button>
          </div>

          <div className="text-xs text-muted-foreground font-medium">
            {filteredEvents.length} of {calendarEvents.length} events
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent ? {
          id: selectedEvent.id,
          name: selectedEvent.title,
          path: selectedEvent.path,
          type: selectedEvent.type,
          status: selectedEvent.status as CalendarItemStatus,
          projectName: selectedEvent.projectName,
          frequency: selectedEvent.type === 'habit' ? 'daily' : undefined,
          // Map dates to ExtendedCalendarItem fields
          focusDate: (selectedEvent.eventType === 'focus' || selectedEvent.type === 'google-event') ? selectedEvent.date.toISOString() : undefined,
          dueDate: (selectedEvent.eventType === 'due' || selectedEvent.type === 'google-event') ? selectedEvent.date.toISOString() : undefined,
          // Google-specific optional fields
          attendees: selectedEvent.attendees,
          location: selectedEvent.location,
          meetingLink: selectedEvent.meetingLink,
          description: selectedEvent.description,
        } : null}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onFileOpen={(path) => {
          const file: MarkdownFile = {
            id: path,
            name: selectedEvent?.title || '',
            path: path,
            size: 0,
            last_modified: Date.now(),
            extension: 'md'
          };
          onFileSelect(file);
        }}
      />
    </div>
  );
};