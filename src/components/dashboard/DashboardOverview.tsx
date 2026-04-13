/**
 * @fileoverview Dashboard Overview Tab - High-level GTD system statistics with enhanced metrics
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  AlertCircle,
  Clock,
  FolderOpen,
  Layers,
  ListChecks,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  Award,
  Flame
} from 'lucide-react';
import type { GTDSpace } from '@/types';
import type { ActionItem } from '@/hooks/useActionsData';
import type { ProjectWithMetadata } from '@/hooks/useProjectsData';
import type { HabitWithHistory } from '@/hooks/useHabitsHistory';
import { cn } from '@/lib/utils';
import { summarizeHabitProgressOnDate } from '@/utils/habit-progress';
import { localISODate } from '@/utils/time';
import {
  formatRelativeDate,
  isDateOverdue,
} from '@/utils/date-formatting';
import { QuestionMarkTooltip } from '@/components/ui/QuestionMarkTooltip';
import { UpcomingDeadlinesCard } from '@/components/dashboard/UpcomingDeadlinesCard';
import type {
  DashboardActivityEntityType,
  DashboardActivityItem,
  DashboardActivityType,
} from '@/utils/dashboard-activity';

interface DashboardOverviewProps {
  gtdSpace: GTDSpace;
  projects: ProjectWithMetadata[];
  habits: HabitWithHistory[];
  actions?: ActionItem[];
  actionSummary: {
    total: number;
    inProgress: number;
    completed: number;
    waiting: number;
    cancelled?: number;
    overdue?: number;
    dueToday?: number;
    dueThisWeek?: number;
  };
  horizonCounts: Record<string, number>;
  recentActivity: DashboardActivityItem[];
  isLoading?: boolean;
  onNewProject?: () => void;
  onSelectProject?: (path: string) => void;
  onSelectHorizon?: (name: string) => void;
  onSelectAction?: (path: string) => void;
  onSelectActivity?: (item: DashboardActivityItem) => void;
}

interface QuickStat {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  trend?: number;
  description?: string;
  tooltip?: React.ReactNode;
  tooltipLabel?: string;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  gtdSpace,
  projects,
  habits,
  actions = [],
  actionSummary,
  horizonCounts,
  recentActivity,
  isLoading = false,
  onNewProject,
  onSelectProject,
  onSelectHorizon,
  onSelectAction,
  onSelectActivity,
}) => {
  const todayStr = localISODate(new Date());
  const horizonOrder = React.useMemo(
    () => ['Purpose & Principles', 'Vision', 'Goals', 'Areas of Focus', 'Projects'],
    []
  );
  // Calculate project statistics with enhanced metadata
  const projectStats = React.useMemo(() => {
    const active = projects.filter(p => p.status === 'in-progress').length;
    const waiting = projects.filter(p => p.status === 'waiting').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const overdue = projects.filter(p => {
      if (p.status === 'completed' || p.status === 'cancelled') return false;
      return isDateOverdue(p.dueDate);
    }).length;

    // Calculate projects with horizon linkages
    const withHorizons = projects.filter(p => 
      (p.linkedAreas && p.linkedAreas.length > 0) ||
      (p.linkedGoals && p.linkedGoals.length > 0) ||
      (p.linkedVision && p.linkedVision.length > 0) ||
      (p.linkedPurpose && p.linkedPurpose.length > 0)
    ).length;

    // Calculate average completion percentage
    const avgCompletion = projects.length > 0
      ? Math.round(projects.reduce((sum, p) => sum + (p.completionPercentage || 0), 0) / projects.length)
      : 0;

    return {
      total: projects.length,
      active,
      waiting,
      completed,
      overdue,
      withHorizons,
      avgCompletion,
      completionRate: projects.length > 0 ? Math.round((completed / projects.length) * 100) : 0
    };
  }, [projects]);

  // Calculate enhanced habit statistics
  const habitStats = React.useMemo(() => {
    const todayProgress = summarizeHabitProgressOnDate(habits, todayStr, todayStr);
    
    // Calculate aggregate statistics
    const totalCurrentStreak = habits.reduce((sum, h) => sum + h.currentStreak, 0);
    const avgSuccessRate = habits.length > 0
      ? Math.round(habits.reduce((sum, h) => sum + h.successRate, 0) / habits.length)
      : 0;
    
    // Find best performer and longest streak
    const bestPerformer = habits.length > 0
      ? habits.reduce((best, h) => h.successRate > best.successRate ? h : best, habits[0])
      : null;
    
    const longestCurrentStreak = habits.length > 0
      ? Math.max(...habits.map(h => h.currentStreak))
      : 0;

    // Count habits by trend
    const improving = habits.filter(h => h.recentTrend === 'improving').length;
    const declining = habits.filter(h => h.recentTrend === 'declining').length;
    
    return {
      total: habits.length,
      eligibleToday: todayProgress.eligibleCount,
      completedToday: todayProgress.completedCount,
      completionRate: todayProgress.completionRate,
      totalCurrentStreak,
      avgSuccessRate,
      bestPerformer,
      longestCurrentStreak,
      improving,
      declining
    };
  }, [habits, todayStr]);

  // Calculate overall system health score with enhanced metrics
  const systemHealth = React.useMemo(() => {
    let score = 0;
    let factors = 0;

    // Factor 1: Project completion and progress (25%)
    if (projectStats.total > 0) {
      const projectScore = (projectStats.completionRate * 0.5 + projectStats.avgCompletion * 0.5) / 100;
      score += projectScore * 25;
      factors++;
    }

    // Factor 2: No overdue items (25%)
    if (projectStats.total > 0 || actionSummary.total > 0) {
      const totalItems = projectStats.total + actionSummary.total;
      const overdueItems = projectStats.overdue + (actionSummary.overdue || 0);
      const overdueRatio = overdueItems / totalItems;
      score += (1 - overdueRatio) * 25;
      factors++;
    }

    // Factor 3: Action progress (25%)
    if (actionSummary.total > 0) {
      const progressRatio = (actionSummary.completed + actionSummary.inProgress * 0.5) / actionSummary.total;
      score += progressRatio * 25;
      factors++;
    }

    // Factor 4: Habit consistency and streaks (25%)
    if (habitStats.total > 0) {
      const habitScore = (habitStats.avgSuccessRate / 100) * 0.7 +
                        (habitStats.completionRate / 100) * 0.3;
      score += habitScore * 25;
      factors++;
    }

    // Normalize score to 0-100 based on contributing factors
    if (factors > 0) {
      const normalized = (score / factors) * 4; // Scale from 0-25 per factor to 0-100
      const clamped = Math.max(0, Math.min(100, normalized));
      return Math.round(clamped);
    }

    return 0;
  }, [projectStats, actionSummary, habitStats]);

  const upcomingDueCount = Math.max(
    (actionSummary.dueThisWeek ?? 0) - (actionSummary.dueToday ?? 0),
    0
  );

  const getActivityEntityIcon = (entityType: DashboardActivityEntityType) => {
    switch (entityType) {
      case 'project':
        return FolderOpen;
      case 'action':
        return ListChecks;
      case 'habit':
        return RefreshCw;
      case 'horizon':
        return Layers;
      default:
        return Activity;
    }
  };

  const getActivityBadgeClassName = (activityType: DashboardActivityType) => {
    switch (activityType) {
      case 'completed':
        return 'border-green-500/30 bg-green-500/10 text-green-600';
      case 'updated':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-600';
      case 'created':
      default:
        return 'border-orange-500/30 bg-orange-500/10 text-orange-600';
    }
  };

  const quickStats: QuickStat[] = [
    {
      label: 'System Health',
      value: `${systemHealth}%`,
      icon: Activity,
      color: systemHealth >= 80 ? 'text-green-500' : systemHealth >= 60 ? 'text-yellow-500' : 'text-red-500',
      description: systemHealth >= 80 ? 'Excellent' : systemHealth >= 60 ? 'Good' : 'Needs Attention',
      tooltipLabel: 'About System Health',
      tooltip: (
        <div className="space-y-1">
          <p>Composite readiness score (0–100) made up of four weighted inputs.</p>
          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Project completion momentum</li>
            <li>Share of projects and actions without overdue dates</li>
            <li>Action completion and in-progress traction</li>
            <li>Habit success rate plus today’s completions</li>
          </ul>
        </div>
      )
    },
    {
      label: 'Active Projects',
      value: projectStats.active,
      icon: FolderOpen,
      color: 'text-blue-500',
      description: `${projectStats.avgCompletion}% avg progress`,
      tooltipLabel: 'About Active Projects',
      tooltip: (
        <div className="space-y-1">
          <p>Number of projects marked in progress right now.</p>
          <p className="text-xs text-muted-foreground">
            Includes all projects with status set to in-progress; average progress reflects completion percentages across every project.
          </p>
        </div>
      )
    },
    {
      label: 'Actions Progress',
      value: `${actionSummary.completed}/${actionSummary.total}`,
      icon: ListChecks,
      color: 'text-purple-500',
      description: `${actionSummary.inProgress} in progress`,
      tooltipLabel: 'About Actions Progress',
      tooltip: (
        <div className="space-y-1">
          <p>Shows completed actions out of the total tracked actions.</p>
          <p className="text-xs text-muted-foreground">
            In-progress items earn half credit in the overall system health score; waiting and cancelled actions are excluded from the numerator.
          </p>
        </div>
      )
    },
    {
      label: "Today's Habits",
      value: `${habitStats.completedToday}/${habitStats.eligibleToday}`,
      icon: RefreshCw,
      color: 'text-green-500',
      description: `${habitStats.completionRate}% completed today`
    }
  ];

  // Habits needing attention
  const habitsNeedingAttention = React.useMemo(() => {
    return habits
      .filter(h => h.recentTrend === 'declining' || h.successRate < 50)
      .slice(0, 3);
  }, [habits]);

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      {gtdSpace && (
        <div className="mb-4 flex flex-col gap-4 rounded-xl border border-border/70 bg-card/70 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold sm:text-2xl">
              {gtdSpace.root_path.split(/[\\/]/).filter(Boolean).pop() || 'GTD Workspace'}
            </h2>
            <p className="mt-1 break-all text-sm text-muted-foreground">{gtdSpace.root_path}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {projectStats.total} projects • {actionSummary.total} actions • {habitStats.total} habits
            </Badge>
            {onNewProject && (
              <button
                type="button"
                onClick={onNewProject}
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickStats.map((stat) => (
          <Card key={stat.label} className="border-border/70 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div
                  className={cn(
                    'rounded-lg border border-border/60 bg-muted/40 p-2.5'
                  )}
                >
                  <stat.icon className={cn('h-6 w-6', stat.color)} />
                </div>
                <div className="flex items-center gap-2">
                  {stat.trend !== undefined && stat.trend > 0 && (
                    <TrendingUp className={cn('h-4 w-4', stat.color)} />
                  )}
                  {stat.trend !== undefined && stat.trend < 0 && (
                    <TrendingDown className={cn('h-4 w-4', stat.color)} />
                  )}
                  {stat.tooltip && (
                    <QuestionMarkTooltip
                      content={stat.tooltip}
                      label={stat.tooltipLabel ?? `More information about ${stat.label}`}
                      className="h-6 w-6 border-border/70"
                      iconClassName="h-4 w-4"
                    />
                  )}
                </div>
              </div>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <p className="text-2xl font-semibold sm:text-3xl">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  {stat.description && (
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* System Overview - Left Column */}
        <div className="space-y-6 xl:col-span-2">
          {/* Project Pipeline with Enhanced Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Project Pipeline</span>
                <div className="flex flex-wrap gap-2">
                  {projectStats.withHorizons > 0 && (
                    <Badge variant="secondary">
                      <Target className="h-3 w-3 mr-1" />
                      {projectStats.withHorizons} linked
                    </Badge>
                  )}
                  <Badge>{projectStats.total} total</Badge>
                </div>
              </CardTitle>
              <CardDescription>Current distribution and progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{projectStats.active}</div>
                  <div className="text-sm text-muted-foreground">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">{projectStats.waiting}</div>
                  <div className="text-sm text-muted-foreground">Waiting</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{projectStats.completed}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Average Progress</span>
                  <span className="font-bold">{projectStats.avgCompletion}%</span>
                </div>
                <Progress value={projectStats.avgCompletion} className="h-2" />
              </div>

              {projectStats.overdue > 0 && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">
                      {projectStats.overdue} overdue project{projectStats.overdue !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Distribution with Enhanced Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-muted-foreground" />
                Action Distribution
              </CardTitle>
              <CardDescription>Next actions across all projects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-sm">In Progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{actionSummary.inProgress}</span>
                    <Progress 
                      value={actionSummary.total > 0 ? (actionSummary.inProgress / actionSummary.total) * 100 : 0} 
                      className="w-24 h-2"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm">Waiting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{actionSummary.waiting}</span>
                    <Progress 
                      value={actionSummary.total > 0 ? (actionSummary.waiting / actionSummary.total) * 100 : 0} 
                      className="w-24 h-2"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm">Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{actionSummary.completed}</span>
                    <Progress 
                      value={actionSummary.total > 0 ? (actionSummary.completed / actionSummary.total) * 100 : 0} 
                      className="w-24 h-2"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t space-y-2">
                  {actionSummary.overdue !== undefined && actionSummary.overdue > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-destructive">Overdue actions</span>
                      <Badge variant="destructive">{actionSummary.overdue}</Badge>
                    </div>
                  )}
                  {actionSummary.dueToday !== undefined && actionSummary.dueToday > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-orange-600">Due today</span>
                      <Badge variant="outline" className="border-orange-600 text-orange-600">
                        {actionSummary.dueToday}
                      </Badge>
                    </div>
                  )}
                  {upcomingDueCount > 0 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Due in next 7 days</span>
                      <Badge variant="outline">{upcomingDueCount}</Badge>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horizons Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Horizons of Focus
              </CardTitle>
              <CardDescription>Your GTD altitude levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(horizonCounts)
                  .filter(([horizon]) => horizonOrder.includes(horizon))
                  .sort((a, b) => {
                    return horizonOrder.indexOf(a[0]) - horizonOrder.indexOf(b[0]);
                  })
                  .map(([horizon, count]) => (
                  <div
                    key={horizon}
                    className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => onSelectHorizon?.(horizon)}
                  >
                    <span className="text-sm font-medium">{horizon}</span>
                    <Badge variant="outline">{count} items</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <UpcomingDeadlinesCard
            projects={projects}
            actions={actions}
            onSelectProject={onSelectProject}
            onSelectAction={onSelectAction}
          />

          {/* Enhanced Habit Consistency */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-green-500" />
                Habit Consistency
              </CardTitle>
              <CardDescription>Streaks and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600">
                    {habitStats.avgSuccessRate}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Average success rate
                  </p>
                </div>
                <Progress value={habitStats.avgSuccessRate} className="h-3" />
                
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="rounded-lg bg-muted/60 p-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <span className="text-xl font-bold">{habitStats.longestCurrentStreak}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Best Streak</div>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-2 text-center">
                    <div className="text-xl font-bold text-green-600">{habitStats.completedToday}</div>
                    <div className="text-xs text-muted-foreground">Done Today</div>
                  </div>
                </div>

                {/* Habit Trends */}
                {(habitStats.improving > 0 || habitStats.declining > 0) && (
                  <div className="flex justify-between text-xs pt-2 border-t">
                    {habitStats.improving > 0 && (
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="h-3 w-3" />
                        <span>{habitStats.improving} improving</span>
                      </div>
                    )}
                    {habitStats.declining > 0 && (
                      <div className="flex items-center gap-1 text-orange-600">
                        <TrendingDown className="h-3 w-3" />
                        <span>{habitStats.declining} need attention</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Best Performer */}
                {habitStats.bestPerformer && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Award className="h-4 w-4 text-yellow-500" />
                      <div className="flex-1">
                        <span className="font-medium">{habitStats.bestPerformer.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {habitStats.bestPerformer.successRate}% success • {habitStats.bestPerformer.currentStreak} day streak
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Habits Needing Attention */}
          {habitsNeedingAttention.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Habits Needing Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {habitsNeedingAttention.map((habit) => (
                    <div key={habit.path} className="flex items-start gap-2 text-sm">
                      <div className="mt-1">
                        {habit.recentTrend === 'declining' ? (
                          <TrendingDown className="h-3 w-3 text-orange-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">{habit.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {habit.successRate}% success rate • {habit.recentTrend}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Creates, updates, and completions across your workspace</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 py-5 text-center text-sm text-muted-foreground">
                  <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  No recent activity in the last 30 days
                </div>
              ) : (
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2 pr-3">
                    {recentActivity.map((item) => {
                      const ItemIcon = getActivityEntityIcon(item.entityType);

                      return (
                        <button
                          type="button"
                          key={item.id}
                          className="flex w-full items-start gap-3 rounded-lg border border-border/70 p-3 text-left transition-colors hover:bg-accent/30"
                          onClick={() => onSelectActivity?.(item)}
                        >
                          <div className="rounded-md border border-border/60 bg-muted/30 p-2">
                            <ItemIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{item.title}</p>
                                {item.context && (
                                  <p className="mt-1 text-xs text-muted-foreground">{item.context}</p>
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className={cn('shrink-0 text-[11px] capitalize', getActivityBadgeClassName(item.activityType))}
                              >
                                {item.activityType}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {formatRelativeDate(item.timestamp) || item.timestamp}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
