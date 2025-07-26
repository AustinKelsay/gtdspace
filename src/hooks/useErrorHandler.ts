/**
 * @fileoverview React hook for error handling and user notifications
 * @author Development Team
 * @created 2024-01-XX
 */

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

// === TYPES ===
/**
 * Error handler hook return type
 */
export interface UseErrorHandlerReturn {
  /** Report a new error */
  reportError: (message: string, details?: string) => void;
  /** Wrapper for operations with error handling */
  withErrorHandling: <T>(
    operation: () => Promise<T>,
    errorMessage?: string,
    category?: string
  ) => Promise<T | null>;
}

/**
 * Error handler options
 */
export interface UseErrorHandlerOptions {
  /** Whether to log errors to console */
  logToConsole?: boolean;
}

/**
 * Hook for simplified error handling
 * 
 * Provides basic error reporting via toast notifications
 * and error wrapping for async operations.
 * 
 * @param options - Error handler options
 * @returns Error handler utilities
 */
export function useErrorHandler(
  options: UseErrorHandlerOptions = {}
): UseErrorHandlerReturn {
  const { logToConsole = true } = options;
  const { toast } = useToast();

  /**
   * Report an error to the user
   */
  const reportError = useCallback((message: string, details?: string) => {
    if (logToConsole) {
      console.error('Error:', message, details);
    }

    toast({
      title: 'Error',
      description: message,
      variant: 'destructive',
    });
  }, [toast, logToConsole]);

  /**
   * Wrap an async operation with error handling
   */
  const withErrorHandling = useCallback(async <T,>(
    operation: () => Promise<T>,
    errorMessage: string = 'An error occurred',
    category?: string
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : errorMessage;
      reportError(message, category);
      return null;
    }
  }, [reportError]);

  return {
    reportError,
    withErrorHandling,
  };
}