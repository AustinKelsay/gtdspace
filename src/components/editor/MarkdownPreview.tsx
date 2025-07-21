/**
 * @fileoverview Markdown preview component for Phase 1 editor
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - Basic markdown rendering with styling
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * Props for the markdown preview component
 */
interface MarkdownPreviewProps {
  /** Markdown content to render */
  content: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Markdown preview component using react-markdown
 * 
 * Renders markdown content with proper styling that matches the 
 * application's design system. Includes support for common markdown
 * elements like headings, lists, links, code blocks, and more.
 * 
 * @param props - Component props
 * @returns Rendered markdown preview
 * 
 * @example
 * ```tsx
 * <MarkdownPreview 
 *   content="# Hello\n\nThis is **bold** text."
 *   className="border rounded"
 * />
 * ```
 */
export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className = '',
}) => {
  // === RENDER HELPERS ===
  
  /**
   * Custom components for react-markdown to match our design system
   */
  const components = {
    // Headings with proper styling
    h1: ({ children }: any) => (
      <h1 className="text-3xl font-bold mb-4 text-foreground border-b border-border pb-2">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-2xl font-semibold mb-3 text-foreground">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-xl font-semibold mb-3 text-foreground">
        {children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-lg font-semibold mb-2 text-foreground">
        {children}
      </h4>
    ),
    h5: ({ children }: any) => (
      <h5 className="text-base font-semibold mb-2 text-foreground">
        {children}
      </h5>
    ),
    h6: ({ children }: any) => (
      <h6 className="text-sm font-semibold mb-2 text-foreground">
        {children}
      </h6>
    ),
    
    // Paragraphs with proper spacing
    p: ({ children }: any) => (
      <p className="mb-4 text-foreground leading-relaxed">
        {children}
      </p>
    ),
    
    // Lists with proper styling
    ul: ({ children }: any) => (
      <ul className="mb-4 ml-6 space-y-1 list-disc text-foreground">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="mb-4 ml-6 space-y-1 list-decimal text-foreground">
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="text-foreground">
        {children}
      </li>
    ),
    
    // Links with proper styling
    a: ({ href, children }: any) => (
      <a 
        href={href}
        className="text-primary hover:text-primary/80 underline underline-offset-2"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    
    // Code elements
    code: ({ children, className }: any) => {
      const isInline = !className;
      
      if (isInline) {
        return (
          <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
            {children}
          </code>
        );
      }
      
      // Block code
      return (
        <code className="block bg-muted p-4 rounded-lg text-sm font-mono text-foreground overflow-x-auto mb-4 whitespace-pre">
          {children}
        </code>
      );
    },
    
    // Preformatted text blocks
    pre: ({ children }: any) => (
      <pre className="bg-muted p-4 rounded-lg mb-4 overflow-x-auto">
        {children}
      </pre>
    ),
    
    // Blockquotes
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-primary pl-4 mb-4 text-muted-foreground italic">
        {children}
      </blockquote>
    ),
    
    // Horizontal rules
    hr: () => (
      <hr className="my-6 border-border" />
    ),
    
    // Tables
    table: ({ children }: any) => (
      <div className="mb-4 overflow-x-auto">
        <table className="min-w-full border-collapse border border-border">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-muted">
        {children}
      </thead>
    ),
    tbody: ({ children }: any) => (
      <tbody>
        {children}
      </tbody>
    ),
    tr: ({ children }: any) => (
      <tr className="border-b border-border">
        {children}
      </tr>
    ),
    th: ({ children }: any) => (
      <th className="border border-border px-3 py-2 text-left font-semibold text-foreground">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="border border-border px-3 py-2 text-foreground">
        {children}
      </td>
    ),
    
    // Images
    img: ({ src, alt }: any) => (
      <img 
        src={src} 
        alt={alt}
        className="max-w-full h-auto rounded-lg mb-4 shadow-sm"
      />
    ),
  };

  // === RENDER ===
  
  if (!content.trim()) {
    return (
      <div className={`h-full flex items-center justify-center ${className}`}>
        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-2">Nothing to preview</p>
          <p className="text-muted-foreground text-xs">
            Start writing in the editor to see a preview
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full ${className}`}>
      <ScrollArea className="h-full">
        <div className="p-4">
          <div className="max-w-none prose prose-slate dark:prose-invert">
            <ReactMarkdown components={components}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default MarkdownPreview;