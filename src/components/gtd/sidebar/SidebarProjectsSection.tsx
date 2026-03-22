import React from 'react';
import { partitionActions as partitionActionsUtil } from '@/utils/partition-actions';
import { normalizeStatus } from '@/utils/gtd-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileText,
  Folder,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SIDEBAR_ACTIVE_ROW_CLASSES } from './constants';
import {
  getActionDisplay,
  getProjectDisplay,
  getStatusColorClass,
  getStatusIcon,
  isPathDescendant,
  parseLocalDateString,
} from './utils';
import { SidebarItemMenu } from './SidebarItemMenu';
import type {
  SidebarActionMetadata,
  SidebarDeleteItem,
  SidebarProjectMetadata,
} from './types';
import type { GTDProject, MarkdownFile } from '@/types';
import { norm } from '@/utils/path';

type SidebarProjectsSectionProps = {
  isExpanded: boolean;
  isLoading: boolean;
  filteredProjectCount: number;
  activeProjects: GTDProject[];
  completedProjects: GTDProject[];
  projectActions: Record<string, MarkdownFile[]>;
  projectMetadata: Record<string, SidebarProjectMetadata>;
  actionMetadata: Record<string, SidebarActionMetadata>;
  actionStatuses: Record<string, string>;
  expandedProjects: string[];
  completedProjectsExpanded: boolean;
  expandedCompletedActions: Set<string>;
  activeFilePath?: string | null;
  onToggleSection: () => void;
  onAddProject: () => void;
  onOpenProject: (project: GTDProject) => void | Promise<void>;
  onToggleProjectExpand: (project: GTDProject) => void | Promise<void>;
  onAddAction: (project: GTDProject) => void;
  onToggleCompletedProjects: (open: boolean) => void;
  onToggleCompletedActions: (projectPath: string) => void;
  onOpenAction: (action: MarkdownFile, path: string) => void;
  onOpenProjectFolder: (path: string) => void | Promise<void>;
  onOpenFileLocation: (path: string) => void | Promise<void>;
  onQueueDelete: (item: SidebarDeleteItem) => void;
  isPathActive: (candidatePath?: string | null) => boolean;
};

type ProjectRowProps = {
  project: GTDProject;
  projectActions: MarkdownFile[];
  projectMetadata: Record<string, SidebarProjectMetadata>;
  actionMetadata: Record<string, SidebarActionMetadata>;
  actionStatuses: Record<string, string>;
  expandedProjects: string[];
  expandedCompletedActions: Set<string>;
  activeFilePath?: string | null;
  isCompletedVariant?: boolean;
  onOpenProject: (project: GTDProject) => void | Promise<void>;
  onToggleProjectExpand: (project: GTDProject) => void | Promise<void>;
  onAddAction: (project: GTDProject) => void;
  onToggleCompletedActions: (projectPath: string) => void;
  onOpenAction: (action: MarkdownFile, path: string) => void;
  onOpenProjectFolder: (path: string) => void | Promise<void>;
  onOpenFileLocation: (path: string) => void | Promise<void>;
  onQueueDelete: (item: SidebarDeleteItem) => void;
  isPathActive: (candidatePath?: string | null) => boolean;
};

