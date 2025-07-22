/**
 * @fileoverview Document outline component that auto-generates from headers
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText, Hash } from 'lucide-react';

// Internal imports
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// === TYPES ===
/**
 * Outline heading item
 */
interface OutlineHeading {
  /** Unique identifier */
  id: string;
  /** Heading text content */
  text: string;
  /** Heading level (1-6) */
  level: number;
  /** Position in document (line number or offset) */
  position: number;
  /** Child headings */
  children: OutlineHeading[];
  /** Whether this section is collapsed */
  collapsed?: boolean;
}

/**
 * Props for the DocumentOutline component
 */
interface DocumentOutlineProps {
  /** Document content to parse for headings */
  content: string;
  /** Current scroll position or active heading ID */
  activeHeadingId?: string;
  /** Callback when heading is clicked */
  onHeadingClick?: (heading: OutlineHeading) => void;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Whether to allow collapsing sections */
  allowCollapse?: boolean;
  /** Maximum depth to show (1-6) */
  maxDepth?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to auto-expand active sections */
  autoExpand?: boolean;
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
 * Default maximum depth for outline
 */
const DEFAULT_MAX_DEPTH = 6;

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
function parseMarkdownHeadings(content: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  // Lines parsing handled by regex instead
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
      children: [],
    });

    index++;
  }

  return headings;
}

/**
 * Parses HTML content to extract headings
 */
function parseHtmlHeadings(content: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
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
      children: [],
    });

    index++;
  }

  return headings;
}

/**
 * Builds a hierarchical tree structure from flat headings
 */
function buildHeadingTree(headings: OutlineHeading[]): OutlineHeading[] {
  const tree: OutlineHeading[] = [];
  const stack: OutlineHeading[] = [];

  headings.forEach(heading => {
    // Remove headings from stack that are at same or deeper level
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    // If stack is empty, this is a top-level heading
    if (stack.length === 0) {
      tree.push(heading);
    } else {
      // Add as child to the last heading in stack
      stack[stack.length - 1].children.push(heading);
    }

    // Add current heading to stack
    stack.push(heading);
  });

  return tree;
}

/**
 * Filters headings by maximum depth
 */
function filterHeadingsByDepth(headings: OutlineHeading[], maxDepth: number): OutlineHeading[] {
  return headings
    .filter(heading => heading.level <= maxDepth)
    .map(heading => ({
      ...heading,
      children: filterHeadingsByDepth(heading.children, maxDepth),
    }));
}

/**
 * Flattens heading tree to get all headings
 */
function flattenHeadings(headings: OutlineHeading[]): OutlineHeading[] {
  const flattened: OutlineHeading[] = [];

  function traverse(headings: OutlineHeading[]) {
    headings.forEach(heading => {
      flattened.push(heading);
      if (heading.children.length > 0) {
        traverse(heading.children);
      }
    });
  }

  traverse(headings);
  return flattened;
}

// === MAIN COMPONENT ===
/**
 * Document outline component that auto-generates from headers
 * 
 * Automatically parses markdown or HTML content to extract headings and
 * builds a navigable outline with collapsible sections.
 * 
 * Features:
 * - Auto-detects markdown and HTML headings
 * - Hierarchical tree structure
 * - Collapsible sections
 * - Active heading highlighting
 * - Click navigation
 * - Line number display
 * 
 * @param props - Component props
 * @returns JSX element containing the document outline
 * 
 * @example
 * ```tsx
 * <DocumentOutline
 *   content={markdownContent}
 *   activeHeadingId="heading-introduction-0"
 *   onHeadingClick={(heading) => scrollToHeading(heading)}
 *   allowCollapse={true}
 *   maxDepth={4}
 * />
 * ```
 */
