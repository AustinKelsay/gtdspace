/**
 * @fileoverview GTD Dashboard component - Refactored with 5-tab structure and enhanced data hooks
 * @author Development Team
 * @created 2025-01-17
 */

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  FolderOpen,
  Layers,
  LayoutDashboard,
  ListChecks,
  RefreshCw
} from 'lucide-react';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { useActionsData } from '@/hooks/useActionsData';
import { useProjectsData } from '@/hooks/useProjectsData';
import { useHabitsHistory } from '@/hooks/useHabitsHistory';
import { useHorizonsRelationships } from '@/hooks/useHorizonsRelationships';
import { GTDProjectDialog, GTDActionDialog } from '@/components/gtd';
import { safeInvoke } from '@/utils/safe-invoke';
import {
  DashboardOverview,
  DashboardActions,
  DashboardProjects,
  DashboardHabits,
  DashboardHorizons
} from '@/components/dashboard';
import type { GTDSpace, GTDProject, MarkdownFile } from '@/types';

interface GTDDashboardProps {
  currentFolder: string | null;
  gtdSpace?: GTDSpace | null;
  loadProjects?: (path: string) => Promise<GTDProject[]>;
  isLoading?: boolean;
  onSelectProject: (projectPath: string) => void;
  onSelectFile?: (file: MarkdownFile) => void;
  className?: string;
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
  // Use shared hooks for base functionality
  const { isLoading: hookIsLoading, loadProjects: hookLoadProjects } = useGTDSpace();
  const isLoading = isLoadingProp ?? hookIsLoading;
  const loadProjects = React.useMemo(
    () => loadProjectsProp ?? hookLoadProjects,
    [loadProjectsProp, hookLoadProjects]
  );

  // Use new data hooks for enhanced functionality
  const {
    actions,
    isLoading: actionsLoading,
    summary: actionSummary,
    loadActions,
    updateActionStatus
  } = useActionsData({ includeCompleted: true, includeCancelled: true });

  const {
    projects: projectsWithMetadata,
    isLoading: projectsLoading,
    loadProjects: loadProjectsData,
    updateProject
  } = useProjectsData({ includeArchived: false, loadActionStats: true });

  const {
    habits: habitsWithHistory,
    isLoading: habitsLoading,
    summary: _habitsSummary,
    analytics: _habitsAnalytics,
    loadHabits,
    updateHabitStatus
  } = useHabitsHistory({ historyDays: 90, includeInactive: false });

  const {
    horizons,
    relationships,
    isLoading: horizonsLoading,
    loadHorizons,
    findRelated: _findRelated
  } = useHorizonsRelationships({
    includeProjects: true,
    includeCabinet: true,
    includeSomedayMaybe: true
  });

  // State for UI management
  const [showProjectDialog, setShowProjectDialog] = React.useState(false);
  const [showActionDialog, setShowActionDialog] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<GTDProject | null>(null);
  const [activeTab, setActiveTab] = React.useState('overview');

  // Track if we've loaded data for current space
  const loadedPathRef = React.useRef<string | null>(null);

  // Load all data when GTD space changes
  React.useEffect(() => {
    const loadAllData = async () => {
      if (!gtdSpace?.root_path) return;

      // Skip if already loaded for this path
      if (loadedPathRef.current === gtdSpace.root_path) {
        return;
      }

      try {
        // Load data in parallel using our new hooks
        await Promise.allSettled([
          // Load base projects first
          loadProjects(gtdSpace.root_path),
          
          // Then load enhanced data
          loadProjectsData(gtdSpace.root_path),
          loadHabits(gtdSpace.root_path),
        ]);

        // After projects are loaded, load actions and horizons
        if (gtdSpace.projects && gtdSpace.projects.length > 0) {
          await Promise.allSettled([
            loadActions(gtdSpace.projects),
            loadHorizons(gtdSpace.root_path, gtdSpace.projects)
          ]);
        }

        loadedPathRef.current = gtdSpace.root_path;
      } catch (error) {
        console.error('[GTDDashboard] Failed to load data:', error);
        loadedPathRef.current = null;
      }
    };

    loadAllData();
  }, [
    gtdSpace?.root_path,
    gtdSpace?.projects,
    loadProjects,
    loadProjectsData,
    loadActions,
    loadHabits,
    loadHorizons
  ]);

