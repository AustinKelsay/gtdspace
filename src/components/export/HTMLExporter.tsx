/**
 * @fileoverview HTML export functionality with embedded CSS and offline support
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
 * Props for the HTMLExporter component
 */
export interface HTMLExporterProps {
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
 * Generates CSS styles for HTML export based on theme
 */
function generateHTMLStyles(theme: string = 'default', _optimizeOffline: boolean = true): string {
  const baseStyles = `
    /* Reset and base styles */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #24292f;
      background-color: #ffffff;
      max-width: 100%;
      padding: 2rem;
      margin: 0 auto;
    }
    
    .document-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }
    
    /* Typography */
    h1, h2, h3, h4, h5, h6 {
      margin-top: 2rem;
      margin-bottom: 1rem;
      font-weight: 600;
      line-height: 1.25;
      color: #1f2937;
    }
    
    h1 { 
      font-size: 2.5rem; 
      border-bottom: 3px solid #e5e7eb; 
      padding-bottom: 0.5rem; 
      margin-bottom: 1.5rem;
    }
    h2 { 
      font-size: 2rem; 
      border-bottom: 2px solid #e5e7eb; 
      padding-bottom: 0.3rem; 
    }
    h3 { font-size: 1.75rem; }
    h4 { font-size: 1.5rem; }
    h5 { font-size: 1.25rem; }
    h6 { font-size: 1.1rem; color: #6b7280; }
    
    p {
      margin-bottom: 1rem;
      color: #374151;
      line-height: 1.7;
    }
    
    /* Lists */
    ul, ol {
      margin-bottom: 1rem;
      padding-left: 2rem;
    }
    
    li {
      margin-bottom: 0.5rem;
      color: #374151;
    }
    
    ul li {
      list-style-type: disc;
    }
    
    ol li {
      list-style-type: decimal;
    }
    
    /* Code */
    code {
      background: #f3f4f6;
      color: #ef4444;
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      font-size: 0.875rem;
      font-weight: 400;
    }
    
    pre {
      background: #1f2937;
      color: #f9fafb;
      padding: 1.5rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      margin: 1.5rem 0;
      border-left: 4px solid #3b82f6;
    }
    
    pre code {
      background: none;
      color: inherit;
      padding: 0;
      font-size: 0.875rem;
    }
    
    /* Syntax highlighting */
    .hljs-comment { color: #6b7280; }
    .hljs-keyword { color: #8b5cf6; }
    .hljs-string { color: #10b981; }
    .hljs-number { color: #f59e0b; }
    .hljs-function { color: #3b82f6; }
    .hljs-variable { color: #ef4444; }
    
    /* Blockquotes */
    blockquote {
      border-left: 4px solid #d1d5db;
      margin: 1.5rem 0;
      padding: 0 1.5rem;
      color: #6b7280;
      font-style: italic;
      background: #f9fafb;
      border-radius: 0 0.25rem 0.25rem 0;
    }
    
    blockquote p {
      color: inherit;
    }
    
    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1.5rem 0;
      border-radius: 0.5rem;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    th, td {
      border: 1px solid #e5e7eb;
      padding: 0.75rem 1rem;
      text-align: left;
    }
    
    th {
      background-color: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }
    
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    
    tr:hover {
      background-color: #f3f4f6;
    }
    
    /* Links */
    a {
      color: #3b82f6;
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: all 0.2s ease;
    }
    
    a:hover {
      border-bottom-color: #3b82f6;
      color: #1d4ed8;
    }
    
    a:visited {
      color: #7c3aed;
    }
    
    /* Images */
    img {
      max-width: 100%;
      height: auto;
      margin: 1.5rem 0;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    /* Table of Contents */
    .table-of-contents {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1.5rem;
      margin: 2rem 0;
    }
    
    .table-of-contents h2 {
      margin-top: 0;
      color: #1e293b;
      font-size: 1.5rem;
    }
    
    .toc-item {
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      padding: 0.25rem 0;
      border-radius: 0.25rem;
      transition: background-color 0.2s ease;
    }
    
    .toc-item:hover {
      background: rgba(59, 130, 246, 0.1);
    }
    
    .toc-item a {
      flex: 1;
      color: #475569;
      border: none;
    }
    
    .toc-item a:hover {
      color: #3b82f6;
      border: none;
    }
    
    .toc-level-1 { margin-left: 0; font-weight: 600; }
    .toc-level-2 { margin-left: 1rem; }
    .toc-level-3 { margin-left: 2rem; }
    .toc-level-4 { margin-left: 3rem; }
    .toc-level-5 { margin-left: 4rem; }
    .toc-level-6 { margin-left: 5rem; }
    
    /* Document metadata */
    .document-header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .document-title {
      font-size: 3rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 1rem;
      line-height: 1.2;
    }
    
    .document-author {
      font-size: 1.25rem;
      color: #6b7280;
      margin-bottom: 0.5rem;
    }
    
    .document-date {
      color: #9ca3af;
      font-style: italic;
    }
    
    /* Responsive design */
    @media (max-width: 768px) {
      body {
        padding: 1rem;
      }
      
      .document-container {
        padding: 1rem;
      }
      
      .document-title {
        font-size: 2rem;
      }
      
      h1 { font-size: 2rem; }
      h2 { font-size: 1.75rem; }
      h3 { font-size: 1.5rem; }
    }
    
    /* Print styles */
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .document-container {
        box-shadow: none;
        padding: 0;
      }
      
      a {
        color: #000;
        border: none;
      }
      
      pre {
        background: #f5f5f5;
        color: #000;
        border: 1px solid #ccc;
      }
    }
  `;

  // Theme-specific styles
  const themeStyles = {
    default: baseStyles,
    github: baseStyles + `
      .document-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
        border: 1px solid #d0d7de;
      }
      code { background: #f6f8fa; color: #d73a49; }
      pre { background: #f6f8fa; color: #24292f; border-left-color: #0969da; }
    `,
    academic: baseStyles + `
      body { 
        font-family: 'Times New Roman', Times, serif; 
        line-height: 1.8;
        color: #000;
      }
      .document-container {
        font-family: 'Times New Roman', Times, serif;
        max-width: 900px;
        box-shadow: none;
        border: none;
      }
      h1, h2, h3, h4, h5, h6 { 
        font-family: 'Times New Roman', Times, serif;
        font-weight: bold;
        color: #000;
      }
      .document-title { text-align: center; }
      .document-author { text-align: center; }
      .document-date { text-align: center; }
    `,
    clean: baseStyles + `
      body { 
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        color: #2c3e50;
        background: #ecf0f1;
      }
      .document-container {
        background: white;
        color: #2c3e50;
      }
      h1, h2, h3, h4, h5, h6 { color: #2c3e50; border: none; }
      code { background: #ecf0f1; color: #2c3e50; }
      pre { background: #34495e; color: #ecf0f1; }
    `,
    modern: baseStyles + `
      body { 
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #1a202c;
      }
      .document-container {
        background: white;
        color: #1a202c;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      }
      h1, h2, h3, h4, h5, h6 { 
        color: #1a202c;
        font-weight: 700;
      }
      code { background: #f7fafc; color: #4a5568; }
      pre { background: #2d3748; color: #f7fafc; }
    `
  };

  return themeStyles[theme as keyof typeof themeStyles] || baseStyles;
}

/**
 * Processes content for HTML export
 */
function processContentForHTML(content: string, options: ExportOptions): string {
  // Configure marked for HTML output
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
  if (options.html?.includeTOC) {
    const headings = sanitizedHTML.match(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi) || [];
    if (headings.length > 0) {
      tocHTML = `
        <div class="table-of-contents">
          <h2>Table of Contents</h2>
          ${headings.map((heading, index) => {
        const level = heading.match(/<h([1-6])/)?.[1] || '1';
        const text = heading.replace(/<[^>]*>/g, '');
        const id = `heading-${index}`;

        // Add id to the actual heading (we'll track this for final assembly)
        // html = html.replace(heading, heading.replace('>', ` id="${id}"`));

        return `<div class="toc-item toc-level-${level}">
              <a href="#${id}">${text}</a>
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
  const theme = options.html?.theme || 'default';
  const optimizeOffline = options.html?.optimizeOffline || true;

  const styles = options.html?.inlineCSS
    ? `<style>${generateHTMLStyles(theme, optimizeOffline)}</style>`
    : '<link rel="stylesheet" href="styles.css">';

  const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Exported document from GTD Space">
  <meta name="generator" content="GTD Space">
  <title>${title}</title>
  ${options.html?.includeMetadata ? `
  <meta name="author" content="${author}">
  <meta name="date" content="${date}">
  ` : ''}
  ${styles}
</head>
<body>
  <div class="document-container">
    ${options.html?.includeMetadata ? `
    <div class="document-header">
      <h1 class="document-title">${title}</h1>
      ${author ? `<div class="document-author">By ${author}</div>` : ''}
      ${date ? `<div class="document-date">${date}</div>` : ''}
    </div>
    ` : ''}
    
    ${tocHTML}
    
    <div class="document-content">
      ${sanitizedHTML}
    </div>
  </div>
  
  ${options.html?.optimizeOffline ? `
  <script>
    // Add smooth scrolling for TOC links
    document.querySelectorAll('.table-of-contents a').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
    
    // Add copy code functionality
    document.querySelectorAll('pre code').forEach(code => {
      const button = document.createElement('button');
      button.textContent = 'Copy';
      button.style.cssText = 'position:absolute;top:0.5rem;right:0.5rem;padding:0.25rem 0.5rem;background:#374151;color:white;border:none;border-radius:0.25rem;cursor:pointer;font-size:0.75rem;';
      button.onclick = () => {
        navigator.clipboard.writeText(code.textContent);
        button.textContent = 'Copied!';
        setTimeout(() => button.textContent = 'Copy', 2000);
      };
      code.parentElement.style.position = 'relative';
      code.parentElement.appendChild(button);
    });
  </script>
  ` : ''}
</body>
</html>`;

  return fullHTML;
}

/**
 * Downloads HTML content as a file
 */
function downloadHTML(html: string, filename: string): ExportResult {
  try {
    // Create blob
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
    a.style.display = 'none';

    // Trigger download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return {
      success: true,
      output: url,
      fileSize: blob.size,
      metadata: {
        exportedAt: new Date()
      }
    };
  } catch (error) {
    console.error('HTML download error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download HTML file'
    };
  }
}

// === MAIN COMPONENT ===
/**
 * HTML export component with embedded CSS and offline support
 * 
 * Handles the conversion of markdown content to standalone HTML files
 * with embedded CSS, table of contents, and offline viewing optimization.
 * 
 * Features:
 * - Multiple HTML themes and styling
 * - Embedded or external CSS options
 * - Table of contents generation
 * - Offline viewing optimization
 * - Responsive design support
 * - Progress tracking
 * 
 * @param props - Component props
 * @returns JSX element (hidden component that handles export)
 */
export const HTMLExporter: React.FC<HTMLExporterProps> = ({
  content,
  options,
  onProgress,
  onComplete,
  className: _className
}) => {
  const hasExported = useRef(false);

  // === EFFECTS ===

  /**
   * Trigger HTML export when component mounts
   */
  useEffect(() => {
    if (hasExported.current) return;
    hasExported.current = true;

    const performExport = async () => {
      try {
        onProgress({ step: 'Processing content...', progress: 20 });

        // Process content for HTML
        const processedHTML = processContentForHTML(content, options);

        onProgress({ step: 'Generating HTML file...', progress: 60 });

        // Generate filename
        const filename = options.filename || 'document';

        onProgress({ step: 'Preparing download...', progress: 80 });

        // Download HTML file
        const result = downloadHTML(processedHTML, filename);

        onProgress({ step: 'Export completed', progress: 100 });

        onComplete(result);
      } catch (error) {
        console.error('HTML export failed:', error);
        onComplete({
          success: false,
          error: error instanceof Error ? error.message : 'HTML export failed'
        });
      }
    };

    performExport();
  }, [content, options, onProgress, onComplete]);

  // This component doesn't render anything visible
  return null;
};

export default HTMLExporter;