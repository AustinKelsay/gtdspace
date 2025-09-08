/**
 * @fileoverview Hook for inserting actions list blocks into BlockNote editor
 * @author Development Team
 * @created 2025-01-XX
 */

import { useEffect } from 'react';
import { BlockNoteEditor } from '@blocknote/core';

/**
 * Hook that adds keyboard shortcuts for inserting actions list blocks
 */
export function useActionsListInsertion(editor: BlockNoteEditor | null) {
  useEffect(() => {
    if (!editor) return;
    
    // In the future, keyboard shortcuts for actions list insertion can be added here
    // For now, lists are inserted through slash commands or programmatically
  }, [editor]);
}

/**
 * Standalone function to insert an actions list at the current cursor position
 * @param editor The BlockNote editor instance
 * @param statusFilter Optional status filter (e.g., 'in-progress', 'completed', 'waiting')
 */
export function insertActionsList(
  editor: BlockNoteEditor | null,
  statusFilter?: 'in-progress' | 'waiting' | 'completed' | 'cancelled'
) {
  if (!editor) {
    console.warn('Cannot insert actions list: editor is null');
    return;
  }

  try {
    // Check if we can get cursor position
    const cursorPosition = editor.getTextCursorPosition();
    if (!cursorPosition || !cursorPosition.block) {
      console.warn('Cannot insert actions list: no cursor position available');
      return;
    }
    const currentBlock = cursorPosition.block;
    
    // Create the list block with any type for now
    // TypeScript strict typing with BlockNote custom blocks is complex
    const newBlock = {
      type: 'actions-list' as any,
      props: {
        statusFilter: statusFilter || '',
      },
    } as any;

    // Insert the block after current position
    editor.insertBlocks([newBlock], currentBlock, 'after');
    
    // Focus the editor
    editor.focus();
  } catch (error) {
    console.error('Failed to insert actions list:', error);
  }
}

/**
 * Check if the current file is within a project
 * @param filePath The current file path
 * @returns True if the file is within a project folder
 */
export function isInProjectContext(filePath: string): boolean {
  if (!filePath) return false;
  
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return normalized.includes('/projects/');
}

/**
 * Get the project path from a file path
 * @param filePath The current file path
 * @returns The project path if the file is within a project, null otherwise
 */
export function getProjectPathFromFile(filePath: string): string | null {
  if (!filePath) return null;
  
  const normalized = filePath.replace(/\\/g, '/');
  const match = normalized.match(/(.+\/Projects\/[^/]+)/i);
  
  return match ? match[1] : null;
}

/**
 * Check if this is a project README file where actions list is typically placed
 * @param filePath The current file path
 * @returns True if this is a project README file
 */
export function isProjectReadme(filePath: string): boolean {
  if (!filePath) return false;
  
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return normalized.includes('/projects/') && normalized.endsWith('/readme.md');
}