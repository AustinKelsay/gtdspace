/**
 * @fileoverview Tiptap extensions index file
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === EXPORTS ===
export { Mathematics, renderMath, isValidLatex } from './Mathematics';
export type { MathematicsOptions, MathNodeAttributes } from './Mathematics';

export { Mermaid, renderMermaidDiagram, isValidMermaidCode, detectDiagramType } from './Mermaid';
export type { MermaidOptions, MermaidNodeAttributes } from './Mermaid';