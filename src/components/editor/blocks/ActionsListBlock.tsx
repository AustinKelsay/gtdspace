/**
 * @fileoverview Custom BlockNote block for listing actions within a project
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { safeInvoke } from '@/utils/safe-invoke';
import { extractMetadata } from '@/utils/metadata-extractor';
import debounce from 'lodash.debounce';
import {
  List,
  ChevronRight,
  Loader2,
  RefreshCw,
  Circle,
  CircleDot,
  CheckCircle2,
  Calendar,
  Clock
} from 'lucide-react';
import type { GTDAction, GTDActionStatus, GTDActionEffort, MarkdownFile } from '@/types';

/**
 * Base props provided to BlockNote React block renderers
 */
interface ActionsListBlockRenderProps {
  block: { id: string; props: { statusFilter?: string } };
  editor: {
    document: unknown;
    updateBlock: (
      id: string,
      update: { type: string; props: { statusFilter?: string } }
    ) => void;
  };
  children?: React.ReactNode;
  className?: string;
}

/**
 * Map the BlockNote renderer props to the minimal, explicit props we use
 */
function toActionsListBlockRenderProps(
  incomingProps: unknown
): ActionsListBlockRenderProps {
  const p = incomingProps as {
    block: { id: string; props?: { statusFilter?: string } };
    editor: { document: unknown; updateBlock: (...args: unknown[]) => unknown };
    children?: React.ReactNode;
    className?: string;
  };

  return {
    block: {
      id: p.block.id,
      props: {
        statusFilter: p.block.props?.statusFilter
      },
    },
    editor: {
      document: p.editor.document,
      updateBlock: (id, update) => {
        (p.editor.updateBlock as unknown as (a: unknown, b: unknown) => unknown)(
          id,
          update
        );
      },
    },
    children: p.children,
    className: p.className,
  };
}

// Status normalization helper
const normalizeStatus = (status: string | undefined | null): GTDActionStatus => {
  // Handle undefined/null status - default to 'in-progress'
  if (!status) {
    return 'in-progress';
  }
  
  const normalized = status.toLowerCase().trim().replace(/[\s-_]+/g, '-');
  switch (normalized) {
    case 'completed':
    case 'complete':
    case 'done':
      return 'completed';
    case 'waiting':
    case 'wait':
    case 'blocked':
      return 'waiting';
    // Cancelled is not a valid GTDActionStatus, treat as completed
    case 'cancelled':
    case 'canceled':
    case 'cancel':
      return 'completed';
    case 'in-progress':
    case 'inprogress':
    case 'active':
    case 'doing':
    default:
      return 'in-progress';
  }
};

// Get status icon
const getActionStatusIcon = (status: GTDActionStatus) => {
  switch (status) {
    case 'completed': return CheckCircle2;
    case 'waiting': return CircleDot;
    case 'in-progress': return Circle;
    default: return Circle;
  }
};

// Get status color
const getActionStatusColor = (status: GTDActionStatus) => {
  switch (status) {
    case 'completed': return 'text-green-600 dark:text-green-500';
    case 'waiting': return 'text-purple-600 dark:text-purple-500';
    case 'in-progress': return 'text-blue-600 dark:text-blue-500';
    default: return 'text-gray-600 dark:text-gray-400';
  }
};

// Get effort label and estimated duration
const getEffortLabel = (effort: GTDActionEffort): { label: string; duration: string } => {
  switch (effort) {
    case 'small':
      return { label: 'Small', duration: '< 30m' };
    case 'medium':
      return { label: 'Medium', duration: '30-90m' };
    case 'large':
      return { label: 'Large', duration: '2-3h' };
    case 'extra-large':
      return { label: 'X-Large', duration: '> 3h' };
    default:
      return { label: 'Medium', duration: '30-90m' };
  }
};

