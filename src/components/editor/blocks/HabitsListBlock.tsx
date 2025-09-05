/**
 * @fileoverview Custom BlockNote block for displaying habits that reference the current file
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { invoke } from '@tauri-apps/api/core';
import debounce from 'lodash.debounce';
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface HabitItem {
  file_path: string;
  habit_name: string;
  status: string;
  frequency: string;
}

// Define frequency display labels
const FREQUENCY_LABELS: Record<string, string> = {
  'daily': 'Daily',
  'weekdays': 'Weekdays',
  'every-other-day': 'Every Other Day',
  'twice-weekly': 'Twice a Week',
  'weekly': 'Weekly',
  'biweekly': 'Biweekly',
  'monthly': 'Monthly',
  '5-minute': '5 Minutes (Test)',
};


/**
 * Base props provided to BlockNote React block renderers
 */
interface HabitsListBlockRenderProps {
  block: { id: string; props: { listType?: string } };
  editor: {
    document: unknown;
    updateBlock: (
      id: string,
      update: { type: string; props: { listType?: string } }
    ) => void;
  };
  children?: React.ReactNode;
  className?: string;
}

/**
 * Map the BlockNote renderer props to the minimal, explicit props we use
 */
function toHabitsListBlockRenderProps(
  incomingProps: unknown
): HabitsListBlockRenderProps {
  const p = incomingProps as {
    block: { id: string; props?: { listType?: string } };
    editor: { document: unknown; updateBlock: (...args: unknown[]) => unknown };
    children?: React.ReactNode;
    className?: string;
  };

  return {
    block: {
      id: p.block.id,
      props: {
        listType: p.block.props?.listType
      },
    },
    editor: {
      document: p.editor.document,
      updateBlock: (id: string, update: { type: string; props: { listType?: string } }) => {
        p.editor.updateBlock(id, update);
      }
    },
    children: p.children,
    className: p.className,
  };
}

/**
 * React component for rendering the habits list block
 */
function HabitsListBlockComponent(incomingProps: unknown) {
  toHabitsListBlockRenderProps(incomingProps); // Validate props structure
  
  const [habits, setHabits] = React.useState<HabitItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isExpanded, setIsExpanded] = React.useState(true);

  // Get the current file path from the active tab - similar to HorizonListBlock
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
        const persisted = JSON.parse(tabsJson);
        const activeTab = persisted.openTabs?.find((tab: { id: string; filePath?: string }) => tab.id === persisted.activeTabId);
        if (activeTab?.filePath) {
          return activeTab.filePath;
        }
      } catch (err) {
        console.error('Failed to parse tabs from localStorage:', err);
      }
    }
    return null;
  }, []);

  const loadHabits = React.useCallback(async () => {
    const currentPath = getCurrentFilePath();
    if (!currentPath) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const spacePath = localStorage.getItem('gtdspace-current-path') || '';
      const result = await invoke<HabitItem[]>('find_habits_referencing', {
        targetPath: currentPath,
        spacePath: spacePath,
      });

      setHabits(result || []);
    } catch (err) {
      console.error('Failed to load habits:', err);
      setError('Failed to load related habits');
    } finally {
      setLoading(false);
    }
  }, [getCurrentFilePath]);

  // Debounce the load function
  const debouncedLoad = React.useMemo(
    () => debounce(loadHabits, 500),
    [loadHabits]
  );

  React.useEffect(() => {
    debouncedLoad();
    return () => {
      debouncedLoad.cancel();
    };
  }, [debouncedLoad]);

  // Function to open a habit file
  const openHabit = async (habitPath: string) => {
    try {
      // Dispatch event to open file
      const event = new CustomEvent('open-reference-file', {
        detail: { path: habitPath }
      });
      window.dispatchEvent(event);
    } catch (err) {
      console.error('Failed to open habit:', err);
    }
  };

  // Don't render loading state separately - handle it in the main render

  // Removed separate error and empty states - will handle in main render

  return (
    <div className="habits-list-block my-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded p-0.5 transition-colors"
          >
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Related Habits</span>
          {habits.length > 0 && !loading && (
            <span className="text-xs text-muted-foreground">
              ({habits.length} {habits.length === 1 ? 'habit' : 'habits'})
            </span>
          )}
        </div>
        <Button
          onClick={loadHabits}
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              Loading habits...
            </div>
          ) : error ? (
            <div className="text-red-600 dark:text-red-400 text-sm ml-6">
              {error}
            </div>
          ) : habits.length === 0 ? (
            <div className="text-center text-muted-foreground py-4 italic">
              No habits reference this file yet
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1.5 pr-4">
                {habits.map((habit, index) => (
                  <button
                    key={index}
                    onClick={() => openHabit(habit.file_path)}
                    className="w-full text-left px-3 py-2 rounded-md transition-all hover:bg-gray-100/60 dark:hover:bg-gray-800/60 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {habit.status === 'complete' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium group-hover:underline truncate">
                          {habit.habit_name}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs whitespace-nowrap flex-shrink-0">
                        {FREQUENCY_LABELS[habit.frequency] || habit.frequency}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Block specification for BlockNote
 */
export const HabitsListBlock = createReactBlockSpec(
  {
    type: 'habits-list' as const,
    propSchema: {
      listType: {
        default: 'habits',
      },
    } satisfies PropSchema,
    content: 'none',
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render: HabitsListBlockComponent as any,
  }
);