/**
 * @fileoverview Safe wrapper around Tauri's `invoke` that gracefully handles
 * non-Tauri environments and invocation failures by returning a fallback value
 * instead of throwing. This prevents UI crashes when running in the browser or
 * when native APIs are unavailable.
 */

import { checkTauriContextAsync } from '@/utils/tauri-ready';
import { createScopedLogger } from '@/utils/logger';

const log = createScopedLogger('safeInvoke');

/**
 * Safely invoke a Tauri command.
 *
 * - If not running under Tauri, returns the provided fallback (or null).
 * - If running under Tauri, calls the command and returns its result.
 * - If the call throws, logs and returns the fallback (or null).
 *
 * Prefer using this wrapper for commands that may be called during app init
 * or in contexts where the app could be running outside Tauri (e.g. web dev).
 *
 * @param command Tauri command name
 * @param args Optional arguments to pass to the command
 * @param fallback Optional fallback value when not in Tauri or on failure
 * @returns Result of the command, or fallback/null when unavailable
 */
export async function safeInvoke<T>(
  command: string,
  args?: unknown,
  fallback?: T | null
): Promise<T | null> {
  try {
    const inTauri = await checkTauriContextAsync();
    if (!inTauri) {
      return (fallback ?? null) as T | null;
    }

    const core = await import('@tauri-apps/api/core');
    const result = await core.invoke<T>(command, args as Record<string, unknown>);
    return (result ?? (fallback ?? null)) as T | null;
  } catch (error) {
    log.warnOnce(command, 'Command failed', { command, error });
    return (fallback ?? null) as T | null;
  }
}






