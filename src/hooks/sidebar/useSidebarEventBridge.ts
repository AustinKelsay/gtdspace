import React from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import {
  onContentChange,
  onContentSaved,
  onMetadataChange,
} from '@/utils/content-event-bus';
import type {
  SidebarEventBridgeDeps,
} from '@/hooks/sidebar/types';
import {
  classifySidebarPath,
  extractParentFolder,
  normalizeSidebarPath,
} from '@/hooks/sidebar/path-classification';
import type { FileOperationResult, GTDProject } from '@/types';
import { norm } from '@/utils/path';

const RELOAD_SECTION_IDS = [
  'someday',
  'cabinet',
  'habits',
  'areas',
  'goals',
  'vision',
  'purpose',
] as const;
const RELOAD_SECTION_ID_SET = new Set<string>(RELOAD_SECTION_IDS);

function getDueDateFromMetadata(metadata: Record<string, unknown>): string | undefined {
  const dueDate = metadata.dueDate;
  if (typeof dueDate === 'string') {
    return dueDate;
  }

  const dueDateSnakeCase = metadata.due_date;
  if (typeof dueDateSnakeCase === 'string') {
    return dueDateSnakeCase;
  }

  const datetime = metadata.datetime;
  if (typeof datetime === 'string') {
    return datetime;
  }

  const datetimeSnakeCase = metadata.date_time;
  return typeof datetimeSnakeCase === 'string' ? datetimeSnakeCase : undefined;
}

