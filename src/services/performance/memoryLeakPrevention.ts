/**
 * @fileoverview Memory leak prevention utilities and hooks
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Memory optimization and leak prevention
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Registry for tracking and cleaning up resources
 */
class ResourceRegistry {
  private timers = new Set<number>();
  private intervals = new Set<number>();
  private listeners = new Map<EventTarget, Map<string, EventListener>>();
  private observers = new Set<MutationObserver | IntersectionObserver | ResizeObserver>();
  private abortControllers = new Set<AbortController>();
  private weakRefs = new Set<any>();

  /**
   * Register a timeout for cleanup
   */
  registerTimeout(id: number): void {
    this.timers.add(id);
  }

  /**
   * Register an interval for cleanup
   */
  registerInterval(id: number): void {
    this.intervals.add(id);
  }

  /**
   * Register an event listener for cleanup
   */
  registerEventListener(target: EventTarget, event: string, listener: EventListener): void {
    if (!this.listeners.has(target)) {
      this.listeners.set(target, new Map());
    }
    this.listeners.get(target)!.set(event, listener);
  }

  /**
   * Register an observer for cleanup
   */
  registerObserver(observer: MutationObserver | IntersectionObserver | ResizeObserver): void {
    this.observers.add(observer);
  }

  /**
   * Register an abort controller for cleanup
   */
  registerAbortController(controller: AbortController): void {
    this.abortControllers.add(controller);
  }

  /**
   * Register a weak reference for tracking
   */
  registerWeakRef<T extends object>(obj: T): any {
    if (typeof WeakRef !== 'undefined') {
      const ref = new WeakRef(obj);
      this.weakRefs.add(ref);
      return ref;
    }
    // Fallback if WeakRef is not supported
    return { deref: () => obj };
  }

  /**
   * Clean up all registered resources
   */
  cleanup(): void {
    // Clear timers
    this.timers.forEach(id => clearTimeout(id));
    this.timers.clear();

    // Clear intervals
    this.intervals.forEach(id => clearInterval(id));
    this.intervals.clear();

    // Remove event listeners
    this.listeners.forEach((eventMap, target) => {
      eventMap.forEach((listener, event) => {
        target.removeEventListener(event, listener);
      });
    });
    this.listeners.clear();

    // Disconnect observers
    this.observers.forEach(observer => {
      if ('disconnect' in observer) {
        observer.disconnect();
      }
    });
    this.observers.clear();

    // Abort controllers
    this.abortControllers.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    });
    this.abortControllers.clear();

    // Clean up expired weak references
    const toDelete = new Set<any>();
    this.weakRefs.forEach(ref => {
      if (ref.deref() === undefined) {
        toDelete.add(ref);
      }
    });
    toDelete.forEach(ref => this.weakRefs.delete(ref));
  }

  /**
   * Get current resource counts
   */
  getResourceCounts(): {
    timers: number;
    intervals: number;
    listeners: number;
    observers: number;
    abortControllers: number;
    weakRefs: number;
  } {
    let listenerCount = 0;
    this.listeners.forEach(eventMap => {
      listenerCount += eventMap.size;
    });

    return {
      timers: this.timers.size,
      intervals: this.intervals.size,
      listeners: listenerCount,
      observers: this.observers.size,
      abortControllers: this.abortControllers.size,
      weakRefs: this.weakRefs.size,
    };
  }
}

/**
 * Hook for managing component resources and preventing memory leaks
 */
export function useResourceCleanup() {
  const registryRef = useRef<ResourceRegistry | null>(null);

  // Initialize registry on first use
  if (!registryRef.current) {
    registryRef.current = new ResourceRegistry();
  }

  const registry = registryRef.current;

  // Safe setTimeout with automatic cleanup
  const safeSetTimeout = useCallback((callback: () => void, delay: number): number => {
    const id = window.setTimeout(callback, delay);
    registry.registerTimeout(id);
    return id;
  }, [registry]);

  // Safe setInterval with automatic cleanup
  const safeSetInterval = useCallback((callback: () => void, delay: number): number => {
    const id = window.setInterval(callback, delay);
    registry.registerInterval(id);
    return id;
  }, [registry]);

  // Safe event listener with automatic cleanup
  const safeAddEventListener = useCallback((
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void => {
    target.addEventListener(event, listener, options);
    registry.registerEventListener(target, event, listener);
  }, [registry]);

  // Safe observer creation with automatic cleanup
  const createSafeObserver = useCallback(<T extends MutationObserver | IntersectionObserver | ResizeObserver>(
    observer: T
  ): T => {
    registry.registerObserver(observer);
    return observer;
  }, [registry]);

  // Safe abort controller with automatic cleanup
  const createAbortController = useCallback((): AbortController => {
    const controller = new AbortController();
    registry.registerAbortController(controller);
    return controller;
  }, [registry]);

  // Create weak reference
  const createWeakRef = useCallback(<T extends object>(obj: T): any => {
    return registry.registerWeakRef(obj);
  }, [registry]);

  // Manual cleanup function
  const cleanup = useCallback(() => {
    registry.cleanup();
  }, [registry]);

  // Get resource counts for debugging
  const getResourceCounts = useCallback(() => {
    return registry.getResourceCounts();
  }, [registry]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      registry.cleanup();
    };
  }, [registry]);

  return {
    safeSetTimeout,
    safeSetInterval,
    safeAddEventListener,
    createSafeObserver,
    createAbortController,
    createWeakRef,
    cleanup,
    getResourceCounts,
  };
}

