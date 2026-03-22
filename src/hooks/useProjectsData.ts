/**
 * @fileoverview Hook for loading projects with enhanced metadata including horizon linkages
 * Provides comprehensive project data with relationships to GTD horizons
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { readFileText } from './useFileManager';
import type { GTDProject, MarkdownFile } from '@/types';
import { toISOStringFromEpoch } from '@/utils/time';
import { parseLocalDate } from '@/utils/date-formatting';
import { migrateGTDObjects } from '@/utils/data-migration';
import { parseActionMarkdown } from '@/utils/gtd-action-markdown';
import { emitContentSaved, emitMetadataChange } from '@/utils/content-event-bus';
import { extractMetadata } from '@/utils/metadata-extractor';
import { norm } from '@/utils/path';
import {
  parseProjectMarkdown,
  toDateOnly,
} from '@/utils/gtd-project-content';
import { buildProjectMarkdown } from '@/utils/gtd-markdown-helpers';
import { normalizeProjectStatus } from '@/utils/gtd-status';

const PROJECT_TITLE_PATTERN = /^#\s+.*$/m;
const PROJECT_STATUS_PATTERN = /\[!singleselect:project-status:[^\]]*\]/i;
const PROJECT_DUE_DATE_PATTERN = /\[!datetime:due_date:[^\]]*\]/i;

const updateProjectTitleInMarkdown = (content: string, title: string): string => {
  const nextTitle = title.trim() || 'Untitled Project';
  if (PROJECT_TITLE_PATTERN.test(content)) {
    return content.replace(PROJECT_TITLE_PATTERN, `# ${nextTitle}`);
  }
  return `# ${nextTitle}\n\n${content.trimStart()}`;
};

const updateProjectStatusInMarkdown = (content: string, status: string): string => {
  if (PROJECT_STATUS_PATTERN.test(content)) {
    return content.replace(PROJECT_STATUS_PATTERN, `[!singleselect:project-status:${status}]`);
  }

  const titleMatch = content.match(/^#\s+.+$/m);
  if (titleMatch && titleMatch.index !== undefined) {
    const titleEndIndex = titleMatch.index + titleMatch[0].length;
    return (
      content.slice(0, titleEndIndex) +
      `\n[!singleselect:project-status:${status}]` +
      content.slice(titleEndIndex)
    );
  }

  return `# Untitled Project\n[!singleselect:project-status:${status}]\n\n${content.trimStart()}`;
};

const updateProjectDueDateInMarkdown = (content: string, dueDate: string): string => {
  if (PROJECT_DUE_DATE_PATTERN.test(content)) {
    if (!dueDate.trim()) {
      return content
        .replace(PROJECT_DUE_DATE_PATTERN, '')
        .replace(/\n{3,}/g, '\n\n');
    }
    return content.replace(PROJECT_DUE_DATE_PATTERN, `[!datetime:due_date:${dueDate}]`);
  }
  return content;
};

export interface ProjectWithMetadata extends GTDProject {
  linkedAreas?: string[];
  linkedGoals?: string[];
  linkedVision?: string[];
  linkedPurpose?: string[];
  completionPercentage?: number;
  actionStats?: {
    total: number;
    completed: number;
    inProgress: number;
    waiting: number;
    cancelled: number;
  };
  effort?: string;
  priority?: string;
  notes?: string;
  outcomes?: string[];
}

export type PersistedProjectUpdates = Partial<
  Pick<ProjectWithMetadata, 'name' | 'status' | 'dueDate'>
>;

const isSyntheticProjectTitle = (title?: string | null): boolean =>
  !title || /^Untitled(?: Project)?$/i.test(title.trim());

interface UseProjectsDataOptions {
  autoLoad?: boolean;
  includeArchived?: boolean;
  loadActionStats?: boolean;
}

interface UseProjectsDataReturn {
  projects: ProjectWithMetadata[];
  isLoading: boolean;
  error: string | null;
  summary: {
    total: number;
    active: number;
    waiting: number;
    completed: number;
    cancelled: number;
    overdue: number;
    withoutHorizons: number;
    byArea: Record<string, number>;
  };
  loadProjects: (spacePath: string) => Promise<void>;
  updateProject: (projectPath: string, updates: PersistedProjectUpdates) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Extract project outcomes from content
 */
const extractOutcomes = (content: string): string[] => {
  const outcomes: string[] = [];
  
  // Look for outcomes section
  const outcomesMatch = content.match(/##\s*Outcomes?\s*\n([\s\S]*?)(?:\n##|\n\[!|$)/i);
  if (outcomesMatch && outcomesMatch[1]) {
    const lines = outcomesMatch[1].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\.\s/)) {
        outcomes.push(trimmed.replace(/^[-*]\s+|\d+\.\s+/, '').trim());
      }
    }
  }
  
  return outcomes;
};

