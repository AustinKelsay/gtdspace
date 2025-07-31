/**
 * @fileoverview Main file browser sidebar component for Phase 1
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - Complete file browser with folder selection, search, and operations
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Briefcase } from 'lucide-react';
import { FolderSelector } from './FolderSelector';
import { FileSearch } from './FileSearch';
import { FileList } from './FileList';
import { GTDInitDialog, GTDProjectDialog, GTDActionDialog, GTDProjectList } from '@/components/gtd';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import type { 
  MarkdownFile, 
  FileOperation,
  AppStatePhase1,
  GTDProject 
} from '@/types';

/**
 * Props for the file browser sidebar component
 */
interface FileBrowserSidebarProps {
  /** Current application state */
  state: AppStatePhase1;
  /** Callback when folder is selected */
  onFolderSelect: (folderPath: string) => void;
  /** Callback when file is selected */
  onFileSelect: (file: MarkdownFile) => void;
  /** Callback for file operations */
  onFileOperation: (operation: FileOperation) => void;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Complete file browser sidebar component
 * 
 * Combines folder selection, file search, and file list functionality
 * into a cohesive sidebar interface. Handles the complete file management
 * workflow for Phase 1 MVP.
 * 
 * @param props - Component props
 * @returns File browser sidebar JSX element
 * 
 * @example
 * ```tsx
 * <FileBrowserSidebar 
 *   state={appState}
 *   onFolderSelect={selectFolder}
 *   onFileSelect={loadFile}
 *   onFileOperation={handleFileOperation}
 *   onSearchChange={setSearchQuery}
 * />
 * ```
 */
export const FileBrowserSidebar: React.FC<FileBrowserSidebarProps> = ({
  state,
  onFolderSelect,
  onFileSelect,
  onFileOperation,
  onSearchChange,
  className = '',
}) => {
  // === GTD STATE ===
  const { gtdSpace, checkGTDSpace, loadProjects } = useGTDSpace();
  const [showGTDInit, setShowGTDInit] = React.useState(false);
  const [showProjectDialog, setShowProjectDialog] = React.useState(false);
  const [showActionDialog, setShowActionDialog] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState<GTDProject | null>(null);
  const [isGTDSpace, setIsGTDSpace] = React.useState(false);
  const [showProjects, setShowProjects] = React.useState(false);

  // Check if current folder is a GTD space
  React.useEffect(() => {
    const checkIfGTDSpace = async () => {
      if (state.currentFolder) {
        const isGTD = await checkGTDSpace(state.currentFolder);
        setIsGTDSpace(isGTD);
        if (isGTD) {
          await loadProjects(state.currentFolder);
        }
      } else {
        setIsGTDSpace(false);
      }
    };

    checkIfGTDSpace();
  }, [state.currentFolder, checkGTDSpace, loadProjects]);

  const handleGTDInitSuccess = (spacePath: string) => {
    // Reload the folder to show the new GTD structure
    onFolderSelect(spacePath);
  };

  const handleProjectSelect = (project: GTDProject) => {
    // Navigate to the project folder
    onFolderSelect(project.path);
    setShowProjects(false);
  };

  // === RENDER ===

  return (
    <Card className={`flex flex-col h-full border-r ${className}`} data-tour="file-browser">
      {/* Folder Selection */}
      <div className="p-3 border-b border-border">
        <FolderSelector
          currentFolder={state.currentFolder}
          onFolderSelect={onFolderSelect}
          loading={state.isLoading}
        />
      </div>

      {/* GTD Controls - Show if folder is selected */}
      {state.currentFolder && (
        <div className="p-3 border-b border-border space-y-2">
          {!isGTDSpace ? (
            <Button
              onClick={() => setShowGTDInit(true)}
              variant="outline"
              className="w-full justify-start"
            >
              <Briefcase className="h-4 w-4 mr-2" />
              Initialize GTD Space
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowProjects(!showProjects)}
                  variant={showProjects ? "default" : "outline"}
                  className="flex-1 justify-start"
                  size="sm"
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Projects ({gtdSpace?.projects?.length || 0})
                </Button>
                <Button
                  onClick={() => setShowProjectDialog(true)}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search - Only show if we have a folder selected and not showing projects */}
      {state.currentFolder && !showProjects && (
        <div className="p-3 border-b border-border">
          <FileSearch
            value={state.searchQuery}
            onChange={onSearchChange}
            placeholder="Search files..."
          />
        </div>
      )}

      {/* File List or Project List */}
      {state.currentFolder && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {showProjects && gtdSpace ? (
            <div className="p-3">
              <GTDProjectList
                projects={gtdSpace.projects || []}
                onSelectProject={handleProjectSelect}
                onCreateAction={(project) => {
                  setSelectedProject(project);
                  setShowActionDialog(true);
                }}
              />
            </div>
          ) : (
            <FileList
              files={state.files}
              selectedFile={state.currentFile}
              onFileSelect={onFileSelect}
              onFileOperation={onFileOperation}
              loading={state.isLoading}
              searchQuery={state.searchQuery}
            />
          )}
        </div>
      )}

      {/* Status/Error Messages */}
      {state.error && (
        <div className="p-3 border-t border-border">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-2">
            <p className="text-xs text-destructive">
              {state.error}
            </p>
          </div>
        </div>
      )}

      {/* GTD Dialogs */}
      <GTDInitDialog
        isOpen={showGTDInit}
        onClose={() => setShowGTDInit(false)}
        onSuccess={handleGTDInitSuccess}
      />
      
      {isGTDSpace && state.currentFolder && (
        <>
          <GTDProjectDialog
            isOpen={showProjectDialog}
            onClose={() => setShowProjectDialog(false)}
            spacePath={state.currentFolder}
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
            />
          )}
        </>
      )}
    </Card>
  );
};

export default FileBrowserSidebar;