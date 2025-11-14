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
  Cloud,
  CheckCircle2
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, parseISO, isValid, startOfWeek, endOfWeek,
  isSameMonth, isToday, addDays, addWeeks, addMonths,
  isMonday, isTuesday, isWednesday,
  isThursday, isFriday, setHours
} from 'date-fns';
import { checkTauriContextAsync } from '@/utils/tauri-ready';
import { useCalendarData } from '@/hooks/useCalendarData';
import type { MarkdownFile, GTDSpace } from '@/types';
import type { GoogleCalendarSyncStatus, SyncStatus, CalendarItemStatus } from '@/types/google-calendar';
import { mapGoogleCalendarSyncStatus } from '@/types/google-calendar';
import { cn } from '@/lib/utils';
import { EventDetailModal } from './EventDetailModal';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  useDraggable,
  useDroppable,
  type CollisionDetection,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { safeInvoke } from '@/utils/safe-invoke';
import { 
  updateMarkdownDate, 
  updateMarkdownEffort,
  getDateFieldForEventType, 
  formatDateForMarkdown,
  getEffortFromHeight
} from '@/utils/update-markdown-fields';
import { useToast } from '@/hooks/use-toast';
import { syncGoogleCalendarEvents } from '@/utils/google-calendar';

// Helper to detect if a date has a time component
// - For strings: return false when the time portion is zero (e.g., "T00:00:00", with optional fractional seconds and timezone)
// - For Date objects: treat ISO strings ending with zero time as no time component before checking local time parts
const hasTimeComponent = (d: string | Date): boolean => {
  const zeroTimeStringRegex = /T00:00:00(?:\.0+)?(?:Z|[+-]\d{2}:\d{2})?/;
  if (typeof d === 'string') {
    if (!/T\d{2}:\d{2}/.test(d)) return false;
    if (zeroTimeStringRegex.test(d)) return false;
    return true;
  }
  if (d instanceof Date) {
    const iso = d.toISOString();
    if (/T00:00:00(?:\.0+)?Z$/.test(iso)) return false;
    return (d.getHours() + d.getMinutes() + d.getSeconds() + d.getMilliseconds()) !== 0;
  }
  return false;
};

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
  frequency?: string; // Habit frequency (for habit events)
  path: string;
  projectName?: string;
  effort?: string; // Effort level for actions
  // Google Calendar specific
  location?: string;
  attendees?: string[];
  meetingLink?: string;
  description?: string;
}

// Lazy-load Tauri invoke only in Tauri context
async function getTauriInvoke(): Promise<(<T>(cmd: string, args?: unknown) => Promise<T>) | null> {
  const inTauriContext = await checkTauriContextAsync();
  if (!inTauriContext) return null;
  const core = await import('@tauri-apps/api/core');
  return core.invoke as <T>(cmd: string, args?: unknown) => Promise<T>;
}


