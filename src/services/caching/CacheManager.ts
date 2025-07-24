/**
 * @fileoverview Central cache management system
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Unified caching strategy
 */

import { LRUCache, createFileContentCache, createParsedMarkdownCache, createSearchResultsCache } from './LRUCache';
import { performanceMonitor } from '@/services/performance/PerformanceMonitor';

// === TYPES ===

export interface CacheManagerConfig {
  enableFileCache?: boolean;
  enableParseCache?: boolean;
  enableSearchCache?: boolean;
  maxFileSize?: number;
  logCacheStats?: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size?: number;
  hash?: string;
}

// === CACHE MANAGER CLASS ===

/**
 * Central cache management system
 * 
 * Coordinates multiple caches for different data types:
 * - File content cache
 * - Parsed markdown cache
 * - Search results cache
 * - Image/media cache (future)
 */
export class CacheManager {
  private static instance: CacheManager | null = null;
  
  private fileContentCache: LRUCache<string, string>;
  private parsedMarkdownCache: LRUCache<string, any>;
  private searchResultsCache: LRUCache<string, any[]>;
  private config: CacheManagerConfig;
  
  private constructor(config: CacheManagerConfig = {}) {
    this.config = {
      enableFileCache: true,
      enableParseCache: true,
      enableSearchCache: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      logCacheStats: false,
      ...config
    };
    
    // Initialize caches
    this.fileContentCache = createFileContentCache();
    this.parsedMarkdownCache = createParsedMarkdownCache();
    this.searchResultsCache = createSearchResultsCache();
    
    // Log stats periodically if enabled
    if (this.config.logCacheStats) {
      this.startStatsLogging();
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: CacheManagerConfig): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  // === FILE CONTENT CACHE ===

  /**
   * Get file content from cache
   */
  public getFileContent(path: string): string | undefined {
    if (!this.config.enableFileCache) {
      return undefined;
    }

    performanceMonitor.startTiming('cache_file_get');
    const content = this.fileContentCache.get(path);
    performanceMonitor.endTiming('cache_file_get');

    return content;
  }

  /**
   * Set file content in cache
   */
  public setFileContent(path: string, content: string): void {
    if (!this.config.enableFileCache) {
      return;
    }

    // Don't cache files larger than maxFileSize
    const size = new Blob([content]).size;
    if (size > this.config.maxFileSize!) {
      console.debug(`File too large for cache: ${path} (${size} bytes)`);
      return;
    }

    performanceMonitor.startTiming('cache_file_set');
    this.fileContentCache.set(path, content, size);
    performanceMonitor.endTiming('cache_file_set');
  }

  /**
   * Invalidate file content cache
   */
  public invalidateFileContent(path: string): void {
    this.fileContentCache.delete(path);
    // Also invalidate parsed markdown for this file
    this.parsedMarkdownCache.delete(path);
  }

  // === PARSED MARKDOWN CACHE ===

  /**
   * Get parsed markdown from cache
   */
  public getParsedMarkdown(path: string): any | undefined {
    if (!this.config.enableParseCache) {
      return undefined;
    }

    return this.parsedMarkdownCache.get(path);
  }

  /**
   * Set parsed markdown in cache
   */
  public setParsedMarkdown(path: string, parsed: any): void {
    if (!this.config.enableParseCache) {
      return;
    }

    this.parsedMarkdownCache.set(path, parsed);
  }

  // === SEARCH RESULTS CACHE ===

  /**
   * Get search results from cache
   */
  public getSearchResults(query: string, folder: string): any[] | undefined {
    if (!this.config.enableSearchCache) {
      return undefined;
    }

    const key = `${folder}:${query}`;
    return this.searchResultsCache.get(key);
  }

  /**
   * Set search results in cache
   */
  public setSearchResults(query: string, folder: string, results: any[]): void {
    if (!this.config.enableSearchCache) {
      return;
    }

    const key = `${folder}:${query}`;
    this.searchResultsCache.set(key, results);
  }

  /**
   * Invalidate all search results for a folder
   */
  public invalidateSearchResults(folder: string): void {
    const keys = this.searchResultsCache.keys();
    keys.forEach(key => {
      if (key.startsWith(`${folder}:`)) {
        this.searchResultsCache.delete(key);
      }
    });
  }

  // === CACHE MANAGEMENT ===

  /**
   * Clear all caches
   */
  public clearAll(): void {
    this.fileContentCache.clear();
    this.parsedMarkdownCache.clear();
    this.searchResultsCache.clear();
  }

  /**
   * Clear specific cache type
   */
  public clearCache(type: 'file' | 'parse' | 'search'): void {
    switch (type) {
      case 'file':
        this.fileContentCache.clear();
        break;
      case 'parse':
        this.parsedMarkdownCache.clear();
        break;
      case 'search':
        this.searchResultsCache.clear();
        break;
    }
  }

  /**
   * Get cache statistics
   */
  public getStats() {
    return {
      fileContent: this.fileContentCache.getStats(),
      parsedMarkdown: this.parsedMarkdownCache.getStats(),
      searchResults: this.searchResultsCache.getStats(),
      totalSize: this.getTotalCacheSize(),
    };
  }

  /**
   * Get total cache size (approximate)
   */
  private getTotalCacheSize(): number {
    // This is a rough estimate
    const fileContentSize = this.fileContentCache.size * 5000; // ~5KB average per file
    const parsedSize = this.parsedMarkdownCache.size * 2000; // ~2KB average per parsed doc
    const searchSize = this.searchResultsCache.size * 1000; // ~1KB average per search
    
    return fileContentSize + parsedSize + searchSize;
  }

  /**
   * Preload file into cache
   */
  public async preloadFile(path: string, content: string): Promise<void> {
    this.setFileContent(path, content);
  }

  /**
   * Batch preload files
   */
  public async preloadFiles(files: Array<{ path: string; content: string }>): Promise<void> {
    files.forEach(({ path, content }) => {
      this.setFileContent(path, content);
    });
  }

  /**
   * Start periodic stats logging
   */
  private startStatsLogging(): void {
    setInterval(() => {
      const stats = this.getStats();
      console.log('Cache Statistics:', {
        fileContent: `${stats.fileContent.hits}/${stats.fileContent.hits + stats.fileContent.misses} (${(stats.fileContent.hitRate * 100).toFixed(1)}%)`,
        parsedMarkdown: `${stats.parsedMarkdown.hits}/${stats.parsedMarkdown.hits + stats.parsedMarkdown.misses} (${(stats.parsedMarkdown.hitRate * 100).toFixed(1)}%)`,
        searchResults: `${stats.searchResults.hits}/${stats.searchResults.hits + stats.searchResults.misses} (${(stats.searchResults.hitRate * 100).toFixed(1)}%)`,
        totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`
      });
    }, 60000); // Log every minute
  }

  /**
   * Enable/disable specific cache
   */
  public setCacheEnabled(type: 'file' | 'parse' | 'search', enabled: boolean): void {
    switch (type) {
      case 'file':
        this.config.enableFileCache = enabled;
        if (!enabled) this.fileContentCache.clear();
        break;
      case 'parse':
        this.config.enableParseCache = enabled;
        if (!enabled) this.parsedMarkdownCache.clear();
        break;
      case 'search':
        this.config.enableSearchCache = enabled;
        if (!enabled) this.searchResultsCache.clear();
        break;
    }
  }

  /**
   * Warm up cache with frequently accessed files
   */
  public async warmupCache(recentFiles: string[]): Promise<void> {
    // This would typically load the most recently accessed files
    // Implementation depends on having access to file system
    console.log(`Warming up cache with ${recentFiles.length} recent files`);
  }
}

// === SINGLETON INSTANCE ===
export const cacheManager = CacheManager.getInstance();

// === CACHE DECORATORS ===

/**
 * Decorator for caching function results
 */
export function cached<T extends (...args: any[]) => any>(
  cacheKey: (...args: Parameters<T>) => string,
  ttl?: number
) {
  const cache = new LRUCache<string, ReturnType<T>>({ maxSize: 100, ttl });
  
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: Parameters<T>): ReturnType<T> {
      const key = cacheKey(...args);
      const cachedResult = cache.get(key);
      
      if (cachedResult !== undefined) {
        return cachedResult;
      }
      
      const result = originalMethod.apply(this, args);
      cache.set(key, result);
      
      return result;
    };
    
    return descriptor;
  };
}

export default CacheManager;