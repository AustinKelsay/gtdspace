/**
 * @fileoverview Performance benchmarking system for comprehensive performance testing
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Performance benchmarking and measurement
 */

export interface BenchmarkResult {
  /** Unique identifier for the benchmark */
  id: string;
  /** Name of the benchmark */
  name: string;
  /** Category of the benchmark */
  category: 'file_operations' | 'ui_rendering' | 'memory' | 'startup' | 'search';
  /** Duration in milliseconds */
  duration: number;
  /** Number of operations performed */
  operations: number;
  /** Operations per second */
  opsPerSecond: number;
  /** Memory used during benchmark (bytes) */
  memoryUsed: number;
  /** Additional metrics specific to the benchmark */
  customMetrics: Record<string, number>;
  /** Timestamp when benchmark was run */
  timestamp: number;
  /** Whether the benchmark passed performance targets */
  passed: boolean;
  /** Target duration (ms) for comparison */
  target?: number;
}

export interface BenchmarkSuite {
  /** Name of the benchmark suite */
  name: string;
  /** Description of what this suite tests */
  description: string;
  /** Individual benchmarks in the suite */
  benchmarks: BenchmarkResult[];
  /** Overall suite duration */
  totalDuration: number;
  /** Suite pass/fail status */
  passed: boolean;
  /** Timestamp when suite was run */
  timestamp: number;
}

export interface BenchmarkConfig {
  /** Number of times to run each benchmark */
  iterations: number;
  /** Warm-up iterations before measurement */
  warmupIterations: number;
  /** Maximum time to spend on a single benchmark (ms) */
  maxDuration: number;
  /** Whether to collect memory metrics */
  collectMemoryMetrics: boolean;
  /** Performance targets for each category */
  targets: {
    file_operations: number; // max ms for file operations
    ui_rendering: number; // max ms for UI updates
    memory: number; // max MB memory usage
    startup: number; // max ms for app startup
    search: number; // max ms for search operations
  };
}

/**
 * Performance benchmarking service
 */
class BenchmarkRunner {
  private config: BenchmarkConfig = {
    iterations: 10,
    warmupIterations: 3,
    maxDuration: 30000, // 30 seconds
    collectMemoryMetrics: true,
    targets: {
      file_operations: 300,
      ui_rendering: 16, // 60fps = 16.67ms per frame
      memory: 200, // 200MB
      startup: 2000,
      search: 1000,
    },
  };

  private results: BenchmarkSuite[] = [];
  private isRunning = false;

