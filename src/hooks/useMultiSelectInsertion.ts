/**
 * @fileoverview Hook for inserting multiselect fields in BlockNote
 * Note: Status, Effort, and Project Status now use SingleSelectBlock
 * This hook is for fields that support multiple values (tags, contexts, etc.)
 * @author Development Team
 * @created 2025-01-XX
 */

import { useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { createMultiSelectBlock } from '@/utils/multiselect-block-helpers';

// Using any type for editor due to complex type constraints with custom schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useMultiSelectInsertion(editor: any) {
  const handleInsertContext = useCallback(
    (event: KeyboardEvent) => {
      if (!editor) {
        return;
      }

      // Check if we're in the editor.
      const isInEditor = document.activeElement?.closest('.bn-editor');
      if (!isInEditor) {
        return;
      }

      // Prevent default browser behavior
      event.preventDefault();

      const block = createMultiSelectBlock('contexts', 'Contexts', []);
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
    },
    [editor],
  );

  useHotkeys('mod+shift+c', handleInsertContext);

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

  return { insertMultiSelect };
}