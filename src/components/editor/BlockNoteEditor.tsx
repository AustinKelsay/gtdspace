/**
 * @fileoverview BlockNote WYSIWYG editor component
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Block-based WYSIWYG editor like Notion
 */

import React, { useEffect, useRef } from 'react';
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { MultiSelectBlock } from './blocks/MultiSelectBlock';
import { SingleSelectBlock } from './blocks/SingleSelectBlock';
import { CheckboxBlock } from './blocks/CheckboxBlock';
import { postProcessBlockNoteBlocks } from '@/utils/blocknote-preprocessing';
import { useMultiSelectInsertion } from '@/hooks/useMultiSelectInsertion';
import { useSingleSelectInsertion } from '@/hooks/useSingleSelectInsertion';
import './blocknote-theme.css';

export interface BlockNoteEditorProps {
  /** Content to edit (markdown string) */
  content: string;
  /** Callback when content changes */
  onChange: (content: string) => void;
  /** Dark mode theme */
  darkMode?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Callback when editor gains focus */
  onFocus?: () => void;
  /** Callback when editor loses focus */
  onBlur?: () => void;
  /** File path for context */
  filePath?: string;
}

/**
 * BlockNote WYSIWYG editor component
 * 
 * Provides a Notion-like block-based editing experience with
 * rich text formatting, nested blocks, and slash commands.
 */
export const BlockNoteEditor: React.FC<BlockNoteEditorProps> = ({
  content,
  onChange,
  darkMode = false,
  readOnly = false,
  className = '',
  filePath,
}) => {
  // Create custom schema with multiselect, singleselect, and checkbox blocks
  const schema = BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      multiselect: MultiSelectBlock,
      singleselect: SingleSelectBlock,
      checkbox: CheckboxBlock,
    },
  });
  
  
  // Create the BlockNote editor instance with custom schema
  const editor = useCreateBlockNote({
    schema,
  });

  // Add multiselect insertion capabilities
  useMultiSelectInsertion(editor);

  // Add singleselect insertion capabilities
  useSingleSelectInsertion(editor);

  // Track if initial content has been loaded
  const initialContentLoaded = useRef(false);
  // Track if we should ignore the next onChange event
  const ignoreNextChange = useRef(false);

  // Handle initial content - only on mount
  useEffect(() => {
    const loadContent = async () => {
      if (!initialContentLoaded.current && content && editor && content.trim() !== '') {
        try {
          // Set flag to ignore the onChange event from initial content load
          ignoreNextChange.current = true;
          
          // First parse markdown to blocks
          let blocks = await editor.tryParseMarkdownToBlocks(content);
          
          // Then post-process to handle custom multiselect blocks
          blocks = postProcessBlockNoteBlocks(blocks, content);
          
          // Log to see if multiselect blocks are being created
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasMultiselect = blocks.some((b: any) => b.type === 'multiselect');
          if (hasMultiselect) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.log('Found multiselect blocks in parsed content:', blocks.filter((b: any) => b.type === 'multiselect'));
          }
          
          editor.replaceBlocks(editor.document, blocks);
          initialContentLoaded.current = true;
          
          // Reset the flag after a short delay to ensure the onChange has fired
          setTimeout(() => {
            ignoreNextChange.current = false;
          }, 100);
        } catch (error) {
          console.error('Error parsing initial content:', error);
        }
      }
    };
    loadContent();
  }, [content, editor]); // Now safe to include content in deps

  // Track previous content to detect external updates
  const previousContent = useRef(content);
  
  // Handle content updates after initial load (for real-time updates like habit history)
  useEffect(() => {
    const updateContent = async () => {
      // Skip if editor not ready or content hasn't changed
      if (!editor || !initialContentLoaded.current || content === previousContent.current) {
        return;
      }
      
      try {
        // Set flag to ignore the onChange event from content update
        ignoreNextChange.current = true;
        
        // Parse and update blocks
        let blocks = await editor.tryParseMarkdownToBlocks(content);
        blocks = postProcessBlockNoteBlocks(blocks, content);
        
        // Check if this is a habit file to add special animation
        const isHabitFile = content.includes('## History') && content.includes('[!checkbox:habit-status:');
        
        if (isHabitFile) {
          // Add a subtle animation by briefly highlighting the editor
          const editorElement = document.querySelector('.bn-editor') as HTMLElement;
          if (editorElement) {
            editorElement.style.transition = 'background-color 0.3s ease';
            editorElement.style.backgroundColor = 'rgba(34, 197, 94, 0.1)'; // Green tint for habit updates
            setTimeout(() => {
              editorElement.style.backgroundColor = '';
            }, 500);
          }
        }
        
        editor.replaceBlocks(editor.document, blocks);
        previousContent.current = content;
        
        // Reset the flag after a short delay
        setTimeout(() => {
          ignoreNextChange.current = false;
        }, 100);
      } catch (error) {
        console.error('Error updating content:', error);
        previousContent.current = content; // Update even on error to prevent infinite retries
      }
    };
    
    updateContent();
  }, [content, editor]);

  // Set file path in window context for SingleSelectBlock
  useEffect(() => {
    if (filePath) {
      (window as Window & { currentFilePath?: string }).currentFilePath = filePath;
    }
    return () => {
      delete (window as Window & { currentFilePath?: string }).currentFilePath;
    };
  }, [filePath]);

  // Handle content changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = async () => {
      // Skip onChange if we're loading initial content
      if (ignoreNextChange.current) {
        return;
      }
      
      try {
        const markdown = await editor.blocksToMarkdownLossy(editor.document);
        onChange(markdown);
      } catch (error) {
        console.error('Error converting to markdown:', error);
      }
    };

    editor.onChange(handleUpdate);
  }, [editor, onChange]);

  return (
    <div className={`w-full ${className} ${darkMode ? 'dark' : ''}`}>
      <BlockNoteView
        editor={editor}
        theme={darkMode ? "dark" : "light"}
        editable={!readOnly}
        data-theming-css-variables={false}
      />
    </div>
  );
};

export default BlockNoteEditor;