// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { __calendarViewInternals } from '@/components/calendar/CalendarView';
import type { CalendarItem } from '@/hooks/useCalendarData';
import { localISODate } from '@/utils/time';

const buildHabitItem = (overrides: Partial<CalendarItem> = {}): CalendarItem => ({
  id: 'habit-1',
  name: 'Habit',
  path: '/space/Habits/habit.md',
  type: 'habit',
  status: 'todo',
  frequency: 'daily',
  createdDateTime: '2026-04-01T08:00:00Z',
  habitPeriodHistory: [],
  ...overrides,
});

describe('calendar habit event generation', () => {
  it('marks only the matching completion date as completed', () => {
    const events = __calendarViewInternals.buildCalendarEvents(
      [
        buildHabitItem({
          habitPeriodHistory: [
            { date: '2026-04-10', time: '08:00 AM', completed: true, action: 'Manual' },
          ],
        }),
      ],
      new Date('2026-04-10T12:00:00'),
      'week',
      '2026-04-10'
    );

    const completedDates = events
      .filter((event) => event.type === 'habit' && event.status === 'completed')
      .map((event) => localISODate(event.date));

    expect(completedDates).toEqual(['2026-04-10']);
  });

  it('does not mark future occurrences completed just because today is completed', () => {
    const events = __calendarViewInternals.buildCalendarEvents(
      [
        buildHabitItem({
          status: 'completed',
          habitPeriodHistory: [],
        }),
      ],
      new Date('2026-04-10T12:00:00'),
      'week',
      '2026-04-10'
    );

    const todayEvent = events.find((event) => localISODate(event.date) === '2026-04-10');
    const futureEvent = events.find((event) => localISODate(event.date) === '2026-04-11');

    expect(todayEvent?.status).toBe('completed');
    expect(futureEvent?.status).toBe('todo');
  });

  it('treats repaired auto-reset rows as incomplete for that day', () => {
    const events = __calendarViewInternals.buildCalendarEvents(
      [
        buildHabitItem({
          habitPeriodHistory: [
            { date: '2026-04-10', time: '12:00 AM', completed: false, action: 'Auto-Reset' },
          ],
        }),
      ],
      new Date('2026-04-10T12:00:00'),
      'week',
      '2026-04-10'
    );

    const todayEvent = events.find((event) => localISODate(event.date) === '2026-04-10');

    expect(todayEvent?.status).toBe('todo');
  });

  it('limits daily habit occurrences to the active day window in day mode', () => {
    const events = __calendarViewInternals.buildCalendarEvents(
      [buildHabitItem()],
      new Date('2026-04-10T12:00:00'),
      'day',
      '2026-04-10'
    );

    const habitDates = events
      .filter((event) => event.type === 'habit')
      .map((event) => localISODate(event.date));

    expect(habitDates).toEqual(['2026-04-10']);
  });
});

describe('calendar drop target resolution', () => {
  it('treats day-view hour drops as timed updates', () => {
    const resolved = __calendarViewInternals.resolveDropTargetDate(
      'drop-2026-04-15-9',
      'day',
      new Date('2026-04-14T14:30:00'),
      true
    );

    expect(resolved).not.toBeNull();
    expect(resolved?.includeTime).toBe(true);
    expect(resolved?.newDate.getFullYear()).toBe(2026);
    expect(resolved?.newDate.getMonth()).toBe(3);
    expect(resolved?.newDate.getDate()).toBe(15);
    expect(resolved?.newDate.getHours()).toBe(9);
    expect(resolved?.newDate.getMinutes()).toBe(0);
  });

  it('treats day-view no-time drops as date-only updates', () => {
    const resolved = __calendarViewInternals.resolveDropTargetDate(
      'drop-2026-04-15',
      'day',
      new Date('2026-04-14T14:30:00'),
      true
    );

    expect(resolved).not.toBeNull();
    expect(resolved?.includeTime).toBe(false);
    expect(resolved?.newDate.getFullYear()).toBe(2026);
    expect(resolved?.newDate.getMonth()).toBe(3);
    expect(resolved?.newDate.getDate()).toBe(15);
    expect(resolved?.newDate.getHours()).toBe(0);
    expect(resolved?.newDate.getMinutes()).toBe(0);
  });
});
