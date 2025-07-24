/**
 * @fileoverview Debug panel for development information
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Development debugging tools
 */

import React, { useState, useEffect } from 'react';
import { Bug, X, Activity, Database, Zap, MemoryStick, HardDrive, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { performanceMonitor } from '@/services/performance/PerformanceMonitor';
import { cacheManager } from '@/services/caching';

// === TYPES ===
interface DebugPanelProps {
  /** Whether panel is open */
  isOpen: boolean;
  /** Callback when panel is closed */
  onClose: () => void;
  /** Optional CSS class name */
  className?: string;
}

interface SystemInfo {
  userAgent: string;
  platform: string;
  language: string;
  cookiesEnabled: boolean;
  onlineStatus: boolean;
  memoryInfo?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  connectionInfo?: any;
}

// === DEBUG PANEL COMPONENT ===

/**
 * Debug panel component for development
 * 
 * Provides comprehensive debugging information including:
 * - Performance metrics
 * - Cache statistics
 * - System information
 * - Error tracking
 * - Memory usage
 */
export const DebugPanel: React.FC<DebugPanelProps> = ({
  isOpen,
  onClose,
  className = '',
}) => {
  // === STATE ===
  const [activeTab, setActiveTab] = useState<'performance' | 'cache' | 'system' | 'errors'>('performance');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // === EFFECTS ===
  useEffect(() => {
    if (isOpen) {
      // Collect system information
      collectSystemInfo();
      
      // Set up auto-refresh
      if (autoRefresh) {
        const interval = setInterval(() => {
          collectSystemInfo();
        }, 1000);
        setRefreshInterval(interval as any);
        
        return () => {
          if (interval) clearInterval(interval);
        };
      }
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [isOpen, autoRefresh]);

  // === SYSTEM INFO COLLECTION ===
  const collectSystemInfo = () => {
    const info: SystemInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine,
    };

    // Memory info (Chrome only)
    if ('memory' in performance) {
      info.memoryInfo = (performance as any).memory;
    }

    // Connection info (modern browsers)
    if ('connection' in navigator) {
      info.connectionInfo = (navigator as any).connection;
    }

    setSystemInfo(info);
  };

  // === RENDER HELPERS ===
  const renderPerformanceTab = () => {
    const report = performanceMonitor.generateReport();
    
    return (
      <div className="space-y-4">
        {/* Performance Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Performance Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-bold">{report.score}</div>
              <Progress value={report.score} className="flex-1" />
              <Badge variant={report.score >= 80 ? 'default' : report.score >= 60 ? 'secondary' : 'destructive'}>
                {report.score >= 80 ? 'Good' : report.score >= 60 ? 'Fair' : 'Poor'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Real-time Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">File Operations</div>
                <div className="font-mono">{report.metrics.file_operation.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Memory Usage</div>
                <div className="font-mono">
                  {report.metrics.memory.length > 0 
                    ? `${report.metrics.memory[report.metrics.memory.length - 1].value.toFixed(1)}MB`
                    : 'N/A'
                  }
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Render Events</div>
                <div className="font-mono">{report.metrics.render.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">User Interactions</div>
                <div className="font-mono">{report.metrics.user_interaction.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warnings */}
        {report.warnings.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-yellow-600">Performance Warnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report.warnings.map((warning, index) => (
                  <div key={index} className="text-sm text-muted-foreground flex items-start">
                    <Badge variant="destructive" className="mr-2 mt-0.5">!</Badge>
                    {warning}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderCacheTab = () => {
    const stats = cacheManager.getStats();
    
    return (
      <div className="space-y-4">
        {/* Cache Overview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center">
              <Database className="h-4 w-4 mr-2" />
              Cache Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* File Content Cache */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">File Content</span>
                  <Badge variant="outline">{stats.fileContent.size} items</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Hits: {stats.fileContent.hits} | Misses: {stats.fileContent.misses} | 
                  Hit Rate: {(stats.fileContent.hitRate * 100).toFixed(1)}%
                </div>
                <Progress value={stats.fileContent.hitRate * 100} className="h-2 mt-1" />
              </div>

              {/* Parsed Markdown Cache */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Parsed Markdown</span>
                  <Badge variant="outline">{stats.parsedMarkdown.size} items</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Hits: {stats.parsedMarkdown.hits} | Misses: {stats.parsedMarkdown.misses} | 
                  Hit Rate: {(stats.parsedMarkdown.hitRate * 100).toFixed(1)}%
                </div>
                <Progress value={stats.parsedMarkdown.hitRate * 100} className="h-2 mt-1" />
              </div>

              {/* Search Results Cache */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Search Results</span>
                  <Badge variant="outline">{stats.searchResults.size} items</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Hits: {stats.searchResults.hits} | Misses: {stats.searchResults.misses} | 
                  Hit Rate: {(stats.searchResults.hitRate * 100).toFixed(1)}%
                </div>
                <Progress value={stats.searchResults.hitRate * 100} className="h-2 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cache Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cache Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => cacheManager.clearCache('file')}
              >
                Clear File Cache
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => cacheManager.clearCache('parse')}
              >
                Clear Parse Cache
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => cacheManager.clearCache('search')}
              >
                Clear Search Cache
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => cacheManager.clearAll()}
              >
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSystemTab = () => {
    if (!systemInfo) return <div>Loading system information...</div>;
    
    return (
      <div className="space-y-4">
        {/* Browser Information */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center">
              <HardDrive className="h-4 w-4 mr-2" />
              Browser Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Platform:</span>
                <span className="ml-2 font-mono">{systemInfo.platform}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Language:</span>
                <span className="ml-2 font-mono">{systemInfo.language}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Online:</span>
                <Badge variant={systemInfo.onlineStatus ? 'default' : 'destructive'} className="ml-2">
                  {systemInfo.onlineStatus ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Cookies:</span>
                <Badge variant={systemInfo.cookiesEnabled ? 'default' : 'destructive'} className="ml-2">
                  {systemInfo.cookiesEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Memory Information */}
        {systemInfo.memoryInfo && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center">
                <MemoryStick className="h-4 w-4 mr-2" />
                Memory Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Used:</span>
                  <span className="ml-2 font-mono">
                    {(systemInfo.memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>
                  <span className="ml-2 font-mono">
                    {(systemInfo.memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Limit:</span>
                  <span className="ml-2 font-mono">
                    {(systemInfo.memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <Progress 
                  value={(systemInfo.memoryInfo.usedJSHeapSize / systemInfo.memoryInfo.jsHeapSizeLimit) * 100} 
                  className="h-2 mt-2" 
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Agent */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">User Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs font-mono text-muted-foreground break-all">
              {systemInfo.userAgent}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderErrorsTab = () => {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Error Tracking</CardTitle>
            <CardDescription>Error tracking and logging information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Error tracking implementation would go here.
              This could include:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>JavaScript errors and stack traces</li>
                <li>Network request failures</li>
                <li>Performance monitoring alerts</li>
                <li>User interaction errors</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 bg-black/80 ${className}`}>
      <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Bug className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Debug Panel</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <Activity className={`h-4 w-4 ${autoRefresh ? 'text-green-500' : 'text-muted-foreground'}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b">
          {[
            { id: 'performance', label: 'Performance', icon: Zap },
            { id: 'cache', label: 'Cache', icon: Database },
            { id: 'system', label: 'System', icon: HardDrive },
            { id: 'errors', label: 'Errors', icon: Bug },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex-1 flex items-center justify-center space-x-1 p-3 text-sm border-r last:border-r-0 hover:bg-muted/50 ${
                activeTab === id ? 'bg-muted border-b-2 border-primary' : ''
              }`}
            >
              <Icon className="h-3 w-3" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'performance' && renderPerformanceTab()}
          {activeTab === 'cache' && renderCacheTab()}
          {activeTab === 'system' && renderSystemTab()}
          {activeTab === 'errors' && renderErrorsTab()}
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Debug Mode Active</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;