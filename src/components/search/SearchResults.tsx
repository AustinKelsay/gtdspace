/**
 * @fileoverview Search results display component
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Search results UI
 */

import React from 'react';
import { File, FileText, Folder } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import type { BaseComponentProps, SearchResult } from '@/types';

export interface SearchResultsProps extends BaseComponentProps {
  /** Search results to display */
  results: SearchResult[];
  /** Original search query for highlighting */
  query: string;
  /** Callback when a result is clicked */
  onResultClick: (result: SearchResult) => void;
}

/**
 * Component for displaying search results with highlighting
 */
export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  query,
  onResultClick,
  className = '',
  ...props
}) => {
  // Group results by file
  const groupedResults = React.useMemo(() => {
    const groups: { [filePath: string]: SearchResult[] } = {};
    
    results.forEach(result => {
      if (!groups[result.file_path]) {
        groups[result.file_path] = [];
      }
      groups[result.file_path].push(result);
    });
    
    return groups;
  }, [results]);

  /**
   * Highlight search query in text
   */
  const highlightMatch = (text: string, start: number, end: number) => {
    if (start < 0 || end > text.length || start >= end) {
      return <span>{text}</span>;
    }

    const before = text.slice(0, start);
    const match = text.slice(start, end);
    const after = text.slice(end);

    return (
      <span>
        {before}
        <mark className="bg-accent px-0.5 rounded">
          {match}
        </mark>
        {after}
      </span>
    );
  };

  /**
   * Get icon for result type
   */
  const getResultIcon = (result: SearchResult) => {
    if (result.line_number === 0 && result.line_content.startsWith('📁')) {
      return <Folder className="h-4 w-4 text-blue-500" />;
    }
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  if (results.length === 0) {
    return null;
  }

  return (
    <ScrollArea className={`h-full ${className}`} {...props}>
      <div className="p-4 space-y-4">
        {Object.entries(groupedResults).map(([filePath, fileResults]) => (
          <Card key={filePath} className="overflow-hidden">
            {/* File header */}
            <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
              <File className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm truncate">
                {fileResults[0].file_name}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {fileResults.length} match{fileResults.length !== 1 ? 'es' : ''}
              </span>
            </div>

            {/* Results for this file */}
            <div className="divide-y">
              {fileResults.map((result, index) => (
                <button
                  key={`${result.file_path}-${result.line_number}-${index}`}
                  onClick={() => onResultClick(result)}
                  className="w-full text-left p-3 hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:bg-accent focus:text-accent-foreground"
                >
                  <div className="flex items-start gap-3">
                    {getResultIcon(result)}
                    <div className="flex-1 min-w-0">
                      {/* Line number and content */}
                      <div className="flex items-center gap-2 mb-1">
                        {result.line_number > 0 && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                            L{result.line_number + 1}
                          </span>
                        )}
                        <div className="text-sm font-mono leading-relaxed">
                          {highlightMatch(
                            result.line_content,
                            result.match_start,
                            result.match_end
                          )}
                        </div>
                      </div>

                      {/* Context */}
                      {(result.context_before?.length || result.context_after?.length) && (
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-2">
                          {result.context_before?.map((line, idx) => (
                            <div key={`before-${idx}`} className="font-mono opacity-60">
                              {line}
                            </div>
                          ))}
                          {result.context_after?.map((line, idx) => (
                            <div key={`after-${idx}`} className="font-mono opacity-60">
                              {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};

export default SearchResults;