function ProjectActionRow({
  action,
  actionMetadata,
  actionStatuses,
  faded = false,
  onOpenAction,
  onOpenFileLocation,
  onQueueDelete,
  isPathActive,
}: {
  action: MarkdownFile;
  actionMetadata: Record<string, SidebarActionMetadata>;
  actionStatuses: Record<string, string>;
  faded?: boolean;
  onOpenAction: (action: MarkdownFile, path: string) => void;
  onOpenFileLocation: (path: string) => void | Promise<void>;
  onQueueDelete: (item: SidebarDeleteItem) => void;
  isPathActive: (candidatePath?: string | null) => boolean;
}) {
  const display = getActionDisplay(action, actionMetadata, actionStatuses);
  const isActive = isPathActive(display.path);
  const opacityClass = faded && !isActive ? 'opacity-80' : '';

  return (
    <div
      className={`group flex w-full items-center justify-between gap-1 px-1 py-0.5 hover:bg-accent/50 rounded text-xs min-w-0 max-w-full ${opacityClass} ${isActive ? SIDEBAR_ACTIVE_ROW_CLASSES : ''}`}
    >
      <div
        className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() => onOpenAction(action, display.path)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpenAction(action, display.path);
          }
        }}
      >
        <FileText className={`h-2.5 w-2.5 flex-shrink-0 ${getStatusColorClass(display.status)}`} />
        <span className="flex-1 min-w-0 break-words whitespace-normal">{display.title}</span>
        {display.dueDate && (() => {
          const parsed = parseLocalDateString(display.dueDate);
          return parsed ? (
            <span className="flex items-center flex-shrink-0 ml-1 text-muted-foreground">
              <Calendar className="h-2 w-2 mr-0.5" />
              <span className="text-[10px]">{parsed.toLocaleDateString()}</span>
            </span>
          ) : null;
        })()}
      </div>
      <SidebarItemMenu
        path={display.path}
        onOpenFileLocation={onOpenFileLocation}
        onDelete={() =>
          onQueueDelete({
            type: 'action',
            path: display.path,
            name: display.title,
          })
        }
      />
    </div>
  );
}

