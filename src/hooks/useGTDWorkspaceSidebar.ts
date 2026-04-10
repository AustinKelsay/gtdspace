import React from 'react';
import { flushSync } from 'react-dom';
import { safeInvoke } from '@/utils/safe-invoke';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTD_SECTIONS } from '@/components/gtd/sidebar/constants';
import {
  buildSectionPath,
  buildSectionPathCandidates,
  buildSidebarSearchResults,
  getFolderName,
  partitionProjectsByCompletion,
  sortMarkdownFiles,
} from '@/components/gtd/sidebar/utils';
import type {
  GTDWorkspaceSidebarProps,
  PageDialogDirectory,
  SidebarActionMetadata,
  SidebarDeleteItem,
  SidebarProjectMetadata,
  SidebarSectionFileMetadata,
} from '@/components/gtd/sidebar/types';
import { useSidebarDataLoaders } from '@/hooks/sidebar/useSidebarDataLoaders';
import { useSidebarEventBridge } from '@/hooks/sidebar/useSidebarEventBridge';
import {
  buildSectionPath as buildCanonicalSectionPath,
  normalizeSidebarPath,
} from '@/hooks/sidebar/path-classification';
import { useSidebarOverlays } from '@/hooks/sidebar/useSidebarOverlays';
import { useSidebarUiState } from '@/hooks/sidebar/useSidebarUiState';
import { useSidebarWorkspaceLifecycle } from '@/hooks/sidebar/useSidebarWorkspaceLifecycle';
import type { GTDProject, GTDSpace, MarkdownFile } from '@/types';
import { norm } from '@/utils/path';

type UseGTDWorkspaceSidebarResult = {
  gtdSpace: GTDSpace | null;
  isLoading: boolean;
  rootPath: string | null;
  showProjectDialog: boolean;
  setShowProjectDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showActionDialog: boolean;
  setShowActionDialog: React.Dispatch<React.SetStateAction<boolean>>;
  selectedProject: GTDProject | null;
  setSelectedProject: React.Dispatch<React.SetStateAction<GTDProject | null>>;
  expandedSections: string[];
  expandedProjects: string[];
  completedProjectsExpanded: boolean;
  setCompletedProjectsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  cancelledProjectsExpanded: boolean;
  setCancelledProjectsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  expandedCompletedActions: Set<string>;
  projectActions: Record<string, MarkdownFile[]>;
  projectLoading: Record<string, boolean>;
  actionStatuses: Record<string, string>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  showSearch: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  showPageDialog: boolean;
  setShowPageDialog: React.Dispatch<React.SetStateAction<boolean>>;
  pageDialogDirectory: PageDialogDirectory | null;
  setPageDialogDirectory: React.Dispatch<React.SetStateAction<PageDialogDirectory | null>>;
  showHabitDialog: boolean;
  setShowHabitDialog: React.Dispatch<React.SetStateAction<boolean>>;
  sectionFiles: Record<string, MarkdownFile[]>;
  loadingSections: Set<string>;
  loadedSections: Set<string>;
  deleteItem: SidebarDeleteItem | null;
  setDeleteItem: React.Dispatch<React.SetStateAction<SidebarDeleteItem | null>>;
  projectMetadata: Record<string, SidebarProjectMetadata>;
  actionMetadata: Record<string, SidebarActionMetadata>;
  sectionFileMetadata: Record<string, SidebarSectionFileMetadata>;
  searchResults: ReturnType<typeof buildSidebarSearchResults>;
  filteredProjects: GTDProject[];
  activeProjects: GTDProject[];
  completedProjects: GTDProject[];
  cancelledProjects: GTDProject[];
  isPathActive: (candidatePath?: string | null) => boolean;
  loadSectionFiles: (sectionPath: string, force?: boolean) => Promise<MarkdownFile[]>;
  loadProjectActions: (projectPath: string) => Promise<void>;
  handleProjectClick: (project: GTDProject) => Promise<void>;
  openHorizonReadme: (folderPath: string) => void;
  handleCreatePage: (sectionId: string) => void;
  toggleSection: (sectionId: string) => void;
  toggleProjectExpand: (project: GTDProject) => Promise<void>;
  toggleCompletedActions: (projectPath: string) => void;
  handleSelectFolder: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleOpenFolderInExplorer: () => Promise<void>;
  handleOpenFileLocation: (path: string) => Promise<void>;
  handleRefresh: () => Promise<void>;
  handlePageCreated: (filePath: string) => void;
  handleHabitCreated: (habitPath: string) => void;
  reloadProjects: (path: string) => Promise<GTDProject[]>;
};

