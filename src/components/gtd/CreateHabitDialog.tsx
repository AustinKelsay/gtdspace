/**
 * @fileoverview Dialog for creating new habits with frequency and status tracking
 * @author Development Team
 * @created 2025-01-13
 */

import React, { useState } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useToast } from '@/hooks/useToast';
import { RefreshCw, Clock } from 'lucide-react';

interface CreateHabitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  spacePath: string;
  onSuccess?: (habitPath: string) => void;
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Every Day' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { value: 'every-other-day', label: 'Every Other Day' },
  { value: 'twice-weekly', label: 'Twice a Week' },
  { value: 'weekly', label: 'Once Every Week' },
  { value: 'biweekly', label: 'Once Every Other Week' },
  { value: 'monthly', label: 'Once a Month' },
  { value: '5-minute', label: 'Every 5 Minutes (Testing)' },
];

// Habits always start as 'todo' - removed status selection from UI

export const CreateHabitDialog: React.FC<CreateHabitDialogProps> = ({
  isOpen,
  onClose,
  spacePath,
  onSuccess,
}) => {
  const [habitName, setHabitName] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [focusTime, setFocusTime] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { withErrorHandling } = useErrorHandler();
  const { showSuccess } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!habitName.trim()) {
      return;
    }

    setIsCreating(true);

    const result = await withErrorHandling(
      async () => {
        const habitPath = await safeInvoke<string>('create_gtd_habit', {
          spacePath: spacePath,
          habitName: habitName.trim(),
          frequency: frequency,
          status: 'todo', // Always start habits as 'todo'
          focusTime: focusTime.trim() || null, // Optional focus time
        }, null);
        if (!habitPath) {
          throw new Error('Failed to create habit');
        }
        return habitPath;
      },
      'Failed to create habit',
      'habit'
    );

    setIsCreating(false);

    if (result) {
      showSuccess(`Habit "${habitName}" created`);
      handleClose();
      if (onSuccess) {
        onSuccess(result);
      }
    }
  };

  const handleClose = () => {
    setHabitName('');
    setFrequency('daily');
    setFocusTime('');
    setIsCreating(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-green-600" />
            Create New Habit
          </DialogTitle>
          <DialogDescription>
            Set up a new habit to track regularly
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="habit-name">Habit Name</Label>
              <Input
                id="habit-name"
                value={habitName}
                onChange={(e) => setHabitName(e.target.value)}
                placeholder="Morning Exercise"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                What habit do you want to build?
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How often will you practice this habit?
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="focus-time" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Focus Time (Optional)
              </Label>
              <Input
                id="focus-time"
                type="time"
                value={focusTime}
                onChange={(e) => setFocusTime(e.target.value)}
                placeholder="09:00"
              />
              <p className="text-xs text-muted-foreground">
                What time of day will you do this habit? (e.g., 09:00 for 9 AM)
              </p>
            </div>

          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!habitName.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create Habit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateHabitDialog;