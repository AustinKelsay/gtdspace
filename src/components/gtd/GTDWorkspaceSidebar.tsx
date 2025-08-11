/**
 * @fileoverview GTD-aware workspace sidebar component
 * @author Development Team
 * @created 2024-01-XX
 */

import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Briefcase,
  Plus,
  Calendar,
  CheckCircle2,
  Circle,
  CircleDot,
  FolderOpen,
  ChevronRight,
  Target,
  Archive,
  Lightbulb,
  FileText,
  Search,
  RefreshCw,
  Folder
} from 'lucide-react';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTDProjectDialog, GTDActionDialog } from '@/components/gtd';
import { FileSearch } from '@/components/file-browser/FileSearch';
import type { GTDProject, MarkdownFile, GTDSpace } from '@/types';

interface GTDWorkspaceSidebarProps {
  currentFolder: string | null;
  onFolderSelect: (folderPath: string) => void;
  onFileSelect: (file: MarkdownFile) => void;
  onRefresh: () => void;
  className?: string;
  gtdSpace?: GTDSpace | null;
  checkGTDSpace?: (path: string) => Promise<boolean>;
  loadProjects?: (path: string) => Promise<GTDProject[]>;
}

interface GTDSection {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  description: string;
  color: string;
}

const GTD_SECTIONS: GTDSection[] = [
  {
    id: 'projects',
    name: 'Projects',
    icon: Briefcase,
    path: 'Projects',
    description: 'Active projects and their actions',
    color: 'text-blue-600'
  },
  {
    id: 'habits',
    name: 'Habits',
    icon: RefreshCw,
    path: 'Habits',
    description: 'Daily and weekly routines',
    color: 'text-green-600'
  },
  {
    id: 'someday',
    name: 'Someday Maybe',
    icon: Lightbulb,
    path: 'Someday Maybe',
    description: 'Ideas for future consideration',
    color: 'text-purple-600'
  },
  {
    id: 'cabinet',
    name: 'Cabinet',
    icon: Archive,
    path: 'Cabinet',
    description: 'Reference materials',
    color: 'text-gray-600'
  }
];

