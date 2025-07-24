/**
 * @fileoverview LRU (Least Recently Used) cache implementation
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Performance optimization through caching
 */

// === TYPES ===

/**
 * Node in the doubly linked list
 */
interface CacheNode<K, V> {
  key: K;
  value: V;
  prev: CacheNode<K, V> | null;
  next: CacheNode<K, V> | null;
  timestamp: number;
  size?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

/**
 * LRU cache options
 */
export interface LRUCacheOptions {
  /** Maximum number of items in cache */
  maxSize?: number;
  /** Maximum total size in bytes (if items have size) */
  maxBytes?: number;
  /** TTL in milliseconds for cache entries */
  ttl?: number;
  /** Callback when item is evicted */
  onEvict?: <K, V>(key: K, value: V) => void;
}

// === LRU CACHE CLASS ===

/**
 * LRU (Least Recently Used) cache implementation
 * 
 * Features:
 * - O(1) get/set operations
 * - Size-based or count-based eviction
 * - TTL support for entries
 * - Cache statistics
 * - Eviction callbacks
 */
export class LRUCache<K = string, V = any> {
  private cache: Map<K, CacheNode<K, V>>;
  private head: CacheNode<K, V> | null;
  private tail: CacheNode<K, V> | null;
  private maxSize: number;
  private maxBytes: number;
  private currentBytes: number;
  private ttl: number;
  private onEvict?: <K, V>(key: K, value: V) => void;
  
  // Statistics
  private hits: number;
  private misses: number;
  private evictions: number;

  constructor(options: LRUCacheOptions = {}) {
    this.cache = new Map();
    this.head = null;
    this.tail = null;
    this.maxSize = options.maxSize || 100;
    this.maxBytes = options.maxBytes || Infinity;
    this.currentBytes = 0;
    this.ttl = options.ttl || 0;
    this.onEvict = options.onEvict;
    
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);
    
    if (!node) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (this.ttl > 0 && Date.now() - node.timestamp > this.ttl) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    
    // Move to head (most recently used)
    this.moveToHead(node);
    
    return node.value;
  }

  /**
   * Set value in cache
   */
  set(key: K, value: V, size?: number): void {
    const existingNode = this.cache.get(key);
    
    if (existingNode) {
      // Update existing node
      if (existingNode.size) {
        this.currentBytes -= existingNode.size;
      }
      
      existingNode.value = value;
      existingNode.timestamp = Date.now();
      existingNode.size = size;
      
      if (size) {
        this.currentBytes += size;
      }
      
      this.moveToHead(existingNode);
    } else {
      // Create new node
      const newNode: CacheNode<K, V> = {
        key,
        value,
        prev: null,
        next: null,
        timestamp: Date.now(),
        size
      };
      
      this.cache.set(key, newNode);
      this.addToHead(newNode);
      
      if (size) {
        this.currentBytes += size;
      }
      
      // Evict if necessary
      this.evictIfNeeded();
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    const node = this.cache.get(key);
    
    if (!node) {
      return false;
    }
    
    // Check TTL
    if (this.ttl > 0 && Date.now() - node.timestamp > this.ttl) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete key from cache
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);
    
    if (!node) {
      return false;
    }
    
    this.removeNode(node);
    this.cache.delete(key);
    
    if (node.size) {
      this.currentBytes -= node.size;
    }
    
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    if (this.onEvict) {
      this.cache.forEach((node) => {
        this.onEvict!(node.key, node.value);
      });
    }
    
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.currentBytes = 0;
    this.evictions += this.cache.size;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get all keys in cache (ordered by recency)
   */
  keys(): K[] {
    const keys: K[] = [];
    let current = this.head;
    
    while (current) {
      keys.push(current.key);
      current = current.next;
    }
    
    return keys;
  }

  /**
   * Get all values in cache (ordered by recency)
   */
  values(): V[] {
    const values: V[] = [];
    let current = this.head;
    
    while (current) {
      values.push(current.value);
      current = current.next;
    }
    
    return values;
  }

  // === PRIVATE METHODS ===

  /**
   * Add node to head of list
   */
  private addToHead(node: CacheNode<K, V>): void {
    node.prev = null;
    node.next = this.head;
    
    if (this.head) {
      this.head.prev = node;
    }
    
    this.head = node;
    
    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove node from list
   */
  private removeNode(node: CacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * Move node to head of list
   */
  private moveToHead(node: CacheNode<K, V>): void {
    if (this.head === node) {
      return;
    }
    
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * Evict least recently used items if needed
   */
  private evictIfNeeded(): void {
    // Evict by count
    while (this.cache.size > this.maxSize && this.tail) {
      this.evictTail();
    }
    
    // Evict by size
    while (this.currentBytes > this.maxBytes && this.tail) {
      this.evictTail();
    }
  }

  /**
   * Evict the tail (least recently used) node
   */
  private evictTail(): void {
    if (!this.tail) {
      return;
    }
    
    const node = this.tail;
    
    if (this.onEvict) {
      this.onEvict(node.key, node.value);
    }
    
    this.removeNode(node);
    this.cache.delete(node.key);
    
    if (node.size) {
      this.currentBytes -= node.size;
    }
    
    this.evictions++;
  }
}

// === FACTORY FUNCTIONS ===

/**
 * Create LRU cache for file content
 */
export function createFileContentCache(maxFiles = 50): LRUCache<string, string> {
  return new LRUCache<string, string>({
    maxSize: maxFiles,
    maxBytes: 50 * 1024 * 1024, // 50MB
    ttl: 5 * 60 * 1000, // 5 minutes
    onEvict: (path, _content) => {
      console.debug(`Evicting file from cache: ${path}`);
    }
  });
}

/**
 * Create LRU cache for parsed markdown
 */
export function createParsedMarkdownCache(maxEntries = 100): LRUCache<string, any> {
  return new LRUCache<string, any>({
    maxSize: maxEntries,
    ttl: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Create LRU cache for search results
 */
export function createSearchResultsCache(maxQueries = 50): LRUCache<string, any[]> {
  return new LRUCache<string, any[]>({
    maxSize: maxQueries,
    ttl: 60 * 1000, // 1 minute
  });
}

export default LRUCache;