import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreateHabitDialog } from '@/components/gtd/CreateHabitDialog';
import { CreatePageDialog } from '@/components/gtd/CreatePageDialog';
import { GTDActionDialog } from '@/components/gtd/GTDActionDialog';
import { GTDProjectDialog } from '@/components/gtd/GTDProjectDialog';
import type { GTDProject } from '@/types';
import type { PageDialogDirectory, SidebarDeleteItem } from './types';

type SidebarDialogsProps = {
  showProjectDialog: boolean;
  setShowProjectDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showActionDialog: boolean;
  setShowActionDialog: React.Dispatch<React.SetStateAction<boolean>>;
  selectedProject: GTDProject | null;
  setSelectedProject: React.Dispatch<React.SetStateAction<GTDProject | null>>;
  showPageDialog: boolean;
  setShowPageDialog: React.Dispatch<React.SetStateAction<boolean>>;
  pageDialogDirectory: PageDialogDirectory | null;
  setPageDialogDirectory: React.Dispatch<React.SetStateAction<PageDialogDirectory | null>>;
  showHabitDialog: boolean;
  setShowHabitDialog: React.Dispatch<React.SetStateAction<boolean>>;
  deleteItem: SidebarDeleteItem | null;
  setDeleteItem: React.Dispatch<React.SetStateAction<SidebarDeleteItem | null>>;
  spacePath: string;
  onProjectCreated: () => void;
  onActionCreated: (project: GTDProject) => void | Promise<void>;
  onPageCreated: (filePath: string) => void;
  onHabitCreated: (habitPath: string) => void;
  onDelete: () => void | Promise<void>;
};

export function SidebarDialogs({
  showProjectDialog,
  setShowProjectDialog,
  showActionDialog,
  setShowActionDialog,
  selectedProject,
  setSelectedProject,
  showPageDialog,
  setShowPageDialog,
  pageDialogDirectory,
  setPageDialogDirectory,
  showHabitDialog,
  setShowHabitDialog,
  deleteItem,
  setDeleteItem,
  spacePath,
  onProjectCreated,
  onActionCreated,
  onPageCreated,
  onHabitCreated,
  onDelete,
}: SidebarDialogsProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  return (
    <>
      <GTDProjectDialog
        isOpen={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
        spacePath={spacePath}
        onSuccess={onProjectCreated}
      />

      {selectedProject && (
        <GTDActionDialog
          isOpen={showActionDialog}
          onClose={() => {
            setShowActionDialog(false);
            setSelectedProject(null);
          }}
          projectPath={selectedProject.path}
          projectName={selectedProject.name}
          onSuccess={() => void onActionCreated(selectedProject)}
        />
      )}

      {pageDialogDirectory && (
        <CreatePageDialog
          isOpen={showPageDialog}
          onClose={() => {
            setShowPageDialog(false);
            setPageDialogDirectory(null);
          }}
          directory={pageDialogDirectory.path}
          directoryName={pageDialogDirectory.name}
          sectionId={pageDialogDirectory.sectionId}
          spacePath={pageDialogDirectory.spacePath}
          onSuccess={onPageCreated}
        />
      )}

      <CreateHabitDialog
        isOpen={showHabitDialog}
        onClose={() => setShowHabitDialog(false)}
        spacePath={spacePath}
        onSuccess={onHabitCreated}
      />

      <AlertDialog
        open={deleteItem !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{' '}
              {deleteItem?.type === 'project'
                ? 'Project'
                : deleteItem?.type === 'action'
                  ? 'Action'
                  : 'File'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.name}"?
              {deleteItem?.type === 'project' &&
                ' This will delete the project folder and all its contents including actions.'}
              {' This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={async (event) => {
                event.preventDefault();
                if (isDeleting) return;

                setIsDeleting(true);
                try {
                  await onDelete();
                  setDeleteItem(null);
                } catch (error) {
                  console.error('Sidebar delete failed', error);
                } finally {
                  setIsDeleting(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
