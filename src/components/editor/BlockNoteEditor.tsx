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
import { BlockNoteSchema, defaultBlockSpecs, Block } from "@blocknote/core";
import { MultiSelectBlock } from './blocks/MultiSelectBlock';
import { SingleSelectBlock } from './blocks/SingleSelectBlock';
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
  // Create custom schema with multiselect and singleselect blocks
  const schema = BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      multiselect: MultiSelectBlock,
      singleselect: SingleSelectBlock,
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
          const hasMultiselect = blocks.some((b: Block) => b.type === 'multiselect');
          if (hasMultiselect) {
            console.log('Found multiselect blocks in parsed content:', blocks.filter((b: Block) => b.type === 'multiselect'));
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