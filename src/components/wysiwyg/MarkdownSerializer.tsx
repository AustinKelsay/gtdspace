/**
 * @fileoverview Simple markdown serialization utilities for WYSIWYG editor
 * @author Development Team
 * @created 2024-01-XX
 * @updated 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === TYPES ===
/**
 * Markdown conversion result
 */
export interface ConversionResult {
  /** Converted content */
  content: string;
  /** Whether conversion was successful */
  success: boolean;
  /** Error message if conversion failed */
  error?: string;
}

/**
 * Serialization options
 */
export interface SerializationOptions {
  /** Whether to preserve HTML tags */
  preserveHTML?: boolean;
  /** Custom heading prefix */
  headingPrefix?: string;
}

// === UTILITY FUNCTIONS ===
/**
 * Convert HTML content to markdown (simplified implementation)
 * 
 * @param html - HTML content
 * @param options - Conversion options
 * @returns Conversion result with markdown text or error
 */
export function htmlToMarkdown(html: string, _options: SerializationOptions = {}): ConversionResult {
  try {
    if (!html || typeof html !== 'string') {
      return { content: '', success: true };
    }

    let markdown = html
      // Headers
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      
      // Text formatting
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '_$1_')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '_$1_')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      
      // Links and images
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)')
      
      // Lists
      .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_match, content) => {
        const items = content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
        return items + '\n';
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_match, content) => {
        let counter = 1;
        const items = content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${counter++}. $1\n`);
        return items + '\n';
      })
      
      // Blockquotes
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_match, content) => {
        return content.split('\n').map((line: string) => `> ${line.trim()}`).join('\n') + '\n\n';
      })
      
      // Code blocks
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n\n')
      
      // Paragraphs and line breaks
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br[^>]*\/?>/gi, '\n')
      
      // Remove remaining HTML tags
      .replace(/<[^>]*>/g, '')
      
      // Clean up whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { content: markdown, success: true };
  } catch (error) {
    return {
      content: '',
      success: false,
      error: `Failed to convert HTML to markdown: ${(error as Error).message}`
    };
  }
}

/**
 * Convert markdown content to HTML (simplified implementation)
 * 
 * @param markdown - Markdown content
 * @param options - Conversion options
 * @returns Conversion result with HTML text or error
 */
export function markdownToHtml(markdown: string, _options: SerializationOptions = {}): ConversionResult {
  try {
    if (!markdown || typeof markdown !== 'string') {
      return { content: '', success: true };
    }

    let html = markdown
      // Headers
      .replace(/^#{6}\s+(.*)$/gm, '<h6>$1</h6>')
      .replace(/^#{5}\s+(.*)$/gm, '<h5>$1</h5>')
      .replace(/^#{4}\s+(.*)$/gm, '<h4>$1</h4>')
      .replace(/^#{3}\s+(.*)$/gm, '<h3>$1</h3>')
      .replace(/^#{2}\s+(.*)$/gm, '<h2>$1</h2>')
      .replace(/^#{1}\s+(.*)$/gm, '<h1>$1</h1>')
      
      // Text formatting
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      
      // Links and images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      
      // Lists (basic implementation)
      .replace(/^[-*+]\s+(.*)$/gm, '<li>$1</li>')
      .replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>')
      
      // Blockquotes
      .replace(/^>\s*(.*)$/gm, '<blockquote>$1</blockquote>')
      
      // Line breaks and paragraphs
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      
      // Clean up empty paragraphs
      .replace(/<p><\/p>/g, '')
      .replace(/<p>\s*<\/p>/g, '');

    return { content: html, success: true };
  } catch (error) {
    return {
      content: '',
      success: false,
      error: `Failed to convert markdown to HTML: ${(error as Error).message}`
    };
  }
}

/**
 * Quick utility to convert markdown to HTML
 * 
 * @param markdown - Markdown text
 * @returns HTML string or empty string on error
 */
export function quickMarkdownToHtml(markdown: string): string {
  const result = markdownToHtml(markdown);
  return result.success ? result.content : '';
}

/**
 * Quick utility to convert HTML to markdown
 * 
 * @param html - HTML text
 * @returns Markdown string or empty string on error
 */
export function quickHtmlToMarkdown(html: string): string {
  const result = htmlToMarkdown(html);
  return result.success ? result.content : '';
}

// === EXPORTS ===
export default { htmlToMarkdown, markdownToHtml, quickMarkdownToHtml, quickHtmlToMarkdown };