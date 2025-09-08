/**
 * @fileoverview Custom BlockNote block for GTD horizon lists (downward-looking relationships)
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
import debounce from 'lodash.debounce';
import {
  List,
  FileText,
  Target,
  ChevronRight,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface ListItem {
  path: string;
  name: string;
  type: 'project' | 'area' | 'goal' | 'vision';
  description?: string;
  status?: string;
  due_date?: string;
}

interface ReverseRelationship {
  file_path: string;
  file_name: string;
  file_type: string;
  references: string[];
}

// Define horizon colors for consistent UI
const ITEM_COLORS = {
  project: 'bg-green-100 hover:bg-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/30',
  area: 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/30',
  goal: 'bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/20 dark:hover:bg-violet-900/30',
  vision: 'bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30'
};

const ITEM_LABELS = {
  project: 'Projects',
  area: 'Areas of Focus',
  goal: 'Goals',
  vision: 'Vision'
};

const ITEM_ICONS = {
  project: FileText,
  area: Target,
  goal: Target,
  vision: Target
};

/**
 * Base props provided to BlockNote React block renderers
 */
interface HorizonListBlockRenderProps {
  block: { id: string; props: { listType?: string; currentPath?: string } };
  editor: {
    document: unknown;
    updateBlock: (
      id: string,
      update: { type: string; props: { listType: string; currentPath?: string } }
    ) => void;
  };
  children?: React.ReactNode;
  className?: string;
}

/**
 * Map the BlockNote renderer props to the minimal, explicit props we use
 */
function toHorizonListBlockRenderProps(
  incomingProps: unknown
): HorizonListBlockRenderProps {
  const p = incomingProps as {
    block: { id: string; props?: { listType?: string; currentPath?: string } };
    editor: { document: unknown; updateBlock: (...args: unknown[]) => unknown };
    children?: React.ReactNode;
    className?: string;
  };

  return {
    block: {
      id: p.block.id,
      props: {
        listType: p.block.props?.listType,
        currentPath: p.block.props?.currentPath
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

interface HorizonListRendererProps {
  block: { id: string; props: { listType?: string; currentPath?: string } };
  editor: {
    document: unknown;
    updateBlock: (
      id: string,
      update: { type: string; props: { listType: string; currentPath?: string } }
    ) => void;
  };
  listType: 'projects' | 'areas' | 'goals' | 'visions';
  label: string;
  compact?: boolean;
}

const HorizonListRenderer = React.memo(function HorizonListRenderer(props: HorizonListRendererProps) {
  const { listType, label, compact = false } = props;
  const [items, setItems] = React.useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [lastRefreshTime, setLastRefreshTime] = React.useState<Date | null>(null);

  // Get the current file path from the active tab - memoized with no dependencies since it reads from localStorage
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
      } catch (e) {
        // Silent fail - this is a fallback
      }
    }

    return null;
  }, []);

  // Load items that reference the current page - debounced to prevent excessive calls
  const loadItems = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const currentPath = getCurrentFilePath();
      if (!currentPath) {
        setItems([]);
        return;
      }

      // Get GTD space path
      const spacePath = localStorage.getItem('gtdspace-current-path');
      if (!spacePath) {
        setItems([]);
        return;
      }

      // Call backend to find reverse relationships
      const relationships = await safeInvoke<ReverseRelationship[]>('find_reverse_relationships', {
        targetPath: currentPath,
        spacePath: spacePath,
        filterType: listType
      }, []).catch(error => {
        console.error('HorizonList: Backend call failed:', error);
        return [];
      });

      // Transform relationships to list items
      const listItems: ListItem[] = relationships.map(rel => ({
        path: rel.file_path,
        name: rel.file_name.replace('.md', ''),
        type: (rel.file_type as 'project' | 'area' | 'goal' | 'vision') || 'project',
        // Additional metadata could be loaded here if needed
      }));

      setItems(listItems);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('Failed to load horizon list items:', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentFilePath, listType]);

  // Debounced version to prevent excessive API calls
  const debouncedLoadItems = React.useMemo(
    () => debounce(loadItems, 300),
    [loadItems]
  );

  // Load items on mount and when list type changes
  React.useEffect(() => {
    debouncedLoadItems();
    
    // Cleanup: cancel any pending debounced calls on unmount
    return () => {
      debouncedLoadItems.cancel();
    };
  }, [debouncedLoadItems, listType]);

  // Refresh when file references are updated - use debounced version
  React.useEffect(() => {
    const handleReferenceUpdate = () => {
      // Use debounced version to prevent excessive updates
      debouncedLoadItems();
    };

    window.addEventListener('reference-updated', handleReferenceUpdate);
    window.addEventListener('file-saved', handleReferenceUpdate);

    return () => {
      window.removeEventListener('reference-updated', handleReferenceUpdate);
      window.removeEventListener('file-saved', handleReferenceUpdate);
    };
  }, [debouncedLoadItems]);

  const handleItemClick = (path: string) => {
    // Defensive check: if path looks like a JSON array, parse it
    let finalPath = path;
    if (path.startsWith('[') && path.endsWith(']')) {
      try {
        const parsed = JSON.parse(path);
        if (Array.isArray(parsed) && parsed.length > 0) {
          finalPath = parsed[0];
          console.warn('[HorizonListBlock] Path was JSON array, extracted first element:', finalPath);
        }
      } catch {
        // Not valid JSON, use as-is
      }
    }
    
    window.dispatchEvent(new CustomEvent('open-reference-file', {
      detail: { path: finalPath }
    }));
  };

  // Group items by type
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, ListItem[]> = {};
    for (const item of items) {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    }
    return groups;
  }, [items]);

  const itemTypes = listType === 'projects' ? ['project'] :
    listType === 'areas' ? ['area'] :
      listType === 'goals' ? ['goal'] :
        listType === 'visions' ? ['vision'] : [];

  return (
    <div className={`${compact ? '' : 'my-3'} border border-border rounded-lg transition-all ${isExpanded ? (compact ? 'p-3' : 'p-4') : 'p-2 bg-muted/30'
      }`}>
      <div className={`flex items-center justify-between ${isExpanded ? 'mb-3' : ''}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-accent rounded transition-colors"
            aria-label={isExpanded ? "Collapse list" : "Expand list"}
          >
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''
                }`}
            />
          </button>
          <List className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
          <Badge
            variant={items.length > 0 ? "outline" : "secondary"}
            className={`ml-2 ${!isExpanded && items.length > 0 ? 'animate-pulse' : ''}`}
          >
            {items.length}
          </Badge>
          {!isExpanded && items.length > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              {items.length === 1 ? 'item' : 'items'} available
            </span>
          )}
        </div>

        <Button
          onClick={loadItems}
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
              Loading {label.toLowerCase()}...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-muted-foreground py-4 italic">
              No {label.toLowerCase()} linked to this page
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-4 pr-4">
                {itemTypes.map(itemType => {
                  const typeItems = groupedItems[itemType];
                  if (!typeItems || typeItems.length === 0) return null;

                  const Icon = ITEM_ICONS[itemType as keyof typeof ITEM_ICONS];
                  const color = ITEM_COLORS[itemType as keyof typeof ITEM_COLORS];
                  const typeLabel = ITEM_LABELS[itemType as keyof typeof ITEM_LABELS];

                  return (
                    <div key={itemType}>
                      {itemTypes.length > 1 && (
                        <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                          <Icon className="h-3 w-3" />
                          <span>{typeLabel}</span>
                        </div>
                      )}
                      <div className={itemTypes.length > 1 ? "pl-5 space-y-1.5" : "space-y-1.5"}>
                        {typeItems.map((item) => (
                          <button
                            key={item.path}
                            onClick={() => handleItemClick(item.path)}
                            className={`w-full text-left px-3 py-2 rounded-md transition-all ${color} group`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm font-medium group-hover:underline">
                                  {item.name}
                                </span>
                              </div>
                              {item.status && (
                                <Badge variant="outline" className="text-xs">
                                  {item.status}
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1 pl-5">
                                {item.description}
                              </p>
                            )}
                            {item.due_date && (
                              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 pl-5">
                                Due: {new Date(item.due_date).toLocaleDateString()}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {lastRefreshTime && isExpanded && (
            <div className="text-xs text-muted-foreground text-right pt-2 border-t">
              Last updated: {lastRefreshTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Define prop schema for list blocks
const horizonListPropSchema = {
  listType: {
    default: 'projects',  // Type of items to list
  },
  currentPath: {
    default: '',  // Path of the current document (auto-populated)
  },
} satisfies PropSchema;

// Projects List Block (for Areas of Focus)
export const ProjectsListBlock = createReactBlockSpec(
  {
    type: 'projects-list' as const,
    propSchema: horizonListPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toHorizonListBlockRenderProps(props);
      return (
        <HorizonListRenderer
          {...baseProps}
          listType="projects"
          label="Active Projects"
        />
      );
    },
    toExternalHTML: () => {
      // Export as markdown marker for persistence
      return <p>[!projects-list]</p>;
    },
    parse: (element) => {
      const textContent = element.textContent || '';
      if (textContent.includes('[!projects-list]')) {
        return { listType: 'projects' };
      }
      return undefined;
    },
  }
);

// Areas List Block (for Goals and Vision)
export const AreasListBlock = createReactBlockSpec(
  {
    type: 'areas-list' as const,
    propSchema: horizonListPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toHorizonListBlockRenderProps(props);
      return (
        <HorizonListRenderer
          {...baseProps}
          listType="areas"
          label="Related Areas of Focus"
        />
      );
    },
    toExternalHTML: () => {
      return <p>[!areas-list]</p>;
    },
    parse: (element) => {
      const textContent = element.textContent || '';
      if (textContent.includes('[!areas-list]')) {
        return { listType: 'areas' };
      }
      return undefined;
    },
  }
);

// Goals List Block (for Vision and Purpose)
export const GoalsListBlock = createReactBlockSpec(
  {
    type: 'goals-list' as const,
    propSchema: horizonListPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toHorizonListBlockRenderProps(props);
      return (
        <HorizonListRenderer
          {...baseProps}
          listType="goals"
          label="Related Goals"
        />
      );
    },
    toExternalHTML: () => {
      return <p>[!goals-list]</p>;
    },
    parse: (element) => {
      const textContent = element.textContent || '';
      if (textContent.includes('[!goals-list]')) {
        return { listType: 'goals' };
      }
      return undefined;
    },
  }
);

// Visions List Block (for Purpose & Principles)
export const VisionsListBlock = createReactBlockSpec(
  {
    type: 'visions-list' as const,
    propSchema: horizonListPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toHorizonListBlockRenderProps(props);
      return (
        <HorizonListRenderer
          {...baseProps}
          listType="visions"
          label="Related Visions"
        />
      );
    },
    toExternalHTML: () => {
      return <p>[!visions-list]</p>;
    },
    parse: (element) => {
      const textContent = element.textContent || '';
      if (textContent.includes('[!visions-list]')) {
        return { listType: 'visions' };
      }
      return undefined;
    },
  }
);

// Combined lists for Goals and higher horizons
export const ProjectsAndAreasListBlock = createReactBlockSpec(
  {
    type: 'projects-areas-list' as const,
    propSchema: horizonListPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toHorizonListBlockRenderProps(props);
      return (
        <div className="my-3 border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Related Items</h3>
          <div className="space-y-2">
            <HorizonListRenderer
              {...baseProps}
              listType="projects"
              label="Related Projects"
              compact={true}
            />
            <HorizonListRenderer
              {...baseProps}
              listType="areas"
              label="Related Areas of Focus"
              compact={true}
            />
          </div>
        </div>
      );
    },
    toExternalHTML: () => {
      return <p>[!projects-and-areas-list]</p>;
    },
    parse: (element) => {
      const textContent = element.textContent || '';
      // Check for both new and legacy tokens for backward compatibility
      if (textContent.includes('[!projects-and-areas-list]') || 
          textContent.includes('[!projects-areas-list]')) {
        // Return a value that represents the combined nature
        return { listType: 'projects-areas' };
      }
      return undefined;
    },
  }
);

export const GoalsAndAreasListBlock = createReactBlockSpec(
  {
    type: 'goals-areas-list' as const,
    propSchema: horizonListPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toHorizonListBlockRenderProps(props);
      return (
        <div className="my-3 border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Related Items</h3>
          <div className="space-y-2">
            <HorizonListRenderer
              {...baseProps}
              listType="goals"
              label="Related Goals"
              compact={true}
            />
            <HorizonListRenderer
              {...baseProps}
              listType="areas"
              label="Related Areas of Focus"
              compact={true}
            />
          </div>
        </div>
      );
    },
    toExternalHTML: () => {
      return <p>[!goals-and-areas-list]</p>;
    },
    parse: (element) => {
      const textContent = element.textContent || '';
      // Check for both new and legacy tokens for backward compatibility
      if (textContent.includes('[!goals-and-areas-list]') || 
          textContent.includes('[!goals-areas-list]')) {
        // Return a value that represents the combined nature
        return { listType: 'goals-areas' };
      }
      return undefined;
    },
  }
);

export const VisionsAndGoalsListBlock = createReactBlockSpec(
  {
    type: 'visions-goals-list' as const,
    propSchema: horizonListPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toHorizonListBlockRenderProps(props);
      return (
        <div className="my-3 border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Related Items</h3>
          <div className="space-y-2">
            <HorizonListRenderer
              {...baseProps}
              listType="visions"
              label="Related Visions"
              compact={true}
            />
            <HorizonListRenderer
              {...baseProps}
              listType="goals"
              label="Related Goals"
              compact={true}
            />
          </div>
        </div>
      );
    },
    toExternalHTML: () => {
      return <p>[!visions-and-goals-list]</p>;
    },
    parse: (element) => {
      const textContent = element.textContent || '';
      // Check for both new and legacy tokens for backward compatibility
      if (textContent.includes('[!visions-and-goals-list]') || 
          textContent.includes('[!visions-goals-list]')) {
        // Return a value that represents the combined nature
        return { listType: 'visions-goals' };
      }
      return undefined;
    },
  }
);