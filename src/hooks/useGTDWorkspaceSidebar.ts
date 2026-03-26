import React from 'react';
import { flushSync } from 'react-dom';
import { safeInvoke } from '@/utils/safe-invoke';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { readFileText } from '@/hooks/useFileManager';
import { onContentChange, onContentSaved, onMetadataChange } from '@/utils/content-event-bus';
import {
  buildHorizonReadmeMarkdown,
  syncHorizonReadmeContent,
} from '@/utils/horizon-readme-utils';
import { parseActionMarkdown } from '@/utils/gtd-action-markdown';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTD_SECTIONS, HORIZON_FOLDER_TO_TYPE } from '@/components/gtd/sidebar/constants';
import {
  buildSectionPath,
  buildSectionPathCandidates,
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
import type { FileOperationResult, GTDProject, GTDSpace, MarkdownFile } from '@/types';
import { norm, isUnder } from '@/utils/path';

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

const PRELOAD_PRIORITY_SECTION_IDS = ['habits', 'areas', 'goals'] as const;
const PRELOAD_SECONDARY_SECTION_IDS = ['someday', 'cabinet', 'vision', 'purpose'] as const;
const RELOAD_SECTION_IDS = ['someday', 'cabinet', 'habits', 'areas', 'goals', 'vision', 'purpose'] as const;

function getSectionPathVariants(sectionId: string, rootPath?: string | null): string[] {
  const section = GTD_SECTIONS.find((candidate) => candidate.id === sectionId);
  if (!section) {
    return [];
  }

  const names = Array.from(new Set([section.path, ...(section.aliases ?? [])]));
  return names.map((name) => {
    if (rootPath) {
      return `${rootPath}/${name}`;
    }
    return `/${name}/`;
  });
}

function getCombinedSectionPathVariants(
  sectionIds: readonly string[],
  rootPath?: string | null
): string[] {
  return sectionIds.flatMap((sectionId) => getSectionPathVariants(sectionId, rootPath));
}

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
  const workspaceGenerationRef = React.useRef(0);

  const resolveReadmeFile = React.useCallback(async (folderPath: string): Promise<MarkdownFile> => {
    const normalizedFolderPath = normalizePath(folderPath) ?? folderPath.replace(/\\/g, '/');
    const markdownPath = `${normalizedFolderPath}/README.markdown`;
    const mdPath = `${normalizedFolderPath}/README.md`;
    const markdownExists = await withErrorHandling(async () => {
      return safeInvoke<boolean>('check_file_exists', { filePath: markdownPath }, false);
    }, 'Failed to resolve overview file', 'workspace-sidebar');
    const filePath = markdownExists ? markdownPath : mdPath;

    return {
      id: filePath,
      name: markdownExists ? 'README.markdown' : 'README.md',
      path: filePath,
      size: 0,
      last_modified: Math.floor(Date.now() / 1000),
      extension: markdownExists ? '.markdown' : '.md',
    };
  }, [withErrorHandling]);

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

    const existingReadme = files.find((file) => /^README\.(md|markdown)$/i.test(file.name));
    const readmePath = existingReadme?.path ?? `${folderPath}/README.md`;
    const filteredFiles = files.filter((file) => !/^README\.(md|markdown)$/i.test(file.name));

    const existingContent = await withErrorHandling(async () => {
      return safeInvoke<string>('read_file', { path: readmePath }, null);
    }, 'Failed to read horizon overview', 'workspace-sidebar');

    if (typeof existingContent !== 'string') {
      if (existingReadme) {
        return;
      }

      const { content } = buildHorizonReadmeMarkdown({
        horizon: horizonType,
        referencePaths: filteredFiles.map((file) => norm(file.path) ?? file.path),
      });

      const writeResult = await withErrorHandling(async () => {
        const result = await safeInvoke('save_file', { path: readmePath, content }, null);
        if (!result) {
          throw new Error('Failed to create horizon overview');
        }
        return result;
      }, 'Failed to create horizon overview', 'workspace-sidebar');

      if (!writeResult) {
        return;
      }

      return;
    }

    try {
      const { content, changed } = syncHorizonReadmeContent({
        horizon: horizonType,
        existingContent,
        files: filteredFiles,
      });
      if (changed) {
        const saveResult = await withErrorHandling(async () => {
          const result = await safeInvoke('save_file', { path: readmePath, content }, null);
          if (!result) {
            throw new Error('Failed to save horizon overview');
          }
          return result;
        }, 'Failed to save horizon overview', 'workspace-sidebar');

        if (!saveResult) {
          return;
        }
      }
    } catch (error) {
      console.error('Failed to sync horizon README', { folderPath, error });
    }
  }, [withErrorHandling]);

  const updateProjectOverlay = React.useCallback(
    (projectPath: string, patch: Partial<SidebarProjectMetadata>) => {
      const normalizedKey = normalizePath(projectPath) ?? projectPath.replace(/\\/g, '/');
      setProjectMetadata((prev) => ({
        ...prev,
        [normalizedKey]: {
          ...prev[normalizedKey],
          ...patch,
        },
      }));
    },
    []
  );

  const updateActionOverlay = React.useCallback(
    (actionPath: string, patch: Partial<SidebarActionMetadata>) => {
      const normalizedKey = normalizePath(actionPath) ?? actionPath.replace(/\\/g, '/');
      setActionMetadata((prev) => ({
        ...prev,
        [normalizedKey]: {
          ...prev[normalizedKey],
          ...patch,
        },
      }));
    },
    []
  );

  const updateSectionFileOverlay = React.useCallback(
    (filePath: string, patch: Partial<SidebarSectionFileMetadata>) => {
      const normalizedKey = normalizePath(filePath) ?? filePath.replace(/\\/g, '/');
      setSectionFileMetadata((prev) => ({
        ...prev,
        [normalizedKey]: {
          ...prev[normalizedKey],
          ...patch,
        },
      }));
    },
    []
  );

  const removeActionOverlay = React.useCallback((filePath: string) => {
    const normalizedKey = normalizePath(filePath) ?? filePath.replace(/\\/g, '/');
    setActionMetadata((prev) => {
      const next = { ...prev };
      delete next[normalizedKey];
      return next;
    });
  }, []);

  const removeProjectOverlay = React.useCallback((projectPath: string) => {
    const normalizedKey = normalizePath(projectPath) ?? projectPath.replace(/\\/g, '/');
    setProjectMetadata((prev) => {
      const next = { ...prev };
      delete next[normalizedKey];
      return next;
    });
  }, []);

  const removeSectionFileOverlay = React.useCallback((filePath: string) => {
    const normalizedKey = normalizePath(filePath) ?? filePath.replace(/\\/g, '/');
    setSectionFileMetadata((prev) => {
      const next = { ...prev };
      delete next[normalizedKey];
      return next;
    });
  }, []);

  const resolveSectionLoadPath = React.useCallback(
    async (sectionId: string, root: string): Promise<string | null> => {
      const section = GTD_SECTIONS.find((candidate) => candidate.id === sectionId);
      if (!section || section.id === 'calendar' || section.id === 'projects') {
        return null;
      }

      const candidatePaths = buildSectionPathCandidates(root, section);
      if (candidatePaths.length <= 1) {
        return candidatePaths[0] ?? null;
      }

      for (const candidatePath of candidatePaths) {
        const exists = await safeInvoke<boolean>(
          'check_directory_exists',
          { path: candidatePath },
          false
        );
        if (exists) {
          return candidatePath;
        }
      }

      return candidatePaths[0] ?? null;
    },
    []
  );

  const resolveSectionLoadPaths = React.useCallback(
    async (sectionIds: readonly string[], root: string): Promise<string[]> => {
      const resolvedPaths = await Promise.all(
        sectionIds.map((sectionId) => resolveSectionLoadPath(sectionId, root))
      );

      return [...new Set(resolvedPaths.filter((path): path is string => Boolean(path)))];
    },
    [resolveSectionLoadPath]
  );

  const resolveExistingSectionPath = React.useCallback(
    async (sectionPath: string): Promise<string> => {
      const normalizedPath = normalizePath(sectionPath) ?? sectionPath.replace(/\\/g, '/');
      if (!rootPath) {
        return normalizedPath;
      }

      const section = GTD_SECTIONS.find((candidate) => {
        if (candidate.id === 'calendar' || candidate.id === 'projects') {
          return false;
        }

        return buildSectionPathCandidates(rootPath, candidate).some((candidatePath) =>
          isUnder(norm(normalizedPath), norm(candidatePath))
        );
      });

      if (!section) {
        return normalizedPath;
      }

      const candidatePaths = buildSectionPathCandidates(rootPath, section);
      const orderedPaths = candidatePaths.includes(normalizedPath)
        ? [normalizedPath, ...candidatePaths.filter((candidate) => candidate !== normalizedPath)]
        : candidatePaths;

      for (const candidatePath of orderedPaths) {
        const exists = await safeInvoke<boolean>(
          'check_directory_exists',
          { path: candidatePath },
          false
        );
        if (exists === true) {
          return candidatePath;
        }
      }

      return normalizedPath;
    },
    [rootPath]
  );

  const loadSectionFiles = React.useCallback(
    async (sectionPath: string, force: boolean = false): Promise<MarkdownFile[]> => {
      const generationAtStart = workspaceGenerationRef.current;
      const requestedKey = normalizePath(sectionPath) ?? sectionPath.replace(/\\/g, '/');
      const normalizedKey = await resolveExistingSectionPath(sectionPath);
      const current = sectionFilesRef.current[normalizedKey] ?? sectionFilesRef.current[requestedKey];
      if (!force && current) {
        return current;
      }

      const directoryExists = await withErrorHandling(async () => {
        return safeInvoke<boolean>(
          'check_directory_exists',
          { path: normalizedKey },
          null
        );
      }, 'Failed to check section directory', 'workspace-sidebar');
      if (directoryExists !== true) {
        return current || [];
      }

      if (loadingSectionsRef.current.has(normalizedKey)) {
        return current || [];
      }

      loadingSectionsRef.current.add(normalizedKey);
      setLoadingSections((prev) => {
        const next = new Set(prev);
        next.add(normalizedKey);
        return next;
      });

      try {
        const files = await withErrorHandling(async () => {
          const result = await safeInvoke<MarkdownFile[]>(
            'list_markdown_files',
            { path: normalizedKey },
            null
          );
          if (result == null) {
            throw new Error(`Failed to load section files for ${normalizedKey}`);
          }
          return result;
        }, 'Failed to load section files', 'workspace-sidebar');
        if (files === undefined || files === null) {
          return current || [];
        }
        const sortedFiles = sortMarkdownFiles(files);

        if (workspaceGenerationRef.current !== generationAtStart) {
          return current || [];
        }

        setSectionFiles((prev) => {
          const next = { ...prev };
          if (normalizedKey !== requestedKey) {
            delete next[requestedKey];
          }
          next[normalizedKey] = sortedFiles;
          return next;
        });
        setLoadedSections((prev) => {
          const next = new Set(prev);
          if (normalizedKey !== requestedKey) {
            next.delete(requestedKey);
          }
          next.add(normalizedKey);
          return next;
        });

        if (workspaceGenerationRef.current !== generationAtStart) {
          return sortedFiles;
        }

        await syncHorizonReadme(normalizedKey, sortedFiles);
        return sortedFiles;
      } catch {
        return [];
      } finally {
        loadingSectionsRef.current.delete(normalizedKey);
        setLoadingSections((prev) => {
          const next = new Set(prev);
          next.delete(normalizedKey);
          return next;
        });
      }
    },
    [resolveExistingSectionPath, syncHorizonReadme, withErrorHandling]
  );

  const loadProjectActions = React.useCallback(async (projectPath: string) => {
    const generationAtStart = workspaceGenerationRef.current;
    const normalizedKey = normalizePath(projectPath) ?? projectPath.replace(/\\/g, '/');
    try {
      let files = await withErrorHandling(async () => {
        return safeInvoke<MarkdownFile[]>('list_project_actions', { projectPath: normalizedKey }, null);
      }, 'Failed to load project actions', 'workspace-sidebar');
      files = files ?? [];
      if (files.length === 0) {
        const all = await withErrorHandling(async () => {
          const result = await safeInvoke<MarkdownFile[]>('list_markdown_files', { path: normalizedKey }, null);
          if (result == null) {
            throw new Error(`Failed to load project files for ${normalizedKey}`);
          }
          return result;
        }, 'Failed to load project files', 'workspace-sidebar');
        files = (all ?? []).filter((file) => !/^README\.(md|markdown)$/i.test(file.name));
      }

      if (workspaceGenerationRef.current !== generationAtStart) {
        return;
      }

      setProjectActions((prev) => ({
        ...prev,
        [normalizedKey]: files ?? [],
      }));

      const statusResults = await Promise.all(
        (files ?? []).map(async (action) => {
          try {
            const content = await readFileText(action.path);
            const parsedAction = parseActionMarkdown(content);
            const normalizedActionPath = normalizePath(action.path) ?? action.path.replace(/\\/g, '/');
            return {
              path: normalizedActionPath,
              status: parsedAction.status || 'in-progress',
              due_date: parsedAction.dueDate || '',
            };
          } catch {
            return {
              path: normalizePath(action.path) ?? action.path.replace(/\\/g, '/'),
              status: 'in-progress',
              due_date: '',
            };
          }
        })
      );

      if (workspaceGenerationRef.current !== generationAtStart) {
        return;
      }

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
          } else if (next[path]) {
            const { due_date: _ignored, ...rest } = next[path];
            next[path] = rest;
          }
        });
        return next;
      });
    } catch {
      // Keep existing project action state when a refresh fails.
    }
  }, [withErrorHandling]);

  React.useEffect(() => {
    const pathToCheck = gtdSpace?.root_path;
    const normalizedRoot = normalizePath(pathToCheck);
    const normalizedCurrent = normalizePath(currentFolder);
    const normalizedRootWithSlash = normalizedRoot?.endsWith('/')
      ? normalizedRoot
      : `${normalizedRoot ?? ''}/`;

    if (
      !normalizedRoot ||
      !normalizedCurrent ||
      !(
        normalizedCurrent === normalizedRoot ||
        normalizedCurrent.startsWith(normalizedRootWithSlash)
      )
    ) {
      return;
    }

    let cancelled = false;

    const preload = async () => {
      if (lastRootRef.current !== pathToCheck) {
        workspaceGenerationRef.current += 1;
        preloadedRef.current = false;
        lastRootRef.current = pathToCheck;
        setLoadedSections(new Set());
        setSectionFiles({});
        sectionFilesRef.current = {};
        setProjectActions({});
        projectActionsRef.current = {};
        setProjectMetadata({});
        setActionMetadata({});
        setActionStatuses({});
        setSectionFileMetadata({});
        setPendingProjects([]);
      }

      const isGTD = await checkGTDSpace(pathToCheck);
      if (!isGTD || cancelled) return;

      if (!gtdSpace?.projects || gtdSpace.projects.length === 0) {
        await loadProjects(pathToCheck);
        if (cancelled) return;
      }

      if (!preloadedRef.current) {
        preloadedRef.current = true;

        const priorityPaths = await resolveSectionLoadPaths(
          PRELOAD_PRIORITY_SECTION_IDS,
          pathToCheck
        );
        const secondaryPaths = await resolveSectionLoadPaths(
          PRELOAD_SECONDARY_SECTION_IDS,
          pathToCheck
        );

        await Promise.allSettled(priorityPaths.map((path) => loadSectionFiles(path)));
        if (cancelled) return;

        await Promise.allSettled(secondaryPaths.map((path) => loadSectionFiles(path)));
      }
    };

    void preload();

    return () => {
      cancelled = true;
    };
  }, [
    checkGTDSpace,
    currentFolder,
    gtdSpace?.projects,
    gtdSpace?.root_path,
    loadProjects,
    loadSectionFiles,
    resolveSectionLoadPaths,
  ]);

  React.useEffect(() => {
    const unsubscribeMetadata = onMetadataChange((event) => {
      const { filePath, metadata, changedFields } = event;
      const normalizedFilePath = normalizePath(filePath) ?? filePath.replace(/\\/g, '/');

      if (
        normalizedFilePath.includes('/Projects/') &&
        /\/README\.(md|markdown)$/i.test(normalizedFilePath)
      ) {
        const projectPath = normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/'));

        if (changedFields?.status || changedFields?.projectStatus) {
          const nextStatus = metadata.projectStatus || metadata.status;
          if (nextStatus) {
            updateProjectOverlay(projectPath, { status: String(nextStatus) });
          } else {
            updateProjectOverlay(projectPath, { status: '' });
          }
        }

        if (changedFields?.due_date || changedFields?.dueDate || changedFields?.datetime) {
          const nextDue =
            (metadata as { due_date?: string; dueDate?: string }).due_date ||
            (metadata as { due_date?: string; dueDate?: string }).dueDate;
          if (typeof nextDue === 'string') {
            updateProjectOverlay(projectPath, { due_date: nextDue });
          } else {
            updateProjectOverlay(projectPath, { due_date: undefined });
          }
        }
      }

      if (
        normalizedFilePath.includes('/Projects/') &&
        !/\/README\.(md|markdown)$/i.test(normalizedFilePath) &&
        /\.(md|markdown)$/i.test(normalizedFilePath)
      ) {
        if (changedFields?.status && metadata.status) {
          setActionStatuses((prev) => ({
            ...prev,
            [normalizedFilePath]: String(metadata.status),
          }));
          updateActionOverlay(normalizedFilePath, { status: String(metadata.status) });
        }

        if (changedFields?.due_date || changedFields?.dueDate || changedFields?.datetime) {
          const nextDue =
            (metadata as { due_date?: string; dueDate?: string }).due_date ||
            (metadata as { due_date?: string; dueDate?: string }).dueDate;
          updateActionOverlay(normalizedFilePath, {
            due_date: typeof nextDue === 'string' ? nextDue : undefined,
          });
        }
      }

      const sectionPaths = getCombinedSectionPathVariants(RELOAD_SECTION_IDS);

      for (const sectionPath of sectionPaths) {
        if (normalizedFilePath.includes(sectionPath)) {
          const folderPath = normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/'));
          void loadSectionFiles(folderPath, true);
          break;
        }
      }
    });

    const unsubscribeChanged = onContentChange((event) => {
      const { filePath, metadata, changedFields } = event;
      const normalizedFilePath = normalizePath(filePath) ?? filePath.replace(/\\/g, '/');

      if (
        normalizedFilePath.includes('/Projects/') &&
        /\/README\.(md|markdown)$/i.test(normalizedFilePath)
      ) {
        const projectPath = normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/'));
        if (changedFields?.dueDate || changedFields?.due_date || changedFields?.datetime) {
          const nextDue =
            (metadata as { due_date?: string; dueDate?: string }).dueDate ||
            (metadata as { due_date?: string; dueDate?: string }).due_date;
          if (typeof nextDue === 'string') {
            updateProjectOverlay(projectPath, { due_date: nextDue });
          } else {
            updateProjectOverlay(projectPath, { due_date: undefined });
          }
        }
      }
    });

    const unsubscribeSaved = onContentSaved(async (event) => {
      const { filePath, metadata } = event;
      const normalizedFilePath = normalizePath(filePath) ?? filePath.replace(/\\/g, '/');

      if (
        normalizedFilePath.includes('/Projects/') &&
        /\/README\.(md|markdown)$/i.test(normalizedFilePath)
      ) {
        const projectPath = normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/'));
        const nextTitle = metadata.title;

        if (nextTitle) {
          const currentProjectName = projectPath.split('/').pop();

          if (currentProjectName && currentProjectName !== nextTitle) {
            await withErrorHandling(async () => {
              const newProjectPath = await safeInvoke<string>(
                'rename_gtd_project',
                { oldProjectPath: projectPath, newProjectName: nextTitle },
                null
              );
              if (!newProjectPath || typeof newProjectPath !== 'string') {
                throw new Error('rename_gtd_project failed');
              }

              const normalizedNewProjectPath = normalizePath(newProjectPath) ?? newProjectPath;
              updateProjectOverlay(projectPath, {
                title: String(nextTitle),
                currentPath: normalizedNewProjectPath,
              });
              updateProjectOverlay(normalizedNewProjectPath, {
                title: String(nextTitle),
                currentPath: normalizedNewProjectPath,
              });

              setExpandedProjects((prev) =>
                prev.map((path) => (path === projectPath ? normalizedNewProjectPath : path))
              );
              setProjectActions((prev) =>
                prev[projectPath]
                  ? {
                      ...prev,
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
                    newPath: normalizedNewProjectPath,
                    newName: nextTitle,
                  },
                })
              );
            }, 'Failed to rename project', 'workspace-sidebar');
          }
        }

        const nextDue =
          (metadata as { due_date?: string; dueDate?: string }).due_date ||
          (metadata as { due_date?: string; dueDate?: string }).dueDate;
        if (typeof nextDue === 'string') {
          updateProjectOverlay(projectPath, { due_date: nextDue });
        } else {
          updateProjectOverlay(projectPath, { due_date: undefined });
        }

        if (gtdSpace?.root_path) {
          await loadProjects(gtdSpace.root_path);
        }
      }

      if (
        normalizedFilePath.includes('/Projects/') &&
        !/\/README\.(md|markdown)$/i.test(normalizedFilePath) &&
        /\.(md|markdown)$/i.test(normalizedFilePath)
      ) {
        const nextTitle = metadata.title;
        if (nextTitle) {
          const currentActionName = normalizedFilePath
            .split('/')
            .pop()
            ?.replace(/\.(md|markdown)$/i, '');
          if (currentActionName && currentActionName !== nextTitle) {
            await withErrorHandling(async () => {
              const newActionPath = await safeInvoke<string>(
                'rename_gtd_action',
                { oldActionPath: normalizedFilePath, newActionName: nextTitle },
                null
              );
              if (!newActionPath || typeof newActionPath !== 'string') {
                throw new Error('rename_gtd_action failed');
              }

              const normalizedNewActionPath = normalizePath(newActionPath) ?? newActionPath;
              updateActionOverlay(normalizedFilePath, {
                title: String(nextTitle),
                currentPath: normalizedNewActionPath,
              });
              updateActionOverlay(normalizedNewActionPath, {
                title: String(nextTitle),
                currentPath: normalizedNewActionPath,
              });

              const projectPath = normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/'));
              await loadProjectActions(projectPath);
              removeActionOverlay(normalizedFilePath);

              window.dispatchEvent(
                new CustomEvent('action-renamed', {
                  detail: {
                    oldPath: normalizedFilePath,
                    newPath: normalizedNewActionPath,
                    newName: nextTitle,
                  },
                })
              );
              window.dispatchEvent(
                new CustomEvent('file-renamed', {
                  detail: {
                    oldPath: normalizedFilePath,
                    newPath: normalizedNewActionPath,
                  },
                })
              );
            }, 'Failed to rename action', 'workspace-sidebar');
          }
        }
      }

      const sectionPaths = getCombinedSectionPathVariants(RELOAD_SECTION_IDS);

      for (const sectionPath of sectionPaths) {
        if (
          normalizedFilePath.includes(sectionPath) &&
          /\.(md|markdown)$/i.test(normalizedFilePath)
        ) {
          const nextTitle = metadata.title;

          if (nextTitle) {
            const currentFileName = normalizedFilePath
              .split('/')
              .pop()
              ?.replace(/\.(md|markdown)$/i, '');
            if (
              currentFileName &&
              currentFileName.toLowerCase() !== 'readme' &&
              currentFileName !== nextTitle
            ) {
              await withErrorHandling(async () => {
                const renameResult = await safeInvoke<FileOperationResult>(
                  'rename_file',
                  { oldPath: normalizedFilePath, newName: nextTitle },
                  null
                );
                if (!renameResult?.success || !renameResult.path) {
                  throw new Error(renameResult?.message || 'rename_file failed');
                }
                const newFilePath = renameResult.path;

                const normalizedNewFilePath = normalizePath(newFilePath) ?? newFilePath;
                updateSectionFileOverlay(normalizedFilePath, {
                  title: String(nextTitle),
                  currentPath: normalizedNewFilePath,
                });
                updateSectionFileOverlay(normalizedNewFilePath, {
                  title: String(nextTitle),
                  currentPath: normalizedNewFilePath,
                });

                const folderPath = normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/'));
                await loadSectionFiles(folderPath, true);
                removeSectionFileOverlay(normalizedFilePath);

                window.dispatchEvent(
                  new CustomEvent('section-file-renamed', {
                    detail: {
                      oldPath: normalizedFilePath,
                      newPath: normalizedNewFilePath,
                      newName: nextTitle,
                    },
                  })
                );
                window.dispatchEvent(
                  new CustomEvent('file-renamed', {
                    detail: {
                      oldPath: normalizedFilePath,
                      newPath: normalizedNewFilePath,
                    },
                  })
                );
              }, 'Failed to rename file', 'workspace-sidebar');
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
          prev.some(
            (project) => (norm(project.path) ?? project.path) === (norm(optimistic.path) ?? optimistic.path)
          )
            ? prev
            : [...prev, optimistic]
        );
      }

      if (gtdSpace?.root_path) {
        const projects = await loadProjects(gtdSpace.root_path);
        setPendingProjects((prev) =>
          prev.filter(
            (project) =>
              !projects.some(
                (loaded) => (norm(loaded.path) ?? loaded.path) === (norm(project.path) ?? project.path)
              )
          )
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
    withErrorHandling,
  ]);

  React.useEffect(() => {
    if (!gtdSpace?.projects || gtdSpace.projects.length === 0) return;

    const missingProjects = gtdSpace.projects.filter((project) => {
      const normalizedKey = normalizePath(project.path) ?? project.path.replace(/\\/g, '/');
      return !projectActions[normalizedKey];
    });
    if (missingProjects.length === 0) return;

    void Promise.all(missingProjects.map((project) => loadProjectActions(project.path)));
  }, [gtdSpace?.projects, loadProjectActions, projectActions]);

  const toggleSection = React.useCallback((sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
  }, []);

  const toggleCompletedActions = React.useCallback((projectPath: string) => {
    const normalizedProjectPath = normalizePath(projectPath) ?? projectPath.replace(/\\/g, '/');
    setExpandedCompletedActions((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedProjectPath)) {
        next.delete(normalizedProjectPath);
      } else {
        next.add(normalizedProjectPath);
      }
      return next;
    });
  }, []);

  const handleProjectClick = React.useCallback(
    async (project: GTDProject) => {
      setSelectedProject(project);
      const normalizedProjectPath = normalizePath(project.path) ?? project.path.replace(/\\/g, '/');
      if (!projectActionsRef.current[normalizedProjectPath]) {
        await loadProjectActions(project.path);
      }

      onFileSelect(await resolveReadmeFile(project.path));
    },
    [loadProjectActions, onFileSelect, resolveReadmeFile]
  );

  const toggleProjectExpand = React.useCallback(
    async (project: GTDProject) => {
      const normalizedProjectPath = normalizePath(project.path) ?? project.path.replace(/\\/g, '/');
      const isExpanded = expandedProjects.includes(normalizedProjectPath);
      if (isExpanded) {
        setExpandedProjects((prev) => prev.filter((path) => path !== normalizedProjectPath));
        return;
      }

      setExpandedProjects((prev) => [...prev, normalizedProjectPath]);
      if (!projectActionsRef.current[normalizedProjectPath]) {
        await loadProjectActions(project.path);
      }
    },
    [expandedProjects, loadProjectActions]
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
        setShowHabitDialog(true);
        return;
      }

      const path = buildSectionPath(rootPath, section.path);
      const candidatePaths = buildSectionPathCandidates(rootPath, section);
      const resolvedPath =
        candidatePaths.find((candidate) => sectionFilesRef.current[candidate]) ?? path;
      setPageDialogDirectory({
        path: resolvedPath,
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

    const nonProjectSectionPaths = await resolveSectionLoadPaths(
      GTD_SECTIONS.filter((section) => section.id !== 'calendar' && section.id !== 'projects').map(
        (section) => section.id
      ),
      rootPath
    );

    await Promise.all([...new Set(nonProjectSectionPaths)].map((path) => loadSectionFiles(path, true)));
    await Promise.all(Object.keys(projectActionsRef.current).map((path) => loadProjectActions(path)));
  }, [
    loadProjectActions,
    loadProjects,
    loadSectionFiles,
    onRefresh,
    resolveSectionLoadPaths,
    rootPath,
  ]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteItem) return;

    const deleted = await withErrorHandling(async () => {
      const normalizedDeletePath = normalizePath(deleteItem.path) ?? deleteItem.path.replace(/\\/g, '/');

      if (deleteItem.type === 'project') {
        const result = await safeInvoke<{
          success: boolean;
          path?: string | null;
          message?: string | null;
        }>('delete_folder', { path: normalizedDeletePath }, { success: false, message: 'Failed to delete folder' });

        if (!result?.success) {
          throw new Error(result?.message || 'Failed to delete project');
        }

        setPendingProjects((prev) =>
          prev.filter(
            (project) => (norm(project.path) ?? project.path) !== normalizedDeletePath
          )
        );
        setExpandedProjects((prev) => prev.filter((path) => path !== normalizedDeletePath));
        setProjectActions((prev) => {
          const next = { ...prev };
          delete next[normalizedDeletePath];
          return next;
        });
        removeProjectOverlay(normalizedDeletePath);
        window.dispatchEvent(
          new CustomEvent('file-deleted', {
            detail: { path: normalizedDeletePath },
          })
        );

        if (gtdSpace?.root_path) {
          await loadProjects(gtdSpace.root_path);
        }
      } else {
        const result = await safeInvoke<{
          success: boolean;
          path?: string | null;
          message?: string | null;
        }>('delete_file', { path: normalizedDeletePath }, { success: false, message: 'Failed to delete file' });

        if (!result?.success) {
          throw new Error(result?.message || 'Failed to delete file');
        }

        if (deleteItem.type === 'action') {
          setActionStatuses((prev) => {
            const next = { ...prev };
            delete next[normalizedDeletePath];
            return next;
          });
          removeActionOverlay(normalizedDeletePath);

          const projectPath = normalizedDeletePath.substring(0, normalizedDeletePath.lastIndexOf('/'));
          setProjectActions((prev) => ({
            ...prev,
            [projectPath]:
              prev[projectPath]?.filter((action) => action.path !== normalizedDeletePath) || [],
          }));
          await loadProjectActions(projectPath);
        } else {
          removeSectionFileOverlay(normalizedDeletePath);
          const sectionPath = normalizedDeletePath.substring(0, normalizedDeletePath.lastIndexOf('/'));
          setSectionFiles((prev) => ({
            ...prev,
            [sectionPath]:
              prev[sectionPath]?.filter((file) => file.path !== normalizedDeletePath) || [],
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
      const normalizedDirectoryPath =
        normalizePath(pageDialogDirectory.path) ?? pageDialogDirectory.path.replace(/\\/g, '/');

      const newFile: MarkdownFile = {
        id: filePath,
        name: getFolderName(normalizePath(filePath) ?? filePath),
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
      const normalizedHabitsPath = normalizePath(habitsPath) ?? habitsPath.replace(/\\/g, '/');
      const newFile: MarkdownFile = {
        id: habitPath,
        name: getFolderName(normalizePath(habitPath) ?? habitPath),
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
      if (
        !merged.some(
          (project) => (norm(project.path) ?? project.path) === (norm(pending.path) ?? pending.path)
        )
      ) {
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
        projectMetadata,
        actionMetadata,
        actionStatuses,
        sectionFileMetadata,
      }),
    [
      actionMetadata,
      actionStatuses,
      gtdSpace?.projects,
      projectActions,
      projectMetadata,
      rootPath,
      searchQuery,
      sectionFileMetadata,
      sectionFiles,
    ]
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