  constructor(config?: Partial<BenchmarkConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Run a single benchmark
   */
  async runBenchmark(
    name: string,
    category: BenchmarkResult['category'],
    operation: () => Promise<any> | any,
    customMetrics?: () => Record<string, number>
  ): Promise<BenchmarkResult> {
    const id = `benchmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Warm-up iterations
    for (let i = 0; i < this.config.warmupIterations; i++) {
      await operation();
    }

    // Measure memory before
    const memoryBefore = this.getMemoryUsage();

    // Run benchmark iterations
    const durations: number[] = [];
    const startTime = performance.now();

    for (let i = 0; i < this.config.iterations; i++) {
      const iterationStart = performance.now();
      await operation();
      const iterationEnd = performance.now();
      
      durations.push(iterationEnd - iterationStart);

      // Check timeout
      if (performance.now() - startTime > this.config.maxDuration) {
        console.warn(`Benchmark ${name} timed out after ${this.config.maxDuration}ms`);
        break;
      }
    }

    // Measure memory after
    const memoryAfter = this.getMemoryUsage();
    const memoryUsed = memoryAfter - memoryBefore;

    // Calculate statistics
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const opsPerSecond = 1000 / avgDuration;

    // Get custom metrics
    const customMetricsData = customMetrics ? customMetrics() : {};

    // Check if benchmark passed
    const target = this.config.targets[category];
    const passed = category === 'memory' 
      ? memoryUsed / (1024 * 1024) <= target // Convert to MB
      : avgDuration <= target;

    const result: BenchmarkResult = {
      id,
      name,
      category,
      duration: avgDuration,
      operations: durations.length,
      opsPerSecond,
      memoryUsed,
      customMetrics: customMetricsData,
      timestamp: Date.now(),
      passed,
      target,
    };

    return result;
  }

  /**
   * Run a complete benchmark suite
   */
  async runSuite(name: string, description: string, benchmarks: {
    name: string;
    category: BenchmarkResult['category'];
    operation: () => Promise<any> | any;
    customMetrics?: () => Record<string, number>;
  }[]): Promise<BenchmarkSuite> {
    if (this.isRunning) {
      throw new Error('Benchmark suite is already running');
    }

    this.isRunning = true;
    const suiteStart = performance.now();
    const results: BenchmarkResult[] = [];

    try {
      for (const benchmark of benchmarks) {
        console.log(`Running benchmark: ${benchmark.name}`);
        const result = await this.runBenchmark(
          benchmark.name,
          benchmark.category,
          benchmark.operation,
          benchmark.customMetrics
        );
        results.push(result);
      }

      const suiteEnd = performance.now();
      const suite: BenchmarkSuite = {
        name,
        description,
        benchmarks: results,
        totalDuration: suiteEnd - suiteStart,
        passed: results.every(r => r.passed),
        timestamp: Date.now(),
      };

      this.results.push(suite);
      return suite;

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run standard application benchmarks
   */
  async runStandardBenchmarks(): Promise<BenchmarkSuite> {
    return this.runSuite(
      'Standard Application Benchmarks',
      'Core performance benchmarks for GTD Space application',
      [
        // File operation benchmarks
        {
          name: 'File Creation',
          category: 'file_operations',
          operation: async () => {
            // Simulate file creation
            const content = 'test content '.repeat(100);
            return new Promise(resolve => {
              // Simulate async file operation
              setTimeout(() => resolve(content), Math.random() * 10);
            });
          },
          customMetrics: () => ({ fileSize: 1200 }),
        },
        {
          name: 'Large File Loading',
          category: 'file_operations',
          operation: async () => {
            // Simulate loading a large file
            const largeContent = 'line content\n'.repeat(10000);
            return new Promise(resolve => {
              setTimeout(() => resolve(largeContent.length), Math.random() * 50);
            });
          },
          customMetrics: () => ({ fileSize: 120000 }),
        },

        // UI rendering benchmarks
        {
          name: 'DOM Manipulation',
          category: 'ui_rendering',
          operation: () => {
            const container = document.createElement('div');
            for (let i = 0; i < 100; i++) {
              const element = document.createElement('div');
              element.textContent = `Element ${i}`;
              container.appendChild(element);
            }
            return container.children.length;
          },
          customMetrics: () => ({ elementsCreated: 100 }),
        },
        {
          name: 'Component Re-render',
          category: 'ui_rendering',
          operation: () => {
            // Simulate component state updates
            const state = { count: 0 };
            for (let i = 0; i < 50; i++) {
              state.count++;
              // Simulate render cycle
              const renderTime = performance.now();
              while (performance.now() - renderTime < 0.1) {
                // Busy wait to simulate render work
              }
            }
            return state.count;
          },
          customMetrics: () => ({ rerenders: 50 }),
        },

        // Memory benchmarks
        {
          name: 'Memory Allocation',
          category: 'memory',
          operation: () => {
            const arrays = [];
            for (let i = 0; i < 1000; i++) {
              arrays.push(new Array(1000).fill(i));
            }
            return arrays.length;
          },
          customMetrics: () => ({ arraysCreated: 1000 }),
        },

        // Search benchmarks
        {
          name: 'File Search',
          category: 'search',
          operation: () => {
            const files = Array.from({ length: 1000 }, (_, i) => ({
              name: `file-${i}.md`,
              content: `content for file ${i}`,
            }));
            
            const query = 'file-5';
            const results = files.filter(f => f.name.includes(query));
            return results.length;
          },
          customMetrics: () => ({ filesSearched: 1000, resultsFound: 1 }),
        },
        {
          name: 'Content Search',
          category: 'search',
          operation: () => {
            const content = 'Lorem ipsum dolor sit amet '.repeat(1000);
            const query = 'dolor';
            const matches = (content.match(new RegExp(query, 'gi')) || []).length;
            return matches;
          },
          customMetrics: () => ({ contentLength: 26000, matchesFound: 1000 }),
        },
      ]
    );
  }

  /**
   * Run memory stress test
   */
  async runMemoryStressTest(): Promise<BenchmarkSuite> {
    return this.runSuite(
      'Memory Stress Test',
      'Tests application behavior under memory pressure',
      [
        {
          name: 'Large Array Creation',
          category: 'memory',
          operation: () => {
            const largeArray = new Array(100000).fill(0).map((_, i) => ({
              id: i,
              data: `item-${i}-data`.repeat(10),
            }));
            return largeArray.length;
          },
        },
        {
          name: 'DOM Node Stress',
          category: 'memory',
          operation: () => {
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < 5000; i++) {
              const div = document.createElement('div');
              div.innerHTML = `<span>Node ${i}</span><p>Content ${i}</p>`;
              fragment.appendChild(div);
            }
            return fragment.children.length;
          },
        },
        {
          name: 'Event Listener Stress',
          category: 'memory',
          operation: () => {
            const elements = [];
            for (let i = 0; i < 1000; i++) {
              const element = document.createElement('button');
              element.addEventListener('click', () => {});
              elements.push(element);
            }
            // Clean up
            elements.forEach(el => el.remove());
            return elements.length;
          },
        },
      ]
    );
  }

  /**
   * Get current memory usage in bytes
   */
  private getMemoryUsage(): number {
    const performance = window.performance as any;
    return performance.memory?.usedJSHeapSize || 0;
  }

  /**
   * Get all benchmark results
   */
  getResults(): BenchmarkSuite[] {
    return [...this.results];
  }

  /**
   * Get the latest benchmark suite
   */
  getLatestResults(): BenchmarkSuite | null {
    return this.results[this.results.length - 1] || null;
  }

  /**
   * Clear all benchmark results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Export results to JSON
   */
  exportResults(): string {
    return JSON.stringify({
      config: this.config,
      results: this.results,
      timestamp: Date.now(),
    }, null, 2);
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const latest = this.getLatestResults();
    if (!latest) {
      return 'No benchmark results available';
    }

    const lines: string[] = [];
    lines.push(`Performance Report: ${latest.name}`);
    lines.push(`Generated: ${new Date(latest.timestamp).toLocaleString()}`);
    lines.push(`Total Duration: ${latest.totalDuration.toFixed(2)}ms`);
    lines.push(`Overall Status: ${latest.passed ? 'PASS' : 'FAIL'}`);
    lines.push('');

    latest.benchmarks.forEach(benchmark => {
      lines.push(`${benchmark.name} (${benchmark.category})`);
      lines.push(`  Duration: ${benchmark.duration.toFixed(2)}ms (target: ${benchmark.target}ms)`);
      lines.push(`  Ops/sec: ${benchmark.opsPerSecond.toFixed(2)}`);
      lines.push(`  Memory: ${(benchmark.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      lines.push(`  Status: ${benchmark.passed ? 'PASS' : 'FAIL'}`);
      
      Object.entries(benchmark.customMetrics).forEach(([key, value]) => {
        lines.push(`  ${key}: ${value}`);
      });
      
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Check if currently running benchmarks
   */
  isRunningBenchmarks(): boolean {
    return this.isRunning;
  }
}

// Global benchmark runner instance
export const benchmarkRunner = new BenchmarkRunner();

export { BenchmarkRunner };