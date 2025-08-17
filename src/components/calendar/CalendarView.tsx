/**
 * @fileoverview Calendar view component for displaying all dated GTD items
 * @author Development Team
 * @created 2025-01-17
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Target, 
  Circle, 
  CheckCircle2, 
  CircleDot,
  ChevronLeft,
  ChevronRight,
  FileText,
  Briefcase
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isValid } from 'date-fns';
import { useCalendarData } from '@/hooks/useCalendarData';
import type { MarkdownFile, GTDSpace } from '@/types';

interface CalendarViewProps {
  onFileSelect: (file: MarkdownFile) => void;
  spacePath: string;
  gtdSpace?: GTDSpace | null;
  files?: MarkdownFile[];
}

interface CalendarItem {
  id: string;
  title: string;
  type: 'project' | 'action' | 'habit';
  status?: string;
  dateType: 'due' | 'focus';
  date: Date;
  path: string;
  projectName?: string;
}

const getStatusIcon = (status?: string) => {
  switch (status) {
    case 'complete':
      return CheckCircle2;
    case 'waiting':
      return CircleDot;
    case 'in-progress':
    default:
      return Circle;
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'complete':
      return 'text-green-600 dark:text-green-400';
    case 'waiting':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'in-progress':
    default:
      return 'text-blue-600 dark:text-blue-400';
  }
};

export const CalendarView: React.FC<CalendarViewProps> = ({ onFileSelect, spacePath, gtdSpace, files }) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // Get all dated items from the hook
  const { items, isLoading, refresh } = useCalendarData(spacePath, gtdSpace, files);
  
  // Process items into calendar format
  const calendarItems = useMemo(() => {
    const processedItems: CalendarItem[] = [];
    
    items.forEach(item => {
      // Parse dates
      if (item.due_date) {
        const dueDate = typeof item.due_date === 'string' ? parseISO(item.due_date) : item.due_date;
        if (isValid(dueDate)) {
          processedItems.push({
            id: `${item.path}-due`,
            title: item.name,
            type: item.type,
            status: item.status,
            dateType: 'due',
            date: dueDate,
            path: item.path,
            projectName: item.projectName
          });
        }
      }
      
      if (item.focus_date) {
        const focusDate = typeof item.focus_date === 'string' ? parseISO(item.focus_date) : item.focus_date;
        if (isValid(focusDate)) {
          processedItems.push({
            id: `${item.path}-focus`,
            title: item.name,
            type: item.type,
            status: item.status,
            dateType: 'focus',
            date: focusDate,
            path: item.path,
            projectName: item.projectName
          });
        }
      }
    });
    
    return processedItems;
  }, [items]);
  
  // Get items for selected date
  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return [];
    return calendarItems.filter(item => isSameDay(item.date, selectedDate));
  }, [calendarItems, selectedDate]);
  
  // Get items for current month view
  const currentMonthItems = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    return calendarItems.filter(item => {
      return item.date >= start && item.date <= end;
    });
  }, [calendarItems, currentMonth]);
  
  // Get dates that have items
  const datesWithItems = useMemo(() => {
    const dateSet = new Set<string>();
    const dueSet = new Set<string>();
    const focusSet = new Set<string>();
    
    currentMonthItems.forEach(item => {
      const dayKey = format(item.date, 'yyyy-MM-dd');
      dateSet.add(dayKey);
      if (item.dateType === 'due') {
        dueSet.add(dayKey);
      } else {
        focusSet.add(dayKey);
      }
    });
    
    return { all: dateSet, due: dueSet, focus: focusSet };
  }, [currentMonthItems]);
  
  const handleItemClick = (item: CalendarItem) => {
    // Create a file object to open
    const file: MarkdownFile = {
      id: item.path,
      name: item.title,
      path: item.path,
      size: 0,
      last_modified: Date.now(),
      extension: 'md'
    };
    onFileSelect(file);
  };
  
  const handleMonthChange = (date: Date | undefined) => {
    if (date) {
      setCurrentMonth(date);
    }
  };
  
  return (
    <div className="flex h-full">
      {/* Calendar Panel */}
      <div className="flex-1 p-6">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              GTD Calendar
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="w-full max-w-md relative" style={{ contain: 'layout' }}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={currentMonth}
                onMonthChange={handleMonthChange}
                className="rounded-md border relative"
                modifiers={{
                  hasItems: (date: Date) => {
                    const dayKey = format(date, 'yyyy-MM-dd');
                    return datesWithItems.all.has(dayKey);
                  },
                  hasDue: (date: Date) => {
                    const dayKey = format(date, 'yyyy-MM-dd');
                    return datesWithItems.due.has(dayKey);
                  },
                  hasFocus: (date: Date) => {
                    const dayKey = format(date, 'yyyy-MM-dd');
                    return datesWithItems.focus.has(dayKey);
                  }
                }}
                modifiersClassNames={{
                  hasItems: 'font-bold',
                  hasDue: 'calendar-has-due',
                  hasFocus: 'calendar-has-focus'
                }}
              />
            </div>
            
            {/* Month Summary */}
            <div className="mt-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Month Overview</h3>
                <Button variant="ghost" size="sm" onClick={refresh}>
                  Refresh
                </Button>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: 'rgb(var(--calendar-due-color))' }}
                  />
                  <span className="text-muted-foreground">
                    {currentMonthItems.filter(i => i.dateType === 'due').length} Due Dates
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: 'rgb(var(--calendar-focus-color))' }}
                  />
                  <span className="text-muted-foreground">
                    {currentMonthItems.filter(i => i.dateType === 'focus').length} Focus Dates
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Selected Date Items Panel */}
      <div className="w-96 border-l bg-muted/30 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
          </h2>
          {selectedDateItems.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {selectedDateItems.length} item{selectedDateItems.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        
        <ScrollArea className="h-[calc(100vh-200px)]">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading items...
            </div>
          ) : selectedDateItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {selectedDate ? 'No items scheduled for this date' : 'Select a date to view items'}
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateItems.map(item => {
                const StatusIcon = getStatusIcon(item.status);
                const TypeIcon = item.type === 'project' ? Briefcase : FileText;
                
                return (
                  <Card
                    key={item.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleItemClick(item)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <TypeIcon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm truncate">{item.title}</h3>
                            <Badge 
                              variant={item.dateType === 'due' ? 'destructive' : 'default'}
                              className="text-xs px-1 py-0"
                            >
                              {item.dateType === 'due' ? 'Due' : 'Focus'}
                            </Badge>
                          </div>
                          
                          {item.projectName && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {item.projectName}
                            </p>
                          )}
                          
                          {item.status && (
                            <div className="flex items-center gap-1 mt-1">
                              <StatusIcon className={`h-3 w-3 ${getStatusColor(item.status)}`} />
                              <span className="text-xs capitalize">{item.status}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {item.dateType === 'focus' && item.date.getHours() !== 0 
                              ? format(item.date, 'h:mm a')
                              : 'All day'
                            }
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};