  // Handle habit toggle
  const handleHabitToggle = async (habit: typeof habitsWithHistory[0]) => {
    const newStatus = habit.status === 'completed';
    await updateHabitStatus(habit.path, !newStatus);
  };

  // Handle action status update
  const handleActionStatusUpdate = async (actionId: string, newStatus: string) => {
    await updateActionStatus(actionId, newStatus);
  };

  // Handle bulk action updates
  const handleBulkActionUpdate = async (actionIds: string[], updates: Partial<{ status: string }>) => {
    if (updates.status) {
      // Update each action's status in parallel
      await Promise.allSettled(
        actionIds.map(actionId => updateActionStatus(actionId, updates.status!))
      );
    }
  };

  // Handle project updates
  const handleProjectUpdate = async (projectPath: string, updates: Partial<typeof projectsWithMetadata[0]>) => {
    await updateProject(projectPath, updates);
  };

  // Convert horizons to the format expected by DashboardHorizons
  const horizonFiles = React.useMemo(() => {
    const files: Record<string, MarkdownFile[]> = {};
    Object.entries(horizons).forEach(([name, level]) => {
      files[name] = level.files;
    });
    return files;
  }, [horizons]);

  if (!currentFolder || !gtdSpace?.isGTDSpace) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <LayoutDashboard className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h2 className="text-xl font-semibold mb-2">No GTD Space Selected</h2>
          <p className="text-muted-foreground">
            Select a GTD workspace from the sidebar to view your dashboard
          </p>
        </div>
      </div>
    );
  }

  const combinedLoading = isLoading || actionsLoading || projectsLoading || habitsLoading || horizonsLoading;

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

          {/* Navigation Tabs - 5 tabs */}
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Actions
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Projects
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

        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Overview Tab */}
          <TabsContent value="overview" className="h-full p-6 overflow-auto">
            <DashboardOverview
              gtdSpace={gtdSpace}
              projects={projectsWithMetadata}
              habits={habitsWithHistory}
              actionSummary={actionSummary}
              horizonCounts={Object.fromEntries(
                Object.entries(horizons).map(([name, level]) => [name, level.files.length])
              )}
              isLoading={combinedLoading}
              onNewProject={() => setShowProjectDialog(true)}
              onSelectProject={onSelectProject}
              onSelectHorizon={(name) => {
                const level = horizons[name];
                if (level && level.files.length > 0 && onSelectFile) {
                  onSelectFile(level.files[0]);
                }
              }}
            />
          </TabsContent>

          {/* Actions Tab - Enhanced with new data */}
          <TabsContent value="actions" className="h-full p-6 overflow-auto">
            <DashboardActions
              actions={actions}
              projects={gtdSpace.projects?.map(p => ({ name: p.name, path: p.path })) || []}
              isLoading={actionsLoading}
              onSelectAction={(action) => onSelectFile?.({
                id: action.id,
                name: action.name,
                path: action.path,
                size: 0,
                last_modified: Date.now(),
                extension: 'md'
              })}
              onUpdateStatus={handleActionStatusUpdate}
              onBulkUpdate={handleBulkActionUpdate}
            />
          </TabsContent>

          {/* Projects Tab - Enhanced with metadata */}
          <TabsContent value="projects" className="h-full p-6 overflow-auto">
            <DashboardProjects
              projects={projectsWithMetadata}
              isLoading={projectsLoading}
              onSelectProject={(project) => {
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
              onCreateProject={() => setShowProjectDialog(true)}
              onEditProject={(project) => {
                // Open the project's README file in the editor
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
              onArchiveProject={async (project) => {
                await handleProjectUpdate(project.path, { status: 'completed' });
              }}
              onAddAction={(project) => {
                setSelectedProject(project);
                setShowActionDialog(true);
              }}
            />
          </TabsContent>

          {/* Habits Tab - Enhanced with history and analytics */}
          <TabsContent value="habits" className="h-full p-6 overflow-auto">
            <DashboardHabits
              habits={habitsWithHistory}
              isLoading={habitsLoading}
              onToggleHabit={handleHabitToggle}
              onEditHabit={(habit) => {
                if (onSelectFile) {
                  onSelectFile({
                    id: habit.path,
                    name: habit.name,
                    path: habit.path,
                    size: 0,
                    last_modified: Date.now(),
                    extension: 'md'
                  });
                }
              }}
              onCreateHabit={async () => {
                // Create a new habit file
                if (gtdSpace?.root_path) {
                  const habitName = prompt('Enter habit name:');
                  if (habitName) {
                    // Create a new habit file with default template
                    const habitPath = `${gtdSpace.root_path}/Habits/${habitName}.md`;
                    const defaultContent = `# ${habitName}

[!singleselect:habit-frequency:daily]
[!checkbox:habit-status:false]

## Description
Describe your habit here.

## History
<!-- Auto-generated history will appear below -->
`;
                    try {
                      await safeInvoke('write_file', {
                        path: habitPath,
                        content: defaultContent
                      });
                      // Open the new habit file
                      if (onSelectFile) {
                        onSelectFile({
                          id: habitPath,
                          name: `${habitName}.md`,
                          path: habitPath,
                          size: 0,
                          last_modified: Date.now(),
                          extension: 'md'
                        });
                      }
                      // Reload habits
                      await loadHabits(gtdSpace.root_path);
                    } catch (error) {
                      console.error('Failed to create habit:', error);
                    }
                  }
                }
              }}
            />
          </TabsContent>

          {/* Horizons Tab - Enhanced with relationships */}
          <TabsContent value="horizons" className="h-full p-6 overflow-auto">
            <DashboardHorizons
              horizonFiles={horizonFiles}
              projects={projectsWithMetadata}
              relationships={relationships}
              isLoading={horizonsLoading}
              onSelectFile={onSelectFile}
              onCreateFile={async (horizon) => {
                // Create a new file in the specified horizon
                if (gtdSpace?.root_path) {
                  const fileName = prompt(`Create new ${horizon} file:`);
                  if (fileName) {
                    // Ensure the file name ends with .md
                    const fileNameWithExt = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
                    const filePath = `${gtdSpace.root_path}/${horizon}/${fileNameWithExt}`;
                    const title = fileName.replace('.md', '');

                    // Create default content based on horizon type
                    let defaultContent = `# ${title}\n\n`;

                    // Add horizon-specific metadata fields
                    if (horizon === 'Projects') {
                      defaultContent += `[!singleselect:project-status:in-progress]\n[!datetime:due_date:]\n\n## Overview\n\n## Actions\n[!actions-list]\n`;
                    } else if (horizon === 'Areas of Focus') {
                      defaultContent += `## Description\n\n## Related Projects\n[!projects-references:]\n`;
                    } else if (horizon === 'Goals') {
                      defaultContent += `[!datetime:target_date:]\n\n## Objective\n\n## Related Areas\n[!areas-references:]\n`;
                    } else if (horizon === 'Vision') {
                      defaultContent += `## Vision Statement\n\n## Related Goals\n[!goals-references:]\n`;
                    } else if (horizon === 'Purpose & Principles') {
                      defaultContent += `## Core Purpose\n\n## Guiding Principles\n\n`;
                    } else {
                      defaultContent += `## Description\n\n`;
                    }

                    try {
                      await safeInvoke('write_file', {
                        path: filePath,
                        content: defaultContent
                      });
                      // Open the new file
                      if (onSelectFile) {
                        onSelectFile({
                          id: filePath,
                          name: fileNameWithExt,
                          path: filePath,
                          size: 0,
                          last_modified: Date.now(),
                          extension: 'md'
                        });
                      }
                      // Reload horizons
                      await loadHorizons(gtdSpace.root_path, gtdSpace.projects || []);
                    } catch (error) {
                      console.error('Failed to create file:', error);
                    }
                  }
                }
              }}
            />
          </TabsContent>
        </div>
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