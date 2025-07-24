/**
 * @fileoverview React hook for error handling and user notifications
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Error handling and user guidance
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppError, ErrorCategory, ErrorSeverity } from '@/components/error-handling/ErrorDialog';
import { getErrorManager, ErrorListener, ErrorResolutionListener } from '@/services/ErrorManager';

// === TYPES ===
/**
 * Error handler hook return type
 */
export interface UseErrorHandlerReturn {
  /** Current active error being displayed */
  currentError: AppError | null;
  /** All unresolved errors */
  errors: AppError[];
  /** Whether error dialog is open */
  isErrorDialogOpen: boolean;
  /** Show specific error in dialog */
  showError: (error: AppError) => void;
  /** Close error dialog */
  closeErrorDialog: () => void;
  /** Report a new error */
  reportError: (
    message: string,
    category?: ErrorCategory,
    severity?: ErrorSeverity,
    details?: string,
    filePath?: string
  ) => AppError;
  /** Resolve an error */
  resolveError: (errorId: string) => void;
  /** Clear all errors */
  clearErrors: () => void;
  /** Retry operation with error handling */
  withErrorHandling: <T>(
    operation: () => Promise<T>,
    errorMessage?: string,
    category?: ErrorCategory
  ) => Promise<T | null>;
}

/**
 * Error handler options
 */
export interface UseErrorHandlerOptions {
  /** Whether to automatically show error dialog for new errors */
  autoShowDialog?: boolean;
  /** Error severities that should auto-show dialog */
  autoShowSeverities?: ErrorSeverity[];
  /** Maximum number of errors to keep in state */
  maxErrors?: number;
  /** Whether to automatically clear resolved errors */
  autoClearResolved?: boolean;
}

// === CONSTANTS ===
/**
 * Default error handler options
 */
const DEFAULT_OPTIONS: UseErrorHandlerOptions = {
  autoShowDialog: true,
  autoShowSeverities: ['medium', 'high', 'critical'],
  maxErrors: 10,
  autoClearResolved: true,
};

// === HOOK IMPLEMENTATION ===
/**
 * React hook for error handling and user notifications
 * 
 * Provides a comprehensive error handling interface for React components,
 * including error reporting, dialog management, and automatic error recovery.
 * 
 * @param options - Configuration options for error handling behavior
 * @returns Object with error handling functions and state
 * 
 * @example
 * ```typescript
 * const { reportError, withErrorHandling, isErrorDialogOpen, closeErrorDialog } = useErrorHandler({
 *   autoShowDialog: true,
 *   autoShowSeverities: ['high', 'critical']
 * });
 * 
 * // Report an error manually
 * const handleFileError = () => {
 *   reportError(
 *     'Failed to save file',
 *     'file_operation',
 *     'high',
 *     'Permission denied',
 *     '/path/to/file.md'
 *   );
 * };
 * 
 * // Wrap operation with error handling
 * const handleSaveFile = async () => {
 *   const result = await withErrorHandling(
 *     () => saveFileToSystem(),
 *     'Failed to save file',
 *     'file_operation'
 *   );
 * };
 * ```
 */
export const useErrorHandler = (options: UseErrorHandlerOptions = {}): UseErrorHandlerReturn => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const errorManager = getErrorManager();
  
  // State
  const [errors, setErrors] = useState<AppError[]>([]);
  const [currentError, setCurrentError] = useState<AppError | null>(null);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  
  // Refs for cleanup
  const errorListenerRef = useRef<(() => void) | null>(null);
  const resolutionListenerRef = useRef<(() => void) | null>(null);

  // Initialize error listeners
  useEffect(() => {
    // Error listener
    const handleNewError: ErrorListener = (error: AppError) => {
      setErrors(prev => {
        const newErrors = [error, ...prev.filter(e => e.id !== error.id)];
        return newErrors.slice(0, config.maxErrors!);
      });

      // Auto-show dialog for qualifying errors
      if (
        config.autoShowDialog &&
        config.autoShowSeverities!.includes(error.severity)
      ) {
        setCurrentError(error);
        setIsErrorDialogOpen(true);
      }
    };

    // Resolution listener
    const handleErrorResolution: ErrorResolutionListener = (errorId: string) => {
      if (config.autoClearResolved) {
        setErrors(prev => prev.filter(e => e.id !== errorId));
      } else {
        setErrors(prev => prev.map(e => 
          e.id === errorId ? { ...e, recovered: true } : e
        ));
      }

      // Close dialog if current error was resolved
      if (currentError?.id === errorId) {
        setIsErrorDialogOpen(false);
        setCurrentError(null);
      }
    };

    // Subscribe to error manager
    errorListenerRef.current = errorManager.addErrorListener(handleNewError);
    resolutionListenerRef.current = errorManager.addResolutionListener(handleErrorResolution);

    // Load existing unresolved errors
    setErrors(errorManager.getUnresolvedErrors().slice(0, config.maxErrors!));

    // Cleanup function
    return () => {
      errorListenerRef.current?.();
      resolutionListenerRef.current?.();
    };
  }, [config.autoShowDialog, config.autoShowSeverities, config.maxErrors, config.autoClearResolved, currentError?.id, errorManager]);

  /**
   * Show specific error in dialog
   */
  const showError = useCallback((error: AppError) => {
    setCurrentError(error);
    setIsErrorDialogOpen(true);
  }, []);

  /**
   * Close error dialog
   */
  const closeErrorDialog = useCallback(() => {
    setIsErrorDialogOpen(false);
    setCurrentError(null);
  }, []);

  /**
   * Report a new error
   */
  const reportError = useCallback((
    message: string,
    category: ErrorCategory = 'unknown',
    severity: ErrorSeverity = 'medium',
    details?: string,
    filePath?: string
  ): AppError => {
    return errorManager.createError(message, category, severity, details, filePath);
  }, [errorManager]);

  /**
   * Resolve an error
   */
  const resolveError = useCallback((errorId: string) => {
    errorManager.resolveError(errorId);
  }, [errorManager]);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    errorManager.clearErrorHistory();
    setErrors([]);
    setCurrentError(null);
    setIsErrorDialogOpen(false);
  }, [errorManager]);

  /**
   * Wrap operation with error handling
   */
  const withErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    errorMessage: string = 'Operation failed',
    category: ErrorCategory = 'unknown'
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      const errorDetails = error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? error.stack : undefined;
      
      reportError(
        errorMessage,
        category,
        'medium',
        stackTrace || errorDetails
      );
      
      return null;
    }
  }, [reportError]);

  return {
    currentError,
    errors,
    isErrorDialogOpen,
    showError,
    closeErrorDialog,
    reportError,
    resolveError,
    clearErrors,
    withErrorHandling,
  };
};

// === CONVENIENCE HOOKS ===
/**
 * Hook for file operation error handling
 */
export const useFileErrorHandler = () => {
  return useErrorHandler({
    autoShowDialog: true,
    autoShowSeverities: ['medium', 'high', 'critical'],
  });
};

/**
 * Hook for network operation error handling
 */
export const useNetworkErrorHandler = () => {
  return useErrorHandler({
    autoShowDialog: false, // Network errors are often transient
    autoShowSeverities: ['high', 'critical'],
  });
};

/**
 * Hook for validation error handling
 */
export const useValidationErrorHandler = () => {
  return useErrorHandler({
    autoShowDialog: true,
    autoShowSeverities: ['low', 'medium', 'high'],
    autoClearResolved: true,
  });
};

// === EXPORTS ===
export default useErrorHandler;