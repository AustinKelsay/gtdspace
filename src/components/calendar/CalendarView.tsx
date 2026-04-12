/**
 * @fileoverview Full-view calendar component displaying GTD items as event blocks
 * @author Development Team
 * @created 2025-01-17
 */

/* eslint-disable react-refresh/only-export-components */

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  parseISO, isValid, startOfWeek, endOfWeek,
  isSameMonth, isToday, addDays, addWeeks, addMonths,
  isMonday, isTuesday, isWednesday,
  isThursday, isFriday, setHours, startOfDay, endOfDay
} from 'date-fns';
import { checkTauriContextAsync } from '@/utils/tauri-ready';
import { useCalendarData, type CalendarItem } from '@/hooks/useCalendarData';
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
import { isHabitCompletedOnDate } from '@/utils/habit-progress';
import { localISODate } from '@/utils/time';
import {
  formatAbsoluteDate,
  formatAbsoluteTime,
  formatCalendarViewTitle,
} from '@/utils/date-formatting';

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

type ViewMode = 'day' | 'month' | 'week';

interface ViewWindow {
  start: Date;
  end: Date;
}

interface DropTargetResolution {
  newDate: Date;
  includeTime: boolean;
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

const getViewWindow = (viewDate: Date, viewMode: ViewMode): ViewWindow => {
  switch (viewMode) {
    case 'day':
      return {
        start: startOfDay(viewDate),
        end: endOfDay(viewDate),
      };
    case 'week':
      return {
        start: startOfWeek(viewDate),
        end: endOfWeek(viewDate),
      };
    case 'month':
    default:
      return {
        start: startOfWeek(startOfMonth(viewDate)),
        end: endOfWeek(endOfMonth(viewDate)),
      };
  }
};

const getDisplayDays = (viewDate: Date, viewMode: ViewMode): Date[] => {
  if (viewMode === 'day') {
    return [startOfDay(viewDate)];
  }

  const { start, end } = getViewWindow(viewDate, viewMode);
  return eachDayOfInterval({ start, end });
};

const getViewTitle = (viewDate: Date, viewMode: ViewMode): string => {
  return formatCalendarViewTitle(viewDate, viewMode);
};

const getNextViewDate = (
  viewDate: Date,
  viewMode: ViewMode,
  direction: 'prev' | 'next'
): Date => {
  const delta = direction === 'prev' ? -1 : 1;

  switch (viewMode) {
    case 'day':
      return addDays(viewDate, delta);
    case 'week':
      return addWeeks(viewDate, delta);
    case 'month':
    default:
      return addMonths(viewDate, delta);
  }
};

const resolveDropTargetDate = (
  dropTargetId: string,
  viewMode: ViewMode,
  activeEventDate: Date,
  activeEventHasTime: boolean
): DropTargetResolution | null => {
  const dropParts = dropTargetId.split('-');
  if (dropParts[0] !== 'drop' || dropParts.length < 4) {
    return null;
  }

  const year = parseInt(dropParts[1], 10);
  const month = parseInt(dropParts[2], 10) - 1;
  const day = parseInt(dropParts[3], 10);
  const hour = dropParts.length > 4 ? parseInt(dropParts[4], 10) : undefined;

  if ([year, month, day].some((part) => Number.isNaN(part))) {
    return null;
  }
  if (hour !== undefined && Number.isNaN(hour)) {
    return null;
  }

  const newDate = new Date(year, month, day);
  const includeTime = hour !== undefined && (viewMode === 'day' || viewMode === 'week');

  if (includeTime) {
    newDate.setHours(hour, 0, 0, 0);
  } else if (activeEventHasTime && viewMode === 'month') {
    newDate.setHours(activeEventDate.getHours(), activeEventDate.getMinutes(), 0, 0);
  }

  return {
    newDate,
    includeTime,
  };
};

export function buildCalendarEvents(
  items: CalendarItem[],
  viewDate: Date,
  viewMode: ViewMode,
  todayStr = localISODate(new Date())
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  const { start: viewStart, end: viewEnd } = getViewWindow(viewDate, viewMode);

  items.forEach((item) => {
    if (item.type === 'google-event') {
      const startDate = item.focusDate || item.dueDate;
      const endDate = item.endDate || item.dueDate;

      if (startDate) {
        const date = typeof startDate === 'string' ? parseISO(startDate) : startDate;
        const end = endDate ? (typeof endDate === 'string' ? parseISO(endDate) : endDate) : null;

        if (isValid(date)) {
          let formattedTime: string | undefined;
          if (hasTimeComponent(startDate)) {
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
            formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
          }

          let duration: number | undefined;
          let endTimeFormatted: string | undefined;
          if (end && isValid(end)) {
            duration = Math.round((end.getTime() - date.getTime()) / (1000 * 60));

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
            date,
            time: formattedTime,
            endDate: end || undefined,
            endTime: endTimeFormatted,
            duration,
            path: item.path,
            location: item.location,
            attendees: item.attendees,
            meetingLink: item.meetingLink,
            description: item.description,
          });
        }
      }
      return;
    }

    if (item.type === 'habit' && item.frequency && item.createdDateTime) {
      const habitDates = generateHabitDates(item.createdDateTime, item.frequency, viewStart, viewEnd);

      let timeString: string | undefined;
      let formattedTime: string | undefined;
      if (item.focusDate && hasTimeComponent(item.focusDate)) {
        const focusDate = parseISO(item.focusDate);
        if (isValid(focusDate)) {
          const hours = focusDate.getHours();
          const minutes = focusDate.getMinutes();
          timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          const period = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
          formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
        }
      }

      habitDates.forEach((date, index) => {
        let eventDate = date;
        if (timeString) {
          const [hours, minutes] = timeString.split(':').map(Number);
          eventDate = new Date(date);
          eventDate.setHours(hours, minutes, 0, 0);
        }

        const eventStatus = isHabitCompletedOnDate(
          {
            status: item.status === 'completed' ? 'completed' : 'todo',
            periodHistory: item.habitPeriodHistory,
          },
          localISODate(eventDate),
          todayStr
        )
          ? 'completed'
          : 'todo';

        events.push({
          id: `${item.path}-habit-${index}-${date.getTime()}`,
          title: item.name,
          type: 'habit',
          status: eventStatus,
          eventType: 'habit',
          date: eventDate,
          path: item.path,
          projectName: undefined,
          frequency: item.frequency,
          time: formattedTime,
        });
      });
      return;
    }

    if (item.dueDate) {
      const dueDate = typeof item.dueDate === 'string' ? parseISO(item.dueDate) : item.dueDate;
      if (isValid(dueDate)) {
        let formattedTime: string | undefined;
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
        let formattedTime: string | undefined;
        if (item.focusDate && hasTimeComponent(item.focusDate)) {
          const hours = focusDate.getHours();
          const minutes = focusDate.getMinutes();
          const period = hours >= 12 ? 'PM' : 'AM';
          const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
          formattedTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
        }

        let duration: number | undefined;
        let endDate: Date | undefined;
        let endTimeFormatted: string | undefined;

        if (item.type === 'action' && item.effort) {
          duration = getEffortDuration(item.effort);
          endDate = new Date(focusDate.getTime() + duration * 60 * 1000);

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
          endDate,
          endTime: endTimeFormatted,
          duration,
          path: item.path,
          projectName: item.projectName,
          effort: item.effort
        });
      }
    }
  });

  return events;
}

