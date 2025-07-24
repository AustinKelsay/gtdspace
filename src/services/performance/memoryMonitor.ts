/**
 * @fileoverview Memory monitoring and optimization utilities
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Memory optimization and leak prevention
 */

export interface MemoryMetrics {
  /** Total JS heap size */
  usedJSHeapSize: number;
  /** Total JS heap size limit */
  totalJSHeapSize: number;
  /** JS heap size limit */
  jsHeapSizeLimit: number;
  /** Memory usage as percentage */
  memoryUsagePercent: number;
  /** Number of DOM nodes */
  domNodes: number;
  /** Number of event listeners */
  eventListeners: number;
  /** Cache size in bytes */
  cacheSize: number;
  /** Timestamp when metrics were collected */
  timestamp: number;
}

export interface MemoryAlert {
  id: string;
  type: 'warning' | 'critical';
  message: string;
  timestamp: number;
  metrics: MemoryMetrics;
}

export interface MemoryConfig {
  /** Warning threshold as percentage of heap limit */
  warningThreshold: number;
  /** Critical threshold as percentage of heap limit */
  criticalThreshold: number;
  /** Monitoring interval in milliseconds */
  monitoringInterval: number;
  /** Max number of metrics to keep in history */
  maxHistorySize: number;
  /** Enable automatic garbage collection suggestions */
  enableGCHints: boolean;
}

/**
 * Memory monitoring service for tracking and optimizing memory usage
 */
class MemoryMonitorService {
  private config: MemoryConfig = {
    warningThreshold: 75,
    criticalThreshold: 90,
    monitoringInterval: 5000,
    maxHistorySize: 100,
    enableGCHints: true,
  };

  private isMonitoring = false;
  private intervalId: number | null = null;
  private metricsHistory: MemoryMetrics[] = [];
  private alerts: MemoryAlert[] = [];
  private listeners: ((metrics: MemoryMetrics) => void)[] = [];
  private alertListeners: ((alert: MemoryAlert) => void)[] = [];
  private weakRefs = new Set<any>();

  constructor(config?: Partial<MemoryConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.intervalId = window.setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoringInterval);

