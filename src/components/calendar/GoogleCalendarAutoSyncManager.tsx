import React, { useCallback, useEffect, useRef, useState } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import type { GoogleCalendarSyncStatus } from '@/types/google-calendar';
import {
  DEFAULT_GOOGLE_AUTO_SYNC_INTERVAL_MS,
  getAutoSyncPreference,
  GOOGLE_CALENDAR_AUTO_SYNC_EVENT,
  syncGoogleCalendarEvents,
} from '@/utils/google-calendar';

type AutoSyncReason = 'initial' | 'interval' | 'visibility';

const isBrowser = () => typeof window !== 'undefined';

export const GoogleCalendarAutoSyncManager: React.FC = () => {
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => getAutoSyncPreference());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncInFlightRef = useRef(false);

  const runSync = useCallback(
    async (reason: AutoSyncReason) => {
      if (!autoSyncEnabled) return;
      if (syncInFlightRef.current) return;
      if (typeof document !== 'undefined' && document.hidden && reason === 'interval') {
        return;
      }

      syncInFlightRef.current = true;
      try {
        const status = await safeInvoke<GoogleCalendarSyncStatus>(
          'google_calendar_get_status',
          undefined,
          null
        );

        if (!status?.is_connected || status.sync_in_progress) {
          return;
        }

        const result = await syncGoogleCalendarEvents();
        if (!result) {
          console.warn('[GoogleCalendarAutoSync] Sync skipped:', reason, '(invoke unavailable)');
        } else {
          console.info(
            '[GoogleCalendarAutoSync] Synced events',
            { reason, count: result.events.length }
          );
        }
      } catch (error) {
        console.warn('[GoogleCalendarAutoSync] Sync failed:', reason, error);
      } finally {
        syncInFlightRef.current = false;
      }
    },
    [autoSyncEnabled]
  );

  useEffect(() => {
    if (!isBrowser()) return undefined;

    const handlePreferenceChange = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      if (typeof detail === 'boolean') {
        setAutoSyncEnabled(detail);
      }
    };

    window.addEventListener(
      GOOGLE_CALENDAR_AUTO_SYNC_EVENT,
      handlePreferenceChange as EventListener
    );

    return () => {
      window.removeEventListener(
        GOOGLE_CALENDAR_AUTO_SYNC_EVENT,
        handlePreferenceChange as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (!autoSyncEnabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    void runSync('initial');

    timerRef.current = setInterval(() => {
      void runSync('interval');
    }, DEFAULT_GOOGLE_AUTO_SYNC_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoSyncEnabled, runSync]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handleVisibility = () => {
      if (!document.hidden) {
        void runSync('visibility');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [runSync]);

  return null;
};

export default GoogleCalendarAutoSyncManager;
