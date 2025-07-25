/**
 * @fileoverview File list component for Phase 1 file browser sidebar
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - File list with search filtering and file operations
 */

import React, { useMemo, useState } from 'react';
import { Search, Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FileItem } from './FileItem';
import type { FileListProps, FileOperation } from '@/types';

/**
 * File list component that displays markdown files with search and operations
 * 
 * This component renders a list of markdown files with search functionality,
 * file operations (create, rename, delete), and visual feedback for loading
 * states. It uses virtual scrolling for performance with large file lists.
 * 
 * @param props - Component props
 * @returns File list JSX element
 * 
 * @example
 * ```tsx
 * <FileList 
 *   files={markdownFiles}
 *   selectedFile={currentFile}
 *   onFileSelect={(file) => loadFile(file)}
 *   onFileOperation={(op) => handleFileOp(op)}
 *   searchQuery=""
 *   loading={false}
 * />
 * ```
 */
export const FileList: React.FC<FileListProps> = ({
  files,
  selectedFile,
  onFileSelect,
  onFileOperation,
  loading = false,
  searchQuery = '',
  className = '',
  ...props
}) => {
  // === CREATE FILE STATE ===
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  
  // === VIRTUALIZATION REMOVED ===
  // Virtualization removed during simplification
  
  // === FILTERED FILES ===
  
  /**
   * Filter files based on search query
   */
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    
    const query = searchQuery.toLowerCase().trim();
    return files.filter(file => 
      file.name.toLowerCase().includes(query) ||
      file.path.toLowerCase().includes(query)
    );
  }, [files, searchQuery]);

  // === EVENT HANDLERS ===
  
  /**
   * Handle create new file
   */
  const handleCreateFile = () => {
    setNewFileName('');
    setShowCreateDialog(true);
  };

  /**
   * Confirm create file operation
   */
  const handleConfirmCreate = () => {
    if (newFileName.trim() && onFileOperation) {
      // Add .md extension if not present
      let fileName = newFileName.trim();
      if (!fileName.endsWith('.md') && !fileName.includes('.')) {
        fileName += '.md';
      }
      
      onFileOperation({
        type: 'create',
        name: fileName,
      });
    }
    setShowCreateDialog(false);
    setNewFileName('');
  };

  /**
   * Handle file operation from FileItem
   */
  const handleFileOperation = (operation: FileOperation) => {
    if (onFileOperation) {
      onFileOperation(operation);
    }
  };

  // === RENDER HELPERS ===
  
  /**
   * Render empty state when no files found
   */
  const renderEmptyState = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-4">
          <span className="text-muted-foreground">Loading...</span>
        </div>
      );
    }

    if (searchQuery && filteredFiles.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Search className="h-8 w-8 text-muted-foreground mb-4" />
          <p className="text-sm font-medium mb-2">No files found</p>
          <p className="text-xs text-muted-foreground">
            Try a different search term
          </p>
        </div>
      );
    }

    if (files.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mb-4" />
          <p className="text-sm font-medium mb-2">No markdown files</p>
          <p className="text-xs text-muted-foreground mb-4">
            Create your first file to get started
          </p>
          <Button 
            size="sm" 
            onClick={handleCreateFile}
            disabled={loading}
          >
            <Plus className="h-4 w-4 mr-2" />
            New File
          </Button>
        </div>
      );
    }

    return null;
  };

  /**
   * Get file count display text
   */
  const getFileCountText = () => {
    const total = files.length;
    const filtered = filteredFiles.length;
    
    if (searchQuery && filtered !== total) {
      return `${filtered} of ${total} files`;
    }
    
    return `${total} file${total !== 1 ? 's' : ''}`;
  };

  // === RENDER ===

  return (
    <div className={`flex flex-col h-full ${className}`} {...props}>
      {/* Header with file count and create button */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex flex-col">
          <h3 className="text-sm font-medium">Files</h3>
          <p className="text-xs text-muted-foreground">
            {getFileCountText()}
          </p>
        </div>
        
        {onFileOperation && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCreateFile}
            disabled={loading}
            aria-label="Create new file"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* File list content */}
      <div className="flex-1 min-h-0">
        {filteredFiles.length > 0 ? (
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {filteredFiles.map((file) => (
                <FileItem
                  key={file.id}
                  file={file}
                  isSelected={selectedFile?.id === file.id}
                  onSelect={() => onFileSelect(file)}
                  onFileOperation={onFileOperation ? handleFileOperation : undefined}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          renderEmptyState()
        )}
      </div>

      {/* Create File Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>
              Enter a name for your new markdown file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="newFileName">File Name</Label>
            <Input
              id="createFileName"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter file name..."
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              The .md extension will be added automatically if not specified
            </p>
          </div>
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmCreate}
              disabled={!newFileName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileList;