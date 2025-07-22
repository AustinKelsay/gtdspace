/**
 * @fileoverview Tiptap extension for Mermaid diagrams
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import { Node, mergeAttributes } from '@tiptap/core';
import mermaid from 'mermaid';

// === TYPES ===
/**
 * Basic Mermaid configuration interface
 */
export interface MermaidConfig {
  theme?: string;
  themeVariables?: Record<string, string>;
  startOnLoad?: boolean;
  secure?: string[];
  deterministicIds?: boolean;
  fontFamily?: string;
  fontSize?: number;
  [key: string]: any;
}

/**
 * Configuration options for the Mermaid extension
 */
export interface MermaidOptions {
  /** HTML element tag for diagrams */
  HTMLTag: string;
  /** Mermaid configuration */
  mermaidConfig: MermaidConfig;
  /** Whether to enable auto-rendering */
  autoRender: boolean;
  /** Custom CSS class for diagrams */
  cssClass: string;
}

/**
 * Mermaid node attributes
 */
interface MermaidNodeAttributes {
  /** Mermaid diagram code */
  code: string;
  /** Diagram type (optional) */
  type?: string;
}

// === CONSTANTS ===
/**
 * Default Mermaid configuration
 */
const DEFAULT_MERMAID_CONFIG: MermaidConfig = {
  startOnLoad: false,
  theme: 'default',
  logLevel: 'error',
  securityLevel: 'strict',
  arrowMarkerAbsolute: false,
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 10,
    actorMargin: 50,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
  },
  gantt: {
    titleTopMargin: 25,
    barHeight: 20,
    fontFamily: '"Open Sans", sans-serif',
    fontSize: 11,
    gridLineStartPadding: 35,
    bottomPadding: 5,
    leftPadding: 75,
    rightPadding: 35,
  },
};

/**
 * Default extension options
 */
const DEFAULT_OPTIONS: MermaidOptions = {
  HTMLTag: 'div',
  mermaidConfig: DEFAULT_MERMAID_CONFIG,
  autoRender: true,
  cssClass: 'mermaid-diagram',
};

// === UTILITY FUNCTIONS ===
/**
 * Generates a unique ID for Mermaid diagrams
 */
