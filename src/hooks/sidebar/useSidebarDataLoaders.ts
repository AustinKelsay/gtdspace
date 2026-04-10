import React from 'react';
import { flushSync } from 'react-dom';
import { safeInvoke } from '@/utils/safe-invoke';
import { readFileText } from '@/hooks/useFileManager';
import {
  buildHorizonReadmeMarkdown,
  syncHorizonReadmeContent,
} from '@/utils/horizon-readme-utils';
import { parseActionMarkdown } from '@/utils/gtd-action-markdown';
import { GTD_SECTIONS, HORIZON_FOLDER_TO_TYPE } from '@/components/gtd/sidebar/constants';
import { getFolderName, sortMarkdownFiles } from '@/components/gtd/sidebar/utils';
import type {
  SidebarLoaderDeps,
  SidebarDataState,
  SidebarProjectActionLoadOptions,
} from '@/hooks/sidebar/types';
import {
  buildSectionPathCandidates,
  inferSectionContextFromPath,
  normalizeSidebarPath,
} from '@/hooks/sidebar/path-classification';
import type { GTDProject, MarkdownFile } from '@/types';
import { norm, isUnder } from '@/utils/path';

interface UseSidebarDataLoadersResult extends SidebarDataState {
  resolveReadmeFile: (folderPath: string) => Promise<MarkdownFile>;
  resolveSectionLoadPaths: (
    sectionIds: readonly string[],
    root: string
  ) => Promise<string[]>;
  loadSectionFiles: (sectionPath: string, force?: boolean) => Promise<MarkdownFile[]>;
  loadProjectActions: (
    projectPath: string,
    options?: SidebarProjectActionLoadOptions
  ) => Promise<void>;
}

