import { useEffect } from 'react';
import type { RenameMode } from './state';

type RenameEventDetail = {
  oldPath: string;
  newPath: string;
};

type DeleteEventDetail = {
  path: string;
};

type OpenReferenceEventDetail = {
  path: string;
};

type TabManagerSubscriptionHandlers = {
  onRename: (detail: RenameEventDetail, mode: RenameMode) => void;
  onDelete: (detail: DeleteEventDetail) => void;
  onOpenReference: (detail: OpenReferenceEventDetail) => void;
};

export function useTabManagerSubscriptions({
  onRename,
  onDelete,
  onOpenReference,
}: TabManagerSubscriptionHandlers): void {
  useEffect(() => {
    const handleProjectRename = (event: Event) => {
      onRename((event as CustomEvent<RenameEventDetail>).detail, 'prefix');
    };

    const handleActionRename = (event: Event) => {
      onRename((event as CustomEvent<RenameEventDetail>).detail, 'exact');
    };

    const handleSectionFileRename = (event: Event) => {
      onRename((event as CustomEvent<RenameEventDetail>).detail, 'exact');
    };

    const handleFileDeleted = (event: Event) => {
      onDelete((event as CustomEvent<DeleteEventDetail>).detail);
    };

    const handleOpenReference = (event: Event) => {
      onOpenReference((event as CustomEvent<OpenReferenceEventDetail>).detail);
    };

    window.addEventListener('project-renamed', handleProjectRename);
    window.addEventListener('action-renamed', handleActionRename);
    window.addEventListener('section-file-renamed', handleSectionFileRename);
    window.addEventListener('file-deleted', handleFileDeleted);
    window.addEventListener('open-reference-file', handleOpenReference);

    return () => {
      window.removeEventListener('project-renamed', handleProjectRename);
      window.removeEventListener('action-renamed', handleActionRename);
      window.removeEventListener('section-file-renamed', handleSectionFileRename);
      window.removeEventListener('file-deleted', handleFileDeleted);
      window.removeEventListener('open-reference-file', handleOpenReference);
    };
  }, [onDelete, onOpenReference, onRename]);
}
