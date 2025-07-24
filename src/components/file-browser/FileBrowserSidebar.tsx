/**
 * @fileoverview Main file browser sidebar component for Phase 1
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - Complete file browser with folder selection, search, and operations
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { FolderSelector } from './FolderSelector';
import { FileSearch } from './FileSearch';
import { FileList } from './FileList';
import type { 
  MarkdownFile, 
  FileOperation,
  AppStatePhase1 
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

      {/* Search - Only show if we have a folder selected */}
      {state.currentFolder && (
        <div className="p-3 border-b border-border">
          <FileSearch
            value={state.searchQuery}
            onChange={onSearchChange}
            placeholder="Search files..."
          />
        </div>
      )}

      {/* File List - Only show if we have a folder selected */}
      {state.currentFolder && (
        <div className="flex-1 min-h-0">
          <FileList
            files={state.files}
            selectedFile={state.currentFile}
            onFileSelect={onFileSelect}
            onFileOperation={onFileOperation}
            loading={state.isLoading}
            searchQuery={state.searchQuery}
          />
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
    </Card>
  );
};

export default FileBrowserSidebar;