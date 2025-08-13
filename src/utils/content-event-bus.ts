/**
 * @fileoverview Event bus for content changes
 * Provides a centralized system for notifying components of content updates
 */

import { FileMetadata } from './metadata-extractor';

export type ContentChangeEvent = {
  filePath: string;
  fileName: string;
  content: string;
  metadata: FileMetadata;
  changedFields?: Partial<FileMetadata>;
  timestamp: number;
};

export type ContentEventType = 
  | 'content:changed'
  | 'content:saved'
  | 'content:metadata-changed'
  | 'file:created'
  | 'file:deleted'
  | 'file:renamed';

type EventCallback = (event: ContentChangeEvent) => void;

class ContentEventBus {
  private listeners: Map<ContentEventType, Set<EventCallback>> = new Map();
  private fileMetadataCache: Map<string, FileMetadata> = new Map();
  private isEmitting = false;

  /**
   * Subscribe to content events
   */
  on(eventType: ContentEventType, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Emit a content event
   */
  emit(eventType: ContentEventType, event: ContentChangeEvent): void {
    // Prevent recursive emissions
    if (this.isEmitting && eventType === 'content:changed') {
      return;
    }
    
    // Store metadata in cache
    if (event.metadata) {
      this.fileMetadataCache.set(event.filePath, event.metadata);
    }
    
    const wasEmitting = this.isEmitting;
    this.isEmitting = true;
    
    // Notify all listeners for this event type
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in content event listener:`, error);
        }
      });
    }
    
    // Also emit to general content:changed for any content change
    if (eventType !== 'content:changed' && eventType.startsWith('content:')) {
      this.emit('content:changed', event);
    }
    
    this.isEmitting = wasEmitting;
  }

  /**
   * Get cached metadata for a file
   */
  getCachedMetadata(filePath: string): FileMetadata | undefined {
    return this.fileMetadataCache.get(filePath);
  }

  /**
   * Clear cache for a specific file or all files
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      this.fileMetadataCache.delete(filePath);
    } else {
      this.fileMetadataCache.clear();
    }
  }

  /**
   * Check if there are any listeners for an event type
   */
  hasListeners(eventType: ContentEventType): boolean {
    return (this.listeners.get(eventType)?.size ?? 0) > 0;
  }
}

// Create singleton instance
export const contentEventBus = new ContentEventBus();

// Export convenience functions
export const onContentChange = (callback: EventCallback) => 
  contentEventBus.on('content:changed', callback);

export const onContentSaved = (callback: EventCallback) => 
  contentEventBus.on('content:saved', callback);

export const onMetadataChange = (callback: EventCallback) => 
  contentEventBus.on('content:metadata-changed', callback);

export const emitContentChange = (event: Omit<ContentChangeEvent, 'timestamp'>) => 
  contentEventBus.emit('content:changed', {
    ...event,
    timestamp: Date.now()
  });

export const emitContentSaved = (event: Omit<ContentChangeEvent, 'timestamp'>) => 
  contentEventBus.emit('content:saved', {
    ...event,
    timestamp: Date.now()
  });

export const emitMetadataChange = (event: Omit<ContentChangeEvent, 'timestamp'>) => 
  contentEventBus.emit('content:metadata-changed', {
    ...event,
    timestamp: Date.now()
  });