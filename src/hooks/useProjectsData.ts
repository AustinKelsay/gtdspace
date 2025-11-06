/**
 * @fileoverview Hook for loading projects with enhanced metadata including horizon linkages
 * Provides comprehensive project data with relationships to GTD horizons
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { extractMetadata, extractHorizonReferences as extractHorizonReferencesUtil } from '@/utils/metadata-extractor';
import { readFileText } from './useFileManager';
import type { GTDProject, GTDProjectStatus, MarkdownFile } from '@/types';
import { toISOStringFromEpoch } from '@/utils/time';
import { parseLocalDate } from '@/utils/date-formatting';
import { migrateGTDObjects } from '@/utils/data-migration';

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
  updateProject: (projectPath: string, updates: Partial<ProjectWithMetadata>) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Normalize project status values
 */
const normalizeProjectStatus = (status: string): GTDProjectStatus => {
  const normalized = status.toLowerCase().trim();
  
  if (['cancelled', 'canceled', 'abandoned', 'dropped', 'cancel'].includes(normalized)) {
    return 'cancelled';
  }
  
  if (['in-progress', 'active', 'ongoing'].includes(normalized)) {
    return 'in-progress';
  }
  
  if (['waiting', 'on-hold', 'paused', 'blocked'].includes(normalized)) {
    return 'waiting';
  }
  
  if (['completed', 'done', 'finished', 'complete'].includes(normalized)) {
    return 'completed';
  }
  
  return 'in-progress';
};

/**
 * Normalize action status values (actions accept an additional "cancelled" state)
 */
const normalizeActionStatus = (status: string): 'in-progress' | 'waiting' | 'completed' | 'cancelled' => {
  const normalized = status.toLowerCase().trim();

  if (['cancelled', 'canceled', 'abandoned', 'dropped'].includes(normalized)) {
    return 'cancelled';
  }
  if (['completed', 'done', 'finished'].includes(normalized)) {
    return 'completed';
  }
  if (['waiting', 'blocked', 'on-hold', 'paused'].includes(normalized)) {
    return 'waiting';
  }
  // default and common synonyms
  return 'in-progress';
};

/**
 * Extract horizon references from content
 */
const extractHorizonReferences = (content: string) => {
  const refs = extractHorizonReferencesUtil(content);
  return {
    areas: refs.areas,
    goals: refs.goals,
    vision: refs.vision,
    purpose: refs.purpose
  };
};

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
          const readmes = files.filter(f => /\/Projects\/.+\/README\.(md|markdown)$/i.test(f.path));
          baseProjects = await Promise.all(readmes.map(async (f) => {
            const projectPath = f.path.replace(/\/README\.(md|markdown)$/i, '');
            const name = projectPath.split('/').filter(Boolean).pop() || 'Project';
            let description = '';
            let status: GTDProject['status'] = 'in-progress';
            let dueDate: string | null | undefined = undefined;
            try {
              const content = await readFileText(f.path);
              const metadata = extractMetadata(content);
              if (typeof metadata.title === 'string') {
                // Prefer explicit title if present
              }
              description = '';
              const normalized = (metadata.projectStatus || metadata.status || 'in-progress') as string;
              status = normalizeProjectStatus(normalized) as GTDProject['status'];
              if (typeof metadata.dueDate === 'string') dueDate = metadata.dueDate;
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
            // Resolve and read project README
            const readmePath = await resolveProjectReadme(project.path);

            // Default values for when no README exists
            let metadata: Record<string, any> = {};
            let horizonRefs = { areas: [], goals: [], vision: [], purpose: [] };
            let outcomes: string[] = [];

            if (readmePath) {
              const content = await readFileText(readmePath);
              metadata = extractMetadata(content);

              // Extract horizon references
              horizonRefs = extractHorizonReferences(content);

              // Extract outcomes
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
                    const actionMeta = extractMetadata(actionContent);
                    const status = normalizeActionStatus((actionMeta.status as string) || 'in-progress');

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
              status: normalizeProjectStatus(metadata.projectStatus || metadata.status || project.status) as GTDProject['status'],
              dueDate: metadata.dueDate as string || project.dueDate,
              linkedAreas: horizonRefs.areas,
              linkedGoals: horizonRefs.goals,
              linkedVision: horizonRefs.vision,
              linkedPurpose: horizonRefs.purpose,
              completionPercentage,
              actionStats,
              effort: metadata.effort as string | undefined,
              priority: metadata.priority as string | undefined,
              notes: metadata.notes as string | undefined,
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
    updates: Partial<ProjectWithMetadata>
  ) => {
    try {
      // Resolve README path, or use default if none exists
      let readmePath = await resolveProjectReadme(projectPath);

      // If no README exists, create a new one with default content
      let content: string;
      if (!readmePath) {
        readmePath = `${projectPath}/README.md`;
        const projectName = projectPath.split('/').filter(Boolean).pop() || 'Project';
        content = `# ${projectName}\n\n`;
      } else {
        content = await readFileText(readmePath);
      }

      // Helper function to inject marker after H1 or at top
      const injectMarker = (content: string, marker: string): string => {
        const lines = content.split('\n');
        const h1Index = lines.findIndex(line => line.startsWith('# '));

        if (h1Index !== -1) {
          // Insert after H1 (with blank line for readability)
          lines.splice(h1Index + 1, 0, '', marker);
        } else {
          // Prepend to top (with blank line after)
          lines.unshift(marker, '');
        }

        return lines.join('\n');
      };

      // Update status if provided
      if (updates.status) {
        if (content.includes('[!singleselect:project-status:')) {
          content = content.replace(
            /\[!singleselect:project-status:[^\]]+\]/,
            `[!singleselect:project-status:${updates.status}]`
          );
        } else if (content.includes('[!singleselect:status:')) {
          content = content.replace(
            /\[!singleselect:status:[^\]]+\]/,
            `[!singleselect:status:${updates.status}]`
          );
        } else {
          // No existing status marker, inject new one
          content = injectMarker(content, `[!singleselect:status:${updates.status}]`);
        }
      }

      // Update due date if provided
      if (updates.dueDate !== undefined) {
        if (content.includes('[!datetime:due_date:')) {
          content = content.replace(
            /\[!datetime:due_date:[^\]]*\]/,
            `[!datetime:due_date:${updates.dueDate || ''}]`
          );
        } else {
          // No existing due date marker, inject new one
          content = injectMarker(content, `[!datetime:due_date:${updates.dueDate || ''}]`);
        }
      }
      
      const writeResult = await safeInvoke('save_file', {
        path: readmePath,
        content
      }, null);

      // Check if write succeeded
      if (!writeResult) {
        console.error('[updateProjectStatus] Failed to write file');
        throw new Error('Failed to save project changes');
      }

      // Update local state
      setProjects(prev => prev.map(p =>
        p.path === projectPath ? { ...p, ...updates } : p
      ));
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
