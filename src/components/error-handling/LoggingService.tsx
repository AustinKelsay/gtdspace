/**
 * @fileoverview React components for logging service integration and debugging
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Logging UI components and debugging tools
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, Search, Bug, Info, AlertTriangle, XCircle, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logger, LogEntry, LogLevel } from '@/services/logging/LoggingService';

// === TYPES ===

interface LogViewerProps {
  maxHeight?: string;
  showControls?: boolean;
  autoRefresh?: boolean;
  className?: string;
}

interface LogStatsProps {
  logs: LogEntry[];
  className?: string;
}

// === LOG VIEWER COMPONENT ===

export const LogViewer: React.FC<LogViewerProps> = ({
  maxHeight = '400px',
  showControls = true,
  autoRefresh = true,
  className = '',
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);

  // Load logs
  const loadLogs = useCallback(() => {
    const allLogs = logger.getLogs();
    setLogs(allLogs);
    
    // Extract unique categories
    const uniqueCategories = Array.from(
      new Set(allLogs.map(log => log.category).filter(Boolean))
    ) as string[];
    setCategories(uniqueCategories);
  }, []);

  // Auto-refresh
  useEffect(() => {
    loadLogs();
    
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [loadLogs, autoRefresh]);

  // Apply filters
  useEffect(() => {
    let filtered = [...logs];

    // Level filter
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(log => log.category === categoryFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(query) ||
        (log.category && log.category.toLowerCase().includes(query)) ||
        (log.data && JSON.stringify(log.data).toLowerCase().includes(query))
      );
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    setFilteredLogs(filtered);
  }, [logs, searchQuery, levelFilter, categoryFilter]);

  // Export logs
  const handleExport = useCallback((format: 'json' | 'csv') => {
    const content = logger.exportLogs(format);
    const blob = new Blob([content], { 
      type: format === 'json' ? 'application/json' : 'text/csv' 
    });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtdspace-logs-${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Clear logs
  const handleClearLogs = useCallback(() => {
    logger.clearStoredLogs();
    setLogs([]);
    setFilteredLogs([]);
  }, []);


  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Application Logs</CardTitle>
          <Badge variant="outline">
            {filteredLogs.length} of {logs.length} logs
          </Badge>
        </div>
        
        {showControls && (
          <div className="flex flex-wrap gap-2 mt-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            {/* Level filter */}
            <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as LogLevel | 'all')}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="fatal">Fatal</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Category filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Actions */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLogs}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div 
          className="space-y-2 overflow-y-auto"
          style={{ maxHeight }}
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {logs.length === 0 ? 'No logs available' : 'No logs match the current filters'}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <LogEntryItem key={log.id} log={log} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// === LOG ENTRY ITEM ===

interface LogEntryItemProps {
  log: LogEntry;
}

const LogEntryItem: React.FC<LogEntryItemProps> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'debug':
        return <Bug className="h-4 w-4 text-gray-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'fatal':
        return <Zap className="h-4 w-4 text-red-700" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'debug':
        return 'bg-gray-100 text-gray-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      case 'warn':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'fatal':
        return 'bg-red-200 text-red-900';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div 
      className={`p-3 border border-gray-200 rounded cursor-pointer hover:bg-gray-50 ${
        log.level === 'error' || log.level === 'fatal' ? 'border-red-200 bg-red-50' : ''
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          {getLevelIcon(log.level)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge className={`text-xs ${getLevelColor(log.level)}`}>
                {log.level.toUpperCase()}
              </Badge>
              
              {log.category && (
                <Badge variant="outline" className="text-xs">
                  {log.category}
                </Badge>
              )}
            </div>
            
            <span className="text-xs text-gray-500">
              {new Date(log.timestamp).toLocaleString()}
            </span>
          </div>
          
          <p className="mt-1 text-sm text-gray-900 break-words">
            {log.message}
          </p>
          
          {expanded && (
            <div className="mt-3 space-y-2">
              {log.data && (
                <div>
                  <h5 className="text-xs font-medium text-gray-700 mb-1">Data:</h5>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </div>
              )}
              
              {log.stack && (
                <div>
                  <h5 className="text-xs font-medium text-gray-700 mb-1">Stack Trace:</h5>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                    {log.stack}
                  </pre>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                {log.url && (
                  <div>
                    <span className="font-medium">URL:</span> {log.url}
                  </div>
                )}
                
                {log.userAgent && (
                  <div>
                    <span className="font-medium">User Agent:</span> {log.userAgent}
                  </div>
                )}
                
                <div>
                  <span className="font-medium">Session:</span> {log.sessionId}
                </div>
                
                {log.buildVersion && (
                  <div>
                    <span className="font-medium">Version:</span> {log.buildVersion}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// === LOG STATISTICS ===

export const LogStats: React.FC<LogStatsProps> = ({ logs, className = '' }) => {
  const stats = React.useMemo(() => {
    const levelCounts = logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);

    const categoryCounts = logs.reduce((acc, log) => {
      if (log.category) {
        acc[log.category] = (acc[log.category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const recentErrors = logs
      .filter(log => log.level === 'error' || log.level === 'fatal')
      .slice(-5);

    return {
      total: logs.length,
      levels: levelCounts,
      categories: categoryCounts,
      recentErrors,
    };
  }, [logs]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Log Statistics</CardTitle>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="overview">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="levels">Levels</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Logs</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {(stats.levels.error || 0) + (stats.levels.fatal || 0)}
                </div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
            </div>
            
            {stats.recentErrors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Recent Errors</h4>
                <div className="space-y-1">
                  {stats.recentErrors.map(log => (
                    <div key={log.id} className="text-xs p-2 bg-red-50 border border-red-200 rounded">
                      {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="levels" className="space-y-2">
            {Object.entries(stats.levels).map(([level, count]) => (
              <div key={level} className="flex justify-between items-center">
                <span className="capitalize">{level}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
          </TabsContent>
          
          <TabsContent value="categories" className="space-y-2">
            {Object.entries(stats.categories).map(([category, count]) => (
              <div key={category} className="flex justify-between items-center">
                <span>{category}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// === LOGGING PROVIDER ===

interface LoggingProviderProps {
  children: React.ReactNode;
  config?: {
    enableConsole?: boolean;
    enableStorage?: boolean;
    level?: LogLevel;
  };
}

export const LoggingProvider: React.FC<LoggingProviderProps> = ({
  children,
  config = {},
}) => {
  useEffect(() => {
    // Update logger config
    logger.updateConfig(config);
    
    // Log application start
    logger.info('Application started', {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }, 'app-lifecycle');
    
    // Cleanup on unmount
    return () => {
      logger.info('Application unmounting', {
        timestamp: Date.now(),
      }, 'app-lifecycle');
      logger.destroy();
    };
  }, [config]);

  return <>{children}</>;
};

export default LogViewer;