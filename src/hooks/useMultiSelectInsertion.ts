/**
 * @fileoverview Hook for inserting multiselect fields in BlockNote
 * Note: Status, Effort, and Project Status now use SingleSelectBlock
 * This hook is for fields that support multiple values (tags, contexts, etc.)
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

      // Note: Status, Effort, and Project Status shortcuts have been moved to SingleSelectInsertion
      // Use Cmd+Alt+S/E/P instead of Cmd+Shift+S/E/P

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
  const insertMultiSelect = (type: 'contexts' | 'tags' | 'categories') => {
    if (!editor) return;

    let block;
    switch (type) {
      case 'contexts':
        block = createMultiSelectBlock('contexts', 'Contexts', []);
        break;
      case 'tags':
        block = createMultiSelectBlock('tags', 'Tags', []);
        break;
      case 'categories':
        block = createMultiSelectBlock('categories', 'Categories', []);
        break;
      default:
        console.warn(`MultiSelect: Type '${type}' is not supported. Use SingleSelectBlock for status/effort/project-status.`);
        return;
    }

    const currentBlock = editor.getTextCursorPosition().block;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.insertBlocks([block as any], currentBlock, 'after');
  };

  return { insertMultiSelect };
}