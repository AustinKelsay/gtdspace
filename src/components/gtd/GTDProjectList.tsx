import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderOpen, Calendar, ChevronRight } from 'lucide-react';
import { GTDProject } from '@/types';

interface GTDProjectListProps {
  projects: GTDProject[];
  onSelectProject: (project: GTDProject) => void;
  onCreateAction: (project: GTDProject) => void;
}

export const GTDProjectList: React.FC<GTDProjectListProps> = ({
  projects,
  onSelectProject,
  onCreateAction,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'On Hold':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'Complete':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'Cancelled':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      default:
        return '';
    }
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No projects yet</p>
        <p className="text-sm mt-2">Create your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <Card
          key={project.path}
          className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
          onClick={() => onSelectProject(project)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium">{project.name}</h3>
                <Badge className={getStatusColor(project.status)} variant="secondary">
                  {project.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {project.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(project.due_date).toLocaleDateString()}
                  </div>
                )}
                <div>
                  {project.action_count || 0} action{project.action_count !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateAction(project);
                }}
              >
                Add Action
              </Button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};