/**
 * Helper function to check if a file exists using Tauri command
 */
const checkFileExists = async (filePath: string): Promise<boolean> => {
  try {
    return await safeInvoke<boolean>('check_file_exists', { filePath }, false);
  } catch (error) {
    console.error('[checkFileExists] Failed to check file existence:', error);
    return false;
  }
};

/**
 * Helper function to resolve project README file path
 * Checks for both README.md and README.markdown using proper file existence check
 * @returns The path of the existing README file, or null if neither exists
 */
const resolveProjectReadme = async (projectPath: string): Promise<string | null> => {
  const mdPath = `${projectPath}/README.md`;
  const markdownPath = `${projectPath}/README.markdown`;

  // Check README.md first
  if (await checkFileExists(mdPath)) {
    return mdPath;
  }

  // Check README.markdown
  if (await checkFileExists(markdownPath)) {
    return markdownPath;
  }

  return null;
};

export function useProjectsData(options: UseProjectsDataOptions = {}): UseProjectsDataReturn {
  const {
    autoLoad = false,
    includeArchived = false,
    loadActionStats = true
  } = options;

  const [projects, setProjects] = useState<ProjectWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedSpacePath, setCachedSpacePath] = useState<string>('');

  const loadProjects = useCallback(async (spacePath: string) => {
    setIsLoading(true);
    setError(null);
    const normalizedSpacePath = spacePath.trim();
    setCachedSpacePath(normalizedSpacePath);
    
    try {
      let workspaceExists = await safeInvoke<boolean>('check_directory_exists', { path: normalizedSpacePath }, null);
      if (workspaceExists === false) {
        await safeInvoke<string>('initialize_gtd_space', { spacePath: normalizedSpacePath }, null);
        workspaceExists = await safeInvoke<boolean>('check_directory_exists', { path: normalizedSpacePath }, null);
      }

      if (workspaceExists === false) {
        throw new Error(`Workspace path does not exist: ${normalizedSpacePath}`);
      }

      let projectsDirExists = await safeInvoke<boolean>(
        'check_directory_exists',
        { path: `${normalizedSpacePath}/Projects` },
        null
      );

      if (projectsDirExists === false) {
        await safeInvoke<string>('initialize_gtd_space', { spacePath: normalizedSpacePath }, null);
        projectsDirExists = await safeInvoke<boolean>(
          'check_directory_exists',
          { path: `${normalizedSpacePath}/Projects` },
          null
        );
      }

      if (projectsDirExists === false) {
        throw new Error(`Projects directory is missing under ${normalizedSpacePath}`);
      }

      // Load base projects via backend if available; otherwise fallback to scanning Projects folder
      const invokedProjects = await safeInvoke<GTDProject[]>(
        'list_gtd_projects',
        { spacePath: normalizedSpacePath },
        []
      );

      let baseProjects = migrateGTDObjects(invokedProjects ?? []);

      if (baseProjects.length === 0) {
        // Fallback: build projects from README.md files under spacePath/Projects
        try {
          const projectsRoot = `${normalizedSpacePath}/Projects`;
          const files = await safeInvoke<MarkdownFile[]>(
            'list_markdown_files',
            { path: projectsRoot },
            []
          );
          const readmes = files.filter((f) => {
            const normalizedFilePath = norm(f.path);
            return (
              typeof normalizedFilePath === 'string' &&
              /\/Projects\/.+\/README\.(md|markdown)$/i.test(normalizedFilePath)
            );
          });
          baseProjects = await Promise.all(readmes.map(async (f) => {
            const normalizedFilePath = norm(f.path) ?? f.path;
            const projectPath = normalizedFilePath.replace(/\/README\.(md|markdown)$/i, '');
            const normalizedProjectPath = norm(projectPath) ?? projectPath;
            const name = normalizedProjectPath.split('/').filter(Boolean).pop() || 'Project';
            let description = '';
            let status: GTDProject['status'] = 'in-progress';
            let dueDate: string | null | undefined = undefined;
            try {
              const content = await readFileText(f.path);
              const parsedProject = parseProjectMarkdown(content);
              description = '';
              status = parsedProject.status;
              if (parsedProject.dueDate) dueDate = parsedProject.dueDate;
            } catch {
              // Ignore content parsing errors in fallback
            }
            const created = toISOStringFromEpoch(f.last_modified);
            const base: GTDProject = {
              name,
              description,
              dueDate: dueDate || null,
              status,
              path: projectPath,
              createdDateTime: created,
              action_count: undefined
            };
            return base;
          }));
        } catch (fallbackErr) {
          console.error('[useProjectsData] Fallback project scan failed:', fallbackErr);
          baseProjects = [];
        }
      }
      
      // Filter archived if needed
      const filteredProjects = includeArchived 
        ? baseProjects
        : baseProjects.filter(p => !p.path.includes('/Archive/'));
      
      // Enhance each project with metadata
      const enhancedProjects = await Promise.all(
        filteredProjects.map(async (project) => {
          try {
            const readmePath = await resolveProjectReadme(project.path);
            let parsedProject = null as ReturnType<typeof parseProjectMarkdown> | null;
            let outcomes: string[] = [];

            if (readmePath) {
              const content = await readFileText(readmePath);
              parsedProject = parseProjectMarkdown(content);
              outcomes = extractOutcomes(content);
            }
            
            // Load action stats if requested
            let actionStats = undefined;
            let completionPercentage = 0;
            
            if (loadActionStats) {
              try {
                const actionFiles = await safeInvoke<MarkdownFile[]>(
                  'list_project_actions',
                  { projectPath: project.path },
                  []
                );
                
                const stats = {
                  total: actionFiles.length,
                  completed: 0,
                  inProgress: 0,
                  waiting: 0,
                  cancelled: 0
                };
                
                // Count action statuses
                await Promise.all(actionFiles.map(async (file) => {
                  try {
                    const actionContent = await readFileText(file.path);
                    const status = parseActionMarkdown(actionContent).status;

                    if (status === 'completed') stats.completed++;
                    else if (status === 'waiting') stats.waiting++;
                    else if (status === 'cancelled') stats.cancelled++;
                    else stats.inProgress++;
                  } catch {
                    // Ignore individual action errors
                  }
                }));
                
                actionStats = stats;
                completionPercentage = stats.total > 0
                  ? Math.round((stats.completed / stats.total) * 100)
                  : 0;
              } catch (err) {
                console.error(`Failed to load action stats for ${project.name}:`, err);
              }
            }
            
            const enhanced: ProjectWithMetadata = {
              ...project,
              name:
                parsedProject?.title && !isSyntheticProjectTitle(parsedProject.title)
                  ? parsedProject.title
                  : project.name,
              status: parsedProject?.status ?? normalizeProjectStatus(project.status),
              dueDate: parsedProject?.dueDate !== undefined ? parsedProject.dueDate : project.dueDate,
              linkedAreas: parsedProject?.horizonReferences.areas ?? [],
              linkedGoals: parsedProject?.horizonReferences.goals ?? [],
              linkedVision: parsedProject?.horizonReferences.vision ?? [],
              linkedPurpose: parsedProject?.horizonReferences.purpose ?? [],
              completionPercentage,
              actionStats,
              effort: undefined,
              priority: undefined,
              notes: parsedProject?.additionalContent,
              outcomes
            };
            
            return enhanced;
          } catch (err) {
            console.error(`Failed to enhance project ${project.name}:`, err);
            return project as ProjectWithMetadata;
          }
        })
      );
      
      setProjects(enhancedProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [includeArchived, loadActionStats]);
  
  const updateProject = useCallback(async (
    projectPath: string,
    updates: PersistedProjectUpdates
  ) => {
    try {
      let readmePath = await resolveProjectReadme(projectPath);
      const hadExistingReadme = Boolean(readmePath);
      let content: string;
      if (!readmePath) {
        readmePath = `${projectPath}/README.md`;
        const normalizedProjectPath = norm(projectPath) ?? projectPath;
        const projectName = normalizedProjectPath.split('/').filter(Boolean).pop() || 'Project';
        content = buildProjectMarkdown({
          title: projectName,
          status: normalizeProjectStatus(
            typeof updates.status === 'string' ? updates.status : 'in-progress'
          ),
          dueDate: typeof updates.dueDate === 'string' ? toDateOnly(updates.dueDate) : '',
          desiredOutcome: '',
          horizonReferences: { areas: [], goals: [], vision: [], purpose: [] },
          references: [],
          createdDateTime: new Date().toISOString(),
          includeHabitsList: true,
          additionalContent: '',
        });
      } else {
        content = await readFileText(readmePath);
      }

      const parsedProject = parseProjectMarkdown(content);
      const nextTitle =
        typeof updates.name === 'string' && updates.name.trim()
          ? updates.name.trim()
          : isSyntheticProjectTitle(parsedProject.title)
            ? (norm(projectPath) ?? projectPath).split('/').filter(Boolean).pop() || 'Project'
            : parsedProject.title;
      const nextStatus =
        typeof updates.status === 'string'
          ? normalizeProjectStatus(updates.status)
          : parsedProject.status;
      const nextDueDate =
        updates.dueDate !== undefined
          ? toDateOnly(updates.dueDate)
          : parsedProject.dueDate;

      const nextContent = hadExistingReadme
        ? updateProjectDueDateInMarkdown(
            updateProjectStatusInMarkdown(
              updateProjectTitleInMarkdown(content, nextTitle),
              nextStatus
            ),
            nextDueDate ?? ''
          )
        : buildProjectMarkdown({
            title: nextTitle,
            status: nextStatus,
            dueDate: nextDueDate,
            desiredOutcome: parsedProject.desiredOutcome,
            horizonReferences: parsedProject.horizonReferences,
            references: parsedProject.references,
            createdDateTime: parsedProject.createdDateTime,
            includeHabitsList: parsedProject.includeHabitsList,
            additionalContent: parsedProject.additionalContent,
          });
      
      const writeResult = await safeInvoke('save_file', {
        path: readmePath,
        content: nextContent
      }, null);

      // Check if write succeeded
      if (!writeResult) {
        console.error('[updateProjectStatus] Failed to write file');
        throw new Error('Failed to save project changes');
      }

      const metadata = extractMetadata(nextContent);
      const fileName = (norm(readmePath) ?? readmePath).split('/').pop() || 'README.md';
      try {
        emitMetadataChange({
          filePath: readmePath,
          fileName,
          content: nextContent,
          metadata,
        });
        emitContentSaved({
          filePath: readmePath,
          fileName,
          content: nextContent,
          metadata,
        });
        window.onTabFileSaved?.(readmePath, fileName, nextContent, metadata);
      } catch (notificationError) {
        console.error('Failed to notify project update listeners:', notificationError);
      }

      // Update local state
      const canonicalProjectPath = norm(projectPath) ?? projectPath;
      const nextParsedProject = parseProjectMarkdown(nextContent);
      setProjects(prev => prev.map((project) => {
        if ((norm(project.path) ?? project.path) !== canonicalProjectPath) {
          return project;
        }

        return {
          ...project,
          name:
            nextParsedProject.title && !isSyntheticProjectTitle(nextParsedProject.title)
              ? nextParsedProject.title
              : project.name,
          status: nextParsedProject.status,
          dueDate: nextParsedProject.dueDate || null,
        };
      }));
    } catch (err) {
      console.error('Failed to update project:', err);
      throw err;
    }
  }, []);
  
  const refresh = useCallback(async () => {
    if (cachedSpacePath) {
      await loadProjects(cachedSpacePath);
    }
  }, [cachedSpacePath, loadProjects]);
  
  const summary = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const byArea: Record<string, number> = {};
    let overdue = 0;
    let withoutHorizons = 0;
    
    const statusCounts = {
      total: projects.length,
      active: 0,
      waiting: 0,
      completed: 0,
      cancelled: 0
    };
    
    projects.forEach(project => {
      // Count by status
      switch (project.status) {
        case 'in-progress':
          statusCounts.active++;
          break;
        case 'waiting':
          statusCounts.waiting++;
          break;
        case 'completed':
          statusCounts.completed++;
          break;
        case 'cancelled':
          statusCounts.cancelled++;
          break;
      }
      
      // Check overdue
      if (project.dueDate && project.status !== 'completed' && project.status !== 'cancelled') {
        const dueDate = parseLocalDate(project.dueDate);
        if (!isNaN(dueDate.getTime()) && dueDate < today) {
          overdue++;
        }
      }
      
      // Count by area
      if (project.linkedAreas && project.linkedAreas.length > 0) {
        project.linkedAreas.forEach(area => {
          byArea[area] = (byArea[area] || 0) + 1;
        });
      } else {
        withoutHorizons++;
      }
    });
    
    return {
      ...statusCounts,
      overdue,
      withoutHorizons,
      byArea
    };
  }, [projects]);
  
  // Auto-load if specified
  useEffect(() => {
    if (autoLoad && cachedSpacePath) {
      loadProjects(cachedSpacePath);
    }
  }, [autoLoad, cachedSpacePath, loadProjects]);
  
  return {
    projects,
    isLoading,
    error,
    summary,
    loadProjects,
    updateProject,
    refresh
  };
}