const getEventColorClass = (type: 'project' | 'action' | 'habit' | 'google-event', eventType: 'due' | 'focus' | 'habit' | 'google', isCompleted?: boolean) => {
  let baseClass = '';
  
  if (type === 'google-event' || eventType === 'google') {
    baseClass = 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700';
  } else if (type === 'habit') {
    baseClass = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700';
  } else if (eventType === 'due') {
    baseClass = 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700';
  } else {
    baseClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700';
  }
  
  // Add completed styling: reduced opacity and strikethrough
  if (isCompleted) {
    return `${baseClass} opacity-50 line-through`;
  }
  
  return baseClass;
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

// Resizable Event Component
interface ResizableEventProps {
  event: CalendarEvent;
  children: React.ReactNode;
  onResize?: (newEffort: 'small' | 'medium' | 'large' | 'extra-large') => void;
  isResizable?: boolean;
}

const ResizableEvent: React.FC<ResizableEventProps> = ({ 
  event: _event, 
  children, 
  onResize,
  isResizable = false 
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [showHandle, setShowHandle] = useState(false);
  
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setStartY(e.clientY);
    const element = (e.target as HTMLElement).parentElement;
    if (element) {
      const height = element.offsetHeight;
      setStartHeight(height);
      setCurrentHeight(height);
    }
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(20, Math.min(240, startHeight + deltaY)); // Min 20px, max 240px (3 hours)
      setCurrentHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (currentHeight && onResize) {
        const newEffort = getEffortFromHeight(currentHeight);
        onResize(newEffort);
      }
      setIsResizing(false);
      setCurrentHeight(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, startY, startHeight, currentHeight, onResize]);

  return (
    <div 
      className="relative"
      style={{ 
        height: currentHeight || undefined,
        transition: isResizing ? 'none' : 'height 200ms ease'
      }}
      onMouseEnter={() => setShowHandle(true)}
      onMouseLeave={() => !isResizing && setShowHandle(false)}
    >
      {children}
      {isResizable && showHandle && (
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize",
            "bg-gray-400 dark:bg-gray-600 opacity-0 hover:opacity-50 transition-opacity",
            isResizing && "opacity-50"
          )}
          onMouseDown={handleResizeStart}
          style={{ touchAction: 'none' }}
        />
      )}
    </div>
  );
};

// Draggable Event Component
interface DraggableEventProps {
  event: CalendarEvent;
  children: React.ReactNode;
}

const DraggableEvent: React.FC<DraggableEventProps> = ({ event, children }) => {
  const isDraggable = event.type !== 'google-event';
  const [isHovered, setIsHovered] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: event.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1, // More transparent when dragging
    cursor: isDraggable ? (isDragging ? 'grabbing' : (isHovered ? 'grab' : 'pointer')) : 'pointer',
    transition: isDragging ? 'none' : 'opacity 200ms ease',
    position: 'relative' as const,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...(isDraggable ? listeners : {})}
      {...(isDraggable ? attributes : {})}
    >
      {/* Show drag indicator on hover for draggable events */}
      {isDraggable && isHovered && !isDragging && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400 dark:bg-gray-600 opacity-50 rounded-l"
          style={{ pointerEvents: 'none' }}
        />
      )}
      {children}
    </div>
  );
};

// Droppable Cell Component
interface DroppableCellProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

