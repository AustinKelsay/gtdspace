/**
 * @fileoverview WYSIWYG editor component using Tiptap for rich text editing
 * @author Development Team
 * @created 2024-01-XX
 * @updated 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { common, createLowlight } from 'lowlight';

// Additional language imports for lowlight
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import c from 'highlight.js/lib/languages/c';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import html from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import toml from 'highlight.js/lib/languages/ini';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import powershell from 'highlight.js/lib/languages/powershell';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

// Internal imports
import { cn } from '@/lib/utils';
import { htmlToMarkdown, markdownToHtml } from './MarkdownSerializer';

// === TYPES ===
/**
 * Configuration options for the WYSIWYG editor
 */
export interface WYSIWYGEditorProps {
  /** Initial content in markdown format */
  initialContent?: string;
  /** Callback fired when content changes */
  onChange?: (markdown: string) => void;
  /** Whether the editor is editable */
  editable?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Callback to receive the editor instance */
  onEditorCreate?: (editor: any) => void;
}

/**
 * Reference interface for imperative editor actions
 */
export interface WYSIWYGEditorRef {
  /** Get current content as markdown */
  getMarkdown: () => string;
  /** Set content from markdown */
  setMarkdown: (markdown: string) => void;
  /** Focus the editor */
  focus: () => void;
  /** Clear editor content */
  clear: () => void;
  /** Check if editor has content */
  isEmpty: () => boolean;
}

// === CONSTANTS ===
// Create lowlight instance
const lowlight = createLowlight(common);

// Register additional languages
lowlight.register('javascript', javascript);
lowlight.register('js', javascript);
lowlight.register('typescript', typescript);
lowlight.register('ts', typescript);
lowlight.register('python', python);
lowlight.register('py', python);
lowlight.register('java', java);
lowlight.register('cpp', cpp);
lowlight.register('c++', cpp);
lowlight.register('c', c);
lowlight.register('csharp', csharp);
lowlight.register('cs', csharp);
lowlight.register('go', go);
lowlight.register('golang', go);
lowlight.register('rust', rust);
lowlight.register('rs', rust);
lowlight.register('php', php);
lowlight.register('ruby', ruby);
lowlight.register('rb', ruby);
lowlight.register('html', html);
lowlight.register('css', css);
lowlight.register('scss', scss);
lowlight.register('json', json);
lowlight.register('yaml', yaml);
lowlight.register('yml', yaml);
lowlight.register('toml', toml);
lowlight.register('xml', xml);
lowlight.register('bash', bash);
lowlight.register('sh', bash);
lowlight.register('shell', bash);
lowlight.register('powershell', powershell);
lowlight.register('ps1', powershell);
lowlight.register('sql', sql);
lowlight.register('markdown', markdown);
lowlight.register('md', markdown);
lowlight.register('dockerfile', dockerfile);

/**
 * Default configuration for Tiptap extensions
 */
const DEFAULT_EXTENSIONS = [
  StarterKit.configure({
    bulletList: {
      keepMarks: true,
      keepAttributes: false,
    },
    orderedList: {
      keepMarks: true,
      keepAttributes: false,
    },
    codeBlock: false, // We'll use CodeBlockLowlight instead
  }),
  Table.configure({
    resizable: true,
    handleWidth: 5,
    cellMinWidth: 50,
  }),
  TableRow,
  TableHeader,
  TableCell,
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: 'plaintext',
  }),
  Image.configure({
    inline: true,
    allowBase64: true,
    HTMLAttributes: {
      class: 'editor-image rounded-lg max-w-full h-auto',
    },
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    HTMLAttributes: {
      class: 'text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300',
    },
  }),
];

// === MAIN COMPONENT ===
/**
 * WYSIWYG editor component with markdown round-trip conversion
 * 
 * Provides rich text editing capabilities using Tiptap/ProseMirror with
 * bidirectional markdown serialization for seamless source/WYSIWYG mode switching.
 * 
 * @param props - Component props
 * @returns JSX element containing the WYSIWYG editor
 * 
 * @example
 * ```tsx
 * const editorRef = useRef<WYSIWYGEditorRef>(null);
 * 
 * <WYSIWYGEditor
 *   ref={editorRef}
 *   initialContent="# Hello World\n\nThis is **bold** text."
 *   onChange={(markdown) => console.log('Content changed:', markdown)}
 *   placeholder="Start writing..."
 *   autoFocus
 * />
 * ```
 */
export const WYSIWYGEditor = forwardRef<WYSIWYGEditorRef, WYSIWYGEditorProps>(({
  initialContent = '',
  onChange,
  editable = true,
  className,
  placeholder = 'Start writing...',
  autoFocus = false,
  onEditorCreate,
}, ref) => {
  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: DEFAULT_EXTENSIONS,
    content: initialContent,
    editable,
    autofocus: autoFocus,
    onCreate: ({ editor }) => {
      // Set initial placeholder
      if (placeholder && editor.isEmpty) {
        editor.view.dom.setAttribute('data-placeholder', placeholder);
      }
      // Notify parent of editor creation
      if (onEditorCreate) {
        onEditorCreate(editor);
      }
    },
    onUpdate: ({ editor }) => {
      // Convert to markdown and notify parent
      if (onChange) {
        const html = editor.getHTML();
        const result = htmlToMarkdown(html);
        onChange(result.success ? result.content : html);
      }
    },
    onFocus: () => {
      // Remove placeholder on focus if empty
      if (editor?.isEmpty) {
        editor.view.dom.removeAttribute('data-placeholder');
      }
    },
    onBlur: () => {
      // Add placeholder on blur if empty
      if (editor?.isEmpty && placeholder) {
        editor.view.dom.setAttribute('data-placeholder', placeholder);
      }
    },
  });

  // Expose imperative methods through ref
  useImperativeHandle(ref, () => ({
    getMarkdown: () => {
      if (!editor) return '';
      const html = editor.getHTML();
      const result = htmlToMarkdown(html);
      return result.success ? result.content : '';
    },
    setMarkdown: (markdown: string) => {
      if (!editor) return;
      const result = markdownToHtml(markdown);
      editor.commands.setContent(result.success ? result.content : markdown);
    },
    focus: () => {
      editor?.commands.focus();
    },
    clear: () => {
      editor?.commands.clearContent();
    },
    isEmpty: () => {
      return editor?.isEmpty ?? true;
    },
  }), [editor]);

  // Handle content updates from parent
  useEffect(() => {
    if (editor && initialContent) {
      const result = markdownToHtml(initialContent);
      const html = result.success ? result.content : initialContent;
      if (editor.getHTML() !== html) {
        editor.commands.setContent(html);
      }
    }
  }, [editor, initialContent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  if (!editor) {
    return (
      <div className={cn('h-full flex items-center justify-center', className)}>
        <div className="text-sm text-muted-foreground">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className={cn('wysiwyg-editor h-full flex flex-col', className)}>
      <EditorContent
        editor={editor}
        className="flex-1 prose prose-sm dark:prose-invert max-w-none p-4 focus:outline-none overflow-auto"
      />
    </div>
  );
});

WYSIWYGEditor.displayName = 'WYSIWYGEditor';


// === EXPORTS ===
export default WYSIWYGEditor;