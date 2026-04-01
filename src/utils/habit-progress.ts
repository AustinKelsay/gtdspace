import type { GTDHabitStatus } from '@/types';
import { habitHistoryRowToDate } from '@/utils/gtd-habit-markdown';
import { localISODate } from '@/utils/time';

export interface HabitCompletionEntryLike {
  date: string;
  time?: string;
  completed: boolean;
}

export interface HabitCompletionLike {
  status?: GTDHabitStatus;
  history?: HabitCompletionEntryLike[];
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
  const entries = Array.isArray(habit.history)
    ? habit.history.filter((entry) => entry.date === date)
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
