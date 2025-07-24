/**
 * @fileoverview Comprehensive logging service for error tracking and debugging
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Error logging and debugging utilities
 */

// === TYPES ===

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  category?: string;
  data?: any;
  stack?: string;
  url?: string;
  userAgent?: string;
  userId?: string;
  sessionId: string;
  buildVersion?: string;
  environment: 'development' | 'production' | 'test';
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  enableRemote: boolean;
  maxStoredLogs: number;
  remoteEndpoint?: string;
  batchSize: number;
  flushInterval: number; // milliseconds
  includeStack: boolean;
  includeUserAgent: boolean;
  includeUrl: boolean;
  categories: string[];
  filters: LogFilter[];
}

export interface LogFilter {
  name: string;
  condition: (entry: LogEntry) => boolean;
}

export interface LogTransport {
  name: string;
  log: (entry: LogEntry) => Promise<void> | void;
  flush?: () => Promise<void> | void;
}

// === LOG LEVELS ===

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// === DEFAULT CONFIG ===

const defaultConfig: LoggerConfig = {
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  enableConsole: true,
  enableStorage: true,
  enableRemote: false,
  maxStoredLogs: 1000,
  batchSize: 10,
  flushInterval: 30000, // 30 seconds
  includeStack: true,
  includeUserAgent: true,
  includeUrl: true,
  categories: [],
  filters: [],
};

// === LOGGING SERVICE ===

