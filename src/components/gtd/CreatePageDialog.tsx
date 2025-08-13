/**
 * @fileoverview Dialog for creating simple pages in Cabinet or Someday Maybe sections
 * @author Development Team
 * @created 2025-01-13
 */

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useToast } from '@/hooks/useToast';
import { FileText } from 'lucide-react';

interface CreatePageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  directory: string;
  directoryName: string;
  onSuccess?: (filePath: string) => void;
}

export const CreatePageDialog: React.FC<CreatePageDialogProps> = ({
  isOpen,
  onClose,
  directory,
  directoryName,
  onSuccess,
}) => {
  const [pageName, setPageName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { withErrorHandling } = useErrorHandler();
  const { showSuccess } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pageName.trim()) {
      return;
    }

    console.log('Creating page:', pageName, 'in directory:', directory);
    setIsCreating(true);

    const result = await withErrorHandling(
      async () => {
        // First check if the directory exists and create if needed
        try {
          const directoryExistsBefore = await invoke<boolean>('check_directory_exists', { path: directory });
          if (!directoryExistsBefore) {
            let createResponse: unknown;
            try {
              createResponse = await invoke<string>('create_directory', { path: directory });
            } catch (err) {
              const detail = err instanceof Error ? err.message : String(err);
              throw new Error(`Failed to create directory at '${directory}': ${detail}`);
            }

            const directoryExistsAfter = await invoke<boolean>('check_directory_exists', { path: directory });
            if (!directoryExistsAfter) {
              throw new Error(`Directory '${directory}' does not exist after creation attempt. Response: ${String(createResponse)}`);
            }
          }
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          throw new Error(`Unable to ensure directory exists at '${directory}': ${detail}`);
        }

        // Ensure the name ends with .md
        const fileName = pageName.trim().endsWith('.md') ? pageName.trim() : `${pageName.trim()}.md`;

        // Create the file - using FileOperationResult type
        const createResult = await invoke<{ success: boolean; path?: string; message?: string }>('create_file', {
          directory,
          name: fileName,
        });

        if (!createResult.success) {
          throw new Error(createResult.message || 'Failed to create file');
        }

        // Get the full path for the created file
        const filePath = `${directory}/${fileName}`;

        // Write initial content based on directory type
        const title = fileName.replace('.md', '');
        let initialContent = `# ${title}\n\n`;

        if (directoryName === 'Someday Maybe') {
          initialContent += `## Idea\n\n[Describe your idea here]\n\n## Why it matters\n\n[Why is this worth considering?]\n\n## Next steps when ready\n\n- [ ] First step\n- [ ] Second step\n`;
        } else if (directoryName === 'Cabinet') {
          initialContent += `## Reference\n\n[Add your reference material here]\n\n## Key Points\n\n- \n\n## Notes\n\n`;
        }

        await invoke('save_file', {
          path: filePath,
          content: initialContent,
        });

        return filePath;
      },
      `Failed to create page in ${directoryName}`,
      'file'
    );

    // Always reset isCreating regardless of success/failure
    setIsCreating(false);

    if (result) {
      showSuccess(`Page "${pageName}" created in ${directoryName}`);
      onSuccess?.(result);
      handleClose();
    }
  };

  const handleClose = () => {
    setPageName('');
    setIsCreating(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Page in {directoryName}
          </DialogTitle>
          <DialogDescription>
            Create a new page in the {directoryName} directory
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="page-name">Page Name</Label>
              <Input
                id="page-name"
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
                placeholder={directoryName === 'Someday Maybe' ? 'Learn new language' : 'Important contacts'}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {directoryName === 'Someday Maybe'
                  ? 'Ideas and projects for future consideration'
                  : 'Reference materials and documentation'}
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
            <Button type="submit" disabled={!pageName.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create Page'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePageDialog;