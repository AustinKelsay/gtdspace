/**
 * @fileoverview GTD-aware file item component that displays metadata
 * @author Development Team
 * @created 2024-01-XX
 */

import React, { useState, useEffect } from 'react';
import { FileText, MoreHorizontal, Edit3, Trash2, Copy, Move, Clock, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { invoke } from '@tauri-apps/api/core';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import type { FileItemProps } from '@/types';
import { mapStatusValue } from '@/utils/singleselect-block-helpers'; // Import the shared normalizer

interface GTDMetadata {
  type: 'project' | 'action' | 'regular';
  status?: string;
  dueDate?: string | null;
  effort?: string;
  description?: string;
}

/**
 * GTD-aware file item component
 * 
 * Extends the regular FileItem to recognize and display GTD metadata
 * for projects (README.md files) and actions.
 */
export const GTDFileItem: React.FC<FileItemProps> = ({
  file,
  isSelected,
  onSelect,
  onFileOperation,
  className = '',
  ...props
}) => {
  // === STATE ===
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFilePath, setNewFilePath] = useState('');
  const [gtdMetadata, setGtdMetadata] = useState<GTDMetadata>({ type: 'regular' });
  const { withErrorHandling } = useErrorHandler();

  // === GTD DETECTION ===
  
  useEffect(() => {
    const detectGTDType = async () => {
      // Check if it's a project README
      if (file.name === 'README.md' && file.path.includes('/Projects/')) {
        try {
          const content = await withErrorHandling(
            async () => await invoke<string>('read_file', { path: file.path }),
            'Failed to read project file'
          );
          
          if (content) {
            const metadata = parseProjectMetadata(content);
            setGtdMetadata({
              type: 'project',
              status: metadata.status ? mapStatusValue(metadata.status) : undefined,
              dueDate: metadata.dueDate,
              description: metadata.description
            });
          }
        } catch (error) {
          console.error('Error reading project metadata:', error);
        }
      }
      // Check if it's an action file
      else if (file.path.includes('/Projects/') && file.name !== 'README.md' && file.name.endsWith('.md')) {
        try {
          const content = await withErrorHandling(
            async () => await invoke<string>('read_file', { path: file.path }),
            'Failed to read action file'
          );
          
          if (content) {
            const metadata = parseActionMetadata(content);
            setGtdMetadata({
              type: 'action',
              status: metadata.status ? mapStatusValue(metadata.status) : undefined,
              dueDate: metadata.dueDate,
              effort: metadata.effort
            });
          }
        } catch (error) {
          console.error('Error reading action metadata:', error);
        }
      }
    };

    detectGTDType();
  }, [file.path, file.name, withErrorHandling]);

  // === METADATA PARSING ===
  
  const parseProjectMetadata = (content: string): Partial<GTDMetadata> => {
    const lines = content.split('\n');
    let status = 'in-progress';
    let dueDate = null;
    let description = '';
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('## Status')) {
        currentSection = 'status';
      } else if (trimmed.startsWith('## Due Date')) {
        currentSection = 'dueDate';
      } else if (trimmed.startsWith('## Description')) {
        currentSection = 'description';
      } else if (trimmed.startsWith('##')) {
        currentSection = '';
      } else if (trimmed && !trimmed.startsWith('#')) {
        switch (currentSection) {
          case 'status':
            status = trimmed;
            break;
          case 'dueDate':
            if (trimmed !== 'Not set') {
              dueDate = trimmed;
            }
            break;
          case 'description':
            if (!description) {
              description = trimmed;
            }
            break;
        }
      }
    }

    return { status, dueDate, description };
  };

  const parseActionMetadata = (content: string): Partial<GTDMetadata> => {
    const lines = content.split('\n');
    let status = 'in-progress';
    let dueDate = null;
    let effort = 'Medium';
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('## Status')) {
        currentSection = 'status';
      } else if (trimmed.startsWith('## Due Date')) {
        currentSection = 'dueDate';
      } else if (trimmed.startsWith('## Effort')) {
        currentSection = 'effort';
      } else if (trimmed.startsWith('##')) {
        currentSection = '';
      } else if (trimmed && !trimmed.startsWith('#')) {
        switch (currentSection) {
          case 'status':
            status = trimmed;
            break;
          case 'dueDate':
            if (trimmed !== 'Not set') {
              dueDate = trimmed;
            }
            break;
          case 'effort':
            effort = trimmed;
            break;
        }
      }
    }

    return { status, dueDate, effort };
  };

  // === FORMATTERS ===
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

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

  const getDisplayName = (fileName: string): string => {
    if (gtdMetadata.type === 'project' && fileName === 'README.md') {
      // Extract project name from path
      const pathParts = file.path.split('/');
      const projectIndex = pathParts.indexOf('Projects');
      if (projectIndex !== -1 && projectIndex < pathParts.length - 2) {
        return pathParts[projectIndex + 1];
      }
    }
    return fileName.replace(/\.(md|markdown)$/i, '');
  };

  const getStatusIcon = () => {
    switch (gtdMetadata.status?.toLowerCase()) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'in-progress':
        return <Circle className="h-4 w-4 text-blue-600" />;
      case 'waiting':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (gtdMetadata.status?.toLowerCase()) {
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getEffortBadge = () => {
    const colors = {
      'Small': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Large': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    
    return colors[gtdMetadata.effort as keyof typeof colors] || colors['Medium'];
  };

  // === EVENT HANDLERS ===
  
  const handleClick = () => {
    onSelect();
  };

  const handleRename = () => {
    const displayName = getDisplayName(file.name);
    setNewFileName(displayName);
    setShowRenameDialog(true);
  };

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

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (onFileOperation) {
      onFileOperation({
        type: 'delete',
        path: file.path,
      });
    }
    setShowDeleteDialog(false);
  };

  const handleCopy = () => {
    const displayName = getDisplayName(file.name);
    setNewFilePath(`${displayName}_copy.md`);
    setShowCopyDialog(true);
  };

  const handleConfirmCopy = () => {
    if (newFilePath.trim() && onFileOperation) {
      const parentDir = file.path.substring(0, file.path.lastIndexOf('/'));
      const destPath = `${parentDir}/${newFilePath.trim()}`;
      
      onFileOperation({
        type: 'copy',
        sourcePath: file.path,
        destPath: destPath,
      });
    }
    setShowCopyDialog(false);
    setNewFilePath('');
  };

  const handleMove = () => {
    const displayName = getDisplayName(file.name);
    setNewFilePath(displayName);
    setShowMoveDialog(true);
  };

  const handleConfirmMove = () => {
    if (newFilePath.trim() && onFileOperation) {
      const parentDir = file.path.substring(0, file.path.lastIndexOf('/'));
      const destPath = `${parentDir}/${newFilePath.trim()}`;
      
      onFileOperation({
        type: 'move',
        sourcePath: file.path,
        destPath: destPath,
      });
    }
    setShowMoveDialog(false);
    setNewFilePath('');
  };

  // === RENDER ===

  const isOverdue = gtdMetadata.dueDate && new Date(gtdMetadata.dueDate) < new Date();

  return (
    <>
      <Card 
        className={`
          border-none bg-transparent hover:bg-muted/50 transition-colors cursor-pointer
          ${isSelected ? 'bg-accent border-accent' : ''}
          ${gtdMetadata.type === 'project' ? 'border-l-4 border-l-blue-500' : ''}
          ${className}
        `}
        onClick={handleClick}
        {...props}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              {gtdMetadata.type !== 'regular' && getStatusIcon()}
              {gtdMetadata.type === 'regular' && <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">
                    {getDisplayName(file.name)}
                  </p>
                  {gtdMetadata.type === 'project' && (
                    <Badge variant="outline" className="text-xs">Project</Badge>
                  )}
                </div>
                
                {/* GTD Metadata Row */}
                {gtdMetadata.type !== 'regular' && (
                  <div className="flex items-center gap-2 mt-1">
                    {gtdMetadata.status && (
                      <Badge className={`text-xs ${getStatusColor()}`}>
                        {gtdMetadata.status}
                      </Badge>
                    )}
                    {gtdMetadata.effort && (
                      <Badge className={`text-xs ${getEffortBadge()}`}>
                        {gtdMetadata.effort}
                      </Badge>
                    )}
                    {gtdMetadata.dueDate && (
                      <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                        <Calendar className="h-3 w-3" />
                        {new Date(gtdMetadata.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
                
                {/* File metadata */}
                <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
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
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    handleCopy();
                  }}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    handleMove();
                  }}>
                    <Move className="h-4 w-4 mr-2" />
                    Move
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

      {/* Dialogs (same as original FileItem) */}
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

      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy File</DialogTitle>
            <DialogDescription>
              Enter a name for the copy of "{getDisplayName(file.name)}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="copyFileName">File Name</Label>
            <Input
              id="copyFileName"
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              placeholder="Enter file name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCopy();
                if (e.key === 'Escape') setShowCopyDialog(false);
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              The file will be copied to the same directory
            </p>
          </div>
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowCopyDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmCopy}
              disabled={!newFilePath.trim()}
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move File</DialogTitle>
            <DialogDescription>
              Enter a new name for "{getDisplayName(file.name)}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="moveFileName">File Name</Label>
            <Input
              id="moveFileName"
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              placeholder="Enter file name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmMove();
                if (e.key === 'Escape') setShowMoveDialog(false);
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              The file will be moved within the same directory
            </p>
          </div>
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowMoveDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmMove}
              disabled={!newFilePath.trim()}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GTDFileItem;