class LoggingService {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private transports: LogTransport[] = [];
  private sessionId: string;
  private batchQueue: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.sessionId = this.generateSessionId();
    this.setupDefaultTransports();
    this.startFlushTimer();
  }

  // === INITIALIZATION ===

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupDefaultTransports(): void {
    // Console transport
    if (this.config.enableConsole) {
      this.addTransport({
        name: 'console',
        log: (entry: LogEntry) => {
          const method = entry.level === 'debug' ? 'debug' :
                        entry.level === 'info' ? 'info' :
                        entry.level === 'warn' ? 'warn' :
                        'error';
          
          const timestamp = new Date(entry.timestamp).toISOString();
          const prefix = `[${timestamp}] ${entry.level.toUpperCase()}${entry.category ? ` [${entry.category}]` : ''}:`;
          
          if (entry.data) {
            console[method](prefix, entry.message, entry.data);
          } else {
            console[method](prefix, entry.message);
          }
          
          if (entry.stack && (entry.level === 'error' || entry.level === 'fatal')) {
            console.error(entry.stack);
          }
        },
      });
    }

    // LocalStorage transport
    if (this.config.enableStorage) {
      this.addTransport({
        name: 'localStorage',
        log: (entry: LogEntry) => {
          this.storeLog(entry);
        },
        flush: async () => {
          this.pruneStoredLogs();
        },
      });
    }

    // Remote transport
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.addTransport({
        name: 'remote',
        log: (entry: LogEntry) => {
          this.batchQueue.push(entry);
          if (this.batchQueue.length >= this.config.batchSize) {
            this.flushRemoteLogs();
          }
        },
        flush: async () => {
          await this.flushRemoteLogs();
        },
      });
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  // === CORE LOGGING METHODS ===

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: any,
    category?: string
  ): LogEntry {
    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      message,
      category,
      data,
      sessionId: this.sessionId,
      environment: process.env.NODE_ENV as any || 'development',
    };

    // Add stack trace for errors
    if (this.config.includeStack && (level === 'error' || level === 'fatal')) {
      entry.stack = new Error().stack;
    }

    // Add URL
    if (this.config.includeUrl && typeof window !== 'undefined') {
      entry.url = window.location.href;
    }

    // Add user agent
    if (this.config.includeUserAgent && typeof navigator !== 'undefined') {
      entry.userAgent = navigator.userAgent;
    }

    // Add build version if available
    if (process.env.REACT_APP_VERSION) {
      entry.buildVersion = process.env.REACT_APP_VERSION;
    }

    return entry;
  }

  private async processLog(entry: LogEntry): Promise<void> {
    // Apply filters
    const shouldFilter = this.config.filters.some(filter => !filter.condition(entry));
    if (shouldFilter) return;

    // Apply category filter
    if (this.config.categories.length > 0 && entry.category) {
      const categoryAllowed = this.config.categories.includes(entry.category);
      if (!categoryAllowed) return;
    }

    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.config.maxStoredLogs) {
      this.logs.shift();
    }

    // Send to transports
    await Promise.all(
      this.transports.map(async (transport) => {
        try {
          await transport.log(entry);
        } catch (error) {
          console.error(`Transport ${transport.name} failed:`, error);
        }
      })
    );
  }

  // === PUBLIC LOGGING METHODS ===

  debug(message: string, data?: any, category?: string): void {
    if (!this.shouldLog('debug')) return;
    const entry = this.createLogEntry('debug', message, data, category);
    this.processLog(entry);
  }

  info(message: string, data?: any, category?: string): void {
    if (!this.shouldLog('info')) return;
    const entry = this.createLogEntry('info', message, data, category);
    this.processLog(entry);
  }

  warn(message: string, data?: any, category?: string): void {
    if (!this.shouldLog('warn')) return;
    const entry = this.createLogEntry('warn', message, data, category);
    this.processLog(entry);
  }

  error(message: string, error?: Error | any, category?: string): void {
    if (!this.shouldLog('error')) return;
    
    let errorData = error;
    if (error instanceof Error) {
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    
    const entry = this.createLogEntry('error', message, errorData, category);
    this.processLog(entry);
  }

  fatal(message: string, error?: Error | any, category?: string): void {
    if (!this.shouldLog('fatal')) return;
    
    let errorData = error;
    if (error instanceof Error) {
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    
    const entry = this.createLogEntry('fatal', message, errorData, category);
    this.processLog(entry);
  }

  // === SPECIALIZED LOGGING METHODS ===

  logUserAction(action: string, data?: any): void {
    this.info(`User action: ${action}`, data, 'user-action');
  }

  logPerformance(operation: string, duration: number, data?: any): void {
    this.info(`Performance: ${operation} took ${duration}ms`, { duration, ...data }, 'performance');
  }

  logApiCall(method: string, url: string, duration: number, status?: number, error?: any): void {
    const level = error ? 'error' : status && status >= 400 ? 'warn' : 'info';
    const message = `API ${method} ${url} - ${status || 'failed'} (${duration}ms)`;
    
    this[level](message, {
      method,
      url,
      duration,
      status,
      error,
    }, 'api');
  }

  logFileOperation(operation: string, filePath: string, success: boolean, error?: any): void {
    const level = success ? 'info' : 'error';
    const message = `File ${operation}: ${filePath} ${success ? 'succeeded' : 'failed'}`;
    
    this[level](message, {
      operation,
      filePath,
      success,
      error,
    }, 'file-operation');
  }

  // === TRANSPORT MANAGEMENT ===

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  removeTransport(name: string): void {
    this.transports = this.transports.filter(t => t.name !== name);
  }

  // === STORAGE MANAGEMENT ===

  private storeLog(entry: LogEntry): void {
    try {
      const storageKey = 'gtdspace-logs';
      const stored = localStorage.getItem(storageKey);
      const logs = stored ? JSON.parse(stored) : [];
      
      logs.push(entry);
      
      // Keep only recent logs
      if (logs.length > this.config.maxStoredLogs) {
        logs.splice(0, logs.length - this.config.maxStoredLogs);
      }
      
      localStorage.setItem(storageKey, JSON.stringify(logs));
    } catch (error) {
      console.warn('Failed to store log to localStorage:', error);
    }
  }

  private pruneStoredLogs(): void {
    try {
      const storageKey = 'gtdspace-logs';
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const logs = JSON.parse(stored);
        if (logs.length > this.config.maxStoredLogs) {
          const pruned = logs.slice(-this.config.maxStoredLogs);
          localStorage.setItem(storageKey, JSON.stringify(pruned));
        }
      }
    } catch (error) {
      console.warn('Failed to prune stored logs:', error);
    }
  }

  getStoredLogs(): LogEntry[] {
    try {
      const storageKey = 'gtdspace-logs';
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn('Failed to retrieve stored logs:', error);
      return [];
    }
  }

  clearStoredLogs(): void {
    try {
      localStorage.removeItem('gtdspace-logs');
    } catch (error) {
      console.warn('Failed to clear stored logs:', error);
    }
  }

  // === REMOTE LOGGING ===

  private async flushRemoteLogs(): Promise<void> {
    if (this.batchQueue.length === 0 || !this.config.remoteEndpoint) return;

    const logsToSend = [...this.batchQueue];
    this.batchQueue = [];

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          sessionId: this.sessionId,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('Failed to send logs to remote endpoint:', error);
      // Re-queue failed logs
      this.batchQueue.unshift(...logsToSend);
    }
  }

  // === UTILITY METHODS ===

  flush(): void {
    this.transports.forEach(async (transport) => {
      if (transport.flush) {
        try {
          await transport.flush();
        } catch (error) {
          console.error(`Transport ${transport.name} flush failed:`, error);
        }
      }
    });
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Restart flush timer if interval changed
    if (updates.flushInterval) {
      this.startFlushTimer();
    }
  }

  getLogs(filter?: {
    level?: LogLevel;
    category?: string;
    since?: number;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter) {
      if (filter.level) {
        filtered = filtered.filter(log => log.level === filter.level);
      }
      if (filter.category) {
        filtered = filtered.filter(log => log.category === filter.category);
      }
      if (filter.since) {
        filtered = filtered.filter(log => log.timestamp >= filter.since!);
      }
      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'category', 'message', 'data'];
      const rows = this.logs.map(log => [
        new Date(log.timestamp).toISOString(),
        log.level,
        log.category || '',
        `"${log.message.replace(/"/g, '""')}"`,
        log.data ? `"${JSON.stringify(log.data).replace(/"/g, '""')}"` : '',
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    return JSON.stringify(this.logs, null, 2);
  }

  // === CLEANUP ===

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

// === GLOBAL LOGGER INSTANCE ===

export const logger = new LoggingService();

// === ERROR BOUNDARY INTEGRATION ===

export const logError = (error: Error, errorInfo?: { componentStack: string }) => {
  logger.error('React Error Boundary caught an error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    componentStack: errorInfo?.componentStack,
  }, 'react-error');
};

// === UNHANDLED ERROR HANDLERS ===

if (typeof window !== 'undefined') {
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      reason: event.reason,
      promise: event.promise,
    }, 'unhandled-rejection');
  });

  // Catch unhandled errors
  window.addEventListener('error', (event) => {
    logger.error('Unhandled error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    }, 'unhandled-error');
  });
}

export default LoggingService;