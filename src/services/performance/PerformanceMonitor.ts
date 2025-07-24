/**
 * @fileoverview Performance monitoring service for tracking app metrics
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Performance monitoring and optimization
 */

// === TYPES ===
export interface PerformanceMetric {
  /** Metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Timestamp when metric was recorded */
  timestamp: number;
  /** Metric category */
  category: MetricCategory;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export type MetricCategory = 
  | 'render'
  | 'file_operation'
  | 'search'
  | 'navigation'
  | 'memory'
  | 'network'
  | 'user_interaction'
  | 'system';

export interface PerformanceThresholds {
  /** File opening should complete within this time (ms) */
  fileOpenTime: number;
  /** Search should complete within this time (ms) */
  searchTime: number;
  /** Tab switching should complete within this time (ms) */
  tabSwitchTime: number;
  /** Auto-save should complete within this time (ms) */
  autoSaveTime: number;
  /** Memory usage threshold (MB) */
  memoryUsage: number;
  /** Render time threshold (ms) */
  renderTime: number;
}

export interface PerformanceReport {
  /** Overall performance score (0-100) */
  score: number;
  /** Metrics grouped by category */
  metrics: Record<MetricCategory, PerformanceMetric[]>;
  /** Performance warnings */
  warnings: string[];
  /** Performance recommendations */
  recommendations: string[];
  /** Report generation timestamp */
  timestamp: number;
}

// === CONSTANTS ===
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  fileOpenTime: 300, // 300ms
  searchTime: 1000, // 1s
  tabSwitchTime: 100, // 100ms
  autoSaveTime: 200, // 200ms
  memoryUsage: 200, // 200MB
  renderTime: 16, // 16ms (60fps)
};

const MAX_METRICS_STORED = 1000;
const PERFORMANCE_STORAGE_KEY = 'gtdspace_performance_metrics';

// === PERFORMANCE MONITOR CLASS ===
export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null;
  private metrics: PerformanceMetric[] = [];
  private thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS;
  private observers: PerformanceObserver[] = [];
  private isEnabled = true;

  private constructor() {
    this.initializeObservers();
    this.loadStoredMetrics();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // === INITIALIZATION ===
  private initializeObservers(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      // Navigation timing
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric({
              name: 'page_load_time',
              value: navEntry.loadEventEnd - navEntry.fetchStart,
              category: 'navigation',
              metadata: {
                domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.fetchStart,
                firstPaint: navEntry.loadEventStart - navEntry.fetchStart,
              },
            });
          }
        }
      });
      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);

      // Measure timing
      const measureObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            this.recordMetric({
              name: entry.name,
              value: entry.duration,
              category: this.getCategoryFromMeasureName(entry.name),
              metadata: {
                startTime: entry.startTime,
              },
            });
          }
        }
      });
      measureObserver.observe({ entryTypes: ['measure'] });
      this.observers.push(measureObserver);

      // Long tasks (performance issues)
      if ('PerformanceObserver' in window && 'entryTypes' in PerformanceObserver.prototype) {
        try {
          const longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              this.recordMetric({
                name: 'long_task',
                value: entry.duration,
                category: 'render',
                metadata: {
                  startTime: entry.startTime,
                  attribution: (entry as any).attribution,
                },
              });
            }
          });
          longTaskObserver.observe({ entryTypes: ['longtask'] });
          this.observers.push(longTaskObserver);
        } catch (error) {
          console.debug('Long task observer not supported');
        }
      }
    } catch (error) {
      console.warn('Performance observers not fully supported:', error);
    }
  }

  private getCategoryFromMeasureName(name: string): MetricCategory {
    if (name.includes('file')) return 'file_operation';
    if (name.includes('search')) return 'search';
    if (name.includes('render')) return 'render';
    if (name.includes('tab')) return 'navigation';
    if (name.includes('memory')) return 'memory';
    return 'system';
  }

  // === METRIC RECORDING ===
  public recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    if (!this.isEnabled) return;

    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.metrics.push(fullMetric);

    // Keep only the most recent metrics
    if (this.metrics.length > MAX_METRICS_STORED) {
      this.metrics = this.metrics.slice(-MAX_METRICS_STORED);
    }

    // Check for performance issues
    this.checkThresholds(fullMetric);

    // Store metrics periodically
    if (this.metrics.length % 10 === 0) {
      this.storeMetrics();
    }
  }

  public startTiming(name: string): void {
    if (!this.isEnabled) return;
    performance.mark(`${name}_start`);
  }

  public endTiming(name: string, _category: MetricCategory = 'system', _metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;
    
    try {
      performance.mark(`${name}_end`);
      performance.measure(name, `${name}_start`, `${name}_end`);
      
      // The PerformanceObserver will pick this up automatically
    } catch (error) {
      console.warn('Failed to measure timing:', error);
    }
  }

  // === MEMORY MONITORING ===
  public recordMemoryUsage(): void {
    if (!this.isEnabled) return;

    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.recordMetric({
        name: 'memory_usage',
        value: memory.usedJSHeapSize / 1024 / 1024, // Convert to MB
        category: 'memory',
        metadata: {
          totalJSHeapSize: memory.totalJSHeapSize / 1024 / 1024,
          jsHeapSizeLimit: memory.jsHeapSizeLimit / 1024 / 1024,
        },
      });
    }
  }

  // === FILE OPERATIONS ===
  public recordFileOperation(operation: string, duration: number, fileSize?: number): void {
    this.recordMetric({
      name: `file_${operation}`,
      value: duration,
      category: 'file_operation',
      metadata: {
        operation,
        fileSize,
      },
    });
  }

  // === USER INTERACTIONS ===
  public recordUserInteraction(interaction: string, duration: number): void {
    this.recordMetric({
      name: `interaction_${interaction}`,
      value: duration,
      category: 'user_interaction',
      metadata: {
        interaction,
      },
    });
  }

  // === THRESHOLD MONITORING ===
  private checkThresholds(metric: PerformanceMetric): void {
    const { name, value, category } = metric;
    let threshold: number | undefined;

    switch (category) {
      case 'file_operation':
        if (name.includes('open')) threshold = this.thresholds.fileOpenTime;
        if (name.includes('save')) threshold = this.thresholds.autoSaveTime;
        break;
      case 'search':
        threshold = this.thresholds.searchTime;
        break;
      case 'navigation':
        if (name.includes('tab')) threshold = this.thresholds.tabSwitchTime;
        break;
      case 'memory':
        threshold = this.thresholds.memoryUsage;
        break;
      case 'render':
        threshold = this.thresholds.renderTime;
        break;
    }

    if (threshold && value > threshold) {
      console.warn(`Performance threshold exceeded: ${name} took ${value}ms (threshold: ${threshold}ms)`);
      this.recordMetric({
        name: 'threshold_exceeded',
        value: value - threshold,
        category: 'system',
        metadata: {
          originalMetric: name,
          threshold,
          actualValue: value,
        },
      });
    }
  }

  // === REPORTING ===
  public generateReport(): PerformanceReport {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < 300000); // Last 5 minutes

    // Group metrics by category
    const metricsByCategory: Record<MetricCategory, PerformanceMetric[]> = {
      render: [],
      file_operation: [],
      search: [],
      navigation: [],
      memory: [],
      network: [],
      user_interaction: [],
      system: [],
    };

    recentMetrics.forEach(metric => {
      metricsByCategory[metric.category].push(metric);
    });

    // Calculate performance score
    const score = this.calculatePerformanceScore(metricsByCategory);

    // Generate warnings and recommendations
    const warnings = this.generateWarnings(metricsByCategory);
    const recommendations = this.generateRecommendations(metricsByCategory);

    return {
      score,
      metrics: metricsByCategory,
      warnings,
      recommendations,
      timestamp: now,
    };
  }

  private calculatePerformanceScore(metrics: Record<MetricCategory, PerformanceMetric[]>): number {
    let score = 100;
    let penalties = 0;

    // Check average file operation times
    const fileOps = metrics.file_operation;
    if (fileOps.length > 0) {
      const avgFileOpTime = fileOps.reduce((sum, m) => sum + m.value, 0) / fileOps.length;
      if (avgFileOpTime > this.thresholds.fileOpenTime) {
        penalties += Math.min(20, (avgFileOpTime - this.thresholds.fileOpenTime) / 10);
      }
    }

    // Check memory usage
    const memoryMetrics = metrics.memory;
    if (memoryMetrics.length > 0) {
      const latestMemory = memoryMetrics[memoryMetrics.length - 1];
      if (latestMemory.value > this.thresholds.memoryUsage) {
        penalties += Math.min(30, (latestMemory.value - this.thresholds.memoryUsage) / 10);
      }
    }

    // Check for long tasks
    const renderMetrics = metrics.render;
    const longTasks = renderMetrics.filter(m => m.name === 'long_task');
    if (longTasks.length > 0) {
      penalties += Math.min(25, longTasks.length * 5);
    }

    return Math.max(0, score - penalties);
  }

  private generateWarnings(metrics: Record<MetricCategory, PerformanceMetric[]>): string[] {
    const warnings: string[] = [];

    // Memory warnings
    const memoryMetrics = metrics.memory;
    if (memoryMetrics.length > 0) {
      const latestMemory = memoryMetrics[memoryMetrics.length - 1];
      if (latestMemory.value > this.thresholds.memoryUsage) {
        warnings.push(`High memory usage: ${latestMemory.value.toFixed(1)}MB (threshold: ${this.thresholds.memoryUsage}MB)`);
      }
    }

    // Long task warnings
    const longTasks = metrics.render.filter(m => m.name === 'long_task');
    if (longTasks.length > 3) {
      warnings.push(`${longTasks.length} long tasks detected - UI may be unresponsive`);
    }

    // Slow file operations
    const slowFileOps = metrics.file_operation.filter(m => m.value > this.thresholds.fileOpenTime);
    if (slowFileOps.length > 0) {
      warnings.push(`${slowFileOps.length} slow file operations detected`);
    }

    return warnings;
  }

  private generateRecommendations(metrics: Record<MetricCategory, PerformanceMetric[]>): string[] {
    const recommendations: string[] = [];

    // File operation recommendations
    const fileOps = metrics.file_operation;
    if (fileOps.length > 0) {
      const avgTime = fileOps.reduce((sum, m) => sum + m.value, 0) / fileOps.length;
      if (avgTime > this.thresholds.fileOpenTime) {
        recommendations.push('Consider implementing file content caching to improve load times');
      }
    }

    // Memory recommendations
    const memoryMetrics = metrics.memory;
    if (memoryMetrics.length > 0) {
      const latestMemory = memoryMetrics[memoryMetrics.length - 1];
      if (latestMemory.value > this.thresholds.memoryUsage) {
        recommendations.push('Consider closing unused tabs or files to reduce memory usage');
      }
    }

    // Render recommendations
    const longTasks = metrics.render.filter(m => m.name === 'long_task');
    if (longTasks.length > 0) {
      recommendations.push('Break up long-running tasks to improve UI responsiveness');
      recommendations.push('Consider using virtualization for large lists');
    }

    return recommendations;
  }

  // === STORAGE ===
  private storeMetrics(): void {
    try {
      const recentMetrics = this.metrics.slice(-100); // Store only recent metrics
      localStorage.setItem(PERFORMANCE_STORAGE_KEY, JSON.stringify(recentMetrics));
    } catch (error) {
      console.warn('Failed to store performance metrics:', error);
    }
  }

  private loadStoredMetrics(): void {
    try {
      const stored = localStorage.getItem(PERFORMANCE_STORAGE_KEY);
      if (stored) {
        const storedMetrics: PerformanceMetric[] = JSON.parse(stored);
        this.metrics.push(...storedMetrics);
      }
    } catch (error) {
      console.warn('Failed to load stored performance metrics:', error);
    }
  }

  // === CONTROL ===
  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  public isMonitoringEnabled(): boolean {
    return this.isEnabled;
  }

  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  public getMetrics(category?: MetricCategory, limit = 100): PerformanceMetric[] {
    let filtered = category 
      ? this.metrics.filter(m => m.category === category)
      : this.metrics;
    
    return filtered.slice(-limit);
  }

  public clearMetrics(): void {
    this.metrics = [];
    localStorage.removeItem(PERFORMANCE_STORAGE_KEY);
  }

  // === CLEANUP ===
  public destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.storeMetrics();
  }
}

// === SINGLETON INSTANCE ===
export const performanceMonitor = PerformanceMonitor.getInstance();

// === CONVENIENCE FUNCTIONS ===
export const startTiming = (name: string) => performanceMonitor.startTiming(name);
export const endTiming = (name: string, category?: MetricCategory, metadata?: Record<string, any>) => 
  performanceMonitor.endTiming(name, category, metadata);
export const recordMetric = (metric: Omit<PerformanceMetric, 'timestamp'>) => 
  performanceMonitor.recordMetric(metric);
export const recordFileOperation = (operation: string, duration: number, fileSize?: number) =>
  performanceMonitor.recordFileOperation(operation, duration, fileSize);
export const recordUserInteraction = (interaction: string, duration: number) =>
  performanceMonitor.recordUserInteraction(interaction, duration);

export default PerformanceMonitor;