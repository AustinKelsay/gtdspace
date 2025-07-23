/**
 * @fileoverview Markdown preview component for Phase 1 editor
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - Basic markdown rendering with styling
 */

import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createLowlight, common } from 'lowlight';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { Copy, Check as CheckIcon } from 'lucide-react';

// Additional language imports for lowlight
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import c from 'highlight.js/lib/languages/c';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import html from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import toml from 'highlight.js/lib/languages/ini';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import powershell from 'highlight.js/lib/languages/powershell';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

/**
 * Props for the markdown preview component
 */
interface MarkdownPreviewProps {
  /** Markdown content to render */
  content: string;
  /** Optional CSS class name */
  className?: string;
}

// === SYNTAX HIGHLIGHTING SETUP ===
/**
 * Initialize lowlight with common languages plus additional popular ones
 */
const lowlight = createLowlight(common);

// Register additional languages
lowlight.register('javascript', javascript);
lowlight.register('js', javascript);
lowlight.register('typescript', typescript);
lowlight.register('ts', typescript);
lowlight.register('python', python);
lowlight.register('py', python);
lowlight.register('java', java);
lowlight.register('cpp', cpp);
lowlight.register('c++', cpp);
lowlight.register('c', c);
lowlight.register('csharp', csharp);
lowlight.register('cs', csharp);
lowlight.register('go', go);
lowlight.register('golang', go);
lowlight.register('rust', rust);
lowlight.register('rs', rust);
lowlight.register('php', php);
lowlight.register('ruby', ruby);
lowlight.register('rb', ruby);
lowlight.register('html', html);
lowlight.register('css', css);
lowlight.register('scss', scss);
lowlight.register('json', json);
lowlight.register('yaml', yaml);
lowlight.register('yml', yaml);
lowlight.register('toml', toml);
lowlight.register('xml', xml);
lowlight.register('bash', bash);
lowlight.register('sh', bash);
lowlight.register('shell', bash);
lowlight.register('powershell', powershell);
lowlight.register('ps1', powershell);
lowlight.register('sql', sql);
lowlight.register('markdown', markdown);
lowlight.register('md', markdown);
lowlight.register('dockerfile', dockerfile);

// === COMPONENTS ===

/**
 * HighlightedCodeBlock component with syntax highlighting and copy functionality
 */
interface HighlightedCodeBlockProps {
  code: string;
  language: string;
}

function HighlightedCodeBlock({ code, language }: HighlightedCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  }, [code]);

  // Get language display name
  const getLanguageDisplayName = (lang: string): string => {
    const languageMap: Record<string, string> = {
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      python: 'Python',
      java: 'Java',
      cpp: 'C++',
      csharp: 'C#',
      go: 'Go',
      rust: 'Rust',
      php: 'PHP',
      ruby: 'Ruby',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      json: 'JSON',
      yaml: 'YAML',
      xml: 'XML',
      bash: 'Bash',
      powershell: 'PowerShell',
      sql: 'SQL',
      markdown: 'Markdown',
      dockerfile: 'Dockerfile',
      plaintext: 'Plain Text',
      text: 'Plain Text',
    };
    return languageMap[lang] || lang || 'Plain Text';
  };

  const displayName = getLanguageDisplayName(language);

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span>{displayName}</span>
        <button
          className="code-block-copy-btn"
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <CheckIcon className="w-3 h-3 inline mr-1" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 inline mr-1" />
              Copy
            </>
          )}
        </button>
      </div>
      <div className="hljs">
        {renderHighlightedCodeContent(code, language)}
      </div>
    </div>
  );
}

/**
 * Renders syntax-highlighted code content
 */
function renderHighlightedCodeContent(code: string, language: string): React.ReactNode {
  try {
    const registeredLanguages = lowlight.listLanguages();
    const langId = language || 'plaintext';

    if (!registeredLanguages.includes(langId) && langId !== 'plaintext') {
      return (
        <pre>
          <code>{code}</code>
        </pre>
      );
    }

    const tree = lowlight.highlight(langId === 'plaintext' ? 'text' : langId, code);
    const highlighted = toJsxRuntime(tree, {
      jsx,
      jsxs,
      Fragment,
      components: {
        pre: ({ children, ...props }) => <pre {...props}>{children}</pre>,
        code: ({ children, ...props }) => <code {...props}>{children}</code>,
      },
    });

    return highlighted;
  } catch (error) {
    console.error('Error in renderHighlightedCodeContent:', error);
    return (
      <pre>
        <code>{code}</code>
      </pre>
    );
  }
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

    // Code elements with syntax highlighting
    code({ inline, className, children }: any) {
      if (inline) {
        return (
          <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
            {children}
          </code>
        );
      }

      // Block code with syntax highlighting
      const codeString = String(children).replace(/\n$/, '');
      // Extract language from className (e.g., "language-javascript" -> "javascript")
      const language = className ? className.replace('language-', '').toLowerCase() : 'plaintext';
      return <HighlightedCodeBlock code={codeString} language={language} />;
    },

    // Preformatted text blocks
    pre: ({ children }: any) => (
      <div className="mb-4 overflow-x-auto">
        {children}
      </div>
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