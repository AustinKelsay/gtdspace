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
import { GTDProjectCreate, GTDProjectStatus } from '@/types';

interface GTDProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  spacePath: string;
  onSuccess?: () => void;
}

export const GTDProjectDialog: React.FC<GTDProjectDialogProps> = ({
  isOpen,
  onClose,
  spacePath,
  onSuccess,
}) => {
  const [projectName, setProjectName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [dueTime, setDueTime] = React.useState('');
  const [status, setStatus] = React.useState<GTDProjectStatus>('in-progress');
  const [isCreating, setIsCreating] = React.useState(false);
  const { createProject } = useGTDSpace();

  const handleCreate = async () => {
    console.log('[GTDProjectDialog] handleCreate called with:', {
      projectName: projectName.trim(),
      description: description.trim(),
      dueDate,
      dueTime,
      status,
      spacePath
    });
    
    if (!projectName.trim() || !description.trim()) {
      console.log('[GTDProjectDialog] Validation failed - missing name or description');
      return;
    }

    console.log('[GTDProjectDialog] Setting isCreating to true');
    setIsCreating(true);
    
    try {
      // Combine due date and time into ISO datetime string
      let dueDateTime: string | null = null;
      if (dueDate) {
        if (dueTime) {
          // Combine date and time
          dueDateTime = `${dueDate}T${dueTime}:00`;
        } else {
          // Default to 5 PM if no time specified (typical end of workday)
          dueDateTime = `${dueDate}T17:00:00`;
        }
      }
      
      const projectData: GTDProjectCreate = {
        space_path: spacePath,
        project_name: projectName.trim(),
        description: description.trim(),
        dueDate: dueDateTime,
        status: status,
      };

      console.log('[GTDProjectDialog] Calling createProject with:', projectData);
      const result = await createProject(projectData);
      console.log('[GTDProjectDialog] createProject result:', result);

      if (result) {
        // Reset form
        setProjectName('');
        setDescription('');
        setDueDate('');
        setDueTime('');
        setStatus('in-progress');
        
        // Call success callback if provided
        if (onSuccess) {
          console.log('[GTDProjectDialog] Calling onSuccess callback');
          onSuccess();
        }
        
        onClose();
      }
    } catch (error) {
      console.error('[GTDProjectDialog] Error creating project:', error);
    } finally {
      console.log('[GTDProjectDialog] Setting isCreating to false');
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setProjectName('');
      setDescription('');
      setDueDate('');
      setDueTime('');
      setStatus('in-progress');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Define a project with a clear outcome. Projects are multi-step endeavors that move you toward your goals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="e.g., Launch Company Blog"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Desired Outcome</Label>
            <Textarea
              id="description"
              placeholder="What is the desired outcome of this project?"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as GTDProjectStatus)} disabled={isCreating}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select project status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due-date">Due Date (Optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              When does this project need to be completed?
            </p>
            <div className="grid grid-cols-2 gap-2">
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
              <Input
                id="due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={isCreating}
                placeholder="Time"
              />
            </div>
          </div>

        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              console.log('[GTDProjectDialog] Create button clicked');
              handleCreate();
            }}
            disabled={!projectName.trim() || !description.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};