/**
 * @fileoverview Type definitions for block-based editing system
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === CORE BLOCK TYPES ===

/**
 * Base content block interface
 */
export interface ContentBlock {
  /** Unique block identifier */
  id: string;
  /** Block type identifier */
  type: string;
  /** Block content (type depends on block type) */
  content: any;
  /** Block attributes and metadata */
  attributes: Record<string, any>;
  /** Position in the block list */
  position: number;
  /** Child blocks (for nested structures) */
  children: ContentBlock[];
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Parent block ID (if nested) */
  parentId?: string;
  /** Nesting level (0 for top-level) */
  level?: number;
}

/**
 * Block type definition
 */
export interface BlockType {
  /** Unique type identifier */
  id: string;
  /** Display name */
  name: string;
  /** Icon (emoji or text) */
  icon: string;
  /** Description for help text */
  description: string;
  /** Category for organization */
  category?: string;
  /** Whether this type can have children */
  canHaveChildren?: boolean;
  /** Allowed parent types */
  allowedParents?: string[];
  /** Default content for new blocks */
  defaultContent?: any;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Whether this type is deprecated */
  deprecated?: boolean;
}

/**
 * Block operation types
 */
export type BlockOperationType = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'move' 
  | 'duplicate' 
  | 'type_change'
  | 'indent'
  | 'outdent';

/**
 * Block operation record
 */
export interface BlockOperation {
  /** Operation type */
  type: BlockOperationType;
  /** Block ID */
  blockId: string;
  /** Operation timestamp */
  timestamp: number;
  /** Previous state (for undo) */
  previousState?: Partial<ContentBlock>;
  /** New state */
  newState?: Partial<ContentBlock>;
  /** Additional operation metadata */
  metadata?: Record<string, any>;
}

/**
 * Block selection state
 */
export interface BlockSelection {
  /** Selected block ID */
  blockId: string | null;
  /** Text selection range within block */
  range: {
    start: number;
    end: number;
  } | null;
  /** Selection type */
  type: 'block' | 'text' | 'range';
  /** Whether multiple blocks are selected */
  isMultiple?: boolean;
  /** Multiple selected block IDs */
  selectedBlocks?: string[];
}

/**
 * Block editor state
 */
export interface BlockEditorState {
  /** All blocks in the editor */
  blocks: ContentBlock[];
  /** Current selection */
  selection: BlockSelection;
  /** Operation history for undo/redo */
  history: BlockOperation[];
  /** Current history position */
  historyPosition: number;
  /** Whether the editor is in focus */
  isFocused: boolean;
  /** Whether drag and drop is active */
  isDragging: boolean;
  /** Currently dragged block ID */
  draggedBlockId: string | null;
}

// === SPECIFIC BLOCK CONTENT TYPES ===

/**
 * Text-based block content
 */
export interface TextBlockContent {
  /** Raw text content */
  text: string;
  /** Text formatting metadata */
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
  };
}

/**
 * List block content
 */
export interface ListBlockContent {
  /** List items */
  items: string[];
  /** Whether the list is ordered */
  ordered: boolean;
  /** Starting number for ordered lists */
  start?: number;
}

/**
 * Todo block content
 */
export interface TodoBlockContent {
  /** Todo text */
  text: string;
  /** Whether the todo is completed */
  completed: boolean;
  /** Due date (if any) */
  dueDate?: number;
  /** Priority level */
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Code block content
 */
export interface CodeBlockContent {
  /** Source code */
  code: string;
  /** Programming language */
  language: string;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Syntax highlighting theme */
  theme?: string;
}

/**
 * Quote block content
 */
export interface QuoteBlockContent {
  /** Quote text */
  text: string;
  /** Quote author (if any) */
  author?: string;
  /** Quote source (if any) */
  source?: string;
}

/**
 * Image block content
 */
export interface ImageBlockContent {
  /** Image URL or base64 data */
  src: string;
  /** Alt text */
  alt: string;
  /** Caption */
  caption?: string;
  /** Image dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
  /** Alignment */
  alignment?: 'left' | 'center' | 'right';
}

/**
 * Table block content
 */
export interface TableBlockContent {
  /** Table headers */
  headers: string[];
  /** Table rows */
  rows: string[][];
  /** Whether to show headers */
  showHeaders: boolean;
  /** Column alignment */
  columnAlignment?: ('left' | 'center' | 'right')[];
}

/**
 * Math block content
 */
export interface MathBlockContent {
  /** LaTeX expression */
  latex: string;
  /** Whether this is display math (block) or inline */
  displayMode: boolean;
}

/**
 * Diagram block content
 */
export interface DiagramBlockContent {
  /** Diagram code (Mermaid, etc.) */
  code: string;
  /** Diagram type */
  type: 'mermaid' | 'flowchart' | 'sequence' | 'class' | 'gantt';
  /** Diagram configuration */
  config?: Record<string, any>;
}

// === BLOCK FACTORY TYPES ===

/**
 * Block factory function type
 */
export type BlockFactory = (content?: any, attributes?: Record<string, any>) => ContentBlock;

/**
 * Block renderer function type
 */
export type BlockRenderer = (block: ContentBlock, props: BlockRendererProps) => JSX.Element;

/**
 * Block renderer props
 */
export interface BlockRendererProps {
  /** Whether the block is selected */
  isSelected: boolean;
  /** Whether the editor is read-only */
  readOnly: boolean;
  /** Content change callback */
  onChange: (content: any) => void;
  /** Block selection callback */
  onSelect?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// === VALIDATION TYPES ===

/**
 * Block validation result
 */
export interface BlockValidationResult {
  /** Whether the block is valid */
  isValid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings?: string[];
}

/**
 * Block validator function type
 */
export type BlockValidator = (block: ContentBlock) => BlockValidationResult;

// === UTILITY TYPES ===

/**
 * Block position information
 */
export interface BlockPosition {
  /** Block ID */
  blockId: string;
  /** Index in parent container */
  index: number;
  /** Parent block ID (if nested) */
  parentId?: string;
  /** Nesting level */
  level: number;
}

/**
 * Block drag and drop data
 */
export interface BlockDragData {
  /** Dragged block ID */
  blockId: string;
  /** Source position */
  sourcePosition: BlockPosition;
  /** Target position */
  targetPosition?: BlockPosition;
  /** Drag operation type */
  operation: 'move' | 'copy';
}

/**
 * Block serialization options
 */
export interface BlockSerializationOptions {
  /** Include metadata */
  includeMetadata?: boolean;
  /** Include timestamps */
  includeTimestamps?: boolean;
  /** Include child blocks */
  includeChildren?: boolean;
  /** Pretty print JSON */
  prettyPrint?: boolean;
}

/**
 * Serialized block data
 */
export interface SerializedBlock {
  /** Serialized block data */
  data: string;
  /** Serialization format */
  format: 'json' | 'markdown' | 'html';
  /** Serialization options used */
  options: BlockSerializationOptions;
  /** Serialization timestamp */
  timestamp: number;
}

// === EXPORT UTILITY TYPE ===

/**
 * Union type of all specific block content types
 */
export type AnyBlockContent = 
  | TextBlockContent
  | ListBlockContent
  | TodoBlockContent
  | CodeBlockContent
  | QuoteBlockContent
  | ImageBlockContent
  | TableBlockContent
  | MathBlockContent
  | DiagramBlockContent;