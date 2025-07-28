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
import { codeBlock } from "@blocknote/code-block";
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
}) => {
  // Create the BlockNote editor instance with code block support
  const editor = useCreateBlockNote({
    codeBlock,
  });

  // Track if initial content has been loaded
  const initialContentLoaded = useRef(false);

  // Handle initial content - only on mount
  useEffect(() => {
    const loadContent = async () => {
      if (!initialContentLoaded.current && content && editor && content.trim() !== '') {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(content);
          editor.replaceBlocks(editor.document, blocks);
          initialContentLoaded.current = true;
        } catch (error) {
          console.error('Error parsing initial content:', error);
        }
      }
    };
    loadContent();
  }, [content, editor]); // Now safe to include content in deps

  // Handle content changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = async () => {
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