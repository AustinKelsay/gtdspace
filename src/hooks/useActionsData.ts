/**
 * @fileoverview Hook for loading all actions across projects with full metadata
 * Provides comprehensive action data for dashboard and filtering
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { extractMetadata } from '@/utils/metadata-extractor';
import { readFileText } from './useFileManager';
import type { GTDProject, MarkdownFile } from '@/types';

export interface ActionItem {
  id: string;
  name: string;
  path: string;
  projectName: string;
  projectPath: string;
  status: string;
  effort?: string;
  dueDate?: string;
  focusDate?: string;
  contexts?: string[];
  references?: string[];
  createdDate?: string;
  modifiedDate?: string;
  description?: string;
  notes?: string;
}

interface UseActionsDataOptions {
  autoLoad?: boolean;
  includeCompleted?: boolean;
  includeCancelled?: boolean;
}

interface UseActionsDataReturn {
  actions: ActionItem[];
  isLoading: boolean;
  error: string | null;
  summary: {
    total: number;
    inProgress: number;
    waiting: number;
    completed: number;
    cancelled: number;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
  };
  loadActions: (projects: GTDProject[]) => Promise<void>;
  updateActionStatus: (actionId: string, newStatus: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Normalize action status values to canonical forms
 */
const normalizeActionStatus = (status: string): string => {
  const normalized = status.toLowerCase().trim();
  
  if (['in-progress', 'active', 'planning', 'not-started'].includes(normalized)) {
    return 'in-progress';
  }
  
  if (['waiting', 'blocked', 'on-hold', 'paused'].includes(normalized)) {
    return 'waiting';
  }
  
  if (['completed', 'done', 'finished'].includes(normalized)) {
    return 'completed';
  }
  
  if (['cancelled', 'canceled', 'dropped', 'abandoned'].includes(normalized)) {
    return 'cancelled';
  }
  
  return 'in-progress';
};

/**
 * Extract first paragraph as description
 */
const extractDescription = (content: string): string => {
  const lines = content.split('\n');
  const descLines: string[] = [];
  let foundContent = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip metadata lines and headers
    if (trimmed.startsWith('[!') || trimmed.startsWith('#')) continue;
    
    if (trimmed) {
      foundContent = true;
      descLines.push(trimmed);
    } else if (foundContent) {
      // Found empty line after content, stop
      break;
    }
  }
  
  return descLines.join(' ').substring(0, 200);
};

/**
 * Check if date is overdue, due today, or due this week
 */
const analyzeDueDate = (dueDateStr: string | undefined) => {
  if (!dueDateStr) return { overdue: false, dueToday: false, dueThisWeek: false };
  
  const dueDate = new Date(dueDateStr);
  if (isNaN(dueDate.getTime())) return { overdue: false, dueToday: false, dueThisWeek: false };
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  
  return {
    overdue: dueDate < today,
    dueToday: dueDate >= today && dueDate < tomorrow,
    dueThisWeek: dueDate >= today && dueDate < weekFromNow
  };
};

