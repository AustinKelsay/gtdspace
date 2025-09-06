/**
 * @fileoverview Hook for scheduling periodic habit checks and resets
 * @author Development Team
 * @created 2025-01-17
 */

import { useEffect, useRef } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { useErrorHandler } from './useErrorHandler';

/**
 * Hook that periodically checks and resets habits based on their frequency
 * Runs every minute to handle auto-reset and backfilling
 */
export const useHabitScheduler = (spacePath: string | null, enabled: boolean = true) => {
  const { withErrorHandling } = useErrorHandler();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<Date>(new Date());

  useEffect(() => {
    if (!spacePath || !enabled) {
      return;
    }

    // Function to check and reset habits
    const checkHabits = async () => {
      
      const result = await withErrorHandling(
        async () => {
          try {
            const resetHabits = await safeInvoke<string[]>('check_and_reset_habits', {
              spacePath: spacePath,
            }, []);
            
            if (resetHabits && resetHabits.length > 0) {
              
              // Emit events for UI refresh
              resetHabits.forEach(habitName => {
                // Emit a custom event to refresh the habit in the UI
                const event = new CustomEvent('habit-reset', {
                  detail: { habitName, spacePath }
                });
                window.dispatchEvent(event);
              });
              
              // Also emit a general refresh event
              const refreshEvent = new CustomEvent('habits-refreshed', {
                detail: { spacePath }
              });
              window.dispatchEvent(refreshEvent);
            }
            
            lastCheckRef.current = new Date();
            return resetHabits;
          } catch (error) {
            console.error('[HabitScheduler] Error checking habits:', error);
            return [];
          }
        },
        'Failed to check habits',
        'habit-scheduler'
      );
      
      return result;
    };

    // Run immediately on mount (for backfilling)
    checkHabits();

    // Set up interval to check every minute (60000ms)
    intervalRef.current = setInterval(() => {
      checkHabits();
    }, 60000); // Check every minute

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [spacePath, enabled, withErrorHandling]);

  return {
    lastCheck: lastCheckRef.current,
  };
};

export default useHabitScheduler;