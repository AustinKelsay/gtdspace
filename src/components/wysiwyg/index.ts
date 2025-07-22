/**
 * @fileoverview WYSIWYG editor components exports
 * @author Development Team
 * @created 2024-01-XX
 * @updated 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === COMPONENT EXPORTS ===
export { default as WYSIWYGEditor } from './WYSIWYGEditor';
export type { WYSIWYGEditorProps, WYSIWYGEditorRef } from './WYSIWYGEditor';

export { default as MarkdownSerializer } from './MarkdownSerializer';
export { htmlToMarkdown, markdownToHtml, quickMarkdownToHtml, quickHtmlToMarkdown } from './MarkdownSerializer';
export type { SerializationOptions, ConversionResult } from './MarkdownSerializer';

export { 
  default as EditorModeToggle,
  CompactEditorModeToggle,
  FullEditorModeToggle,
  getNextEditorMode,
  getPreviousEditorMode,
  isModeAvailable,
  getModeConfig,
  getModeShortcut
} from './EditorModeToggle';
export type { EditorMode, EditorModeToggleProps } from './EditorModeToggle';

// === CONSTANTS EXPORTS ===
export { MODE_CONFIGS, DEFAULT_MODES } from './EditorModeToggle';