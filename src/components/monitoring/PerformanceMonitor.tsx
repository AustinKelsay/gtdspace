/**
 * @fileoverview Performance monitoring UI component
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Performance monitoring interface
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, MemoryStick, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { performanceMonitor, type PerformanceReport, type PerformanceMetric } from '@/services/performance/PerformanceMonitor';

// === TYPES ===
interface PerformanceMonitorProps {
  /** Whether to show detailed metrics */
  showDetailed?: boolean;
  /** Whether to auto-refresh metrics */
  autoRefresh?: boolean;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Optional CSS class name */
  className?: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'critical';
}

// === METRIC CARD COMPONENT ===
const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit = '',
  icon,
  trend,
  status = 'good',
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'critical':
        return 'text-destructive';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'good':
      default:
        return 'text-green-600 dark:text-green-400';
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    return (
      <TrendingUp 
        className={`h-3 w-3 ml-1 ${
          trend === 'up' ? 'text-red-500 rotate-0' :
          trend === 'down' ? 'text-green-500 rotate-180' :
          'text-muted-foreground'
        }`}
      />
    );
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {icon}
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-center">
              <p className={`text-2xl font-bold ${getStatusColor()}`}>
                {typeof value === 'number' ? value.toFixed(1) : value}
              </p>
              {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
              {getTrendIcon()}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

// === PERFORMANCE CHART COMPONENT ===
const PerformanceChart: React.FC<{ metrics: PerformanceMetric[] }> = ({ metrics }) => {
  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <p className="text-sm">No metrics available</p>
      </div>
    );
  }

  // Simple bar chart representation
  const maxValue = Math.max(...metrics.map(m => m.value));
  const recent = metrics.slice(-10); // Last 10 metrics

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Recent Performance</span>
        <span>Max: {maxValue.toFixed(1)}ms</span>
      </div>
      <div className="flex items-end space-x-1 h-20">
        {recent.map((metric, index) => (
          <div
            key={`${metric.timestamp}-${index}`}
            className="flex-1 bg-primary rounded-sm min-w-0"
            style={{
              height: `${(metric.value / maxValue) * 100}%`,
              minHeight: '2px',
            }}
            title={`${metric.name}: ${metric.value.toFixed(1)}ms`}
          />
        ))}
      </div>
    </div>
  );
};

// === MAIN PERFORMANCE MONITOR COMPONENT ===
export const PerformanceMonitorComponent: React.FC<PerformanceMonitorProps> = ({
  showDetailed = false,
  autoRefresh = true,
  refreshInterval = 5000,
  className = '',
}) => {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // === REFRESH METRICS ===
  const refreshMetrics = useCallback(async () => {
    setIsRefreshing(true);
    
    try {
      // Record memory usage before generating report
      performanceMonitor.recordMemoryUsage();
      
      // Generate performance report
      const newReport = performanceMonitor.generateReport();
      setReport(newReport);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to refresh performance metrics:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // === AUTO REFRESH ===
  useEffect(() => {
    // Initial load
    refreshMetrics();

    if (!autoRefresh) return;

    const interval = setInterval(refreshMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshMetrics]);

  // === RENDER HELPERS ===
  const getPerformanceStatus = (score: number): 'good' | 'warning' | 'critical' => {
    if (score >= 80) return 'good';
    if (score >= 60) return 'warning';
    return 'critical';
  };

  const getScoreColor = (score: number): string => {
    const status = getPerformanceStatus(score);
    switch (status) {
      case 'good': return 'text-green-600 dark:text-green-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'critical': return 'text-destructive';
    }
  };

  if (!report) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Calculate summary metrics
  const memoryMetrics = report.metrics.memory;
  const currentMemory = memoryMetrics[memoryMetrics.length - 1]?.value || 0;
  
  const fileOpMetrics = report.metrics.file_operation;
  const avgFileOpTime = fileOpMetrics.length > 0 
    ? fileOpMetrics.reduce((sum, m) => sum + m.value, 0) / fileOpMetrics.length 
    : 0;

  const renderMetrics = report.metrics.render;
  const longTasks = renderMetrics.filter(m => m.name === 'long_task');

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Performance Monitor</span>
              </CardTitle>
              <CardDescription>
                Real-time application performance metrics
                {lastRefresh && (
                  <span className="ml-2 text-xs">
                    • Updated {lastRefresh.toLocaleTimeString()}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${getScoreColor(report.score)}`}>
                {report.score}
              </div>
              <p className="text-xs text-muted-foreground">Performance Score</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress 
            value={report.score} 
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Poor</span>
            <span>Good</span>
            <span>Excellent</span>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Memory Usage"
          value={currentMemory}
          unit="MB"
          icon={<MemoryStick className="h-4 w-4 text-blue-500" />}
          status={currentMemory > 200 ? 'warning' : 'good'}
        />
        
        <MetricCard
          title="Avg File Load"
          value={avgFileOpTime}
          unit="ms"
          icon={<Clock className="h-4 w-4 text-green-500" />}
          status={avgFileOpTime > 300 ? 'warning' : 'good'}
        />
        
        <MetricCard
          title="Long Tasks"
          value={longTasks.length}
          icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
          status={longTasks.length > 3 ? 'critical' : longTasks.length > 0 ? 'warning' : 'good'}
        />
        
        <MetricCard
          title="Total Metrics"
          value={Object.values(report.metrics).flat().length}
          icon={<Activity className="h-4 w-4 text-purple-500" />}
        />
      </div>

      {/* Warnings and Recommendations */}
      {(report.warnings.length > 0 || report.recommendations.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {report.warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span>Performance Warnings</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.warnings.map((warning, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <Badge variant="destructive" className="text-xs">!</Badge>
                      <p className="text-sm text-muted-foreground">{warning}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {report.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span>Recommendations</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <Badge variant="secondary" className="text-xs">💡</Badge>
                      <p className="text-sm text-muted-foreground">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Detailed Metrics */}
      {showDetailed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">File Operations</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart metrics={report.metrics.file_operation} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Render Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart metrics={report.metrics.render} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Control Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshMetrics}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => performanceMonitor.clearMetrics()}
          >
            Clear Data
          </Button>
        </div>

        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${
            performanceMonitor.isMonitoringEnabled() ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span>
            {performanceMonitor.isMonitoringEnabled() ? 'Monitoring Active' : 'Monitoring Disabled'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitorComponent;