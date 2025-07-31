import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Folder,
  Calendar,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  Plus,
} from 'lucide-react';
import { GTDProject, GTDProjectStatus } from '@/types';
import { cn } from '@/lib/utils';

interface GTDProjectListProps {
  projects: GTDProject[];
  selectedProject?: GTDProject | null;
  onProjectSelect: (project: GTDProject) => void;
  onCreateProject?: () => void;
  className?: string;
}

const statusConfig: Record<GTDProjectStatus, { icon: React.ReactNode; color: string }> = {
  Active: { icon: <Clock className="h-4 w-4" />, color: 'text-blue-500' },
  'On Hold': { icon: <PauseCircle className="h-4 w-4" />, color: 'text-yellow-500' },
  Complete: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-500' },
  Cancelled: { icon: <XCircle className="h-4 w-4" />, color: 'text-gray-500' },
};

/**
 * Component for displaying a list of GTD projects
 */
export function GTDProjectList({
  projects,
  selectedProject,
  onProjectSelect,
  onCreateProject,
  className,
}: GTDProjectListProps) {
  const sortedProjects = [...projects].sort((a, b) => {
    // Sort by status priority (Active first) then by name
    const statusOrder: Record<GTDProjectStatus, number> = {
      Active: 0,
      'On Hold': 1,
      Complete: 2,
      Cancelled: 3,
    };
    
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Projects</h3>
        {onCreateProject && (
          <Button size="sm" variant="ghost" onClick={onCreateProject}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sortedProjects.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No projects yet.
              {onCreateProject && (
                <>
                  <br />
                  <Button
                    variant="link"
                    className="text-sm h-auto p-0"
                    onClick={onCreateProject}
                  >
                    Create your first project
                  </Button>
                </>
              )}
            </div>
          ) : (
            sortedProjects.map((project) => {
              const { icon, color } = statusConfig[project.status];
              const isSelected = selectedProject?.path === project.path;
              
              return (
                <button
                  key={project.path}
                  onClick={() => onProjectSelect(project)}
                  className={cn(
                    'w-full text-left p-3 rounded-md transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    isSelected && 'bg-accent text-accent-foreground'
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="font-medium truncate">{project.name}</span>
                      </div>
                      <div className={cn('flex-shrink-0', color)}>{icon}</div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {project.description}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        {project.due_date && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{project.due_date}</span>
                          </div>
                        )}
                        {project.action_count !== undefined && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {project.action_count} action{project.action_count !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}