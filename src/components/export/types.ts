/**
 * @fileoverview Export system types and interfaces
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === EXPORT FORMATS ===
/**
 * Supported export formats
 */
export type ExportFormat = 'pdf' | 'html' | 'markdown' | 'docx' | 'print';

/**
 * Export quality settings
 */
export type ExportQuality = 'draft' | 'standard' | 'high' | 'print';

/**
 * Export theme options
 */
export type ExportTheme = 'default' | 'github' | 'academic' | 'clean' | 'modern';

// === EXPORT OPTIONS ===
/**
 * PDF export specific options
 */
export interface PDFExportOptions {
  /** Page format */
  format?: 'A4' | 'Letter' | 'Legal' | 'A3' | 'A5';
  /** Page orientation */
  orientation?: 'portrait' | 'landscape';
  /** Margin settings in mm */
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  /** Include table of contents */
  includeTOC?: boolean;
  /** Include page numbers */
  includePageNumbers?: boolean;
  /** Header text */
  header?: string;
  /** Footer text */
  footer?: string;
  /** Export quality */
  quality?: ExportQuality;
  /** Theme to use */
  theme?: ExportTheme;
  /** Include document metadata */
  includeMetadata?: boolean;
}

/**
 * HTML export specific options
 */
export interface HTMLExportOptions {
  /** Include CSS inline */
  inlineCSS?: boolean;
  /** Include table of contents */
  includeTOC?: boolean;
  /** Theme to use */
  theme?: ExportTheme;
  /** Export as single file */
  standalone?: boolean;
  /** Include document metadata */
  includeMetadata?: boolean;
  /** Optimize for offline viewing */
  optimizeOffline?: boolean;
}

/**
 * Markdown export specific options
 */
export interface MarkdownExportOptions {
  /** Include frontmatter */
  includeFrontmatter?: boolean;
  /** Preserve HTML tags */
  preserveHTML?: boolean;
  /** Line ending style */
  lineEndings?: 'unix' | 'windows' | 'auto';
  /** Theme-specific styling */
  theme?: ExportTheme;
}

/**
 * General export options
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Output filename (without extension) */
  filename?: string;
  /** Document title */
  title?: string;
  /** Document author */
  author?: string;
  /** Export date */
  date?: Date;
  /** Include syntax highlighting */
  includeSyntaxHighlighting?: boolean;
  /** Include mathematical content */
  includeMath?: boolean;
  /** Include diagrams */
  includeDiagrams?: boolean;
  /** Format-specific options */
  pdf?: PDFExportOptions;
  html?: HTMLExportOptions;
  markdown?: MarkdownExportOptions;
}

// === EXPORT RESULT ===
/**
 * Export operation result
 */
export interface ExportResult {
  /** Operation success status */
  success: boolean;
  /** Generated file path or blob URL */
  output?: string | Blob;
  /** File size in bytes */
  fileSize?: number;
  /** Export duration in milliseconds */
  duration?: number;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    characterCount?: number;
    exportedAt?: Date;
  };
}

// === EXPORT PROGRESS ===
/**
 * Export progress information
 */
export interface ExportProgress {
  /** Current step */
  step: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
  /** Current operation */
  operation?: 'preparing' | 'rendering' | 'processing' | 'finalizing';
}

// === EXPORT STATUS ===
/**
 * Export operation status
 */
export type ExportStatus = 'idle' | 'preparing' | 'exporting' | 'success' | 'error' | 'cancelled';

// === EXPORT CALLBACKS ===
/**
 * Export progress callback
 */
export type ExportProgressCallback = (progress: ExportProgress) => void;

/**
 * Export completion callback
 */
export type ExportCompleteCallback = (result: ExportResult) => void;