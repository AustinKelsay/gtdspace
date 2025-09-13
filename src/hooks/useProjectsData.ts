/**
 * @fileoverview Hook for loading projects with enhanced metadata including horizon linkages
 * Provides comprehensive project data with relationships to GTD horizons
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { extractMetadata, extractHorizonReferences as extractHorizonReferencesUtil } from '@/utils/metadata-extractor';
import { readFileText } from './useFileManager';
import type { GTDProject, MarkdownFile } from '@/types';

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
const normalizeProjectStatus = (status: string): string => {
  const normalized = status.toLowerCase().trim();
  
  if (['in-progress', 'active', 'ongoing'].includes(normalized)) {
    return 'in-progress';
  }
  
  if (['waiting', 'on-hold', 'paused', 'blocked'].includes(normalized)) {
    return 'waiting';
  }
  
  if (['completed', 'done', 'finished'].includes(normalized)) {
    return 'completed';
  }
  
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
    setCachedSpacePath(spacePath);
    
    try {
      // Load base projects
      const baseProjects = await safeInvoke<GTDProject[]>(
        'load_projects',
        { path: spacePath },
        []
      );
      
      // Filter archived if needed
      const filteredProjects = includeArchived 
        ? baseProjects
        : baseProjects.filter(p => !p.path.includes('/Archive/'));
      
      // Enhance each project with metadata
      const enhancedProjects = await Promise.all(
        filteredProjects.map(async (project) => {
          try {
            // Read project README
            const readmePath = `${project.path}/README.md`;
            const content = await readFileText(readmePath);
            const metadata = extractMetadata(content);
            
            // Extract horizon references
            const horizonRefs = extractHorizonReferences(content);
            
            // Extract outcomes
            const outcomes = extractOutcomes(content);
            
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
                    const status = normalizeProjectStatus(actionMeta.status || 'in-progress');
                    
                    switch (status) {
                      case 'completed':
                        stats.completed++;
                        break;
                      case 'in-progress':
                        stats.inProgress++;
                        break;
                      case 'waiting':
                        stats.waiting++;
                        break;
                      default:
                        if (actionMeta.status?.toLowerCase() === 'cancelled') {
                          stats.cancelled++;
                        }
                    }
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
      const readmePath = `${projectPath}/README.md`;
      let content = await readFileText(readmePath);
      
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
        }
      }
      
      // Update due date if provided
      if (updates.dueDate !== undefined) {
        if (content.includes('[!datetime:due_date:')) {
          content = content.replace(
            /\[!datetime:due_date:[^\]]*\]/,
            `[!datetime:due_date:${updates.dueDate || ''}]`
          );
        }
      }
      
      await safeInvoke('write_file', {
        path: readmePath,
        content
      });
      
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
      completed: 0
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
      }
      
      // Check overdue
      if (project.dueDate && project.status !== 'completed') {
        const dueDate = new Date(project.dueDate);
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
  }, [autoLoad]); // eslint-disable-line react-hooks/exhaustive-deps
  
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