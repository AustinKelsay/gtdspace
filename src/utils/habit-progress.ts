import type { GTDHabitFrequency, GTDHabitStatus } from '@/types';
import { addDays, addMonths, addWeeks, isValid, parseISO } from 'date-fns';
import { habitHistoryRowToDate } from '@/utils/gtd-habit-markdown';
import { localISODate } from '@/utils/time';

export interface HabitCompletionEntryLike {
  date: string;
  time?: string;
  completed: boolean;
  action?: string;
  note?: string;
}

export interface HabitCompletionLike {
  status?: GTDHabitStatus;
  frequency?: GTDHabitFrequency;
  createdDateTime?: string;
  history?: HabitCompletionEntryLike[];
  periodHistory?: HabitCompletionEntryLike[];
}

export interface HabitProgressSummary {
  totalCount: number;
  eligibleCount: number;
  completedCount: number;
  completionRate: number | null;
}

function compareEntriesDescending(
  left: HabitCompletionEntryLike,
  right: HabitCompletionEntryLike
): number {
  const leftDate = habitHistoryRowToDate(left);
  const rightDate = habitHistoryRowToDate(right);

  if (leftDate && rightDate) {
    return rightDate.getTime() - leftDate.getTime();
  }
  if (leftDate) {
    return -1;
  }
  if (rightDate) {
    return 1;
  }

  return 0;
}

export function getLatestHabitEntryForDate(
  habit: HabitCompletionLike,
  date: string
): HabitCompletionEntryLike | undefined {
  const sourceEntries = Array.isArray(habit.periodHistory) && habit.periodHistory.length > 0
    ? habit.periodHistory
    : habit.history;
  const entries = Array.isArray(sourceEntries)
    ? sourceEntries.filter((entry) => entry.date === date)
    : [];

  if (entries.length === 0) {
    return undefined;
  }

  return [...entries].sort(compareEntriesDescending)[0];
}

export function isHabitCompletedOnDate(
  habit: HabitCompletionLike,
  date: string,
  today = localISODate(new Date())
): boolean {
  const latestEntry = getLatestHabitEntryForDate(habit, date);
  if (latestEntry) {
    return latestEntry.completed;
  }

  return date === today && habit.status === 'completed';
}

export function countHabitsCompletedOnDate(
  habits: HabitCompletionLike[],
  date: string,
  today = localISODate(new Date())
): number {
  return habits.filter((habit) => isHabitCompletedOnDate(habit, date, today)).length;
}

function toLocalDateString(raw?: string): string | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return localISODate(parsed);
  }

  const fallback = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return fallback?.[1] ?? null;
}

function isWeekendDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const day = parsed.getDay();
  return day === 0 || day === 6;
}

function getNextScheduledHabitDate(currentDate: Date, frequency: GTDHabitFrequency): Date {
  switch (frequency) {
    case '5-minute':
    case 'daily':
    case 'weekdays':
      return addDays(currentDate, 1);
    case 'every-other-day':
      return addDays(currentDate, 2);
    case 'twice-weekly':
      return addDays(currentDate, 3);
    case 'weekly':
      return addWeeks(currentDate, 1);
    case 'biweekly':
      return addWeeks(currentDate, 2);
    case 'monthly':
      return addMonths(currentDate, 1);
    default:
      return addDays(currentDate, 1);
  }
}

function fastForwardHabitSchedule(
  created: Date,
  targetDate: Date,
  frequency: GTDHabitFrequency
): Date {
  if (created >= targetDate) {
    return created;
  }

  const daysDiff = Math.floor((targetDate.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

  switch (frequency) {
    case '5-minute':
    case 'daily':
    case 'weekdays':
      return addDays(created, daysDiff);
    case 'every-other-day': {
      const cycles = Math.floor(daysDiff / 2);
      return addDays(created, cycles * 2);
    }
    case 'twice-weekly': {
      const cycles = Math.floor(daysDiff / 3);
      return addDays(created, cycles * 3);
    }
    case 'weekly': {
      const weeks = Math.floor(daysDiff / 7);
      return addWeeks(created, weeks);
    }
    case 'biweekly': {
      const biweeks = Math.floor(daysDiff / 14);
      return addWeeks(created, biweeks * 2);
    }
    case 'monthly': {
      const monthsDiff = Math.floor(daysDiff / 30);
      return addMonths(created, monthsDiff);
    }
    default:
      return addDays(created, daysDiff);
  }
}

function isHabitScheduledOnDate(
  habit: HabitCompletionLike,
  date: string
): boolean {
  const frequency = habit.frequency;

  if (!frequency || frequency === 'daily' || frequency === '5-minute') {
    return true;
  }

  if (frequency === 'weekdays') {
    return !isWeekendDate(date);
  }

  const targetDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(targetDate.getTime())) {
    return false;
  }

  const created = habit.createdDateTime ? parseISO(habit.createdDateTime) : null;
  if (!created || !isValid(created)) {
    return true;
  }

  let currentDate = fastForwardHabitSchedule(created, targetDate, frequency);

  while (localISODate(currentDate) <= date) {
    if (localISODate(currentDate) === date) {
      return true;
    }

    currentDate = getNextScheduledHabitDate(currentDate, frequency);
  }

  return false;
}

export function isHabitEligibleOnDate(
  habit: HabitCompletionLike,
  date: string
): boolean {
  const createdDate = toLocalDateString(habit.createdDateTime);
  if (createdDate && date < createdDate) {
    return false;
  }

  return isHabitScheduledOnDate(habit, date);
}

export function countHabitsEligibleOnDate(
  habits: HabitCompletionLike[],
  date: string
): number {
  return habits.filter((habit) => isHabitEligibleOnDate(habit, date)).length;
}

export function summarizeHabitProgressOnDate(
  habits: HabitCompletionLike[],
  date: string,
  today = localISODate(new Date())
): HabitProgressSummary {
  const eligibleHabits = habits.filter((habit) => isHabitEligibleOnDate(habit, date));
  const completedCount = countHabitsCompletedOnDate(eligibleHabits, date, today);
  const eligibleCount = eligibleHabits.length;

  return {
    totalCount: habits.length,
    eligibleCount,
    completedCount,
    completionRate: eligibleCount > 0
      ? Math.round((completedCount / eligibleCount) * 100)
      : null,
  };
}
