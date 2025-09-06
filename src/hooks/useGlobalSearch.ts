/**
 * @fileoverview Global search hook for Phase 2 functionality
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Global search implementation
 */

import { useState, useCallback } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import type { SearchResponse, SearchFilters, SearchResult } from '@/types';

export interface UseGlobalSearchResult {
  /** Current search query */
  query: string;
  /** Search results */
  results: SearchResult[];
  /** Search filters */
  filters: SearchFilters;
  /** Whether search is in progress */
  isSearching: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Search metadata */
  metadata: {
    totalMatches: number;
    filesSearched: number;
    duration: number;
    truncated: boolean;
  } | null;
  /** Update search query */
  setQuery: (query: string) => void;
  /** Update search filters */
  setFilters: (filters: Partial<SearchFilters>) => void;
  /** Perform search */
  search: (directory: string, query?: string) => Promise<void>;
  /** Clear search results */
  clearResults: () => void;
}

const DEFAULT_FILTERS: SearchFilters = {
  case_sensitive: false,
  whole_word: false,
  use_regex: false,
  include_file_names: true,
  max_results: 100,
};

/**
 * Hook for managing global search functionality
 */
export function useGlobalSearch(): UseGlobalSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{
    totalMatches: number;
    filesSearched: number;
    duration: number;
    truncated: boolean;
  } | null>(null);

  /**
   * Perform search operation
   */
  const performSearch = useCallback(async (directory: string, searchQuery?: string) => {
    const queryToUse = searchQuery || query;
    
    if (!queryToUse.trim()) {
      setResults([]);
      setMetadata(null);
      setError(null);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);

      const response = await safeInvoke<SearchResponse>('search_files', {
        query: queryToUse,
        directory,
        filters,
      }, { results: [], total_matches: 0, files_searched: 0, duration_ms: 0, truncated: false });
      if (!response) {
        throw new Error('Search failed');
      }

      setResults(response.results);
      setMetadata({
        totalMatches: response.total_matches,
        filesSearched: response.files_searched,
        duration: response.duration_ms,
        truncated: response.truncated,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
      setMetadata(null);
    } finally {
      setIsSearching(false);
    }
  }, [query, filters]);

  /**
   * Update search query
   */
  const handleSetQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  /**
   * Update search filters
   */
  const handleSetFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * Clear search results
   */
  const clearResults = useCallback(() => {
    setResults([]);
    setMetadata(null);
    setError(null);
    setQuery('');
  }, []);

  return {
    query,
    results,
    filters,
    isSearching,
    error,
    metadata,
    setQuery: handleSetQuery,
    setFilters: handleSetFilters,
    search: performSearch,
    clearResults,
  };
}

export default useGlobalSearch;