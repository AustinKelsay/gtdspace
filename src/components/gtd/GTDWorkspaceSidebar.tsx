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
    loadProjects: hookLoadProjects
  } = useGTDSpace();
  
  // Use props if provided, otherwise fall back to hook
  const gtdSpace = propGtdSpace !== undefined ? propGtdSpace : hookGtdSpace;
  const checkGTDSpace = propCheckGTDSpace || hookCheckGTDSpace;
  const loadProjects = propLoadProjects || hookLoadProjects;
  
  const [showProjectDialog, setShowProjectDialog] = React.useState(false);
  const [showActionDialog, setShowActionDialog] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<GTDProject | null>(null);
  const [expandedSections, setExpandedSections] = React.useState<string[]>(['projects']);
  const [expandedProjects, setExpandedProjects] = React.useState<string[]>([]);
  const [projectActions, setProjectActions] = React.useState<{ [projectPath: string]: MarkdownFile[] }>({});
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSearch, setShowSearch] = React.useState(false);

  // Check if current folder is a GTD space
  React.useEffect(() => {
    const checkSpace = async () => {
      if (currentFolder) {
        const isGTD = await checkGTDSpace(currentFolder);
        if (isGTD) {
          await loadProjects(currentFolder);
        }
      }
    };
    checkSpace();
  }, [currentFolder, checkGTDSpace, loadProjects]);


  const loadProjectActions = React.useCallback(async (projectPath: string) => {
    try {
      const files = await invoke<MarkdownFile[]>('list_markdown_files', { 
        path: projectPath 
      });
      
      // Filter out README.md to show only actions
      const actions = files.filter(file => file.name !== 'README.md');
      
      setProjectActions(prev => ({
        ...prev,
        [projectPath]: actions
      }));
    } catch (error) {
      console.error('Failed to load project actions:', error);
    }
  }, []);

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
    onFolderSelect(project.path);
    
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
    if (gtdSpace?.root_path) {
      const sectionPath = `${gtdSpace.root_path}/${section.path}`;
      onFolderSelect(sectionPath);
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const getProjectStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'text-green-600';
      case 'on hold': return 'text-yellow-600';
      case 'complete': return 'text-blue-600';
      case 'cancelled': return 'text-gray-500';
      default: return 'text-gray-600';
    }
  };

  const getProjectStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'complete': return CheckCircle2;
      default: return Circle;
    }
  };

  const filteredProjects = React.useMemo(() => {
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
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Target className="h-4 w-4" />
            GTD Workspace
          </h3>
          <div className="flex items-center gap-1">
            <Button
              onClick={handleSelectFolder}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Change Workspace"
            >
              <Folder className="h-4 w-4" />
            </Button>
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Briefcase className="h-3 w-3 text-muted-foreground" />
            <span>{gtdSpace.projects?.length || 0} Projects</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span>
              {gtdSpace.projects?.reduce((sum, p) => sum + (p.action_count || 0), 0) || 0} Actions
            </span>
          </div>
        </div>
      </div>

      {/* Search Toggle */}
      <div className="px-4 pt-3">
        <Button
          onClick={() => setShowSearch(!showSearch)}
          variant="outline"
          size="sm"
          className="w-full justify-start"
        >
          <Search className="h-4 w-4 mr-2" />
          Search Projects
        </Button>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="p-4 pt-2">
          <FileSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search projects..."
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
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex-1">
                <div className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg transition-colors">
                  <ChevronRight className={`h-4 w-4 transition-transform ${
                    expandedSections.includes('projects') ? 'rotate-90' : ''
                  }`} />
                  <Briefcase className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Projects</span>
                  <Badge variant="secondary" className="ml-2">
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
                className="h-6 w-6 mr-2"
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
                          className="group flex items-center justify-between p-2 hover:bg-accent rounded-lg transition-colors"
                        >
                          <div 
                            className="flex items-center gap-1 flex-1 min-w-0 cursor-pointer"
                            onClick={() => handleProjectClick(project)}
                          >
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProjectExpand(project);
                              }}
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0"
                            >
                              <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </Button>
                            <StatusIcon className={`h-4 w-4 ${getProjectStatusColor(project.status)}`} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{project.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {project.action_count || 0} actions
                                {project.due_date && (
                                  <span className="ml-2">
                                    <Calendar className="inline h-3 w-3 mr-1" />
                                    {new Date(project.due_date).toLocaleDateString()}
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
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        {/* Actions list */}
                        {isExpanded && (
                          <div className="ml-8 space-y-1 mt-1">
                            {actions.length === 0 ? (
                              <div className="text-xs text-muted-foreground py-1 px-2">No actions yet</div>
                            ) : (
                              actions.map((action) => (
                                <div
                                  key={action.path}
                                  className="flex items-center gap-2 px-2 py-1 hover:bg-accent/50 rounded cursor-pointer text-sm"
                                  onClick={() => onFileSelect(action)}
                                >
                                  <FileText className="h-3 w-3 text-muted-foreground" />
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
    </Card>
  );
};

export default GTDWorkspaceSidebar;