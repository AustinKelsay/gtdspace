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
import { DateTimeSelectBlock } from './blocks/DateTimeSelectBlock';
import { ReferencesBlock } from './blocks/ReferencesBlock';
import { postProcessBlockNoteBlocks } from '@/utils/blocknote-preprocessing';
import { useMultiSelectInsertion } from '@/hooks/useMultiSelectInsertion';
import { useSingleSelectInsertion } from '@/hooks/useSingleSelectInsertion';
import { useDateTimeInsertion } from '@/hooks/useDateTimeInsertion';
import { useReferencesInsertion } from '@/hooks/useReferencesInsertion';
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
  // Create custom schema with multiselect, singleselect, checkbox, datetime, and references blocks
  const schema = BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      multiselect: MultiSelectBlock,
      singleselect: SingleSelectBlock,
      checkbox: CheckboxBlock,
      datetime: DateTimeSelectBlock,
      references: ReferencesBlock,
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

  // Add datetime insertion capabilities
  useDateTimeInsertion(editor);

  // Add references insertion capabilities
  useReferencesInsertion(editor);

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
          const parsedBlocks = await editor.tryParseMarkdownToBlocks(content);

          // Then post-process to handle custom blocks; cast to the schema's block type
          const processedBlocks = postProcessBlockNoteBlocks(parsedBlocks as unknown[], content) as typeof parsedBlocks;

          // Log to see if multiselect blocks are being created
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hasMultiselect = (processedBlocks as any[]).some((b: any) => b.type === 'multiselect');
          if (hasMultiselect) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.log('Found multiselect blocks in parsed content:', (processedBlocks as any[]).filter((b: any) => b.type === 'multiselect'));
          }

          editor.replaceBlocks(editor.document, processedBlocks);
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
        const parsedBlocks = await editor.tryParseMarkdownToBlocks(content);
        const processedBlocks = postProcessBlockNoteBlocks(parsedBlocks as unknown[], content) as typeof parsedBlocks;

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

        editor.replaceBlocks(editor.document, processedBlocks);
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
        // Custom handling for our custom blocks
        const blocks = editor.document;
        let markdown = '';
        
        // Convert blocks to markdown with custom handling
        for (const block of blocks) {
          const blockType = block.type;
          const props = (block as any).props;
          
          // Handle custom blocks that might be inside paragraphs
          if (blockType === 'paragraph' && (block as any).content) {
            // Check if this paragraph contains our custom syntax
            const textContent = (block as any).content?.[0]?.text || '';
            if (textContent.match(/^\[!references:/)) {
              markdown += textContent + '\n\n';
            } else if (textContent.match(/^\[!singleselect:/)) {
              markdown += textContent + '\n\n';
            } else if (textContent.match(/^\[!datetime:/)) {
              markdown += textContent + '\n\n';
            } else if (textContent.match(/^\[!checkbox:/)) {
              markdown += textContent + '\n\n';
            } else if (textContent.match(/^\[!multiselect:/)) {
              markdown += textContent + '\n\n';
            } else {
              // Regular paragraph - use default conversion
              try {
                const blockMarkdown = await editor.blocksToMarkdownLossy([block]);
                markdown += blockMarkdown;
              } catch (blockError) {
                console.warn('Error converting paragraph:', blockError);
              }
            }
          } else if (blockType === 'references') {
            const references = props?.references || '';
            markdown += `[!references:${references}]\n\n`;
          } else if (blockType === 'singleselect') {
            const type = props?.type || '';
            const value = props?.value || '';
            markdown += `[!singleselect:${type}:${value}]\n\n`;
          } else if (blockType === 'datetime') {
            const type = props?.type || '';
            const value = props?.value || '';
            markdown += `[!datetime:${type}:${value}]\n\n`;
          } else if (blockType === 'checkbox') {
            const type = props?.type || '';
            const checked = props?.checked || false;
            markdown += `[!checkbox:${type}:${checked}]\n\n`;
          } else if (blockType === 'multiselect') {
            const type = props?.type || '';
            const value = props?.value || '';
            markdown += `[!multiselect:${type}:${value}]\n\n`;
          } else {
            // Use default markdown conversion for standard blocks
            try {
              const blockMarkdown = await editor.blocksToMarkdownLossy([block]);
              markdown += blockMarkdown;
            } catch (blockError) {
              console.warn('Error converting block:', blockType, blockError);
              // Skip blocks that fail to convert
            }
          }
        }
        
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