import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import type { ActionItem } from '@/hooks/useActionsData';
import type { ProjectWithMetadata } from '@/hooks/useProjectsData';
import { cn } from '@/lib/utils';
import {
  formatRelativeDate,
  getDateFromNow,
  isDateInRange,
  isDateOverdue,
  parseLocalDate,
} from '@/utils/date-formatting';
import { Calendar, FileText, FolderOpen } from 'lucide-react';

type UpcomingDeadlineItem = {
  id: string;
  name: string;
  type: 'project' | 'action';
  dueDate: string;
  completionPercentage?: number;
};

interface UpcomingDeadlinesCardProps {
  projects: ProjectWithMetadata[];
  actions: ActionItem[];
  onSelectProject?: (path: string) => void;
  onSelectAction?: (path: string) => void;
}

export function UpcomingDeadlinesCard({
  projects,
  actions,
  onSelectProject,
  onSelectAction,
}: UpcomingDeadlinesCardProps) {
  const [includeActions, setIncludeActions] = React.useState(true);
  const [onlyOverdue, setOnlyOverdue] = React.useState(false);

  const upcomingItems = React.useMemo(() => {
    const now = new Date();
    const weekFromNow = getDateFromNow(7);

    const upcomingProjects: UpcomingDeadlineItem[] = projects
      .filter((project) => {
        if (!project.dueDate || project.status === 'completed' || project.status === 'cancelled') {
          return false;
        }
        if (onlyOverdue) {
          return isDateOverdue(project.dueDate);
        }
        return isDateInRange(project.dueDate, now, weekFromNow);
      })
      .map((project) => ({
        id: project.path,
        name: project.name,
        type: 'project',
        dueDate: project.dueDate!,
        completionPercentage: project.completionPercentage,
      }));

    const upcomingActions: UpcomingDeadlineItem[] = actions
      .filter((action) => {
        if (!action.dueDate || action.status === 'completed' || action.status === 'cancelled') {
          return false;
        }
        if (onlyOverdue) {
          return isDateOverdue(action.dueDate);
        }
        return isDateInRange(action.dueDate, now, weekFromNow);
      })
      .map((action) => ({
        id: action.path,
        name: action.name,
        type: 'action',
        dueDate: action.dueDate!,
      }));

    return (includeActions ? [...upcomingProjects, ...upcomingActions] : upcomingProjects)
      .sort((left, right) => parseLocalDate(left.dueDate).getTime() - parseLocalDate(right.dueDate).getTime())
      .slice(0, 8);
  }, [actions, includeActions, onlyOverdue, projects]);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-3 text-2xl font-semibold leading-tight">
            <Calendar className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span>Upcoming Deadlines</span>
          </CardTitle>
          <CardDescription>{onlyOverdue ? 'Overdue' : 'Next 7 days'}</CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <button
            type="button"
            className={cn(
              'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors',
              onlyOverdue
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : 'border-border/70 text-muted-foreground hover:bg-accent'
            )}
            onClick={() => setOnlyOverdue((value) => !value)}
            aria-pressed={onlyOverdue}
          >
            Only overdue
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span
              id="upcoming-deadlines-include-actions"
              className="text-xs font-medium text-muted-foreground"
            >
              Include actions
            </span>
            <Switch
              checked={includeActions}
              onCheckedChange={setIncludeActions}
              aria-labelledby="upcoming-deadlines-include-actions"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {upcomingItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 py-8 text-center text-sm text-muted-foreground">
            {onlyOverdue ? 'No overdue items' : 'No upcoming deadlines this week'}
          </div>
        ) : (
          <ScrollArea className="h-[240px]">
            <div className="space-y-3 pr-3">
              {upcomingItems.map((item) => {
                const ItemIcon = item.type === 'project' ? FolderOpen : FileText;
                const dueLabel =
                  formatRelativeDate(item.dueDate) || parseLocalDate(item.dueDate).toLocaleDateString();

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/70 bg-card/70 p-4 transition-colors hover:bg-accent/20"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (item.type === 'action') {
                        onSelectAction?.(item.id);
                      } else {
                        onSelectProject?.(item.id);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') {
                        return;
                      }
                      event.preventDefault();
                      if (item.type === 'action') {
                        onSelectAction?.(item.id);
                      } else {
                        onSelectProject?.(item.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0 rounded-md border border-border/60 bg-muted/30 p-2">
                        <ItemIcon className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold leading-tight">{item.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.type === 'project' ? 'Project' : 'Action'}
                            </p>
                          </div>

                          <Badge variant="outline" className="shrink-0 rounded-full px-3 py-1 text-xs">
                            {dueLabel}
                          </Badge>
                        </div>

                        {item.completionPercentage !== undefined && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>Project progress</span>
                              <span>{item.completionPercentage}%</span>
                            </div>
                            <Progress value={item.completionPercentage} className="h-1.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex flex-wrap items-center gap-4 border-t border-border/60 pt-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            Project
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Action
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default UpcomingDeadlinesCard;
