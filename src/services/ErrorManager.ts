/**
 * @fileoverview Centralized error management service with recovery actions
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Error handling and user guidance
 */

import { AppError, ErrorCategory, ErrorSeverity, RecoveryAction } from '@/components/error-handling/ErrorDialog';

// === TYPES ===
/**
 * Error listener callback interface
 */
export interface ErrorListener {
  /** Callback function for error events */
  (error: AppError): void;
}

/**
 * Error resolution callback interface
 */
export interface ErrorResolutionListener {
  /** Callback function for error resolution events */
  (errorId: string): void;
}

/**
 * Error manager configuration
 */
interface ErrorManagerConfig {
  /** Maximum number of errors to keep in history */
  maxErrorHistory: number;
  /** Whether to automatically retry certain operations */
  autoRetry: boolean;
  /** Maximum number of automatic retries */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
}

/**
 * Operation retry configuration
 */
interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  delay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
  /** Whether to show retry progress to user */
  showProgress: boolean;
}

// === CONSTANTS ===
/**
 * Default error manager configuration
 */
const DEFAULT_CONFIG: ErrorManagerConfig = {
  maxErrorHistory: 50,
  autoRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  delay: 1000,
  backoffMultiplier: 2,
  showProgress: false,
};

/**
 * Error category to recovery action mapping
 */
const CATEGORY_RECOVERY_ACTIONS: Record<ErrorCategory, (error: AppError) => RecoveryAction[]> = {
  file_operation: (error) => [
    {
      id: 'retry_file_operation',
      label: 'Retry',
      description: 'Try the file operation again',
      action: async () => {
        // TODO: Implement file operation retry
        console.log('Retrying file operation for error:', error.id);
      },
      primary: true,
    },
    {
      id: 'refresh_file_list',
      label: 'Refresh Files',
      description: 'Reload the file list',
      action: async () => {
        // TODO: Implement file list refresh
        console.log('Refreshing file list for error:', error.id);
      },
    },
  ],
  permission: (error) => [
    {
      id: 'request_permission',
      label: 'Grant Permission',
      description: 'Request the necessary permissions',
      action: async () => {
        // TODO: Implement permission request
        console.log('Requesting permissions for error:', error.id);
      },
      primary: true,
    },
    {
      id: 'change_folder',
      label: 'Change Folder',
      description: 'Select a different folder',
      action: async () => {
        // TODO: Implement folder selection
        console.log('Changing folder for error:', error.id);
      },
    },
  ],
  network: (error) => [
    {
      id: 'retry_network',
      label: 'Retry',
      description: 'Try the network operation again',
      action: async () => {
        // TODO: Implement network retry
        console.log('Retrying network operation for error:', error.id);
      },
      primary: true,
    },
    {
      id: 'work_offline',
      label: 'Work Offline',
      description: 'Continue working without network features',
      action: async () => {
        // TODO: Implement offline mode
        console.log('Switching to offline mode for error:', error.id);
      },
    },
  ],
  validation: (error) => [
    {
      id: 'fix_input',
      label: 'Fix Input',
      description: 'Correct the input and try again',
      action: async () => {
        // TODO: Implement input correction
        console.log('Fixing input for error:', error.id);
      },
      primary: true,
    },
  ],
  system: (error) => [
    {
      id: 'restart_app',
      label: 'Restart App',
      description: 'Restart the application',
      action: async () => {
        window.location.reload();
      },
      destructive: true,
    },
    {
      id: 'clear_cache',
      label: 'Clear Cache',
      description: 'Clear application cache',
      action: async () => {
        // TODO: Implement cache clearing
        console.log('Clearing cache for error:', error.id);
      },
    },
  ],
  unknown: (_error) => [
    {
      id: 'refresh_page',
      label: 'Refresh',
      description: 'Refresh the application',
      action: async () => {
        window.location.reload();
      },
      primary: true,
    },
  ],
};

// === ERROR MANAGER CLASS ===
/**
 * Centralized error management service
 * 
 * Handles error creation, tracking, recovery actions, and user notifications.
 * Provides automatic retry mechanisms and contextual error recovery.
 */
export class ErrorManager {
  private static instance: ErrorManager | null = null;
  
  private config: ErrorManagerConfig;
  private errorHistory: AppError[] = [];
  private errorListeners: Set<ErrorListener> = new Set();
  private resolutionListeners: Set<ErrorResolutionListener> = new Set();
  private retryAttempts: Map<string, number> = new Map();

