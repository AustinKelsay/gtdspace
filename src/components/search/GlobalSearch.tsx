/**
 * @fileoverview Global search component for searching across all files
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Global search UI
 */

import React, { useState, useEffect } from 'react';
import { Search, Filter, X, Clock, FileText, Loader2, Replace, History, Star, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchResults } from './SearchResults';
import { SearchFilters } from './SearchFilters';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import type { BaseComponentProps, MarkdownFile } from '@/types';

export interface GlobalSearchProps extends BaseComponentProps {
  /** Whether the search dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Current folder being searched */
  currentFolder: string | null;
  /** Callback when a search result is selected */
  onResultSelect: (file: MarkdownFile, lineNumber?: number) => void;
  /** Callback when replace operation is performed */
  onReplaceInFile?: (filePath: string, searchTerm: string, replaceTerm: string) => Promise<boolean>;
}

/**
 * Global search component for searching across all markdown files
 */
export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  isOpen,
  onClose,
  currentFolder,
  onResultSelect,
  onReplaceInFile,
  className = '',
  ...props
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'replace'>('search');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [replaceResults, setReplaceResults] = useState<{filePath: string, success: boolean}[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<{name: string, query: string, filters: any}[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const {
    query,
    results,
    filters,
    isSearching,
    error,
    metadata,
    setQuery,
    setFilters,
    search,
    clearResults,
  } = useGlobalSearch();

  // Load search history and saved searches on mount
  useEffect(() => {
    if (isOpen) {
      const history = JSON.parse(localStorage.getItem('gtdspace-search-history') || '[]');
      const saved = JSON.parse(localStorage.getItem('gtdspace-saved-searches') || '[]');
      setSearchHistory(history.slice(0, 10)); // Keep last 10 searches
      setSavedSearches(saved);
    }
  }, [isOpen]);

  // Perform search when query changes
  useEffect(() => {
    if (isOpen && currentFolder && query.trim()) {
      search(currentFolder, query);
    }
  }, [query, currentFolder, filters, isOpen, search]);

  // Clear results when dialog opens
  useEffect(() => {
    if (isOpen) {
      clearResults();
    }
  }, [isOpen, clearResults]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentFolder && query.trim()) {
      search(currentFolder, query);
      addToSearchHistory(query.trim());
    }
  };

  const addToSearchHistory = (searchQuery: string) => {
    setSearchHistory(prev => {
      const newHistory = [searchQuery, ...prev.filter(q => q !== searchQuery)].slice(0, 10);
      localStorage.setItem('gtdspace-search-history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const saveCurrentSearch = () => {
    const searchName = prompt('Enter a name for this search:');
    if (searchName && query.trim()) {
      const newSavedSearch = {
        name: searchName,
        query: query.trim(),
        filters: filters,
      };
      
      setSavedSearches(prev => {
        const newSaved = [...prev, newSavedSearch];
        localStorage.setItem('gtdspace-saved-searches', JSON.stringify(newSaved));
        return newSaved;
      });
    }
  };

  const loadSavedSearch = (savedSearch: {name: string, query: string, filters: any}) => {
    setQuery(savedSearch.query);
    setFilters(savedSearch.filters);
    setShowHistory(false);
  };

  const deleteSavedSearch = (index: number) => {
    setSavedSearches(prev => {
      const newSaved = prev.filter((_, i) => i !== index);
      localStorage.setItem('gtdspace-saved-searches', JSON.stringify(newSaved));
      return newSaved;
    });
  };

  const handleResultClick = (result: any) => {
    // Create a mock MarkdownFile object from the search result
    const file: MarkdownFile = {
      id: result.file_path,
      name: result.file_name,
      path: result.file_path,
      size: 0, // We don't have size info from search
      last_modified: 0, // We don't have timestamp from search
      extension: result.file_name.split('.').pop() || 'md',
    };

    onResultSelect(file, result.line_number);
    onClose();
  };

  const handleReplaceAll = async () => {
    if (!onReplaceInFile || !query.trim() || !replaceQuery.trim()) return;
    
    setIsReplacing(true);
    setReplaceResults([]);
    
    try {
      // Get unique file paths from search results
      const uniqueFiles = Array.from(new Set(results.map(r => r.file_path)));
      const results_array: {filePath: string, success: boolean}[] = [];
      
      for (const filePath of uniqueFiles) {
        try {
          const success = await onReplaceInFile(filePath, query, replaceQuery);
          results_array.push({ filePath, success });
        } catch (error) {
          console.error(`Failed to replace in ${filePath}:`, error);
          results_array.push({ filePath, success: false });
        }
      }
      
      setReplaceResults(results_array);
      
      // Re-run search to show updated results
      if (currentFolder) {
        search(currentFolder, query);
      }
    } finally {
      setIsReplacing(false);
    }
  };

  if (!currentFolder) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={`max-w-3xl max-h-[80vh] p-6 ${className}`} {...props}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Global Search
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Please select a folder first to enable global search.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-4xl max-h-[80vh] p-0 ${className}`} {...props}>
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Global Search
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex flex-col h-[600px]">
          {/* Tab Bar */}
          <div className="border-b">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'search' | 'replace')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-none bg-muted/30">
                <TabsTrigger value="search" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search
                </TabsTrigger>
                <TabsTrigger value="replace" className="flex items-center gap-2">
                  <Replace className="h-4 w-4" />
                  Replace
                </TabsTrigger>
              </TabsList>
              
              {/* Search Tab Content */}
              <TabsContent value="search" className="mt-0">
                <div className="p-4 border-b bg-muted/30">
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search across all markdown files..."
                        className="pl-10 pr-4"
                        autoFocus
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHistory(!showHistory)}
                      className={showHistory ? 'bg-accent' : ''}
                      title="Search History & Saved Searches"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className={showFilters ? 'bg-accent' : ''}
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                    {query.trim() && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={saveCurrentSearch}
                        title="Save Current Search"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                  </form>

                  {showFilters && (
                    <div className="mt-3">
                      <SearchFilters filters={filters} onChange={setFilters} />
                    </div>
                  )}
                  
                  {showHistory && (
                    <div className="mt-3 border-t pt-3">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Recent Searches */}
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Recent Searches
                          </h4>
                          <ScrollArea className="h-32">
                            {searchHistory.length > 0 ? (
                              <div className="space-y-1">
                                {searchHistory.map((historyQuery, index) => (
                                  <Button
                                    key={index}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setQuery(historyQuery);
                                      setShowHistory(false);
                                    }}
                                    className="w-full justify-start text-left p-2 h-auto"
                                  >
                                    <span className="truncate">{historyQuery}</span>
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground p-2">No recent searches</p>
                            )}
                          </ScrollArea>
                        </div>
                        
                        {/* Saved Searches */}
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Star className="h-4 w-4" />
                            Saved Searches
                          </h4>
                          <ScrollArea className="h-32">
                            {savedSearches.length > 0 ? (
                              <div className="space-y-1">
                                {savedSearches.map((saved, index) => (
                                  <div key={index} className="flex items-center gap-1 p-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => loadSavedSearch(saved)}
                                      className="flex-1 justify-start text-left h-auto p-1"
                                    >
                                      <div className="truncate">
                                        <div className="font-medium text-xs">{saved.name}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                          {saved.query}
                                        </div>
                                      </div>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteSavedSearch(index)}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground p-2">No saved searches</p>
                            )}
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              {/* Replace Tab Content */}
              <TabsContent value="replace" className="mt-0">
                <div className="p-4 border-b bg-muted/30 space-y-3">
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Find..."
                        className="pl-10 pr-4"
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className={showFilters ? 'bg-accent' : ''}
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                  </form>
                  
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Replace className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={replaceQuery}
                        onChange={(e) => setReplaceQuery(e.target.value)}
                        placeholder="Replace with..."
                        className="pl-10 pr-4"
                      />
                    </div>
                    <Button
                      onClick={handleReplaceAll}
                      disabled={!query.trim() || !results.length || isReplacing || !onReplaceInFile}
                      className="whitespace-nowrap"
                    >
                      {isReplacing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Replacing...
                        </>
                      ) : (
                        `Replace All (${results.length} matches)`
                      )}
                    </Button>
                  </div>

                  {showFilters && (
                    <div>
                      <SearchFilters filters={filters} onChange={setFilters} />
                    </div>
                  )}
                  
                  {replaceResults.length > 0 && (
                    <div className="text-sm">
                      <p className="font-medium mb-2">Replace Results:</p>
                      <ul className="space-y-1">
                        {replaceResults.map((result, index) => (
                          <li key={index} className={`flex items-center gap-2 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                            <span className={`w-2 h-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'}`} />
                            {result.filePath.split('/').pop()} {result.success ? 'updated' : 'failed'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Search Stats */}
          {metadata && (
            <div className="px-4 py-2 border-b bg-muted/10 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span>{metadata.totalMatches} matches</span>
                  <span>{metadata.filesSearched} files searched</span>
                  {metadata.truncated && (
                    <span className="text-amber-600">Results truncated</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{metadata.duration}ms</span>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-hidden">
            {error && (
              <div className="p-4">
                <Card className="p-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                  <p className="text-red-800 dark:text-red-200">
                    Search failed: {error}
                  </p>
                </Card>
              </div>
            )}

            {!error && !isSearching && query && results.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No results found for "{query}"
                  </p>
                </div>
              </div>
            )}

            {!error && !isSearching && !query && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Enter a search term to find content across all files
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Use Ctrl+Shift+F to open global search
                  </p>
                </div>
              </div>
            )}

            {results.length > 0 && (
              <SearchResults
                results={results}
                query={query}
                onResultClick={handleResultClick}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearch;