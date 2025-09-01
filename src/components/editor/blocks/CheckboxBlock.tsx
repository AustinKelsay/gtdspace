/**
 * @fileoverview Custom BlockNote block for checkbox fields (primarily for habit status)
 * @author Development Team
 * @created 2025-01-16
 */

import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { emitMetadataChange } from '@/utils/content-event-bus';
import { useFilePath } from '../FilePathContext';
import { isTauriContext } from '@/utils/tauri-ready';

// Memoized renderer component for checkbox blocks
const CheckboxRenderer = React.memo(function CheckboxRenderer(props: {
  block: { id: string; props: { type: string; checked: boolean; label: string } };
  editor: { updateBlock: (block: unknown, update: { props: Record<string, unknown> }) => void };
}) {
  const { block } = props;
  const { type, checked, label } = block.props;

  // Error handling hook
  const { withErrorHandling } = useErrorHandler();

  // Current file path from context
  const filePath = useFilePath();

  // Local state for immediate UI feedback
  const [localChecked, setLocalChecked] = React.useState(checked);

  // Update local state when props change (from content reload)
  React.useEffect(() => {
    setLocalChecked(checked);
  }, [checked]);

  const handleChange = React.useCallback(async (newChecked: boolean | 'indeterminate') => {
    const prevChecked = localChecked;
    const checkedVal = newChecked === true;

    // Immediately update local state for visual feedback
    setLocalChecked(checkedVal);

    // Update the BlockNote document's block props with error handling
    try {
      props.editor.updateBlock(block, { props: { checked: checkedVal } });
    } catch (error) {
      // Log the error and revert local state to maintain consistency
      console.error('[CheckboxBlock] Failed to update block:', error);
      setLocalChecked(prevChecked);
      // Optionally rethrow if higher-level logic expects it
      // throw error;
      return; // Exit early on error
    }

    // If this is a habit status checkbox, update the backend
    if (type === 'habit-status') {
      if (filePath) {
        // Check if this is a habit file
        const isHabitFile = filePath.toLowerCase().includes('/habits/') ||
          filePath.toLowerCase().includes('\\habits\\');

        if (isHabitFile) {
          // Use proper error handling for Tauri invoke
          const result = await withErrorHandling(
            async () => {
              // Convert checkbox state to status values for backend
              const statusValue = checkedVal ? 'completed' : 'todo';

              // Gracefully bail out if not in Tauri/browser-only envs
              try {
                if (!isTauriContext()) {
                  console.warn('[CheckboxBlock] Not in Tauri context; skipping backend update');
                  return { statusValue };
                }

                const core = await import('@tauri-apps/api/core');
                const invoke = (core as unknown as { invoke?: unknown }).invoke as
                  | ((cmd: string, args: unknown) => Promise<unknown>)
                  | undefined;

                if (typeof invoke !== 'function') {
                  console.warn('[CheckboxBlock] Tauri invoke unavailable; skipping backend update');
                  return { statusValue };
                }

                await invoke('update_habit_status', {
                  habitPath: filePath,
                  newStatus: statusValue,
                });

                return { statusValue };
              } catch (e) {
                console.warn('[CheckboxBlock] Failed to call backend; skipping update', e);
                // Return consistent shape so callers won’t break
                return { statusValue };
              }
            },
            'Failed to update habit status'
          );

          if (result) {
            // Show success toast
            const { toast } = await import('@/hooks/use-toast');
            const normalizedPath = filePath.replace(/\\/g, '/');
            const habitName = normalizedPath.split('/').pop()?.replace(/\.(md|markdown)$/i, '') || 'Habit';
            const statusLabel = checkedVal ? 'Completed' : 'To Do';

            toast({
              title: "Habit Recorded",
              description: `${habitName} marked as ${statusLabel}`,
            });

            // Small delay to let the backend write the file
            await new Promise(resolve => setTimeout(resolve, 100));

            // Emit through centralized event bus instead of custom window events
            // Use the already normalized path from above
            const fileName = normalizedPath.split('/').pop() || '';
            emitMetadataChange({
              filePath,
              fileName,
              content: '', // Content not directly changed
              metadata: { habitStatus: result.statusValue },
              changedFields: { habitStatus: result.statusValue }
            });

            // Still emit the content reload event for real-time UI update
            const reloadEvent = new CustomEvent('habit-content-changed', {
              detail: { filePath }
            });
            window.dispatchEvent(reloadEvent);
          } else {
            // Error handling failed, revert to previous state (UI + document)
            setLocalChecked(prevChecked);
            try {
              props.editor.updateBlock(block, { props: { checked: prevChecked } });
            } catch (e) {
              console.error('[CheckboxBlock] Failed to revert block props:', e);
            }
          }
        }
      }
    }
  }, [localChecked, type, withErrorHandling, filePath, block, props.editor]);

  // Determine display label based on type and state - memoized
  const displayLabel = React.useMemo(() => {
    if (label) return label;
    if (type === 'habit-status') {
      return localChecked ? 'Complete' : 'To Do';
    }
    return '';
  }, [label, type, localChecked]);

  const handleLabelClick = React.useCallback(() => {
    handleChange(!localChecked);
  }, [handleChange, localChecked]);

  return (
    <div className="inline-flex items-center gap-2 align-middle mx-1 my-1">
      <Checkbox
        checked={localChecked}
        onCheckedChange={handleChange}
        className={cn(
          "h-5 w-5",
          localChecked && type === 'habit-status' && "bg-green-600 border-green-600"
        )}
      />
      {displayLabel && (
        <label
          className={cn(
            "text-sm select-none cursor-pointer",
            localChecked && "text-muted-foreground line-through"
          )}
          onClick={handleLabelClick}
        >
          {displayLabel}
        </label>
      )}
    </div>
  );
});

// Define prop schema for checkbox block
const checkboxPropSchema = {
  type: {
    default: 'habit-status' as const, // Type of checkbox (for future extensibility)
  },
  checked: {
    default: false, // Boolean state of checkbox
  },
  label: {
    default: '', // Optional label text
  },
} satisfies PropSchema;

export const CheckboxBlock = createReactBlockSpec(
  {
    type: 'checkbox' as const,
    propSchema: checkboxPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any;
      return <CheckboxRenderer block={block} editor={props.editor} />;
    },
    parse: (element) => {
      // Parse checkbox block from HTML
      if (element.tagName === 'DIV' && element.getAttribute('data-checkbox')) {
        try {
          const data = JSON.parse(element.getAttribute('data-checkbox') || '{}');
          return {
            type: data.type || 'habit-status',
            checked: data.checked || false,
            label: data.label || '',
          };
        } catch (e) {
          console.error('Error parsing checkbox data:', e);
          return;
        }
      }
    },
    toExternalHTML: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any;
      const { type, checked } = block.props;
      // Return the markdown format that can be parsed back
      // Use a special checkbox syntax for habits
      const markdownFormat = `[!checkbox:${type}:${checked}]`;
      // Wrap in a paragraph to ensure it's preserved in the markdown
      return <p>{markdownFormat}</p>;
    },
  }
);