export const GTDWorkspaceSidebar: React.FC<GTDWorkspaceSidebarProps> = ({
  currentFolder,
  onFolderSelect,
  onFileSelect,
  onRefresh,
  className = '',
  gtdSpace: propGtdSpace,
  checkGTDSpace: propCheckGTDSpace,
  loadProjects: propLoadProjects
}) => {
  const {
    gtdSpace: hookGtdSpace,
    isLoading,
    checkGTDSpace: hookCheckGTDSpace,
    loadProjects: hookLoadProjects,
  } = useGTDSpace();

  // Use props if provided, otherwise fall back to hook
  const gtdSpace = propGtdSpace ?? hookGtdSpace;
  const checkGTDSpace = propCheckGTDSpace ?? hookCheckGTDSpace;
  const loadProjects = propLoadProjects ?? hookLoadProjects;

  const [showProjectDialog, setShowProjectDialog] = React.useState(false);
  const [showActionDialog, setShowActionDialog] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<GTDProject | null>(null);
  const [expandedSections, setExpandedSections] = React.useState<string[]>(['projects']);
  const [expandedProjects, setExpandedProjects] = React.useState<string[]>([]);
  const [projectActions, setProjectActions] = React.useState<{ [projectPath: string]: MarkdownFile[] }>({});
  const [actionStatuses, setActionStatuses] = React.useState<{ [actionPath: string]: string }>({});
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSearch, setShowSearch] = React.useState(false);

  // Check if current folder is a GTD space
  React.useEffect(() => {
    const checkSpace = async () => {
      // Prefer the known GTD root path if available to avoid flicker
      const pathToCheck = (gtdSpace?.root_path && currentFolder?.startsWith(gtdSpace.root_path))
        ? gtdSpace.root_path
        : currentFolder;

      if (pathToCheck) {
        const isGTD = await checkGTDSpace(pathToCheck);
        if (isGTD) {
          const projects = await loadProjects(pathToCheck);
          // console.log('Sidebar: loaded projects count =', projects?.length ?? 0);
        }
      }
    };
    checkSpace();
  }, [currentFolder, gtdSpace?.root_path, checkGTDSpace, loadProjects]);


  const loadProjectActions = React.useCallback(async (projectPath: string) => {
    try {
      // Use dedicated backend command to list actions only
      let files: MarkdownFile[] = [];
      try {
        files = await invoke<MarkdownFile[]>('list_project_actions', { projectPath });
      } catch (e) {
        console.warn('list_project_actions not available, falling back to list_markdown_files', e);
        const all = await invoke<MarkdownFile[]>('list_markdown_files', { path: projectPath });
        files = all.filter(f => f.name !== 'README.md');
      }

      const actions = files;
      // console.log(`Loaded ${actions.length} actions for project:`, projectPath, actions.map(a => a.name));

      setProjectActions(prev => ({
        ...prev,
        [projectPath]: actions
      }));

      // Load status for each action
      const statuses: { [path: string]: string } = {};
      for (const action of actions) {
        try {
          const content = await invoke<string>('read_file', { path: action.path });
          // Extract status from the markdown content
          // Look for [!singleselect:status:xxx] pattern
          const statusMatch = content.match(/\[!singleselect:status:([^\]]+)\]/);
          if (statusMatch) {
            statuses[action.path] = statusMatch[1];
          } else {
            // Default to in-progress if no status found
            statuses[action.path] = 'in-progress';
          }
        } catch (error) {
          console.warn(`Failed to read action status for ${action.path}:`, error);
          statuses[action.path] = 'in-progress';
        }
      }
      
      setActionStatuses(prev => ({
        ...prev,
        ...statuses
      }));
    } catch (error) {
      console.error('Failed to load project actions:', projectPath, error);
    }
  }, []);

  // Prefetch actions after projects load so the UI always has items ready
  React.useEffect(() => {
    const prefetch = async () => {
      if (!gtdSpace?.projects || gtdSpace.projects.length === 0) return;
      for (const project of gtdSpace.projects) {
        if (!projectActions[project.path]) {
          await loadProjectActions(project.path);
        }
      }
    };
    prefetch();
  }, [gtdSpace?.projects, loadProjectActions, projectActions]);

  const toggleProjectExpand = async (project: GTDProject) => {
    const isExpanded = expandedProjects.includes(project.path);

    if (isExpanded) {
      setExpandedProjects(prev => prev.filter(path => path !== project.path));
    } else {
      setExpandedProjects(prev => [...prev, project.path]);
      // Load actions if not already loaded
      if (!projectActions[project.path]) {
        await loadProjectActions(project.path);
      }
    }
  };

  const handleProjectClick = async (project: GTDProject) => {
    setSelectedProject(project);
    // Do not switch the global current folder; just open the README and keep GTD root stable
    // Preload actions for this project to ensure the list is populated
    if (!projectActions[project.path]) {
      await loadProjectActions(project.path);
    }

    // Open the project's README.md file
    const readmeFile: MarkdownFile = {
      id: `${project.path}/README.md`,
      name: 'README.md',
      path: `${project.path}/README.md`,
      size: 0, // Size will be determined when reading
      last_modified: Date.now(),
      extension: 'md'
    };

    onFileSelect(readmeFile);
  };

  const handleSectionClick = (section: GTDSection) => {
    // Keep current folder stable; we may extend navigation later
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const getProjectStatusColor = (statusInput: string | string[]) => {
    // Handle both string and array inputs
    const status = Array.isArray(statusInput) ? statusInput[0] : statusInput;
    const normalizedStatus = status || 'in-progress';
    // console.log('getProjectStatusColor - status:', normalizedStatus, 'from input:', statusInput);
    switch (normalizedStatus) {
      case 'completed': return 'text-green-600 dark:text-green-500';
      case 'waiting': return 'text-purple-600 dark:text-purple-500';
      case 'in-progress': return 'text-blue-600 dark:text-blue-500';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getProjectStatusIcon = (statusInput: string | string[]) => {
    // Handle both string and array inputs
    const status = Array.isArray(statusInput) ? statusInput[0] : statusInput;
    const normalizedStatus = status || 'in-progress';
    // console.log('getProjectStatusIcon - status:', normalizedStatus, 'from input:', statusInput);
    switch (normalizedStatus) {
      case 'completed': return CheckCircle2; // Filled circle with checkmark for completed
      case 'waiting': return CircleDot; // Filled circle (dot in center) for waiting
      case 'in-progress': return Circle; // Outline circle for in-progress
      default: return Circle;
    }
  };

  const getActionStatusColor = (status: string) => {
    const normalizedStatus = status || 'in-progress';
    switch (normalizedStatus) {
      case 'complete': return 'text-green-600 dark:text-green-500';
      case 'waiting': return 'text-purple-600 dark:text-purple-500';
      case 'in-progress': return 'text-blue-600 dark:text-blue-500';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const filteredProjects = React.useMemo(() => {
    // console.log('Sidebar: computing filteredProjects from', gtdSpace?.projects?.length ?? 0, 'projects, query=', searchQuery);
    
    // Debug: Log project statuses
    // if (gtdSpace?.projects) {
    //   gtdSpace.projects.forEach(p => {
    //     console.log(`Project: ${p.name}, Status:`, p.status);
    //   });
    // }
    
    if (!gtdSpace?.projects || !searchQuery) {
      return gtdSpace?.projects || [];
    }

    const query = searchQuery.toLowerCase();
    return gtdSpace.projects.filter(project =>
      project.name.toLowerCase().includes(query) ||
      project.description.toLowerCase().includes(query)
    );
  }, [gtdSpace?.projects, searchQuery]);

  const handleSelectFolder = async () => {
    try {
      const folderPath = await invoke<string>('select_folder');
      onFolderSelect(folderPath);
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };

  const handleOpenFolderInExplorer = async () => {
    if (!currentFolder) return;
    
    try {
      await invoke('open_folder_in_explorer', { path: currentFolder });
    } catch (error) {
      console.error('Failed to open folder in explorer:', error);
    }
  };

  if (!currentFolder) {
    return (
      <Card className={`flex flex-col h-full border-r ${className}`}>
        <div className="p-6 text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">Welcome to GTD Space</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Select a folder to create or open a GTD workspace
          </p>
          <Button onClick={handleSelectFolder} variant="default" size="sm">
            <Folder className="h-4 w-4 mr-2" />
            Select Folder
          </Button>
        </div>
      </Card>
    );
  }

  // If not a GTD space, show a simple message
  if (!gtdSpace?.isGTDSpace) {
    return (
      <Card className={`flex flex-col h-full border-r ${className}`}>
        <div className="p-6 text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>This is not a GTD workspace</p>
          <p className="text-sm mt-2">Initialize from the prompt</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`flex flex-col h-full border-r ${className}`}>
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-1">
            <Target className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">GTD Workspace</span>
          </h3>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button
              onClick={handleOpenFolderInExplorer}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Open in File Explorer"
            >
              <Folder className="h-3.5 w-3.5" />
            </Button>
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1 min-w-0">
            <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{gtdSpace.projects?.length || 0} Projects</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate">
              {gtdSpace.projects?.reduce((sum, p) => sum + (p.action_count || 0), 0) || 0} Actions
            </span>
          </div>
        </div>
      </div>

      {/* Search Toggle */}
      <div className="px-3 pt-2">
        <Button
          onClick={() => setShowSearch(!showSearch)}
          variant="outline"
          size="sm"
          className="w-full justify-start"
        >
          <Search className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
          <span className="truncate">Search Projects</span>
        </Button>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="px-3 py-2">
          <FileSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search..."
          />
        </div>
      )}

      {/* GTD Sections */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Projects Section - Always show first */}
          <Collapsible
            open={expandedSections.includes('projects')}
            onOpenChange={() => toggleSection('projects')}
          >
            <div className="group flex items-center justify-between p-1.5 hover:bg-accent rounded-lg transition-colors">
              <CollapsibleTrigger className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${expandedSections.includes('projects') ? 'rotate-90' : ''
                    }`} />
                  <Briefcase className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <span className="font-medium text-sm truncate">Projects</span>
                  <Badge variant="secondary" className="ml-1 text-xs px-1 py-0 h-4">
                    {filteredProjects.length}
                  </Badge>
                </div>
              </CollapsibleTrigger>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProjectDialog(true);
                }}
                variant="ghost"
                size="icon"
                className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Add Project"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            <CollapsibleContent>
              <div className="pl-6 pr-2 py-1 space-y-1">
                {isLoading ? (
                  <div className="text-sm text-muted-foreground py-2">Loading projects...</div>
                ) : filteredProjects.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">
                    {searchQuery ? 'No projects match your search' : 'No projects yet'}
                  </div>
                ) : (
                  filteredProjects.map((project) => {
                    const StatusIcon = getProjectStatusIcon(project.status);
                    const isExpanded = expandedProjects.includes(project.path);
                    const actions = projectActions[project.path] || [];

                    return (
                      <div key={project.path}>
                        <div
                          className="group flex items-center justify-between py-1 px-1 hover:bg-accent rounded-lg transition-colors"
                        >
                          <div
                            className="flex items-center gap-0.5 flex-1 min-w-0 cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              console.log('Sidebar: project click ->', project.path);
                              handleProjectClick(project)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                console.log('Sidebar: project key activate ->', project.path);
                                handleProjectClick(project);
                              }
                            }}
                          >
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProjectExpand(project);
                              }}
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0 flex-shrink-0"
                            >
                              <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </Button>
                            <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${getProjectStatusColor(project.status)}`} />
                            <div className="flex-1 min-w-0 ml-1">
                              <div className="font-medium text-sm truncate">{project.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="truncate">{project.action_count || 0} actions</span>
                                {project.due_date && (
                                  <span className="flex items-center flex-shrink-0">
                                    <Calendar className="h-2.5 w-2.5 mr-0.5" />
                                    <span className="truncate">{new Date(project.due_date).toLocaleDateString()}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProject(project);
                              setShowActionDialog(true);
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Add Action"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Actions list */}
                        {isExpanded && (
                          <div className="ml-5 space-y-0.5 mt-0.5">
                            {actions.length === 0 ? (
                              <div className="text-xs text-muted-foreground py-0.5 px-1">No actions yet</div>
                            ) : (
                              actions.map((action) => (
                                <div
                                  key={action.path}
                                  className="flex items-center gap-1 px-1 py-0.5 hover:bg-accent/50 rounded cursor-pointer text-xs"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => {
                                    console.log('Sidebar: action click ->', action.path);
                                    onFileSelect(action);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      console.log('Sidebar: action key activate ->', action.path);
                                      onFileSelect(action);
                                    }
                                  }}
                                >
                                  <FileText className={`h-2.5 w-2.5 flex-shrink-0 ${getActionStatusColor(actionStatuses[action.path] || 'in-progress')}`} />
                                  <span className="truncate">{action.name.replace('.md', '')}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Other GTD Sections */}
          {GTD_SECTIONS.slice(1).map((section) => (
            <div
              key={section.id}
              className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg cursor-pointer transition-colors"
              onClick={() => handleSectionClick(section)}
            >
              <section.icon className={`h-4 w-4 ${section.color}`} />
              <span className="font-medium">{section.name}</span>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* GTD Dialogs */}
      <GTDProjectDialog
        isOpen={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
        spacePath={gtdSpace?.root_path || currentFolder || ''}
        onSuccess={async () => {
          // Reload projects after successful creation
          if (gtdSpace?.root_path) {
            await loadProjects(gtdSpace.root_path);
          }
        }}
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
          onSuccess={async () => {
            // Reload project actions after successful creation
            await loadProjectActions(selectedProject.path);
            // Also reload projects to update action counts
            if (gtdSpace?.root_path) {
              await loadProjects(gtdSpace.root_path);
            }
          }}
        />
      )}
    </Card>
  );
};

export default GTDWorkspaceSidebar;