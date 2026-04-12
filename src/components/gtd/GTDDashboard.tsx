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
import {
  useProjectsData,
  type PersistedProjectUpdates,
} from '@/hooks/useProjectsData';
import { useHabitsHistory } from '@/hooks/useHabitsHistory';
import { useHorizonsRelationships } from '@/hooks/useHorizonsRelationships';
import {
  GTDProjectDialog,
  GTDActionDialog,
  CreatePageDialog,
  CreateHabitDialog,
} from '@/components/gtd';
import { safeInvoke } from '@/utils/safe-invoke';
import { useToast } from '@/hooks/use-toast';
import { ACTION_TOAST_DURATION_MS } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { onContentSaved, onMetadataChange } from '@/utils/content-event-bus';
import {
  DashboardOverview,
  DashboardActions,
  DashboardProjects,
  DashboardHabits,
  DashboardHorizons
} from '@/components/dashboard';
import type { GTDSpace, GTDProject, MarkdownFile, FileOperationResult } from '@/types';
import type { GTDActionStatus } from '@/types';
import type { HorizonFile } from '@/hooks/useHorizonsRelationships';
import { createScopedLogger } from '@/utils/logger';
import { norm } from '@/utils/path';
import { buildDashboardActivityFeed } from '@/utils/dashboard-activity';

const log = createScopedLogger('GTDDashboard');

type DashboardHorizonSectionId = 'purpose' | 'vision' | 'goals' | 'areas';

