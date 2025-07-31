import { useCallback } from 'react';
import { useToast as useShadcnToast } from '@/hooks/use-toast';

/**
 * Hook for showing toast notifications
 * 
 * Provides a consistent interface for showing success, error, info, and warning messages
 * This is a wrapper around the shadcn/ui toast system that provides convenience methods
 */
export function useToast() {
  const { toast, dismiss: dismissFromHook } = useShadcnToast();

  /**
   * Show a success toast
   */
  const showSuccess = useCallback((message: string) => {
    toast({
      title: 'Success',
      description: message,
    });
  }, [toast]);

  /**
   * Show an error toast
   */
  const showError = useCallback((message: string) => {
    toast({
      title: 'Error',
      description: message,
      variant: 'destructive',
    });
  }, [toast]);

  /**
   * Show an info toast
   */
  const showInfo = useCallback((message: string) => {
    toast({
      title: 'Info',
      description: message,
    });
  }, [toast]);

  /**
   * Show a warning toast
   */
  const showWarning = useCallback((message: string) => {
    toast({
      title: 'Warning',
      description: message,
    });
  }, [toast]);

  /**
   * Show a loading toast that can be updated
   * Note: The shadcn toast system doesn't have a built-in loading state,
   * so we return a toast with a loading message that can be dismissed
   */
  const showLoading = useCallback((message: string) => {
    const { id, dismiss } = toast({
      title: 'Loading',
      description: message,
    });
    
    return {
      id,
      dismiss: () => dismiss(),
    };
  }, [toast]);

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

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showLoading,
    dismiss,
  };
}