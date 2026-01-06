import React, { useCallback, useRef } from 'react';
import { useToast as useShadcnToast } from '@/hooks/use-toast';

// Store for deduplication
const recentToasts = new Map<string, number>();
const DEDUP_WINDOW_MS = 100; // 100ms window to catch React StrictMode duplicates

/**
 * Hook for showing toast notifications
 * 
 * Provides a consistent interface for showing success, error, info, and warning messages
 * This is a wrapper around the shadcn/ui toast system that provides convenience methods
 * 
 * Includes deduplication to prevent duplicate toasts in React StrictMode
 */
export function useToast() {
  const { toast, dismiss: dismissFromHook, toasts } = useShadcnToast();
  const toastTimerRef = useRef<NodeJS.Timeout>();

  // Clean up old entries periodically
  const cleanupOldToasts = useCallback(() => {
    const now = Date.now();
    for (const [key, timestamp] of recentToasts.entries()) {
      if (now - timestamp > DEDUP_WINDOW_MS * 2) {
        recentToasts.delete(key);
      }
    }
  }, []);

  // Check if we should show a toast (deduplication logic)
  const shouldShowToast = useCallback((key: string): boolean => {
    const now = Date.now();
    const lastShown = recentToasts.get(key);
    
    if (lastShown && now - lastShown < DEDUP_WINDOW_MS) {
      return false; // Duplicate within window
    }
    
    recentToasts.set(key, now);
    
    // Schedule cleanup
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(cleanupOldToasts, DEDUP_WINDOW_MS * 3);
    
    return true;
  }, [cleanupOldToasts]);

  /**
   * Show a success toast
   */
  const showSuccess = useCallback((message: string) => {
    const key = `success:${message}`;
    if (!shouldShowToast(key)) return;
    
    toast({
      title: 'Success',
      description: message,
    });
  }, [toast, shouldShowToast]);

  /**
   * Show an error toast
   */
  const showError = useCallback((message: string) => {
    const key = `error:${message}`;
    if (!shouldShowToast(key)) return;
    
    toast({
      title: 'Error',
      description: message,
      variant: 'destructive',
    });
  }, [toast, shouldShowToast]);

  /**
   * Show an info toast
   */
  const showInfo = useCallback((message: string) => {
    const key = `info:${message}`;
    if (!shouldShowToast(key)) return;
    
    toast({
      title: 'Info',
      description: message,
    });
  }, [toast, shouldShowToast]);

  /**
   * Show a warning toast
   */
  const showWarning = useCallback((message: string) => {
    const key = `warning:${message}`;
    if (!shouldShowToast(key)) return;
    
    toast({
      title: 'Warning',
      description: message,
    });
  }, [toast, shouldShowToast]);

  /**
   * Show a loading toast that can be updated
   * Note: The shadcn toast system doesn't have a built-in loading state,
   * so we return a toast with a loading message that can be dismissed
   */
  const showLoading = useCallback((message: string) => {
    const key = `loading:${message}`;
    if (!shouldShowToast(key)) {
      return {
        id: '',
        dismiss: () => {},
      };
    }
    
    const { id, dismiss } = toast({
      title: 'Loading',
      description: message,
    });
    
    return {
      id,
      dismiss: () => dismiss(),
    };
  }, [toast, shouldShowToast]);

  /**
   * Dismiss a specific toast or all toasts
   */
  const dismiss = useCallback((toastId?: string) => {
    if (toastId) {
      // The shadcn toast system handles dismissal through the dismiss function returned by toast()
      // For compatibility, we'll need to track toasts or use the global dismiss
      dismissFromHook(toastId);
    } else {
      // Dismiss all toasts
      dismissFromHook();
    }
  }, [dismissFromHook]);

  /**
   * Show a file modified notification
   *
   * Optionally includes an action to reload the file content from disk.
   */
  const showFileModified = useCallback(
    (fileName: string, options?: { onReload?: () => void }) => {
      const key = `file-modified:${fileName}`;
      if (!shouldShowToast(key)) return;

      const action =
        options?.onReload
          ? React.createElement(
              'button',
              {
                type: 'button',
                className:
                  'ml-4 inline-flex items-center rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm hover:bg-accent',
                onClick: options.onReload,
              },
              'Reload file'
            )
          : undefined;

      toast({
        title: 'Warning',
        description: `"${fileName}" was modified externally`,
        action,
      });
    },
    [toast, shouldShowToast]
  );

  /**
   * Show a file deleted notification
   */
  const showFileDeleted = useCallback((fileName: string) => {
    const key = `file-deleted:${fileName}`;
    if (!shouldShowToast(key)) return;

    toast({
      title: 'Warning',
      description: `"${fileName}" was deleted`,
    });
  }, [toast, shouldShowToast]);

  /**
   * Show a file created notification
   */
  const showFileCreated = useCallback((fileName: string) => {
    const key = `file-created:${fileName}`;
    if (!shouldShowToast(key)) return;

    toast({
      title: 'Info',
      description: `New file "${fileName}" was created`,
    });
  }, [toast, shouldShowToast]);

  return {
    toasts,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showLoading,
    dismiss,
    showFileModified,
    showFileDeleted,
    showFileCreated,
  };
}

// Re-export for convenience
export { useToast as useShadcnToast };
