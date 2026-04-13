import type { GTDHabitFrequency, GTDHabitStatus } from '@/types';
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
  completionRate: number;
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

export function isHabitEligibleOnDate(
  habit: HabitCompletionLike,
  date: string
): boolean {
  const createdDate = toLocalDateString(habit.createdDateTime);
  if (createdDate && date < createdDate) {
    return false;
  }

  if (habit.frequency === 'weekdays' && isWeekendDate(date)) {
    return false;
  }

  return true;
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
      : 0,
  };
}
