/**
 * @fileoverview Memory monitoring component with visualization and alerts
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Memory optimization monitoring UI
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { memoryMonitor, MemoryMonitorService, MemoryMetrics, MemoryAlert } from '@/services/performance/memoryMonitor';

interface MemoryMonitorProps {
  /** Whether to show detailed metrics */
  showDetails?: boolean;
  /** Whether to auto-start monitoring */
  autoStart?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Memory monitoring component with real-time metrics and alerts
 */
export const MemoryMonitor: React.FC<MemoryMonitorProps> = ({
  showDetails = false,
  autoStart = true,
  className,
}) => {
  const [metrics, setMetrics] = useState<MemoryMetrics | null>(null);
  const [alerts, setAlerts] = useState<MemoryAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [trend, setTrend] = useState<'increasing' | 'decreasing' | 'stable'>('stable');

  // Update metrics and alerts
  const updateMetrics = useCallback((newMetrics: MemoryMetrics) => {
    setMetrics(newMetrics);
    setTrend(memoryMonitor.getMemoryTrend());
  }, []);

  const updateAlerts = useCallback((alert: MemoryAlert) => {
    setAlerts(prev => [...prev, alert]);
  }, []);

  // Start/stop monitoring
  const handleToggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      memoryMonitor.stopMonitoring();
      setIsMonitoring(false);
    } else {
      memoryMonitor.startMonitoring();
      setIsMonitoring(true);
    }
  }, [isMonitoring]);

  // Clear alerts
  const handleClearAlerts = useCallback(() => {
    memoryMonitor.clearAlerts();
    setAlerts([]);
  }, []);

  // Force garbage collection
  const handleForceGC = useCallback(() => {
    memoryMonitor.suggestGarbageCollection();
    // Refresh metrics after a short delay
    setTimeout(() => {
      const currentMetrics = memoryMonitor.collectMetrics();
      setMetrics(currentMetrics);
    }, 1000);
  }, []);

  // Setup monitoring
  useEffect(() => {
    if (autoStart) {
      memoryMonitor.startMonitoring();
      setIsMonitoring(true);
    }

    // Subscribe to metrics updates
    const unsubscribeMetrics = memoryMonitor.onMetrics(updateMetrics);
    const unsubscribeAlerts = memoryMonitor.onAlert(updateAlerts);

    // Get initial state
    const currentMetrics = memoryMonitor.getCurrentMetrics();
    if (currentMetrics) {
      setMetrics(currentMetrics);
    }
    setAlerts(memoryMonitor.getAlerts());

    return () => {
      unsubscribeMetrics();
      unsubscribeAlerts();
      if (autoStart) {
        memoryMonitor.stopMonitoring();
      }
    };
  }, [autoStart, updateMetrics, updateAlerts]);

  // Get memory status color
  const getMemoryStatusColor = (percent: number): string => {
    if (percent >= 90) return 'text-red-600';
    if (percent >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Get trend icon
  const getTrendIcon = () => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  if (!metrics) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-center text-gray-500">
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Loading memory metrics...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Memory Overview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Memory Usage</CardTitle>
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleMonitoring}
              >
                {isMonitoring ? 'Stop' : 'Start'} Monitoring
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Memory Usage Bar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">JS Heap Usage</span>
                <span className={`text-sm font-medium ${getMemoryStatusColor(metrics.memoryUsagePercent)}`}>
                  {metrics.memoryUsagePercent.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={metrics.memoryUsagePercent} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{MemoryMonitorService.formatBytes(metrics.usedJSHeapSize)}</span>
                <span>{MemoryMonitorService.formatBytes(metrics.jsHeapSizeLimit)}</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">DOM Nodes:</span>
                <span className="ml-2 font-medium">{metrics.domNodes.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">Event Listeners:</span>
                <span className="ml-2 font-medium">{metrics.eventListeners}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleForceGC}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Force GC
              </Button>
              {alerts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAlerts}
                >
                  Clear Alerts ({alerts.length})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
              Memory Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(-5).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.type === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.type}
                    </Badge>
                    <span className="text-sm">{alert.message}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              {alerts.length > 5 && (
                <p className="text-xs text-gray-500 text-center">
                  ... and {alerts.length - 5} more alerts
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Metrics */}
      {showDetails && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Detailed Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Total JS Heap:</span>
                <span className="ml-2 font-medium">
                  {MemoryMonitorService.formatBytes(metrics.totalJSHeapSize)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">JS Heap Limit:</span>
                <span className="ml-2 font-medium">
                  {MemoryMonitorService.formatBytes(metrics.jsHeapSizeLimit)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Cache Size:</span>
                <span className="ml-2 font-medium">
                  {MemoryMonitorService.formatBytes(metrics.cacheSize)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Last Updated:</span>
                <span className="ml-2 font-medium">
                  {new Date(metrics.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Optimization Suggestions */}
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Optimization Suggestions:</h4>
              <div className="space-y-1">
                {memoryMonitor.getOptimizationSuggestions().map((suggestion, index) => (
                  <p key={index} className="text-xs text-gray-600 pl-2 border-l-2 border-blue-200">
                    {suggestion}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MemoryMonitor;