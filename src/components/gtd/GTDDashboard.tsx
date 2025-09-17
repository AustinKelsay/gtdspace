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
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
  DashboardOverview,
  DashboardActions,
  DashboardProjects,
  DashboardHabits,
  DashboardHorizons
} from '@/components/dashboard';
import type { GTDSpace, GTDProject, MarkdownFile, FileOperationResult } from '@/types';
import type { HorizonFile } from '@/hooks/useHorizonsRelationships';

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
  } = useHabitsHistory({ historyDays: 90, includeInactive: true });

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
  const { toast } = useToast();

  // Helper function to sanitize file names for security
  const sanitizeFileName = (input: string): string | null => {
    if (!input || input.trim() === '') return null;

    // Remove path traversal attempts and dangerous characters
    let sanitized = input
      .replace(/\.\.[/\\]/g, '') // Remove ../
      .replace(/[/\\]/g, '-')     // Replace path separators with hyphens
      .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Keep only safe characters
      .trim();

    // Reject if empty after sanitization
    if (!sanitized) return null;

    // Limit length
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
    }

    return sanitized;
  };

  // Load initial data when GTD space root path changes
  React.useEffect(() => {
    const loadInitialData = async () => {
      console.log('[GTDDashboard] Checking GTD space:', gtdSpace, 'currentFolder:', currentFolder);

      // Use gtdSpace.root_path if available, otherwise fall back to currentFolder
      const pathToLoad = gtdSpace?.root_path || currentFolder;

      if (!pathToLoad) {
        console.log('[GTDDashboard] No path available (neither gtdSpace.root_path nor currentFolder), skipping load');
        return;
      }

      // Skip if already loaded for this path
      if (loadedPathRef.current === pathToLoad) {
        console.log('[GTDDashboard] Already loaded for path:', pathToLoad);
        return;
      }

      console.log('[GTDDashboard] Loading initial data for path:', pathToLoad);

      try {
        // Load data in parallel using our new hooks
        const results = await Promise.allSettled([
          // Load base projects first
          loadProjects(pathToLoad),

          // Then load enhanced data
          loadProjectsData(pathToLoad),
          loadHabits(pathToLoad),
        ]);

        console.log('[GTDDashboard] Load results:', results.map((r, i) => ({
          index: i,
          status: r.status,
          reason: r.status === 'rejected' ? r.reason : 'success'
        })));

        // Check if habits loading failed specifically
        if (results[2].status === 'rejected') {
          console.error('[GTDDashboard] Habits loading failed:', results[2].reason);
          toast({
            title: 'Failed to Load Habits',
            description: 'Unable to load habits from the workspace. Please check the console for details.',
            variant: 'destructive',
          });
        }

        loadedPathRef.current = pathToLoad;
      } catch (error) {
        console.error('[GTDDashboard] Failed to load initial data:', error);
        loadedPathRef.current = null;
      }
    };

    loadInitialData();
  }, [
    gtdSpace,
    currentFolder,
    loadProjects,
    loadProjectsData,
    loadHabits,
    toast
  ]);

  // Load actions and horizons when projects change
  React.useEffect(() => {
    let cleanupActions: (() => void) | undefined;
    let cleanupHorizons: (() => void) | undefined;

    const loadProjectDependentData = async () => {
      if (!gtdSpace?.root_path || !gtdSpace?.projects || gtdSpace.projects.length === 0) {
        return;
      }

      try {
        const [actionsResult, horizonsResult] = await Promise.allSettled([
          loadActions(gtdSpace.projects),
          loadHorizons(gtdSpace.root_path, gtdSpace.projects)
        ]);

        // Store cleanup functions if they were returned
        if (actionsResult.status === 'fulfilled' && typeof actionsResult.value === 'function') {
          cleanupActions = actionsResult.value;
        }
        if (horizonsResult.status === 'fulfilled' && typeof horizonsResult.value === 'function') {
          cleanupHorizons = horizonsResult.value;
        }
      } catch (error) {
        console.error('[GTDDashboard] Failed to load project-dependent data:', error);
      }
    };

    loadProjectDependentData();

    // Cleanup function to cancel any ongoing operations
    return () => {
      cleanupActions?.();
      cleanupHorizons?.();
    };
  }, [
    gtdSpace?.root_path,
    gtdSpace?.projects,
    loadActions,
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

  const handleDeleteAction = async (actionId: string) => {
    try {
      // Find the action to capture path/name
      const action = actions.find(a => a.id === actionId);
      const actionPath = action?.path || actionId;
      const actionName = action?.name || 'Action';

      // Read content for temp backup
      const backupContent = await safeInvoke<string>('read_file', { path: actionPath }, '') || '';

      // Delete the file and verify result
      const delResult = await safeInvoke<FileOperationResult>('delete_file', { path: actionPath }, { success: false, message: 'Failed to delete file' });
      if (!delResult || delResult.success !== true) {
        toast({ title: 'Delete failed', description: delResult?.message || 'Could not delete action', variant: 'destructive' });
        return;
      }

      // Offer Undo via toast
      const undoToast = toast({
        title: 'Action deleted',
        description: `${actionName} was deleted`,
        action: (
          <ToastAction
            onClick={async () => {
              try {
                const writeOk = await safeInvoke('save_file', { path: actionPath, content: backupContent }, null);
                if (writeOk === null) throw new Error('Failed to write file');
                if (gtdSpace?.projects && gtdSpace.projects.length > 0) {
                  await loadActions(gtdSpace.projects);
                }
                toast({ title: 'Restored', description: `${actionName} was restored` });
                // Close the undo toast after success
                if (undoToast?.dismiss) undoToast.dismiss();
              } catch (err) {
                console.error('Failed to restore action:', err);
                toast({ title: 'Restore failed', description: String(err), variant: 'destructive' });
              }
            }}
          >
            Undo
          </ToastAction>
        )
      });

      if (gtdSpace?.projects && gtdSpace.projects.length > 0) {
        await loadActions(gtdSpace.projects);
      }
    } catch (err) {
      console.error('Failed to delete action:', err);
      toast({ title: 'Delete failed', description: String(err), variant: 'destructive' });
    }
  };

  // Handle bulk action updates
  const handleBulkActionUpdate = async (actionIds: string[], updates: Partial<{ status: string }>, actionPaths?: string[]) => {
    if (updates.status) {
      try {
        console.log('[GTDDashboard] handleBulkActionUpdate called:', {
          actionIds,
          status: updates.status,
          actionPaths
        });

        // Update each action's status in parallel
        const results = await Promise.allSettled(
          actionIds.map((actionId, index) => {
            const path = actionPaths?.[index];
            console.log(`[GTDDashboard] Updating action ${index + 1}/${actionIds.length}:`, {
              actionId,
              path,
              newStatus: updates.status
            });
            return updateActionStatus(actionId, updates.status!, path);
          })
        );

        // Count successes and failures
        let successCount = 0;
        let failureCount = 0;
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value === true) {
            successCount++;
          } else {
            failureCount++;
          }
        });

        // Show feedback to user
        if (successCount > 0 && failureCount === 0) {
          toast({
            title: 'Actions updated',
            description: `Successfully updated ${successCount} action${successCount > 1 ? 's' : ''}`
          });
        } else if (successCount > 0 && failureCount > 0) {
          toast({
            title: 'Partial update',
            description: `Updated ${successCount} action${successCount > 1 ? 's' : ''}, ${failureCount} failed`,
            variant: 'destructive'
          });
        } else if (failureCount > 0) {
          toast({
            title: 'Update failed',
            description: `Failed to update ${failureCount} action${failureCount > 1 ? 's' : ''}`,
            variant: 'destructive'
          });
        }

        // Refresh actions data to ensure UI is in sync
        if (gtdSpace?.projects && gtdSpace.projects.length > 0) {
          await loadActions(gtdSpace.projects);
        }
      } catch (err) {
        console.error('Bulk update error:', err);
        toast({
          title: 'Update failed',
          description: 'An error occurred while updating actions',
          variant: 'destructive'
        });
      }
    }
  };

  // Handle project updates
  const handleProjectUpdate = async (projectPath: string, updates: Partial<typeof projectsWithMetadata[0]>) => {
    await updateProject(projectPath, updates);
  };

  // Convert horizons to the format expected by DashboardHorizons
  const horizonFiles = React.useMemo(() => {
    const files: Record<string, HorizonFile[]> = {};
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
              actions={actions}
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
              onSelectAction={(actionPath) => {
                if (onSelectFile) {
                  const name = actionPath.split('/').pop() || 'Action.md';
                  onSelectFile({
                    id: actionPath,
                    name,
                    path: actionPath,
                    size: 0,
                    last_modified: Math.floor(Date.now() / 1000),
                    extension: 'md'
                  });
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
                last_modified: Math.floor(Date.now() / 1000),
                extension: 'md'
              })}
              onUpdateStatus={handleActionStatusUpdate}
              onBulkUpdate={handleBulkActionUpdate}
              onDeleteAction={handleDeleteAction}
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
                    last_modified: Math.floor(Date.now() / 1000),
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
                    last_modified: Math.floor(Date.now() / 1000),
                    extension: 'md'
                  };
                  onSelectFile(readmeFile);
                }
              }}
              onCompleteProject={async (project) => {
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
                    last_modified: Math.floor(Date.now() / 1000),
                    extension: 'md'
                  });
                }
              }}
              onCreateHabit={async () => {
                // Create a new habit file using the backend command
                if (gtdSpace?.root_path) {
                  const habitName = prompt('Enter habit name:');
                  if (habitName) {
                    // Available frequencies: daily, weekdays, every-other-day, twice-weekly, weekly, biweekly, monthly
                    const frequencyOptions = [
                      { value: 'daily', label: 'Daily' },
                      { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
                      { value: 'every-other-day', label: 'Every Other Day' },
                      { value: 'twice-weekly', label: 'Twice a Week' },
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'biweekly', label: 'Biweekly' },
                      { value: 'monthly', label: 'Monthly' }
                    ];

                    const frequencyLabels = frequencyOptions.map(f => f.label).join('\n');
                    const selectedLabel = prompt(`Select frequency:\n${frequencyLabels}`, 'Daily');

                    if (selectedLabel) {
                      const frequency = frequencyOptions.find(f =>
                        f.label.toLowerCase() === selectedLabel.toLowerCase()
                      )?.value || 'daily';

                      try {
                        const habitPath = await safeInvoke<string>('create_gtd_habit', {
                          space_path: gtdSpace.root_path,
                          habit_name: habitName,
                          frequency: frequency,
                          status: 'todo',
                          focus_time: null
                        });

                        // Open the new habit file
                        if (habitPath && onSelectFile) {
                          onSelectFile({
                            id: habitPath,
                            name: `${habitName}.md`,
                            path: habitPath,
                            size: 0,
                            last_modified: Math.floor(Date.now() / 1000),
                            extension: 'md'
                          });
                        }
                        // Reload habits
                        await loadHabits(gtdSpace.root_path);
                      } catch (error) {
                        console.error('Failed to create habit:', error);
                        alert(`Failed to create habit: ${error}`);
                      }
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
                  const sanitizedName = sanitizeFileName(fileName || '');

                  if (!sanitizedName) {
                    toast({
                      title: 'Invalid file name',
                      description: 'Please enter a valid file name without special characters',
                      variant: 'destructive'
                    });
                    return;
                  }

                  // Ensure the file name ends with .md
                  const fileNameWithExt = sanitizedName.endsWith('.md') ? sanitizedName : `${sanitizedName}.md`;
                  const filePath = `${gtdSpace.root_path}/${horizon}/${fileNameWithExt}`;

                  // Additional security check: ensure the resolved path is within the horizon directory
                  const expectedPrefix = `${gtdSpace.root_path}/${horizon}/`;
                  if (!filePath.startsWith(expectedPrefix)) {
                    toast({
                      title: 'Security error',
                      description: 'Invalid file path detected',
                      variant: 'destructive'
                    });
                    return;
                  }

                  const title = sanitizedName.replace('.md', '');

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
                      const writeResult = await safeInvoke('save_file', {
                        path: filePath,
                        content: defaultContent
                      }, null);
                      if (!writeResult) {
                        console.error('Failed to create new file');
                        return;
                      }
                      // Open the new file
                      if (onSelectFile) {
                        onSelectFile({
                          id: filePath,
                          name: fileNameWithExt,
                          path: filePath,
                          size: 0,
                          last_modified: Math.floor(Date.now() / 1000),
                          extension: 'md'
                        });
                      }
                      // Reload horizons
                      await loadHorizons(gtdSpace.root_path, gtdSpace.projects || []);
                    } catch (error) {
                      console.error('Failed to create file:', error);
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
