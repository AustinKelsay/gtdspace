/**
 * @fileoverview Hook for inserting single select fields in BlockNote
 * @author Development Team
 * @created 2025-01-XX
 */

import { useEffect } from 'react';
import { createSingleSelectBlock } from '@/utils/singleselect-block-helpers';

// Using any type for editor due to complex type constraints with custom schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSingleSelectInsertion(editor: any) {
  useEffect(() => {
    if (!editor) return;

    // Add keyboard shortcuts for single select fields
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in the editor
      const isInEditor = document.activeElement?.closest('.bn-editor');
      if (!isInEditor) return;

      // Use Cmd key on Mac, Ctrl on other platforms
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+Alt+S (Mac) or Ctrl+Alt+S (Windows/Linux) for Single Status field
      if (modKey && e.altKey && e.key === 's') {
        e.preventDefault();
        const block = createSingleSelectBlock('status', 'Status', 'in-progress');
        const currentBlock = editor.getTextCursorPosition().block;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks([block as any], currentBlock, 'after');
      }

      // Cmd+Alt+E (Mac) or Ctrl+Alt+E (Windows/Linux) for Single Effort field
      if (modKey && e.altKey && e.key === 'e') {
        e.preventDefault();
        const block = createSingleSelectBlock('effort', 'Effort', 'medium');
        const currentBlock = editor.getTextCursorPosition().block;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks([block as any], currentBlock, 'after');
      }

      // Cmd+Alt+P (Mac) or Ctrl+Alt+P (Windows/Linux) for Single Project Status field
      if (modKey && e.altKey && e.key === 'p') {
        e.preventDefault();
        const block = createSingleSelectBlock('project-status', 'Project Status', 'in-progress');
        const currentBlock = editor.getTextCursorPosition().block;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks([block as any], currentBlock, 'after');
      }

      // Cmd+Alt+F (Mac) or Ctrl+Alt+F (Windows/Linux) for Habit Frequency field
      if (modKey && e.altKey && e.key === 'f') {
        e.preventDefault();
        const block = createSingleSelectBlock('habit-frequency', 'Frequency', 'daily');
        const currentBlock = editor.getTextCursorPosition().block;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks([block as any], currentBlock, 'after');
      }

      // Cmd+Alt+H (Mac) or Ctrl+Alt+H (Windows/Linux) for Habit Status field
      if (modKey && e.altKey && e.key === 'h') {
        e.preventDefault();
        const block = createSingleSelectBlock('habit-status', 'Habit Status', 'todo');
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

  // Function to manually insert single select blocks
  const insertSingleSelect = (type: 'status' | 'effort' | 'project-status' | 'habit-frequency' | 'habit-status') => {
    if (!editor) return;

    let block;
    switch (type) {
      case 'status':
        block = createSingleSelectBlock('status', 'Status', 'in-progress');
        break;
      case 'effort':
        block = createSingleSelectBlock('effort', 'Effort', 'medium');
        break;
      case 'project-status':
        block = createSingleSelectBlock('project-status', 'Project Status', 'in-progress');
        break;
      case 'habit-frequency':
        block = createSingleSelectBlock('habit-frequency', 'Frequency', 'daily');
        break;
      case 'habit-status':
        block = createSingleSelectBlock('habit-status', 'Habit Status', 'todo');
        break;
    }

    const currentBlock = editor.getTextCursorPosition().block;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.insertBlocks([block as any], currentBlock, 'after');
  };

  return { insertSingleSelect };
}