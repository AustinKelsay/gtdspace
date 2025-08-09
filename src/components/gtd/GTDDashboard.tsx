/**
 * @fileoverview GTD Dashboard component showing project overview and statistics
 * @author Development Team
 * @created 2024-01-XX
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle2, 
  Circle, 
  Clock,
  Calendar,
  Target,
  AlertCircle,
  Plus,
  FileText,
  Activity
} from 'lucide-react';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTDProjectDialog, GTDActionDialog } from '@/components/gtd';
import type { GTDProject, MarkdownFile } from '@/types';

interface GTDDashboardProps {
  currentFolder: string | null;
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
}

export const GTDDashboard: React.FC<GTDDashboardProps> = ({
  currentFolder,
  onSelectProject,
  onSelectFile,
  className = ''
}) => {
  const { gtdSpace, isLoading, loadProjects } = useGTDSpace();
  const [showProjectDialog, setShowProjectDialog] = React.useState(false);
  const [showActionDialog, setShowActionDialog] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<GTDProject | null>(null);

  // Calculate statistics
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
        upcomingDeadlines: []
      };
    }

    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const stats: ProjectStats = {
      total: gtdSpace.projects.length,
      active: 0,
      onHold: 0,
      completed: 0,
      totalActions: 0,
      completedActions: 0,
      overdueProjects: 0,
      upcomingDeadlines: []
    };

    gtdSpace.projects.forEach(project => {
      // Count by status (use first status for counting)
      const primaryStatus = project.status[0] || 'in-progress';
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

      // Check for overdue projects
      if (project.due_date && !project.status.includes('completed')) {
        const dueDate = new Date(project.due_date);
        if (dueDate < now) {
          stats.overdueProjects++;
        } else if (dueDate <= oneWeekFromNow) {
          stats.upcomingDeadlines.push(project);
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

  // Refresh data
  React.useEffect(() => {
    if (currentFolder && gtdSpace?.isGTDSpace) {
      loadProjects(currentFolder);
    }
  }, [currentFolder, gtdSpace?.isGTDSpace, loadProjects]);

  const getProjectCompletion = (project: GTDProject): number => {
    // This is a placeholder - would need to load action details to calculate real completion
    if (project.status.includes('completed')) return 100;
    if (project.status.includes('in-progress')) return 50;
    if (project.status.includes('waiting')) return 25;
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

  if (!currentFolder || !gtdSpace?.isGTDSpace) {
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
    <div className={`p-6 h-full overflow-auto ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          GTD Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Your productivity command center
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowProjectDialog(true)}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">New Project</p>
              <p className="text-sm text-muted-foreground">Start something new</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <Activity className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-sm text-muted-foreground">Active Projects</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <FileText className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalActions}</p>
              <p className="text-sm text-muted-foreground">Total Actions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {(stats.overdueProjects > 0 || stats.upcomingDeadlines.length > 0) && (
        <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.overdueProjects > 0 && (
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{stats.overdueProjects} overdue project{stats.overdueProjects !== 1 ? 's' : ''}</span>
              </div>
            )}
            {stats.upcomingDeadlines.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Upcoming Deadlines:</p>
                {stats.upcomingDeadlines.slice(0, 3).map(project => (
                  <div 
                    key={project.path} 
                    className="flex items-center justify-between py-1 cursor-pointer hover:bg-accent/50 rounded px-2"
                    onClick={() => {
                      onSelectProject(project.path);
                      // Open the project's README.md
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
                    <span className="text-sm">{project.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {formatDate(project.due_date!)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Active Projects</span>
              <Badge variant="secondary">{stats.active}</Badge>
            </CardTitle>
            <CardDescription>Projects currently in progress</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading projects...</p>
                ) : stats.active === 0 ? (
                  <p className="text-sm text-muted-foreground">No active projects</p>
                ) : (
                  gtdSpace.projects
                    ?.filter(p => p.status.includes('in-progress'))
                    .map(project => (
                      <div
                        key={project.path}
                        className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => {
                      onSelectProject(project.path);
                      // Open the project's README.md
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
                          <h4 className="font-medium">{project.name}</h4>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProject(project);
                              setShowActionDialog(true);
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{project.description}</p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {project.action_count || 0} actions
                          </span>
                          {project.due_date && (
                            <span className="flex items-center gap-1 text-orange-600">
                              <Calendar className="h-3 w-3" />
                              {formatDate(project.due_date)}
                            </span>
                          )}
                        </div>
                        <Progress value={getProjectCompletion(project)} className="mt-2 h-1" />
                      </div>
                    ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Project Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Project Status Distribution</CardTitle>
            <CardDescription>Overview of all projects by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Circle className="h-4 w-4 text-green-600" />
                    Active
                  </span>
                  <span className="text-sm text-muted-foreground">{stats.active}</span>
                </div>
                <Progress value={stats.total > 0 ? (stats.active / stats.total) * 100 : 0} className="h-2" />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    On Hold
                  </span>
                  <span className="text-sm text-muted-foreground">{stats.onHold}</span>
                </div>
                <Progress value={stats.total > 0 ? (stats.onHold / stats.total) * 100 : 0} className="h-2" />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    Completed
                  </span>
                  <span className="text-sm text-muted-foreground">{stats.completed}</span>
                </div>
                <Progress value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} className="h-2" />
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 pt-6 border-t grid grid-cols-2 gap-4">
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
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      {currentFolder && (
        <>
          <GTDProjectDialog
            isOpen={showProjectDialog}
            onClose={() => setShowProjectDialog(false)}
            spacePath={gtdSpace?.root_path || currentFolder || ''}
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
            />
          )}
        </>
      )}
    </div>
  );
};

export default GTDDashboard;