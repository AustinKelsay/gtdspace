import React from 'react';
import { flushSync } from 'react-dom';
import { safeInvoke } from '@/utils/safe-invoke';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { readFileText } from '@/hooks/useFileManager';
import { onContentChange, onContentSaved, onMetadataChange } from '@/utils/content-event-bus';
import { syncHorizonReadmeContent } from '@/utils/horizon-readme-utils';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTD_SECTIONS, HORIZON_FOLDER_TO_TYPE } from '@/components/gtd/sidebar/constants';
import {
  buildSectionPath,
  buildSidebarSearchResults,
  getFolderName,
  normalizePath,
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
import type { GTDProject, GTDSpace, MarkdownFile } from '@/types';

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
  expandedCompletedActions: Set<string>;
  projectActions: Record<string, MarkdownFile[]>;
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
  'currentFolder' | 'onFolderSelect' | 'onFileSelect' | 'onRefresh' | 'gtdSpace' | 'checkGTDSpace' | 'loadProjects' | 'activeFilePath'
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
  const rootPath = gtdSpace?.root_path || currentFolder || null;
  const { withErrorHandling } = useErrorHandler();

  const [showProjectDialog, setShowProjectDialog] = React.useState(false);
  const [showActionDialog, setShowActionDialog] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<GTDProject | null>(null);
  const [expandedSections, setExpandedSections] = React.useState<string[]>(['projects', 'habits']);
  const [expandedProjects, setExpandedProjects] = React.useState<string[]>([]);
  const [completedProjectsExpanded, setCompletedProjectsExpanded] = React.useState(false);
  const [expandedCompletedActions, setExpandedCompletedActions] = React.useState<Set<string>>(
    new Set()
  );
  const [projectActions, setProjectActions] = React.useState<Record<string, MarkdownFile[]>>({});
  const [actionStatuses, setActionStatuses] = React.useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSearch, setShowSearch] = React.useState(false);
  const [showPageDialog, setShowPageDialog] = React.useState(false);
  const [pageDialogDirectory, setPageDialogDirectory] =
    React.useState<PageDialogDirectory | null>(null);
  const [showHabitDialog, setShowHabitDialog] = React.useState(false);
  const [sectionFiles, setSectionFiles] = React.useState<Record<string, MarkdownFile[]>>({});
  const [loadingSections, setLoadingSections] = React.useState<Set<string>>(new Set());
  const [loadedSections, setLoadedSections] = React.useState<Set<string>>(new Set());
  const [deleteItem, setDeleteItem] = React.useState<SidebarDeleteItem | null>(null);
  const [projectMetadata, setProjectMetadata] = React.useState<
    Record<string, SidebarProjectMetadata>
  >({});
  const [actionMetadata, setActionMetadata] = React.useState<Record<string, SidebarActionMetadata>>(
    {}
  );
  const [sectionFileMetadata, setSectionFileMetadata] = React.useState<
    Record<string, SidebarSectionFileMetadata>
  >({});
  const [pendingProjects, setPendingProjects] = React.useState<GTDProject[]>([]);

  const normalizedActivePath = React.useMemo(() => normalizePath(activeFilePath), [activeFilePath]);
  const isPathActive = React.useCallback(
    (candidatePath?: string | null) => {
      if (!candidatePath || !normalizedActivePath) return false;
      return normalizePath(candidatePath) === normalizedActivePath;
    },
    [normalizedActivePath]
  );

  const sectionFilesRef = React.useRef<Record<string, MarkdownFile[]>>({});
  const projectActionsRef = React.useRef<Record<string, MarkdownFile[]>>({});
  const lastRootRef = React.useRef<string | null>(null);
  const preloadedRef = React.useRef(false);
  const loadingSectionsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    sectionFilesRef.current = sectionFiles;
  }, [sectionFiles]);

  React.useEffect(() => {
    projectActionsRef.current = projectActions;
  }, [projectActions]);

  const syncHorizonReadme = React.useCallback(async (folderPath: string, files: MarkdownFile[]) => {
    const folderName = getFolderName(folderPath);
    const horizonType = HORIZON_FOLDER_TO_TYPE[folderName];
    if (!horizonType) return;

    const readmePath = `${folderPath}/README.md`;

    try {
      const existingContent = (await safeInvoke<string>('read_file', { path: readmePath }, '')) ?? '';
      const { content, changed } = syncHorizonReadmeContent({
        horizon: horizonType,
        existingContent,
        files,
      });
      if (changed) {
        await safeInvoke('save_file', { path: readmePath, content });
      }
    } catch (error) {
      console.error('Failed to sync horizon README', { folderPath, error });
    }
  }, []);

  const updateProjectOverlay = React.useCallback(
    (projectPath: string, patch: Partial<SidebarProjectMetadata>) => {
      setProjectMetadata((prev) => ({
        ...prev,
        [projectPath]: {
          ...prev[projectPath],
          ...patch,
        },
      }));
    },
    []
  );

  const updateActionOverlay = React.useCallback(
    (actionPath: string, patch: Partial<SidebarActionMetadata>) => {
      setActionMetadata((prev) => ({
        ...prev,
        [actionPath]: {
          ...prev[actionPath],
          ...patch,
        },
      }));
    },
    []
  );

  const updateSectionFileOverlay = React.useCallback(
    (filePath: string, patch: Partial<SidebarSectionFileMetadata>) => {
      setSectionFileMetadata((prev) => ({
        ...prev,
        [filePath]: {
          ...prev[filePath],
          ...patch,
        },
      }));
    },
    []
  );

  const removeActionOverlay = React.useCallback((filePath: string) => {
    setActionMetadata((prev) => {
      const next = { ...prev };
      delete next[filePath];
      return next;
    });
  }, []);

  const removeProjectOverlay = React.useCallback((projectPath: string) => {
    setProjectMetadata((prev) => {
      const next = { ...prev };
      delete next[projectPath];
      return next;
    });
  }, []);

  const removeSectionFileOverlay = React.useCallback((filePath: string) => {
    setSectionFileMetadata((prev) => {
      const next = { ...prev };
      delete next[filePath];
      return next;
    });
  }, []);

  const loadSectionFiles = React.useCallback(
    async (sectionPath: string, force: boolean = false): Promise<MarkdownFile[]> => {
      const current = sectionFilesRef.current[sectionPath];
      if (!force && current) {
        return current;
      }

      if (loadingSectionsRef.current.has(sectionPath)) {
        return current || [];
      }

      loadingSectionsRef.current.add(sectionPath);
      setLoadingSections((prev) => {
        const next = new Set(prev);
        next.add(sectionPath);
        return next;
      });

      try {
        const files = await safeInvoke<MarkdownFile[]>('list_markdown_files', { path: sectionPath }, []);
        const sortedFiles = sortMarkdownFiles(files ?? []);

        setSectionFiles((prev) => ({
          ...prev,
          [sectionPath]: sortedFiles,
        }));
        setLoadedSections((prev) => {
          const next = new Set(prev);
          next.add(sectionPath);
          return next;
        });

        await syncHorizonReadme(sectionPath, sortedFiles);
        return sortedFiles;
      } catch {
        return [];
      } finally {
        loadingSectionsRef.current.delete(sectionPath);
        setLoadingSections((prev) => {
          const next = new Set(prev);
          next.delete(sectionPath);
          return next;
        });
      }
    },
    [syncHorizonReadme]
  );

  const loadProjectActions = React.useCallback(async (projectPath: string) => {
    try {
      let files: MarkdownFile[] = [];
      try {
        files = await safeInvoke<MarkdownFile[]>('list_project_actions', { projectPath }, []);
      } catch {
        const all = await safeInvoke<MarkdownFile[]>('list_markdown_files', { path: projectPath }, []);
        files = (all ?? []).filter((file) => file.name !== 'README.md');
      }

      setProjectActions((prev) => ({
        ...prev,
        [projectPath]: files,
      }));

      const statusResults = await Promise.all(
        files.map(async (action) => {
          try {
            const content = await readFileText(action.path);
            const statusMatch = content.match(/\[!singleselect:status:([^\]]+?)\]/i);
            const dueDateMatch = content.match(/\[!datetime:due_date:([^\]]*)\]/i);
            return {
              path: action.path,
              status: statusMatch?.[1]?.trim() || 'in-progress',
              due_date: dueDateMatch?.[1]?.trim() || '',
            };
          } catch {
            return {
              path: action.path,
              status: 'in-progress',
              due_date: '',
            };
          }
        })
      );

      setActionStatuses((prev) => ({
        ...prev,
        ...Object.fromEntries(statusResults.map((result) => [result.path, result.status])),
      }));

      setActionMetadata((prev) => {
        const next = { ...prev };
        statusResults.forEach(({ path, due_date }) => {
          if (due_date) {
            next[path] = {
              ...next[path],
              due_date,
            };
          }
        });
        return next;
      });
    } catch {
      // Keep existing project action state when a refresh fails.
    }
  }, []);

  React.useEffect(() => {
    const pathToCheck = gtdSpace?.root_path;
    if (!pathToCheck || !currentFolder?.startsWith(pathToCheck)) {
      return;
    }

    let cancelled = false;

    const preload = async () => {
      if (lastRootRef.current !== pathToCheck) {
        preloadedRef.current = false;
        lastRootRef.current = pathToCheck;
        setLoadedSections(new Set());
      }

      const isGTD = await checkGTDSpace(pathToCheck);
      if (!isGTD || cancelled) return;

      if (!gtdSpace?.projects || gtdSpace.projects.length === 0) {
        await loadProjects(pathToCheck);
        if (cancelled) return;
      }

      if (!preloadedRef.current) {
        preloadedRef.current = true;

        const priorityPaths = [
          `${pathToCheck}/Habits`,
          `${pathToCheck}/Areas of Focus`,
          `${pathToCheck}/Goals`,
        ];
        const secondaryPaths = [
          `${pathToCheck}/Someday Maybe`,
          `${pathToCheck}/Cabinet`,
          `${pathToCheck}/Vision`,
          `${pathToCheck}/Purpose & Principles`,
        ];

        await Promise.allSettled(priorityPaths.map((path) => loadSectionFiles(path)));
        if (cancelled) return;

        await Promise.allSettled(secondaryPaths.map((path) => loadSectionFiles(path)));
      }
    };

    void preload();

    return () => {
      cancelled = true;
    };
  }, [checkGTDSpace, currentFolder, gtdSpace?.projects, gtdSpace?.root_path, loadProjects, loadSectionFiles]);

  React.useEffect(() => {
    const unsubscribeMetadata = onMetadataChange((event) => {
      const { filePath, metadata, changedFields } = event;

      if (filePath.includes('/Projects/') && filePath.endsWith('/README.md')) {
        const projectPath = filePath.substring(0, filePath.lastIndexOf('/'));

        if (changedFields?.status || changedFields?.projectStatus) {
          const nextStatus = metadata.projectStatus || metadata.status;
          if (nextStatus) {
            updateProjectOverlay(projectPath, { status: String(nextStatus) });
          }
        }

        if (changedFields?.due_date || changedFields?.dueDate || changedFields?.datetime) {
          const nextDue =
            (metadata as { due_date?: string; dueDate?: string }).due_date ||
            (metadata as { due_date?: string; dueDate?: string }).dueDate;
          if (typeof nextDue === 'string') {
            updateProjectOverlay(projectPath, { due_date: nextDue });
          }
        }
      }

      if (
        filePath.includes('/Projects/') &&
        !filePath.endsWith('/README.md') &&
        filePath.endsWith('.md')
      ) {
        if (changedFields?.status && metadata.status) {
          setActionStatuses((prev) => ({
            ...prev,
            [filePath]: String(metadata.status),
          }));
          updateActionOverlay(filePath, { status: String(metadata.status) });
        }
      }

      const sectionPaths = [
        '/Someday Maybe/',
        '/Cabinet/',
        '/Habits/',
        '/Areas of Focus/',
        '/Goals/',
        '/Vision/',
        '/Purpose & Principles/',
      ];

      for (const sectionPath of sectionPaths) {
        if (filePath.includes(sectionPath)) {
          const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
          void loadSectionFiles(folderPath, true);
          break;
        }
      }
    });

    const unsubscribeChanged = onContentChange((event) => {
      const { filePath, metadata, changedFields } = event;

      if (filePath.includes('/Projects/') && filePath.endsWith('/README.md')) {
        const projectPath = filePath.substring(0, filePath.lastIndexOf('/'));
        if (changedFields?.dueDate || changedFields?.due_date || changedFields?.datetime) {
          const nextDue =
            (metadata as { due_date?: string; dueDate?: string }).dueDate ||
            (metadata as { due_date?: string; dueDate?: string }).due_date;
          if (typeof nextDue === 'string') {
            updateProjectOverlay(projectPath, { due_date: nextDue });
          }
        }
      }
    });

    const unsubscribeSaved = onContentSaved(async (event) => {
      const { filePath, metadata } = event;

      if (filePath.includes('/Projects/') && filePath.endsWith('/README.md')) {
        const projectPath = filePath.substring(0, filePath.lastIndexOf('/'));
        const nextTitle = metadata.title;

        if (nextTitle) {
          const currentProjectName = projectPath.split('/').pop();

          if (currentProjectName && currentProjectName !== nextTitle) {
            safeInvoke<string>(
              'rename_gtd_project',
              { oldProjectPath: projectPath, newProjectName: nextTitle },
              null
            )
              .then(async (newProjectPath) => {
                if (!newProjectPath || typeof newProjectPath !== 'string') return;

                updateProjectOverlay(projectPath, {
                  title: String(nextTitle),
                  currentPath: newProjectPath,
                });
                updateProjectOverlay(newProjectPath, {
                  title: String(nextTitle),
                  currentPath: newProjectPath,
                });

                setExpandedProjects((prev) =>
                  prev.map((path) => (path === projectPath ? newProjectPath : path))
                );
                setProjectActions((prev) =>
                  prev[projectPath]
                    ? {
                        ...prev,
                        [newProjectPath]: prev[projectPath],
                      }
                    : prev
                );

                if (gtdSpace?.root_path) {
                  await loadProjects(gtdSpace.root_path);
                  removeProjectOverlay(projectPath);
                  setProjectActions((prev) => {
                    const next = { ...prev };
                    delete next[projectPath];
                    return next;
                  });
                }

                window.dispatchEvent(
                  new CustomEvent('project-renamed', {
                    detail: {
                      oldPath: projectPath,
                      newPath: newProjectPath,
                      newName: nextTitle,
                    },
                  })
                );
              })
              .catch(() => undefined);
          }
        }

        const nextDue =
          (metadata as { due_date?: string; dueDate?: string }).due_date ||
          (metadata as { due_date?: string; dueDate?: string }).dueDate;
        if (typeof nextDue === 'string') {
          updateProjectOverlay(projectPath, { due_date: nextDue });
        }

        if (gtdSpace?.root_path) {
          await loadProjects(gtdSpace.root_path);
        }
      }

      if (
        filePath.includes('/Projects/') &&
        !filePath.endsWith('/README.md') &&
        filePath.endsWith('.md')
      ) {
        const nextTitle = metadata.title;
        if (nextTitle) {
          const currentActionName = filePath.split('/').pop()?.replace('.md', '');
          if (currentActionName && currentActionName !== nextTitle) {
            safeInvoke<string>(
              'rename_gtd_action',
              { oldActionPath: filePath, newActionName: nextTitle },
              null
            )
              .then(async (newActionPath) => {
                if (!newActionPath || typeof newActionPath !== 'string') return;

                updateActionOverlay(filePath, {
                  title: String(nextTitle),
                  currentPath: newActionPath,
                });
                updateActionOverlay(newActionPath, {
                  title: String(nextTitle),
                  currentPath: newActionPath,
                });

                const projectPath = filePath.substring(0, filePath.lastIndexOf('/'));
                await loadProjectActions(projectPath);
                removeActionOverlay(filePath);

                window.dispatchEvent(
                  new CustomEvent('action-renamed', {
                    detail: {
                      oldPath: filePath,
                      newPath: newActionPath,
                      newName: nextTitle,
                    },
                  })
                );
              })
              .catch(() => undefined);
          }
        }
      }

      const sectionPaths = [
        '/Someday Maybe/',
        '/Cabinet/',
        '/Habits/',
        '/Areas of Focus/',
        '/Goals/',
        '/Vision/',
        '/Purpose & Principles/',
      ];

      for (const sectionPath of sectionPaths) {
        if (filePath.includes(sectionPath) && filePath.endsWith('.md')) {
          const nextTitle = metadata.title;

          if (nextTitle) {
            const currentFileName = filePath.split('/').pop()?.replace('.md', '');
            if (currentFileName && currentFileName !== nextTitle) {
              safeInvoke<string>(
                'rename_gtd_action',
                { oldActionPath: filePath, newActionName: nextTitle },
                null
              )
                .then(async (newFilePath) => {
                  if (!newFilePath || typeof newFilePath !== 'string') return;

                  updateSectionFileOverlay(filePath, {
                    title: String(nextTitle),
                    currentPath: newFilePath,
                  });
                  updateSectionFileOverlay(newFilePath, {
                    title: String(nextTitle),
                    currentPath: newFilePath,
                  });

                  const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
                  await loadSectionFiles(folderPath, true);
                  removeSectionFileOverlay(filePath);

                  window.dispatchEvent(
                    new CustomEvent('section-file-renamed', {
                      detail: {
                        oldPath: filePath,
                        newPath: newFilePath,
                        newName: nextTitle,
                      },
                    })
                  );
                })
                .catch(() => undefined);
            }
          }
          break;
        }
      }
    });

    const handleProjectCreated = async (event: Event) => {
      const customEvent = event as CustomEvent<{ projectPath?: string; projectName?: string }>;
      const { projectPath, projectName } = customEvent.detail ?? {};

      if (projectPath && projectName) {
        const optimistic: GTDProject = {
          name: projectName,
          description: '',
          dueDate: undefined,
          status: 'in-progress',
          path: projectPath,
          createdDateTime: new Date().toISOString(),
          action_count: 0,
        };

        setPendingProjects((prev) =>
          prev.some((project) => project.path === optimistic.path) ? prev : [...prev, optimistic]
        );
      }

      if (gtdSpace?.root_path) {
        const projects = await loadProjects(gtdSpace.root_path);
        setPendingProjects((prev) =>
          prev.filter((project) => !projects.some((loaded) => loaded.path === project.path))
        );
      }
    };

    const handleActionCreated = async (event: Event) => {
      const customEvent = event as CustomEvent<{ projectPath?: string }>;
      const projectPath = customEvent.detail?.projectPath;
      if (!projectPath) return;

      await loadProjectActions(projectPath);
      if (gtdSpace?.root_path) {
        await loadProjects(gtdSpace.root_path);
      }
    };

    window.addEventListener('gtd-project-created', handleProjectCreated as EventListener);
    window.addEventListener('gtd-action-created', handleActionCreated as EventListener);

    return () => {
      unsubscribeMetadata();
      unsubscribeChanged();
      unsubscribeSaved();
      window.removeEventListener('gtd-project-created', handleProjectCreated as EventListener);
      window.removeEventListener('gtd-action-created', handleActionCreated as EventListener);
    };
  }, [
    gtdSpace?.root_path,
    loadProjectActions,
    loadProjects,
    loadSectionFiles,
    removeActionOverlay,
    removeProjectOverlay,
    removeSectionFileOverlay,
    updateActionOverlay,
    updateProjectOverlay,
    updateSectionFileOverlay,
  ]);

  React.useEffect(() => {
    if (!gtdSpace?.projects || gtdSpace.projects.length === 0) return;

    const missingProjects = gtdSpace.projects.filter((project) => !projectActions[project.path]);
    if (missingProjects.length === 0) return;

    void Promise.all(missingProjects.map((project) => loadProjectActions(project.path)));
  }, [gtdSpace?.projects, loadProjectActions, projectActions]);

  const toggleSection = React.useCallback((sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
  }, []);

  const toggleCompletedActions = React.useCallback((projectPath: string) => {
    setExpandedCompletedActions((prev) => {
      const next = new Set(prev);
      if (next.has(projectPath)) {
        next.delete(projectPath);
      } else {
        next.add(projectPath);
      }
      return next;
    });
  }, []);

  const handleProjectClick = React.useCallback(
    async (project: GTDProject) => {
      setSelectedProject(project);
      if (!projectActionsRef.current[project.path]) {
        await loadProjectActions(project.path);
      }

      onFileSelect({
        id: `${project.path}/README.md`,
        name: 'README.md',
        path: `${project.path}/README.md`,
        size: 0,
        last_modified: Math.floor(Date.now() / 1000),
        extension: 'md',
      });
    },
    [loadProjectActions, onFileSelect]
  );

  const toggleProjectExpand = React.useCallback(
    async (project: GTDProject) => {
      const isExpanded = expandedProjects.includes(project.path);
      if (isExpanded) {
        setExpandedProjects((prev) => prev.filter((path) => path !== project.path));
        return;
      }

      setExpandedProjects((prev) => [...prev, project.path]);
      if (!projectActionsRef.current[project.path]) {
        await loadProjectActions(project.path);
      }
    },
    [expandedProjects, loadProjectActions]
  );

  const openHorizonReadme = React.useCallback(
    (folderPath: string) => {
      onFileSelect({
        id: `${folderPath}/README.md`,
        name: 'README.md',
        path: `${folderPath}/README.md`,
        size: 0,
        last_modified: Math.floor(Date.now() / 1000),
        extension: 'md',
      });
    },
    [onFileSelect]
  );

  const handleCreatePage = React.useCallback(
    (sectionId: string) => {
      const section = GTD_SECTIONS.find((candidate) => candidate.id === sectionId);
      if (!section) return;

      if (section.id === 'habits') {
        setShowHabitDialog(true);
        return;
      }

      const path = buildSectionPath(rootPath, section.path);
      setPageDialogDirectory({
        path,
        name: section.name,
        sectionId: section.id,
        spacePath: rootPath ?? '',
      });
      setShowPageDialog(true);
    },
    [rootPath]
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
      const result = await safeInvoke(
        'open_folder_in_explorer',
        { path: currentFolder },
        null
      );
      if (result == null) {
        throw new Error('Failed to open folder in explorer');
      }
      return result;
    }, 'Failed to open folder in explorer');
  }, [currentFolder, withErrorHandling]);

  const handleOpenFileLocation = React.useCallback(async (path: string) => {
    await withErrorHandling(async () => {
      const result = await safeInvoke('open_file_location', { filePath: path }, null);
      if (result == null) {
        throw new Error('Failed to open file location');
      }
      return result;
    }, 'Failed to open file location');
  }, [withErrorHandling]);

  const handleRefresh = React.useCallback(async () => {
    onRefresh?.();

    if (!rootPath) return;

    await loadProjects(rootPath);

    const nonProjectSectionPaths = GTD_SECTIONS.filter(
      (section) => section.id !== 'calendar' && section.id !== 'projects'
    ).map((section) => buildSectionPath(rootPath, section.path));

    await Promise.all(nonProjectSectionPaths.map((path) => loadSectionFiles(path, true)));
    await Promise.all(Object.keys(projectActionsRef.current).map((path) => loadProjectActions(path)));
  }, [loadProjectActions, loadProjects, loadSectionFiles, onRefresh, rootPath]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteItem) return;

    const deleted = await withErrorHandling(async () => {
      if (deleteItem.type === 'project') {
        const result = await safeInvoke<{
          success: boolean;
          path?: string | null;
          message?: string | null;
        }>('delete_folder', { path: deleteItem.path }, { success: false, message: 'Failed to delete folder' });

        if (!result?.success) {
          throw new Error(result?.message || 'Failed to delete project');
        }

        setExpandedProjects((prev) => prev.filter((path) => path !== deleteItem.path));
        setProjectActions((prev) => {
          const next = { ...prev };
          delete next[deleteItem.path];
          return next;
        });
        removeProjectOverlay(deleteItem.path);

        if (gtdSpace?.root_path) {
          await loadProjects(gtdSpace.root_path);
        }
      } else {
        const deletePromise = safeInvoke<{
          success: boolean;
          path?: string | null;
          message?: string | null;
        }>('delete_file', { path: deleteItem.path }, { success: false, message: 'Failed to delete file' });

        const timeoutPromise = new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('Delete operation timed out after 5 seconds')), 5000);
        });

        const result = (await Promise.race([deletePromise, timeoutPromise])) as {
          success: boolean;
          path?: string | null;
          message?: string | null;
        };

        if (!result?.success) {
          throw new Error(result?.message || 'Failed to delete file');
        }

        if (deleteItem.type === 'action') {
          setActionStatuses((prev) => {
            const next = { ...prev };
            delete next[deleteItem.path];
            return next;
          });
          removeActionOverlay(deleteItem.path);

          const projectPath = deleteItem.path.substring(0, deleteItem.path.lastIndexOf('/'));
          setProjectActions((prev) => ({
            ...prev,
            [projectPath]: prev[projectPath]?.filter((action) => action.path !== deleteItem.path) || [],
          }));
          await loadProjectActions(projectPath);
        } else {
          removeSectionFileOverlay(deleteItem.path);
          const sectionPath = deleteItem.path.substring(0, deleteItem.path.lastIndexOf('/'));
          setSectionFiles((prev) => ({
            ...prev,
            [sectionPath]: prev[sectionPath]?.filter((file) => file.path !== deleteItem.path) || [],
          }));
          await loadSectionFiles(sectionPath, true);
        }

        window.dispatchEvent(
          new CustomEvent('file-deleted', {
            detail: { path: deleteItem.path },
          })
        );
      }

      return true;
    }, deleteItem.type === 'project' ? 'Failed to delete project' : 'Failed to delete file', 'workspace-sidebar');

    if (deleted) {
      setDeleteItem(null);
    }
  }, [
    deleteItem,
    gtdSpace?.root_path,
    loadProjectActions,
    loadProjects,
    loadSectionFiles,
    removeActionOverlay,
    removeProjectOverlay,
    removeSectionFileOverlay,
    withErrorHandling,
  ]);

  const handlePageCreated = React.useCallback(
    (filePath: string) => {
      if (!pageDialogDirectory) return;

      const newFile: MarkdownFile = {
        id: filePath,
        name: filePath.split('/').pop() || '',
        path: filePath,
        size: 0,
        last_modified: Math.floor(Date.now() / 1000),
        extension: 'md',
      };

      flushSync(() => {
        setSectionFiles((prev) => {
          const currentFiles = prev[pageDialogDirectory.path] || [];
          return {
            ...prev,
            [pageDialogDirectory.path]: sortMarkdownFiles([...currentFiles, newFile]),
          };
        });
      });

      setExpandedSections((prev) =>
        prev.includes(pageDialogDirectory.sectionId)
          ? prev
          : [...prev, pageDialogDirectory.sectionId]
      );

      onFileSelect(newFile);
      void loadSectionFiles(pageDialogDirectory.path, true);
    },
    [loadSectionFiles, onFileSelect, pageDialogDirectory]
  );

  const handleHabitCreated = React.useCallback(
    (habitPath: string) => {
      const habitsSection = GTD_SECTIONS.find((section) => section.id === 'habits');
      if (!habitsSection || !rootPath) return;

      const habitsPath = buildSectionPath(rootPath, habitsSection.path);
      const newFile: MarkdownFile = {
        id: habitPath,
        name: habitPath.split('/').pop() || '',
        path: habitPath,
        size: 0,
        last_modified: Math.floor(Date.now() / 1000),
        extension: 'md',
      };

      setSectionFiles((prev) => {
        const currentHabits = prev[habitsPath] || [];
        return {
          ...prev,
          [habitsPath]: sortMarkdownFiles([...currentHabits, newFile]),
        };
      });

      setExpandedSections((prev) => (prev.includes('habits') ? prev : [...prev, 'habits']));
      onFileSelect(newFile);
      void loadSectionFiles(habitsPath, true);
    },
    [loadSectionFiles, onFileSelect, rootPath]
  );

  const filteredProjects = React.useMemo(() => {
    const baseProjects = gtdSpace?.projects || [];
    const merged = [...baseProjects];

    pendingProjects.forEach((pending) => {
      if (!merged.some((project) => project.path === pending.path)) {
        merged.push(pending);
      }
    });

    if (!searchQuery) return merged;

    const query = searchQuery.toLowerCase();
    return merged.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        (project.description || '').toLowerCase().includes(query)
    );
  }, [gtdSpace?.projects, pendingProjects, searchQuery]);

  const searchResults = React.useMemo(
    () =>
      buildSidebarSearchResults({
        searchQuery,
        projects: gtdSpace?.projects || [],
        projectActions,
        sectionFiles,
        sections: GTD_SECTIONS,
        rootPath,
      }),
    [gtdSpace?.projects, projectActions, rootPath, searchQuery, sectionFiles]
  );

  const [activeProjects, completedProjects] = React.useMemo(
    () =>
      partitionProjectsByCompletion({
        projects: filteredProjects,
        projectMetadata,
      }),
    [filteredProjects, projectMetadata]
  );

  return {
    gtdSpace,
    isLoading,
    rootPath,
    showProjectDialog,
    setShowProjectDialog,
    showActionDialog,
    setShowActionDialog,
    selectedProject,
    setSelectedProject,
    expandedSections,
    expandedProjects,
    completedProjectsExpanded,
    setCompletedProjectsExpanded,
    expandedCompletedActions,
    projectActions,
    actionStatuses,
    searchQuery,
    setSearchQuery,
    showSearch,
    setShowSearch,
    showPageDialog,
    setShowPageDialog,
    pageDialogDirectory,
    setPageDialogDirectory,
    showHabitDialog,
    setShowHabitDialog,
    sectionFiles,
    loadingSections,
    loadedSections,
    deleteItem,
    setDeleteItem,
    projectMetadata,
    actionMetadata,
    sectionFileMetadata,
    searchResults,
    filteredProjects,
    activeProjects,
    completedProjects,
    isPathActive,
    loadSectionFiles,
    loadProjectActions,
    handleProjectClick,
    openHorizonReadme,
    handleCreatePage,
    toggleSection,
    toggleProjectExpand,
    toggleCompletedActions,
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
