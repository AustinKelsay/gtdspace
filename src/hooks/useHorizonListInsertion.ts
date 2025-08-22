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
    
    // In the future, keyboard shortcuts for list insertion can be added here
    // For now, lists are inserted through slash commands or programmatically
  }, [editor]);
}

/**
 * Standalone function to insert a horizon list at the current cursor position
 * @param editor The BlockNote editor instance
 * @param listType The type of list to insert
 */
export function insertHorizonList(
  editor: BlockNoteEditor | null,
  listType: 'projects-list' | 'areas-list' | 'goals-list' | 'visions-list' | 
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: listType as any,
      props: {
        listType: listType.replace('-list', ''),
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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