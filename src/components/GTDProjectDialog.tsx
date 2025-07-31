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
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from 'lucide-react';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTDProjectCreate } from '@/types';

interface GTDProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spacePath: string;
  onProjectCreated?: (projectPath: string) => void;
}

/**
 * Dialog for creating a new GTD project
 */
export function GTDProjectDialog({
  open,
  onOpenChange,
  spacePath,
  onProjectCreated,
}: GTDProjectDialogProps) {
  const [formData, setFormData] = useState<Omit<GTDProjectCreate, 'space_path'>>({
    project_name: '',
    description: '',
    due_date: null,
  });
  const { createProject, isLoading } = useGTDSpace();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.project_name.trim() || !formData.description.trim()) {
      return;
    }

    const projectPath = await createProject({
      space_path: spacePath,
      ...formData,
    });

    if (projectPath) {
      onProjectCreated?.(projectPath);
      onOpenChange(false);
      // Reset form
      setFormData({
        project_name: '',
        description: '',
        due_date: null,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new project to your GTD space. Projects are outcome-focused goals that require
              multiple actions to complete.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="e.g., Build Personal Website"
                value={formData.project_name}
                onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What is the desired outcome of this project?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                required
              />
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading || !formData.project_name.trim() || !formData.description.trim()
              }
            >
              {isLoading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}