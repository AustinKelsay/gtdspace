/**
 * @fileoverview Conflict resolution dialog for simultaneous internal and external edits
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Advanced file conflict handling
 */

import React, { useState } from 'react';
import { AlertTriangle, FileText, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { BaseComponentProps } from '@/types';

export interface ConflictResolutionDialogProps extends BaseComponentProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** File name being resolved */
  fileName: string;
  /** Your local content */
  localContent: string;
  /** External content from file system */
  externalContent: string;
  /** Last modification time of external file */
  externalModTime?: number;
  /** Callback when resolution is chosen */
  onResolve: (resolution: ConflictResolution) => void;
  /** Callback to close dialog */
  onClose: () => void;
}

export type ConflictResolution = 
  | { action: 'keep-local' }
  | { action: 'use-external' }
  | { action: 'manual-merge'; content: string };

/**
 * Dialog component for resolving file conflicts between local and external changes
 */
export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  isOpen,
  fileName,
  localContent,
  externalContent,
  externalModTime,
  onResolve,
  onClose,
  className = '',
  ...props
}) => {
  const [selectedResolution, setSelectedResolution] = useState<string>('keep-local');
  const [mergedContent, setMergedContent] = useState<string>('');

  // === COMPUTED VALUES ===

  const hasChanges = localContent !== externalContent;
  const externalModDate = externalModTime ? new Date(externalModTime * 1000) : null;

  // === EVENT HANDLERS ===

  const handleResolve = () => {
    switch (selectedResolution) {
      case 'keep-local':
        onResolve({ action: 'keep-local' });
        break;
      case 'use-external':
        onResolve({ action: 'use-external' });
        break;
      case 'manual-merge':
        onResolve({ action: 'manual-merge', content: mergedContent });
        break;
    }
  };

  const handleResolutionChange = (value: string) => {
    setSelectedResolution(value);
    if (value === 'manual-merge' && !mergedContent) {
      // Initialize with local content for manual editing
      setMergedContent(localContent);
    }
  };

  // === UTILITY FUNCTIONS ===

  const getContentPreview = (content: string, maxLines: number = 10) => {
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content;
    return lines.slice(0, maxLines).join('\n') + `\n\n... (+${lines.length - maxLines} more lines)`;
  };

  // === RENDER ===

  if (!hasChanges) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-4xl max-h-[80vh] ${className}`} {...props}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            File Conflict: {fileName}
          </DialogTitle>
          <DialogDescription>
            This file has been modified both locally and externally. Choose how to resolve the conflict.
            {externalModDate && (
              <span className="block mt-1 text-xs">
                External modification: {externalModDate.toLocaleString()}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          <RadioGroup
            value={selectedResolution}
            onValueChange={handleResolutionChange}
            className="space-y-4"
          >
            {/* Keep Local Changes */}
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="keep-local" id="keep-local" className="mt-1" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="keep-local" className="flex items-center gap-2 font-medium">
                  <Users className="h-4 w-4 text-blue-500" />
                  Keep Your Changes
                </Label>
                <p className="text-sm text-muted-foreground">
                  Overwrite the external file with your local changes. External changes will be lost.
                </p>
                <ScrollArea className="h-32 w-full border rounded p-2 bg-muted/50">
                  <pre className="text-xs font-mono">
                    {getContentPreview(localContent)}
                  </pre>
                </ScrollArea>
              </div>
            </div>

            {/* Use External Changes */}
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="use-external" id="use-external" className="mt-1" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="use-external" className="flex items-center gap-2 font-medium">
                  <FileText className="h-4 w-4 text-green-500" />
                  Use External Changes
                </Label>
                <p className="text-sm text-muted-foreground">
                  Replace your local changes with the external file content. Your changes will be lost.
                </p>
                <ScrollArea className="h-32 w-full border rounded p-2 bg-muted/50">
                  <pre className="text-xs font-mono">
                    {getContentPreview(externalContent)}
                  </pre>
                </ScrollArea>
              </div>
            </div>

            {/* Manual Merge */}
            <div className="flex items-start space-x-2">
              <RadioGroupItem value="manual-merge" id="manual-merge" className="mt-1" />
              <div className="flex-1 space-y-2">
                <Label htmlFor="manual-merge" className="flex items-center gap-2 font-medium">
                  <Clock className="h-4 w-4 text-purple-500" />
                  Manual Merge
                </Label>
                <p className="text-sm text-muted-foreground">
                  Manually combine both versions. Edit the content below to create your merged version.
                </p>
                
                {selectedResolution === 'manual-merge' && (
                  <div className="space-y-2">
                    <Tabs defaultValue="edit" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="edit">Edit Merged</TabsTrigger>
                        <TabsTrigger value="local">Your Version</TabsTrigger>
                        <TabsTrigger value="external">External Version</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="edit" className="space-y-2">
                        <Label htmlFor="merged-content" className="text-xs font-medium">
                          Edit your merged content:
                        </Label>
                        <textarea
                          id="merged-content"
                          value={mergedContent}
                          onChange={(e) => setMergedContent(e.target.value)}
                          className="w-full h-48 p-2 border rounded font-mono text-xs resize-none"
                          placeholder="Edit your merged content here..."
                        />
                      </TabsContent>
                      
                      <TabsContent value="local">
                        <ScrollArea className="h-48 w-full border rounded p-2 bg-muted/50">
                          <pre className="text-xs font-mono">{localContent}</pre>
                        </ScrollArea>
                      </TabsContent>
                      
                      <TabsContent value="external">
                        <ScrollArea className="h-48 w-full border rounded p-2 bg-muted/50">
                          <pre className="text-xs font-mono">{externalContent}</pre>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Choose carefully - this action cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleResolve}
              disabled={selectedResolution === 'manual-merge' && !mergedContent.trim()}
            >
              Resolve Conflict
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConflictResolutionDialog;