/**
 * @fileoverview Hook for inserting datetime fields in BlockNote
 * @author Development Team
 * @created 2025-01-17
 */

import { useEffect } from 'react';
import { createDateTimeBlock, type DateTimeFieldType } from '@/utils/datetime-block-helpers';

// Using any type for editor due to complex type constraints with custom schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDateTimeInsertion(editor: any) {
  useEffect(() => {
    if (!editor) return;

    // Safely resolve an insertion anchor; fallback to last doc block
    const getInsertionAnchor = () => {
      try {
        const pos = editor.getTextCursorPosition?.();
        return pos?.block ?? editor.document?.[editor.document.length - 1] ?? undefined;
      } catch {
        return editor?.document?.[editor.document.length - 1];
      }
    };

    const insertAfterCurrent = (block: unknown) => {
      const anchor = getInsertionAnchor();
      if (!anchor) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.insertBlocks([block as any], anchor, 'after');
    };

    // Add keyboard shortcuts for datetime fields
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Check if we're in the editor
      const isInEditor = document.activeElement?.closest('.bn-editor');
      if (!isInEditor) return;

      // Use Cmd key on Mac, Ctrl on other platforms
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+Alt+D (Mac) or Ctrl+Alt+D (Windows/Linux) for Due Date field (with Shift for time)
      if (modKey && e.altKey && e.key === 'd') {
        e.preventDefault();
        const includeTime = e.shiftKey; // Add Shift to include time
        const block = createDateTimeBlock('due_date', 'Due Date', '', includeTime);
        insertAfterCurrent(block);
      }

      // Cmd+Alt+T (Mac) or Ctrl+Alt+T (Windows/Linux) for Focus Date with Time field
      if (modKey && e.altKey && e.key === 't') {
        e.preventDefault();
        const block = createDateTimeBlock('focus_date', 'Focus Date', '', true);
        insertAfterCurrent(block);
      }

      // Cmd+Alt+C (Mac) or Ctrl+Alt+C (Windows/Linux) for Created Date field
      if (modKey && e.altKey && e.key === 'c') {
        e.preventDefault();
        const now = new Date().toISOString();
        const block = createDateTimeBlock('created_date_time', 'Created', now, true);
        insertAfterCurrent(block);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor]);

  // Function to manually insert datetime blocks
  const insertDateTime = (
    type: DateTimeFieldType,
    includeTime = false,
    defaultValue?: string
  ) => {
    if (!editor) return;

    const isCreated = type === 'created_date_time';
    const value = defaultValue ?? (isCreated ? new Date().toISOString() : '');
    const normalizedIncludeTime = isCreated ? true : includeTime;
    const block = createDateTimeBlock(type, undefined, value, normalizedIncludeTime);

    // Safely resolve current block from cursor position with fallbacks
    let cursorPos: unknown;
    try {
      cursorPos = editor.getTextCursorPosition?.();
    } catch {
      cursorPos = undefined;
    }

    // Prefer the cursor block, then root block, then last document block
    const currentBlock = (cursorPos as { block?: unknown } | undefined)?.block
      ?? editor.getRootBlock?.()
      ?? editor.document?.[editor.document.length - 1]
      ?? undefined;

    if (!currentBlock) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.insertBlocks([block as any], currentBlock, 'after');
  };

  return { insertDateTime };
}