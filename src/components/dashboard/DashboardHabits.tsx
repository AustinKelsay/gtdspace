/**
 * @fileoverview Dashboard Habits Tab - Enhanced habit tracking with history and analytics
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Circle,
  Flame,
  RefreshCw,
  Star,
  Target,
  Edit
} from 'lucide-react';
import type { HabitWithHistory } from '@/hooks/useHabitsHistory';
import { calculateNextReset } from '@/hooks/useHabitsHistory';
import { cn } from '@/lib/utils';
import { formatCompactDate } from '@/utils/date-formatting';
import { localISODate } from '@/utils/time';

interface DashboardHabitsProps {
  habits: HabitWithHistory[];
  isLoading?: boolean;
  onToggleHabit?: (habit: HabitWithHistory) => void;
  onEditHabit?: (habit: HabitWithHistory) => void;
  onCreateHabit?: () => void;
  className?: string;
}

// Frequency display mapping (must align with GTDHabitFrequency)
const FREQUENCY_DISPLAY: Record<string, string> = {
  'daily': 'Daily',
  'every-other-day': 'Every Other Day',
  'twice-weekly': 'Twice Weekly',
  'weekly': 'Weekly',
  'weekdays': 'Weekdays',
  'biweekly': 'Biweekly',
  'monthly': 'Monthly'
};

export const DashboardHabits: React.FC<DashboardHabitsProps> = ({
  habits,
  isLoading = false,
  onToggleHabit,
  onEditHabit,
  onCreateHabit,
  className = ''
}) => {
  const [activeView, setActiveView] = useState<'current' | 'history' | 'analytics'>('current');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'frequency' | 'streak' | 'success'>('name');
  const [selectedHabit, setSelectedHabit] = useState<HabitWithHistory | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  // Filter and sort habits
  const filteredHabits = useMemo(() => {
    let filtered = [...habits];

    // Frequency filter
    if (frequencyFilter !== 'all') {
      filtered = filtered.filter(h => h.frequency === frequencyFilter);
    }

    // Status filter (history-based, for today's completion)
    if (statusFilter !== 'all') {
      const todayStr = localISODate(new Date());
      if (statusFilter === 'completed') {
        filtered = filtered.filter(h =>
          Array.isArray(h.history) && h.history.some(e => e.date === todayStr && e.completed)
        );
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(h => {
          const entries = Array.isArray(h.history) ? h.history : [];
          const todayEntry = entries.find(e => e.date === todayStr);
          return !(todayEntry && todayEntry.completed);
        });
      }
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'frequency': {
          const freqOrder = Object.keys(FREQUENCY_DISPLAY);
          return freqOrder.indexOf(a.frequency) - freqOrder.indexOf(b.frequency);
        }
        case 'streak':
          return (b.currentStreak || 0) - (a.currentStreak || 0);
        case 'success':
          return (b.successRate || 0) - (a.successRate || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [habits, frequencyFilter, statusFilter, sortBy]);

  // Calculate overall statistics
  const stats = useMemo(() => {
    const total = habits.length;

    // Calculate today's date in YYYY-MM-DD format (local time)
    const todayStr = localISODate(new Date());

    // Count habits that have a completed entry for today
    const completedToday = habits.filter(habit => {
      // Check if habit has any history entry for today marked as completed
      if (!habit.history || habit.history.length === 0) return false;
      return habit.history.some(entry => entry.date === todayStr && entry.completed);
    }).length;

    const completionRate = total > 0 ? Math.round((completedToday / total) * 100) : 0;

    const avgStreak = habits.reduce((acc, h) => acc + (h.currentStreak || 0), 0) / (total || 1);
    const avgSuccessRate = habits.reduce((acc, h) => acc + (h.successRate || 0), 0) / (total || 1);
    const bestPerformer = habits.reduce((best, h) =>
      (h.successRate || 0) > (best?.successRate || 0) ? h : best,
      habits[0]
    );
    const needsAttention = habits.filter(h => (h.successRate || 0) < 50 && h.totalAttempts && h.totalAttempts > 5);

    return {
      total,
      completedToday,
      completionRate,
      avgStreak: Math.round(avgStreak),
      avgSuccessRate: Math.round(avgSuccessRate),
      bestPerformer,
      needsAttention
    };
  }, [habits]);

  // Calculate next reset time for a habit
  const getNextResetTime = useCallback((habit: HabitWithHistory) => {
    // Find the most recent history entry by date
    const lastUpdate = habit.history && habit.history.length > 0
      ? new Date(`${habit.history.reduce((latest, entry) =>
          entry.date > latest.date ? entry : latest
        ).date}T00:00:00`)
      : undefined;
    const nextReset = new Date(calculateNextReset(habit.frequency, lastUpdate));
    const now = new Date();

    if (nextReset <= now) return 'Now';

    const diff = nextReset.getTime() - now.getTime();
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;

    const minutes = Math.floor(diff / (60 * 1000));
    return minutes > 0 ? `${minutes}m` : 'Now';
  }, []);

  // Get streak display with icon
  const getStreakDisplay = (streak: number | undefined) => {
    if (!streak || streak === 0) return { icon: Circle, color: 'text-gray-400', label: 'No streak' };
    if (streak < 3) return { icon: Flame, color: 'text-yellow-500', label: `${streak} day streak` };
    if (streak < 7) return { icon: Flame, color: 'text-orange-500', label: `${streak} day streak` };
    if (streak < 30) return { icon: Flame, color: 'text-red-500', label: `${streak} day streak!` };
    return { icon: Award, color: 'text-purple-500', label: `${streak} day streak!! 🎉` };
  };

  // Render habit card
  const renderHabitCard = (habit: HabitWithHistory) => {
    const isCompleted = Array.isArray(habit.history) && habit.history.some(e => e.date === localISODate(new Date()) && e.completed);
    const streakDisplay = getStreakDisplay(habit.currentStreak);
    const StreakIcon = streakDisplay.icon;
    const nextReset = getNextResetTime(habit);
    
    return (
      <Card 
        key={habit.path}
        className={cn(
          "transition-all hover:shadow-lg cursor-pointer",
          isCompleted && "bg-green-50 dark:bg-green-950/20 border-green-500/30"
        )}
        onClick={() => setSelectedHabit(habit)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto"
                aria-pressed={isCompleted}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHabit?.(habit);
                }}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
              </Button>
              <div>
                <h4 className={cn(
                  "font-medium text-lg",
                  isCompleted && "line-through text-muted-foreground"
                )}>
                  {habit.name}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {FREQUENCY_DISPLAY[habit.frequency]}
                  </Badge>
                  {habit.successRate !== undefined && (
                    <Badge 
                      variant={habit.successRate >= 80 ? "default" : habit.successRate >= 50 ? "secondary" : "destructive"}
                      className="text-xs"
                    >
                      {habit.successRate}% success
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              {habit.currentStreak && habit.currentStreak > 0 && (
                <div className="flex items-center gap-1 justify-end mb-1">
                  <StreakIcon className={cn("h-4 w-4", streakDisplay.color)} />
                  <span className={cn("text-sm font-medium", streakDisplay.color)}>
                    {habit.currentStreak}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 justify-end">
                <div className="text-xs text-muted-foreground">Reset: {nextReset}</div>
                {onEditHabit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditHabit?.(habit);
                    }}
                    title="Open Habit"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {habit.successRate !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Success Rate</span>
                <span>{habit.totalCompletions || 0}/{habit.totalAttempts || 0}</span>
              </div>
              <Progress 
                value={habit.successRate} 
                className={cn(
                  "h-2",
                  habit.successRate >= 80 && "[&>div]:bg-green-500",
                  habit.successRate < 50 && "[&>div]:bg-red-500"
                )}
              />
            </div>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div className="text-center p-1 bg-muted rounded">
              <div className="font-semibold">{habit.currentStreak || 0}</div>
              <div className="text-muted-foreground">Current</div>
            </div>
            <div className="text-center p-1 bg-muted rounded">
              <div className="font-semibold">{habit.bestStreak || 0}</div>
              <div className="text-muted-foreground">Best</div>
            </div>
            <div className="text-center p-1 bg-muted rounded">
              <div className="font-semibold">{habit.lastCompleted ? formatCompactDate(habit.lastCompleted) : '-'}</div>
              <div className="text-muted-foreground">Last</div>
            </div>
          </div>

          {/* Horizon References */}
          {(habit.linkedProjects?.length || habit.linkedAreas?.length || habit.linkedGoals?.length ||
            habit.linkedVision?.length || habit.linkedPurpose?.length) ? (
            <div className="mt-3 pt-3 border-t">
              <div className="flex flex-wrap gap-1">
                {habit.linkedProjects?.map((proj, i) => (
                  <Badge key={`proj-${i}`} variant="outline" className="text-xs">
                    📁 {proj.split('/').pop()?.replace('.md', '')}
                  </Badge>
                ))}
                {habit.linkedAreas?.map((area, i) => (
                  <Badge key={`area-${i}`} variant="outline" className="text-xs">
                    🎯 {area.split('/').pop()?.replace('.md', '')}
                  </Badge>
                ))}
                {habit.linkedGoals?.map((goal, i) => (
                  <Badge key={`goal-${i}`} variant="outline" className="text-xs">
                    🎖️ {goal.split('/').pop()?.replace('.md', '')}
                  </Badge>
                ))}
                {habit.linkedVision?.map((vis, i) => (
                  <Badge key={`vis-${i}`} variant="outline" className="text-xs">
                    🔮 {vis.split('/').pop()?.replace('.md', '')}
                  </Badge>
                ))}
                {habit.linkedPurpose?.map((purp, i) => (
                  <Badge key={`purp-${i}`} variant="outline" className="text-xs">
                    ⭐ {purp.split('/').pop()?.replace('.md', '')}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  // Render history calendar (simplified view)
  const renderHistoryCalendar = () => {
    const today = new Date();
    const daysToShow = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
    const days = [];
    
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      days.push(date);
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Completion History</h3>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as 'week' | 'month' | 'year')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedHabit ? (
          <Card>
            <CardHeader>
              <CardTitle>{selectedHabit.name}</CardTitle>
              <CardDescription>
                {FREQUENCY_DISPLAY[selectedHabit.frequency]} habit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {days.map((date, i) => {
                  // Use local date formatting to match stored dates
                  const dateStr = localISODate(date);

                  // Get ALL entries for this date
                  const entries = selectedHabit.history?.filter(h => h.date === dateStr) || [];
                  // Check if ANY entry for this date shows completed
                  const hasCompletion = entries.some(e => e.completed);
                  const entryCount = entries.length;

                  return (
                    <div
                      key={i}
                      className={cn(
                        "aspect-square rounded-sm flex items-center justify-center text-xs relative",
                        hasCompletion ? "bg-green-500 text-white" : "bg-muted",
                        date.toDateString() === today.toDateString() && "ring-2 ring-primary"
                      )}
                      title={`${date.toLocaleDateString()}${entryCount > 0 ? ` (${entryCount} entries)` : ''}`}
                    >
                      {date.getDate()}
                      {entryCount > 1 && (
                        <span className="absolute top-0 right-0 bg-blue-600 text-white text-[8px] px-1 rounded-bl">
                          {entryCount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Select a habit to view its history
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{stats.completedToday}/{stats.total}</span>
            </div>
            <p className="text-sm font-medium">Completed Today</p>
            <Progress value={stats.completionRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{stats.avgStreak}</span>
            </div>
            <p className="text-sm font-medium">Avg Streak</p>
            <p className="text-xs text-muted-foreground mt-1">days</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Target className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{stats.avgSuccessRate}%</span>
            </div>
            <p className="text-sm font-medium">Avg Success</p>
            <p className="text-xs text-muted-foreground mt-1">all time</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              {stats.needsAttention.length > 0 ? (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              ) : (
                <Star className="h-5 w-5 text-purple-500" />
              )}
              <span className="text-2xl font-bold">
                {stats.needsAttention.length > 0 ? stats.needsAttention.length : '🎉'}
              </span>
            </div>
            <p className="text-sm font-medium">
              {stats.needsAttention.length > 0 ? 'Need Attention' : 'All on track!'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All frequencies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All frequencies</SelectItem>
            {Object.entries(FREQUENCY_DISPLAY).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'frequency' | 'streak' | 'success')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="frequency">Frequency</SelectItem>
            <SelectItem value="streak">Streak</SelectItem>
            <SelectItem value="success">Success Rate</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button onClick={onCreateHabit}>
          <RefreshCw className="h-4 w-4 mr-2" />
          New Habit
        </Button>
      </div>

      {/* Main content tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'current' | 'history' | 'analytics')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="current">Current Habits</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="h-[200px]">
                  <CardContent className="p-4 space-y-3">
                    <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-full bg-muted rounded animate-pulse" />
                    <div className="h-2 w-full bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredHabits.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <RefreshCw className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {habits.length === 0 ? 'No habits created yet' : 'No habits match your filters'}
                </p>
                {habits.length === 0 && (
                  <Button onClick={onCreateHabit} className="mt-4">
                    Create Your First Habit
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHabits.map(habit => renderHabitCard(habit))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {renderHistoryCalendar()}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>Your habit consistency trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.bestPerformer && (
                    <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Best Performer</p>
                          <p className="text-sm text-muted-foreground">{stats.bestPerformer.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            {stats.bestPerformer.successRate}%
                          </p>
                          <p className="text-xs text-muted-foreground">success rate</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {stats.needsAttention.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-yellow-600">Needs Attention</p>
                      {stats.needsAttention.slice(0, 3).map(habit => (
                        <div key={habit.path} className="flex items-center justify-between p-2 border rounded">
                          <span className="text-sm">{habit.name}</span>
                          <Badge variant="destructive" className="text-xs">
                            {habit.successRate}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Streaks Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle>Streak Champions</CardTitle>
                <CardDescription>Current and best streaks</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {[...habits]
                      .sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0))
                      .slice(0, 10)
                      .map((habit, index) => {
                        const streakDisplay = getStreakDisplay(habit.currentStreak);
                        const StreakIcon = streakDisplay.icon;
                        
                        return (
                          <div key={habit.path} className="flex items-center justify-between p-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-muted-foreground">
                                #{index + 1}
                              </span>
                              <span className="font-medium">{habit.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <StreakIcon className={cn("h-4 w-4", streakDisplay.color)} />
                              <span className="font-bold">{habit.currentStreak || 0}</span>
                              {habit.bestStreak && habit.bestStreak > (habit.currentStreak || 0) && (
                                <span className="text-xs text-muted-foreground">
                                  (best: {habit.bestStreak})
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardHabits;
