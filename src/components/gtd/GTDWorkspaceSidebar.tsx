import React from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from 'lucide-react';
import { GTD_SECTIONS, SIDEBAR_ACTIVE_ROW_CLASSES } from '@/components/gtd/sidebar/constants';
import {
  SidebarDialogs,
  SidebarHeader,
  SidebarProjectsSection,
  SidebarSearchResults,
  SidebarEmptyFolderState,
  SidebarNonGtdState,
  SidebarStandardSection,
} from '@/components/gtd/sidebar';
import { createCalendarFile, buildSectionPathCandidates } from '@/components/gtd/sidebar/utils';
import { useGTDWorkspaceSidebar } from '@/hooks/useGTDWorkspaceSidebar';
import type { GTDWorkspaceSidebarProps } from '@/components/gtd/sidebar/types';
import type { MarkdownFile } from '@/types';

export const GTDWorkspaceSidebar: React.FC<GTDWorkspaceSidebarProps> = ({
  currentFolder,
  onFolderSelect,
  onFileSelect,
  onRefresh,
  className = '',
  gtdSpace,
  checkGTDSpace,
  loadProjects,
  activeFilePath = null,
}) => {
  const sidebar = useGTDWorkspaceSidebar({
    currentFolder,
    onFolderSelect,
    onFileSelect,
    onRefresh,
    gtdSpace,
    checkGTDSpace,
    loadProjects,
    activeFilePath,
  });

  const spacePath = sidebar.rootPath ?? '';

  if (!currentFolder) {
    return (
      <SidebarEmptyFolderState className={className} onSelectFolder={sidebar.handleSelectFolder} />
    );
  }

  if (!sidebar.gtdSpace?.isGTDSpace) {
    return <SidebarNonGtdState className={className} />;
  }

  const handleOpenAction = (action: MarkdownFile, path: string) => {
    onFileSelect({ ...action, path });
  };

  const handleOpenFile = (file: MarkdownFile, path: string) => {
    onFileSelect({ ...file, path });
  };

  return (
    <Card className={`flex flex-col h-full border-r ${className}`}>
      <SidebarHeader
        projectCount={sidebar.gtdSpace.projects?.length || 0}
        actionCount={
          sidebar.gtdSpace.projects?.reduce((sum, project) => sum + (project.action_count || 0), 0) ||
          0
        }
        showSearch={sidebar.showSearch}
        searchQuery={sidebar.searchQuery}
        onToggleSearch={() => sidebar.setShowSearch((prev) => !prev)}
        onSearchChange={sidebar.setSearchQuery}
        onOpenFolderInExplorer={sidebar.handleOpenFolderInExplorer}
        onRefresh={sidebar.handleRefresh}
      />

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 pb-4">
          {sidebar.searchQuery && sidebar.searchResults ? (
            <SidebarSearchResults
              results={sidebar.searchResults}
              searchQuery={sidebar.searchQuery}
              projectMetadata={sidebar.projectMetadata}
              actionMetadata={sidebar.actionMetadata}
              actionStatuses={sidebar.actionStatuses}
              sectionFileMetadata={sidebar.sectionFileMetadata}
              isPathActive={sidebar.isPathActive}
              onOpenProject={sidebar.handleProjectClick}
              onOpenAction={handleOpenAction}
              onOpenFile={handleOpenFile}
            />
          ) : (
            <>
              {GTD_SECTIONS.map((section) => {
                const isExpanded = sidebar.expandedSections.includes(section.id);
                const sectionPaths = buildSectionPathCandidates(spacePath, section);
                const sectionPath =
                  sectionPaths.find((candidate) => sidebar.sectionFiles[candidate]) ?? sectionPaths[0];
                const files = sidebar.sectionFiles[sectionPath] || [];

                if (section.id === 'calendar') {
                  const isCalendarActive = sidebar.isPathActive('::calendar::');
                  return (
                    <div
                      key={section.id}
                      className={`group flex items-center justify-between p-1.5 hover:bg-accent rounded-lg transition-colors cursor-pointer ${isCalendarActive ? SIDEBAR_ACTIVE_ROW_CLASSES : ''}`}
                      onClick={() => onFileSelect(createCalendarFile())}
                    >
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-orange-600 flex-shrink-0" />
                        <span className="font-medium text-sm">Calendar</span>
                      </div>
                    </div>
                  );
                }

                if (section.id === 'projects') {
                  return (
                    <SidebarProjectsSection
                      key={section.id}
                      isExpanded={isExpanded}
                      isLoading={sidebar.isLoading}
                      filteredProjectCount={sidebar.filteredProjects.length}
                      activeProjects={sidebar.activeProjects}
                      completedProjects={sidebar.completedProjects}
                      projectActions={sidebar.projectActions}
                      projectMetadata={sidebar.projectMetadata}
                      actionMetadata={sidebar.actionMetadata}
                      actionStatuses={sidebar.actionStatuses}
                      expandedProjects={sidebar.expandedProjects}
                      completedProjectsExpanded={sidebar.completedProjectsExpanded}
                      expandedCompletedActions={sidebar.expandedCompletedActions}
                      activeFilePath={activeFilePath}
                      onToggleSection={() => sidebar.toggleSection('projects')}
                      onAddProject={() => sidebar.setShowProjectDialog(true)}
                      onOpenProject={sidebar.handleProjectClick}
                      onToggleProjectExpand={sidebar.toggleProjectExpand}
                      onAddAction={(project) => {
                        sidebar.setSelectedProject(project);
                        sidebar.setShowActionDialog(true);
                      }}
                      onToggleCompletedProjects={sidebar.setCompletedProjectsExpanded}
                      onToggleCompletedActions={sidebar.toggleCompletedActions}
                      onOpenAction={handleOpenAction}
                      onOpenProjectFolder={sidebar.handleOpenFileLocation}
                      onOpenFileLocation={sidebar.handleOpenFileLocation}
                      onQueueDelete={sidebar.setDeleteItem}
                      isPathActive={sidebar.isPathActive}
                    />
                  );
                }

                return (
                  <SidebarStandardSection
                    key={section.id}
                    section={section}
                    sectionPath={sectionPath}
                    files={files}
                    isExpanded={isExpanded}
                    isLoaded={sidebar.loadedSections.has(sectionPath)}
                    isLoading={sidebar.loadingSections.has(sectionPath)}
                    activeFilePath={activeFilePath}
                    sectionFileMetadata={sidebar.sectionFileMetadata}
                    onToggleSection={sidebar.toggleSection}
                    onLoadSection={sidebar.loadSectionFiles}
                    onOpenHorizonReadme={sidebar.openHorizonReadme}
                    onOpenFile={handleOpenFile}
                    onCreatePage={sidebar.handleCreatePage}
                    onOpenFileLocation={sidebar.handleOpenFileLocation}
                    onQueueDelete={sidebar.setDeleteItem}
                    isPathActive={sidebar.isPathActive}
                  />
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>

      <SidebarDialogs
        showProjectDialog={sidebar.showProjectDialog}
        setShowProjectDialog={sidebar.setShowProjectDialog}
        showActionDialog={sidebar.showActionDialog}
        setShowActionDialog={sidebar.setShowActionDialog}
        selectedProject={sidebar.selectedProject}
        setSelectedProject={sidebar.setSelectedProject}
        showPageDialog={sidebar.showPageDialog}
        setShowPageDialog={sidebar.setShowPageDialog}
        pageDialogDirectory={sidebar.pageDialogDirectory}
        setPageDialogDirectory={sidebar.setPageDialogDirectory}
        showHabitDialog={sidebar.showHabitDialog}
        setShowHabitDialog={sidebar.setShowHabitDialog}
        deleteItem={sidebar.deleteItem}
        setDeleteItem={sidebar.setDeleteItem}
        spacePath={spacePath}
        onProjectCreated={() => {
          // The sidebar refreshes via the existing event-driven flow.
        }}
        onActionCreated={async (project) => {
          await sidebar.loadProjectActions(project.path);
          if (sidebar.gtdSpace?.root_path) {
            await sidebar.reloadProjects(sidebar.gtdSpace.root_path);
          }
        }}
        onPageCreated={sidebar.handlePageCreated}
        onHabitCreated={sidebar.handleHabitCreated}
        onDelete={sidebar.handleDelete}
      />
    </Card>
  );
};

export default GTDWorkspaceSidebar;