type HorizonDialogConfig = {
  directory: string;
  directoryName: string;
  sectionId: DashboardHorizonSectionId;
  spacePath: string;
};

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
    updateHabitStatus,
    refresh: refreshHabits
  } = useHabitsHistory({ historyDays: 90, includeInactive: true });

  const {
    horizons,
    relationships,
    graph,
    isLoading: horizonsLoading,
    loadHorizons,
    findRelated
  } = useHorizonsRelationships({
    includeProjects: true,
    includeCabinet: true,
    includeSomedayMaybe: true
  });

  // State for UI management
  const [showProjectDialog, setShowProjectDialog] = React.useState(false);
  const [showActionDialog, setShowActionDialog] = React.useState(false);
  const [showHabitDialog, setShowHabitDialog] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<GTDProject | null>(null);
  const [pageDialogConfig, setPageDialogConfig] = React.useState<HorizonDialogConfig | null>(null);
  const [activeTab, setActiveTab] = React.useState('overview');
  const [selectedHorizonLevel, setSelectedHorizonLevel] = React.useState<string>('All');

  // Track if we've loaded data for current space
  const loadedPathRef = React.useRef<string | null>(null);
  const { toast } = useToast();

  const openMarkdownFile = React.useCallback((filePath: string) => {
    const normalizedPath = norm(filePath) ?? filePath;
    const derivedName =
      normalizedPath.split('/').filter(Boolean).pop() || 'Untitled.md';

    onSelectFile?.({
      id: normalizedPath,
      name: derivedName,
      path: normalizedPath,
      size: 0,
      last_modified: Math.floor(Date.now() / 1000),
      extension: derivedName.split('.').pop() || 'md',
    });
  }, [onSelectFile]);

  const openProjectReadme = React.useCallback((projectPath: string) => {
    onSelectProject(projectPath);

    const candidates = [
      `${projectPath}/README.md`,
      `${projectPath}/README.markdown`,
    ];

    void (async () => {
      for (const candidate of candidates) {
        const exists = await safeInvoke<boolean>('check_file_exists', { filePath: candidate }, false);
        if (exists) {
          openMarkdownFile(candidate);
          return;
        }
      }

      openMarkdownFile(candidates[0]);
    })();
  }, [onSelectProject, openMarkdownFile]);

  // Load initial data when GTD space root path changes
  React.useEffect(() => {
    const loadInitialData = async () => {
      log.debug('Checking GTD space', { gtdSpace, currentFolder });

      // Use gtdSpace.root_path if available, otherwise fall back to currentFolder
      const pathToLoad = gtdSpace?.root_path || currentFolder;

      if (!pathToLoad) {
        log.debug('No path available (neither root_path nor currentFolder); skipping load');
        return;
      }

      // Skip if already loaded for this path
      if (loadedPathRef.current === pathToLoad) {
        log.debug('Already loaded for path', pathToLoad);
        return;
      }

      log.info('Loading initial GTD data for path', pathToLoad);

      try {
        // Load data in parallel using our new hooks
        const results = await Promise.allSettled([
          // Load base projects first
          loadProjects(pathToLoad),

          // Then load enhanced data
          loadProjectsData(pathToLoad),
          loadHabits(pathToLoad),
        ]);

        log.debug('Load results', results.map((r, i) => ({
          index: i,
          status: r.status,
          reason: r.status === 'rejected' ? r.reason : 'success'
        })));

        // Check if habits loading failed specifically
        if (results[2].status === 'rejected') {
          log.error('Habits loading failed', results[2].reason);
          toast({
            title: 'Failed to Load Habits',
            description: 'Unable to load habits from the workspace. Please check the console for details.',
            variant: 'destructive',
          });
        }

        loadedPathRef.current = pathToLoad;
      } catch (error) {
        log.error('Failed to load initial data', error);
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
        log.error('Failed to load project-dependent data', error);
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

  React.useEffect(() => {
    const rootPath = gtdSpace?.root_path;
    if (!rootPath) {
      return;
    }

    const normalizedRoot = (norm(rootPath) ?? rootPath).replace(/\\/g, '/').toLowerCase();
    let reloadTimer: number | null = null;

    const isHabitPathForCurrentSpace = (candidatePath?: string | null): boolean => {
      if (!candidatePath) return false;
      const normalizedPath = (norm(candidatePath) ?? candidatePath)
        .replace(/\\/g, '/')
        .toLowerCase();
      return (
        normalizedPath.startsWith(normalizedRoot) &&
        normalizedPath.includes('/habits/')
      );
    };

    const scheduleHabitsRefresh = (filePath?: string | null) => {
      if (filePath && !isHabitPathForCurrentSpace(filePath)) {
        return;
      }

      if (reloadTimer !== null) {
        window.clearTimeout(reloadTimer);
      }

      reloadTimer = window.setTimeout(() => {
        void refreshHabits();
        reloadTimer = null;
      }, 100);
    };

    const savedUnsubscribe = onContentSaved((event) => {
      scheduleHabitsRefresh(event.filePath);
    });

    const metadataUnsubscribe = onMetadataChange((event) => {
      if (!isHabitPathForCurrentSpace(event.filePath)) {
        return;
      }

      const changedFields = event.changedFields;
      if (!changedFields) {
        return;
      }

      const hasHabitFieldChange = Object.keys(changedFields).some((key) => {
        const normalizedKey = key.toLowerCase();
        return normalizedKey.includes('habit') || normalizedKey.includes('frequency');
      });

      if (hasHabitFieldChange) {
        scheduleHabitsRefresh(event.filePath);
      }
    });

    const handleHabitContentChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ filePath?: string; habitPath?: string }>).detail;
      scheduleHabitsRefresh(detail?.filePath ?? detail?.habitPath);
    };

    const handleHabitsRefreshed = () => {
      scheduleHabitsRefresh();
    };

    window.addEventListener('habit-content-changed', handleHabitContentChanged);
    window.addEventListener('habit-status-updated', handleHabitContentChanged);
    window.addEventListener('habits-refreshed', handleHabitsRefreshed);

    return () => {
      savedUnsubscribe?.();
      metadataUnsubscribe?.();
      window.removeEventListener('habit-content-changed', handleHabitContentChanged);
      window.removeEventListener('habit-status-updated', handleHabitContentChanged);
      window.removeEventListener('habits-refreshed', handleHabitsRefreshed);
      if (reloadTimer !== null) {
        window.clearTimeout(reloadTimer);
      }
    };
  }, [gtdSpace?.root_path, refreshHabits]);

  // Handle habit toggle
  const handleHabitToggle = async (habit: typeof habitsWithHistory[0]) => {
    const nextStatus = habit.status === 'completed' ? 'todo' : 'completed';
    await updateHabitStatus(habit.path, nextStatus);
  };

  // Handle action status update
  const handleActionStatusUpdate = async (actionId: string, newStatus: GTDActionStatus) => {
    await updateActionStatus(actionId, newStatus);
  };

  const handleDeleteAction = async (actionId: string) => {
    try {
      // Find the action to capture path/name
      const action = actions.find(a => a.id === actionId);
      const actionPath = action?.path || actionId;
      const actionName = action?.name || 'Action';

      // Read content for temp backup
      const backupContent = await safeInvoke<string>('read_file', { path: actionPath }, null);
      if (backupContent == null) {
        toast({
          title: 'Delete failed',
          description: 'Could not back up action before delete',
          variant: 'destructive'
        });
        return;
      }

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
        duration: ACTION_TOAST_DURATION_MS,
        action: (
          <ToastAction
            altText={`Restore ${actionName}`}
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
                log.error('Failed to restore action', err);
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
      log.error('Failed to delete action', err);
      toast({ title: 'Delete failed', description: String(err), variant: 'destructive' });
    }
  };

  // Handle bulk action updates
  const handleBulkActionUpdate = async (actionIds: string[], updates: Partial<{ status: GTDActionStatus }>, actionPaths?: string[]) => {
    if (updates.status) {
      try {
        log.debug('handleBulkActionUpdate called', {
          actionIds,
          status: updates.status,
          actionPaths
        });

        // Update each action's status in parallel
        const results = await Promise.allSettled(
          actionIds.map((actionId, index) => {
            const path = actionPaths?.[index];
            log.debug(`Updating action ${index + 1}/${actionIds.length}`, {
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
        log.error('Bulk update error', err);
        toast({
          title: 'Update failed',
          description: 'An error occurred while updating actions',
          variant: 'destructive'
        });
      }
    }
  };

  // Handle project updates
  const handleProjectUpdate = async (
    projectPath: string,
    updates: PersistedProjectUpdates
  ) => {
    await updateProject(projectPath, updates);
  };

  const handleOpenAction = React.useCallback((actionPath: string) => {
    openMarkdownFile(actionPath);
  }, [openMarkdownFile]);

  const handleOpenHabit = React.useCallback((habitPath: string) => {
    openMarkdownFile(habitPath);
  }, [openMarkdownFile]);

  const handleOpenHorizonDialog = React.useCallback((horizon: string) => {
    const rootPath = gtdSpace?.root_path;
    if (!rootPath) {
      return;
    }

    const configs: Record<string, Omit<HorizonDialogConfig, 'spacePath'>> = {
      'Purpose & Principles': {
        directory: `${rootPath}/Purpose & Principles`,
        directoryName: 'Purpose & Principles',
        sectionId: 'purpose',
      },
      'Vision': {
        directory: `${rootPath}/Vision`,
        directoryName: 'Vision',
        sectionId: 'vision',
      },
      'Goals': {
        directory: `${rootPath}/Goals`,
        directoryName: 'Goals',
        sectionId: 'goals',
      },
      'Areas of Focus': {
        directory: `${rootPath}/Areas of Focus`,
        directoryName: 'Areas of Focus',
        sectionId: 'areas',
      },
    };

    const nextConfig = configs[horizon];
    if (!nextConfig) {
      log.warn('Unsupported horizon dialog request', { horizon });
      return;
    }

    setPageDialogConfig({
      ...nextConfig,
      spacePath: rootPath,
    });
  }, [gtdSpace?.root_path]);

  // Convert horizons to the format expected by DashboardHorizons
  const horizonFiles = React.useMemo(() => {
    const files: Record<string, HorizonFile[]> = {};
    Object.entries(horizons).forEach(([name, level]) => {
      files[name] = level.files;
    });
    return files;
  }, [horizons]);

  const recentActivity = React.useMemo(() => (
    buildDashboardActivityFeed({
      actions,
      projects: projectsWithMetadata,
      habits: habitsWithHistory,
      horizonFiles: Object.values(horizonFiles).flat(),
    })
  ), [actions, habitsWithHistory, horizonFiles, projectsWithMetadata]);

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
        <div className="px-4 pb-2 pt-4 sm:px-6 sm:pt-6">
          {/* Header */}
          <div className="mb-4">
            <h1 className="flex items-center gap-3 text-2xl font-semibold sm:text-3xl">
              <LayoutDashboard className="h-7 w-7 text-primary sm:h-8 sm:w-8" />
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Projects, actions, habits, and horizons in one place
            </p>
          </div>

          {/* Navigation Tabs - 5 tabs */}
          <div className="-mx-1 overflow-x-auto pb-1">
            <TabsList className="h-auto min-w-max gap-1 rounded-lg bg-muted/60 p-1">
              <TabsTrigger value="overview" className="min-w-[7.5rem] gap-2 px-3 py-2">
                <Activity className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="actions" className="min-w-[7.5rem] gap-2 px-3 py-2">
                <ListChecks className="h-4 w-4" />
                Actions
              </TabsTrigger>
              <TabsTrigger value="projects" className="min-w-[7.5rem] gap-2 px-3 py-2">
                <FolderOpen className="h-4 w-4" />
                Projects
              </TabsTrigger>
              <TabsTrigger value="habits" className="min-w-[7.5rem] gap-2 px-3 py-2">
                <RefreshCw className="h-4 w-4" />
                Habits
              </TabsTrigger>
              <TabsTrigger value="horizons" className="min-w-[7.5rem] gap-2 px-3 py-2">
                <Layers className="h-4 w-4" />
                Horizons
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Overview Tab */}
          <TabsContent value="overview" className="h-full overflow-auto px-4 py-4 sm:px-6 sm:py-6">
            <DashboardOverview
              gtdSpace={gtdSpace}
              projects={projectsWithMetadata}
              habits={habitsWithHistory}
              actions={actions}
              actionSummary={actionSummary}
              horizonCounts={Object.fromEntries(
                Object.entries(horizons).map(([name, level]) => [name, level.files.length])
              )}
              recentActivity={recentActivity}
              isLoading={combinedLoading}
              onNewProject={() => setShowProjectDialog(true)}
              onSelectProject={openProjectReadme}
              onSelectHorizon={(name) => {
                setActiveTab('horizons');
                setSelectedHorizonLevel(name);
              }}
              onSelectAction={handleOpenAction}
              onSelectActivity={(item) => {
                if (item.entityType === 'project') {
                  openProjectReadme(item.path);
                  return;
                }
                openMarkdownFile(item.path);
              }}
            />
          </TabsContent>

          {/* Actions Tab - Enhanced with new data */}
          <TabsContent value="actions" className="h-full overflow-auto px-4 py-4 sm:px-6 sm:py-6">
            <DashboardActions
              actions={actions}
              projects={gtdSpace.projects?.map(p => ({ name: p.name, path: p.path })) || []}
              isLoading={actionsLoading}
              onSelectAction={(action) => handleOpenAction(action.path)}
              onUpdateStatus={handleActionStatusUpdate}
              onBulkUpdate={handleBulkActionUpdate}
              onDeleteAction={handleDeleteAction}
            />
          </TabsContent>

          {/* Projects Tab - Enhanced with metadata */}
          <TabsContent value="projects" className="h-full overflow-auto px-4 py-4 sm:px-6 sm:py-6">
            <DashboardProjects
              projects={projectsWithMetadata}
              isLoading={projectsLoading}
              onSelectProject={(project) => {
                void openProjectReadme(project.path);
              }}
              onCreateProject={() => setShowProjectDialog(true)}
              onEditProject={(project) => {
                void openProjectReadme(project.path);
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
          <TabsContent value="habits" className="h-full overflow-auto px-4 py-4 sm:px-6 sm:py-6">
            <DashboardHabits
              habits={habitsWithHistory}
              isLoading={habitsLoading}
              onToggleHabit={handleHabitToggle}
              onEditHabit={(habit) => {
                handleOpenHabit(habit.path);
              }}
              onCreateHabit={() => setShowHabitDialog(true)}
            />
          </TabsContent>

          {/* Horizons Tab - Enhanced with relationships */}
          <TabsContent value="horizons" className="h-full overflow-auto px-4 py-4 sm:px-6 sm:py-6">
            <DashboardHorizons
              horizonFiles={horizonFiles}
              projects={projectsWithMetadata}
              relationships={relationships}
              graph={graph}
              findRelated={findRelated}
              selectedLevel={selectedHorizonLevel}
              onSelectedLevelChange={setSelectedHorizonLevel}
              isLoading={horizonsLoading}
              onSelectFile={onSelectFile}
              onCreateFile={handleOpenHorizonDialog}
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

          <CreateHabitDialog
            isOpen={showHabitDialog}
            onClose={() => setShowHabitDialog(false)}
            spacePath={gtdSpace?.root_path || currentFolder || ''}
            onSuccess={(habitPath) => {
              void (async () => {
                await loadHabits(gtdSpace?.root_path || currentFolder || '');
                openMarkdownFile(habitPath);
              })();
            }}
          />

          {pageDialogConfig && (
            <CreatePageDialog
              isOpen={pageDialogConfig !== null}
              onClose={() => setPageDialogConfig(null)}
              directory={pageDialogConfig.directory}
              directoryName={pageDialogConfig.directoryName}
              sectionId={pageDialogConfig.sectionId}
              spacePath={pageDialogConfig.spacePath}
              onSuccess={(filePath) => {
                void (async () => {
                  await loadHorizons(pageDialogConfig.spacePath, gtdSpace?.projects || []);
                  openMarkdownFile(filePath);
                  setPageDialogConfig(null);
                })();
              }}
            />
          )}

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