type ControllerArgs = Pick<
  GTDWorkspaceSidebarProps,
  | 'currentFolder'
  | 'onFolderSelect'
  | 'onFileSelect'
  | 'onRefresh'
  | 'gtdSpace'
  | 'checkGTDSpace'
  | 'loadProjects'
  | 'activeFilePath'
>;

export function useGTDWorkspaceSidebar({
  currentFolder,
  onFolderSelect,
  onFileSelect,
  onRefresh,
  gtdSpace: propGtdSpace,
  checkGTDSpace: propCheckGTDSpace,
  loadProjects: propLoadProjects,
  activeFilePath = null,
}: ControllerArgs): UseGTDWorkspaceSidebarResult {
  const {
    gtdSpace: hookGtdSpace,
    isLoading,
    checkGTDSpace: hookCheckGTDSpace,
    loadProjects: hookLoadProjects,
  } = useGTDSpace();

  const gtdSpace = propGtdSpace ?? hookGtdSpace;
  const checkGTDSpace = propCheckGTDSpace ?? hookCheckGTDSpace;
  const loadProjects = propLoadProjects ?? hookLoadProjects;
  const workspaceRootPath = gtdSpace?.root_path ?? null;
  const rootPath = workspaceRootPath || currentFolder || null;
  const { withErrorHandling } = useErrorHandler();

  const ui = useSidebarUiState();
  const overlays = useSidebarOverlays();
  const data = useSidebarDataLoaders({
    rootPath,
    withErrorHandling,
    overlays,
  });
  const {
    loadProjectActions,
    loadSectionFiles,
    resolveReadmeFile,
    resolveSectionLoadPaths,
    projectActionsRef,
    projectLoadingRef,
    sectionFilesRef,
    setPendingProjects,
    setProjectActions,
    setProjectLoading,
    setSectionFiles,
    pendingProjects,
    projectActions,
    projectLoading,
    sectionFiles,
    loadingSections,
    loadedSections,
  } = data;

  const normalizedActivePath = React.useMemo(
    () => normalizeSidebarPath(activeFilePath),
    [activeFilePath]
  );
  const isPathActive = React.useCallback(
    (candidatePath?: string | null) => {
      if (!candidatePath || !normalizedActivePath) return false;
      return normalizeSidebarPath(candidatePath) === normalizedActivePath;
    },
    [normalizedActivePath]
  );

  useSidebarWorkspaceLifecycle({
    currentFolder,
    rootPath: workspaceRootPath,
    projects: gtdSpace?.projects,
    checkGTDSpace,
    loadProjects,
    loadProjectActions,
    resolveSectionLoadPaths,
    loadSectionFiles,
    data,
    overlays,
  });

  useSidebarEventBridge({
    rootPath: workspaceRootPath,
    withErrorHandling,
    loadProjects,
    loadProjectActions,
    loadSectionFiles,
    overlays,
    ui,
    data,
  });

  const handleProjectClick = React.useCallback(
    async (project: GTDProject) => {
      ui.setSelectedProject(project);
      const normalizedProjectPath =
        normalizeSidebarPath(project.path) ?? project.path.replace(/\\/g, '/');
      if (
        !projectActionsRef.current[normalizedProjectPath] &&
        !projectLoadingRef.current[normalizedProjectPath]
      ) {
        await loadProjectActions(project.path);
      }

      onFileSelect(await resolveReadmeFile(project.path));
    },
    [loadProjectActions, onFileSelect, projectActionsRef, projectLoadingRef, resolveReadmeFile, ui]
  );

  const toggleProjectExpand = React.useCallback(
    async (project: GTDProject) => {
      const normalizedProjectPath =
        normalizeSidebarPath(project.path) ?? project.path.replace(/\\/g, '/');
      const isExpanded = ui.expandedProjects.includes(normalizedProjectPath);
      if (isExpanded) {
        ui.setExpandedProjects((prev) =>
          prev.filter((path) => path !== normalizedProjectPath)
        );
        return;
      }

      ui.setExpandedProjects((prev) => [...prev, normalizedProjectPath]);
      if (
        !projectActionsRef.current[normalizedProjectPath] &&
        !projectLoadingRef.current[normalizedProjectPath]
      ) {
        await loadProjectActions(project.path);
      }
    },
    [loadProjectActions, projectActionsRef, projectLoadingRef, ui]
  );

  const openHorizonReadme = React.useCallback(
    (folderPath: string) => {
      void resolveReadmeFile(folderPath).then((file) => {
        onFileSelect(file);
      });
    },
    [onFileSelect, resolveReadmeFile]
  );

  const handleCreatePage = React.useCallback(
    (sectionId: string) => {
      const section = GTD_SECTIONS.find((candidate) => candidate.id === sectionId);
      if (!section) return;

      if (section.id === 'habits') {
        ui.setShowHabitDialog(true);
        return;
      }

      const defaultPath = buildSectionPath(rootPath, section.path);
      const candidatePaths = buildSectionPathCandidates(rootPath, section);
      const resolvedPath =
        candidatePaths.find((candidate) => sectionFilesRef.current[candidate]) ?? defaultPath;

      ui.setPageDialogDirectory({
        path: resolvedPath,
        name: section.name,
        sectionId: section.id,
        spacePath: rootPath ?? '',
      });
      ui.setShowPageDialog(true);
    },
    [rootPath, sectionFilesRef, ui]
  );

  const handleSelectFolder = React.useCallback(async () => {
    const folderPath = await withErrorHandling(async () => {
      const selectedPath = await safeInvoke<string>('select_folder', undefined, null);
      if (!selectedPath) {
        return null;
      }
      return selectedPath;
    }, 'Failed to select folder');

    if (folderPath) {
      onFolderSelect(folderPath);
    }
  }, [onFolderSelect, withErrorHandling]);

  const handleOpenFolderInExplorer = React.useCallback(async () => {
    if (!currentFolder) return;
    await withErrorHandling(async () => {
      const result = await safeInvoke('open_folder_in_explorer', { path: currentFolder }, null);
      if (result == null) {
        throw new Error('Failed to open folder in explorer');
      }
      return result;
    }, 'Failed to open folder in explorer');
  }, [currentFolder, withErrorHandling]);

  const handleOpenFileLocation = React.useCallback(
    async (path: string) => {
      await withErrorHandling(async () => {
        const result = await safeInvoke('open_file_location', { filePath: path }, null);
        if (result == null) {
          throw new Error('Failed to open file location');
        }
        return result;
      }, 'Failed to open file location');
    },
    [withErrorHandling]
  );

  const handleRefresh = React.useCallback(async () => {
    onRefresh?.();

    if (!rootPath) return;

    await loadProjects(rootPath);

    const nonProjectSectionPaths = await resolveSectionLoadPaths(
      GTD_SECTIONS.filter(
        (section) => section.id !== 'calendar' && section.id !== 'projects'
      ).map((section) => section.id),
      rootPath
    );

    await Promise.all(
      [...new Set(nonProjectSectionPaths)].map((path) => loadSectionFiles(path, true))
    );
    await Promise.all(
      Object.keys(projectActionsRef.current).map((path) => loadProjectActions(path))
    );
  }, [
    loadProjects,
    loadProjectActions,
    loadSectionFiles,
    onRefresh,
    projectActionsRef,
    resolveSectionLoadPaths,
    rootPath,
  ]);

  const handleDelete = React.useCallback(async () => {
    const deleteItem = ui.deleteItem;
    if (!deleteItem) return;

    const deleted = await withErrorHandling(
      async () => {
        const normalizedDeletePath =
          normalizeSidebarPath(deleteItem.path) ?? deleteItem.path.replace(/\\/g, '/');

        if (deleteItem.type === 'project') {
          const result = await safeInvoke<{
            success: boolean;
            path?: string | null;
            message?: string | null;
          }>(
            'delete_folder',
            { path: normalizedDeletePath },
            { success: false, message: 'Failed to delete folder' }
          );

          if (!result?.success) {
            throw new Error(result?.message || 'Failed to delete project');
          }

          setPendingProjects((prev) =>
            prev.filter(
              (project) => (norm(project.path) ?? project.path) !== normalizedDeletePath
            )
          );
          ui.setExpandedProjects((prev) =>
            prev.filter((path) => path !== normalizedDeletePath)
          );
          setProjectActions((prev) => {
            const next = { ...prev };
            delete next[normalizedDeletePath];
            return next;
          });
          setProjectLoading((prev) => {
            if (!(normalizedDeletePath in prev)) {
              return prev;
            }
            const next = { ...prev };
            delete next[normalizedDeletePath];
            projectLoadingRef.current = next;
            return next;
          });
          overlays.removeProjectOverlay(normalizedDeletePath);
          window.dispatchEvent(
            new CustomEvent('file-deleted', {
              detail: { path: normalizedDeletePath },
            })
          );

          if (workspaceRootPath) {
            await loadProjects(workspaceRootPath);
          }
        } else {
          const result = await safeInvoke<{
            success: boolean;
            path?: string | null;
            message?: string | null;
          }>(
            'delete_file',
            { path: normalizedDeletePath },
            { success: false, message: 'Failed to delete file' }
          );

          if (!result?.success) {
            throw new Error(result?.message || 'Failed to delete file');
          }

          if (deleteItem.type === 'action') {
            overlays.setActionStatuses((prev) => {
              const next = { ...prev };
              delete next[normalizedDeletePath];
              return next;
            });
            overlays.removeActionOverlay(normalizedDeletePath);

            const projectPath = normalizedDeletePath.substring(
              0,
              normalizedDeletePath.lastIndexOf('/')
            );
            setProjectActions((prev) => ({
              ...prev,
              [projectPath]:
                prev[projectPath]?.filter(
                  (action) => action.path !== normalizedDeletePath
                ) || [],
            }));
            await loadProjectActions(projectPath);
          } else {
            overlays.removeSectionFileOverlay(normalizedDeletePath);
            const sectionPath = normalizedDeletePath.substring(
              0,
              normalizedDeletePath.lastIndexOf('/')
            );
            setSectionFiles((prev) => ({
              ...prev,
              [sectionPath]:
                prev[sectionPath]?.filter(
                  (file) => file.path !== normalizedDeletePath
                ) || [],
            }));
            await loadSectionFiles(sectionPath, true);
          }

          window.dispatchEvent(
            new CustomEvent('file-deleted', {
              detail: { path: normalizedDeletePath },
            })
          );
        }

        return true;
      },
      deleteItem.type === 'project'
        ? 'Failed to delete project'
        : 'Failed to delete file',
      'workspace-sidebar'
    );

    if (deleted) {
      ui.setDeleteItem(null);
    }
  }, [
    loadProjectActions,
    loadProjects,
    loadSectionFiles,
    overlays,
    projectLoadingRef,
    setPendingProjects,
    setProjectActions,
    setProjectLoading,
    setSectionFiles,
    ui,
    withErrorHandling,
    workspaceRootPath,
  ]);

  const handlePageCreated = React.useCallback(
    (filePath: string) => {
      const pageDialogDirectory = ui.pageDialogDirectory;
      if (!pageDialogDirectory) return;
      const normalizedDirectoryPath =
        normalizeSidebarPath(pageDialogDirectory.path) ??
        pageDialogDirectory.path.replace(/\\/g, '/');

      const newFile: MarkdownFile = {
        id: filePath,
        name: getFolderName(normalizeSidebarPath(filePath) ?? filePath),
        path: filePath,
        size: 0,
        last_modified: Math.floor(Date.now() / 1000),
        extension: '.md',
      };

      flushSync(() => {
        setSectionFiles((prev) => {
          const currentFiles = prev[normalizedDirectoryPath] || [];
          return {
            ...prev,
            [normalizedDirectoryPath]: sortMarkdownFiles([...currentFiles, newFile]),
          };
        });
      });

      ui.setExpandedSections((prev) =>
        prev.includes(pageDialogDirectory.sectionId)
          ? prev
          : [...prev, pageDialogDirectory.sectionId]
      );

      onFileSelect(newFile);
      void loadSectionFiles(pageDialogDirectory.path, true);
    },
    [loadSectionFiles, onFileSelect, setSectionFiles, ui]
  );

  const handleHabitCreated = React.useCallback(
    (habitPath: string) => {
      const habitsSection = GTD_SECTIONS.find((section) => section.id === 'habits');
      if (!habitsSection || !rootPath) return;

      const habitsPath = buildCanonicalSectionPath(rootPath, habitsSection.path);
      const normalizedHabitsPath =
        normalizeSidebarPath(habitsPath) ?? habitsPath.replace(/\\/g, '/');
      const newFile: MarkdownFile = {
        id: habitPath,
        name: getFolderName(normalizeSidebarPath(habitPath) ?? habitPath),
        path: habitPath,
        size: 0,
        last_modified: Math.floor(Date.now() / 1000),
        extension: '.md',
      };

      setSectionFiles((prev) => {
        const currentHabits = prev[normalizedHabitsPath] || [];
        return {
          ...prev,
          [normalizedHabitsPath]: sortMarkdownFiles([...currentHabits, newFile]),
        };
      });

      ui.setExpandedSections((prev) => (prev.includes('habits') ? prev : [...prev, 'habits']));
      onFileSelect(newFile);
      void loadSectionFiles(habitsPath, true);
    },
    [loadSectionFiles, onFileSelect, rootPath, setSectionFiles, ui]
  );

  const filteredProjects = React.useMemo(() => {
    const baseProjects = gtdSpace?.projects || [];
    const merged = [...baseProjects];

    pendingProjects.forEach((pending) => {
      if (
        !merged.some(
          (project) => (norm(project.path) ?? project.path) === (norm(pending.path) ?? pending.path)
        )
      ) {
        merged.push(pending);
      }
    });

    if (!ui.searchQuery) return merged;

    const query = ui.searchQuery.toLowerCase();
    return merged.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        (project.description || '').toLowerCase().includes(query)
    );
  }, [gtdSpace?.projects, pendingProjects, ui.searchQuery]);

  const searchResults = React.useMemo(
    () =>
      buildSidebarSearchResults({
        searchQuery: ui.searchQuery,
        projects: gtdSpace?.projects || [],
        projectActions,
        sectionFiles,
        sections: GTD_SECTIONS,
        rootPath,
        projectMetadata: overlays.projectMetadata,
        actionMetadata: overlays.actionMetadata,
        actionStatuses: overlays.actionStatuses,
        sectionFileMetadata: overlays.sectionFileMetadata,
      }),
    [
      gtdSpace?.projects,
      overlays.actionMetadata,
      overlays.actionStatuses,
      overlays.projectMetadata,
      overlays.sectionFileMetadata,
      projectActions,
      rootPath,
      sectionFiles,
      ui.searchQuery,
    ]
  );

  const {
    active: activeProjects,
    completed: completedProjects,
    cancelled: cancelledProjects,
  } = React.useMemo(
    () =>
      partitionProjectsByCompletion({
        projects: filteredProjects,
        projectMetadata: overlays.projectMetadata,
      }),
    [filteredProjects, overlays.projectMetadata]
  );

  return {
    gtdSpace,
    isLoading,
    rootPath,
    showProjectDialog: ui.showProjectDialog,
    setShowProjectDialog: ui.setShowProjectDialog,
    showActionDialog: ui.showActionDialog,
    setShowActionDialog: ui.setShowActionDialog,
    selectedProject: ui.selectedProject,
    setSelectedProject: ui.setSelectedProject,
    expandedSections: ui.expandedSections,
    expandedProjects: ui.expandedProjects,
    completedProjectsExpanded: ui.completedProjectsExpanded,
    setCompletedProjectsExpanded: ui.setCompletedProjectsExpanded,
    cancelledProjectsExpanded: ui.cancelledProjectsExpanded,
    setCancelledProjectsExpanded: ui.setCancelledProjectsExpanded,
    expandedCompletedActions: ui.expandedCompletedActions,
    projectActions,
    projectLoading,
    actionStatuses: overlays.actionStatuses,
    searchQuery: ui.searchQuery,
    setSearchQuery: ui.setSearchQuery,
    showSearch: ui.showSearch,
    setShowSearch: ui.setShowSearch,
    showPageDialog: ui.showPageDialog,
    setShowPageDialog: ui.setShowPageDialog,
    pageDialogDirectory: ui.pageDialogDirectory,
    setPageDialogDirectory: ui.setPageDialogDirectory,
    showHabitDialog: ui.showHabitDialog,
    setShowHabitDialog: ui.setShowHabitDialog,
    sectionFiles,
    loadingSections,
    loadedSections,
    deleteItem: ui.deleteItem,
    setDeleteItem: ui.setDeleteItem,
    projectMetadata: overlays.projectMetadata,
    actionMetadata: overlays.actionMetadata,
    sectionFileMetadata: overlays.sectionFileMetadata,
    searchResults,
    filteredProjects,
    activeProjects,
    completedProjects,
    cancelledProjects,
    isPathActive,
    loadSectionFiles,
    loadProjectActions,
    handleProjectClick,
    openHorizonReadme,
    handleCreatePage,
    toggleSection: ui.toggleSection,
    toggleProjectExpand,
    toggleCompletedActions: ui.toggleCompletedActions,
    handleSelectFolder,
    handleDelete,
    handleOpenFolderInExplorer,
    handleOpenFileLocation,
    handleRefresh,
    handlePageCreated,
    handleHabitCreated,
    reloadProjects: loadProjects,
  };
}

export default useGTDWorkspaceSidebar;