export function useSidebarDataLoaders({
  rootPath,
  withErrorHandling,
  overlays,
}: SidebarLoaderDeps): UseSidebarDataLoadersResult {
  const [projectActions, setProjectActions] = React.useState<
    Record<string, MarkdownFile[]>
  >({});
  const [projectLoading, setProjectLoading] = React.useState<Record<string, boolean>>(
    {}
  );
  const [sectionFiles, setSectionFiles] = React.useState<
    Record<string, MarkdownFile[]>
  >({});
  const [loadingSections, setLoadingSections] = React.useState<Set<string>>(
    new Set()
  );
  const [loadedSections, setLoadedSections] = React.useState<Set<string>>(
    new Set()
  );
  const [pendingProjects, setPendingProjects] = React.useState<GTDProject[]>([]);

  const sectionFilesRef = React.useRef<Record<string, MarkdownFile[]>>({});
  const projectActionsRef = React.useRef<Record<string, MarkdownFile[]>>({});
  const projectLoadingRef = React.useRef<Record<string, boolean>>({});
  const projectLoadVersionsRef = React.useRef<Record<string, number>>({});
  const loadingSectionsRef = React.useRef<Set<string>>(new Set());
  const lastRootRef = React.useRef<string | null>(null);
  const projectsHydratedRef = React.useRef(false);
  const preloadedRef = React.useRef(false);
  const workspaceGenerationRef = React.useRef(0);

  React.useEffect(() => {
    sectionFilesRef.current = sectionFiles;
  }, [sectionFiles]);

  React.useEffect(() => {
    projectActionsRef.current = projectActions;
  }, [projectActions]);

  React.useEffect(() => {
    projectLoadingRef.current = projectLoading;
  }, [projectLoading]);

  const resetDataState = React.useCallback(() => {
    setLoadedSections(new Set());
    setSectionFiles({});
    sectionFilesRef.current = {};
    setProjectActions({});
    projectActionsRef.current = {};
    setProjectLoading({});
    projectLoadingRef.current = {};
    projectLoadVersionsRef.current = {};
    setLoadingSections(new Set());
    loadingSectionsRef.current = new Set();
    setPendingProjects([]);
    projectsHydratedRef.current = false;
  }, [setPendingProjects]);

  const resolveReadmeFile = React.useCallback(
    async (folderPath: string): Promise<MarkdownFile> => {
      const normalizedFolderPath =
        normalizeSidebarPath(folderPath) ?? folderPath.replace(/\\/g, '/');
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
    },
    [withErrorHandling]
  );

  const syncHorizonReadme = React.useCallback(
    async (folderPath: string, files: MarkdownFile[]) => {
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
    },
    [withErrorHandling]
  );

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
        const exists = await withErrorHandling(
          async () =>
            safeInvoke<boolean>(
              'check_directory_exists',
              { path: candidatePath },
              false
            ),
          'Failed to verify section directory'
        );
        if (exists) {
          return candidatePath;
        }
      }

      return candidatePaths[0] ?? null;
    },
    [withErrorHandling]
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
      const normalizedPath =
        normalizeSidebarPath(sectionPath) ?? sectionPath.replace(/\\/g, '/');
      const sectionFromRoot = rootPath
        ? GTD_SECTIONS.find((candidate) => {
            if (candidate.id === 'calendar' || candidate.id === 'projects') {
              return false;
            }

            return buildSectionPathCandidates(rootPath, candidate).some((candidatePath) =>
              isUnder(norm(normalizedPath), norm(candidatePath))
            );
          })
        : null;
      const inferredContext = inferSectionContextFromPath(normalizedPath);
      const section = sectionFromRoot ?? inferredContext?.section;
      const candidateRoot = rootPath ?? inferredContext?.root;

      if (!section || !candidateRoot) {
        return normalizedPath;
      }

      const candidatePaths = buildSectionPathCandidates(candidateRoot, section);
      const orderedPaths = candidatePaths.includes(normalizedPath)
        ? [normalizedPath, ...candidatePaths.filter((candidate) => candidate !== normalizedPath)]
        : candidatePaths;

      for (const candidatePath of orderedPaths) {
        const exists = await withErrorHandling(
          async () =>
            safeInvoke<boolean>(
              'check_directory_exists',
              { path: candidatePath },
              false
            ),
          'Failed to verify section directory'
        );
        if (exists === true) {
          return candidatePath;
        }
      }

      return normalizedPath;
    },
    [rootPath, withErrorHandling]
  );

  const loadSectionFiles = React.useCallback(
    async (sectionPath: string, force: boolean = false): Promise<MarkdownFile[]> => {
      const generationAtStart = workspaceGenerationRef.current;
      const requestedKey =
        normalizeSidebarPath(sectionPath) ?? sectionPath.replace(/\\/g, '/');
      const normalizedKey = await resolveExistingSectionPath(sectionPath);
      const current =
        sectionFilesRef.current[normalizedKey] ?? sectionFilesRef.current[requestedKey];
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
        return current || [];
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

  const loadProjectActions = React.useCallback(
    async (
      projectPath: string,
      options: SidebarProjectActionLoadOptions = {}
    ) => {
      const generationAtStart = workspaceGenerationRef.current;
      const forceReload = options.force ?? false;
      const normalizedKey =
        normalizeSidebarPath(projectPath) ?? projectPath.replace(/\\/g, '/');
      if (!forceReload && projectLoadingRef.current[normalizedKey]) {
        return;
      }

      const requestVersion =
        (projectLoadVersionsRef.current[normalizedKey] ?? 0) + 1;
      projectLoadVersionsRef.current = {
        ...projectLoadVersionsRef.current,
        [normalizedKey]: requestVersion,
      };

      projectLoadingRef.current = {
        ...projectLoadingRef.current,
        [normalizedKey]: true,
      };
      setProjectLoading((prev) => ({
        ...prev,
        [normalizedKey]: true,
      }));

      try {
        let files = await withErrorHandling(async () => {
          return safeInvoke<MarkdownFile[]>(
            'list_project_actions',
            { projectPath: normalizedKey },
            null
          );
        }, 'Failed to load project actions', 'workspace-sidebar');
        files = files ?? [];
        if (files.length === 0) {
          const all = await withErrorHandling(async () => {
            const result = await safeInvoke<MarkdownFile[]>(
              'list_markdown_files',
              { path: normalizedKey },
              null
            );
            if (result == null) {
              throw new Error(`Failed to load project files for ${normalizedKey}`);
            }
            return result;
          }, 'Failed to load project files', 'workspace-sidebar');
          files = (all ?? []).filter((file) => !/^README\.(md|markdown)$/i.test(file.name));
        }

        if (
          workspaceGenerationRef.current !== generationAtStart ||
          projectLoadVersionsRef.current[normalizedKey] !== requestVersion
        ) {
          return;
        }

        flushSync(() => {
          setProjectActions((prev) => ({
            ...prev,
            [normalizedKey]: files ?? [],
          }));
        });

        const statusResults = await Promise.all(
          (files ?? []).map(async (action) => {
            try {
              const content = await readFileText(action.path);
              const parsedAction = parseActionMarkdown(content);
              const normalizedActionPath =
                normalizeSidebarPath(action.path) ?? action.path.replace(/\\/g, '/');
              return {
                path: normalizedActionPath,
                status: parsedAction.status || 'in-progress',
                due_date: parsedAction.dueDate || '',
              };
            } catch {
              return {
                path:
                  normalizeSidebarPath(action.path) ?? action.path.replace(/\\/g, '/'),
                status: 'in-progress',
                due_date: '',
              };
            }
          })
        );

        if (
          workspaceGenerationRef.current !== generationAtStart ||
          projectLoadVersionsRef.current[normalizedKey] !== requestVersion
        ) {
          return;
        }

        const nextStatuses = Object.fromEntries(
          statusResults.map((result) => [result.path, result.status])
        );

        flushSync(() => {
          overlays.setActionStatuses((prev) => ({
            ...prev,
            ...nextStatuses,
          }));
          setProjectLoading((prev) => {
            const next = { ...prev };
            delete next[normalizedKey];
            return next;
          });
        });
        projectLoadingRef.current = Object.fromEntries(
          Object.entries(projectLoadingRef.current).filter(([path]) => path !== normalizedKey)
        );

        overlays.setActionMetadata((prev) => {
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
      } finally {
        if (
          workspaceGenerationRef.current === generationAtStart &&
          projectLoadVersionsRef.current[normalizedKey] === requestVersion
        ) {
          projectLoadingRef.current = Object.fromEntries(
            Object.entries(projectLoadingRef.current).filter(([path]) => path !== normalizedKey)
          );
          setProjectLoading((prev) => {
            if (!(normalizedKey in prev)) {
              return prev;
            }
            const next = { ...prev };
            delete next[normalizedKey];
            return next;
          });
        }
      }
    },
    [overlays, withErrorHandling]
  );

  return {
    sectionFiles,
    setSectionFiles,
    sectionFilesRef,
    projectActions,
    setProjectActions,
    projectActionsRef,
    projectLoading,
    setProjectLoading,
    projectLoadingRef,
    loadingSections,
    setLoadingSections,
    loadingSectionsRef,
    loadedSections,
    setLoadedSections,
    pendingProjects,
    setPendingProjects,
    lastRootRef,
    projectsHydratedRef,
    preloadedRef,
    workspaceGenerationRef,
    resetDataState,
    resolveReadmeFile,
    resolveSectionLoadPaths,
    loadSectionFiles,
    loadProjectActions,
  };
}
