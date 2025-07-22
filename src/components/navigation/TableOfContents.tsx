/**
 * @fileoverview Table of contents component with navigable links
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import React, { useMemo, useCallback } from 'react';
import { BookOpen, Hash, ChevronRight } from 'lucide-react';

// Internal imports
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// === TYPES ===
/**
 * Table of contents heading item
 */
interface TOCHeading {
  /** Unique identifier */
  id: string;
  /** Heading text content */
  text: string;
  /** Heading level (1-6) */
  level: number;
  /** Position in document (line number or offset) */
  position: number;
  /** Number prefix for this heading */
  numberPrefix?: string;
}

/**
 * Props for the TableOfContents component
 */
interface TableOfContentsProps {
  /** Document content to parse for headings */
  content: string;
  /** Current active heading ID */
  activeHeadingId?: string;
  /** Callback when heading is clicked */
  onHeadingClick?: (heading: TOCHeading) => void;
  /** Whether to show heading numbers */
  showNumbers?: boolean;
  /** Maximum depth to show (1-6) */
  maxDepth?: number;
  /** Minimum heading level to start numbering from */
  minLevel?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show level indicators */
  showLevelIndicators?: boolean;
  /** Whether to allow collapsing sections */
  collapsible?: boolean;
}

// === CONSTANTS ===
/**
 * Regular expression for matching markdown headings
 */
