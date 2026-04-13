/**
 * @fileoverview Hook for loading habits with complete history tracking and analytics
 * Provides habit data with streaks, success rates, and historical patterns
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { localISODate, toISOStringFromEpoch } from '@/utils/time';
import type { GTDHabit, MarkdownFile } from '@/types';
import { createScopedLogger } from '@/utils/logger';
import { summarizeHabitProgressOnDate } from '@/utils/habit-progress';
import { emitMetadataChange } from '@/utils/content-event-bus';
import { norm } from '@/utils/path';
import {
  calculateNextHabitReset,
  isHabitHistoryStatusCompleted,
  isHabitResetAction,
  parseHabitContent,
  toHabitPeriodHistory,
} from '@/utils/gtd-habit-markdown';

export interface HabitHistoryEntry {
  date: string;
  completed: boolean;
  note?: string;
  time?: string;
  action?: string;
}

export interface HabitWithHistory extends GTDHabit {
  history: HabitHistoryEntry[];
  periodHistory: HabitHistoryEntry[];
  currentStreak: number;
  bestStreak: number;
  averageStreak: number;
  successRate: number;
  lastCompleted?: string;
  totalCompletions: number;
  totalAttempts: number;
  weeklyPattern?: number[]; // Success rate by day of week (0=Sunday)
  monthlyPattern?: number[]; // Success rate by day of month
  recentTrend: 'improving' | 'declining' | 'stable';
  // Horizon references
  linkedProjects?: string[];
  linkedAreas?: string[];
  linkedGoals?: string[];
  linkedVision?: string[];
  linkedPurpose?: string[];
}

interface UseHabitsHistoryOptions {
  autoLoad?: boolean;
  historyDays?: number; // How many days of history to analyze (default: 90)
  includeInactive?: boolean;
}

interface UseHabitsHistoryReturn {
  habits: HabitWithHistory[];
  isLoading: boolean;
  error: string | null;
  summary: {
    total: number;
    eligibleToday: number;
    completedToday: number;
    streaksActive: number;
    averageSuccessRate: number;
    needingAttention: string[]; // Habits with declining trends
  };
  analytics: {
    bestPerformer?: HabitWithHistory;
    longestStreak?: { habit: string; days: number };
    mostConsistent?: HabitWithHistory;
  };
  loadHabits: (spacePath: string) => Promise<void>;
  updateHabitStatus: (
    habitPath: string,
    next: 'completed' | 'todo'
  ) => Promise<boolean | null>;
  refresh: () => Promise<void>;
}

/**
 * Parse habit history from markdown table format
 */
const habitsLog = createScopedLogger('useHabitsHistory');
const CREATED_AT_FALLBACK_WINDOW_MS = 5_000;

/**
 * Calculate the next reset time based on frequency
 */
export const calculateNextReset = (frequency: GTDHabit['frequency'], lastUpdate?: Date): string => {
  return calculateNextHabitReset(frequency, lastUpdate).toISOString();
};

export function toAnalyticsHistory(
  rows: Array<{ date: string; time: string; status: string; action: string; details: string }>
): HabitHistoryEntry[] {
  return rows
    .filter((row) => !isHabitResetAction(row.action))
    .map((row) => ({
      date: row.date,
      time: row.time,
      completed: isHabitHistoryStatusCompleted(row.status),
      action: row.action,
      note: row.details || row.action || undefined,
    }));
}

/**
 * Analyze habit patterns and trends
 */
const analyzeHabitPatterns = (history: HabitHistoryEntry[], days: number = 90) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const recentHistory = history.filter(entry => 
    new Date(`${entry.date}T00:00:00`) >= cutoffDate
  );
  
  // Calculate streaks
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  const streaks: number[] = [];
  
  // Sort by date descending for current streak calculation
  const sortedHistory = [...recentHistory].sort((a, b) => 
    b.date.localeCompare(a.date)
  );
  
  // Calculate current streak from most recent
  for (const entry of sortedHistory) {
    if (entry.completed) {
      currentStreak++;
    } else {
      break;
    }
  }
  
  // Calculate all streaks for best and average
  // Sort history in ascending chronological order for accurate streak calculation
  const sortedHistoryAsc = [...recentHistory].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  for (const entry of sortedHistoryAsc) {
    if (entry.completed) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      if (tempStreak > 0) {
        streaks.push(tempStreak);
        tempStreak = 0;
      }
    }
  }
  if (tempStreak > 0) {
    streaks.push(tempStreak);
  }
  
  const averageStreak = streaks.length > 0
    ? Math.round(streaks.reduce((sum, s) => sum + s, 0) / streaks.length)
    : 0;
  
  // Calculate patterns
  const weeklyPattern = new Array(7).fill(0);
  const weeklyCount = new Array(7).fill(0);
  const monthlyPattern = new Array(31).fill(0);
  const monthlyCount = new Array(31).fill(0);
  
  recentHistory.forEach(entry => {
    const date = new Date(`${entry.date}T00:00:00`);
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate() - 1;
    
    weeklyCount[dayOfWeek]++;
    monthlyCount[dayOfMonth]++;
    
    if (entry.completed) {
      weeklyPattern[dayOfWeek]++;
      monthlyPattern[dayOfMonth]++;
    }
  });
  
  // Convert to percentages
  for (let i = 0; i < 7; i++) {
    weeklyPattern[i] = weeklyCount[i] > 0 
      ? Math.round((weeklyPattern[i] / weeklyCount[i]) * 100)
      : 0;
  }
  
  for (let i = 0; i < 31; i++) {
    monthlyPattern[i] = monthlyCount[i] > 0
      ? Math.round((monthlyPattern[i] / monthlyCount[i]) * 100)
      : 0;
  }
  
  // Analyze trend (compare last 30 days to previous 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  const recentPeriod = recentHistory.filter(e => 
    new Date(`${e.date}T00:00:00`) >= thirtyDaysAgo
  );
  const previousPeriod = recentHistory.filter(e => {
    const d = new Date(`${e.date}T00:00:00`);
    return d >= sixtyDaysAgo && d < thirtyDaysAgo;
  });
  
  const recentRate = recentPeriod.length > 0
    ? recentPeriod.filter(e => e.completed).length / recentPeriod.length
    : 0;
  const previousRate = previousPeriod.length > 0
    ? previousPeriod.filter(e => e.completed).length / previousPeriod.length
    : 0;
  
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentRate > previousRate + 0.1) trend = 'improving';
  else if (recentRate < previousRate - 0.1) trend = 'declining';
  
  return {
    currentStreak,
    bestStreak,
    averageStreak,
    weeklyPattern,
    monthlyPattern,
    recentTrend: trend
  };
};

