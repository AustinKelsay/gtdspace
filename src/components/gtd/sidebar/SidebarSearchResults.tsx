import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Briefcase, FileText } from 'lucide-react';
import { SIDEBAR_ACTIVE_ROW_CLASSES } from './constants';
import {
  getActionDisplay,
  getProjectDisplay,
  getSectionFileDisplay,
  getStatusColorClass,
  getStatusIcon,
} from './utils';
import type {
  SidebarActionMetadata,
  SidebarProjectMetadata,
  SidebarSearchResults as SidebarSearchResultsData,
  SidebarSectionFileMetadata,
} from './types';
import type { GTDProject, MarkdownFile } from '@/types';

type SidebarSearchResultsProps = {
  results: SidebarSearchResultsData;
  searchQuery: string;
  projectMetadata: Record<string, SidebarProjectMetadata>;
  actionMetadata: Record<string, SidebarActionMetadata>;
  actionStatuses: Record<string, string>;
  sectionFileMetadata: Record<string, SidebarSectionFileMetadata>;
  isPathActive: (candidatePath?: string | null) => boolean;
  onOpenProject: (project: GTDProject) => void | Promise<void>;
  onOpenAction: (action: MarkdownFile, path: string) => void;
  onOpenFile: (file: MarkdownFile, path: string) => void;
};

export function SidebarSearchResults({
  results,
  searchQuery,
  projectMetadata,
  actionMetadata,
  actionStatuses,
  sectionFileMetadata,
  isPathActive,
  onOpenProject,
  onOpenAction,
  onOpenFile,
}: SidebarSearchResultsProps) {
  const totalActions = results.actions.reduce((sum, project) => sum + project.actions.length, 0);
  const hasResults =
    results.projects.length > 0 ||
    results.actions.length > 0 ||
    results.sections.length > 0;

  return (
    <div className="space-y-4">
      {results.projects.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-2">
            <Briefcase className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-sm font-medium">Projects</span>
            <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
              {results.projects.length}
            </Badge>
          </div>
          <div className="space-y-1 pl-2">
            {results.projects.map((project) => {
              const display = getProjectDisplay(project, projectMetadata);
              const StatusIcon = getStatusIcon(display.status);
              const isActive =
                isPathActive(`${display.path}/README.md`) ||
                isPathActive(`${display.path}/README.markdown`);

              return (
                <div
                  key={project.path}
                  className={`group flex items-center gap-2 py-1 px-2 hover:bg-accent rounded-lg transition-colors cursor-pointer ${isActive ? SIDEBAR_ACTIVE_ROW_CLASSES : ''}`}
                  onClick={() => void onOpenProject(project)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      void onOpenProject(project);
                    }
                  }}
                >
                  <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${getStatusColorClass(display.status)}`} />
                  <span className="text-sm truncate inline-block">{display.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {results.actions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-2">
            <FileText className="h-3.5 w-3.5 text-green-600" />
            <span className="text-sm font-medium">Actions</span>
            <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
              {totalActions}
            </Badge>
          </div>
          <div className="space-y-2 pl-2">
            {results.actions.map(({ project, actions }) => (
              <div key={project}>
                <div className="text-xs text-muted-foreground mb-1">{project}</div>
                {actions.map((action) => {
                  const display = getActionDisplay(action, actionMetadata, actionStatuses);
                  const StatusIcon = getStatusIcon(display.status);
                  const isActive = isPathActive(display.path);

                  return (
                    <div
                      key={action.path}
                      className={`group flex items-center gap-2 py-1 px-2 hover:bg-accent rounded-lg transition-colors cursor-pointer ${isActive ? SIDEBAR_ACTIVE_ROW_CLASSES : ''}`}
                      onClick={() => onOpenAction(action, display.path)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onOpenAction(action, display.path);
                        }
                      }}
                    >
                      <StatusIcon className={`h-3 w-3 flex-shrink-0 ${getStatusColorClass(display.status)}`} />
                      <span className="text-sm truncate inline-block">{display.title}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {results.sections.map(({ section, files }) => (
        <div key={section.id}>
          <div className="flex items-center gap-2 mb-2 px-2">
            <section.icon className={`h-3.5 w-3.5 ${section.color}`} />
            <span className="text-sm font-medium">{section.name}</span>
            <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
              {files.length}
            </Badge>
          </div>
          <div className="space-y-1 pl-2">
            {files.map((file) => {
              const display = getSectionFileDisplay(file, sectionFileMetadata);
              const isActive = isPathActive(display.path);

              return (
                <div
                  key={file.path}
                  className={`group flex items-center gap-2 py-1 px-2 hover:bg-accent rounded-lg transition-colors cursor-pointer ${isActive ? SIDEBAR_ACTIVE_ROW_CLASSES : ''}`}
                  onClick={() => onOpenFile(file, display.path)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpenFile(file, display.path);
                    }
                  }}
                >
                  <FileText className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate inline-block">{display.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!hasResults && (
        <div className="text-sm text-muted-foreground text-center py-4">
          No results found for "{searchQuery}"
        </div>
      )}
    </div>
  );
}
