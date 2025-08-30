/**
 * @fileoverview GTD Dashboard component showing comprehensive GTD overview
 * @author Development Team
 * @created 2025-01-17
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Target,
  AlertCircle,
  Plus,
  FileText,
  Activity,
  Mountain,
  Compass,
  Star,
  Brain,
  Timer,
  TrendingUp,
  Layers,
  ChevronRight,
  Sparkles,
  Heart,
  BarChart3,
  ListChecks,
  Eye,
  MapPin,
  FolderOpen,
  RefreshCw,
  CheckSquare,
  Square,
  Coffee,
  Zap,
  LayoutDashboard
} from 'lucide-react';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { useHabitTracking } from '@/hooks/useHabitTracking';
import { GTDProjectDialog, GTDActionDialog } from '@/components/gtd';
import type { GTDSpace, GTDProject, MarkdownFile, GTDHabit } from '@/types';
import { cn } from '@/lib/utils';

interface GTDDashboardProps {
  currentFolder: string | null;
  gtdSpace?: GTDSpace | null;
  /** Optional: use the shared loader from the parent to update the global GTD state */
  loadProjects?: (path: string) => Promise<GTDProject[]>;
  /** Optional: loading state from the shared GTD hook */
  isLoading?: boolean;
  onSelectProject: (projectPath: string) => void;
  onSelectFile?: (file: MarkdownFile) => void;
  className?: string;
}

interface ProjectStats {
  total: number;
  active: number;
  onHold: number;
  completed: number;
  totalActions: number;
  completedActions: number;
  overdueProjects: number;
  upcomingDeadlines: GTDProject[];
  todayFocus: GTDProject[];
  thisWeekProjects: GTDProject[];
}

interface HabitStats {
  total: number;
  completedToday: number;
  streak: number;
  completionRate: number;
  habits: GTDHabit[];
}

