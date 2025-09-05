/**
 * @fileoverview BlockNote WYSIWYG editor component
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Block-based WYSIWYG editor like Notion
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteSchema, defaultBlockSpecs, PartialBlock } from "@blocknote/core";
import debounce from 'lodash.debounce';
import { MultiSelectBlock } from './blocks/MultiSelectBlock';
import { SingleSelectBlock } from './blocks/SingleSelectBlock';
import { CheckboxBlock } from './blocks/CheckboxBlock';
import { DateTimeSelectBlock } from './blocks/DateTimeSelectBlock';
import { ReferencesBlock } from './blocks/ReferencesBlock';
import {
  ProjectsReferencesBlock,
  AreasReferencesBlock,
  GoalsReferencesBlock,
  VisionReferencesBlock,
  PurposeReferencesBlock
} from './blocks/HorizonReferencesBlock';
import {
  ProjectsListBlock,
  AreasListBlock,
  GoalsListBlock,
  VisionsListBlock,
  ProjectsAndAreasListBlock,
  GoalsAndAreasListBlock,
  VisionsAndGoalsListBlock
} from './blocks/HorizonListBlock';
import { HabitsListBlock } from './blocks/HabitsListBlock';
import { postProcessBlockNoteBlocks } from '@/utils/blocknote-preprocessing';
import { useMultiSelectInsertion } from '@/hooks/useMultiSelectInsertion';
import { useSingleSelectInsertion } from '@/hooks/useSingleSelectInsertion';
import { useDateTimeInsertion } from '@/hooks/useDateTimeInsertion';
import { useReferencesInsertion } from '@/hooks/useReferencesInsertion';
import { useHorizonReferencesInsertion } from '@/hooks/useHorizonReferencesInsertion';
import { useHorizonListInsertion } from '@/hooks/useHorizonListInsertion';
import './blocknote-theme.css';
import { FilePathProvider } from './FilePathContext';

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
  const lastEmittedMarkdownRef = useRef<string>('');

  // Update lastEmittedMarkdownRef when the incoming content prop changes
  useEffect(() => {
    lastEmittedMarkdownRef.current = content;
  }, [content]);

  // Store the current file path in a way that list blocks can access it
  React.useEffect(() => {
    if (filePath) {
      window.localStorage.setItem('blocknote-current-file', filePath);
    }
  }, [filePath]);
  // Create custom schema with multiselect, singleselect, checkbox, datetime, references, and list blocks
  const schema = BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      multiselect: MultiSelectBlock,
      singleselect: SingleSelectBlock,
      checkbox: CheckboxBlock,
      datetime: DateTimeSelectBlock,
      references: ReferencesBlock,
      'projects-references': ProjectsReferencesBlock,
      'areas-references': AreasReferencesBlock,
      'goals-references': GoalsReferencesBlock,
      'vision-references': VisionReferencesBlock,
      'purpose-references': PurposeReferencesBlock,
      'projects-list': ProjectsListBlock,
      'areas-list': AreasListBlock,
      'goals-list': GoalsListBlock,
      'visions-list': VisionsListBlock,
      'habits-list': HabitsListBlock,
      'projects-areas-list': ProjectsAndAreasListBlock,
      'goals-areas-list': GoalsAndAreasListBlock,
      'visions-goals-list': VisionsAndGoalsListBlock,
    },
  });


  // Create the BlockNote editor instance with custom schema
  const editor = useCreateBlockNote({
    schema,
  })

  // Add multiselect insertion capabilities
  useMultiSelectInsertion(editor);

  // Add singleselect insertion capabilities
  useSingleSelectInsertion(editor);

  // Add datetime insertion capabilities
  useDateTimeInsertion(editor);

  // Add references insertion capabilities
  useReferencesInsertion(editor);

  // Add horizon references insertion capabilities
  useHorizonReferencesInsertion(editor);

  // Add horizon list insertion capabilities
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useHorizonListInsertion(editor as any);

  // Track if initial content has been loaded
  const initialContentLoaded = useRef(false);
  // Track if we should ignore the next onChange event
  const ignoreNextChange = useRef(false);
  // Track the last processed content to avoid unnecessary updates
  const lastProcessedContent = useRef<string>('');

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
          if (hasMultiselect && import.meta.env.VITE_DEBUG_BLOCKNOTE) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.log('Found multiselect blocks in parsed content:', (processedBlocks as any[]).filter((b: any) => b.type === 'multiselect'));
          }

          // Cast to PartialBlock array to ensure proper typing
          editor.replaceBlocks(editor.document, processedBlocks as PartialBlock[]);
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

  // Debounced content update to avoid rapid replacements
  // Use useMemo to create a stable debounced function
  const debouncedContentUpdate = useMemo(
    () => debounce(async (newContent: string) => {
      if (!editor || !initialContentLoaded.current) return;

      // Skip if content hasn't meaningfully changed
      if (newContent === lastProcessedContent.current) return;
      // Critical: If the incoming content equals what we last emitted,
      // it's an echo of our own edit. Do NOT re-parse/replace or block IDs will churn.
      if (newContent === lastEmittedMarkdownRef.current) return;

      try {
        // Set flag to ignore the onChange event from content update
        ignoreNextChange.current = true;

        // Parse and update blocks
        const parsedBlocks = await editor.tryParseMarkdownToBlocks(newContent);
        const processedBlocks = postProcessBlockNoteBlocks(parsedBlocks as unknown[], newContent) as typeof parsedBlocks;

        // Check if this is a habit file to add special animation
        const isHabitFile = newContent.includes('## History') && newContent.includes('[!checkbox:habit-status:');

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
        lastProcessedContent.current = newContent;

        // Reset flag after update
        setTimeout(() => {
          ignoreNextChange.current = false;
        }, 50);
      } catch (error) {
        console.error('Error updating content:', error);
        lastProcessedContent.current = newContent; // Update even on error to prevent infinite retries
      }
    }, 300), // 300ms debounce for external updates
    [editor] // Only depend on editor, refs are stable
  );

  // REMOVED: Content update useEffect that was causing typing interruptions
  // This was triggering block reprocessing during normal typing after the isInternalChange flag reset
  // External updates (habits, file changes) are now handled through specific events only

  // Handle habit content updates explicitly - these are real external changes that need processing
  useEffect(() => {
    if (!editor || !filePath) return;

    const handleHabitContentChanged = async (event: CustomEvent<{ filePath: string }>) => {
      // Only process if this is for the current file
      if (event.detail.filePath === filePath && initialContentLoaded.current) {
        try {
          // First, safely check if we're in Tauri context
          let inTauriContext = false;
          try {
            const tauriReady = await import('@/utils/tauri-ready');
            inTauriContext = tauriReady.checkTauriContextAsync ? await tauriReady.checkTauriContextAsync() : false;
          } catch (importError) {
            console.warn('Could not import tauri-ready module:', importError);
            return; // Bail early if we can't check Tauri context
          }

          if (!inTauriContext) {
            console.warn('Habit content update skipped - not in Tauri context');
            return;
          }

          // Only import invoke if we're definitely in Tauri context
          let freshContent: string;
          try {
            const tauriCore = await import('@tauri-apps/api/core');
            if (!tauriCore.invoke) {
              console.error('Tauri invoke not available');
              return;
            }
            // Read fresh content from disk instead of using potentially stale prop
            freshContent = await tauriCore.invoke<string>('read_file', { path: filePath });
          } catch (invokeError) {
            console.error('Failed to invoke Tauri read_file:', invokeError);
            return; // Exit without throwing to prevent event handler crash
          }

          // Use the fresh content for the update
          debouncedContentUpdate(freshContent);
        } catch (error) {
          // This catch is for any unexpected errors
          console.error('Unexpected error in habit content update handler:', error);
          // Don't throw - return gracefully to prevent event handler crash
        }
      }
    };

    window.addEventListener('habit-content-changed', handleHabitContentChanged as EventListener);

    return () => {
      window.removeEventListener('habit-content-changed', handleHabitContentChanged as EventListener);
    };
  }, [editor, filePath, debouncedContentUpdate]); // No 'content' in deps - we read fresh from disk

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedContentUpdate.cancel();
    };
  }, [debouncedContentUpdate]);

  // Removed legacy window-global propagation of filePath; use context instead

  // Typing activity detection removed - no auto-save interference now

  // Handle content changes
  useEffect(() => {
    if (!editor) return;

    // Helper: get full plain text of a paragraph block
    const getParagraphPlainText = (block: unknown): string => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = block as any;
      if (!b?.content) return '';
      if (typeof b.content === 'string') return b.content as string;
      if (Array.isArray(b.content)) {
        return b.content
          .map((item: unknown) => {
            if (typeof item === 'string') return item as string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const i = item as any;
            return typeof i?.text === 'string' ? (i.text as string) : '';
          })
          .join('');
      }
      return '';
    };

    const handleUpdate = async () => {
      // Skip onChange if we're loading initial content
      if (ignoreNextChange.current) {
        return;
      }

      try {
        // Custom handling for our custom blocks
        const blocks = editor.document as unknown[];

        // Batch standard blocks to preserve lists/spacing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let standardBuffer: any[] = [];
        const markdownParts: string[] = [];

        const flushStandardBuffer = async () => {
          if (standardBuffer.length === 0) return;
          try {
            const groupMarkdown = await editor.blocksToMarkdownLossy(standardBuffer);
            markdownParts.push(groupMarkdown);
          } catch (groupError) {
            console.warn('Error converting standard block group:', groupError);
          }
          standardBuffer = [];
        };

        const isCustomBlockType = (type: string): boolean => {
          return (
            type === 'references' ||
            type === 'areas-references' ||
            type === 'goals-references' ||
            type === 'vision-references' ||
            type === 'purpose-references' ||
            type === 'singleselect' ||
            type === 'datetime' ||
            type === 'checkbox' ||
            type === 'multiselect' ||
            type === 'projects-list' ||
            type === 'areas-list' ||
            type === 'goals-list' ||
            type === 'visions-list' ||
            type === 'habits-list' ||
            type === 'projects-areas-list' ||
            type === 'goals-areas-list' ||
            type === 'visions-goals-list'
          );
        };

        for (const block of blocks) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const blockType: string = (block as any)?.type;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const props = (block as any)?.props ?? {};

          // Paragraph that contains EXACTLY a marker should export as raw marker
          if (blockType === 'paragraph') {
            const fullText = getParagraphPlainText(block).trim();
            const isMarker = (
              /^\[!references:[^\]]*\]$/.test(fullText) ||
              /^\[!areas-references:[^\]]*\]$/.test(fullText) ||
              /^\[!goals-references:[^\]]*\]$/.test(fullText) ||
              /^\[!vision-references:[^\]]*\]$/.test(fullText) ||
              /^\[!purpose-references:[^\]]*\]$/.test(fullText) ||
              /^\[!singleselect:[^\]]*\]$/.test(fullText) ||
              /^\[!datetime:[^\]]*\]$/.test(fullText) ||
              /^\[!checkbox:[^\]]*\]$/.test(fullText) ||
              /^\[!multiselect:[^\]]*\]$/.test(fullText) ||
              /^\[!projects-list\]$/.test(fullText) ||
              /^\[!areas-list\]$/.test(fullText) ||
              /^\[!goals-list\]$/.test(fullText) ||
              /^\[!visions-list\]$/.test(fullText) ||
              /^\[!habits-list\]$/.test(fullText) ||
              /^\[!projects-areas-list\]$/.test(fullText) ||
              /^\[!goals-areas-list\]$/.test(fullText) ||
              /^\[!visions-goals-list\]$/.test(fullText)
            );

            if (isMarker) {
              await flushStandardBuffer();
              markdownParts.push(fullText + '\n\n');
              continue;
            }
          }


          if (isCustomBlockType(blockType)) {
            await flushStandardBuffer();
            if (blockType === 'references') {
              const references = props?.references || '';
              markdownParts.push(`[!references:${references}]\n\n`);
            } else if (blockType === 'areas-references') {
              const references = props?.references || '';
              markdownParts.push(`[!areas-references:${references}]\n\n`);
            } else if (blockType === 'goals-references') {
              const references = props?.references || '';
              markdownParts.push(`[!goals-references:${references}]\n\n`);
            } else if (blockType === 'vision-references') {
              const references = props?.references || '';
              markdownParts.push(`[!vision-references:${references}]\n\n`);
            } else if (blockType === 'purpose-references') {
              const references = props?.references || '';
              markdownParts.push(`[!purpose-references:${references}]\n\n`);
            } else if (blockType === 'singleselect') {
              const type = props?.type || '';
              const value = props?.value || '';
              markdownParts.push(`[!singleselect:${type}:${value}]\n\n`);
            } else if (blockType === 'datetime') {
              const type = props?.type || '';
              const value = props?.value || '';
              markdownParts.push(`[!datetime:${type}:${value}]\n\n`);
            } else if (blockType === 'checkbox') {
              const type = props?.type || '';
              const checked = props?.checked || false;
              markdownParts.push(`[!checkbox:${type}:${checked}]\n\n`);
            } else if (blockType === 'multiselect') {
              const type = props?.type || '';
              const value = props?.value || '';
              markdownParts.push(`[!multiselect:${type}:${value}]\n\n`);
            } else if (blockType === 'projects-list') {
              markdownParts.push(`[!projects-list]\n\n`);
            } else if (blockType === 'areas-list') {
              markdownParts.push(`[!areas-list]\n\n`);
            } else if (blockType === 'goals-list') {
              markdownParts.push(`[!goals-list]\n\n`);
            } else if (blockType === 'visions-list') {
              markdownParts.push(`[!visions-list]\n\n`);
            } else if (blockType === 'habits-list') {
              markdownParts.push(`[!habits-list]\n\n`);
            } else if (blockType === 'projects-areas-list') {
              markdownParts.push(`[!projects-areas-list]\n\n`);
            } else if (blockType === 'goals-areas-list') {
              markdownParts.push(`[!goals-areas-list]\n\n`);
            } else if (blockType === 'visions-goals-list') {
              markdownParts.push(`[!visions-goals-list]\n\n`);
            }
          } else {
            // Collect standard blocks to convert together
            standardBuffer.push(block);
          }
        }

        await flushStandardBuffer();

        const markdown = markdownParts.join('');

        if (markdown === lastEmittedMarkdownRef.current) {
          return;
        }
        onChange(markdown);
        lastEmittedMarkdownRef.current = markdown;
      } catch (error) {
        console.error('Error converting to markdown:', error);
      }
    };

    editor.onChange(handleUpdate);
  }, [editor, onChange]);

  return (
    <FilePathProvider filePath={filePath}>
      <div className={`w-full ${className} ${darkMode ? 'dark' : ''}`}>
        <BlockNoteView
          editor={editor}
          theme={darkMode ? "dark" : "light"}
          editable={!readOnly}
          data-theming-css-variables={false}
        />
      </div>
    </FilePathProvider>
  );
};

export default BlockNoteEditor;