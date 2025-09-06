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
import { safeInvoke } from '@/utils/safe-invoke';
import { toast } from '@/hooks/use-toast';

// Memoized renderer component for checkbox blocks
const CheckboxRenderer = React.memo(function CheckboxRenderer(props: {
  block: { id: string; props: { type: string; checked: boolean; label: string } };
  editor: { document: unknown; updateBlock: (block: unknown, update: { props: Record<string, unknown> }) => void };
}) {
  const { block } = props;
  const { type, checked, label } = block.props;

  // Error handling hook
  const { withErrorHandling } = useErrorHandler();

  // Current file path from context
  const filePath = useFilePath();

  // Local state for immediate UI feedback
  const [localChecked, setLocalChecked] = React.useState(checked);
  
  // Track if we're currently processing a change to prevent rapid clicks
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Update local state when props change (from content reload)
  React.useEffect(() => {
    setLocalChecked(checked);
  }, [checked]);

  // Define BlockNote block type
  type BlockNoteBlock = {
    id: string;
    children?: BlockNoteBlock[];
    type?: string;
    props?: Record<string, unknown>;
  };

  // Helper to find a block in the current editor document by id
  const findBlockInDocument = React.useCallback((targetId: string): BlockNoteBlock | null => {
    const blocks = props.editor.document as BlockNoteBlock[];

    const findById = (candidateBlocks: BlockNoteBlock[]): BlockNoteBlock | null => {
      for (const candidate of candidateBlocks) {
        if (candidate.id === targetId) return candidate;
        if (candidate.children && candidate.children.length > 0) {
          const found = findById(candidate.children);
          if (found) return found;
        }
      }
      return null;
    };

    return findById(blocks);
  }, [props.editor.document]);

  // Helper function to update block with retry mechanism
  const updateBlockWithRetry = React.useCallback(async (
    blockId: string, 
    checkedValue: boolean, 
    maxRetries: number = 5,
    delayMs: number = 100
  ): Promise<boolean> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const targetBlock = findBlockInDocument(blockId);
      if (targetBlock) {
        try {
          props.editor.updateBlock(targetBlock, { props: { checked: checkedValue } });
          return true; // Successfully updated
        } catch (error) {
          console.error(`[CheckboxBlock] Failed to update block on attempt ${attempt + 1}:`, error);
        }
      }
      
      // Wait before retrying (except on last attempt)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // Don't warn - this is expected when the editor is still initializing
    console.log('[CheckboxBlock] Block not yet available in document, will sync when editor is ready');
    return false; // Block not found yet, but this is ok
  }, [findBlockInDocument, props.editor]);

  const handleChange = React.useCallback(async (newChecked: boolean | 'indeterminate') => {
    // Prevent rapid clicks while processing
    if (isProcessing) {
      console.log('[CheckboxBlock] Ignoring click - already processing');
      return;
    }
    
    setIsProcessing(true);
    
    const checkedVal = newChecked === true;

    // Immediately update local state for visual feedback
    setLocalChecked(checkedVal);

    // Try to update the block in the document with retry mechanism
    const updateSuccess = await updateBlockWithRetry(block.id, checkedVal);
    
    // Don't revert just because the block wasn't found - the editor might still be initializing
    // The local state change is valid and will be synchronized when the editor is ready
    if (!updateSuccess) {
      console.log('[CheckboxBlock] Block update deferred - editor may still be initializing');
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

              // Use safeInvoke which handles non-Tauri environments gracefully
              const invokeResult = await safeInvoke('update_habit_status', {
                habitPath: filePath,
                newStatus: statusValue,
              }, null);

              if (invokeResult === null) {
                // Backend update failed, but keep the UI state
                // This allows the checkbox to work even when backend is unavailable
                console.log('[CheckboxBlock] Backend update skipped (may not be in Tauri environment)');
                // Don't revert - let the UI remain responsive
                return null;
              }

              return { statusValue };
            },
            'Failed to update habit status'
          );

          if (result) {
            // Show success toast
            const normalizedPath = filePath.replace(/\\/g, '/');
            const habitName = normalizedPath.split('/').pop()?.replace(/\.(md|markdown)$/i, '') || 'Habit';
            const statusLabel = checkedVal ? 'Complete' : 'To Do';

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
            // Backend operation failed but UI should remain responsive
            console.log('[CheckboxBlock] Habit update could not be saved to backend');
            // Don't revert UI - keep it responsive for the user
          }
        }
      }
    }
    
    // Reset processing flag after a short delay
    setTimeout(() => setIsProcessing(false), 500);
  }, [type, withErrorHandling, filePath, block.id, updateBlockWithRetry, isProcessing]);

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