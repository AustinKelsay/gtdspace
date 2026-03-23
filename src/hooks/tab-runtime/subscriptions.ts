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
    const getEventDetail = <T,>(event: Event): T | null => {
      if (!(event instanceof CustomEvent) || event.detail == null) {
        return null;
      }
      return event.detail as T;
    };

    const handleProjectRename = (event: Event) => {
      const detail = getEventDetail<RenameEventDetail>(event);
      if (!detail) return;
      onRename(detail, 'prefix');
    };

    const handleActionRename = (event: Event) => {
      const detail = getEventDetail<RenameEventDetail>(event);
      if (!detail) return;
      onRename(detail, 'exact');
    };

    const handleSectionFileRename = (event: Event) => {
      const detail = getEventDetail<RenameEventDetail>(event);
      if (!detail) return;
      onRename(detail, 'exact');
    };

    const handleFileRename = (event: Event) => {
      const detail = getEventDetail<RenameEventDetail>(event);
      if (!detail) return;
      onRename(detail, 'exact');
    };

    const handleFileDeleted = (event: Event) => {
      const detail = getEventDetail<DeleteEventDetail>(event);
      if (!detail) return;
      onDelete(detail);
    };

    const handleOpenReference = (event: Event) => {
      const detail = getEventDetail<OpenReferenceEventDetail>(event);
      if (!detail) return;
      onOpenReference(detail);
    };

    window.addEventListener('project-renamed', handleProjectRename);
    window.addEventListener('action-renamed', handleActionRename);
    window.addEventListener('section-file-renamed', handleSectionFileRename);
    window.addEventListener('file-renamed', handleFileRename);
    window.addEventListener('file-deleted', handleFileDeleted);
    window.addEventListener('open-reference-file', handleOpenReference);

    return () => {
      window.removeEventListener('project-renamed', handleProjectRename);
      window.removeEventListener('action-renamed', handleActionRename);
      window.removeEventListener('section-file-renamed', handleSectionFileRename);
      window.removeEventListener('file-renamed', handleFileRename);
      window.removeEventListener('file-deleted', handleFileDeleted);
      window.removeEventListener('open-reference-file', handleOpenReference);
    };
  }, [onDelete, onOpenReference, onRename]);
}
