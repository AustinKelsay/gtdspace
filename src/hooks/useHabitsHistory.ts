/**
 * @fileoverview Hook for loading habits with complete history tracking and analytics
 * Provides habit data with streaks, success rates, and historical patterns
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { extractMetadata, extractHorizonReferences } from '@/utils/metadata-extractor';
import { readFileText } from './useFileManager';
import { localISODate } from '@/utils/time';
import type { GTDHabit, MarkdownFile } from '@/types';
import { createScopedLogger } from '@/utils/logger';

export interface HabitHistoryEntry {
  date: string;
  completed: boolean;
  note?: string;
  time?: string;
  action?: string;
}

export interface HabitWithHistory extends GTDHabit {
  history: HabitHistoryEntry[];
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
  updateHabitStatus: (habitPath: string, completed: boolean, note?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Parse habit history from markdown table format
 */
const historyLog = createScopedLogger('parseHabitHistory');
const habitsLog = createScopedLogger('useHabitsHistory');

const parseHabitHistory = (content: string): HabitHistoryEntry[] => {
  const history: HabitHistoryEntry[] = [];

  // Find the history table - flexible regex to handle varying whitespace
  const tableRegex = /\|\s*Date\s*\|\s*Time\s*\|\s*Status\s*\|\s*Action\s*\|\s*Details\s*\|[\s\S]*?\n(?:\|[^|\n]+\|[^|\n]+\|[^|\n]+\|[^|\n]+\|[^|\n]+\|\n?)+/gi;
  const tableMatch = content.match(tableRegex);

  historyLog.debug('Looking for history table');

  if (tableMatch && tableMatch[0]) {
    historyLog.debug('Found history table');
    const lines = tableMatch[0].split('\n');
    historyLog.debug('Processing lines', lines.length);

    for (const line of lines) {
      // Skip header and separator lines
      if (line.includes('Date') || line.includes('---') || !line.trim()) continue;

      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);

      if (cells.length >= 3) {
        const [date, time, status, action = '', details = ''] = cells;

        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          const entry = {
            date,
            time,
            completed: status.toLowerCase().includes('complete'),
            action,
            note: details || action || undefined
          };
          history.push(entry);
          historyLog.debug('Added entry', entry);
        }
      }
    }
  } else {
    historyLog.debug('No history table found in content');
  }

  historyLog.debug('Parsed history entries', history.length);
  return history;
};

/**
 * Calculate the next reset time based on frequency
 */
