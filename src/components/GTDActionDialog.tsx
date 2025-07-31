import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Clock } from 'lucide-react';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTDActionCreate, GTDActionStatus, GTDActionEffort } from '@/types';

interface GTDActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  projectName: string;
  onActionCreated?: (actionPath: string) => void;
}

/**
 * Dialog for creating a new GTD action (task)
 */
export function GTDActionDialog({
  open,
  onOpenChange,
  projectPath,
  projectName,
  onActionCreated,
}: GTDActionDialogProps) {
  const [formData, setFormData] = useState<Omit<GTDActionCreate, 'project_path'>>({
    action_name: '',
    status: 'Not Started',
    due_date: null,
    effort: 'Medium',
  });
  const { createAction, isLoading } = useGTDSpace();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.action_name.trim()) {
      return;
    }

    const actionPath = await createAction({
      project_path: projectPath,
      ...formData,
    });

    if (actionPath) {
      onActionCreated?.(actionPath);
      onOpenChange(false);
      // Reset form
      setFormData({
        action_name: '',
        status: 'Not Started',
        due_date: null,
        effort: 'Medium',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Action</DialogTitle>
            <DialogDescription>
              Add a new action to the project "{projectName}". Actions are concrete next steps that
              move the project forward.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="action-name">Action Name</Label>
              <Input
                id="action-name"
                placeholder="e.g., Write homepage content"
                value={formData.action_name}
                onChange={(e) => setFormData({ ...formData, action_name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: GTDActionStatus) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger id="status">
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
                <Select
                  value={formData.effort}
                  onValueChange={(value: GTDActionEffort) =>
                    setFormData({ ...formData, effort: value })
                  }
                >
                  <SelectTrigger id="effort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Small">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        Small (&lt; 30 min)
                      </div>
                    </SelectItem>
                    <SelectItem value="Medium">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        Medium (30-90 min)
                      </div>
                    </SelectItem>
                    <SelectItem value="Large">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        Large (&gt; 90 min)
                      </div>
                    </SelectItem>
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
                  value={formData.due_date || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value || null })
                  }
                  className="pl-10"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.action_name.trim()}>
              {isLoading ? 'Creating...' : 'Create Action'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}