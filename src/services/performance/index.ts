/**
 * @fileoverview Performance monitoring and optimization services
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Performance services exports
 */

import { memoryMonitor as _memoryMonitor, MemoryMonitorService } from './memoryMonitor';
import { benchmarkRunner as _benchmarkRunner, BenchmarkRunner } from './benchmarkRunner';

export { MemoryMonitorService, BenchmarkRunner };
export const memoryMonitor = _memoryMonitor;
export const benchmarkRunner = _benchmarkRunner;
export {
  useResourceCleanup,
  useMemoryLeakDetection,
  useLargeCollection,
  useDebouncedValue,
  useThrottledCallback,
} from './memoryLeakPrevention';

// Re-export existing performance monitor
export { 
  startTiming, 
  endTiming, 
  recordFileOperation, 
  performanceMonitor,
} from './PerformanceMonitor';

// Re-export types separately for isolatedModules
export type {
  PerformanceMetric,
  MetricCategory,
  PerformanceThresholds,
  PerformanceReport,
} from './PerformanceMonitor';

/**
 * Initialize all performance monitoring services
 */
export function initializePerformanceMonitoring(): void {
  // Start memory monitoring
  memoryMonitor.startMonitoring();
  
  console.log('Performance monitoring initialized');
}

/**
 * Cleanup all performance monitoring services
 */
export function cleanupPerformanceMonitoring(): void {
  // Stop memory monitoring
  memoryMonitor.stopMonitoring();
  
  // Clear benchmark results
  benchmarkRunner.clearResults();
  
  console.log('Performance monitoring cleaned up');
}

/**
 * Run comprehensive performance analysis
 */
export async function runPerformanceAnalysis(): Promise<{
  memoryMetrics: any;
  benchmarkResults: any;
  performanceReport: string;
}> {
  // Collect current memory metrics
  const memoryMetrics = memoryMonitor.getCurrentMetrics();
  
  // Run standard benchmarks
  const benchmarkResults = await benchmarkRunner.runStandardBenchmarks();
  
  // Generate comprehensive report
  const performanceReport = generatePerformanceReport(memoryMetrics, benchmarkResults);
  
  return {
    memoryMetrics,
    benchmarkResults,
    performanceReport,
  };
}

/**
 * Generate comprehensive performance report
 */
function generatePerformanceReport(memoryMetrics: any, benchmarkResults: any): string {
  const lines: string[] = [];
  
  lines.push('=== GTD Space Performance Report ===');
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');
  
  // Memory Analysis
  if (memoryMetrics) {
    lines.push('MEMORY ANALYSIS:');
    lines.push(`  Memory Usage: ${memoryMetrics.memoryUsagePercent.toFixed(1)}%`);
    lines.push(`  JS Heap Used: ${(memoryMetrics.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
    lines.push(`  JS Heap Limit: ${(memoryMetrics.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`);
    lines.push(`  DOM Nodes: ${memoryMetrics.domNodes.toLocaleString()}`);
    lines.push(`  Event Listeners: ${memoryMetrics.eventListeners}`);
    lines.push('');
  }
  
  // Benchmark Analysis
  if (benchmarkResults) {
    lines.push('BENCHMARK ANALYSIS:');
    lines.push(`  Suite: ${benchmarkResults.name}`);
    lines.push(`  Status: ${benchmarkResults.passed ? 'PASS' : 'FAIL'}`);
    lines.push(`  Total Duration: ${benchmarkResults.totalDuration.toFixed(2)}ms`);
    lines.push(`  Tests: ${benchmarkResults.benchmarks.length}`);
    lines.push('');
    
    // Category breakdown
    const categories = benchmarkResults.benchmarks.reduce((acc: any, b: any) => {
      if (!acc[b.category]) acc[b.category] = [];
      acc[b.category].push(b);
      return acc;
    }, {});
    
    Object.entries(categories).forEach(([category, benchmarks]) => {
      const avgDuration = (benchmarks as any[]).reduce((sum, b) => sum + b.duration, 0) / (benchmarks as any[]).length;
      const passed = (benchmarks as any[]).every(b => b.passed);
      
      lines.push(`  ${category.replace('_', ' ').toUpperCase()}:`);
      lines.push(`    Status: ${passed ? 'PASS' : 'FAIL'}`);
      lines.push(`    Average Duration: ${avgDuration.toFixed(2)}ms`);
      lines.push(`    Tests: ${(benchmarks as any[]).length}`);
      lines.push('');
    });
  }
  
  // Optimization Suggestions
  const suggestions = memoryMonitor.getOptimizationSuggestions();
  if (suggestions.length > 0) {
    lines.push('OPTIMIZATION SUGGESTIONS:');
    suggestions.forEach((suggestion: string) => {
      lines.push(`  • ${suggestion}`);
    });
    lines.push('');
  }
  
  lines.push('=== End Report ===');
  
  return lines.join('\n');
}