/**
 * @fileoverview Hook for managing habit tracking and status updates
 * @author Development Team
 * @created 2025-01-13
 */

import { useCallback } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { emitMetadataChange } from '@/utils/content-event-bus';
import { norm } from '@/utils/path';
import { useErrorHandler } from './useErrorHandler';
import { useToast } from './useToast';

export function useHabitTracking() {
  const { withErrorHandling } = useErrorHandler();
  const { showSuccess } = useToast();

  /**
   * Updates a habit's status and records it in the history
   */
  const updateHabitStatus = useCallback(
    async (habitPath: string, newStatus: 'todo' | 'completed'): Promise<boolean | null> => {
      const result = await withErrorHandling(
        async () => {
          const updated = await safeInvoke<boolean>(
            'update_habit_status',
            { habitPath, newStatus },
            null
          );
          if (updated === null) {
            throw new Error('Failed to update habit status');
          }
          return updated;
        },
        'Failed to update habit status',
        'habit'
      );

      if (result === true) {
        const normalizedPath = norm(habitPath) ?? habitPath;
        const fileName = normalizedPath.split('/').pop() || '';
        emitMetadataChange({
          filePath: normalizedPath,
          fileName,
          content: '',
          metadata: { habitStatus: newStatus },
          changedFields: { habitStatus: newStatus }
        });
        window.dispatchEvent(
          new CustomEvent('habit-status-updated', {
            detail: {
              filePath: normalizedPath,
              fileName,
              habitStatus: newStatus,
            },
          })
        );
        window.dispatchEvent(
          new CustomEvent('habit-content-changed', {
            detail: {
              filePath: normalizedPath,
              fileName,
              habitStatus: newStatus,
            },
          })
        );
        showSuccess(`Habit marked as ${newStatus === 'completed' ? 'completed' : 'to do'}`);
      }

      return result;
    },
    [withErrorHandling, showSuccess]
  );

  /**
   * Manually trigger habit reset check
   */
  const checkAndResetHabits = useCallback(
    async (spacePath: string) => {
      const result = await withErrorHandling(
        async () => {
          const resetHabits = await safeInvoke<string[]>('check_and_reset_habits', {
            spacePath,
          }, []);
          if (resetHabits === null) {
            throw new Error('Failed to check and reset habits');
          }
          return resetHabits;
        },
        'Failed to check habits',
        'habit'
      );

      if (result && result.length > 0) {
        showSuccess(`Reset ${result.length} habit${result.length > 1 ? 's' : ''}`);
      }

      return result;
    },
    [withErrorHandling, showSuccess]
  );

  return {
    updateHabitStatus,
    checkAndResetHabits,
  };
}
