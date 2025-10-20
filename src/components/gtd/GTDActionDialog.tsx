import React from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTDActionCreate, GTDActionStatus, GTDActionEffort } from '@/types';
import { GTDTagSelector } from './GTDTagSelector';

interface GTDActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  projectName: string;
  onSuccess?: (actionPath: string) => void;
}

export const GTDActionDialog: React.FC<GTDActionDialogProps> = ({
  isOpen,
  onClose,
  projectPath,
  projectName,
  onSuccess,
}) => {
  const [actionName, setActionName] = React.useState('');
  const [status, setStatus] = React.useState<GTDActionStatus>('in-progress');
  const [focusDate, setFocusDate] = React.useState('');
  const [focusTime, setFocusTime] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [effort, setEffort] = React.useState<GTDActionEffort>('medium');
  const [notes, setNotes] = React.useState('');
  const [contexts, setContexts] = React.useState<string[]>([]);
  const [isCreating, setIsCreating] = React.useState(false);
  const { createAction } = useGTDSpace();

  const handleCreate = async () => {
    if (!actionName.trim()) return;

    setIsCreating(true);

    try {
      // Combine focus date and time into ISO datetime string
      let focusDateTime: string | null = null;
      if (focusDate) {
        if (focusTime) {
          // Combine date and time
          focusDateTime = `${focusDate}T${focusTime}:00`;
        } else {
          // Default to start of day if no time specified
          focusDateTime = `${focusDate}T09:00:00`;
        }
      }

      // Use date-only format (YYYY-MM-DD) for due date as per type definition
      const dueDateOnly: string | null = dueDate || null;

      const actionData: GTDActionCreate = {
        project_path: projectPath,
        action_name: actionName.trim(),
        status,
        focusDate: focusDateTime,
        dueDate: dueDateOnly,
        effort,
        contexts: contexts.length > 0 ? contexts : undefined,
        notes: notes.trim() ? notes : undefined,
      };

      console.log('[GTDActionDialog] Calling createAction with:', actionData);
      const result = await createAction(actionData);
      console.log('[GTDActionDialog] createAction result:', result);

      if (result) {
        // Reset form
        setActionName('');
        setStatus('in-progress');
        setFocusDate('');
        setFocusTime('');
        setDueDate('');
        setEffort('medium');
        setNotes('');
        setContexts([]);

        // Call onSuccess with the action path if provided
        if (onSuccess && typeof result === 'string') {
          onSuccess(result);
        }

        onClose();
      }
    } catch (error) {
      console.error('[GTDActionDialog] Error creating action:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setActionName('');
      setStatus('in-progress');
      setFocusDate('');
      setFocusTime('');
      setDueDate('');
      setEffort('medium');
      setNotes('');
      setContexts([]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-visible">
        <DialogHeader>
          <DialogTitle>Add Action to {projectName}</DialogTitle>
          <DialogDescription>
            Define a concrete next step that moves this project forward.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label htmlFor="action-name">Action Name</Label>
            <Input
              id="action-name"
              placeholder="e.g., Draft blog post outline"
              value={actionName}
              onChange={(e) => setActionName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as GTDActionStatus)}>
                <SelectTrigger id="status" disabled={isCreating}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="effort">Effort</Label>
              <Select value={effort} onValueChange={(value) => setEffort(value as GTDActionEffort)}>
                <SelectTrigger id="effort" disabled={isCreating}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small (&lt;30 min)</SelectItem>
                  <SelectItem value="medium">Medium (30-90 min)</SelectItem>
                  <SelectItem value="large">Large (&gt;90 min)</SelectItem>
                  <SelectItem value="extra-large">Extra Large (&gt;3 hours)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="focus-date">Focus Date (Optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              When will you work on this action?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input
                  id="focus-date"
                  type="date"
                  value={focusDate}
                  onChange={(e) => setFocusDate(e.target.value)}
                  disabled={isCreating}
                  placeholder="Date"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              <Input
                id="focus-time"
                type="time"
                value={focusTime}
                onChange={(e) => setFocusTime(e.target.value)}
                disabled={isCreating}
                placeholder="Time"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date (Optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              When must this action be completed?
            </p>
            <div className="grid grid-cols-1 gap-2">
              <div className="relative">
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isCreating}
                  placeholder="Date"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contexts</Label>
            <GTDTagSelector
              type="contexts"
              value={contexts}
              onValueChange={setContexts}
              placeholder="Where can this be done? (@computer, @phone, etc.)"
            />
            <p className="text-xs text-muted-foreground">
              Add contexts to filter actions by location or tool needed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional details about this action..."
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isCreating}
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!actionName.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Action'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