// Get effort color
const getEffortColor = (effort: GTDActionEffort) => {
  switch (effort) {
    case 'small': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'large': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'extra-large': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
};

interface ActionsListRendererProps {
  block: { id: string; props: { statusFilter?: string } };
  editor: {
    document: unknown;
    updateBlock: (
      id: string,
      update: { type: string; props: { statusFilter?: string } }
    ) => void;
  };
  statusFilter?: GTDActionStatus;
}

const ActionsListRenderer = React.memo(function ActionsListRenderer(props: ActionsListRendererProps) {
  const { statusFilter } = props;
  const [actions, setActions] = React.useState<GTDAction[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [lastRefreshTime, setLastRefreshTime] = React.useState<Date | null>(null);

  // Get the current file path from the active tab
  const getCurrentFilePath = React.useCallback((): string | null => {
    // First try to get from the blocknote-specific key (most reliable)
    const blocknotePath = localStorage.getItem('blocknote-current-file');
    if (blocknotePath) {
      return blocknotePath;
    }

    // Fallback: Try to get from localStorage (active tab info)
    const tabsJson = localStorage.getItem('gtdspace-tabs');
    if (tabsJson) {
      try {
        const tabsData = JSON.parse(tabsJson);

        // Validate the structure before accessing nested properties
        if (!tabsData || typeof tabsData !== 'object') {
          return null;
        }

        // Ensure openTabs is an array before trying to use find
        if (!Array.isArray(tabsData.openTabs)) {
          return null;
        }

        const activeTab = tabsData.openTabs.find((t: any) =>
          t && typeof t === 'object' && t.id === tabsData.activeTabId
        );

        // Check filePath first (preferred), fallback to path if not available
        if (activeTab?.filePath && typeof activeTab.filePath === 'string') {
          return activeTab.filePath;
        } else if (activeTab?.path && typeof activeTab.path === 'string') {
          return activeTab.path;
        }
      } catch (_e) {
        // Silent fail - this is a fallback
      }
    }

    return null;
  }, []);

  // Get project path from current file path
  const getProjectPath = React.useCallback((filePath: string): string | null => {
    // Check if this is a file within a project
    // Normalize path separators and use case-insensitive match
    const normalizedPath = filePath.replace(/\\/g, '/');
    const projectMatch = normalizedPath.match(/(.+\/[Pp]rojects\/[^/]+)/i);
    if (projectMatch) {
      // Return the original match but with normalized separators
      return projectMatch[1];
    }
    return null;
  }, []);

  // Load actions for the current project
  const loadActions = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const currentPath = getCurrentFilePath();
      if (!currentPath) {
        setActions([]);
        return;
      }

      const projectPath = getProjectPath(currentPath);
      if (!projectPath) {
        setActions([]);
        return;
      }

      // Call backend to list action files for this project
      const actionFiles = await safeInvoke<MarkdownFile[]>('list_project_actions', {
        projectPath: projectPath
      }, []).catch(error => {
        console.error('ActionsList: Failed to load action files:', error);
        return [];
      });

      // For each file, read its content and extract metadata
      const actionPromises = actionFiles.map(async (file) => {
        try {
          // Read file content
          const content = await safeInvoke<string>('read_file', {
            path: file.path
          }, '').catch(() => '');

          // Extract metadata from content
          const metadata = extractMetadata(content);
          
          // Extract action name from filename (remove .md extension)
          const name = file.name.replace(/\.md$/i, '');
          
          // Build GTDAction object with metadata
          const action: GTDAction = {
            name: metadata.title || name,
            path: file.path,
            status: normalizeStatus(metadata.status as string),
            focusDate: metadata.focusDate || null,
            dueDate: metadata.dueDate || null,
            effort: (metadata.effort as GTDActionEffort) || 'medium',
            createdDateTime: (() => {
              const dt = metadata.createdDateTime || metadata.created_date_time;
              if (Array.isArray(dt)) {
                return dt[0] || new Date().toISOString();
              }
              return dt || new Date().toISOString();
            })(),
            project_path: projectPath
          };
          
          return action;
        } catch (error) {
          console.error(`Failed to parse action ${file.name}:`, error);
          // Return a basic action with defaults if parsing fails
          return {
            name: file.name.replace(/\.md$/i, ''),
            path: file.path,
            status: 'in-progress' as GTDActionStatus,
            focusDate: null,
            dueDate: null,
            effort: 'medium' as GTDActionEffort,
            createdDateTime: new Date().toISOString(),
            project_path: projectPath
          };
        }
      });

      const projectActions = await Promise.all(actionPromises);

      // Filter by status if specified
      let filteredActions = projectActions;
      if (statusFilter) {
        filteredActions = projectActions.filter(action => 
          normalizeStatus(action.status) === statusFilter
        );
      }

      // Sort actions: in-progress first, then waiting, then completed
      filteredActions.sort((a, b) => {
        const statusOrder: Record<GTDActionStatus, number> = {
          'in-progress': 0,
          'waiting': 1,
          'completed': 2
        };
        
        const aStatus = normalizeStatus(a.status);
        const bStatus = normalizeStatus(b.status);
        
        if (aStatus !== bStatus) {
          return statusOrder[aStatus] - statusOrder[bStatus];
        }
        
        // Within same status, sort by due date (earliest first)
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        
        // Finally, sort by name
        return a.name.localeCompare(b.name);
      });

      setActions(filteredActions);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Failed to load actions:', error);
      setActions([]);
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentFilePath, getProjectPath, statusFilter]);

  // Debounced version to prevent excessive API calls
  const debouncedLoadActions = React.useMemo(
    () => debounce(loadActions, 300),
    [loadActions]
  );

  // Load actions on mount and when status filter changes
  React.useEffect(() => {
    debouncedLoadActions();
    
    // Cleanup: cancel any pending debounced calls on unmount
    return () => {
      debouncedLoadActions.cancel();
    };
  }, [debouncedLoadActions, statusFilter]);

  // Refresh when actions are created, updated, or deleted
  React.useEffect(() => {
    const handleActionUpdate = () => {
      // Use debounced version to prevent excessive updates
      debouncedLoadActions();
    };

    // Listen for GTD-specific events
    window.addEventListener('gtd-action-created', handleActionUpdate);
    window.addEventListener('gtd-action-updated', handleActionUpdate);
    window.addEventListener('gtd-action-deleted', handleActionUpdate);
    window.addEventListener('file-saved', handleActionUpdate);
    window.addEventListener('content-updated', handleActionUpdate);

    return () => {
      window.removeEventListener('gtd-action-created', handleActionUpdate);
      window.removeEventListener('gtd-action-updated', handleActionUpdate);
      window.removeEventListener('gtd-action-deleted', handleActionUpdate);
      window.removeEventListener('file-saved', handleActionUpdate);
      window.removeEventListener('content-updated', handleActionUpdate);
    };
  }, [debouncedLoadActions]);

  const handleActionClick = (path: string) => {
    // Open the action file in a new tab
    window.dispatchEvent(new CustomEvent('open-file', {
      detail: { path }
    }));
  };

  // Group actions by status
  const groupedActions = React.useMemo(() => {
    const groups: Record<GTDActionStatus, GTDAction[]> = {
      'in-progress': [],
      'waiting': [],
      'completed': []
    };
    
    for (const action of actions) {
      const status = normalizeStatus(action.status);
      groups[status].push(action);
    }
    
    return groups;
  }, [actions]);

  // Calculate statistics
  const stats = React.useMemo(() => {
    const total = actions.length;
    const completed = groupedActions['completed'].length;
    const inProgress = groupedActions['in-progress'].length;
    const waiting = groupedActions['waiting'].length;
    
    return { total, completed, inProgress, waiting };
  }, [actions, groupedActions]);

  const filterLabel = statusFilter ? 
    `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1).replace('-', ' ')} Actions` : 
    'All Actions';

  return (
    <div className={`my-3 border border-border rounded-lg transition-all ${
      isExpanded ? 'p-4' : 'p-2 bg-muted/30'
    }`}>
      <div className={`flex items-center justify-between ${isExpanded ? 'mb-3' : ''}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-accent rounded transition-colors"
            aria-label={isExpanded ? "Collapse list" : "Expand list"}
          >
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          </button>
          <List className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{filterLabel}</span>
          <Badge
            variant={actions.length > 0 ? "outline" : "secondary"}
            className={`ml-2 ${!isExpanded && actions.length > 0 ? 'animate-pulse' : ''}`}
          >
            {actions.length}
          </Badge>
          {!isExpanded && actions.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-1">
              {stats.inProgress > 0 && (
                <span className="flex items-center gap-1">
                  <Circle className="h-3 w-3" />
                  {stats.inProgress}
                </span>
              )}
              {stats.waiting > 0 && (
                <span className="flex items-center gap-1">
                  <CircleDot className="h-3 w-3" />
                  {stats.waiting}
                </span>
              )}
              {stats.completed > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {stats.completed}
                </span>
              )}
            </div>
          )}
        </div>

        <Button
          onClick={loadActions}
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={isLoading}
          title="Refresh list"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              Loading actions...
            </div>
          ) : actions.length === 0 ? (
            <div className="text-center text-muted-foreground py-4 italic">
              {statusFilter ? 
                `No ${filterLabel.toLowerCase()} in this project` : 
                'No actions in this project yet'
              }
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2 pr-4">
                {actions.map((action) => {
                  const status = normalizeStatus(action.status);
                  const StatusIcon = getActionStatusIcon(status);
                  const effort = action.effort || 'medium';
                  const effortInfo = getEffortLabel(effort);
                  
                  return (
                    <button
                      key={action.path}
                      onClick={() => handleActionClick(action.path)}
                      className="w-full text-left px-3 py-2 rounded-md transition-all bg-card hover:bg-accent group"
                    >
                      <div className="flex items-start gap-2">
                        <StatusIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${getActionStatusColor(status)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium group-hover:underline truncate">
                              {action.name}
                            </span>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs px-1.5 py-0 h-5 ${getEffortColor(effort)}`}
                            >
                              {effortInfo.duration}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-3 mt-1">
                            {action.focusDate && (
                              <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                <Clock className="h-3 w-3" />
                                <span>
                                  Focus: {(() => {
                                    try {
                                      return new Date(action.focusDate).toLocaleDateString();
                                    } catch {
                                      return action.focusDate;
                                    }
                                  })()}
                                </span>
                              </div>
                            )}
                            {action.dueDate && (
                              <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  Due: {(() => {
                                    try {
                                      return new Date(action.dueDate).toLocaleDateString();
                                    } catch {
                                      return action.dueDate;
                                    }
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {!statusFilter && stats.total > 0 && isExpanded && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <div className="flex items-center gap-3">
                {stats.inProgress > 0 && (
                  <span className="flex items-center gap-1">
                    <Circle className="h-3 w-3" />
                    {stats.inProgress} active
                  </span>
                )}
                {stats.waiting > 0 && (
                  <span className="flex items-center gap-1">
                    <CircleDot className="h-3 w-3" />
                    {stats.waiting} waiting
                  </span>
                )}
                {stats.completed > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {stats.completed} done
                  </span>
                )}
              </div>
              {lastRefreshTime && (
                <span>Updated: {lastRefreshTime.toLocaleTimeString()}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Define prop schema for actions list block
const actionsListPropSchema = {
  statusFilter: {
    default: '',  // Empty means show all actions
  },
} satisfies PropSchema;

// Actions List Block
export const ActionsListBlock = createReactBlockSpec(
  {
    type: 'actions-list' as const,
    propSchema: actionsListPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toActionsListBlockRenderProps(props);
      const statusFilter = baseProps.block.props.statusFilter ? 
        normalizeStatus(baseProps.block.props.statusFilter) : 
        undefined;
      
      return (
        <ActionsListRenderer
          {...baseProps}
          statusFilter={statusFilter}
        />
      );
    },
    toExternalHTML: (props) => {
      // Export as markdown marker for persistence
      const block = props.block as { props: { statusFilter: string } };
      const statusFilter = block.props.statusFilter;
      const marker = statusFilter ? 
        `[!actions-list:${statusFilter}]` : 
        '[!actions-list]';
      return <p>{marker}</p>;
    },
    parse: (element) => {
      const textContent = element.textContent || '';
      
      // Check for actions-list with optional status filter
      const match = textContent.match(/\[!actions-list(?::([^\]]+))?\]/);
      if (match) {
        return { 
          statusFilter: match[1] || ''
        };
      }
      
      return undefined;
    },
  }
);