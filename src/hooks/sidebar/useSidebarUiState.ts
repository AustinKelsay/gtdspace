import React from 'react';
import type {
  PageDialogDirectory,
  SidebarDeleteItem,
} from '@/components/gtd/sidebar/types';
import type { SidebarUiState } from '@/hooks/sidebar/types';
import { normalizeSidebarPath } from '@/hooks/sidebar/path-classification';
import type { GTDProject } from '@/types';

export function useSidebarUiState(): SidebarUiState {
  const [showProjectDialog, setShowProjectDialog] = React.useState(false);
  const [showActionDialog, setShowActionDialog] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<GTDProject | null>(
    null
  );
  const [expandedSections, setExpandedSections] = React.useState<string[]>([
    'projects',
    'habits',
  ]);
  const [expandedProjects, setExpandedProjects] = React.useState<string[]>([]);
  const [completedProjectsExpanded, setCompletedProjectsExpanded] =
    React.useState(false);
  const [cancelledProjectsExpanded, setCancelledProjectsExpanded] =
    React.useState(false);
  const [expandedCompletedActions, setExpandedCompletedActions] =
    React.useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSearch, setShowSearch] = React.useState(false);
  const [showPageDialog, setShowPageDialog] = React.useState(false);
  const [pageDialogDirectory, setPageDialogDirectory] =
    React.useState<PageDialogDirectory | null>(null);
  const [showHabitDialog, setShowHabitDialog] = React.useState(false);
  const [deleteItem, setDeleteItem] = React.useState<SidebarDeleteItem | null>(
    null
  );

  const toggleSection = React.useCallback((sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  }, []);

  const toggleCompletedActions = React.useCallback((projectPath: string) => {
    const normalizedProjectPath =
      normalizeSidebarPath(projectPath) ?? projectPath.replace(/\\/g, '/');

    setExpandedCompletedActions((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedProjectPath)) {
        next.delete(normalizedProjectPath);
      } else {
        next.add(normalizedProjectPath);
      }
      return next;
    });
  }, []);

  return {
    showProjectDialog,
    setShowProjectDialog,
    showActionDialog,
    setShowActionDialog,
    selectedProject,
    setSelectedProject,
    expandedSections,
    setExpandedSections,
    expandedProjects,
    setExpandedProjects,
    completedProjectsExpanded,
    setCompletedProjectsExpanded,
    cancelledProjectsExpanded,
    setCancelledProjectsExpanded,
    expandedCompletedActions,
    setExpandedCompletedActions,
    searchQuery,
    setSearchQuery,
    showSearch,
    setShowSearch,
    showPageDialog,
    setShowPageDialog,
    pageDialogDirectory,
    setPageDialogDirectory,
    showHabitDialog,
    setShowHabitDialog,
    deleteItem,
    setDeleteItem,
    toggleSection,
    toggleCompletedActions,
  };
}
