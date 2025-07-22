/**
 * @fileoverview PDF export functionality with styling and formatting options
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
import React, { useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import type {
  ExportOptions,
  ExportResult,
  ExportProgressCallback,
  ExportCompleteCallback
} from './types';

// === TYPES ===
/**
 * Props for the PDFExporter component
 */
export interface PDFExporterProps {
  /** Document content to export */
  content: string;
  /** Export options */
  options: ExportOptions;
  /** Progress callback */
  onProgress: ExportProgressCallback;
  /** Completion callback */
  onComplete: ExportCompleteCallback;
  /** Additional CSS classes */
  className?: string;
}

// === UTILITY FUNCTIONS ===
/**
 * Generates CSS styles for PDF export based on theme
 */
function generatePDFStyles(theme: string = 'default'): string {
  const baseStyles = `
    @page {
      size: A4;
      margin: 20mm;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background: white;
    }
    
    .document-container {
      max-width: 100%;
      padding: 0;
    }
    
    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      margin-top: 2em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.3;
      page-break-after: avoid;
    }
    
    h1 { font-size: 2.2em; border-bottom: 2px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.8em; border-bottom: 1px solid #eee; padding-bottom: 0.2em; }
    h3 { font-size: 1.5em; }
    h4 { font-size: 1.3em; }
    h5 { font-size: 1.1em; }
    h6 { font-size: 1em; color: #666; }
    
    /* Paragraphs */
    p {
      margin-bottom: 1em;
      orphans: 3;
      widows: 3;
    }
    
    /* Lists */
    ul, ol {
      margin-bottom: 1em;
      padding-left: 1.5em;
    }
    
    li {
      margin-bottom: 0.3em;
    }
    
    /* Code */
    code {
      background: #f6f8fa;
      padding: 0.1em 0.3em;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    pre {
      background: #f6f8fa;
      padding: 1em;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    
    pre code {
      background: none;
      padding: 0;
      font-size: 0.85em;
    }
    
    /* Blockquotes */
    blockquote {
      border-left: 4px solid #ddd;
      margin: 1em 0;
      padding-left: 1em;
      color: #666;
      font-style: italic;
    }
    
    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    
    th {
      background-color: #f6f8fa;
      font-weight: 600;
    }
    
    /* Links */
    a {
      color: #0366d6;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    /* Images */
    img {
      max-width: 100%;
      height: auto;
      margin: 1em 0;
      page-break-inside: avoid;
    }
    
    /* Table of Contents */
    .table-of-contents {
      page-break-after: always;
      margin-bottom: 2em;
    }
    
    .table-of-contents h2 {
      margin-top: 0;
    }
    
    .toc-item {
      margin-bottom: 0.5em;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dotted #ccc;
    }
    
    .toc-title {
      flex: 1;
      margin-right: 1em;
    }
    
    .toc-page {
      flex-shrink: 0;
    }
    
    /* Page breaks */
    .page-break {
      page-break-before: always;
    }
    
    /* Print-specific styles */
    @media print {
      body {
        font-size: 12pt;
      }
      
      h1 { font-size: 18pt; }
      h2 { font-size: 16pt; }
      h3 { font-size: 14pt; }
      h4 { font-size: 13pt; }
      h5 { font-size: 12pt; }
      h6 { font-size: 11pt; }
      
      code, pre {
        background: #f9f9f9 !important;
        color: black !important;
      }
    }
  `;

  // Theme-specific styles
  const themeStyles = {
    default: baseStyles,
    github: baseStyles + `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif; }
      h1 { color: #24292f; }
      h2 { color: #24292f; }
      code { background: #f3f4f6; }
      pre { background: #f3f4f6; }
    `,
    academic: baseStyles + `
      body { 
        font-family: 'Times New Roman', Times, serif; 
        font-size: 12pt;
        line-height: 1.8;
      }
      h1, h2, h3, h4, h5, h6 { 
        font-family: 'Times New Roman', Times, serif; 
        text-align: center;
      }
      p { text-align: justify; }
      .document-title { 
        text-align: center; 
        margin-bottom: 2em; 
        font-size: 16pt;
        font-weight: bold;
      }
    `,
    clean: baseStyles + `
      body { 
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        color: #2c3e50;
      }
      h1, h2, h3, h4, h5, h6 { color: #2c3e50; }
      h1 { border-bottom: none; }
      h2 { border-bottom: none; }
      code { background: #ecf0f1; color: #2c3e50; }
      pre { background: #ecf0f1; }
    `,
    modern: baseStyles + `
      body { 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        color: #1a202c;
      }
      h1, h2, h3, h4, h5, h6 { 
        color: #1a202c;
        font-weight: 700;
      }
      h1 { color: #2d3748; }
      code { background: #f7fafc; color: #4a5568; }
      pre { background: #f7fafc; }
    `
  };

  return themeStyles[theme as keyof typeof themeStyles] || baseStyles;
}