export const calculateNextReset = (frequency: GTDHabit['frequency'], lastUpdate?: Date): string => {
  const now = new Date();
  const last = lastUpdate || now;
  
  switch (frequency) {
    case 'daily': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.toISOString();
    }
      
    case 'every-other-day': {
      const dayAfter = new Date(last);
      dayAfter.setDate(dayAfter.getDate() + 2);
      dayAfter.setHours(0, 0, 0, 0);
      return dayAfter.toISOString();
    }
      
    case 'twice-weekly': {
      // Reset on next Tuesday or Friday
      const nextReset = new Date(now);
      const currentDay = now.getDay();
      const daysToAdd = currentDay < 2 ? 2 - currentDay :
                       currentDay < 5 ? 5 - currentDay :
                       (7 - currentDay) + 2;
      nextReset.setDate(nextReset.getDate() + daysToAdd);
      nextReset.setHours(0, 0, 0, 0);
      return nextReset.toISOString();
    }
      
    case 'weekly': {
      const nextWeek = new Date(now);
      const daysToMonday = (8 - now.getDay()) % 7 || 7;
      nextWeek.setDate(nextWeek.getDate() + daysToMonday);
      nextWeek.setHours(0, 0, 0, 0);
      return nextWeek.toISOString();
    }
      
    case 'weekdays': {
      const nextWeekday = new Date(now);
      let daysToWeekday = 1;
      if (now.getDay() === 5) daysToWeekday = 3; // Friday -> Monday
      if (now.getDay() === 6) daysToWeekday = 2; // Saturday -> Monday
      nextWeekday.setDate(nextWeekday.getDate() + daysToWeekday);
      nextWeekday.setHours(0, 0, 0, 0);
      return nextWeekday.toISOString();
    }
      
    case 'biweekly': {
      const twoWeeks = new Date(last);
      twoWeeks.setDate(twoWeeks.getDate() + 14);
      twoWeeks.setHours(0, 0, 0, 0);
      return twoWeeks.toISOString();
    }
      
    case 'monthly': {
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      return nextMonth.toISOString();
    }

    case '5-minute': {
      const nextFive = new Date(last);
      const currentMinutes = nextFive.getMinutes();
      const minutesToAdd = (5 - (currentMinutes % 5)) % 5 || 5;
      nextFive.setMinutes(currentMinutes + minutesToAdd);
      nextFive.setSeconds(0, 0);
      return nextFive.toISOString();
    }
      
    default: {
      const defaultTomorrow = new Date(now);
      defaultTomorrow.setDate(defaultTomorrow.getDate() + 1);
      defaultTomorrow.setHours(0, 0, 0, 0);
      return defaultTomorrow.toISOString();
    }
  }
};

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
            const content = await readFileText(file.path);
            const metadata = extractMetadata(content);
            
            // Extract frequency
            const frequency = (metadata['habit-frequency'] || 'daily') as GTDHabit['frequency'];
            
            // Extract status
            const checkboxStatus = content.match(/\[!checkbox:habit-status:(true|false)\]/);
            const singleselectStatus = content.match(/\[!singleselect:habit-status:([^\]]+)\]/);
            const status = checkboxStatus
              ? (checkboxStatus[1] === 'true' ? 'completed' : 'todo')
              : (singleselectStatus?.[1] === 'completed' ? 'completed' : 'todo');
            
            // Parse history
            const history = parseHabitHistory(content);
            habitsLog.debug(`Habit "${file.name}" history entries`, history.length);

            // Filter inactive if needed
            if (!includeInactive && history.length === 0) {
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
            
            // Extract horizon references
            const horizonRefs = extractHorizonReferences(content);

            const habit: HabitWithHistory = {
              name: file.name.replace('.md', ''),
              frequency,
              status: status as 'todo' | 'completed',
              path: file.path,
              last_updated: metadata.last_updated as string || new Date().toISOString(),
              createdDateTime: metadata.createdDateTime as string || new Date().toISOString(),
              history,
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
              // Add horizon references
              linkedProjects: horizonRefs.projects,
              linkedAreas: horizonRefs.areas,
              linkedGoals: horizonRefs.goals,
              linkedVision: horizonRefs.vision,
              linkedPurpose: horizonRefs.purpose
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
  }, [historyDays, includeInactive]);
  
  const refresh = useCallback(async () => {
    if (cachedSpacePath) {
      await loadHabits(cachedSpacePath);
    }
  }, [cachedSpacePath, loadHabits]);
  
  const updateHabitStatus = useCallback(async (
    habitPath: string,
    completed: boolean,
    note?: string
  ) => {
    try {
      let content = await readFileText(habitPath);
      const now = new Date();
      // Use local date format to match history entries
      const date = localISODate(now);
      const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      // Update status field
      if (content.includes('[!checkbox:habit-status:')) {
        content = content.replace(
          /\[!checkbox:habit-status:(true|false)\]/,
          `[!checkbox:habit-status:${completed}]`
        );
      } else if (content.includes('[!singleselect:habit-status:')) {
        content = content.replace(
          /\[!singleselect:habit-status:[^\]]+\]/,
          `[!singleselect:habit-status:${completed ? 'completed' : 'todo'}]`
        );
      }
      
      // Add to history table
      const newRow = `| ${date} | ${time} | ${completed ? 'Complete' : 'Incomplete'} | Manual | ${note || 'Status updated'} |`;
      
      // Find or create history table
      if (content.includes('| Date | Time | Status |')) {
        // Insert after header
        const lines = content.split('\n');
        let inserted = false;
        
        for (let i = 0; i < lines.length; i++) {
          if (/^\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|$/.test(lines[i].trim())) {
            lines.splice(i + 1, 0, newRow);
            inserted = true;
            break;
          }
        }
        
        if (!inserted) {
          // Append at end if table structure not found
          lines.push(newRow);
        }
        
        content = lines.join('\n');
      } else {
        // Create new history table
        const historyTable = `
## History

| Date | Time | Status | Action | Details |
| --- | --- | --- | --- | --- |
${newRow}
`;
        content += historyTable;
      }
      
      const writeResult = await safeInvoke('save_file', {
        path: habitPath,
        content
      }, null);

      // Check if write succeeded
      if (!writeResult) {
        habitsLog.error('[updateHabitStatus] Failed to write file');
        throw new Error('Failed to save habit changes');
      }

      // Reload to get updated analytics
      await refresh();
    } catch (err) {
      habitsLog.error('Failed to update habit status', err);
      throw err;
    }
  }, [refresh]);
  
  const summary = useMemo(() => {
    // Get today's date in YYYY-MM-DD format using local timezone
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('-');

    // Count habits completed today based on history entries
    const completedToday = habits.filter(habit => {
      // Check if there's a history entry for today
      const todayEntry = habit.history.find(entry => entry.date === today);
      // Return true only if entry exists and is completed
      return todayEntry?.completed === true;
    }).length;

    const streaksActive = habits.filter(h => h.currentStreak > 0).length;
    const averageSuccessRate = habits.length > 0
      ? Math.round(habits.reduce((sum, h) => sum + h.successRate, 0) / habits.length)
      : 0;

    const needingAttention = habits
      .filter(h => h.recentTrend === 'declining')
      .map(h => h.name);

    return {
      total: habits.length,
      completedToday,
      streaksActive,
      averageSuccessRate,
      needingAttention
    };
  }, [habits]);
  
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
