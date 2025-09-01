/**
 * Fix for ResizeObserver loop limit exceeded error
 * This error is benign and happens when ResizeObserver can't deliver all observations within a single frame
 * See: https://github.com/WICG/resize-observer/issues/38
 */

if (typeof window !== 'undefined') {
  // Store the original error handler
  const originalErrorHandler = window.onerror;

  // Create a debounced error handler that filters out ResizeObserver errors
  window.onerror = function (message, source, lineno, colno, error) {
    // Suppress ResizeObserver errors
    if (message && typeof message === 'string' && message.includes('ResizeObserver loop')) {
      return true; // Prevent the error from being logged
    }
    
    // Call the original error handler if it exists
    if (originalErrorHandler) {
      return originalErrorHandler.call(this, message, source, lineno, colno, error);
    }
    
    return false;
  };

  // Also handle unhandled promise rejections related to ResizeObserver
  window.addEventListener('error', (e) => {
    if (e.message && e.message.includes('ResizeObserver loop')) {
      e.stopPropagation();
      e.preventDefault();
    }
  });

  // Handle unhandled promise rejections for ResizeObserver errors
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason && typeof e.reason.message === 'string' && e.reason.message.includes('ResizeObserver loop')) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
    }
  });
}

export {};