export function useHabitsHistory(options: UseHabitsHistoryOptions = {}): UseHabitsHistoryReturn {
  const {
    autoLoad = false,
    historyDays = 90,
    includeInactive = true
  } = options;
  const { withErrorHandling } = useErrorHandler();

  const [habits, setHabits] = useState<HabitWithHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedSpacePath, setCachedSpacePath] = useState<string>('');
  
  const loadHabits = useCallback(async (spacePath: string) => {
    habitsLog.debug('Loading habits from path', spacePath);

    if (!spacePath || spacePath.trim() === '') {
      habitsLog.error('Invalid spacePath provided', spacePath);
      setError('Invalid workspace path');
      setHabits([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    setCachedSpacePath(spacePath);

    try {
      const habitsPath = `${spacePath}/Habits`;
      habitsLog.debug('Attempting to list files from', habitsPath);

      // Try to list files with better error handling
      let habitFiles: MarkdownFile[] = [];
      try {
        habitFiles = await safeInvoke<MarkdownFile[]>(
          'list_markdown_files',
          { path: habitsPath },
          []
        );
      } catch (invokeError) {
        habitsLog.error('Error invoking list_markdown_files', invokeError);
        // Return empty array but continue - the directory might just not exist yet
        habitFiles = [];
      }

      habitsLog.debug('Found habit files', {
        count: habitFiles.length,
        names: habitFiles.map(f => f.name),
      });
      
      const loadedHabits = await Promise.all(
        habitFiles.map(async (file) => {
          try {
            const content = await withErrorHandling(
              () => safeInvoke<string>('read_file', { path: file.path }, ''),
              'Failed to read habit file',
              'habit'
            );
            if (content === null) {
              return null;
            }
            const parsedHabit = parseHabitContent(content);
            const periodHistory = toHabitPeriodHistory(parsedHabit.historyRows);
            const history = toAnalyticsHistory(parsedHabit.historyRows);
            habitsLog.debug(`Habit "${file.name}" history entries`, {
              analytics: history.length,
              periods: periodHistory.length,
            });

            // Filter inactive if needed
            if (!includeInactive && periodHistory.length === 0) {
              habitsLog.debug(`Filtering out inactive habit: ${file.name}`);
              return null;
            }
            
            // Calculate analytics
            const patterns = analyzeHabitPatterns(history, historyDays);
            
            // Calculate success rate
            const totalAttempts = history.length;
            const totalCompletions = history.filter(h => h.completed).length;
            const successRate = totalAttempts > 0
              ? Math.round((totalCompletions / totalAttempts) * 100)
              : 0;
            
            // Find last completed
            const lastCompleted = history
              .filter(h => h.completed)
              .sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
            const fallbackName = file.name.replace(/\.(md|markdown)$/i, '');
            const habitName =
              parsedHabit.title && parsedHabit.title !== 'Untitled'
                ? parsedHabit.title
                : fallbackName;
            const parsedCreatedAt = parsedHabit.createdDateTime
              ? Date.parse(parsedHabit.createdDateTime)
              : NaN;
            const createdDateTime =
              Number.isNaN(parsedCreatedAt) ||
              Math.abs(Date.now() - parsedCreatedAt) <= CREATED_AT_FALLBACK_WINDOW_MS
                ? toISOStringFromEpoch(file.last_modified)
                : parsedHabit.createdDateTime;
            
            const habit: HabitWithHistory = {
              name: habitName,
              frequency: parsedHabit.frequency,
              status: parsedHabit.status,
              path: file.path,
              last_updated: toISOStringFromEpoch(file.last_modified),
              createdDateTime,
              history,
              periodHistory,
              currentStreak: patterns.currentStreak,
              bestStreak: patterns.bestStreak,
              averageStreak: patterns.averageStreak,
              successRate,
              lastCompleted,
              totalCompletions,
              totalAttempts,
              weeklyPattern: patterns.weeklyPattern,
              monthlyPattern: patterns.monthlyPattern,
              recentTrend: patterns.recentTrend,
              linkedProjects: parsedHabit.references.projects,
              linkedAreas: parsedHabit.references.areas,
              linkedGoals: parsedHabit.references.goals,
              linkedVision: parsedHabit.references.vision,
              linkedPurpose: parsedHabit.references.purpose
            };
            
            return habit;
          } catch (err) {
            habitsLog.error(`Failed to load habit ${file.name}`, err);
            return null;
          }
        })
      );
      
      const validHabits = loadedHabits.filter((h): h is HabitWithHistory => h !== null);
      habitsLog.info('Successfully loaded habits', {
        count: validHabits.length,
        names: validHabits.map(h => h.name),
      });
      setHabits(validHabits);
    } catch (err) {
      habitsLog.error('Failed to load habits', err);
      setError(err instanceof Error ? err.message : 'Failed to load habits');
      setHabits([]);
    } finally {
      setIsLoading(false);
    }
  }, [historyDays, includeInactive, withErrorHandling]);
  
  const refresh = useCallback(async () => {
    if (cachedSpacePath) {
      await loadHabits(cachedSpacePath);
    }
  }, [cachedSpacePath, loadHabits]);
  
  const updateHabitStatus = useCallback(async (
    habitPath: string,
    next: 'completed' | 'todo'
  ): Promise<boolean | null> => {
    try {
      const normalizedPath = norm(habitPath) ?? habitPath;
      const nextStatus = next === 'completed' ? 'completed' : 'todo';
      const updated = await withErrorHandling(
        async () =>
          safeInvoke<boolean>(
            'update_habit_status',
            { habitPath: normalizedPath, newStatus: nextStatus },
            null
          ),
        'Failed to update habit status',
        'habit'
      );
      if (updated === null) {
        habitsLog.error('[updateHabitStatus] Failed to update habit status');
        return null;
      }

      if (updated) {
        const fileName = normalizedPath.split('/').pop() || '';
        emitMetadataChange({
          filePath: normalizedPath,
          fileName,
          content: '',
          metadata: { habitStatus: nextStatus },
          changedFields: { habitStatus: nextStatus },
        });
        window.dispatchEvent(
          new CustomEvent('habit-status-updated', {
            detail: {
              habitPath: normalizedPath,
              fileName,
              habitStatus: nextStatus,
            },
          })
        );
        window.dispatchEvent(
          new CustomEvent('habit-content-changed', {
            detail: {
              habitPath: normalizedPath,
              fileName,
              habitStatus: nextStatus,
            },
          })
        );
      }

      // Reload to get updated analytics
      await refresh();
      return updated;
    } catch (err) {
      habitsLog.error('Failed to update habit status', err);
      return null;
    }
  }, [refresh, withErrorHandling]);

  const today = localISODate(new Date());
  
  const summary = useMemo(() => {
    const todayProgress = summarizeHabitProgressOnDate(habits, today, today);

    const streaksActive = habits.filter(h => h.currentStreak > 0).length;
    const averageSuccessRate = habits.length > 0
      ? Math.round(habits.reduce((sum, h) => sum + h.successRate, 0) / habits.length)
      : 0;

    const needingAttention = habits
      .filter(h => h.recentTrend === 'declining')
      .map(h => h.name);

    return {
      total: habits.length,
      eligibleToday: todayProgress.eligibleCount,
      completedToday: todayProgress.completedCount,
      streaksActive,
      averageSuccessRate,
      needingAttention
    };
  }, [habits, today]);
  
  const analytics = useMemo(() => {
    if (habits.length === 0) {
      return {};
    }
    
    const bestPerformer = [...habits].sort((a, b) => b.successRate - a.successRate)[0];
    const longestStreakHabit = [...habits].sort((a, b) => b.bestStreak - a.bestStreak)[0];
    
    // Most consistent = highest success rate with lowest variance
    const mostConsistent = [...habits].sort((a, b) => {
      const aScore = a.successRate * (1 - Math.abs(a.currentStreak - a.averageStreak) / 100);
      const bScore = b.successRate * (1 - Math.abs(b.currentStreak - b.averageStreak) / 100);
      return bScore - aScore;
    })[0];
    
    return {
      bestPerformer,
      longestStreak: longestStreakHabit ? {
        habit: longestStreakHabit.name,
        days: longestStreakHabit.bestStreak
      } : undefined,
      mostConsistent
    };
  }, [habits]);
  
  useEffect(() => {
    if (autoLoad && cachedSpacePath) {
      loadHabits(cachedSpacePath);
    }
  }, [autoLoad, cachedSpacePath, loadHabits]);
  
  return {
    habits,
    isLoading,
    error,
    summary,
    analytics,
    loadHabits,
    updateHabitStatus,
    refresh
  };
}