const DroppableCell: React.FC<DroppableCellProps> = ({ id, children, className }) => {
  const {
    isOver,
    setNodeRef,
  } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        isOver && "bg-blue-100/30 dark:bg-blue-900/20 ring-2 ring-blue-400 dark:ring-blue-600"
      )}
    >
      {children}
    </div>
  );
};

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
  const [googleSyncStatus, setGoogleSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  const [_overId, setOverId] = useState<string | null>(null);
  
  // Toast hook
  const { toast } = useToast();
  
  // Setup drag sensors with improved accuracy
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4, // Reduced for more precise control
        delay: 100,  // Small delay to prevent accidental drags
        tolerance: 5, // Tolerance for slight movements
      },
    }),
    useSensor(KeyboardSensor)
  );

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
        const invoke = await getTauriInvoke();
        if (!invoke) {
          console.warn('[CalendarView] Not in Tauri context; skipping status load');
          return;
        }
        const status = await invoke<GoogleCalendarSyncStatus>('google_calendar_get_status');
        console.log('[CalendarView] Google Calendar status:', status);
        setGoogleSyncStatus(mapGoogleCalendarSyncStatus(status));
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
      const result = await syncGoogleCalendarEvents();
      if (!result) {
        console.warn('[CalendarView] Google Calendar sync unavailable');
        toast({
          title: 'Sync unavailable',
          description: 'Google Calendar sync requires the desktop app to be connected.',
          variant: 'destructive'
        });
        return;
      }
      // Refresh calendar data after sync (no need to rescan files)
      refresh({ forceFileScan: false });
      // Update sync status
      const invoke = await getTauriInvoke();
      if (invoke) {
        const status = await invoke<GoogleCalendarSyncStatus>('google_calendar_get_status');
        setGoogleSyncStatus(mapGoogleCalendarSyncStatus(status));
      }
    } catch (error) {
      console.error('Failed to sync Google Calendar:', error);
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
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
        const startDate = item.focusDate || item.dueDate;
        const endDate = item.endDate || item.dueDate;  // Use end_date or fallback to due_date

        if (startDate) {
          const date = typeof startDate === 'string' ? parseISO(startDate) : startDate;
          const end = endDate ? (typeof endDate === 'string' ? parseISO(endDate) : endDate) : null;

          if (isValid(date)) {
            // Format time from the Date object to get local time, not UTC
            let formattedTime: string | undefined;
            // Check if this has a time component (not just a date)
            if (hasTimeComponent(startDate)) {
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
              if (endDate && hasTimeComponent(endDate)) {
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
        if (item.focusDate && hasTimeComponent(item.focusDate)) {
          // Parse the date to get local time
          const focusDate = parseISO(item.focusDate);
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
              frequency: item.frequency,
              time: formattedTime // Include the formatted time for display
            });
          });
      } else {
        // Handle projects and actions
        if (item.dueDate) {
          const dueDate = typeof item.dueDate === 'string' ? parseISO(item.dueDate) : item.dueDate;
          if (isValid(dueDate)) {
            // Format time from the Date object to get local time, not UTC
            let formattedTime: string | undefined;
            // Check if this has a time component (not just a date)
            if (item.dueDate && hasTimeComponent(item.dueDate)) {
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

        if (item.focusDate) {
          const focusDate = typeof item.focusDate === 'string' ? parseISO(item.focusDate) : item.focusDate;
          if (isValid(focusDate)) {
            // Format time from the Date object to get local time, not UTC
            let formattedTime: string | undefined;
            // Check if this has a time component (not just a date)
            if (item.focusDate && hasTimeComponent(item.focusDate)) {
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

  // Find the active event being dragged
  const activeEvent = useMemo(() => {
    if (!activeId) return null;
    return filteredEvents.find(event => event.id === activeId);
  }, [activeId, filteredEvents]);

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const draggedEvent = filteredEvents.find(e => e.id === event.active.id);
    // Only allow dragging non-Google events
    if (draggedEvent && draggedEvent.type !== 'google-event') {
      setActiveId(event.active.id as string);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active: _active, over } = event;
    
    if (!over || !activeEvent || activeEvent.type === 'google-event') {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const droppedOnId = over.id as string;
    
    // Parse the drop target ID to get the date
    // Format: "drop-YYYY-MM-DD" for month view or "drop-YYYY-MM-DD-HH" for week view
    const dropParts = droppedOnId.split('-');
    if (dropParts[0] !== 'drop' || dropParts.length < 4) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const year = parseInt(dropParts[1]);
    const month = parseInt(dropParts[2]) - 1; // JavaScript months are 0-indexed
    const day = parseInt(dropParts[3]);
    const hour = dropParts.length > 4 ? parseInt(dropParts[4]) : undefined;

    // Create the new date
    const newDate = new Date(year, month, day);
    const includeTime = hour !== undefined && viewMode === 'week';
    
    if (includeTime) {
      // If dropping in week view on a specific hour, set the time
      newDate.setHours(hour, 0, 0, 0);
    } else if (activeEvent.time && viewMode === 'month') {
      // Preserve existing time when dropping in month view if event had time
      const oldDate = activeEvent.date;
      newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0);
    }

    // Check if actually moving to a different date
    const oldDateStr = formatDateForMarkdown(activeEvent.date, false);
    const newDateStr = formatDateForMarkdown(newDate, false);
    
    if (oldDateStr === newDateStr && !includeTime) {
      // Same date and not updating time
      setActiveId(null);
      setOverId(null);
      return;
    }

    try {
      // Read the file content
      const fileContent = await safeInvoke<string>('read_file', {
        path: activeEvent.path
      }, null);

      if (fileContent === null) {
        throw new Error('Failed to read file');
      }

      // Determine which field to update
      const fieldType = getDateFieldForEventType(activeEvent.eventType);
      
      // Format the new date for markdown
      const formattedDate = formatDateForMarkdown(newDate, includeTime || !!activeEvent.time);
      
      // Update the markdown content
      const updatedContent = updateMarkdownDate(fileContent, fieldType, formattedDate);

      // Save the updated file
      const result = await safeInvoke<string>('save_file', {
        path: activeEvent.path,
        content: updatedContent
      }, null);

      if (result === null) {
        throw new Error('Failed to save file');
      }

      // Refresh calendar data without forcing a file rescan
      refresh({ forceFileScan: false });
      
      // Show success message
      toast({
        title: "Event Updated",
        description: `Updated ${activeEvent.title} ${fieldType.replace('_', ' ')} to ${newDate.toLocaleDateString()}`,
      });
    } catch (error) {
      console.error('Failed to update event date:', error);
      toast({
        title: "Update Failed",
        description: `Failed to update ${activeEvent.title}`,
        variant: "destructive",
      });
    }

    setActiveId(null);
    setOverId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  // Handle effort resize
  const handleEffortResize = async (event: CalendarEvent, newEffort: 'small' | 'medium' | 'large' | 'extra-large') => {
    try {
      // Read the file content
      const fileContent = await safeInvoke<string>('read_file', {
        path: event.path
      }, null);

      if (fileContent === null) {
        throw new Error('Failed to read file');
      }

      // Update the markdown content with new effort
      const updatedContent = updateMarkdownEffort(fileContent, newEffort);

      // Save the updated file
      const result = await safeInvoke<string>('save_file', {
        path: event.path,
        content: updatedContent
      }, null);

      if (result === null) {
        throw new Error('Failed to save file');
      }

      // Refresh calendar data without re-scanning the entire file tree
      refresh({ forceFileScan: false });
      
      // Show success message
      toast({
        title: "Effort Updated",
        description: `Updated ${event.title} effort to ${newEffort}`,
      });
    } catch (error) {
      console.error('Failed to update event effort:', error);
      toast({
        title: "Update Failed",
        description: `Failed to update ${event.title} effort`,
        variant: "destructive",
      });
    }
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

  // Custom collision detection for better accuracy
  const collisionDetectionStrategy: CollisionDetection = (args) => {
    // First try pointer-based detection for accuracy
    const pointerCollisions = pointerWithin(args);
    
    // Fallback to rectangle intersection if no pointer collision
    if (!pointerCollisions || pointerCollisions.length === 0) {
      return rectIntersection(args);
    }
    
    return pointerCollisions;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
          {googleSyncStatus?.isConnected && (
            <div className="flex items-center gap-2 mr-2">
              <Badge variant="outline" className="gap-1.5">
                <Cloud className="h-3 w-3" />
                Google Calendar
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGoogleSync}
                disabled={isSyncing || googleSyncStatus.syncInProgress}
                className="h-7 w-7"
                title="Sync Google Calendar"
              >
                <RefreshCw className={cn(
                  "h-3.5 w-3.5",
                  (isSyncing || googleSyncStatus.syncInProgress) && "animate-spin"
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
            onClick={() => refresh()}
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

                const dropId = `drop-${format(day, 'yyyy-MM-dd')}`;
                
                return (
                  <DroppableCell
                    key={day.toISOString()}
                    id={dropId}
                    className={cn(
                      "border-r border-b last:border-r-0 p-1 overflow-hidden",
                      "hover:bg-accent/5 transition-colors cursor-pointer",
                      !isCurrentMonth && "bg-muted/30",
                      isSelectedDay && "bg-accent/10",
                      isTodayDate && "bg-blue-50/50 dark:bg-blue-950/20"
                    )}
                  >
                    <div onClick={() => setSelectedDate(day)}>
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
                            <DraggableEvent key={event.id} event={event}>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEventClick(event);
                                }}
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-xs truncate",
                                  "border transition-all hover:shadow-sm hover:scale-105",
                                  getEventColorClass(event.type, event.eventType, event.status === 'completed')
                                )}
                                title={`${event.time || ''} ${event.title}${event.projectName ? ` (${event.projectName})` : ''}`}
                              >
                                <div className="flex items-center gap-1">
                                  {event.status === 'completed' && (
                                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                                  )}
                                  {event.time && (
                                    <span className="font-medium shrink-0">
                                      {event.time}
                                    </span>
                                  )}
                                  <span className="truncate">{event.title}</span>
                                </div>
                              </div>
                            </DraggableEvent>
                          ))}

                          {dayEvents.length > 4 && (
                            <div className="text-xs text-muted-foreground px-1">
                              +{dayEvents.length - 4} more
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </DroppableCell>
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

                const allDayDropId = `drop-${format(day, 'yyyy-MM-dd')}`;
                
                return (
                  <DroppableCell
                    key={`${day.toISOString()}-allday`}
                    id={allDayDropId}
                    className={cn(
                      "border-r last:border-r-0 p-1",
                      isToday(day) && "bg-blue-50/30 dark:bg-blue-950/10"
                    )}
                  >
                    <div className="space-y-1">
                      {allDayEvents.map(event => (
                        <DraggableEvent key={event.id} event={event}>
                          <div
                            onClick={() => handleEventClick(event)}
                            className={cn(
                              "px-2 py-1 rounded text-xs",
                              "border transition-all hover:shadow-md hover:scale-105",
                              getEventColorClass(event.type, event.eventType, event.status === 'completed')
                            )}
                            title={`${event.title}${event.projectName ? ` (${event.projectName})` : ''}`}
                          >
                            <div className="font-medium truncate flex items-center gap-1">
                              {event.status === 'completed' && (
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                              )}
                              <span>{event.title}</span>
                            </div>
                          </div>
                        </DraggableEvent>
                      ))}
                    </div>
                  </DroppableCell>
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

                      const hourDropId = `drop-${format(day, 'yyyy-MM-dd')}-${hour}`;
                      
                      return (
                        <DroppableCell
                          key={`${day.toISOString()}-${hour}`}
                          id={hourDropId}
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

                                    // Check if event is resizable (actions with effort and focus date, not completed)
                                    const isResizable = event.type === 'action' && 
                                                       event.eventType === 'focus' && 
                                                       event.effort &&
                                                       event.status !== 'completed';

                                    return (
                                      <ResizableEvent
                                        key={event.id}
                                        event={event}
                                        isResizable={isResizable}
                                        onResize={(newEffort) => handleEffortResize(event, newEffort)}
                                      >
                                        <DraggableEvent event={event}>
                                          <div
                                            onClick={() => handleEventClick(event)}
                                            className={cn(
                                              "absolute px-2 py-1 rounded text-xs overflow-hidden h-full",
                                              "border transition-all hover:shadow-md hover:scale-105 hover:z-10",
                                              getEventColorClass(event.type, event.eventType, event.status === 'completed')
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
                                              {event.status === 'completed' && (
                                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                              )}
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
                                        </DraggableEvent>
                                      </ResizableEvent>
                                    );
                                  });
                                })}
                              </>
                            );
                          })()}
                        </DroppableCell>
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
          frequency: selectedEvent.type === 'habit' ? selectedEvent.frequency : undefined,
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
            last_modified: Math.floor(Date.now() / 1000),
            extension: 'md'
          };
          onFileSelect(file);
        }}
      />
      
      {/* Drag Overlay for visual feedback */}
      <DragOverlay>
        {activeEvent ? (
          <div
            className={cn(
              "px-2 py-1 rounded text-xs shadow-lg",
              "border transition-all",
              getEventColorClass(activeEvent.type, activeEvent.eventType, activeEvent.status === 'completed')
            )}
          >
            <div className="flex items-center gap-1">
              {activeEvent.status === 'completed' && (
                <CheckCircle2 className="h-3 w-3 shrink-0" />
              )}
              <span className="font-medium truncate">{activeEvent.title}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </div>
    </DndContext>
  );
};
