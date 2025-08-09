/**
 * @fileoverview Hook for inserting multiselect fields in BlockNote
 * @author Development Team
 * @created 2025-01-XX
 */

import { useEffect } from 'react';
import { createMultiSelectBlock } from '@/utils/multiselect-block-helpers';

// Using any type for editor due to complex type constraints with custom schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useMultiSelectInsertion(editor: any) {
  useEffect(() => {
    if (!editor) return;

    // Add keyboard shortcuts for multiselect fields
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in the editor
      const isInEditor = document.activeElement?.closest('.bn-editor');
      if (!isInEditor) return;

      // Use Cmd key on Mac, Ctrl on other platforms
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+Shift+S (Mac) or Ctrl+Shift+S (Windows/Linux) for Status field
      if (modKey && e.shiftKey && e.key === 's') {
        e.preventDefault();
        const block = createMultiSelectBlock('status', 'Status', ['not-started']);
        const currentBlock = editor.getTextCursorPosition().block;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks([block as any], currentBlock, 'after');
      }

      // Cmd+Shift+E (Mac) or Ctrl+Shift+E (Windows/Linux) for Effort field
      if (modKey && e.shiftKey && e.key === 'e') {
        e.preventDefault();
        const block = createMultiSelectBlock('effort', 'Effort', ['medium']);
        const currentBlock = editor.getTextCursorPosition().block;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks([block as any], currentBlock, 'after');
      }

      // Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux) for Project Status field
      if (modKey && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        const block = createMultiSelectBlock('project-status', 'Project Status', ['active']);
        const currentBlock = editor.getTextCursorPosition().block;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.insertBlocks([block as any], currentBlock, 'after');
      }

      // Cmd+Shift+C (Mac) or Ctrl+Shift+C (Windows/Linux) for Contexts field
      if (modKey && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        const block = createMultiSelectBlock('contexts', 'Contexts', []);
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

  // Function to manually insert multiselect blocks
  const insertMultiSelect = (type: 'status' | 'effort' | 'project-status' | 'contexts') => {
    if (!editor) return;

    let block;
    switch (type) {
      case 'status':
        block = createMultiSelectBlock('status', 'Status', ['not-started']);
        break;
      case 'effort':
        block = createMultiSelectBlock('effort', 'Effort', ['medium']);
        break;
      case 'project-status':
        block = createMultiSelectBlock('project-status', 'Project Status', ['active']);
        break;
      case 'contexts':
        block = createMultiSelectBlock('contexts', 'Contexts', []);
        break;
    }

    const currentBlock = editor.getTextCursorPosition().block;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.insertBlocks([block as any], currentBlock, 'after');
  };

  return { insertMultiSelect };
}