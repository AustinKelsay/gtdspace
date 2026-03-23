/**
 * @fileoverview Hook for inserting horizon list blocks into BlockNote editor
 * @author Development Team
 * @created 2025-01-XX
 */

import { useEffect } from 'react';
import { BlockNoteEditor } from '@blocknote/core';

/**
 * Hook that adds keyboard shortcuts for inserting horizon list blocks
 */
export function useHorizonListInsertion(editor: BlockNoteEditor | null) {
  useEffect(() => {
    if (!editor) return;

    const handleInsertHorizonList = (event: Event) => {
      const customEvent = event as CustomEvent<{
        listType?:
          | 'projects-list'
          | 'areas-list'
          | 'goals-list'
          | 'vision-list'
          | 'visions-list'
          | 'purpose-list'
          | 'projects-areas-list'
          | 'goals-areas-list'
          | 'visions-goals-list';
      }>;
      if (!customEvent.detail?.listType) return;
      insertHorizonList(editor, customEvent.detail.listType);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const isInEditor = document.activeElement?.closest('.bn-editor');
      if (!isInEditor) return;

      const isMac = navigator.platform.toLowerCase().includes('mac');
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      if (modKey && event.shiftKey && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        insertHorizonList(editor, 'vision-list');
      }

      if (modKey && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        insertHorizonList(editor, 'purpose-list');
      }
    };

    window.addEventListener('insert-horizon-list', handleInsertHorizonList);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('insert-horizon-list', handleInsertHorizonList);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor]);
}

/**
 * Standalone function to insert a horizon list at the current cursor position
 * @param editor The BlockNote editor instance
 * @param listType The type of list to insert
 */
export function insertHorizonList(
  editor: BlockNoteEditor | null,
  listType: 'projects-list' | 'areas-list' | 'goals-list' | 'vision-list' | 'visions-list' | 'purpose-list' |
           'projects-areas-list' | 'goals-areas-list' | 'visions-goals-list'
) {
  if (!editor) {
    console.warn('Cannot insert horizon list: editor is null');
    return;
  }

  try {
    // Check if we can get cursor position
    const cursorPosition = editor.getTextCursorPosition();
    if (!cursorPosition || !cursorPosition.block) {
      console.warn('Cannot insert horizon list: no cursor position available');
      return;
    }
    const currentBlock = cursorPosition.block;
    
    // Create the list block with any type for now
    // TypeScript strict typing with BlockNote custom blocks is complex
    const newBlock = {
      type: listType as any,
      props: {
        listType: listType === 'vision-list' ? 'visions' : listType.replace('-list', ''),
      },
    } as any;

    // Insert the block after current position
    editor.insertBlocks([newBlock], currentBlock, 'after');
    
    // Focus the editor
    editor.focus();
  } catch (error) {
    console.error('Failed to insert horizon list:', error);
  }
}

/**
 * Get the appropriate list type based on the current file context
 * @param filePath The current file path
 * @returns The recommended list type(s) for the current context
 */
export function getRecommendedListType(filePath: string): string[] {
  if (!filePath) return [];
  
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  
  if (normalized.includes('/areas of focus/')) {
    return ['projects-list'];
  } else if (normalized.includes('/goals/')) {
    return ['projects-areas-list'];
  } else if (normalized.includes('/vision/')) {
    return ['goals-areas-list'];
  } else if (normalized.includes('/purpose & principles/') || normalized.includes('/purpose and principles/')) {
    return ['visions-goals-list'];
  }
  
  return [];
}
