/**
 * @fileoverview Hook for inserting GTD horizon reference blocks
 * @author Development Team
 * @created 2025-01-XX
 */

import { useEffect } from 'react';

/**
 * Hook that adds horizon references insertion capability to BlockNote editor
 * 
 * Keyboard shortcuts:
 * - Ctrl/Cmd+Alt+A: Insert Areas of Focus references
 * - Ctrl/Cmd+Alt+G: Insert Goals references
 * - Ctrl/Cmd+Alt+V: Insert Vision references
 * - Ctrl/Cmd+Alt+U: Insert Purpose & Principles references (U for "Ultimate")
 */
// Using any type for editor due to complex type constraints with custom schema
export function useHorizonReferencesInsertion(editor: any) {
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl/Cmd+Alt modifier
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      if (!isCtrlOrCmd || !event.altKey) return;
      
      let blockType = '';
      
      // Determine which type to insert based on key
      switch (event.key.toLowerCase()) {
        case 'a':
          blockType = 'areas-references';
          break;
        case 'g':
          blockType = 'goals-references';
          break;
        case 'v':
          blockType = 'vision-references';
          break;
        case 'u':
          blockType = 'purpose-references';
          break;
        default:
          return; // Not a horizon reference shortcut
      }
      
      event.preventDefault();
      
      // Get the current selection
      const selection = editor.getTextCursorPosition();
      if (!selection?.block) {
        console.log('No block selected for horizon references insertion');
        return;
      }

      // Insert a new horizon references block
      const newBlock = {
        type: blockType,
        props: {
          references: '',
        },
      };

      // Insert after the current block
      editor.insertBlocks([newBlock], selection.block, 'after');
      
      // Focus on the new block
      setTimeout(() => {
        const blocks = editor.document;
        const newBlockIndex = blocks.findIndex((b: any) => b.id === selection.block.id) + 1;
        if (newBlockIndex < blocks.length) {
          editor.setTextCursorPosition(blocks[newBlockIndex], 'end');
        }
      }, 100);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor]);
}