/**
 * @fileoverview Custom BlockNote block for single select fields
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SingleSelectBlockType } from '@/utils/singleselect-block-helpers';
import { useFilePath } from '@/components/editor/FilePathContext';
import { emitMetadataChange } from '@/utils/content-event-bus';

// Define status options for GTD
const GTD_STATUS_OPTIONS = [
  { value: 'in-progress', label: 'In Progress', group: 'Status' },
  { value: 'waiting', label: 'Waiting', group: 'Status' },
  { value: 'completed', label: 'Completed', group: 'Status' },
];

// Define effort options for GTD
const GTD_EFFORT_OPTIONS = [
  { value: 'small', label: 'Small (<30 min)', group: 'Effort' },
  { value: 'medium', label: 'Medium (30-90 min)', group: 'Effort' },
  { value: 'large', label: 'Large (>90 min)', group: 'Effort' },
  { value: 'extra-large', label: 'Extra Large (>3 hours)', group: 'Effort' },
];

// Define project status options
const GTD_PROJECT_STATUS_OPTIONS = [
  { value: 'in-progress', label: 'In Progress', group: 'Project Status' },
  { value: 'waiting', label: 'Waiting', group: 'Project Status' },
  { value: 'completed', label: 'Completed', group: 'Project Status' },
];

// Define habit frequency options
const HABIT_FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Every Day', group: 'Frequency' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)', group: 'Frequency' },
  { value: 'every-other-day', label: 'Every Other Day', group: 'Frequency' },
  { value: 'twice-weekly', label: 'Twice a Week', group: 'Frequency' },
  { value: 'weekly', label: 'Once Every Week', group: 'Frequency' },
  { value: 'biweekly', label: 'Once Every Other Week', group: 'Frequency' },
  { value: 'monthly', label: 'Once a Month', group: 'Frequency' },
  { value: '5-minute', label: 'Every 5 Minutes (Testing)', group: 'Frequency' },
];

// Define habit status options
const HABIT_STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do', group: 'Habit Status' },
  { value: 'completed', label: 'Complete', group: 'Habit Status' },
];

// Memoized renderer component for single select blocks
const SingleSelectRenderer = React.memo(function SingleSelectRenderer(props: {
  block: { id: string; props: { type: SingleSelectBlockType; value: string; label: string; placeholder: string; customOptionsJson: string } };
  editor: { document: unknown; updateBlock: (block: unknown, update: { props: Record<string, unknown> }) => void };
}) {
  const { block } = props;
  const { type, value, label, placeholder, customOptionsJson } = block.props;
  const filePath = useFilePath();

  // Define BlockNote block type
  type BlockNoteBlock = {
    id: string;
    children?: BlockNoteBlock[];
    type?: string;
    props?: Record<string, unknown>;
  };

  // Helper to find a block in the current editor document by id, with optional fallback matcher
  const findBlockInDocument = React.useCallback((targetId: string, fallbackMatcher?: (candidateBlock: BlockNoteBlock) => boolean) => {

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

    let targetBlock = findById(blocks);

    if (!targetBlock && fallbackMatcher) {
      const findByMatcher = (candidateBlocks: BlockNoteBlock[]): BlockNoteBlock | null => {
        for (const candidate of candidateBlocks) {
          if (fallbackMatcher(candidate)) return candidate;
          if (candidate.children && candidate.children.length > 0) {
            const found = findByMatcher(candidate.children);
            if (found) return found;
          }
        }
        return null;
      };
      targetBlock = findByMatcher(blocks);
    }

    return targetBlock;
  }, [props.editor.document]);

  // Parse custom options from JSON - memoized
  const customOptions = React.useMemo(() => {
    try {
      return customOptionsJson ? JSON.parse(customOptionsJson) : [];
    } catch {
      return [];
    }
  }, [customOptionsJson]);

  // Get options based on type - memoized
  const options = React.useMemo(() => {
    switch (type) {
      case 'status':
        return GTD_STATUS_OPTIONS;
      case 'effort':
        return GTD_EFFORT_OPTIONS;
      case 'project-status':
        return GTD_PROJECT_STATUS_OPTIONS;
      case 'habit-frequency':
        return HABIT_FREQUENCY_OPTIONS;
      case 'habit-status':
        return HABIT_STATUS_OPTIONS;
      case 'custom':
        return customOptions || [];
      default:
        return [];
    }
  }, [type, customOptions]);

  const handleChange = React.useCallback(async (newValue: string) => {
    const selectedValue = newValue; // Use immutable copy to avoid mutation issues
    
    // If this is a habit status field, update the backend
    if (type === 'habit-status') {
      try {
        // Get the current file path from explicit context
        const currentPath = filePath || '';

        if (currentPath) {
          // Check if this is a habit file (case-insensitive and handle both forward and back slashes)
          const lower = currentPath.toLowerCase();
          const isHabitFile = lower.includes('/habits/') || lower.includes('\\habits\\');

          if (isHabitFile) {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('update_habit_status', {
              habitPath: currentPath,
              newStatus: selectedValue,
            });

            // After marking as complete, backend immediately resets to "todo"
            // Update the UI to reflect this
            if (selectedValue === 'completed') {
              // Give a brief moment to show the completion, then reset UI
              setTimeout(() => {
                const target = findBlockInDocument(
                  block.id,
                  (b) => b.type === 'singleselect' && (b.props as { type?: string })?.type === block.props.type
                );
                if (target) {
                  props.editor.updateBlock(target, {
                    props: {
                      ...target.props,
                      value: 'todo',
                    },
                  });
                  
                  // Emit reset event so consumers see the persisted state
                  const fileName = currentPath.split('/').pop() || '';
                  emitMetadataChange({
                    filePath: currentPath,
                    fileName,
                    content: '',
                    metadata: { habitStatus: 'todo' },
                    changedFields: { habitStatus: 'todo' }
                  });
                }
              }, 500); // Brief delay to show completion
            }

            // Emit initial status change event
            const fileName = currentPath.split('/').pop() || '';
            emitMetadataChange({
              filePath: currentPath,
              fileName,
              content: '', // Content not directly changed
              metadata: { habitStatus: selectedValue },
              changedFields: { habitStatus: selectedValue }
            });
          }
        }
      } catch (error) {
        console.error('[SingleSelectBlock] Failed to update habit status in backend:', error);
      }
    }

    // Find and update the block in the current document
    const findAndUpdateBlock = () => {
      const targetBlock = findBlockInDocument(
        block.id,
        (b) => b.type === 'singleselect' &&
          (b.props as { type?: string; label?: string })?.type === block.props.type &&
          (b.props as { type?: string; label?: string })?.label === block.props.label
      );

      if (targetBlock) {
        try {
          props.editor.updateBlock(targetBlock, {
            props: {
              ...targetBlock.props,
              value: selectedValue,
            },
          });
          return true;
        } catch (e) {
          console.error('Failed to update found block:', e);
          return false;
        }
      }
      return false;
    };

    // Try the update
    if (!findAndUpdateBlock()) {
      console.warn('Could not find block to update, value may not persist');
    }
  }, [type, block.id, block.props, props.editor, filePath, findBlockInDocument]);

  return (
    <div className="inline-block min-w-[200px] align-middle mx-1">
      {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
      <Select value={value || ''} onValueChange={handleChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder || `Select ${type}...`} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.length > 0 && options[0].group && (
              <SelectLabel>{options[0].group}</SelectLabel>
            )}
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
});

// Define prop schema with proper types
const singleSelectPropSchema = {
  type: {
    default: 'status' as SingleSelectBlockType,
  },
  value: {
    default: '',  // Single string value
  },
  label: {
    default: '',
  },
  placeholder: {
    default: '',
  },
  customOptionsJson: {
    default: '',  // Store options as JSON string
  },
} satisfies PropSchema;

export const SingleSelectBlock = createReactBlockSpec(
  {
    type: 'singleselect' as const,
    propSchema: singleSelectPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any; // Type assertion needed for BlockNote v0.35
      return <SingleSelectRenderer block={block} editor={props.editor} />;
    },
    parse: (element) => {
      // Check for new single select format
      if (element.tagName === 'DIV' && element.getAttribute('data-singleselect')) {
        try {
          const data = JSON.parse(element.getAttribute('data-singleselect') || '{}');
          return {
            type: data.type || 'status',
            value: data.value || '',
            label: data.label || '',
            placeholder: data.placeholder || '',
            customOptionsJson: JSON.stringify(data.customOptions || []),
          };
        } catch (e) {
          console.error('Error parsing singleselect data:', e);
          return;
        }
      }
    },
    toExternalHTML: (props) => {
      const block = props.block as { props: { type: string; value: string } };
      const { type, value } = block.props;
      // Return the markdown format that can be parsed back
      const markdownFormat = `[!singleselect:${type}:${value || ''}]`;
      // Wrap in a paragraph to ensure it's preserved in the markdown
      return <p>{markdownFormat}</p>;
    },
  }
);