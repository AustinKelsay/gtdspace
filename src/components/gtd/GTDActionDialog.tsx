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
  const [status, setStatus] = React.useState<GTDActionStatus>('Not Started');
  const [dueDate, setDueDate] = React.useState('');
  const [effort, setEffort] = React.useState<GTDActionEffort>('Medium');
  const [notes, setNotes] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  const { createAction } = useGTDSpace();

  const handleCreate = async () => {
    if (!actionName.trim()) return;

    setIsCreating(true);
    const actionData: GTDActionCreate = {
      project_path: projectPath,
      action_name: actionName.trim(),
      status,
      due_date: dueDate || null,
      effort,
    };

    const result = await createAction(actionData);
    setIsCreating(false);

    if (result) {
      // Reset form
      setActionName('');
      setStatus('Not Started');
      setDueDate('');
      setEffort('Medium');
      setNotes('');
      
      // Call onSuccess with the action path if provided
      if (onSuccess && typeof result === 'string') {
        onSuccess(result);
      }
      
      onClose();
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setActionName('');
      setStatus('Not Started');
      setDueDate('');
      setEffort('Medium');
      setNotes('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Action to {projectName}</DialogTitle>
          <DialogDescription>
            Define a concrete next step that moves this project forward.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
                  <SelectItem value="Not Started">Not Started</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Complete">Complete</SelectItem>
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
                  <SelectItem value="Small">Small (&lt;30 min)</SelectItem>
                  <SelectItem value="Medium">Medium (30-90 min)</SelectItem>
                  <SelectItem value="Large">Large (&gt;90 min)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date (Optional)</Label>
            <div className="relative">
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isCreating}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
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

        <DialogFooter>
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