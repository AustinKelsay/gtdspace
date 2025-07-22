/**
 * @fileoverview Tiptap extension for mathematical equations using KaTeX
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import { Node, mergeAttributes, Command } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import type { ChainedCommands, SingleCommands } from '@tiptap/core';
import katex from 'katex';

// === MODULE AUGMENTATION ===
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathematics: {
      /**
       * Insert an inline math expression
       */
      insertInlineMath: (latex: string) => ReturnType;
      /**
       * Insert a block math expression
       */
      insertBlockMath: (latex: string) => ReturnType;
      /**
       * Update existing math expression
       */
      updateMath: (latex: string) => ReturnType;
      /**
       * Toggle between inline and block math mode
       */
      toggleMathMode: () => ReturnType;
    };
  }
}

// === TYPES ===
/**
 * Configuration options for the Mathematics extension
 */
export interface MathematicsOptions {
  /** HTML element tag for inline math */
  HTMLInlineTag: string;
  /** HTML element tag for block math */
  HTMLBlockTag: string;
  /** KaTeX rendering options */
  katexOptions: katex.KatexOptions;
  /** Whether to allow inline math */
  allowInline: boolean;
  /** Whether to allow block math */
  allowBlock: boolean;
}

/**
 * Math node attributes
 */
interface MathNodeAttributes {
  /** LaTeX expression */
  latex: string;
  /** Whether this is a block-level math element */
  block: boolean;
}

// === CONSTANTS ===
/**
 * Default KaTeX rendering options
 */
const DEFAULT_KATEX_OPTIONS: katex.KatexOptions = {
  throwOnError: false,
  displayMode: false,
  strict: false,
  trust: true,
  fleqn: false,
  leqno: false,
  macros: {},
};

/**
 * Default extension options
 */
const DEFAULT_OPTIONS: MathematicsOptions = {
  HTMLInlineTag: 'span',
  HTMLBlockTag: 'div',
  katexOptions: DEFAULT_KATEX_OPTIONS,
  allowInline: true,
  allowBlock: true,
};

// === UTILITY FUNCTIONS ===
/**
 * Renders LaTeX expression to HTML using KaTeX
 * 
 * @param latex - LaTeX expression to render
 * @param displayMode - Whether to render in display mode (block) or inline mode
 * @param options - KaTeX rendering options
 * @returns Rendered HTML string or error message
 */
export function renderMath(
  latex: string,
  displayMode: boolean = false,
  options: katex.KatexOptions = {}
): string {
  try {
    const katexOptions: katex.KatexOptions = {
      ...DEFAULT_KATEX_OPTIONS,
      ...options,
      displayMode,
    };

    return katex.renderToString(latex, katexOptions);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return `<span class="math-error text-red-500 bg-red-50 px-2 py-1 rounded text-sm">Math Error: ${errorMsg}</span>`;
  }
}

/**
 * Validates LaTeX expression
 * 
 * @param latex - LaTeX expression to validate
 * @returns True if valid, false otherwise
 */
export function isValidLatex(latex: string): boolean {
  if (!latex || latex.trim().length === 0) {
    return false;
  }

  try {
    katex.renderToString(latex, { throwOnError: true });
    return true;
  } catch {
    return false;
  }
}

// === MAIN EXTENSION ===
/**
 * Mathematics extension for Tiptap
 * 
 * Provides support for both inline and block mathematical expressions using KaTeX.
 * Math expressions are stored as LaTeX and rendered to HTML for display.
 * 
 * Usage:
 * - Inline math: $expression$
 * - Block math: $$expression$$
 * 
 * @example
 * ```typescript
 * import { Mathematics } from './extensions/tiptap/Mathematics';
 * 
 * const editor = new Editor({
 *   extensions: [
 *     Mathematics.configure({
 *       katexOptions: {
 *         macros: { '\\RR': '\\mathbb{R}' }
 *       }
 *     })
 *   ]
 * });
 * ```
 */
