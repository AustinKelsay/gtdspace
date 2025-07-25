/**
 * @fileoverview Folder selection component for Phase 1 file management
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - Core folder selection functionality
 */

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Folder, FolderOpen, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
// import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { FolderSelectorProps } from '@/types';

/**
 * Folder selector component that provides folder selection dialog
 * 
 * This component handles the initial workspace setup by allowing users
 * to select a folder containing markdown files. It uses Tauri's dialog
 * API to present a native folder selection dialog.
 * 
 * @param props - Component props
 * @returns Folder selector UI element
 * 
 * @example
 * ```tsx
 * <FolderSelector 
 *   currentFolder="/Users/username/documents"
 *   onFolderSelect={(path) => console.log('Selected:', path)}
 *   loading={false}
 * />
 * ```
 */
export const FolderSelector: React.FC<FolderSelectorProps> = ({
  currentFolder,
  onFolderSelect,
  loading = false,
  className = '',
  ...props
}) => {
  // === LOCAL STATE ===
  
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualPath, setManualPath] = useState('');
  const [pathError, setPathError] = useState<string | null>(null);
  
  // === FOLDER SELECTION HANDLERS ===
  
  /**
   * Handle folder selection button click
   * First tries the native dialog, falls back to manual input
   */
  const handleSelectFolder = async () => {
    try {
      console.log('Opening folder selection dialog...');
      const folderPath = await invoke<string>('select_folder');
      console.log('Folder selected:', folderPath);
      onFolderSelect(folderPath);
    } catch (error) {
      console.log('Folder selection failed, opening manual input:', error);
      // Fall back to manual input since dialog API is temporarily unavailable
      setShowManualInput(true);
      setManualPath(currentFolder || '');
      setPathError(null);
    }
  };
  
  /**
   * Handle manual folder path submission
   */
  const handleManualSubmit = async () => {
    if (!manualPath.trim()) {
      setPathError('Please enter a folder path');
      return;
    }
    
    try {
      // Test if we can list files in this directory
      await invoke('list_markdown_files', { path: manualPath.trim() });
      onFolderSelect(manualPath.trim());
      setShowManualInput(false);
      setPathError(null);
    } catch (error) {
      setPathError(`Invalid folder path: ${error}`);
    }
  };

  // === CURRENT FOLDER DISPLAY ===
  
  /**
   * Extract folder name from full path for display
   */
  const getFolderName = (path: string): string => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  // === RENDER ===

  if (currentFolder) {
    // Show current folder with option to change
    return (
      <Card className={`border-none bg-transparent ${className}`} {...props}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {getFolderName(currentFolder)}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentFolder}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectFolder}
              disabled={loading}
              className="flex-shrink-0"
              aria-label="Change folder"
              title="Click to select a different folder"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Folder className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show initial folder selection
  return (
    <>
      <Card className={`border-dashed border-2 border-muted ${className}`} {...props}>
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <Folder className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Select a Folder</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Choose a folder containing your markdown files to get started
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleSelectFolder}
                    disabled={loading}
                    className="w-full max-w-xs"
                    data-tour="folder-selector"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Folder className="h-4 w-4 mr-2" />
                        Select Folder
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select Workspace (Ctrl+O)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
      
      {/* Manual Path Input Dialog */}
      <Dialog open={showManualInput} onOpenChange={setShowManualInput}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enter Folder Path</DialogTitle>
            <DialogDescription>
              The folder selection dialog is temporarily unavailable. Please enter the path to your folder containing markdown files manually.
            </DialogDescription>
          </DialogHeader>
          
          {pathError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{pathError}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="folderPath">Folder Path</Label>
            <Input
              id="manualFolderPath"
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              placeholder="/Users/username/Documents/markdown-files"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Examples: <br/>
              • macOS: /Users/username/Documents/markdown-files<br/>
              • Windows: C:\\Users\\username\\Documents\\markdown-files<br/>
              • Linux: /home/username/Documents/markdown-files
            </p>
          </div>
          
          <DialogFooter className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowManualInput(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleManualSubmit}
              disabled={!manualPath.trim()}
            >
              Select Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FolderSelector;