const MARKDOWN_HEADING_REGEX = /^(#{1,6})\s+(.+)$/gm;

/**
 * Regular expression for matching HTML headings (for WYSIWYG content)
 */
const HTML_HEADING_REGEX = /<h([1-6])(?:[^>]*)>([^<]+)<\/h[1-6]>/gi;

/**
 * Default maximum depth for table of contents
 */
const DEFAULT_MAX_DEPTH = 6;

/**
 * Default minimum level for numbering
 */
const DEFAULT_MIN_LEVEL = 1;

// === UTILITY FUNCTIONS ===
/**
 * Generates a unique ID from heading text
 */
function generateHeadingId(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();

  return `heading-${slug}-${index}`;
}

/**
 * Parses markdown content to extract headings
 */
function parseMarkdownHeadings(content: string): TOCHeading[] {
  const headings: TOCHeading[] = [];
  let match;
  let index = 0;

  MARKDOWN_HEADING_REGEX.lastIndex = 0;

  while ((match = MARKDOWN_HEADING_REGEX.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const position = content.substring(0, match.index).split('\n').length;

    headings.push({
      id: generateHeadingId(text, index),
      text,
      level,
      position,
    });

    index++;
  }

  return headings;
}

/**
 * Parses HTML content to extract headings
 */
function parseHtmlHeadings(content: string): TOCHeading[] {
  const headings: TOCHeading[] = [];
  let match;
  let index = 0;

  HTML_HEADING_REGEX.lastIndex = 0;

  while ((match = HTML_HEADING_REGEX.exec(content)) !== null) {
    const level = parseInt(match[1], 10);
    const text = match[2].trim();
    const position = content.substring(0, match.index).split('\n').length;

    headings.push({
      id: generateHeadingId(text, index),
      text,
      level,
      position,
    });

    index++;
  }

  return headings;
}

/**
 * Generates hierarchical numbering for headings
 */
function generateHeadingNumbers(headings: TOCHeading[], minLevel: number): TOCHeading[] {
  const counters: number[] = new Array(6).fill(0);

  return headings.map(heading => {
    const levelIndex = heading.level - 1;

    // Reset counters for deeper levels
    for (let i = levelIndex + 1; i < counters.length; i++) {
      counters[i] = 0;
    }

    // Increment current level counter
    counters[levelIndex]++;

    // Generate number prefix if at or above minimum level
    let numberPrefix = '';
    if (heading.level >= minLevel) {
      const relevantCounters = counters.slice(minLevel - 1, levelIndex + 1);
      numberPrefix = relevantCounters.join('.');
    }

    return {
      ...heading,
      numberPrefix,
    };
  });
}

/**
 * Filters headings by maximum depth
 */
function filterHeadingsByDepth(headings: TOCHeading[], maxDepth: number): TOCHeading[] {
  return headings.filter(heading => heading.level <= maxDepth);
}

// === MAIN COMPONENT ===
/**
 * Table of contents component with navigable links
 * 
 * Automatically generates a clickable table of contents from document headers
 * with optional numbering, level indicators, and active heading highlighting.
 * 
 * Features:
 * - Auto-detects markdown and HTML headings
 * - Hierarchical numbering system
 * - Active heading highlighting
 * - Click navigation
 * - Level-based indentation
 * - Configurable depth limits
 * 
 * @param props - Component props
 * @returns JSX element containing the table of contents
 * 
 * @example
 * ```tsx
 * <TableOfContents
 *   content={documentContent}
 *   activeHeadingId="heading-introduction-0"
 *   onHeadingClick={(heading) => scrollToHeading(heading)}
 *   showNumbers={true}
 *   maxDepth={4}
 * />
 * ```
 */
export const TableOfContents: React.FC<TableOfContentsProps> = ({
  content,
  activeHeadingId,
  onHeadingClick,
  showNumbers = false,
  maxDepth = DEFAULT_MAX_DEPTH,
  minLevel = DEFAULT_MIN_LEVEL,
  className,
  showLevelIndicators = true,
  collapsible: _collapsible = false,
}) => {
  // === MEMOIZED VALUES ===

  /**
   * Parsed and processed headings with numbering
   */
  const headings = useMemo(() => {
    if (!content.trim()) return [];

    // Determine if content is HTML or markdown
    const isHtmlContent = /<[^>]+>/.test(content);

    // Parse headings based on content type
    const parsedHeadings = isHtmlContent
      ? parseHtmlHeadings(content)
      : parseMarkdownHeadings(content);

    // Filter by max depth
    const filteredHeadings = filterHeadingsByDepth(parsedHeadings, maxDepth);

    // Add numbering if enabled
    return showNumbers
      ? generateHeadingNumbers(filteredHeadings, minLevel)
      : filteredHeadings;
  }, [content, maxDepth, showNumbers, minLevel]);

  // === HANDLERS ===

  /**
   * Handles clicking on a heading link
   */
  const handleHeadingClick = useCallback((heading: TOCHeading, event: React.MouseEvent) => {
    event.preventDefault();
    onHeadingClick?.(heading);
  }, [onHeadingClick]);

  // === RENDER HELPERS ===

  /**
   * Renders the level indicator dots
   */
  const renderLevelIndicator = (level: number) => {
    if (!showLevelIndicators) return null;

    const dots = [];
    for (let i = 1; i < level; i++) {
      dots.push(
        <div
          key={i}
          className="w-1 h-1 bg-muted-foreground/30 rounded-full"
        />
      );
    }

    return dots.length > 0 ? (
      <div className="flex items-center gap-1 mr-2">
        {dots}
      </div>
    ) : null;
  };

  /**
   * Renders a single heading item
   */
  const renderHeading = (heading: TOCHeading) => {
    const isActive = heading.id === activeHeadingId;
    const indentLevel = Math.max(0, heading.level - 1);

    return (
      <div key={heading.id} className="toc-heading-item">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => handleHeadingClick(heading, e)}
          className={cn(
            'w-full justify-start text-left h-auto py-1.5 px-2',
            'hover:bg-accent hover:text-accent-foreground',
            'transition-colors duration-150',
            isActive && 'bg-accent text-accent-foreground font-medium',
            'text-sm'
          )}
          style={{ paddingLeft: `${8 + indentLevel * 12}px` }}
        >
          <div className="flex items-center w-full min-w-0">
            {/* Level Indicator */}
            {renderLevelIndicator(heading.level)}

            {/* Number Prefix */}
            {showNumbers && heading.numberPrefix && (
              <span className="text-muted-foreground font-mono text-xs mr-2 flex-shrink-0">
                {heading.numberPrefix}
              </span>
            )}

            {/* Heading Level Icon */}
            <Hash className="w-3 h-3 text-muted-foreground mr-1 flex-shrink-0" />

            {/* Heading Level Number */}
            <span className="text-xs text-muted-foreground font-mono mr-2 flex-shrink-0">
              H{heading.level}
            </span>

            {/* Heading Text */}
            <span className="flex-1 truncate min-w-0" title={heading.text}>
              {heading.text}
            </span>

            {/* Navigation Arrow */}
            <ChevronRight className="w-3 h-3 text-muted-foreground/60 ml-1 flex-shrink-0" />
          </div>
        </Button>
      </div>
    );
  };

  /**
   * Renders empty state
   */
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
      <BookOpen className="h-8 w-8 mb-2 opacity-50" />
      <div className="text-sm font-medium mb-1">No headings found</div>
      <div className="text-xs">
        Add some headers (# ## ###) to generate a table of contents
      </div>
    </div>
  );

  // === MAIN RENDER ===

  if (headings.length === 0) {
    return (
      <div className={cn('table-of-contents p-4', className)}>
        {renderEmptyState()}
      </div>
    );
  }

  return (
    <div className={cn('table-of-contents', className)}>
      <ScrollArea className="h-full">
        <div className="p-2 space-y-0.5">
          <div className="flex items-center gap-2 px-2 py-1 mb-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Table of Contents
            </span>
            {headings.length > 0 && (
              <span className="text-xs text-muted-foreground/60 ml-auto">
                {headings.length} {headings.length === 1 ? 'heading' : 'headings'}
              </span>
            )}
          </div>
          {headings.map(heading => renderHeading(heading))}
        </div>
      </ScrollArea>
    </div>
  );
};

// === EXPORTS ===
export default TableOfContents;