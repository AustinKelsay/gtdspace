/**
 * @fileoverview Hook for inserting GTD references blocks
 * @author Development Team
 * @created 2025-01-XX
 */

import { useEffect } from 'react';

/**
 * Hook that adds references insertion capability to BlockNote editor
 * 
 * Listens for Ctrl/Cmd+Alt+R to insert a references block
 */
// Using any type for editor due to complex type constraints with custom schema
export function useReferencesInsertion(editor: any) {
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl/Cmd+Alt+R
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      if (isCtrlOrCmd && event.altKey && event.key === 'r') {
        event.preventDefault();
        
        // Get the current selection
        const selection = editor.getTextCursorPosition();
        if (!selection?.block) {
          console.log('No block selected for references insertion');
          return;
        }

        // Insert a new references block
        const newBlock = {
          type: 'references' as const,
          props: {
            references: '',
          },
        };

        // Insert after the current block
        editor.insertBlocks([newBlock], selection.block, 'after');
        
        // Focus on the new block
        setTimeout(() => {
          const blocks = editor.document;
          const newBlockIndex = blocks.findIndex(b => b.id === selection.block.id) + 1;
          if (newBlockIndex < blocks.length) {
            editor.setTextCursorPosition(blocks[newBlockIndex], 'end');
          }
        }, 100);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor]);
}