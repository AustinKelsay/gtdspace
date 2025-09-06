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
import { FolderOpen, Check } from 'lucide-react';
import { safeInvoke } from '@/utils/safe-invoke';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { useErrorHandler } from '@/hooks/useErrorHandler';

interface GTDInitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (spacePath: string) => void;
  initialPath?: string;
}

export const GTDInitDialog: React.FC<GTDInitDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPath,
}) => {
  const [selectedPath, setSelectedPath] = React.useState<string>('');
  const [isInitializing, setIsInitializing] = React.useState(false);
  const { initializeSpace } = useGTDSpace();
  const { withErrorHandling } = useErrorHandler();

  // Set initial path when dialog opens
  React.useEffect(() => {
    if (isOpen && initialPath) {
      setSelectedPath(initialPath);
    }
  }, [isOpen, initialPath]);

  const handleSelectFolder = async () => {
    const result = await withErrorHandling(
      async () => {
        const folder = await safeInvoke<string>('select_folder', undefined, null);
        if (!folder) {
          throw new Error('No folder selected');
        }
        return folder;
      },
      'Failed to select folder'
    );

    if (result) {
      setSelectedPath(result);
    }
  };

  const handleInitialize = async () => {
    if (!selectedPath) return;

    setIsInitializing(true);
    const success = await initializeSpace(selectedPath);
    setIsInitializing(false);

    if (success) {
      onSuccess(selectedPath);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Initialize GTD Space</DialogTitle>
          <DialogDescription>
            Create a new GTD (Getting Things Done) space with organized folders for your workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              A GTD space will create the following structure:
            </p>
            <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs">
              <div>📁 Your GTD Space/</div>
              <div className="ml-4">📁 Projects/</div>
              <div className="ml-4">📁 Habits/</div>
              <div className="ml-4">📁 Someday Maybe/</div>
              <div className="ml-4">📁 Cabinet/</div>
              <div className="ml-4">📄 Welcome to GTD Space.md</div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleSelectFolder}
              variant="outline"
              className="w-full justify-start"
              disabled={isInitializing}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {selectedPath || 'Select folder...'}
            </Button>
            {selectedPath && (
              <p className="text-xs text-muted-foreground">
                GTD space will be created in: {selectedPath}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isInitializing}>
            Cancel
          </Button>
          <Button
            onClick={handleInitialize}
            disabled={!selectedPath || isInitializing}
          >
            {isInitializing ? (
              <>Creating...</>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Initialize Space
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};