/**
 * Hook for detecting and preventing memory leaks in components
 */
export function useMemoryLeakDetection(componentName: string) {
  const mountTimeRef = useRef(Date.now());
  const renderCountRef = useRef(0);
  const resourceRegistry = useRef(new ResourceRegistry());

  // Track render count
  renderCountRef.current++;

  // Memory leak detection
  useEffect(() => {
    const checkForLeaks = () => {
      const runtime = Date.now() - mountTimeRef.current;
      const resources = resourceRegistry.current.getResourceCounts();
      
      // Warn about potential leaks
      if (resources.timers > 10) {
        console.warn(`${componentName}: High timer count (${resources.timers})`);
      }
      
      if (resources.intervals > 5) {
        console.warn(`${componentName}: High interval count (${resources.intervals})`);
      }
      
      if (resources.listeners > 50) {
        console.warn(`${componentName}: High listener count (${resources.listeners})`);
      }
      
      if (renderCountRef.current > 100 && runtime < 60000) {
        console.warn(`${componentName}: High render frequency (${renderCountRef.current} renders in ${runtime}ms)`);
      }
    };

    // Check for leaks periodically
    const intervalId = setInterval(checkForLeaks, 10000); // Every 10 seconds
    
    return () => {
      clearInterval(intervalId);
      resourceRegistry.current.cleanup();
    };
  }, [componentName]);

  return {
    renderCount: renderCountRef.current,
    runtime: Date.now() - mountTimeRef.current,
    resourceRegistry: resourceRegistry.current,
  };
}

/**
 * Hook for managing large collections with automatic cleanup
 */
export function useLargeCollection<T>(maxSize: number = 1000) {
  const collectionRef = useRef<T[]>([]);
  const cleanupCallbacksRef = useRef<(() => void)[]>([]);

  const add = useCallback((item: T, cleanup?: () => void) => {
    collectionRef.current.push(item);
    
    if (cleanup) {
      cleanupCallbacksRef.current.push(cleanup);
    }

    // Auto-cleanup if collection gets too large
    if (collectionRef.current.length > maxSize) {
      collectionRef.current.shift();
      const cleanupFn = cleanupCallbacksRef.current.shift();
      
      if (cleanupFn) {
        cleanupFn();
      }
      
      console.debug(`Collection auto-cleanup: removed oldest item`);
    }
  }, [maxSize]);

  const remove = useCallback((index: number) => {
    if (index >= 0 && index < collectionRef.current.length) {
      collectionRef.current.splice(index, 1);
      const cleanupFn = cleanupCallbacksRef.current.splice(index, 1)[0];
      
      if (cleanupFn) {
        cleanupFn();
      }
    }
  }, []);

  const clear = useCallback(() => {
    // Run all cleanup callbacks
    cleanupCallbacksRef.current.forEach(cleanup => cleanup());
    
    collectionRef.current = [];
    cleanupCallbacksRef.current = [];
  }, []);

  const get = useCallback(() => {
    return [...collectionRef.current];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  return {
    add,
    remove,
    clear,
    get,
    size: collectionRef.current.length,
  };
}

/**
 * Hook for debouncing values with automatic cleanup
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const { safeSetTimeout } = useResourceCleanup();

  useEffect(() => {
    const handler = safeSetTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay, safeSetTimeout]);

  return debouncedValue;
}

/**
 * Hook for throttling function calls with automatic cleanup
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const { safeSetTimeout } = useResourceCleanup();

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      return callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = safeSetTimeout(() => {
        lastCallRef.current = Date.now();
        callback(...args);
      }, delay - (now - lastCallRef.current));
    }
  }, [callback, delay, safeSetTimeout]) as T;
}


export default {
  useResourceCleanup,
  useMemoryLeakDetection,
  useLargeCollection,
  useDebouncedValue,
  useThrottledCallback,
};