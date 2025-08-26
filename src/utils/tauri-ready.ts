/**
 * Tauri-specific utilities
 */

// Determine whether verbose debug logging should be enabled
const isDebugLoggingEnabled = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

/**
 * Wait for Tauri to be ready
 */
export const waitForTauriReady = async (): Promise<void> => {
  // Simply check if we're in Tauri context
  // If not, this might be a dev environment without Tauri
  if (!isTauriContext()) {
    console.warn('Not in Tauri context, skipping Tauri initialization');
  }
  // Return immediately - Tauri should already be ready when the app loads
  return Promise.resolve();
};

/**
 * Check if running in Tauri context
 */
export const isTauriContext = (): boolean => {
  if (isDebugLoggingEnabled) {
    console.log('[isTauriContext] Checking Tauri context...');
    console.log('[isTauriContext] window defined?', typeof window !== 'undefined');
    console.log('[isTauriContext] window.__TAURI__ exists?', typeof window !== 'undefined' && '__TAURI__' in window);
    if (typeof window !== 'undefined') {
      console.log('[isTauriContext] window.__TAURI__ value:', (window as unknown as { __TAURI__?: unknown }).__TAURI__);
      console.log('[isTauriContext] window keys:', Object.keys(window).filter(k => k.includes('TAURI')));
    }
  }
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

/**
 * Open a dialog with timeout to prevent hanging
 */
export const openDialogWithTimeout = async (options: {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}, timeoutMs: number = 10000): Promise<string | null> => {
  console.log('[openDialogWithTimeout] Starting with options:', options);
  
  // Check but don't fail - let's see what happens
  const inTauri = isTauriContext();
  if (!inTauri) {
    console.warn('[openDialogWithTimeout] WARNING: Not detecting Tauri context, but trying anyway...');
    // Don't throw - let's try to import and use the dialog anyway
  }

  console.log('[openDialogWithTimeout] Importing dialog plugin...');
  const { open } = await import('@tauri-apps/plugin-dialog');
  console.log('[openDialogWithTimeout] Dialog plugin imported, open function:', typeof open);
  
  return new Promise((resolve, reject) => {
    let resolved = false;

    // Set up timeout
    console.log('[openDialogWithTimeout] Setting up timeout for', timeoutMs, 'ms');
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        console.error('[openDialogWithTimeout] Dialog timed out after', timeoutMs, 'ms');
        resolved = true;
        reject(new Error(`Dialog timeout after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    // Call the dialog
    console.log('[openDialogWithTimeout] Calling open() function...');
    open(options)
      .then((result) => {
        console.log('[openDialogWithTimeout] Dialog resolved with result:', result);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          // Ensure we return a string or null, not an array
          if (Array.isArray(result)) {
            resolve(result[0] || null);
          } else {
            resolve(result as string | null);
          }
        }
      })
      .catch((error) => {
        console.error('[openDialogWithTimeout] Dialog rejected with error:', error);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          reject(error);
        }
      });
  });
};