/**
 * Processes content for PDF export
 */
function processContentForPDF(content: string, options: ExportOptions): string {
  // Configure marked for PDF output
  marked.setOptions({
    breaks: true,
    gfm: true
  });

  // Convert markdown to HTML
  const html = marked.parse(content) as string;

  // Sanitize HTML
  const sanitizedHTML = DOMPurify.sanitize(html);

  // Add table of contents if requested
  let tocHTML = '';
  if (options.pdf?.includeTOC) {
    const headings = html.match(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi) || [];
    if (headings.length > 0) {
      tocHTML = `
        <div class="table-of-contents">
          <h2>Table of Contents</h2>
          ${headings.map((heading, index) => {
        const level = heading.match(/<h([1-6])/)?.[1] || '1';
        const text = heading.replace(/<[^>]*>/g, '');
        return `<div class="toc-item toc-level-${level}">
              <span class="toc-title">${text}</span>
              <span class="toc-page">${index + 1}</span>
            </div>`;
      }).join('')}
        </div>
      `;
    }
  }

  // Build complete HTML document
  const title = options.title || 'Document';
  const author = options.author || '';
  const date = options.date ? options.date.toLocaleDateString() : '';
  const theme = options.pdf?.theme || 'default';

  const fullHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <meta name="author" content="${author}">
      <meta name="date" content="${date}">
      <style>
        ${generatePDFStyles(theme)}
      </style>
    </head>
    <body>
      <div class="document-container">
        ${options.pdf?.includeMetadata ? `
          <div class="document-title">${title}</div>
          ${author ? `<div style="text-align: center; margin-bottom: 1em;">By ${author}</div>` : ''}
          ${date ? `<div style="text-align: center; margin-bottom: 2em; color: #666;">${date}</div>` : ''}
        ` : ''}
        
        ${tocHTML}
        
        <div class="document-content">
          ${sanitizedHTML}
        </div>
      </div>
    </body>
    </html>
  `;

  return fullHTML;
}

/**
 * Exports content as PDF using browser's print functionality
 */
async function exportToPDF(
  html: string,
  _options: ExportOptions,
  onProgress: ExportProgressCallback
): Promise<ExportResult> {
  try {
    onProgress({ step: 'Generating PDF...', progress: 25 });

    // Create a new window for PDF generation
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Failed to open print window. Please allow popups.');
    }

    // Write HTML to the new window
    printWindow.document.write(html);
    printWindow.document.close();

    onProgress({ step: 'Preparing for print...', progress: 50 });

    // Wait for content to load
    await new Promise(resolve => {
      printWindow.addEventListener('load', resolve);
      setTimeout(resolve, 1000); // Fallback timeout
    });

    onProgress({ step: 'Opening print dialog...', progress: 75 });

    // Focus the window and trigger print
    printWindow.focus();
    printWindow.print();

    onProgress({ step: 'Export completed', progress: 100 });

    // Close the print window after a short delay
    setTimeout(() => {
      printWindow.close();
    }, 2000);

    return {
      success: true,
      output: 'PDF print dialog opened',
      duration: 2000,
      metadata: {
        exportedAt: new Date()
      }
    };
  } catch (error) {
    console.error('PDF export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export PDF'
    };
  }
}

// === MAIN COMPONENT ===
/**
 * PDF export component with styling and formatting options
 * 
 * Handles the conversion of markdown content to PDF format using
 * the browser's native print functionality. Supports various themes,
 * styling options, and document formatting features.
 * 
 * Features:
 * - Multiple PDF themes and layouts
 * - Table of contents generation
 * - Document metadata inclusion
 * - Custom page formatting
 * - Progress tracking
 * 
 * @param props - Component props
 * @returns JSX element (hidden component that handles export)
 */
export const PDFExporter: React.FC<PDFExporterProps> = ({
  content,
  options,
  onProgress,
  onComplete,
  className: _className
}) => {
  const hasExported = useRef(false);

  // === EFFECTS ===

  /**
   * Trigger PDF export when component mounts
   */
  useEffect(() => {
    if (hasExported.current) return;
    hasExported.current = true;

    const performExport = async () => {
      try {
        onProgress({ step: 'Processing content...', progress: 10 });

        // Process content for PDF
        const processedHTML = processContentForPDF(content, options);

        onProgress({ step: 'Converting to PDF format...', progress: 20 });

        // Export to PDF
        const result = await exportToPDF(processedHTML, options, onProgress);

        onComplete(result);
      } catch (error) {
        console.error('PDF export failed:', error);
        onComplete({
          success: false,
          error: error instanceof Error ? error.message : 'PDF export failed'
        });
      }
    };

    performExport();
  }, [content, options, onProgress, onComplete]);

  // This component doesn't render anything visible
  return null;
};

export default PDFExporter;