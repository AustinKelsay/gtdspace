import React from 'react';
import type {
  SidebarActionMetadata,
  SidebarProjectMetadata,
  SidebarSectionFileMetadata,
} from '@/components/gtd/sidebar/types';
import type { SidebarOverlayState } from '@/hooks/sidebar/types';
import { normalizeSidebarPath } from '@/hooks/sidebar/path-classification';

export function useSidebarOverlays(): SidebarOverlayState {
  const [projectMetadata, setProjectMetadata] = React.useState<
    Record<string, SidebarProjectMetadata>
  >({});
  const [actionMetadata, setActionMetadata] = React.useState<
    Record<string, SidebarActionMetadata>
  >({});
  const [sectionFileMetadata, setSectionFileMetadata] = React.useState<
    Record<string, SidebarSectionFileMetadata>
  >({});
  const [actionStatuses, setActionStatuses] = React.useState<Record<string, string>>(
    {}
  );

  const updateProjectOverlay = React.useCallback(
    (projectPath: string, patch: Partial<SidebarProjectMetadata>) => {
      const normalizedKey =
        normalizeSidebarPath(projectPath) ?? projectPath.replace(/\\/g, '/');
      setProjectMetadata((prev) => ({
        ...prev,
        [normalizedKey]: {
          ...prev[normalizedKey],
          ...patch,
        },
      }));
    },
    []
  );

  const updateActionOverlay = React.useCallback(
    (actionPath: string, patch: Partial<SidebarActionMetadata>) => {
      const normalizedKey =
        normalizeSidebarPath(actionPath) ?? actionPath.replace(/\\/g, '/');
      setActionMetadata((prev) => ({
        ...prev,
        [normalizedKey]: {
          ...prev[normalizedKey],
          ...patch,
        },
      }));
    },
    []
  );

  const updateSectionFileOverlay = React.useCallback(
    (filePath: string, patch: Partial<SidebarSectionFileMetadata>) => {
      const normalizedKey =
        normalizeSidebarPath(filePath) ?? filePath.replace(/\\/g, '/');
      setSectionFileMetadata((prev) => ({
        ...prev,
        [normalizedKey]: {
          ...prev[normalizedKey],
          ...patch,
        },
      }));
    },
    []
  );

  const removeActionOverlay = React.useCallback((filePath: string) => {
    const normalizedKey =
      normalizeSidebarPath(filePath) ?? filePath.replace(/\\/g, '/');
    setActionMetadata((prev) => {
      const next = { ...prev };
      delete next[normalizedKey];
      return next;
    });
  }, []);

  const removeProjectOverlay = React.useCallback((projectPath: string) => {
    const normalizedKey =
      normalizeSidebarPath(projectPath) ?? projectPath.replace(/\\/g, '/');
    setProjectMetadata((prev) => {
      const next = { ...prev };
      delete next[normalizedKey];
      return next;
    });
  }, []);

  const removeSectionFileOverlay = React.useCallback((filePath: string) => {
    const normalizedKey =
      normalizeSidebarPath(filePath) ?? filePath.replace(/\\/g, '/');
    setSectionFileMetadata((prev) => {
      const next = { ...prev };
      delete next[normalizedKey];
      return next;
    });
  }, []);

  const resetOverlays = React.useCallback(() => {
    setProjectMetadata({});
    setActionMetadata({});
    setSectionFileMetadata({});
    setActionStatuses({});
  }, []);

  return {
    projectMetadata,
    actionMetadata,
    sectionFileMetadata,
    actionStatuses,
    setProjectMetadata,
    setActionMetadata,
    setSectionFileMetadata,
    setActionStatuses,
    updateProjectOverlay,
    updateActionOverlay,
    updateSectionFileOverlay,
    removeProjectOverlay,
    removeActionOverlay,
    removeSectionFileOverlay,
    resetOverlays,
  };
}
