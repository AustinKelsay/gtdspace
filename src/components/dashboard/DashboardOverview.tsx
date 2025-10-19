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
  Calendar,
  Clock,
  FileText,
  FolderOpen,
  Layers,
  ListChecks,
  Plus,
  RefreshCw,
  Sparkles,
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
import { localISODate } from '@/utils/time';
import { Switch } from '@/components/ui/switch';
import { formatRelativeDate, getDateFromNow, isDateInRange, parseLocalDate } from '@/utils/date-formatting';
import { QuestionMarkTooltip } from '@/components/ui/QuestionMarkTooltip';

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
  isLoading?: boolean;
  onNewProject?: () => void;
  onSelectProject?: (path: string) => void;
  onSelectHorizon?: (name: string) => void;
  onSelectAction?: (path: string) => void;
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
  isLoading = false,
  onNewProject,
  onSelectProject,
  onSelectHorizon,
  onSelectAction
}) => {
  const [includeActions, setIncludeActions] = React.useState(true);
  const [onlyOverdue, setOnlyOverdue] = React.useState(false);
  // Calculate project statistics with enhanced metadata
  const projectStats = React.useMemo(() => {
    const active = projects.filter(p => p.status === 'in-progress').length;
    const waiting = projects.filter(p => p.status === 'waiting').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const overdue = projects.filter(p => {
      if (!p.dueDate || p.status === 'completed') return false;
      const due = parseLocalDate(p.dueDate);
      return !isNaN(due.getTime()) && due < today;
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
    // Count today's completions from history to avoid stale status
    const todayStr = localISODate(new Date());
    const completedToday = habits.reduce((sum, h) => {
      const entries = Array.isArray(h.history) ? h.history : [];
      const todayEntry = entries.find(e => e.date === todayStr);
      return sum + (todayEntry && todayEntry.completed ? 1 : 0);
    }, 0);
    const completionRate = habits.length > 0 ? Math.round((completedToday / habits.length) * 100) : 0;
    
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
      completedToday,
      completionRate,
      totalCurrentStreak,
      avgSuccessRate,
      bestPerformer,
      longestCurrentStreak,
      improving,
      declining
    };
  }, [habits]);

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

  // Calculate upcoming due items (this week excluding today)
  const upcomingDueCount = Math.max(
    (actionSummary.dueThisWeek ?? 0) - (actionSummary.dueToday ?? 0),
    0
  );

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
      value: `${habitStats.completedToday}/${habitStats.total}`,
      icon: RefreshCw,
      color: 'text-green-500',
      description: `${habitStats.avgSuccessRate}% success rate`
    }
  ];

  // Get upcoming items (next 7 days) with enhanced display
  const upcomingItems = React.useMemo(() => {
    const now = new Date();
    const weekFromNow = getDateFromNow(7);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const upcomingProjects = projects
      .filter(p => {
        if (!p.dueDate || p.status === 'completed') return false;
        if (onlyOverdue) {
          const due = parseLocalDate(p.dueDate);
          return !isNaN(due.getTime()) && due < today;
        }
        return isDateInRange(p.dueDate, now, weekFromNow);
      })
      .map(p => ({
        id: p.path,
        name: p.name,
        type: 'project' as const,
        dueDate: p.dueDate!,
        status: p.status,
        completionPercentage: p.completionPercentage
      }));

    const upcomingActions = actions
      .filter(a => {
        if (!a.dueDate) return false;
        if (a.status === 'completed' || a.status === 'cancelled') return false;
        if (onlyOverdue) {
          const due = parseLocalDate(a.dueDate);
          return !isNaN(due.getTime()) && due < today;
        }
        return isDateInRange(a.dueDate, now, weekFromNow);
      })
      .map(a => ({
        id: a.path,
        name: a.name,
        type: 'action' as const,
        dueDate: a.dueDate!,
        status: a.status,
        completionPercentage: undefined as number | undefined
      }));

    // Sort combined by due date
    const combined = includeActions ? [...upcomingProjects, ...upcomingActions] : upcomingProjects;
    return combined
      .sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime())
      .slice(0, 8);
  }, [projects, actions, includeActions, onlyOverdue]);

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">
              {gtdSpace.root_path.split('/').pop() || 'GTD Workspace'}
            </h2>
            <p className="text-sm text-muted-foreground">{gtdSpace.root_path}</p>
          </div>
          <Badge variant="outline" className="text-sm">
            {projectStats.total} projects • {actionSummary.total} actions • {habitStats.total} habits
          </Badge>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* New Project Card */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={onNewProject}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg">New Project</p>
            <p className="text-sm text-muted-foreground">Start something amazing</p>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        {quickStats.slice(0, 3).map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div
                  className={cn(
                    'p-3 rounded-lg bg-gradient-to-br',
                    stat.color === 'text-blue-500' && 'from-blue-500/20 to-blue-500/10',
                    stat.color === 'text-green-500' && 'from-green-500/20 to-green-500/10',
                    stat.color === 'text-purple-500' && 'from-purple-500/20 to-purple-500/10',
                    stat.color === 'text-yellow-500' && 'from-yellow-500/20 to-yellow-500/10',
                    stat.color === 'text-red-500' && 'from-red-500/20 to-red-500/10'
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
                  <p className="text-3xl font-bold">{stat.value}</p>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Overview - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Pipeline with Enhanced Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Project Pipeline</span>
                <div className="flex gap-2">
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
              <div className="grid grid-cols-3 gap-4">
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
                <Zap className="h-5 w-5 text-purple-500" />
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
                      <span>Due this week</span>
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
                  .sort((a, b) => {
                    const order = ['Purpose & Principles', 'Vision', 'Goals', 'Areas of Focus', 'Projects'];
                    return order.indexOf(a[0]) - order.indexOf(b[0]);
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
          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Deadlines
                </CardTitle>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className={cn(
                      'text-xs px-2 py-1 rounded border transition-colors',
                      onlyOverdue
                        ? 'bg-destructive/10 border-destructive text-destructive'
                        : 'border-muted-foreground/30 text-muted-foreground hover:bg-accent'
                    )}
                    onClick={() => setOnlyOverdue(v => !v)}
                  >
                    Only overdue
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Include actions</span>
                    <Switch checked={includeActions} onCheckedChange={setIncludeActions} />
                  </div>
                </div>
              </div>
              <CardDescription>{onlyOverdue ? 'Overdue' : 'Next 7 days'}</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingItems.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  {onlyOverdue ? 'No overdue items' : 'No upcoming deadlines this week'}
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {upcomingItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 border rounded hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => item.type === 'action' ? onSelectAction?.(item.id) : onSelectProject?.(item.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate flex items-center gap-2">
                            {item.type === 'project' ? (
                              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {item.name}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {formatRelativeDate(item.dueDate) || parseLocalDate(item.dueDate).toLocaleDateString()}
                          </Badge>
                        </div>
                        {item.completionPercentage !== undefined && (
                          <Progress value={item.completionPercentage} className="h-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FolderOpen className="h-3.5 w-3.5" /> Project
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> Action
                </span>
              </div>
            </CardContent>
          </Card>

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
                  <div className="text-center p-2 bg-muted rounded">
                    <div className="flex items-center justify-center gap-1">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <span className="text-xl font-bold">{habitStats.longestCurrentStreak}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Best Streak</div>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
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

          {/* Activity Summary - Placeholder for future implementation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Activity Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4 text-sm text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                Activity tracking coming soon
                <p className="text-xs mt-1">Track creates, updates, and completions</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