export function useActionsData(options: UseActionsDataOptions = {}): UseActionsDataReturn {
  const {
    autoLoad = false,
    includeCompleted = true,
    includeCancelled = false
  } = options;
  
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedProjects, setCachedProjects] = useState<GTDProject[]>([]);
  
  const loadActions = useCallback(async (projects: GTDProject[]) => {
    setIsLoading(true);
    setError(null);
    setCachedProjects(projects);
    
    try {
      const allActions: ActionItem[] = [];
      
      await Promise.all(projects.map(async (project) => {
        try {
          const files = await safeInvoke<MarkdownFile[]>(
            'list_project_actions',
            { projectPath: project.path },
            []
          );
          
          await Promise.all(files.map(async (file) => {
            try {
              const content = await readFileText(file.path);
              const metadata = extractMetadata(content);
              
              const status = normalizeActionStatus(metadata.status || 'in-progress');
              
              // Filter based on options
              if (!includeCompleted && status === 'completed') return;
              if (!includeCancelled && status === 'cancelled') return;
              
              const action: ActionItem = {
                id: file.path,
                name: file.name.replace('.md', ''),
                path: file.path,
                projectName: project.name,
                projectPath: project.path,
                status,
                effort: metadata.effort as string | undefined,
                dueDate: metadata.dueDate as string | undefined,
                focusDate: metadata.focusDate as string | undefined,
                contexts: Array.isArray(metadata.contexts) ? metadata.contexts : 
                          (metadata.contexts ? [metadata.contexts] : []),
                references: Array.isArray(metadata.references) ? metadata.references :
                           (metadata.references ? [metadata.references] : []),
                createdDate: metadata.createdDateTime as string || 
                           metadata.createdDate as string ||
                           new Date(file.last_modified).toISOString(),
                modifiedDate: metadata.modifiedDateTime as string ||
                            metadata.modifiedDate as string ||
                            new Date(file.last_modified).toISOString(),
                description: extractDescription(content),
                notes: metadata.notes as string | undefined
              };
              
              allActions.push(action);
            } catch (err) {
              console.error(`Failed to load action ${file.path}:`, err);
            }
          }));
        } catch (err) {
          console.error(`Failed to load actions for project ${project.path}:`, err);
        }
      }));
      
      setActions(allActions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load actions');
      setActions([]);
    } finally {
      setIsLoading(false);
    }
  }, [includeCompleted, includeCancelled]);
  
  const updateActionStatus = useCallback(async (actionId: string, newStatus: string) => {
    const action = actions.find(a => a.id === actionId);
    if (!action) return;

    try {
      const content = await readFileText(action.path);
      const canonicalStatus = normalizeActionStatus(newStatus);

      // Replace existing status tag
      let updatedContent = content.replace(
        /\[!singleselect:status:[^\]]+\]/,
        `[!singleselect:status:${canonicalStatus}]`
      );

      // If no status tag exists, try to inject after first H1; if not present, prepend at top
      if (!/\[!singleselect:status:/.test(updatedContent)) {
        if (/^#[^\n]+\n/.test(updatedContent)) {
          updatedContent = updatedContent.replace(
            /^(#[^\n]+\n)/,
            `$1\n[!singleselect:status:${canonicalStatus}]\n`
          );
        } else {
          updatedContent = `[!singleselect:status:${canonicalStatus}]\n\n` + updatedContent;
        }
      }
      const finalContent = updatedContent;

      await safeInvoke('write_file', {
        path: action.path,
        content: finalContent
      });

      // Update local state optimistically
      setActions(prev => prev.map(a =>
        a.id === actionId ? { ...a, status: canonicalStatus } : a
      ));
    } catch (err) {
      console.error('Failed to update action status:', err);
      throw err;
    }
  }, [actions]);
  
  const refresh = useCallback(async () => {
    if (cachedProjects.length > 0) {
      await loadActions(cachedProjects);
    }
  }, [cachedProjects, loadActions]);
  
  const summary = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;
    let dueThisWeek = 0;
    
    const statusCounts = {
      total: actions.length,
      inProgress: 0,
      waiting: 0,
      completed: 0,
      cancelled: 0
    };
    
    actions.forEach(action => {
      // Count by status
      switch (action.status) {
        case 'in-progress':
          statusCounts.inProgress++;
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
      
      // Analyze due dates (only for non-completed/cancelled)
      if (action.status !== 'completed' && action.status !== 'cancelled') {
        const analysis = analyzeDueDate(action.dueDate);
        if (analysis.overdue) overdue++;
        if (analysis.dueToday) dueToday++;
        if (analysis.dueThisWeek) dueThisWeek++;
      }
    });
    
    return {
      ...statusCounts,
      overdue,
      dueToday,
      dueThisWeek
    };
  }, [actions]);
  
  // Auto-load if specified and projects are available
  useEffect(() => {
    if (autoLoad && cachedProjects.length === 0) {
      // Will need projects to be passed in
      console.log('[useActionsData] Auto-load enabled but no projects available yet');
    }
  }, [autoLoad, cachedProjects]);
  
  return {
    actions,
    isLoading,
    error,
    summary,
    loadActions,
    updateActionStatus,
    refresh
  };
}