export function useSidebarEventBridge({
  rootPath,
  withErrorHandling,
  loadProjects,
  loadProjectActions,
  loadSectionFiles,
  overlays,
  ui,
  data,
}: SidebarEventBridgeDeps): void {
  const {
    setActionStatuses,
    updateProjectOverlay,
    updateActionOverlay,
    updateSectionFileOverlay,
    removeProjectOverlay,
    removeActionOverlay,
    removeSectionFileOverlay,
  } = overlays;
  const { setExpandedProjects } = ui;
  const { setPendingProjects, setProjectActions } = data;

  React.useEffect(() => {
    const unsubscribeMetadata = onMetadataChange((event) => {
      const { filePath, metadata, changedFields } = event;
      const pathMatch = classifySidebarPath(filePath, rootPath);

      if (pathMatch.kind === 'project-readme' && pathMatch.projectPath) {
        if (changedFields?.status || changedFields?.projectStatus) {
          const nextStatus = metadata.projectStatus || metadata.status;
          if (nextStatus) {
            updateProjectOverlay(pathMatch.projectPath, { status: String(nextStatus) });
          } else {
            updateProjectOverlay(pathMatch.projectPath, { status: '' });
          }
        }

        if (
          changedFields?.due_date ||
          changedFields?.dueDate ||
          changedFields?.datetime ||
          changedFields?.date_time
        ) {
          const nextDue = getDueDateFromMetadata(metadata as Record<string, unknown>);
          if (typeof nextDue === 'string') {
            updateProjectOverlay(pathMatch.projectPath, { due_date: nextDue });
          } else {
            updateProjectOverlay(pathMatch.projectPath, { due_date: undefined });
          }
        }
      }

      if (pathMatch.kind === 'project-action') {
        if (changedFields?.status) {
          const nextStatus = metadata.status ? String(metadata.status) : '';
          setActionStatuses((prev) => {
            const next = { ...prev };
            if (nextStatus) {
              next[pathMatch.normalizedPath] = nextStatus;
            } else {
              delete next[pathMatch.normalizedPath];
            }
            return next;
          });
          updateActionOverlay(pathMatch.normalizedPath, {
            status: nextStatus || undefined,
          });
        }

        if (
          changedFields?.due_date ||
          changedFields?.dueDate ||
          changedFields?.datetime ||
          changedFields?.date_time
        ) {
          const nextDue = getDueDateFromMetadata(metadata as Record<string, unknown>);
          updateActionOverlay(pathMatch.normalizedPath, {
            due_date: typeof nextDue === 'string' ? nextDue : undefined,
          });
        }
      }

      if (
        pathMatch.kind === 'section-file' &&
        pathMatch.sectionId &&
        RELOAD_SECTION_ID_SET.has(pathMatch.sectionId)
      ) {
        const folderPath =
          pathMatch.sectionPath ?? extractParentFolder(pathMatch.normalizedPath);
        if (folderPath) {
          void loadSectionFiles(folderPath, true);
        }
      }
    });

    const unsubscribeChanged = onContentChange((event) => {
      const { filePath, metadata, changedFields } = event;
      const pathMatch = classifySidebarPath(filePath, rootPath);

      if (pathMatch.kind === 'project-readme' && pathMatch.projectPath) {
        if (
          changedFields?.dueDate ||
          changedFields?.due_date ||
          changedFields?.datetime ||
          changedFields?.date_time
        ) {
          const nextDue = getDueDateFromMetadata(metadata as Record<string, unknown>);
          if (typeof nextDue === 'string') {
            updateProjectOverlay(pathMatch.projectPath, { due_date: nextDue });
          } else {
            updateProjectOverlay(pathMatch.projectPath, { due_date: undefined });
          }
        }
      }
    });

    const unsubscribeSaved = onContentSaved(async (event) => {
      const { filePath, metadata } = event;
      const pathMatch = classifySidebarPath(filePath, rootPath);

      if (pathMatch.kind === 'project-readme' && pathMatch.projectPath) {
        let effectiveProjectPath = pathMatch.projectPath;
        const nextTitle = metadata.title;

        if (nextTitle) {
          const currentProjectName = pathMatch.projectPath.split('/').pop();

          if (currentProjectName && currentProjectName !== nextTitle) {
            await withErrorHandling(async () => {
              const newProjectPath = await safeInvoke<string>(
                'rename_gtd_project',
                {
                  oldProjectPath: pathMatch.projectPath,
                  newProjectName: nextTitle,
                },
                null
              );
              if (!newProjectPath || typeof newProjectPath !== 'string') {
                throw new Error('rename_gtd_project failed');
              }

              const normalizedNewProjectPath =
                normalizeSidebarPath(newProjectPath) ?? newProjectPath;
              effectiveProjectPath = normalizedNewProjectPath;
              updateProjectOverlay(pathMatch.projectPath, {
                title: String(nextTitle),
                currentPath: normalizedNewProjectPath,
              });
              updateProjectOverlay(normalizedNewProjectPath, {
                title: String(nextTitle),
                currentPath: normalizedNewProjectPath,
              });

              setExpandedProjects((prev) =>
                prev.map((path) =>
                  path === pathMatch.projectPath ? normalizedNewProjectPath : path
                )
              );
              setProjectActions((prev) => {
                if (!prev[pathMatch.projectPath]) {
                  return prev;
                }

                const {
                  [pathMatch.projectPath]: existingActions,
                  ...rest
                } = prev;

                return {
                  ...rest,
                  [normalizedNewProjectPath]: existingActions,
                };
              });

              if (pathMatch.projectPath !== normalizedNewProjectPath) {
                removeProjectOverlay(pathMatch.projectPath);
                setProjectActions((prev) => {
                  const next = { ...prev };
                  delete next[pathMatch.projectPath!];
                  return next;
                });
              }

              window.dispatchEvent(
                new CustomEvent('project-renamed', {
                  detail: {
                    oldPath: pathMatch.projectPath,
                    newPath: normalizedNewProjectPath,
                    newName: nextTitle,
                  },
                })
              );
            }, 'Failed to rename project', 'workspace-sidebar');
          }
        }

        const nextDue = getDueDateFromMetadata(metadata as Record<string, unknown>);
        if (typeof nextDue === 'string') {
          updateProjectOverlay(effectiveProjectPath, { due_date: nextDue });
        } else {
          updateProjectOverlay(effectiveProjectPath, { due_date: undefined });
        }

        if (rootPath) {
          await loadProjects(rootPath);
        }
      }

      if (pathMatch.kind === 'project-action') {
        const nextTitle = metadata.title;
        if (nextTitle) {
          const currentActionName = pathMatch.normalizedPath
            .split('/')
            .pop()
            ?.replace(/\.(md|markdown)$/i, '');
          if (currentActionName && currentActionName !== nextTitle) {
            await withErrorHandling(async () => {
              const newActionPath = await safeInvoke<string>(
                'rename_gtd_action',
                {
                  oldActionPath: pathMatch.normalizedPath,
                  newActionName: nextTitle,
                },
                null
              );
              if (!newActionPath || typeof newActionPath !== 'string') {
                throw new Error('rename_gtd_action failed');
              }

              const normalizedNewActionPath =
                normalizeSidebarPath(newActionPath) ?? newActionPath;
              updateActionOverlay(pathMatch.normalizedPath, {
                title: String(nextTitle),
                currentPath: normalizedNewActionPath,
              });
              updateActionOverlay(normalizedNewActionPath, {
                title: String(nextTitle),
                currentPath: normalizedNewActionPath,
              });

              if (pathMatch.projectPath) {
                await loadProjectActions(pathMatch.projectPath);
              }
              removeActionOverlay(pathMatch.normalizedPath);

              window.dispatchEvent(
                new CustomEvent('action-renamed', {
                  detail: {
                    oldPath: pathMatch.normalizedPath,
                    newPath: normalizedNewActionPath,
                    newName: nextTitle,
                  },
                })
              );
              window.dispatchEvent(
                new CustomEvent('file-renamed', {
                  detail: {
                    oldPath: pathMatch.normalizedPath,
                    newPath: normalizedNewActionPath,
                  },
                })
              );
            }, 'Failed to rename action', 'workspace-sidebar');
          }
        }
      }

      if (
        pathMatch.kind === 'section-file' &&
        pathMatch.sectionId &&
        RELOAD_SECTION_ID_SET.has(pathMatch.sectionId)
      ) {
        const nextTitle = metadata.title;

        if (nextTitle) {
          const currentFileName = pathMatch.normalizedPath
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
                { oldPath: pathMatch.normalizedPath, newName: nextTitle },
                null
              );
              if (!renameResult?.success || !renameResult.path) {
                throw new Error(renameResult?.message || 'rename_file failed');
              }
              const newFilePath = renameResult.path;

              const normalizedNewFilePath =
                normalizeSidebarPath(newFilePath) ?? newFilePath;
              updateSectionFileOverlay(pathMatch.normalizedPath, {
                title: String(nextTitle),
                currentPath: normalizedNewFilePath,
              });
              updateSectionFileOverlay(normalizedNewFilePath, {
                title: String(nextTitle),
                currentPath: normalizedNewFilePath,
              });

              const folderPath =
                pathMatch.sectionPath ?? extractParentFolder(pathMatch.normalizedPath);
              if (folderPath) {
                await loadSectionFiles(folderPath, true);
              }
              removeSectionFileOverlay(pathMatch.normalizedPath);

              window.dispatchEvent(
                new CustomEvent('section-file-renamed', {
                  detail: {
                    oldPath: pathMatch.normalizedPath,
                    newPath: normalizedNewFilePath,
                    newName: nextTitle,
                  },
                })
              );
              window.dispatchEvent(
                new CustomEvent('file-renamed', {
                  detail: {
                    oldPath: pathMatch.normalizedPath,
                    newPath: normalizedNewFilePath,
                  },
                })
              );
            }, 'Failed to rename file', 'workspace-sidebar');
          }
        }
      }
    });

    const handleProjectCreated = async (event: Event) => {
      try {
        const customEvent = event as CustomEvent<{
          projectPath?: string;
          projectName?: string;
        }>;
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
              (project) =>
                (norm(project.path) ?? project.path) ===
                (norm(optimistic.path) ?? optimistic.path)
            )
              ? prev
              : [...prev, optimistic]
          );
        }

        if (rootPath) {
          const projects = await loadProjects(rootPath);
          setPendingProjects((prev) =>
            prev.filter(
              (project) =>
                !projects.some(
                  (loaded) =>
                    (norm(loaded.path) ?? loaded.path) ===
                    (norm(project.path) ?? project.path)
                )
            )
          );
        }
      } catch (error) {
        console.error('handleProjectCreated error:', error);
      }
    };

    const handleActionCreated = async (event: Event) => {
      try {
        const customEvent = event as CustomEvent<{ projectPath?: string }>;
        const projectPath = customEvent.detail?.projectPath;
        if (!projectPath) return;

        await loadProjectActions(projectPath);
        if (rootPath) {
          await loadProjects(rootPath);
        }
      } catch (error) {
        console.error('handleActionCreated error:', error);
      }
    };

    window.addEventListener('gtd-project-created', handleProjectCreated as EventListener);
    window.addEventListener('gtd-action-created', handleActionCreated as EventListener);

    return () => {
      unsubscribeMetadata();
      unsubscribeChanged();
      unsubscribeSaved();
      window.removeEventListener(
        'gtd-project-created',
        handleProjectCreated as EventListener
      );
      window.removeEventListener(
        'gtd-action-created',
        handleActionCreated as EventListener
      );
    };
  }, [
    loadProjectActions,
    loadProjects,
    loadSectionFiles,
    removeActionOverlay,
    removeProjectOverlay,
    removeSectionFileOverlay,
    rootPath,
    setActionStatuses,
    setExpandedProjects,
    setPendingProjects,
    setProjectActions,
    updateActionOverlay,
    updateProjectOverlay,
    updateSectionFileOverlay,
    withErrorHandling,
  ]);
}
