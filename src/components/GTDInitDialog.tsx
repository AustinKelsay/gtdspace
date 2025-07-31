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
import { Label } from '@/components/ui/label';
import { FolderOpen, Rocket } from 'lucide-react';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { invoke } from '@tauri-apps/api/core';

interface GTDInitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInitialized?: (spacePath: string) => void;
}

/**
 * Dialog for initializing a new GTD space
 */
export function GTDInitDialog({ open, onOpenChange, onInitialized }: GTDInitDialogProps) {
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [isSelecting, setIsSelecting] = useState(false);
  const { initializeSpace, isLoading } = useGTDSpace();

  const handleSelectFolder = async () => {
    setIsSelecting(true);
    try {
      const folderPath = await invoke<string>('select_folder');
      setSelectedPath(folderPath);
    } catch (error) {
      // User cancelled or error occurred
      console.error('Folder selection error:', error);
    } finally {
      setIsSelecting(false);
    }
  };

  const handleInitialize = async () => {
    if (!selectedPath) return;

    const success = await initializeSpace(selectedPath);
    if (success) {
      onInitialized?.(selectedPath);
      onOpenChange(false);
      setSelectedPath('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Initialize GTD Space
          </DialogTitle>
          <DialogDescription>
            Set up a new Getting Things Done (GTD) workspace. This will create the standard GTD
            directory structure to help you organize your projects and tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>GTD Space Location</Label>
            <div className="flex gap-2">
              <div className="flex-1 min-h-[40px] px-3 py-2 border rounded-md bg-muted/50 flex items-center">
                {selectedPath ? (
                  <span className="text-sm truncate">{selectedPath}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">No folder selected</span>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleSelectFolder}
                disabled={isSelecting || isLoading}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Browse
              </Button>
            </div>
          </div>

          <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
            <p className="text-sm font-medium">The following structure will be created:</p>
            <div className="space-y-1 text-sm text-muted-foreground font-mono">
              <div>📁 Projects/ - Active projects and their actions</div>
              <div>📁 Habits/ - Recurring habits and routines</div>
              <div>📁 Someday Maybe/ - Ideas for future consideration</div>
              <div>📁 Cabinet/ - Reference materials</div>
              <div>📄 Welcome to GTD Space.md - Getting started guide</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleInitialize} disabled={!selectedPath || isLoading}>
            {isLoading ? 'Initializing...' : 'Initialize Space'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}