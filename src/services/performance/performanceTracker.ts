/**
 * @fileoverview Performance tracking and metrics collection service
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Performance monitoring utilities
 */

// === TYPES ===

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  timestamp: number;
  category: 'load' | 'render' | 'interaction' | 'memory' | 'network' | 'custom';
  metadata?: Record<string, any>;
}

export interface TimingEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  category: string;
}

export interface PerformanceSnapshot {
  timestamp: number;
  metrics: PerformanceMetric[];
  vitals: {
    memoryUsage: number;
    renderCount: number;
    loadTime: number;
    interactionDelay: number;
  };
  browser: {
    userAgent: string;
    viewport: { width: number; height: number };
    connection?: string;
  };
}

// === PERFORMANCE TRACKER CLASS ===

export class PerformanceTracker {
  private static instance: PerformanceTracker | null = null;
  
  private metrics: PerformanceMetric[] = [];
  private activeTimings: Map<string, TimingEntry> = new Map();
  private observers: PerformanceObserver[] = [];
  private maxMetrics = 1000;
  
  private constructor() {
    this.initializeObservers();
    this.trackVitals();
  }

  public static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker();
    }
    return PerformanceTracker.instance;
  }

  // === TIMING METHODS ===

  /**
   * Start timing an operation
   */
  public startTiming(name: string, category = 'custom'): void {
    const entry: TimingEntry = {
      name,
      startTime: performance.now(),
      category,
    };
    
    this.activeTimings.set(name, entry);
  }

  /**
   * End timing an operation and record the metric
   */
  public endTiming(name: string): number | null {
    const entry = this.activeTimings.get(name);
    if (!entry) {
      console.warn(`No active timing found for: ${name}`);
      return null;
    }

    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;
    
    this.recordMetric({
      name,
      value: entry.duration,
      unit: 'ms',
      timestamp: Date.now(),
      category: entry.category as any,
      metadata: {
        startTime: entry.startTime,
        endTime: entry.endTime,
      },
    });

    this.activeTimings.delete(name);
    return entry.duration;
  }

  /**
   * Time a function execution
   */
  public async timeFunction<T>(
    name: string,
    fn: () => T | Promise<T>,
    category = 'custom'
  ): Promise<T> {
    this.startTiming(name, category);
    
    try {
      const result = await fn();
      return result;
    } finally {
      this.endTiming(name);
    }
  }

  // === METRIC RECORDING ===

  /**
   * Record a custom performance metric
   */
  public recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only the latest metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Record file operation timing
   */
  public recordFileOperation(
    operation: 'read' | 'write' | 'delete' | 'create',
    duration: number,
    fileSize?: number
  ): void {
    this.recordMetric({
      name: `file_${operation}`,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      category: 'interaction',
      metadata: {
        operation,
        fileSize,
        throughput: fileSize ? fileSize / duration : undefined,
      },
    });
  }

  /**
   * Record UI interaction timing
   */
  public recordInteraction(
    action: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    this.recordMetric({
      name: `interaction_${action}`,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      category: 'interaction',
      metadata,
    });
  }

  /**
   * Record render performance
   */
  public recordRender(
    component: string,
    duration: number,
    renderCount?: number
  ): void {
    this.recordMetric({
      name: `render_${component}`,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      category: 'render',
      metadata: {
        component,
        renderCount,
      },
    });
  }

  // === DATA RETRIEVAL ===

  /**
   * Get all recorded metrics
   */
  public getMetrics(category?: PerformanceMetric['category']): PerformanceMetric[] {
    if (category) {
      return this.metrics.filter(m => m.category === category);
    }
    return [...this.metrics];
  }

  /**
   * Get metrics for a specific time range
   */
  public getMetricsInRange(startTime: number, endTime: number): PerformanceMetric[] {
    return this.metrics.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  /**
   * Get average value for a metric
   */
  public getAverageMetric(name: string, timeWindow = 60000): number | null {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.metrics.filter(
      m => m.name === name && m.timestamp >= cutoff
    );

    if (recentMetrics.length === 0) return null;

    const sum = recentMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / recentMetrics.length;
  }

  /**
   * Get performance summary
   */
  public getSummary(timeWindow = 300000): {
    totalMetrics: number;
    categories: Record<string, number>;
    averages: Record<string, number>;
    slowest: PerformanceMetric[];
  } {
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);

    const categories: Record<string, number> = {};
    const nameGroups: Record<string, PerformanceMetric[]> = {};

    recentMetrics.forEach(metric => {
      categories[metric.category] = (categories[metric.category] || 0) + 1;
      
      if (!nameGroups[metric.name]) {
        nameGroups[metric.name] = [];
      }
      nameGroups[metric.name].push(metric);
    });

    const averages: Record<string, number> = {};
    Object.entries(nameGroups).forEach(([name, metrics]) => {
      const sum = metrics.reduce((acc, m) => acc + m.value, 0);
      averages[name] = sum / metrics.length;
    });

    const slowest = recentMetrics
      .filter(m => m.unit === 'ms')
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      totalMetrics: recentMetrics.length,
      categories,
      averages,
      slowest,
    };
  }

  /**
   * Create performance snapshot
   */
  public createSnapshot(): PerformanceSnapshot {
    const memory = (performance as any).memory;
    
    return {
      timestamp: Date.now(),
      metrics: this.getMetricsInRange(Date.now() - 60000, Date.now()),
      vitals: {
        memoryUsage: memory ? memory.usedJSHeapSize : 0,
        renderCount: this.getMetrics('render').length,
        loadTime: this.getAverageMetric('initial_load') || 0,
        interactionDelay: this.getAverageMetric('interaction_delay') || 0,
      },
      browser: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        connection: (navigator as any).connection?.effectiveType,
      },
    };
  }

  // === PRIVATE METHODS ===

  /**
   * Initialize performance observers
   */
  private initializeObservers(): void {
    if (!('PerformanceObserver' in window)) {
      console.warn('PerformanceObserver not supported');
      return;
    }

    try {
      // Navigation timing
      const navObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            
            this.recordMetric({
              name: 'page_load',
              value: navEntry.loadEventEnd - (navEntry as any).navigationStart,
              unit: 'ms',
              timestamp: Date.now(),
              category: 'load',
            });

            this.recordMetric({
              name: 'dom_content_loaded',
              value: navEntry.domContentLoadedEventEnd - (navEntry as any).navigationStart,
              unit: 'ms',
              timestamp: Date.now(),
              category: 'load',
            });
          }
        });
      });
      
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordMetric({
            name: 'largest_contentful_paint',
            value: entry.startTime,
            unit: 'ms',
            timestamp: Date.now(),
            category: 'render',
          });
        });
      });
      
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordMetric({
            name: 'first_input_delay',
            value: (entry as any).processingStart - entry.startTime,
            unit: 'ms',
            timestamp: Date.now(),
            category: 'interaction',
          });
        });
      });
      
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

    } catch (error) {
      console.error('Failed to initialize performance observers:', error);
    }
  }

  /**
   * Track core web vitals
   */
  private trackVitals(): void {
    // Track layout shifts
    if ('PerformanceObserver' in window) {
      try {
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          list.getEntries().forEach((entry) => {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          });
          
          if (clsValue > 0) {
            this.recordMetric({
              name: 'cumulative_layout_shift',
              value: clsValue,
              unit: 'count',
              timestamp: Date.now(),
              category: 'render',
            });
          }
        });
        
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (error) {
        console.warn('Layout shift tracking not available');
      }
    }

    // Track memory usage periodically
    setInterval(() => {
      const memory = (performance as any).memory;
      if (memory) {
        this.recordMetric({
          name: 'memory_usage',
          value: memory.usedJSHeapSize,
          unit: 'bytes',
          timestamp: Date.now(),
          category: 'memory',
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Clean up observers
   */
  public destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
    this.activeTimings.clear();
  }
}

// === SINGLETON INSTANCE ===
export const performanceTracker = PerformanceTracker.getInstance();

// === UTILITY FUNCTIONS ===

/**
 * Decorator for automatically timing method execution
 */
export function timed(category = 'custom') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const name = `${target.constructor.name}.${propertyKey}`;
      return performanceTracker.timeFunction(name, () => originalMethod.apply(this, args), category);
    };
    
    return descriptor;
  };
}

/**
 * Mark performance milestones
 */
export function markMilestone(name: string, metadata?: Record<string, any>): void {
  performanceTracker.recordMetric({
    name: `milestone_${name}`,
    value: performance.now(),
    unit: 'ms',
    timestamp: Date.now(),
    category: 'custom',
    metadata,
  });
}

export default PerformanceTracker;