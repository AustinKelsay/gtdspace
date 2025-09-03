/**
 * Tauri-specific utilities
 */

// Determine whether verbose debug logging should be enabled
const isDebugLoggingEnabled = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

/**
 * Wait for Tauri to be ready
 */
export const waitForTauriReady = async (): Promise<void> => {
  // Check if we're in Tauri context using the async method
  const inTauriContext = await checkTauriContextAsync();
  if (!inTauriContext) {
    console.warn('Not in Tauri context, skipping Tauri initialization');
  }
  // Return immediately - Tauri should already be ready when the app loads
  return Promise.resolve();
};

// Cache the Tauri context check result
let tauriContextCache: boolean | null = null;
let tauriCheckPromise: Promise<boolean> | null = null;

/**
 * Check if running in Tauri context (synchronous - uses cached result)
 * On first call, returns false and triggers async check in background
 * Subsequent calls return the cached result
 */
export const isTauriContext = (): boolean => {
  // If we have a cached result, return it
  if (tauriContextCache !== null) {
    return tauriContextCache;
  }

  // Start async check if not already in progress
  if (!tauriCheckPromise) {
    checkTauriContextAsync();
  }

  // Return false on first call (safe default)
  return false;
};

/**
 * Check if running in Tauri context (asynchronous - always checks)
 * Use this for initial checks where you can wait for the result
 */
export const checkTauriContextAsync = async (): Promise<boolean> => {
  // If already checking, wait for that result
  if (tauriCheckPromise) {
    return tauriCheckPromise;
  }

  // Create the check promise
  tauriCheckPromise = (async () => {
    // Timeout helper
    const timeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`[checkTauriContextAsync] API call timed out after ${ms}ms`));
        }, ms);

        promise
          .then((value) => {
            clearTimeout(timer);
            resolve(value);
          })
          .catch((err) => {
            clearTimeout(timer);
            reject(err);
          });
      });
    };

    try {
      // Use a stable Tauri API call with a timeout
      const { getVersion } = await import('@tauri-apps/api/app');
      const appVersion = await timeout(getVersion(), 2000); // 2-second timeout

      if (isDebugLoggingEnabled) {
        console.log(`[checkTauriContextAsync] Successfully called getVersion(), version: ${appVersion} - in Tauri context`);
      }

      tauriContextCache = true;
      return true;
    } catch (error) {
      if (isDebugLoggingEnabled) {
        console.log('[checkTauriContextAsync] Failed to call getVersion() - not in Tauri context or timed out', error);
      }

      tauriContextCache = false;
      return false;
    }
  })();

  return tauriCheckPromise;
};

/**
 * Get the cached Tauri context status (for debugging)
 * Returns null if not yet checked, true/false if checked
 */
export const getTauriContextStatus = (): boolean | null => {
  return tauriContextCache;
};

/**
 * Reset the Tauri context cache (useful for testing)
 * Forces the next check to re-detect Tauri context
 */
export const resetTauriContext = (): void => {
  tauriContextCache = null;
  tauriCheckPromise = null;
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
  const inTauri = await checkTauriContextAsync();
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