    console.log('Memory monitoring started');
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('Memory monitoring stopped');
  }

  /**
   * Collect current memory metrics
   */
  collectMetrics(): MemoryMetrics {
    const performance = window.performance as any;
    const memory = performance.memory || {};

    const metrics: MemoryMetrics = {
      usedJSHeapSize: memory.usedJSHeapSize || 0,
      totalJSHeapSize: memory.totalJSHeapSize || 0,
      jsHeapSizeLimit: memory.jsHeapSizeLimit || 0,
      memoryUsagePercent: memory.jsHeapSizeLimit 
        ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100 
        : 0,
      domNodes: document.querySelectorAll('*').length,
      eventListeners: this.countEventListeners(),
      cacheSize: this.estimateCacheSize(),
      timestamp: Date.now(),
    };

    // Add to history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.config.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Check for memory issues
    this.checkMemoryThresholds(metrics);

    // Notify listeners
    this.listeners.forEach(listener => listener(metrics));

    return metrics;
  }

  /**
   * Get current memory metrics
   */
  getCurrentMetrics(): MemoryMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  /**
   * Get memory metrics history
   */
  getMetricsHistory(): MemoryMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get current alerts
   */
  getAlerts(): MemoryAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear old alerts
   */
  clearAlerts(olderThan?: number): void {
    const cutoff = olderThan || Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
  }

  /**
   * Check memory thresholds and create alerts
   */
  private checkMemoryThresholds(metrics: MemoryMetrics): void {
    const { memoryUsagePercent } = metrics;

    if (memoryUsagePercent >= this.config.criticalThreshold) {
      this.createAlert('critical', 
        `Critical memory usage: ${memoryUsagePercent.toFixed(1)}%`, 
        metrics
      );
    } else if (memoryUsagePercent >= this.config.warningThreshold) {
      this.createAlert('warning', 
        `High memory usage: ${memoryUsagePercent.toFixed(1)}%`, 
        metrics
      );
    }
  }

  /**
   * Create a memory alert
   */
  private createAlert(type: 'warning' | 'critical', message: string, metrics: MemoryMetrics): void {
    const alert: MemoryAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: Date.now(),
      metrics,
    };

    this.alerts.push(alert);
    this.alertListeners.forEach(listener => listener(alert));

    // Auto-suggest garbage collection for critical alerts
    if (type === 'critical' && this.config.enableGCHints) {
      this.suggestGarbageCollection();
    }
  }

  /**
   * Suggest garbage collection (triggers GC hint if available)
   */
  suggestGarbageCollection(): void {
    // Clean up weak references first
    this.cleanupWeakRefs();

    // Suggest GC if available (Chrome DevTools or --enable-gc flag)
    if (window.gc) {
      console.warn('Memory usage critical - triggering garbage collection');
      window.gc();
    } else {
      console.warn('Memory usage critical - consider closing unused tabs or files');
    }
  }

  /**
   * Clean up expired weak references
   */
  private cleanupWeakRefs(): void {
    const toDelete = new Set<any>();
    
    for (const ref of this.weakRefs) {
      if (ref.deref() === undefined) {
        toDelete.add(ref);
      }
    }

    toDelete.forEach(ref => this.weakRefs.delete(ref));
  }

  /**
   * Register a weak reference for cleanup tracking
   */
  trackWeakRef<T extends object>(obj: T): any {
    if (typeof WeakRef !== 'undefined') {
      const ref = new WeakRef(obj);
      this.weakRefs.add(ref);
      return ref;
    }
    // Fallback if WeakRef is not supported
    return { deref: () => obj };
  }

  /**
   * Estimate cache size from various sources
   */
  private estimateCacheSize(): number {
    let size = 0;

    // Estimate localStorage size
    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          size += localStorage[key].length;
        }
      }
    } catch (e) {
      // Ignore errors
    }

    // Estimate sessionStorage size
    try {
      for (const key in sessionStorage) {
        if (sessionStorage.hasOwnProperty(key)) {
          size += sessionStorage[key].length;
        }
      }
    } catch (e) {
      // Ignore errors
    }

    return size * 2; // Rough estimate (UTF-16)
  }

  /**
   * Count event listeners (approximate)
   */
  private countEventListeners(): number {
    // This is a rough approximation - actual listener counting is complex
    const elements = document.querySelectorAll('*');
    let count = 0;

    elements.forEach(element => {
      // Count common event types that might be attached
      const events = ['click', 'keydown', 'mouseenter', 'mouseleave', 'focus', 'blur'];
      events.forEach(eventType => {
        if ((element as any)[`on${eventType}`]) {
          count++;
        }
      });
    });

    return count;
  }

  /**
   * Subscribe to memory metrics updates
   */
  onMetrics(callback: (metrics: MemoryMetrics) => void): () => void {
    this.listeners.push(callback);
    
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to memory alerts
   */
  onAlert(callback: (alert: MemoryAlert) => void): () => void {
    this.alertListeners.push(callback);
    
    return () => {
      const index = this.alertListeners.indexOf(callback);
      if (index > -1) {
        this.alertListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get memory optimization suggestions
   */
  getOptimizationSuggestions(): string[] {
    const metrics = this.getCurrentMetrics();
    if (!metrics) return [];

    const suggestions: string[] = [];

    if (metrics.memoryUsagePercent > 80) {
      suggestions.push('Consider closing unused tabs to free memory');
      suggestions.push('Large files may benefit from streaming or pagination');
    }

    if (metrics.domNodes > 10000) {
      suggestions.push('High DOM node count - consider virtualizing large lists');
    }

    if (metrics.eventListeners > 1000) {
      suggestions.push('High event listener count - ensure proper cleanup');
    }

    if (metrics.cacheSize > 10 * 1024 * 1024) { // 10MB
      suggestions.push('Large cache size - consider clearing old cached data');
    }

    return suggestions;
  }

  /**
   * Get memory trend analysis
   */
  getMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.metricsHistory.length < 3) return 'stable';

    const recent = this.metricsHistory.slice(-3);
    const [oldest, middle, newest] = recent;

    const trend1 = newest.usedJSHeapSize - middle.usedJSHeapSize;
    const trend2 = middle.usedJSHeapSize - oldest.usedJSHeapSize;

    if (trend1 > 0 && trend2 > 0) return 'increasing';
    if (trend1 < 0 && trend2 < 0) return 'decreasing';
    return 'stable';
  }

  /**
   * Format bytes to human readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Global memory monitor instance
export const memoryMonitor = new MemoryMonitorService();

// Type augmentation for window.gc
declare global {
  interface Window {
    gc?: () => void;
  }
}

export { MemoryMonitorService };