// Expose key calendar helpers for regression tests without rendering the full UI.
export const __calendarViewInternals = {
  buildCalendarEvents,
  getDisplayDays,
  getNextViewDate,
  getViewTitle,
  getViewWindow,
  resolveDropTargetDate,
};

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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const originalEventHeightRef = useRef<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [showHandle, setShowHandle] = useState(false);

  const getRenderedEventBox = () =>
    wrapperRef.current?.querySelector<HTMLElement>('[data-calendar-event-box="true"]') ?? null;
  
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setStartY(e.clientY);
    const eventBox = getRenderedEventBox();
    const fallbackElement = e.currentTarget.parentElement;
    const height = eventBox?.getBoundingClientRect().height ?? fallbackElement?.getBoundingClientRect().height ?? 0;
    if (height > 0) {
      setStartHeight(height);
      setCurrentHeight(height);
    }
  };

  useEffect(() => {
    const eventBox = getRenderedEventBox();
    if (!eventBox) return;

    if (!isResizing || currentHeight === null) {
      if (originalEventHeightRef.current !== null) {
        eventBox.style.height = originalEventHeightRef.current;
        originalEventHeightRef.current = null;
      }
      return;
    }

    if (originalEventHeightRef.current === null) {
      originalEventHeightRef.current = eventBox.style.height;
    }

    eventBox.style.height = `${currentHeight}px`;
  }, [isResizing, currentHeight]);

  useEffect(() => {
    return () => {
      const eventBox = getRenderedEventBox();
      if (eventBox && originalEventHeightRef.current !== null) {
        eventBox.style.height = originalEventHeightRef.current;
      }
    };
  }, []);

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
      ref={wrapperRef}
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
interface DroppableCellProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string;
  children: React.ReactNode;
  onActivate?: () => void;
}

