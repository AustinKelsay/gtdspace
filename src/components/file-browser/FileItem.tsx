/**
 * @fileoverview Individual file list item component for Phase 1 file browser
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - File list item with metadata and operations
 */

import React, { useState } from 'react';
import { FileText, MoreHorizontal, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FileItemProps } from '@/types';

/**
 * Individual file item component for the file browser
 * 
 * Displays file metadata, selection state, and provides context menu
 * for file operations like rename and delete.
 * 
 * @param props - Component props
 * @returns File item JSX element
 * 
 * @example
 * ```tsx
 * <FileItem 
 *   file={markdownFile}
 *   isSelected={true}
 *   onSelect={() => handleFileSelect(markdownFile)}
 *   onFileOperation={(op) => handleOperation(op)}
 * />
 * ```
 */
export const FileItem: React.FC<FileItemProps> = ({
  file,
  isSelected,
  onSelect,
  onFileOperation,
  className = '',
  ...props
}) => {
  // === DIALOG STATE ===
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // === FILE METADATA FORMATTERS ===
  
  /**
   * Format file size in human readable format
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  /**
   * Format last modified date in relative format
   */
  const formatLastModified = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  };

  /**
   * Get file name without extension for display
   */
  const getDisplayName = (fileName: string): string => {
    return fileName.replace(/\.(md|markdown)$/i, '');
  };

  // === EVENT HANDLERS ===
  
  /**
   * Handle file selection click
   */
  const handleClick = () => {
    onSelect();
  };

  /**
   * Handle rename operation
   */
  const handleRename = () => {
    const displayName = getDisplayName(file.name);
    setNewFileName(displayName);
    setShowRenameDialog(true);
  };

  /**
   * Confirm rename operation
   */
  const handleConfirmRename = () => {
    if (newFileName.trim() && onFileOperation) {
      onFileOperation({
        type: 'rename',
        oldPath: file.path,
        newName: newFileName.trim(),
      });
    }
    setShowRenameDialog(false);
    setNewFileName('');
  };

  /**
   * Handle delete operation
   */
  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  /**
   * Confirm delete operation
   */
  const handleConfirmDelete = () => {
    if (onFileOperation) {
      onFileOperation({
        type: 'delete',
        path: file.path,
      });
    }
    setShowDeleteDialog(false);
  };

  // === RENDER ===

  return (
    <>
      <Card 
        className={`
          border-none bg-transparent hover:bg-muted/50 transition-colors cursor-pointer
          ${isSelected ? 'bg-accent border-accent' : ''}
          ${className}
        `}
        onClick={handleClick}
        {...props}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {getDisplayName(file.name)}
                </p>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(file.size)}</span>
                  <span>•</span>
                  <span>{formatLastModified(file.last_modified)}</span>
                </div>
              </div>
            </div>
            
            {onFileOperation && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`File operations for ${file.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    handleRename();
                  }}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Enter a new name for "{getDisplayName(file.name)}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fileName">File Name</Label>
            <Input
              id="fileName"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter file name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename();
                if (e.key === 'Escape') setShowRenameDialog(false);
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              The .md extension will be added automatically
            </p>
          </div>
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmRename}
              disabled={!newFileName.trim()}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{getDisplayName(file.name)}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FileItem;