function generateMermaidId(): string {
  return `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validates Mermaid diagram code
 * 
 * @param code - Mermaid diagram code to validate
 * @returns True if valid, false otherwise
 */
export function isValidMermaidCode(code: string): boolean {
  if (!code || code.trim().length === 0) {
    return false;
  }

  // Basic validation - check for common diagram types
  const trimmedCode = code.trim().toLowerCase();
  const validStarters = [
    'graph',
    'flowchart',
    'sequencediagram',
    'classDiagram',
    'stateDiagram',
    'erDiagram',
    'journey',
    'gantt',
    'pie',
    'gitgraph',
    'mindmap',
    'timeline',
    'requirement',
  ];

  return validStarters.some(starter => trimmedCode.startsWith(starter));
}

/**
 * Renders Mermaid diagram to SVG
 * 
 * @param code - Mermaid diagram code
 * @param config - Mermaid configuration options
 * @returns Promise resolving to rendered SVG string or error message
 */
export async function renderMermaidDiagram(
  code: string,
  config: MermaidConfig = {}
): Promise<{ success: boolean; content: string; error?: string }> {
  try {
    // Initialize Mermaid with configuration
    const mergedConfig = { ...DEFAULT_MERMAID_CONFIG, ...config };
    mermaid.initialize(mergedConfig);

    // Generate unique ID
    const id = generateMermaidId();

    // Render diagram
    const { svg } = await mermaid.render(id, code);

    return {
      success: true,
      content: svg,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      content: `<div class="mermaid-error p-4 border border-red-300 bg-red-50 text-red-700 rounded">
        <p class="font-semibold">Mermaid Diagram Error:</p>
        <p class="text-sm">${errorMsg}</p>
        <pre class="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">${code}</pre>
      </div>`,
      error: errorMsg,
    };
  }
}

/**
 * Detects diagram type from Mermaid code
 * 
 * @param code - Mermaid diagram code
 * @returns Detected diagram type or 'unknown'
 */
export function detectDiagramType(code: string): string {
  const trimmedCode = code.trim().toLowerCase();
  
  if (trimmedCode.startsWith('graph')) return 'graph';
  if (trimmedCode.startsWith('flowchart')) return 'flowchart';
  if (trimmedCode.startsWith('sequencediagram')) return 'sequence';
  if (trimmedCode.startsWith('classdiagram')) return 'class';
  if (trimmedCode.startsWith('statediagram')) return 'state';
  if (trimmedCode.startsWith('erdiagram')) return 'er';
  if (trimmedCode.startsWith('journey')) return 'journey';
  if (trimmedCode.startsWith('gantt')) return 'gantt';
  if (trimmedCode.startsWith('pie')) return 'pie';
  if (trimmedCode.startsWith('gitgraph')) return 'git';
  if (trimmedCode.startsWith('mindmap')) return 'mindmap';
  if (trimmedCode.startsWith('timeline')) return 'timeline';
  if (trimmedCode.startsWith('requirement')) return 'requirement';
  
  return 'unknown';
}

// === MAIN EXTENSION ===
/**
 * Mermaid extension for Tiptap
 * 
 * Provides support for Mermaid diagrams with automatic rendering.
 * Diagrams are stored as Mermaid code and rendered to SVG for display.
 * 
 * @example
 * ```typescript
 * import { Mermaid } from './extensions/tiptap/Mermaid';
 * 
 * const editor = new Editor({
 *   extensions: [
 *     Mermaid.configure({
 *       mermaidConfig: {
 *         theme: 'dark'
 *       }
 *     })
 *   ]
 * });
 * ```
 */
export const Mermaid = Node.create<MermaidOptions>({
  name: 'mermaid',

  // Extension configuration
  addOptions() {
    return DEFAULT_OPTIONS;
  },

  // Node properties
  group: 'block',
  inline: false,
  draggable: true,
  selectable: true,
  atom: true,

  // Attributes definition
  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: element => element.getAttribute('data-mermaid-code') || '',
        renderHTML: attributes => ({
          'data-mermaid-code': attributes.code,
        }),
      },
      type: {
        default: 'unknown',
        parseHTML: element => element.getAttribute('data-diagram-type') || 'unknown',
        renderHTML: attributes => ({
          'data-diagram-type': attributes.type,
        }),
      },
    };
  },

  // HTML parsing rules
  parseHTML() {
    return [
      {
        tag: `${this.options.HTMLTag}[data-mermaid-code]`,
        getAttrs: element => {
          if (typeof element === 'string') return false;
          
          const code = element.getAttribute('data-mermaid-code');
          const type = element.getAttribute('data-diagram-type') || 'unknown';
          
          return code ? { code, type } : false;
        },
      },
      // Also parse code blocks with mermaid language
      {
        tag: 'pre code.language-mermaid',
        getAttrs: element => {
          if (typeof element === 'string') return false;
          
          const code = element.textContent || '';
          const type = detectDiagramType(code);
          
          return code ? { code, type } : false;
        },
      },
    ];
  },

  // HTML rendering
  renderHTML({ HTMLAttributes, node }) {
    const attrs = node.attrs as MermaidNodeAttributes;
    const { code, type } = attrs;
    
    return [
      this.options.HTMLTag,
      mergeAttributes(HTMLAttributes, {
        'data-mermaid-code': code,
        'data-diagram-type': type || detectDiagramType(code),
        class: `${this.options.cssClass} mermaid-${type || 'unknown'}`,
      }),
      [
        'div',
        { class: 'mermaid-container' },
        [
          'div',
          { class: 'mermaid-loading text-center p-4' },
          'Rendering diagram...'
        ]
      ],
    ];
  },

  // Commands
  addCommands() {
    return {
      /**
       * Insert Mermaid diagram
       */
      insertMermaidDiagram:
        (code: string) =>
        ({ commands }) => {
          if (!isValidMermaidCode(code)) return false;
          
          const type = detectDiagramType(code);
          
          return commands.insertContent({
            type: this.name,
            attrs: { code, type },
          });
        },

      /**
       * Update Mermaid diagram code
       */
      updateMermaidDiagram:
        (code: string) =>
        ({ commands }) => {
          const type = detectDiagramType(code);
          
          return commands.updateAttributes(this.name, { code, type });
        },
    };
  },

  // Note: Input rules for code blocks are complex
  // We'll handle this through commands and manual insertion

  // Keyboard shortcuts
  addKeyboardShortcuts() {
    return {
      // Ctrl+Shift+D for Mermaid diagram
      'Mod-Shift-d': () => {
        const code = prompt('Enter Mermaid diagram code:');
        if (code) {
          return this.editor.commands.insertMermaidDiagram(code);
        }
        return false;
      },
    };
  },

  // Lifecycle hooks
  onCreate() {
    // Initialize Mermaid
    if (this.options.autoRender) {
      mermaid.initialize(this.options.mermaidConfig);
    }
  },

  // Node view for interactive editing
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement(this.options.HTMLTag);
      const diagramContainer = document.createElement('div');
      const attrs = node.attrs as MermaidNodeAttributes;
      
      container.setAttribute('data-mermaid-code', attrs.code);
      container.setAttribute('data-diagram-type', attrs.type || 'unknown');
      container.className = `${this.options.cssClass} mermaid-${attrs.type || 'unknown'}`;
      
      diagramContainer.className = 'mermaid-container';
      container.appendChild(diagramContainer);
      
      // Render diagram
      if (this.options.autoRender && attrs.code) {
        renderMermaidDiagram(attrs.code, this.options.mermaidConfig).then(result => {
          diagramContainer.innerHTML = result.content;
        });
      }
      
      return {
        dom: container,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) return false;
          
          const updatedAttrs = updatedNode.attrs as MermaidNodeAttributes;
          container.setAttribute('data-mermaid-code', updatedAttrs.code);
          container.setAttribute('data-diagram-type', updatedAttrs.type || 'unknown');
          
          // Re-render diagram
          if (this.options.autoRender && updatedAttrs.code) {
            renderMermaidDiagram(updatedAttrs.code, this.options.mermaidConfig).then(result => {
              diagramContainer.innerHTML = result.content;
            });
          }
          
          return true;
        },
      };
    };
  },
});

// === EXPORTS ===
export default Mermaid;
export type { MermaidOptions, MermaidNodeAttributes };