  private constructor(config: Partial<ErrorManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get singleton instance of ErrorManager
   */
  public static getInstance(config?: Partial<ErrorManagerConfig>): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager(config);
    }
    return ErrorManager.instance;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create and report an error
   */
  public createError(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    details?: string,
    filePath?: string
  ): AppError {
    const errorId = this.generateErrorId();
    const error: AppError = {
      id: errorId,
      message,
      category,
      severity,
      details,
      filePath,
      timestamp: Date.now(),
      recovered: false,
      recoveryActions: [],
    };
    
    // Add recovery actions after error is created
    error.recoveryActions = CATEGORY_RECOVERY_ACTIONS[category]?.(error) || [];

    this.reportError(error);
    return error;
  }

  /**
   * Report an existing error
   */
  public reportError(error: AppError): void {
    // Add to history
    this.errorHistory.unshift(error);
    
    // Limit history size
    if (this.errorHistory.length > this.config.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(0, this.config.maxErrorHistory);
    }

    // Notify listeners
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error listener failed:', listenerError);
      }
    });

    // Auto-retry if configured
    if (this.config.autoRetry && this.shouldAutoRetry(error)) {
      this.attemptAutoRetry(error);
    }

    // Log error
    console.error('Error reported:', error);
  }

  /**
   * Mark error as resolved
   */
  public resolveError(errorId: string): void {
    const error = this.errorHistory.find(e => e.id === errorId);
    if (error) {
      error.recovered = true;
      this.retryAttempts.delete(errorId);
      
      // Notify resolution listeners
      this.resolutionListeners.forEach(listener => {
        try {
          listener(errorId);
        } catch (listenerError) {
          console.error('Error resolution listener failed:', listenerError);
        }
      });
    }
  }

  /**
   * Check if error should be auto-retried
   */
  private shouldAutoRetry(appError: AppError): boolean {
    const retryableCategories: ErrorCategory[] = ['network', 'file_operation'];
    const retryableSeverities: ErrorSeverity[] = ['low', 'medium'];
    
    return (
      retryableCategories.includes(appError.category) &&
      retryableSeverities.includes(appError.severity) &&
      (this.retryAttempts.get(appError.id) || 0) < this.config.maxRetries
    );
  }

  /**
   * Attempt automatic retry for error
   */
  private async attemptAutoRetry(error: AppError): Promise<void> {
    const currentAttempts = this.retryAttempts.get(error.id) || 0;
    const delay = this.config.retryDelay * Math.pow(2, currentAttempts);
    
    this.retryAttempts.set(error.id, currentAttempts + 1);
    
    setTimeout(async () => {
      try {
        // Find and execute primary recovery action
        const primaryAction = error.recoveryActions?.find(action => action.primary);
        if (primaryAction) {
          await primaryAction.action();
          this.resolveError(error.id);
        }
      } catch (retryError) {
        console.error('Auto-retry failed:', retryError);
        // If max retries reached, stop auto-retrying
        if (currentAttempts + 1 >= this.config.maxRetries) {
          this.retryAttempts.delete(error.id);
        }
      }
    }, delay);
  }

  /**
   * Retry operation with custom configuration
   */
  public async retryOperation<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retryConfig.maxRetries) {
          break;
        }
        
        // Wait before retry
        const delay = retryConfig.delay * Math.pow(retryConfig.backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Add error listener
   */
  public addErrorListener(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  /**
   * Add error resolution listener
   */
  public addResolutionListener(listener: ErrorResolutionListener): () => void {
    this.resolutionListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.resolutionListeners.delete(listener);
    };
  }

  /**
   * Get error history
   */
  public getErrorHistory(): readonly AppError[] {
    return [...this.errorHistory];
  }

  /**
   * Get unresolved errors
   */
  public getUnresolvedErrors(): AppError[] {
    return this.errorHistory.filter(error => !error.recovered);
  }

  /**
   * Clear error history
   */
  public clearErrorHistory(): void {
    this.errorHistory = [];
    this.retryAttempts.clear();
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): {
    total: number;
    unresolved: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
  } {
    const byCategory = this.errorHistory.reduce((acc, error) => {
      acc[error.category] = (acc[error.category] || 0) + 1;
      return acc;
    }, {} as Record<ErrorCategory, number>);
    
    const bySeverity = this.errorHistory.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<ErrorSeverity, number>);
    
    return {
      total: this.errorHistory.length,
      unresolved: this.getUnresolvedErrors().length,
      byCategory,
      bySeverity,
    };
  }
}

// === CONVENIENCE FUNCTIONS ===
/**
 * Get global error manager instance
 */
export const getErrorManager = (): ErrorManager => {
  return ErrorManager.getInstance();
};

/**
 * Quick error reporting function
 */
export const reportError = (
  message: string,
  category: ErrorCategory = 'unknown',
  severity: ErrorSeverity = 'medium',
  details?: string,
  filePath?: string
): AppError => {
  return getErrorManager().createError(message, category, severity, details, filePath);
};

/**
 * Quick error resolution function
 */
export const resolveError = (errorId: string): void => {
  getErrorManager().resolveError(errorId);
};

// === EXPORTS ===
export default ErrorManager;