const GTDDashboardComponent: React.FC<GTDDashboardProps> = ({
  currentFolder,
  gtdSpace,
  loadProjects: loadProjectsProp,
  isLoading: isLoadingProp,
  onSelectProject,
  onSelectFile,
  className = ''
}) => {
  // Fallback to local hook if parent didn't provide the shared one
  const { isLoading: hookIsLoading, loadProjects: hookLoadProjects } = useGTDSpace();
  const isLoading = isLoadingProp ?? hookIsLoading;
  const loadProjects = loadProjectsProp ?? hookLoadProjects;
  const { updateHabitStatus } = useHabitTracking();
  const [showProjectDialog, setShowProjectDialog] = React.useState(false);
  const [showActionDialog, setShowActionDialog] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<GTDProject | null>(null);
  const [activeTab, setActiveTab] = React.useState('overview');
  const [habits, setHabits] = React.useState<GTDHabit[]>([]);
  const [horizonFileCounts, setHorizonFileCounts] = React.useState<Record<string, number>>({});
  const [, setLocalProjects] = React.useState<GTDProject[]>([]);
  const [actionSummary, setActionSummary] = React.useState({
    total: 0,
    inProgress: 0,
    waiting: 0,
    upcomingDue: 0,
  });
  const [expandedHorizon, setExpandedHorizon] = React.useState<Record<string, boolean>>({});
  const [horizonFilesList, setHorizonFilesList] = React.useState<Record<string, MarkdownFile[]>>({});

  const toggleHorizon = React.useCallback(async (name: string) => {
    setExpandedHorizon(prev => ({ ...prev, [name]: !prev[name] }));
    if (!horizonFilesList[name] && gtdSpace?.root_path) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const files = await invoke<MarkdownFile[]>('list_markdown_files', { path: `${gtdSpace.root_path}/${name}` });
        setHorizonFilesList(prev => ({ ...prev, [name]: files }));
      } catch (e) {
        setHorizonFilesList(prev => ({ ...prev, [name]: [] }));
      }
    }
  }, [gtdSpace?.root_path, horizonFilesList]);

  // Batch all initial data loading into one effect to reduce re-renders
  React.useEffect(() => {
    const loadAllData = async () => {
      if (!gtdSpace?.root_path) return;

      // Use Promise.allSettled to load all data in parallel
      await Promise.allSettled([
        // Load projects if needed
        (async () => {
          // Avoid redundant reloads if projects already present
          if (Array.isArray(gtdSpace.projects) && gtdSpace.projects.length > 0) return;
          try {
            const projects = await loadProjects(gtdSpace.root_path);
            setLocalProjects(projects);
          } catch (error) {
            setLocalProjects([]);
          }
        })(),

        // Load habits
        (async () => {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const habitsPath = `${gtdSpace.root_path}/Habits`;
            const habitFiles = await invoke<MarkdownFile[]>('list_markdown_files', {
              path: habitsPath
            });

            const loadedHabits: GTDHabit[] = await Promise.all(
              habitFiles.map(async (file) => {
                try {
                  const content = await invoke<string>('read_file', { path: file.path });
                  const frequencyMatch = content.match(/\[!singleselect:habit-frequency:([^\]]+)\]/);
                  const checkboxStatus = content.match(/\[!checkbox:habit-status:(true|false)\]/);
                  const singleselectStatus = content.match(/\[!singleselect:habit-status:([^\]]+)\]/);

                  let createdDateTime: string | undefined = undefined;
                  const createdBlock = content.match(/\[!datetime:created_date_time:([^\]]+)\]/i);
                  if (createdBlock) {
                    const raw = createdBlock[1].trim();
                    const parsed = new Date(raw);
                    if (!isNaN(parsed.getTime())) {
                      createdDateTime = parsed.toISOString();
                    }
                  } else {
                    // Fallback to parse from ## Created header
                    const hdr = content.match(
                      /##\s*Created\s*(?:\r?\n|\s+)\s*([0-9]{4})-([0-9]{2})-([0-9]{2})(?:\s+([0-9]{1,2}):([0-9]{2})(?:\s*(AM|PM))?)?/i
                    );
                    if (hdr) {
                      const y  = parseInt(hdr[1], 10),
                            mo = parseInt(hdr[2], 10),
                            d  = parseInt(hdr[3], 10);
                      let hh = hdr[4] ? parseInt(hdr[4], 10) : 0;
                      const mm  = hdr[5] ? parseInt(hdr[5], 10) : 0;
                      const mer = (hdr[6] || '').toUpperCase();
                      if (mer === 'PM' && hh < 12) hh += 12;
                      if (mer === 'AM' && hh === 12) hh = 0;
                      if (
                        mo >= 1 && mo <= 12 &&
                        d  >= 1 && d  <= 31 &&
                        hh >= 0 && hh <= 23 &&
                        mm >= 0 && mm <= 59
                      ) {
                        createdDateTime = new Date(Date.UTC(y, mo - 1, d, hh, mm)).toISOString();
                      }
                    }
                  }

                  // Final fallback: use file last_modified timestamp if no created date found
                  if (!createdDateTime) {
                    createdDateTime = new Date(file.last_modified).toISOString();
                  }

                  return {
                    name: file.name.replace('.md', ''),
                    frequency: (frequencyMatch?.[1] || 'daily') as GTDHabit['frequency'],
                    status: checkboxStatus
                      ? (checkboxStatus[1] === 'true' ? 'complete' : 'todo')
                      : ((singleselectStatus?.[1] || 'todo') as 'todo' | 'complete'),
                    path: file.path,
                    last_updated: new Date(file.last_modified).toISOString(),
                    created_date_time: createdDateTime
                  };
                } catch (error) {
                  return null;
                }
              })
            );
            setHabits(loadedHabits.filter((h): h is GTDHabit => h !== null));
          } catch (error) {
            setHabits([]);
          }
        })(),

        // Load horizon counts
        (async () => {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const horizons = [
              'Purpose & Principles',
              'Vision',
              'Goals',
              'Areas of Focus',
              'Someday Maybe',
              'Cabinet'
            ];

            const counts: Record<string, number> = {};
            await Promise.all(
              horizons.map(async (horizon) => {
                try {
                  const horizonPath = `${gtdSpace.root_path}/${horizon}`;
                  const files = await invoke<MarkdownFile[]>('list_markdown_files', {
                    path: horizonPath
                  });
                  counts[horizon] = files.length;
                } catch (error) {
                  counts[horizon] = 0;
                }
              })
            );
            setHorizonFileCounts(counts);
          } catch (error) {
            // Failed to load horizon counts
          }
        })()
      ]);
    };

    loadAllData();
  }, [gtdSpace?.root_path, gtdSpace?.projects, loadProjects]);

  // Load action summary across all projects
  React.useEffect(() => {
    const loadActions = async () => {
      if (!gtdSpace?.projects || gtdSpace.projects.length === 0) {
        setActionSummary({ total: 0, inProgress: 0, waiting: 0, upcomingDue: 0 });
        return;
      }
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let total = 0, inProgress = 0, waiting = 0, upcomingDue = 0;
        const now = new Date();

        await Promise.all(gtdSpace.projects.map(async (project) => {
          try {
            const files = await invoke<MarkdownFile[]>('list_project_actions', { projectPath: project.path });
            total += files.length;
            await Promise.all(files.map(async (file) => {
              try {
                const content = await invoke<string>('read_file', { path: file.path });
                const statusMatch = content.match(/\[!singleselect:status:(in-progress|waiting|completed?|done)\]/i);
                const raw = (statusMatch?.[1] || 'in-progress').toLowerCase();
                const normalized = raw === 'done' ? 'completed' : raw;
                if (normalized === 'in-progress') inProgress++;
                else if (normalized === 'waiting') waiting++;
                

                const dueMatch = content.match(/\[!datetime:due_date:([^\]]*)\]/i);
                const dueStr = dueMatch?.[1]?.trim();
                if (dueStr) {
                  const d = new Date(dueStr);
                  if (!isNaN(d.getTime()) && d > now) upcomingDue++;
                }
              } catch {
                // Ignore parsing errors
              }
            }));
          } catch {
            // Ignore project loading errors
          }
        }));

        setActionSummary({ total, inProgress, waiting, upcomingDue });
      } catch (e) {
        setActionSummary({ total: 0, inProgress: 0, waiting: 0, upcomingDue: 0 });
      }
    };
    loadActions();
  }, [gtdSpace?.projects]);

  // Calculate project statistics
  const stats = React.useMemo<ProjectStats>(() => {
    if (!gtdSpace?.projects) {
      return {
        total: 0,
        active: 0,
        onHold: 0,
        completed: 0,
        totalActions: 0,
        completedActions: 0,
        overdueProjects: 0,
        upcomingDeadlines: [],
        todayFocus: [],
        thisWeekProjects: []
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const stats: ProjectStats = {
      total: gtdSpace.projects.length,
      active: 0,
      onHold: 0,
      completed: 0,
      totalActions: 0,
      completedActions: 0,
      overdueProjects: 0,
      upcomingDeadlines: [],
      todayFocus: [],
      thisWeekProjects: []
    };

    gtdSpace.projects.forEach(project => {
      const primaryStatus = project.status || 'in-progress';
      switch (primaryStatus) {
        case 'in-progress':
          stats.active++;
          break;
        case 'waiting':
          stats.onHold++;
          break;
        case 'completed':
          stats.completed++;
          break;
      }

      // Count actions
      stats.totalActions += project.action_count || 0;

      // Check for overdue projects using robust parsing
      const dueDateParsed = parseProjectDueDate((project as unknown as { due_date?: string }).due_date);
      if (dueDateParsed && !primaryStatus.includes('completed')) {
        if (dueDateParsed < now) {
          stats.overdueProjects++;
        } else if (dueDateParsed <= oneWeekFromNow) {
          stats.upcomingDeadlines.push(project);
          if (dueDateParsed >= today && dueDateParsed < tomorrow) {
            stats.todayFocus.push(project);
          }
          if (dueDateParsed <= oneWeekFromNow) {
            stats.thisWeekProjects.push(project);
          }
        }
      }
    });

    // Sort upcoming deadlines by date
    stats.upcomingDeadlines.sort((a, b) => {
      const dateA = new Date(a.due_date!).getTime();
      const dateB = new Date(b.due_date!).getTime();
      return dateA - dateB;
    });

    return stats;
  }, [gtdSpace?.projects]);

  // Calculate habit statistics
  const habitStats = React.useMemo<HabitStats>(() => {
    if (!habits || habits.length === 0) {
      return {
        total: 0,
        completedToday: 0,
        streak: 0,
        completionRate: 0,
        habits: []
      };
    }

    const completedToday = habits.filter(h => h.status === 'complete').length;

    return {
      total: habits.length,
      completedToday,
      streak: 0, // Would need to calculate from history
      completionRate: habits.length > 0 ? (completedToday / habits.length) * 100 : 0,
      habits: habits
    };
  }, [habits]);

  // Refresh data
  React.useEffect(() => {
    if (currentFolder && gtdSpace?.isGTDSpace) {
      loadProjects(currentFolder);
      // TODO: Load habits when habit loading is implemented
    }
  }, [currentFolder, gtdSpace?.isGTDSpace, loadProjects]);

  const getProjectCompletion = (project: GTDProject): number => {
    const statusStr = project.status || '';
    if (statusStr.includes('completed')) return 100;
    if (statusStr.includes('in-progress')) return 50;
    if (statusStr.includes('waiting')) return 25;
    return 0;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays < 7) return `${diffDays} days`;

    return date.toLocaleDateString();
  };

  // Parse project due_date values safely (supports raw block or ISO/RFC3339)
  function parseProjectDueDate(value?: string | null): Date | null {
    if (!value) return null;
    let raw = value.trim();
    const block = raw.match(/\[!datetime:due_date:([^\]]+)\]/i);
    if (block) raw = block[1].trim();
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const dt = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleHabitToggle = async (habit: GTDHabit) => {
    const newStatus = habit.status === 'complete' ? 'todo' : 'complete';
    await updateHabitStatus(
      `${currentFolder}/Habits/${habit.name}.md`,
      newStatus
    );
  };

  // Debug logging
  console.log('[GTDDashboard] Render check:', {
    currentFolder,
    gtdSpace,
    isGTDSpace: gtdSpace?.isGTDSpace,
    projects: gtdSpace?.projects?.length,
    root_path: gtdSpace?.root_path,
    is_initialized: gtdSpace?.is_initialized
  });

  if (!currentFolder || !gtdSpace?.isGTDSpace) {
    console.log('[GTDDashboard] Showing no space message - currentFolder:', currentFolder, 'isGTDSpace:', gtdSpace?.isGTDSpace, 'gtdSpace:', gtdSpace);
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No GTD Space Selected</CardTitle>
            <CardDescription>
              Select a GTD workspace from the sidebar to view your dashboard
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-hidden ${className}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="px-6 pt-6 pb-2">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <LayoutDashboard className="h-8 w-8 text-primary" />
              GTD Command Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Your complete productivity overview
            </p>
          </div>

          {/* Navigation Tabs */}
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="focus" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Today's Focus
            </TabsTrigger>
            <TabsTrigger value="habits" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Habits
            </TabsTrigger>
            <TabsTrigger value="horizons" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Horizons
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1 min-h-0 px-6 pb-6">
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]" onClick={() => setShowProjectDialog(true)}>
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

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10">
                      <Activity className="h-6 w-6 text-blue-500" />
                    </div>
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                  </div>
                  {isLoading ? (
                    <div className="space-y-2">
                      <div className="h-8 w-12 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <p className="text-3xl font-bold">{stats.active}</p>
                      <p className="text-sm text-muted-foreground">Active Projects</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/10">
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    </div>
                    <Heart className="h-4 w-4 text-green-500" />
                  </div>
                  {isLoading ? (
                    <div className="space-y-2">
                      <div className="h-8 w-12 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <p className="text-3xl font-bold">{stats.completed}</p>
                      <p className="text-sm text-muted-foreground">Completed</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/10">
                      <Zap className="h-6 w-6 text-purple-500" />
                    </div>
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                  </div>
                  {isLoading ? (
                    <div className="space-y-2">
                      <div className="h-8 w-12 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="space-y-1">
                            <div className="h-4 w-6 bg-muted rounded animate-pulse" />
                            <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-3xl font-bold">{actionSummary.total}</p>
                      <p className="text-sm text-muted-foreground">Total Actions</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <div className="font-semibold">{actionSummary.inProgress}</div>
                          <div>In Progress</div>
                        </div>
                        <div>
                          <div className="font-semibold">{actionSummary.waiting}</div>
                          <div>Waiting</div>
                        </div>
                        <div>
                          <div className="font-semibold">{actionSummary.completed}</div>
                          <div>Completed</div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Links: Cabinet & Someday Maybe */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:shadow-lg transition-all" onClick={() => onSelectProject(`${currentFolder}/Cabinet`)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-slate-500/20 to-slate-500/10">
                      <FileText className="h-6 w-6 text-slate-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">Cabinet</p>
                      <p className="text-sm text-muted-foreground">Reference materials</p>
                    </div>
                    <Badge>{horizonFileCounts['Cabinet'] || 0}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-all" onClick={() => onSelectProject(`${currentFolder}/Someday Maybe`)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/10">
                      <Sparkles className="h-6 w-6 text-amber-500" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">Someday Maybe</p>
                      <p className="text-sm text-muted-foreground">Ideas to incubate</p>
                    </div>
                    <Badge>{horizonFileCounts['Someday Maybe'] || 0}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alerts & Today's Focus */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Today's Focus */}
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Today's Focus
                  </CardTitle>
                  <CardDescription>What needs your attention today</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.todayFocus.length === 0 && stats.overdueProjects === 0 ? (
                    <div className="text-center py-8">
                      <Coffee className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No urgent items today. Focus on your priorities!
                      </p>
                    </div>
                  ) : (
                    <>
                      {stats.overdueProjects > 0 && (
                        <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                          <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <span className="font-medium">{stats.overdueProjects} overdue project{stats.overdueProjects !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      )}
                      {stats.todayFocus.map(project => (
                        <div
                          key={project.path}
                          className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => {
                            onSelectProject(project.path);
                            if (onSelectFile) {
                              const readmeFile: MarkdownFile = {
                                id: `${project.path}/README.md`,
                                name: 'README.md',
                                path: `${project.path}/README.md`,
                                size: 0,
                                last_modified: Date.now(),
                                extension: 'md'
                              };
                              onSelectFile(readmeFile);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{project.name}</span>
                            <Badge variant="destructive" className="text-xs">
                              Due Today
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Quick Habits Status */}
              <Card className="border-green-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-green-500" />
                    Today's Habits
                  </CardTitle>
                  <CardDescription>Keep your routines on track</CardDescription>
                </CardHeader>
                <CardContent>
                  {habitStats.habits.length === 0 ? (
                    <div className="text-center py-8">
                      <ListChecks className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No habits configured yet
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="text-2xl font-bold text-green-600">
                            {habitStats.completedToday}/{habitStats.total}
                          </div>
                          <span className="text-sm text-muted-foreground">completed</span>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          habitStats.completionRate === 100 && "bg-green-500/10 text-green-600 border-green-500/20"
                        )}>
                          {Math.round(habitStats.completionRate)}%
                        </Badge>
                      </div>
                      <Progress value={habitStats.completionRate} className="mb-4 h-2" />
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {habitStats.habits.slice(0, 5).map(habit => (
                          <div
                            key={habit.name}
                            className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                            onClick={() => handleHabitToggle(habit)}
                          >
                            {habit.status === 'complete' ? (
                              <CheckSquare className="h-4 w-4 text-green-600" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className={cn(
                              "text-sm",
                              habit.status === 'complete' && "line-through text-muted-foreground"
                            )}>
                              {habit.name}
                            </span>
                            <Badge variant="outline" className="text-xs ml-auto">
                              {habit.frequency}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Active Projects & Status Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Projects */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Active Projects</span>
                    <Badge>{stats.active}</Badge>
                  </CardTitle>
                  <CardDescription>Projects currently in progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {isLoading && gtdSpace.projects?.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Loading projects...</p>
                      ) : stats.active === 0 ? (
                        <div className="text-center py-8">
                          <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-sm text-muted-foreground">No active projects</p>
                        </div>
                      ) : (
                        gtdSpace.projects
                          ?.filter(p => p.status === 'in-progress')
                          .map(project => (
                            <div
                              key={project.path}
                              className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors group"
                              onClick={() => {
                                onSelectProject(project.path);
                                if (onSelectFile) {
                                  const readmeFile: MarkdownFile = {
                                    id: `${project.path}/README.md`,
                                    name: 'README.md',
                                    path: `${project.path}/README.md`,
                                    size: 0,
                                    last_modified: Date.now(),
                                    extension: 'md'
                                  };
                                  onSelectFile(readmeFile);
                                }
                              }}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium flex items-center gap-2">
                                  {project.name}
                                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </h4>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProject(project);
                                    setShowActionDialog(true);
                                  }}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {project.description}
                              </p>
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {project.action_count || 0} actions
                                </span>
                                {(() => {
                                  const d = parseProjectDueDate((project as unknown as { due_date?: string }).due_date); return d ? (
                                    <span className={cn(
                                      "flex items-center gap-1",
                                      d < new Date() ? "text-destructive" : "text-orange-600"
                                    )}>
                                      <Calendar className="h-3 w-3" />
                                      {formatDate(d.toISOString())}
                                    </span>
                                  ) : null
                                })()}
                              </div>
                              <Progress value={getProjectCompletion(project)} className="mt-2 h-1" />
                            </div>
                          ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Project Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Pipeline</CardTitle>
                  <CardDescription>Overview of all projects by status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Circle className="h-4 w-4 text-blue-600 fill-blue-600" />
                          Active
                        </span>
                        <span className="text-sm font-bold">{stats.active}</span>
                      </div>
                      <Progress value={stats.total > 0 ? (stats.active / stats.total) * 100 : 0} className="h-2" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-600" />
                          Waiting
                        </span>
                        <span className="text-sm font-bold">{stats.onHold}</span>
                      </div>
                      <Progress value={stats.total > 0 ? (stats.onHold / stats.total) * 100 : 0} className="h-2" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Completed
                        </span>
                        <span className="text-sm font-bold">{stats.completed}</span>
                      </div>
                      <Progress value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} className="h-2" />
                    </div>

                    {/* Quick Stats */}
                    <div className="pt-6 border-t grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-bold">{stats.totalActions}</p>
                        <p className="text-sm text-muted-foreground">Total Actions</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                        </p>
                        <p className="text-sm text-muted-foreground">Completion Rate</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="focus" className="space-y-6 mt-6">
            {/* Today's Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Today's Focus
                </CardTitle>
                <CardDescription>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats.todayFocus.length === 0 && stats.thisWeekProjects.length === 0 ? (
                  <div className="text-center py-12">
                    <Brain className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">Clear Schedule Today</p>
                    <p className="text-sm text-muted-foreground">
                      No deadlines today. Perfect time to make progress on important projects!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Overdue Items */}
                    {stats.overdueProjects > 0 && (
                      <div>
                        <h3 className="font-medium text-destructive mb-3 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Overdue Items
                        </h3>
                        <div className="space-y-2">
                          {gtdSpace.projects
                            ?.filter(p => {
                              const due = parseProjectDueDate((p as unknown as { due_date?: string }).due_date);
                              const statusStr = p.status || '';
                              return due && due < new Date() && !statusStr.includes('completed');
                            })
                            .map(project => (
                              <div
                                key={project.path}
                                className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg cursor-pointer hover:bg-destructive/10 transition-colors"
                                onClick={() => {
                                  onSelectProject(project.path);
                                  if (onSelectFile) {
                                    const readmeFile: MarkdownFile = {
                                      id: `${project.path}/README.md`,
                                      name: 'README.md',
                                      path: `${project.path}/README.md`,
                                      size: 0,
                                      last_modified: Date.now(),
                                      extension: 'md'
                                    };
                                    onSelectFile(readmeFile);
                                  }
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{project.name}</span>
                                  <Badge variant="destructive" className="text-xs">
                                    {(() => { const d = parseProjectDueDate((project as unknown as { due_date?: string }).due_date); return d ? formatDate(d.toISOString()) : 'Due date'; })()}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Today's Items */}
                    {stats.todayFocus.length > 0 && (
                      <div>
                        <h3 className="font-medium mb-3 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Due Today
                        </h3>
                        <div className="space-y-2">
                          {stats.todayFocus.map(project => (
                            <div
                              key={project.path}
                              className="p-3 bg-primary/5 border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors"
                              onClick={() => {
                                onSelectProject(project.path);
                                if (onSelectFile) {
                                  const readmeFile: MarkdownFile = {
                                    id: `${project.path}/README.md`,
                                    name: 'README.md',
                                    path: `${project.path}/README.md`,
                                    size: 0,
                                    last_modified: Date.now(),
                                    extension: 'md'
                                  };
                                  onSelectFile(readmeFile);
                                }
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{project.name}</span>
                                {project.due_date && project.due_date.includes('T') && (
                                  <Badge variant="outline" className="text-xs">
                                    {formatTime(project.due_date)}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {project.action_count || 0} actions
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* This Week */}
                    {stats.thisWeekProjects.filter(p => !stats.todayFocus.includes(p)).length > 0 && (
                      <div>
                        <h3 className="font-medium mb-3 flex items-center gap-2">
                          <Timer className="h-4 w-4" />
                          This Week
                        </h3>
                        <div className="space-y-2">
                          {stats.thisWeekProjects
                            .filter(p => !stats.todayFocus.includes(p))
                            .map(project => (
                              <div
                                key={project.path}
                                className="p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
                                onClick={() => {
                                  onSelectProject(project.path);
                                  if (onSelectFile) {
                                    const readmeFile: MarkdownFile = {
                                      id: `${project.path}/README.md`,
                                      name: 'README.md',
                                      path: `${project.path}/README.md`,
                                      size: 0,
                                      last_modified: Date.now(),
                                      extension: 'md'
                                    };
                                    onSelectFile(readmeFile);
                                  }
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{project.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {formatDate(project.due_date!)}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="habits" className="space-y-6 mt-6">
            {/* Habits Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Habit Tracker
                  </CardTitle>
                  <CardDescription>Build consistency through daily routines</CardDescription>
                </CardHeader>
                <CardContent>
                  {habitStats.habits.length === 0 ? (
                    <div className="text-center py-12">
                      <Star className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                      <p className="text-lg font-medium mb-2">No Habits Yet</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create habits to build consistent routines
                      </p>
                      <Button variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Habit
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {habitStats.habits.map(habit => (
                        <div
                          key={habit.name}
                          className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => handleHabitToggle(habit)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {habit.status === 'complete' ? (
                                <div className="p-2 rounded-full bg-green-500/10">
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                </div>
                              ) : (
                                <div className="p-2 rounded-full bg-muted">
                                  <Circle className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className={cn(
                                "font-medium",
                                habit.status === 'complete' && "line-through text-muted-foreground"
                              )}>
                                {habit.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {habit.frequency}
                                </Badge>
                                {habit.status === 'complete' && (
                                  <span className="text-xs text-green-600">Completed today</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Habit Stats</CardTitle>
                  <CardDescription>Your consistency metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Today's Progress</span>
                      <span className="text-sm font-bold">{habitStats.completedToday}/{habitStats.total}</span>
                    </div>
                    <Progress value={habitStats.completionRate} className="h-2" />
                  </div>

                  <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Completion Rate</span>
                      <span className="text-xl font-bold text-green-600">
                        {Math.round(habitStats.completionRate)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Habits</span>
                      <span className="text-xl font-bold">{habitStats.total}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="horizons" className="space-y-6 mt-6">
            {/* Horizons of Focus */}
            <div className="space-y-4">
              <Card className="border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mountain className="h-5 w-5 text-purple-600" />
                    Horizons of Focus
                  </CardTitle>
                  <CardDescription>Align your actions with your higher purpose</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Purpose & Principles - 50,000 ft */}
                    <Collapsible open={!!expandedHorizon['Purpose & Principles']} onOpenChange={() => toggleHorizon('Purpose & Principles')}>
                      <div className="group flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                        <CollapsibleTrigger className="flex-1 text-left">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium flex items-center gap-2">
                                <Star className="h-4 w-4 text-purple-600" />
                                Purpose & Principles
                                <Badge variant="outline" className="text-xs">50,000 ft</Badge>
                                {horizonFileCounts['Purpose & Principles'] > 0 && (
                                  <Badge className="text-xs">{horizonFileCounts['Purpose & Principles']}</Badge>
                                )}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Your life mission and core values
                              </p>
                            </div>
                            <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${expandedHorizon['Purpose & Principles'] ? 'rotate-90' : ''}`} />
                          </div>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="pl-6 pt-2 space-y-1">
                          {(horizonFilesList['Purpose & Principles'] || []).map(file => (
                            <div key={file.path} className="text-sm p-2 rounded hover:bg-accent cursor-pointer flex items-center gap-2" onClick={() => onSelectFile && onSelectFile(file)}>
                              <FileText className="h-3.5 w-3.5" />
                              <span>{file.name.replace('.md', '')}</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Vision - 40,000 ft */}
                    <Collapsible open={!!expandedHorizon['Vision']} onOpenChange={() => toggleHorizon('Vision')}>
                      <div className="group flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                        <CollapsibleTrigger className="flex-1 text-left">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium flex items-center gap-2">
                                <Eye className="h-4 w-4 text-blue-600" />
                                Vision
                                <Badge variant="outline" className="text-xs">40,000 ft</Badge>
                                {horizonFileCounts['Vision'] > 0 && (
                                  <Badge className="text-xs">{horizonFileCounts['Vision']}</Badge>
                                )}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Your 3-5 year aspirational picture
                              </p>
                            </div>
                            <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${expandedHorizon['Vision'] ? 'rotate-90' : ''}`} />
                          </div>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="pl-6 pt-2 space-y-1">
                          {(horizonFilesList['Vision'] || []).map(file => (
                            <div key={file.path} className="text-sm p-2 rounded hover:bg-accent cursor-pointer flex items-center gap-2" onClick={() => onSelectFile && onSelectFile(file)}>
                              <FileText className="h-3.5 w-3.5" />
                              <span>{file.name.replace('.md', '')}</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Goals - 30,000 ft */}
                    <Collapsible open={!!expandedHorizon['Goals']} onOpenChange={() => toggleHorizon('Goals')}>
                      <div className="group flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                        <CollapsibleTrigger className="flex-1 text-left">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium flex items-center gap-2">
                                <Target className="h-4 w-4 text-green-600" />
                                Goals
                                <Badge variant="outline" className="text-xs">30,000 ft</Badge>
                                {horizonFileCounts['Goals'] > 0 && (
                                  <Badge className="text-xs">{horizonFileCounts['Goals']}</Badge>
                                )}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Your 1-2 year objectives
                              </p>
                            </div>
                            <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${expandedHorizon['Goals'] ? 'rotate-90' : ''}`} />
                          </div>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="pl-6 pt-2 space-y-1">
                          {(horizonFilesList['Goals'] || []).map(file => (
                            <div key={file.path} className="text-sm p-2 rounded hover:bg-accent cursor-pointer flex items-center gap-2" onClick={() => onSelectFile && onSelectFile(file)}>
                              <FileText className="h-3.5 w-3.5" />
                              <span>{file.name.replace('.md', '')}</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Areas of Focus - 20,000 ft */}
                    <Collapsible open={!!expandedHorizon['Areas of Focus']} onOpenChange={() => toggleHorizon('Areas of Focus')}>
                      <div className="group flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
                        <CollapsibleTrigger className="flex-1 text-left">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium flex items-center gap-2">
                                <Compass className="h-4 w-4 text-orange-600" />
                                Areas of Focus
                                <Badge variant="outline" className="text-xs">20,000 ft</Badge>
                                {horizonFileCounts['Areas of Focus'] > 0 && (
                                  <Badge className="text-xs">{horizonFileCounts['Areas of Focus']}</Badge>
                                )}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Your ongoing responsibilities
                              </p>
                            </div>
                            <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${expandedHorizon['Areas of Focus'] ? 'rotate-90' : ''}`} />
                          </div>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="pl-6 pt-2 space-y-1">
                          {(horizonFilesList['Areas of Focus'] || []).map(file => (
                            <div key={file.path} className="text-sm p-2 rounded hover:bg-accent cursor-pointer flex items-center gap-2" onClick={() => onSelectFile && onSelectFile(file)}>
                              <FileText className="h-3.5 w-3.5" />
                              <span>{file.name.replace('.md', '')}</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Projects - Runway */}
                    <div
                      className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors group"
                      onClick={() => {
                        const path = `${currentFolder}/Projects`;
                        onSelectProject(path);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-red-600" />
                            Projects
                            <Badge variant="outline" className="text-xs">Runway</Badge>
                            {stats.total > 0 && (
                              <Badge className="text-xs">{stats.total}</Badge>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Your current active projects
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Review */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Weekly Review
                  </CardTitle>
                  <CardDescription>Keep your system trusted and current</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <RefreshCw className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Regular reviews keep your GTD system functioning
                    </p>
                    <Button variant="outline">
                      <Calendar className="h-4 w-4 mr-2" />
                      Start Weekly Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Dialogs */}
      {currentFolder && (
        <>
          <GTDProjectDialog
            isOpen={showProjectDialog}
            onClose={() => setShowProjectDialog(false)}
            spacePath={gtdSpace?.root_path || currentFolder || ''}
            onSuccess={() => loadProjects(currentFolder)}
          />

          {selectedProject && (
            <GTDActionDialog
              isOpen={showActionDialog}
              onClose={() => {
                setShowActionDialog(false);
                setSelectedProject(null);
              }}
              projectPath={selectedProject.path}
              projectName={selectedProject.name}
              onSuccess={() => loadProjects(currentFolder)}
            />
          )}
        </>
      )}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const GTDDashboard = React.memo(GTDDashboardComponent, (prevProps, nextProps) => {
  // Custom comparison function - only re-render if these props change
  return (
    prevProps.currentFolder === nextProps.currentFolder &&
    prevProps.gtdSpace?.root_path === nextProps.gtdSpace?.root_path &&
    prevProps.gtdSpace?.projects?.length === nextProps.gtdSpace?.projects?.length &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.onSelectProject === nextProps.onSelectProject &&
    prevProps.onSelectFile === nextProps.onSelectFile
  );
});

export default GTDDashboard;