export const DocumentOutline: React.FC<DocumentOutlineProps> = ({
  content,
  activeHeadingId,
  onHeadingClick,
  showLineNumbers = false,
  allowCollapse = true,
  maxDepth = DEFAULT_MAX_DEPTH,
  className,
  autoExpand = true,
}) => {
  // === LOCAL STATE ===
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // === MEMOIZED VALUES ===

  /**
   * Parsed and structured headings
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

    // Build hierarchical tree
    return buildHeadingTree(filteredHeadings);
  }, [content, maxDepth]);

  /**
   * Flattened list of all headings for active detection
   */
  const allHeadings = useMemo(() => flattenHeadings(headings), [headings]);

  // === HANDLERS ===

  /**
   * Handles clicking on a heading
   */
  const handleHeadingClick = useCallback((heading: OutlineHeading, event: React.MouseEvent) => {
    event.preventDefault();
    onHeadingClick?.(heading);
  }, [onHeadingClick]);

  /**
   * Toggles collapsed state of a section
   */
  const toggleSection = useCallback((headingId: string) => {
    if (!allowCollapse) return;

    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(headingId)) {
        newSet.delete(headingId);
      } else {
        newSet.add(headingId);
      }
      return newSet;
    });
  }, [allowCollapse]);

  // === EFFECTS ===

  /**
   * Auto-expand sections containing active heading
   */
  useEffect(() => {
    if (!autoExpand || !activeHeadingId) return;

    const activeHeading = allHeadings.find(h => h.id === activeHeadingId);
    if (!activeHeading) return;

    // Find parent headings that should be expanded
    const parentsToExpand = new Set<string>();

    function findParents(headings: OutlineHeading[], targetLevel: number, targetPosition: number) {
      for (const heading of headings) {
        if (heading.level < targetLevel && heading.position < targetPosition) {
          parentsToExpand.add(heading.id);
          if (heading.children.length > 0) {
            findParents(heading.children, targetLevel, targetPosition);
          }
        }
      }
    }

    findParents(headings, activeHeading.level, activeHeading.position);

    // Remove collapsed state for parent sections
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      parentsToExpand.forEach(id => newSet.delete(id));
      return newSet;
    });
  }, [activeHeadingId, allHeadings, headings, autoExpand]);

  // === RENDER HELPERS ===

  // Level indicator rendering functionality temporarily simplified

  /**
   * Renders a single heading item
   */
  const renderHeading = (heading: OutlineHeading, depth = 0) => {
    const isActive = heading.id === activeHeadingId;
    const isCollapsed = collapsedSections.has(heading.id);
    const hasChildren = heading.children.length > 0;
    const indentLevel = Math.max(0, heading.level - 1);

    return (
      <div key={heading.id} className="outline-heading-item">
        <div
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors group',
            'hover:bg-accent hover:text-accent-foreground',
            isActive && 'bg-accent text-accent-foreground font-medium',
            'text-sm'
          )}
          style={{ paddingLeft: `${8 + indentLevel * 16}px` }}
          onClick={(e) => handleHeadingClick(heading, e)}
        >
          {/* Collapse/Expand Button */}
          {hasChildren && allowCollapse ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                toggleSection(heading.id);
              }}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          ) : (
            <div className="w-4" />
          )}

          {/* Heading Level Indicator */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <Hash className="h-3 w-3" />
            <span className="text-xs font-mono">{heading.level}</span>
          </div>

          {/* Heading Text */}
          <span className="flex-1 truncate" title={heading.text}>
            {heading.text}
          </span>

          {/* Line Number */}
          {showLineNumbers && (
            <span className="text-xs text-muted-foreground font-mono">
              {heading.position}
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && !isCollapsed && (
          <div className="outline-children">
            {heading.children.map(child => renderHeading(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  /**
   * Renders empty state
   */
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
      <FileText className="h-8 w-8 mb-2 opacity-50" />
      <div className="text-sm font-medium mb-1">No headings found</div>
      <div className="text-xs">
        Add some headers (# ## ###) to see the document outline
      </div>
    </div>
  );

  // === MAIN RENDER ===

  if (headings.length === 0) {
    return (
      <div className={cn('document-outline p-4', className)}>
        {renderEmptyState()}
      </div>
    );
  }

  return (
    <div className={cn('document-outline', className)}>
      <ScrollArea className="h-full">
        <div className="p-2 space-y-1">
          {headings.map(heading => renderHeading(heading))}
        </div>
      </ScrollArea>
    </div>
  );
};

// === EXPORTS ===
export default DocumentOutline;