/**
 * @fileoverview Hook for loading all actions across projects with full metadata
 * Provides comprehensive action data for dashboard and filtering
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { extractMetadata } from '@/utils/metadata-extractor';
import { readFileText } from './useFileManager';
import { toISOStringFromEpoch } from '@/utils/time';
import { parseLocalDate } from '@/utils/date-formatting';
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
  loadActions: (projects: GTDProject[]) => Promise<void | (() => void)>;
  updateActionStatus: (actionIdOrPath: string, newStatus: string, actionPath?: string) => Promise<boolean>;
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

  const dueDate = parseLocalDate(dueDateStr);
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

  // Use ref to always have access to latest actions
  const actionsRef = useRef<ActionItem[]>([]);
  actionsRef.current = actions;

  // Track if the hook is still mounted to prevent memory leaks
  const isMountedRef = useRef(true);

  const loadActions = useCallback(async (projects: GTDProject[]) => {
    // Create a cancellation flag for this specific load operation
    let cancelled = false;

    // Set initial state if still mounted
    if (isMountedRef.current) {
      setIsLoading(true);
      setError(null);
      setCachedProjects(projects);
    }
    
    try {
      const allActions: ActionItem[] = [];

      await Promise.all(projects.map(async (project) => {
        // Check if cancelled before processing each project
        if (cancelled || !isMountedRef.current) return;

        try {
          const files = await safeInvoke<MarkdownFile[]>(
            'list_project_actions',
            { projectPath: project.path },
            []
          );

          await Promise.all(files.map(async (file) => {
            // Check if cancelled before processing each file
            if (cancelled || !isMountedRef.current) return;

            try {
              const content = await readFileText(file.path);
              const metadata = extractMetadata(content);

              const status = normalizeActionStatus(metadata.status || 'in-progress');

              // Filter based on options
              if (!includeCompleted && status === 'completed') return;
              if (!includeCancelled && status === 'cancelled') return;
              
              console.log('[useActionsData] Creating action item:', {
                filePath: file.path,
                fileName: file.name,
                projectPath: project.path
              });

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
                           toISOStringFromEpoch(file.last_modified),
                modifiedDate: metadata.modifiedDateTime as string ||
                            metadata.modifiedDate as string ||
                            toISOStringFromEpoch(file.last_modified),
                description: extractDescription(content),
                notes: metadata.notes as string | undefined
              };

              // Only push if not cancelled
              if (!cancelled && isMountedRef.current) {
                allActions.push(action);
              }
            } catch (err) {
              console.error(`Failed to load action ${file.path}:`, err);
            }
          }));
        } catch (err) {
          console.error(`Failed to load actions for project ${project.path}:`, err);
        }
      }));

      // Only update state if not cancelled
      if (!cancelled && isMountedRef.current) {
        setActions(allActions);
      }
    } catch (err) {
      // Only set error if not cancelled
      if (!cancelled && isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load actions');
        setActions([]);
      }
    } finally {
      // Only update loading state if not cancelled
      if (!cancelled && isMountedRef.current) {
        setIsLoading(false);
      }
    }

    // Return cleanup function to cancel this operation
    return () => {
      cancelled = true;
    };
  }, [includeCompleted, includeCancelled]);
  
  const updateActionStatus = useCallback(async (actionIdOrPath: string, newStatus: string, actionPath?: string): Promise<boolean> => {
    try {
      // Determine the actual file path
      let filePath: string;

      if (actionPath) {
        // If path is explicitly provided, use it
        filePath = actionPath;
        console.log('[updateActionStatus] Using provided path:', filePath);
      } else {
        // Otherwise, try to find it in current actions (using ref for latest state)
        const action = actionsRef.current.find(a => a.id === actionIdOrPath || a.path === actionIdOrPath);
        if (!action) {
          console.error(`[updateActionStatus] Action not found in state: ${actionIdOrPath}`);
          console.log('[updateActionStatus] Available actions:', actionsRef.current.map(a => ({ id: a.id, path: a.path })));
          return false;
        }
        filePath = action.path;
        console.log('[updateActionStatus] Found action in state, using path:', filePath);
      }

      console.log('[updateActionStatus] Reading file:', filePath);
      const content = await readFileText(filePath);
      console.log('[updateActionStatus] File content length:', content?.length || 0);

      const canonicalStatus = normalizeActionStatus(newStatus);
      console.log('[updateActionStatus] Updating status to:', canonicalStatus);

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

      console.log('[updateActionStatus] Writing updated content to file:', filePath);
      const writeResult = await safeInvoke('save_file', {
        path: filePath,
        content: finalContent
      }, null);
      console.log('[updateActionStatus] Write result:', writeResult);

      // Check if the write actually succeeded
      if (!writeResult) {
        console.error('[updateActionStatus] Write failed - save_file returned null');
        return false;
      }

      // Update local state optimistically
      setActions(prev => prev.map(a =>
        (a.id === actionIdOrPath || a.path === filePath) ? { ...a, status: canonicalStatus } : a
      ));

      // Dispatch content-updated event to notify other components
      window.dispatchEvent(new CustomEvent('content-updated', {
        detail: { path: filePath, content: finalContent }
      }));

      console.log('[updateActionStatus] Successfully updated action status');
      return true;
    } catch (err) {
      console.error('[updateActionStatus] Failed to update action status:', err);
      console.error('[updateActionStatus] Error details:', {
        actionIdOrPath,
        newStatus,
        actionPath,
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
  }, []);
  
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

  // Cleanup effect to mark component as unmounted
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
