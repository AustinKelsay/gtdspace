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
import { Calendar } from 'lucide-react';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTDProjectCreate } from '@/types';
import { GTDTagSelector } from './GTDTagSelector';

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
  const [categories, setCategories] = React.useState<string[]>([]);
  const [isCreating, setIsCreating] = React.useState(false);
  const { createProject } = useGTDSpace();

  const handleCreate = async () => {
    if (!projectName.trim() || !description.trim()) return;

    setIsCreating(true);
    const projectData: GTDProjectCreate = {
      space_path: spacePath,
      project_name: projectName.trim(),
      description: description.trim(),
      due_date: dueDate || null,
      categories: categories.length > 0 ? categories : undefined,
    };

    const result = await createProject(projectData);
    setIsCreating(false);

    if (result) {
      // Reset form
      setProjectName('');
      setDescription('');
      setDueDate('');
      setCategories([]);
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setProjectName('');
      setDescription('');
      setDueDate('');
      setCategories([]);
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
            <Label htmlFor="description">Description</Label>
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
            <Label>Categories</Label>
            <GTDTagSelector
              type="categories"
              value={categories}
              onValueChange={setCategories}
              maxCount={3}
              placeholder="Select up to 3 categories..."
            />
            <p className="text-xs text-muted-foreground">
              Categorize your project for better organization
            </p>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!projectName.trim() || !description.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};