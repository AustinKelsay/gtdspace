import { safeInvoke } from '@/utils/safe-invoke';
import type { GoogleCalendarEvent } from '@/types/google-calendar';

export const GOOGLE_CALENDAR_EVENTS_KEY = 'google-calendar-events';
export const GOOGLE_CALENDAR_LAST_SYNC_KEY = 'google-calendar-last-sync';
export const GOOGLE_CALENDAR_AUTO_SYNC_KEY = 'google-calendar-auto-sync-enabled';
export const GOOGLE_CALENDAR_SYNC_EVENT = 'google-calendar-synced';
export const GOOGLE_CALENDAR_AUTO_SYNC_EVENT = 'google-calendar-auto-sync-changed';
export const DEFAULT_GOOGLE_AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const isBrowser = () => typeof window !== 'undefined';

const getLocalStorage = () => {
  if (!isBrowser()) return null;
  try {
    return window.localStorage;
  } catch (error) {
    console.warn('[GoogleCalendar] localStorage unavailable:', error);
    return null;
  }
};

export function persistGoogleCalendarEvents(events: GoogleCalendarEvent[] | null): string | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  if (!events) {
    storage.removeItem(GOOGLE_CALENDAR_EVENTS_KEY);
    storage.removeItem(GOOGLE_CALENDAR_LAST_SYNC_KEY);
    return null;
  }

  storage.setItem(GOOGLE_CALENDAR_EVENTS_KEY, JSON.stringify(events));
  const timestamp = new Date().toISOString();
  storage.setItem(GOOGLE_CALENDAR_LAST_SYNC_KEY, timestamp);
  if (isBrowser()) {
    window.dispatchEvent(
      new CustomEvent(GOOGLE_CALENDAR_SYNC_EVENT, { detail: events })
    );
  }
  return timestamp;
}

export function getLastGoogleCalendarSync(): string | null {
  const storage = getLocalStorage();
  return storage?.getItem(GOOGLE_CALENDAR_LAST_SYNC_KEY) ?? null;
}

export function getAutoSyncPreference(defaultValue = true): boolean {
  const storage = getLocalStorage();
  if (!storage) return defaultValue;
  const value = storage.getItem(GOOGLE_CALENDAR_AUTO_SYNC_KEY);
  if (value === null) return defaultValue;
  return value === 'true';
}

export function setAutoSyncPreference(enabled: boolean): void {
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.setItem(GOOGLE_CALENDAR_AUTO_SYNC_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.warn('[GoogleCalendar] Failed to persist auto-sync preference:', error);
    }
  }
  if (isBrowser()) {
    window.dispatchEvent(
      new CustomEvent(GOOGLE_CALENDAR_AUTO_SYNC_EVENT, { detail: enabled })
    );
  }
}

export interface GoogleCalendarSyncResult {
  events: GoogleCalendarEvent[];
  timestamp: string;
}

export async function syncGoogleCalendarEvents(
  command: 'google_calendar_sync' | 'google_calendar_fetch_events' = 'google_calendar_sync'
): Promise<GoogleCalendarSyncResult | null> {
  const events = await safeInvoke<GoogleCalendarEvent[]>(command, undefined, null);
  if (Array.isArray(events)) {
    const timestamp =
      persistGoogleCalendarEvents(events) ?? new Date().toISOString();
    return { events, timestamp };
  }
  return null;
}
