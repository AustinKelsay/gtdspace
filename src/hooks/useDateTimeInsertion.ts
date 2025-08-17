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

    // Add keyboard shortcuts for datetime fields
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in the editor
      const isInEditor = document.activeElement?.closest('.bn-editor');
      if (!isInEditor) return;

      // Use Cmd key on Mac, Ctrl on other platforms
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+Alt+D (Mac) or Ctrl+Alt+D (Windows/Linux) for Due Date field
      if (modKey && e.altKey && e.key === 'd') {
        e.preventDefault();
        const block = createDateTimeBlock('due_date', 'Due Date', '', false);
        const currentBlock = editor.getTextCursorPosition().block;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks([block as any], currentBlock, 'after');
      }

      // Cmd+Alt+T (Mac) or Ctrl+Alt+T (Windows/Linux) for Focus Date with Time field
      if (modKey && e.altKey && e.key === 't') {
        e.preventDefault();
        const block = createDateTimeBlock('focus_date', 'Focus Date', '', true);
        const currentBlock = editor.getTextCursorPosition().block;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks([block as any], currentBlock, 'after');
      }

      // Cmd+Alt+C (Mac) or Ctrl+Alt+C (Windows/Linux) for Created Date field
      if (modKey && e.altKey && e.key === 'c') {
        e.preventDefault();
        const now = new Date().toISOString();
        const block = createDateTimeBlock('created_date', 'Created', now, true);
        const currentBlock = editor.getTextCursorPosition().block;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks([block as any], currentBlock, 'after');
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

    const value = defaultValue || (type === 'created_date' ? new Date().toISOString() : '');
    const block = createDateTimeBlock(type, undefined, value, includeTime);

    const currentBlock = editor.getTextCursorPosition().block;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.insertBlocks([block as any], currentBlock, 'after');
  };

  return { insertDateTime };
}