export const Mathematics = Node.create<MathematicsOptions>({
  name: 'mathematics',

  // Extension configuration
  addOptions() {
    return DEFAULT_OPTIONS;
  },

  // Node properties
  group: 'inline',
  inline: true,
  draggable: true,
  selectable: true,
  atom: true,

  // Attributes definition
  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: element => element.getAttribute('data-latex') || '',
        renderHTML: attributes => ({
          'data-latex': attributes.latex,
        }),
      },
      block: {
        default: false,
        parseHTML: element => element.getAttribute('data-block') === 'true',
        renderHTML: attributes => ({
          'data-block': attributes.block ? 'true' : 'false',
        }),
      },
    };
  },

  // HTML parsing rules
  parseHTML() {
    return [
      {
        tag: `${this.options.HTMLInlineTag}[data-latex]`,
        getAttrs: element => {
          if (typeof element === 'string') return false;
          
          const latex = element.getAttribute('data-latex');
          const block = element.getAttribute('data-block') === 'true';
          
          return latex ? { latex, block } : false;
        },
      },
      {
        tag: `${this.options.HTMLBlockTag}[data-latex]`,
        getAttrs: element => {
          if (typeof element === 'string') return false;
          
          const latex = element.getAttribute('data-latex');
          
          return latex ? { latex, block: true } : false;
        },
      },
    ];
  },

  // HTML rendering
  renderHTML({ HTMLAttributes, node }) {
    const attrs = node.attrs as MathNodeAttributes;
    const { latex, block } = attrs;
    
    // Determine display mode and HTML tag
    const displayMode = block;
    const tag = block ? this.options.HTMLBlockTag : this.options.HTMLInlineTag;
    
    // Render math to HTML
    const renderedMath = renderMath(latex, displayMode, this.options.katexOptions);
    
    return [
      tag,
      mergeAttributes(HTMLAttributes, {
        'data-latex': latex,
        'data-block': block ? 'true' : 'false',
        class: `math-node ${block ? 'math-block' : 'math-inline'}`,
      }),
      ['span', { innerHTML: renderedMath }],
    ];
  },

  // Commands
  addCommands() {
    return {
      /**
       * Insert inline math expression
       */
      insertInlineMath:
        (latex: string) =>
        ({ commands }: { commands: SingleCommands }) => {
          if (!this.options.allowInline) return false;
          
          return commands.insertContent({
            type: this.name,
            attrs: { latex, block: false },
          });
        },

      /**
       * Insert block math expression
       */
      insertBlockMath:
        (latex: string) =>
        ({ commands }: { commands: SingleCommands }) => {
          if (!this.options.allowBlock) return false;
          
          return commands.insertContent({
            type: this.name,
            attrs: { latex, block: true },
          });
        },

      /**
       * Update math expression
       */
      updateMath:
        (latex: string) =>
        ({ commands, state }: { commands: SingleCommands; state: EditorState }) => {
          const { from } = state.selection;
          
          return commands.updateAttributes(this.name, { latex });
        },

      /**
       * Toggle between inline and block math
       */
      toggleMathMode:
        () =>
        ({ commands, state }: { commands: SingleCommands; state: EditorState }) => {
          const { from } = state.selection;
          const node = state.doc.nodeAt(from);
          
          if (node && node.type.name === this.name) {
            const currentBlock = node.attrs.block;
            return commands.updateAttributes(this.name, { block: !currentBlock });
          }
          
          return false;
        },
    };
  },

  // Note: Input rules are complex to implement for math notation
  // We'll handle this through commands and keyboard shortcuts instead

  // Keyboard shortcuts
  addKeyboardShortcuts() {
    return {
      // Ctrl+Shift+M for inline math
      'Mod-Shift-m': () => {
        const latex = prompt('Enter LaTeX expression:');
        if (latex) {
          return this.editor.commands.insertInlineMath(latex);
        }
        return false;
      },
      
      // Ctrl+Shift+Alt+M for block math
      'Mod-Shift-Alt-m': () => {
        const latex = prompt('Enter LaTeX expression:');
        if (latex) {
          return this.editor.commands.insertBlockMath(latex);
        }
        return false;
      },
    };
  },
});

// === EXPORTS ===
export default Mathematics;
export type { MathNodeAttributes };