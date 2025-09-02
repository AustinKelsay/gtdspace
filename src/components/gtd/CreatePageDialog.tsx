/**
 * @fileoverview Dialog for creating simple pages in Cabinet or Someday Maybe sections
 * @author Development Team
 * @created 2025-01-13
 */

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { checkTauriContextAsync, isTauriContext } from '@/utils/tauri-ready';
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

    try {
      const result = await withErrorHandling(
        async () => {
          console.log('Starting file creation process for:', pageName, 'in:', directory);
          // First check if the directory exists and create if needed
          try {
            console.log('Checking if directory exists:', directory);
            const directoryExistsBefore = await invoke<boolean>('check_directory_exists', { path: directory });
            console.log('Directory exists before:', directoryExistsBefore);
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
            console.error('Error checking/creating directory:', err);
            const detail = err instanceof Error ? err.message : String(err);
            throw new Error(`Unable to ensure directory exists at '${directory}': ${detail}`);
          }

          // Ensure the name ends with .md
          const fileName = pageName.trim().endsWith('.md') ? pageName.trim() : `${pageName.trim()}.md`;
          console.log('Creating file with name:', fileName);

          // Create the file - using FileOperationResult type
          const createResult = await invoke<{ success: boolean; path?: string; message?: string }>('create_file', {
            directory,
            name: fileName,
          });

          if (!createResult.success) {
            throw new Error(createResult.message || 'Failed to create file');
          }

          // Prefer the backend-created path, fallback to OS-safe join
          // Ensure Tauri context check runs first to prime the cache
          await checkTauriContextAsync();
          const filePath = createResult.path || (isTauriContext()
            ? await import('@tauri-apps/api/path').then(m => m.join(directory, fileName))
            : `${directory}/${fileName}`);

          // The backend create_file already provides appropriate templates
          // No need to overwrite with frontend templates

          return filePath;
        },
        `Failed to create page in ${directoryName}`,
        'file'
      );

      if (result) {
        showSuccess(`Page "${pageName}" created in ${directoryName}`);
        onSuccess?.(result);
        handleClose();
      }
    } catch (unexpectedError) {
      // Catch any unexpected errors that weren't handled by withErrorHandling
      console.error('Unexpected error in CreatePageDialog:', unexpectedError);
    } finally {
      // Always reset isCreating, even if there's an error
      setIsCreating(false);
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
                disabled={isCreating}
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