const DroppableCell: React.FC<DroppableCellProps> = ({
  id,
  children,
  className,
  onActivate,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  ...props
}) => {
  const {
    isOver,
    setNodeRef,
  } = useDroppable({
    id,
  });

  const isInteractive = typeof onActivate === 'function' || typeof onClick === 'function';

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    onActivate?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);

    if (event.defaultPrevented || !isInteractive) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.currentTarget.click();
    }
  };

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={isInteractive ? role ?? 'button' : role}
      tabIndex={isInteractive ? tabIndex ?? 0 : tabIndex}
      {...props}
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
  const [viewDate, setViewDate] = useState<Date>(new Date());
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
  const todayStr = localISODate(currentTime);

  // Auto-scroll to 7am when timed views load
  useEffect(() => {
    if (viewMode !== 'day' && viewMode !== 'week') {
      return;
    }

    // Find the ScrollArea's viewport element specifically in the timed grid
    // ScrollArea creates a div with data-radix-scroll-area-viewport
    const scrollToMorning = () => {
      const timedGrid = document.getElementById('timed-calendar-grid');
      if (timedGrid) {
        const scrollViewport = timedGrid.querySelector('[data-radix-scroll-area-viewport]');

        if (scrollViewport && scrollViewport instanceof HTMLElement) {
          // Each hour row is 80px (h-20), scroll to 7am
          const targetHour = 7;
          const scrollPosition = targetHour * 80;
          scrollViewport.scrollTop = scrollPosition;
        }
      }
    };

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const rafId = requestAnimationFrame(() => {
      // Additional delay for ScrollArea to fully initialize
      timeoutId = setTimeout(scrollToMorning, 200);
    });

    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [viewMode, viewDate]); // Re-scroll when changing periods or switching timed views

  // Process items into calendar events
  const calendarEvents = useMemo(
    () => buildCalendarEvents(items, viewDate, viewMode, todayStr),
    [items, viewDate, viewMode, todayStr]
  );

  // Get calendar days for current view
  const calendarDays = useMemo(() => getDisplayDays(viewDate, viewMode), [viewDate, viewMode]);

  const timedGridTemplate = useMemo(
    () => ({ gridTemplateColumns: `4rem repeat(${calendarDays.length}, minmax(0, 1fr))` }),
    [calendarDays.length]
  );

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

  const handleDayDrillIn = (day: Date) => {
    setViewDate(new Date(day));
    setViewMode('day');
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
    const resolvedDropTarget = resolveDropTargetDate(
      droppedOnId,
      viewMode,
      activeEvent.date,
      Boolean(activeEvent.time)
    );

    if (!resolvedDropTarget) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const { newDate, includeTime } = resolvedDropTarget;

    const preserveExistingTime = viewMode === 'month' && Boolean(activeEvent.time);
    const currentFormattedDate = formatDateForMarkdown(activeEvent.date, Boolean(activeEvent.time));
    const formattedDate = formatDateForMarkdown(newDate, includeTime || preserveExistingTime);

    if (currentFormattedDate === formattedDate) {
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
    setViewDate(prev => getNextViewDate(prev, viewMode, direction));
  };

  const goToToday = () => {
    setViewDate(new Date());
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

  const renderTimedGrid = () => (
    <div className="h-full bg-card rounded-lg border overflow-hidden flex flex-col">
      <div className="grid border-b bg-card z-10" style={timedGridTemplate}>
        <div className="p-2 text-xs font-medium text-muted-foreground border-r">
          {/* Empty corner for time column */}
        </div>
        {calendarDays.map(day => {
          const headerContent = (
            <>
              <div className="text-xs text-muted-foreground">
                {formatAbsoluteDate(day, viewMode === 'day' ? 'EEEE' : 'EEE')}
              </div>
              <div className={cn(
                "text-lg font-medium",
                isToday(day) && "text-blue-600 dark:text-blue-400"
              )}>
                {formatAbsoluteDate(day, 'd')}
              </div>
            </>
          );

          const headerClassName = cn(
            "p-2 text-center border-r last:border-r-0",
            isToday(day) && "bg-blue-50/50 dark:bg-blue-950/20"
          );

          if (viewMode === 'week') {
            return (
              <button
                key={day.toISOString()}
                type="button"
                data-testid={`week-day-header-${format(day, 'yyyy-MM-dd')}`}
                className={cn(
                  headerClassName,
                  "bg-transparent hover:bg-accent/5 transition-colors"
                )}
                onClick={() => handleDayDrillIn(day)}
              >
                {headerContent}
              </button>
            );
          }

          return (
            <div key={day.toISOString()} className={headerClassName}>
              {headerContent}
            </div>
          );
        })}
      </div>

      <div className="grid border-b min-h-[3rem] bg-muted/30" style={timedGridTemplate}>
        <div className="p-2 text-xs text-muted-foreground border-r">
          No time
        </div>
        {calendarDays.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDate.get(dateKey) || [];
          const allDayEvents = dayEvents.filter(event => !event.time);

          return (
            <DroppableCell
              key={`${day.toISOString()}-allday`}
              id={`drop-${dateKey}`}
              className={cn(
                "border-r last:border-r-0 p-1",
                isToday(day) && "bg-blue-50/30 dark:bg-blue-950/10"
              )}
            >
              <div className="space-y-1" data-testid={`untimed-cell-${dateKey}`}>
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

      <ScrollArea className="flex-1 h-full" id="timed-calendar-grid">
        <div className="relative">
          {(() => {
            const now = currentTime;
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();
            const topPosition = (currentHour * 80) + (currentMinutes / 60 * 80);
            const todayIndex = calendarDays.findIndex(day => isToday(day));

            if (todayIndex >= 0 && currentHour >= 0 && currentHour < 24) {
              const dayColumnLeft = `calc(4rem + ${todayIndex} * ((100% - 4rem) / ${calendarDays.length}))`;
              const dayColumnWidth = `calc((100% - 4rem) / ${calendarDays.length})`;

              return (
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    top: `${topPosition}px`,
                    left: dayColumnLeft,
                    width: dayColumnWidth,
                    transform: 'translateY(-50%)',
                  }}
                >
                  <span className="absolute -left-14 top-1/2 -translate-y-1/2 text-xs font-medium text-red-500 bg-background px-1 rounded whitespace-nowrap">
                    {formatAbsoluteTime(now, 'h:mm a')}
                  </span>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <div className="flex-1 h-0.5 bg-red-500" />
                  </div>
                </div>
              );
            }

            return null;
          })()}
          {weekHours.map(hour => (
            <div key={hour} className="grid border-b h-20" style={timedGridTemplate}>
              <div className="p-2 text-xs text-muted-foreground border-r">
                {formatAbsoluteTime(setHours(new Date(), hour), 'ha')}
              </div>
              {calendarDays.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDate.get(dateKey) || [];
                const hourEvents = dayEvents.filter(event => {
                  if (!event.time) return false;
                  const eventStartHour = event.date.getHours();
                  const eventEndHour = event.endDate ? event.endDate.getHours() : eventStartHour;
                  const eventEndMinute = event.endDate ? event.endDate.getMinutes() : event.date.getMinutes();

                  if (eventStartHour === hour) {
                    return true;
                  }

                  if (event.duration && eventStartHour < hour) {
                    const endHour = eventEndMinute > 0 ? eventEndHour : eventEndHour - 1;
                    return hour <= endHour;
                  }

                  return false;
                });

                return (
                  <DroppableCell
                    key={`${day.toISOString()}-${hour}`}
                    id={`drop-${dateKey}-${hour}`}
                    className={cn(
                      "relative border-r last:border-r-0 p-1",
                      "hover:bg-accent/5 transition-colors",
                      isToday(day) && "bg-blue-50/30 dark:bg-blue-950/10"
                    )}
                  >
                    <div data-testid={`hour-cell-${dateKey}-${hour}`}>
                      {(() => {
                        const startingEvents = hourEvents.filter(ev => ev.date.getHours() === hour);
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
                                let eventHeight = 'auto';
                                const minuteOffset = (min / 60) * 80;

                                if (event.duration) {
                                  const heightInPixels = (event.duration / 60) * 80;
                                  eventHeight = `${Math.max(20, heightInPixels)}px`;
                                }

                                const width = group.length > 1 ? `${100 / group.length}%` : '100%';
                                const left = group.length > 1 ? `${(100 / group.length) * index}%` : '0';

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
                                        data-calendar-event-box="true"
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
                                          left,
                                          width,
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
                    </div>
                  </DroppableCell>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

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
              aria-label={`Previous ${viewMode}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <h2 className="text-lg font-medium min-w-[16rem] text-center">
              {getViewTitle(viewDate, viewMode)}
            </h2>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('next')}
              className="h-8 w-8"
              aria-label={`Next ${viewMode}`}
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
              variant={viewMode === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('day')}
              className="h-7 px-3"
            >
              Day
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
              className="h-7 px-3"
            >
              Week
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
              className="h-7 px-3"
            >
              Month
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
                const isCurrentMonth = isSameMonth(day, viewDate);
                const isTodayDate = isToday(day);

                const dropId = `drop-${format(day, 'yyyy-MM-dd')}`;
                
                return (
                  <DroppableCell
                    key={day.toISOString()}
                    id={dropId}
                    data-testid={`month-day-cell-${dateKey}`}
                    onActivate={() => handleDayDrillIn(day)}
                    aria-label={`Open ${formatAbsoluteDate(day, 'EEEE, MMM d, yyyy')} in day view`}
                    className={cn(
                      "border-r border-b last:border-r-0 p-1 overflow-hidden",
                      "hover:bg-accent/5 transition-colors cursor-pointer",
                      !isCurrentMonth && "bg-muted/30",
                      isTodayDate && "bg-blue-50/50 dark:bg-blue-950/20"
                    )}
                  >
                    <div>
                      {/* Day Number */}
                      <div className={cn(
                        "text-sm font-medium mb-1 px-1",
                        !isCurrentMonth && "text-muted-foreground",
                        isTodayDate && "text-blue-600 dark:text-blue-400"
                      )}>
                        {formatAbsoluteDate(day, 'd')}
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
        ) : renderTimedGrid()}
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
