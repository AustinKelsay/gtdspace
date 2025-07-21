/**
 * @fileoverview Enhanced CodeMirror editor for Phase 2
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Advanced markdown editing with CodeMirror 6
 */

import React, { useCallback, useMemo } from 'react';
import CodeMirror, { Extension } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { 
  defaultKeymap, 
  history, 
  historyKeymap,
  indentWithTab 
} from '@codemirror/commands';
import { 
  bracketMatching,
  indentOnInput,
  indentUnit 
} from '@codemirror/language';
import { 
  highlightSelectionMatches,
  searchKeymap 
} from '@codemirror/search';
import { keymap } from '@codemirror/view';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';

export interface CodeMirrorEditorProps {
  /** Content to edit */
  content: string;
  /** Callback when content changes */
  onChange: (content: string) => void;
  /** Dark mode theme */
  darkMode?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Font size in pixels */
  fontSize?: number;
  /** Tab size for indentation */
  tabSize?: number;
  /** Whether to wrap long lines */
  lineWrapping?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Optional placeholder text */
  placeholder?: string;
  /** Callback when editor gains focus */
  onFocus?: () => void;
  /** Callback when editor loses focus */
  onBlur?: () => void;
}

/**
 * Enhanced CodeMirror editor component
 * 
 * Provides a full-featured markdown editor with syntax highlighting,
 * auto-completion, search, bracket matching, and more advanced features.
 */
export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  content,
  onChange,
  darkMode = false,
  readOnly = false,
  autoFocus = false,
  showLineNumbers = true,
  fontSize = 14,
  tabSize = 2,
  lineWrapping = true,
  className = '',
  placeholder = '',
  onFocus,
  onBlur,
}) => {
  // === EDITOR CONFIGURATION ===

  const extensions = useMemo(() => {
    const exts: Extension[] = [
      // Language support
      markdown(),
      
      // Editor behavior
      history(),
      indentOnInput(),
      bracketMatching(),
      highlightSelectionMatches(),
      autocompletion(),
      
      // Indentation
      indentUnit.of(' '.repeat(tabSize)),
      
      // Keybindings
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      
      // Editor appearance
      EditorView.theme({
        '&': {
          fontSize: `${fontSize}px`,
        },
        '.cm-content': {
          padding: '16px',
          minHeight: '100%',
        },
        '.cm-focused': {
          outline: 'none',
        },
        '.cm-editor': {
          height: '100%',
        },
        '.cm-scroller': {
          fontFamily: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
        },
      }),
    ];

    // Line wrapping
    if (lineWrapping) {
      exts.push(EditorView.lineWrapping);
    }

    // Line numbers
    if (showLineNumbers) {
      exts.push(EditorState.readOnly.of(false)); // Ensure line numbers work
    }

    // Read-only mode
    if (readOnly) {
      exts.push(EditorState.readOnly.of(true));
    }

    return exts;
  }, [fontSize, tabSize, lineWrapping, showLineNumbers, readOnly]);

  // === EVENT HANDLERS ===

  const handleChange = useCallback((value: string) => {
    onChange(value);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    onBlur?.();
  }, [onBlur]);

  // === MARKDOWN SHORTCUTS ===

  const markdownShortcuts = useMemo(() => {
    return keymap.of([
      // Bold text
      {
        key: 'Ctrl-b',
        mac: 'Cmd-b',
        run: (view) => {
          const { state, dispatch } = view;
          const selection = state.selection.main;
          const selectedText = state.doc.sliceString(selection.from, selection.to);
          
          let newText;
          let newSelection;
          
          if (selectedText) {
            // Toggle bold on selected text
            if (selectedText.startsWith('**') && selectedText.endsWith('**')) {
              newText = selectedText.slice(2, -2);
              newSelection = { anchor: selection.from, head: selection.from + newText.length };
            } else {
              newText = `**${selectedText}**`;
              newSelection = { anchor: selection.from, head: selection.from + newText.length };
            }
          } else {
            // Insert bold markers and position cursor
            newText = '****';
            newSelection = { anchor: selection.from + 2, head: selection.from + 2 };
          }
          
          dispatch({
            changes: { from: selection.from, to: selection.to, insert: newText },
            selection: newSelection,
          });
          
          return true;
        },
      },
      // Italic text
      {
        key: 'Ctrl-i',
        mac: 'Cmd-i',
        run: (view) => {
          const { state, dispatch } = view;
          const selection = state.selection.main;
          const selectedText = state.doc.sliceString(selection.from, selection.to);
          
          let newText;
          let newSelection;
          
          if (selectedText) {
            // Toggle italic on selected text
            if (selectedText.startsWith('*') && selectedText.endsWith('*') && !selectedText.startsWith('**')) {
              newText = selectedText.slice(1, -1);
              newSelection = { anchor: selection.from, head: selection.from + newText.length };
            } else {
              newText = `*${selectedText}*`;
              newSelection = { anchor: selection.from, head: selection.from + newText.length };
            }
          } else {
            // Insert italic markers and position cursor
            newText = '**';
            newSelection = { anchor: selection.from + 1, head: selection.from + 1 };
          }
          
          dispatch({
            changes: { from: selection.from, to: selection.to, insert: newText },
            selection: newSelection,
          });
          
          return true;
        },
      },
      // Insert link
      {
        key: 'Ctrl-k',
        mac: 'Cmd-k',
        run: (view) => {
          const { state, dispatch } = view;
          const selection = state.selection.main;
          const selectedText = state.doc.sliceString(selection.from, selection.to);
          
          const newText = selectedText 
            ? `[${selectedText}](url)`
            : '[text](url)';
          const cursorPos = selection.from + newText.indexOf('url');
          
          dispatch({
            changes: { from: selection.from, to: selection.to, insert: newText },
            selection: { anchor: cursorPos, head: cursorPos + 3 },
          });
          
          return true;
        },
      },
      // Insert code block
      {
        key: 'Ctrl-Shift-c',
        mac: 'Cmd-Shift-c',
        run: (view) => {
          const { state, dispatch } = view;
          const selection = state.selection.main;
          const selectedText = state.doc.sliceString(selection.from, selection.to);
          
          if (selectedText) {
            const newText = `\`\`\`\n${selectedText}\n\`\`\``;
            dispatch({
              changes: { from: selection.from, to: selection.to, insert: newText },
              selection: { anchor: selection.from + 4, head: selection.from + 4 + selectedText.length },
            });
          } else {
            const newText = '```\n\n```';
            dispatch({
              changes: { from: selection.from, to: selection.to, insert: newText },
              selection: { anchor: selection.from + 4, head: selection.from + 4 },
            });
          }
          
          return true;
        },
      },
    ]);
  }, []);

  // Add markdown shortcuts to extensions
  const finalExtensions = useMemo(() => {
    return [...extensions, markdownShortcuts];
  }, [extensions, markdownShortcuts]);

  // === RENDER ===

  return (
    <div className={`h-full ${className}`}>
      <CodeMirror
        value={content}
        onChange={handleChange}
        extensions={finalExtensions}
        theme={darkMode ? oneDark : undefined}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: showLineNumbers,
          foldGutter: true,
          dropCursor: true,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightSelectionMatches: true,
          searchKeymap: true,
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        editable={!readOnly}
        style={{
          height: '100%',
          width: '100%',
        }}
      />
    </div>
  );
};

export default CodeMirrorEditor;