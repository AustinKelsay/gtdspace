import React from 'react';
import type { GTDProject } from '@/types';
import type {
  SidebarDataState,
  SidebarOverlayState,
  SidebarProjectActionLoadOptions,
} from '@/hooks/sidebar/types';
import { normalizeSidebarPath } from '@/hooks/sidebar/path-classification';
import { norm } from '@/utils/path';

const PRELOAD_PRIORITY_SECTION_IDS = ['habits', 'areas', 'goals'] as const;
const PRELOAD_SECONDARY_SECTION_IDS = [
  'someday',
  'cabinet',
  'vision',
  'purpose',
] as const;

type UseSidebarWorkspaceLifecycleArgs = {
  currentFolder: string | null;
  rootPath: string | null;
  projects: GTDProject[] | null | undefined;
  checkGTDSpace: (path: string) => Promise<boolean>;
  loadProjects: (path: string) => Promise<GTDProject[]>;
  loadProjectActions: (
    projectPath: string,
    options?: SidebarProjectActionLoadOptions
  ) => Promise<void>;
  resolveSectionLoadPaths: (
    sectionIds: readonly string[],
    root: string
  ) => Promise<string[]>;
  loadSectionFiles: (sectionPath: string, force?: boolean) => Promise<unknown>;
  data: Pick<
    SidebarDataState,
    | 'projectActions'
    | 'projectLoading'
    | 'resetDataState'
    | 'lastRootRef'
    | 'projectsHydratedRef'
    | 'preloadedRef'
    | 'workspaceGenerationRef'
  >;
  overlays: Pick<SidebarOverlayState, 'resetOverlays'>;
};

export function useSidebarWorkspaceLifecycle({
  currentFolder,
  rootPath,
  projects,
  checkGTDSpace,
  loadProjects,
  loadProjectActions,
  resolveSectionLoadPaths,
  loadSectionFiles,
  data,
  overlays,
}: UseSidebarWorkspaceLifecycleArgs): void {
  const {
    projectActions,
    projectLoading,
    resetDataState,
    lastRootRef,
    projectsHydratedRef,
    preloadedRef,
    workspaceGenerationRef,
  } = data;
  const { resetOverlays } = overlays;

  React.useEffect(() => {
    const pathToCheck = rootPath;
    const normalizedRoot = norm(pathToCheck) ?? null;
    const normalizedCurrent = normalizeSidebarPath(currentFolder);
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
      if (lastRootRef.current !== normalizedRoot) {
        workspaceGenerationRef.current += 1;
        preloadedRef.current = false;
        lastRootRef.current = normalizedRoot;
        resetDataState();
        resetOverlays();
      }

      const isGTD = await checkGTDSpace(pathToCheck);
      if (!isGTD || cancelled) return;

      if ((projects?.length ?? 0) > 0) {
        projectsHydratedRef.current = true;
      }

      if (!projects || !projectsHydratedRef.current) {
        let projectsLoadFailed = false;
        try {
          await loadProjects(pathToCheck);
        } catch {
          projectsLoadFailed = true;
        } finally {
          if (!cancelled) {
            projectsHydratedRef.current = true;
          }
        }
        if (cancelled) return;
        if (projectsLoadFailed) return;
      }

      if (!preloadedRef.current) {
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
        if (cancelled) return;

        preloadedRef.current = true;
      }
    };

    void preload();

    return () => {
      cancelled = true;
    };
  }, [
    checkGTDSpace,
    currentFolder,
    lastRootRef,
    loadProjects,
    loadSectionFiles,
    preloadedRef,
    projects,
    projectsHydratedRef,
    resetDataState,
    resetOverlays,
    resolveSectionLoadPaths,
    rootPath,
    workspaceGenerationRef,
  ]);

  React.useEffect(() => {
    if (!projects || projects.length === 0) return;

    const missingProjects = projects.filter((project) => {
      const normalizedKey =
        normalizeSidebarPath(project.path) ?? project.path.replace(/\\/g, '/');
      return !projectActions[normalizedKey] && !projectLoading[normalizedKey];
    });
    if (missingProjects.length === 0) return;

    void Promise.all(missingProjects.map((project) => loadProjectActions(project.path)));
  }, [loadProjectActions, projectActions, projectLoading, projects]);
}