function ProjectRow({
  project,
  projectActions,
  projectMetadata,
  actionMetadata,
  actionStatuses,
  expandedProjects,
  expandedCompletedActions,
  activeFilePath,
  isCompletedVariant = false,
  onOpenProject,
  onToggleProjectExpand,
  onAddAction,
  onToggleCompletedActions,
  onOpenAction,
  onOpenProjectFolder,
  onOpenFileLocation,
  onQueueDelete,
  isPathActive,
}: ProjectRowProps) {
  const runAsyncAction = React.useCallback(
    (label: string, operation: () => void | Promise<void>) => {
      Promise.resolve()
        .then(operation)
        .catch((error) => {
        console.error(`[SidebarProjectsSection] ${label} failed`, error);
      });
    },
    []
  );
  const display = getProjectDisplay(project, projectMetadata);
  const currentProject: GTDProject = {
    ...project,
    name: display.title,
    path: display.path,
  };
  const normalizedStatus = normalizeStatus(display.status);
  const StatusIcon = getStatusIcon(normalizedStatus);
  const normalizedProjectPath = norm(display.path);
  const isExpanded = expandedProjects.some((path) => norm(path) === normalizedProjectPath);
  const isCompletedActionsExpanded = Array.from(expandedCompletedActions).some(
    (path) => norm(path) === normalizedProjectPath,
  );
  const isProjectActive =
    isPathActive(`${display.path}/README.md`) ||
    isPathActive(`${display.path}/README.markdown`);
  const hasActiveDescendant = !isProjectActive && isPathDescendant(display.path, activeFilePath);
  const shouldHighlightProjectRow = isProjectActive || (hasActiveDescendant && !isExpanded);
  const dueDate = display.dueDate ? parseLocalDateString(display.dueDate) : null;
  const { active: incompleteActions, completed: completedActions } = partitionActionsUtil(
    projectActions,
    {
      metadata: actionMetadata,
      statuses: actionStatuses,
      normalize: normalizeStatus,
      excludeReadme: true,
    }
  );

  return (
    <div>
      <div
        className={`group flex w-full items-center justify-between py-1 px-1 hover:bg-accent rounded-lg transition-colors min-w-0 max-w-full ${shouldHighlightProjectRow ? SIDEBAR_ACTIVE_ROW_CLASSES : ''}`}
      >
        <div
          className="flex items-center gap-0.5 flex-1 min-w-0 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => {
            runAsyncAction('open project', () => onOpenProject(currentProject));
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              runAsyncAction('open project', () => onOpenProject(currentProject));
            }
          }}
        >
          <Button
            onClick={(event) => {
              event.stopPropagation();
              runAsyncAction('toggle project expand', () => onToggleProjectExpand(currentProject));
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
            }}
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0 flex-shrink-0"
            title={`${isExpanded ? 'Collapse' : 'Expand'} ${display.title}`}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${display.title}`}
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </Button>
          <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${getStatusColorClass(normalizedStatus)}`} />
          <div className="flex-1 min-w-0 ml-1">
            <div className="font-medium text-sm break-words whitespace-normal">{display.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="truncate inline-block">{project.action_count || 0} actions</span>
              {dueDate && (
                <span className="flex items-center flex-shrink-0">
                  <Calendar className="h-2.5 w-2.5 mr-0.5" />
                  <span className="truncate inline-block">{dueDate.toLocaleDateString()}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Button
            onClick={(event) => {
              event.stopPropagation();
              onAddAction(currentProject);
            }}
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            title="Add Action"
            aria-label="Add action"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                onClick={(event) => event.stopPropagation()}
                aria-label="Project menu"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  runAsyncAction('open project folder', () => onOpenProjectFolder(display.path));
                }}
              >
                <Folder className="h-3 w-3 mr-2" />
                Open Project Folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onQueueDelete({
                    type: 'project',
                    path: display.path,
                    name: display.title,
                  });
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isExpanded && (
        <div className={`${isCompletedVariant ? 'pl-6 pr-2 py-1 space-y-0.5' : 'pl-8 py-0.5'}`}>
          {incompleteActions.length === 0 && completedActions.length === 0 ? (
            <div className="text-xs text-muted-foreground py-1 px-1">
              {isCompletedVariant ? 'No actions' : 'No actions yet'}
            </div>
          ) : (
            <>
              {incompleteActions.map((action) => (
                <ProjectActionRow
                  key={action.path}
                  action={action}
                  actionMetadata={actionMetadata}
                  actionStatuses={actionStatuses}
                  onOpenAction={onOpenAction}
                  onOpenFileLocation={onOpenFileLocation}
                  onQueueDelete={onQueueDelete}
                  isPathActive={isPathActive}
                />
              ))}
              {completedActions.length > 0 && (
                <Collapsible
                  open={isCompletedActionsExpanded}
                  onOpenChange={() => onToggleCompletedActions(display.path)}
                  data-sidebar-group="completed-actions"
                >
                  <div className="group flex items-center justify-between px-1 py-0.5 hover:bg-accent/50 rounded">
                    <CollapsibleTrigger className="flex-1 min-w-0 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <ChevronRight
                          className={`h-2.5 w-2.5 transition-transform ${isCompletedActionsExpanded ? 'rotate-90' : ''}`}
                        />
                        <span>Completed Actions</span>
                        <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
                          {completedActions.length}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="mt-0.5 space-y-0.5">
                      {completedActions.map((action) => (
                        <ProjectActionRow
                          key={`completed-${action.path}`}
                          action={action}
                          actionMetadata={actionMetadata}
                          actionStatuses={actionStatuses}
                          faded
                          onOpenAction={onOpenAction}
                          onOpenFileLocation={onOpenFileLocation}
                          onQueueDelete={onQueueDelete}
                          isPathActive={isPathActive}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SidebarProjectsSection({
  isExpanded,
  isLoading,
  filteredProjectCount,
  activeProjects,
  completedProjects,
  projectActions,
  projectMetadata,
  actionMetadata,
  actionStatuses,
  expandedProjects,
  completedProjectsExpanded,
  expandedCompletedActions,
  activeFilePath,
  onToggleSection,
  onAddProject,
  onOpenProject,
  onToggleProjectExpand,
  onAddAction,
  onToggleCompletedProjects,
  onToggleCompletedActions,
  onOpenAction,
  onOpenProjectFolder,
  onOpenFileLocation,
  onQueueDelete,
  isPathActive,
}: SidebarProjectsSectionProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleSection}>
      <div className="group flex items-center justify-between p-1.5 hover:bg-accent rounded-lg transition-colors">
        <CollapsibleTrigger className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            <Briefcase className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
            <span className="font-medium text-sm truncate inline-block">Projects</span>
            {!isLoading && filteredProjectCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1 py-0 h-4">
                {filteredProjectCount}
              </Badge>
            )}
          </div>
        </CollapsibleTrigger>
        <Button
          onClick={(event) => {
            event.stopPropagation();
            onAddProject();
          }}
          variant="ghost"
          size="icon"
          className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          title="Add Project"
          aria-label="Add project"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <CollapsibleContent>
        <div className="pl-6 pr-2 py-1 space-y-1">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="flex items-center gap-2 animate-pulse">
                  <div className="h-3 w-3 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded flex-1 max-w-[180px]" />
                </div>
              ))}
            </div>
          ) : filteredProjectCount === 0 ? (
            <div className="text-sm text-muted-foreground py-2">No projects yet</div>
          ) : (
            <>
              {activeProjects.map((project) => (
                <ProjectRow
                  key={getProjectDisplay(project, projectMetadata).path}
                  project={project}
                  projectActions={
                    projectActions[norm(getProjectDisplay(project, projectMetadata).path)] ||
                    projectActions[norm(project.path)] ||
                    []
                  }
                  projectMetadata={projectMetadata}
                  actionMetadata={actionMetadata}
                  actionStatuses={actionStatuses}
                  expandedProjects={expandedProjects}
                  expandedCompletedActions={expandedCompletedActions}
                  activeFilePath={activeFilePath}
                  onOpenProject={onOpenProject}
                  onToggleProjectExpand={onToggleProjectExpand}
                  onAddAction={onAddAction}
                  onToggleCompletedActions={onToggleCompletedActions}
                  onOpenAction={onOpenAction}
                  onOpenProjectFolder={onOpenProjectFolder}
                  onOpenFileLocation={onOpenFileLocation}
                  onQueueDelete={onQueueDelete}
                  isPathActive={isPathActive}
                />
              ))}

              {completedProjects.length > 0 && (
                <Collapsible
                  open={completedProjectsExpanded}
                  onOpenChange={onToggleCompletedProjects}
                  data-sidebar-group="completed-projects"
                >
                  <div
                    className={`group flex items-center justify-between px-1 py-0.5 mt-1 hover:bg-accent rounded-lg ${
                      completedProjects.some((project) =>
                        isPathDescendant(getProjectDisplay(project, projectMetadata).path, activeFilePath)
                      ) &&
                      !completedProjectsExpanded
                        ? SIDEBAR_ACTIVE_ROW_CLASSES
                        : ''
                    }`}
                  >
                    <CollapsibleTrigger className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <ChevronRight className={`h-3 w-3 transition-transform ${completedProjectsExpanded ? 'rotate-90' : ''}`} />
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        <span className="truncate inline-block">Completed Projects</span>
                        <Badge variant="secondary" className="ml-1 text-xs px-1 py-0 h-4">
                          {completedProjects.length}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="pl-2 pr-1 py-1 space-y-0.5">
                      {completedProjects.map((project) => (
                        <ProjectRow
                          key={`completed-${getProjectDisplay(project, projectMetadata).path}`}
                          project={project}
                          projectActions={
                            projectActions[norm(getProjectDisplay(project, projectMetadata).path)] ||
                            projectActions[norm(project.path)] ||
                            []
                          }
                          projectMetadata={projectMetadata}
                          actionMetadata={actionMetadata}
                          actionStatuses={actionStatuses}
                          expandedProjects={expandedProjects}
                          expandedCompletedActions={expandedCompletedActions}
                          activeFilePath={activeFilePath}
                          isCompletedVariant
                          onOpenProject={onOpenProject}
                          onToggleProjectExpand={onToggleProjectExpand}
                          onAddAction={onAddAction}
                          onToggleCompletedActions={onToggleCompletedActions}
                          onOpenAction={onOpenAction}
                          onOpenProjectFolder={onOpenProjectFolder}
                          onOpenFileLocation={onOpenFileLocation}
                          onQueueDelete={onQueueDelete}
                          isPathActive={isPathActive}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
