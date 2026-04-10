import type React from 'react';
import type { UseErrorHandlerReturn } from '@/hooks/useErrorHandler';
import type {
  PageDialogDirectory,
  SidebarActionMetadata,
  SidebarDeleteItem,
  SidebarProjectMetadata,
  SidebarSectionFileMetadata,
} from '@/components/gtd/sidebar/types';
import type { GTDProject, MarkdownFile } from '@/types';

export type SidebarUiState = {
  showProjectDialog: boolean;
  setShowProjectDialog: React.Dispatch<React.SetStateAction<boolean>>;
  showActionDialog: boolean;
  setShowActionDialog: React.Dispatch<React.SetStateAction<boolean>>;
  selectedProject: GTDProject | null;
  setSelectedProject: React.Dispatch<React.SetStateAction<GTDProject | null>>;
  expandedSections: string[];
  setExpandedSections: React.Dispatch<React.SetStateAction<string[]>>;
  expandedProjects: string[];
  setExpandedProjects: React.Dispatch<React.SetStateAction<string[]>>;
  completedProjectsExpanded: boolean;
  setCompletedProjectsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  cancelledProjectsExpanded: boolean;
  setCancelledProjectsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  expandedCompletedActions: Set<string>;
  setExpandedCompletedActions: React.Dispatch<React.SetStateAction<Set<string>>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  showSearch: boolean;
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>;
  showPageDialog: boolean;
  setShowPageDialog: React.Dispatch<React.SetStateAction<boolean>>;
  pageDialogDirectory: PageDialogDirectory | null;
  setPageDialogDirectory: React.Dispatch<React.SetStateAction<PageDialogDirectory | null>>;
  showHabitDialog: boolean;
  setShowHabitDialog: React.Dispatch<React.SetStateAction<boolean>>;
  deleteItem: SidebarDeleteItem | null;
  setDeleteItem: React.Dispatch<React.SetStateAction<SidebarDeleteItem | null>>;
  toggleSection: (sectionId: string) => void;
  toggleCompletedActions: (projectPath: string) => void;
};

export type SidebarOverlayState = {
  projectMetadata: Record<string, SidebarProjectMetadata>;
  actionMetadata: Record<string, SidebarActionMetadata>;
  sectionFileMetadata: Record<string, SidebarSectionFileMetadata>;
  actionStatuses: Record<string, string>;
  setProjectMetadata: React.Dispatch<
    React.SetStateAction<Record<string, SidebarProjectMetadata>>
  >;
  setActionMetadata: React.Dispatch<
    React.SetStateAction<Record<string, SidebarActionMetadata>>
  >;
  setSectionFileMetadata: React.Dispatch<
    React.SetStateAction<Record<string, SidebarSectionFileMetadata>>
  >;
  setActionStatuses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateProjectOverlay: (
    projectPath: string,
    patch: Partial<SidebarProjectMetadata>
  ) => void;
  updateActionOverlay: (
    actionPath: string,
    patch: Partial<SidebarActionMetadata>
  ) => void;
  updateSectionFileOverlay: (
    filePath: string,
    patch: Partial<SidebarSectionFileMetadata>
  ) => void;
  removeProjectOverlay: (projectPath: string) => void;
  removeActionOverlay: (filePath: string) => void;
  removeSectionFileOverlay: (filePath: string) => void;
  resetOverlays: () => void;
};

export type SidebarDataState = {
  sectionFiles: Record<string, MarkdownFile[]>;
  setSectionFiles: React.Dispatch<React.SetStateAction<Record<string, MarkdownFile[]>>>;
  sectionFilesRef: React.MutableRefObject<Record<string, MarkdownFile[]>>;
  projectActions: Record<string, MarkdownFile[]>;
  setProjectActions: React.Dispatch<React.SetStateAction<Record<string, MarkdownFile[]>>>;
  projectActionsRef: React.MutableRefObject<Record<string, MarkdownFile[]>>;
  projectLoading: Record<string, boolean>;
  setProjectLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  projectLoadingRef: React.MutableRefObject<Record<string, boolean>>;
  loadingSections: Set<string>;
  setLoadingSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  loadingSectionsRef: React.MutableRefObject<Set<string>>;
  loadedSections: Set<string>;
  setLoadedSections: React.Dispatch<React.SetStateAction<Set<string>>>;
  pendingProjects: GTDProject[];
  setPendingProjects: React.Dispatch<React.SetStateAction<GTDProject[]>>;
  lastRootRef: React.MutableRefObject<string | null>;
  preloadedRef: React.MutableRefObject<boolean>;
  workspaceGenerationRef: React.MutableRefObject<number>;
  resetDataState: () => void;
};

export type SidebarPathKind =
  | 'project-readme'
  | 'project-action'
  | 'section-file'
  | 'other';

export type SidebarPathMatch = {
  kind: SidebarPathKind;
  normalizedPath: string;
  projectPath?: string;
  sectionId?: string;
  sectionPath?: string;
};

export type SidebarWithErrorHandling = UseErrorHandlerReturn['withErrorHandling'];

export type SidebarLoaderDeps = {
  rootPath: string | null;
  withErrorHandling: SidebarWithErrorHandling;
  overlays: Pick<
    SidebarOverlayState,
    'setActionMetadata' | 'setActionStatuses'
  >;
};

export type SidebarEventBridgeDeps = {
  rootPath: string | null;
  withErrorHandling: SidebarWithErrorHandling;
  loadProjects: (path: string) => Promise<GTDProject[]>;
  loadProjectActions: (projectPath: string) => Promise<void>;
  loadSectionFiles: (sectionPath: string, force?: boolean) => Promise<MarkdownFile[]>;
  overlays: Pick<
    SidebarOverlayState,
    | 'setActionStatuses'
    | 'updateProjectOverlay'
    | 'updateActionOverlay'
    | 'updateSectionFileOverlay'
    | 'removeProjectOverlay'
    | 'removeActionOverlay'
    | 'removeSectionFileOverlay'
  >;
  ui: Pick<SidebarUiState, 'setExpandedProjects'>;
  data: Pick<
    SidebarDataState,
    'setPendingProjects' | 'setProjectActions'
  >;
};
