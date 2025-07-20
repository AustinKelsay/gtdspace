/**
 * @fileoverview Editor component for markdown content editing
 * @author Development Team
 * @created 2024-01-XX
 * @phase 0 - Empty editor shell with placeholder content
 */

import React from 'react';
import { FileText, Folder } from 'lucide-react';
import type { BaseComponentProps } from '@/types';

/**
 * Props for the Editor component
 */
interface EditorProps extends BaseComponentProps {
  /** Optional file path for the currently edited file */
  filePath?: string;
}

/**
 * Main editor component for markdown content
 * 
 * In Phase 0, this is a placeholder component showing the empty state.
 * In Phase 1, it will contain basic markdown editing functionality.
 * In Phase 2, it will be upgraded to rich WYSIWYG editing.
 * 
 * @param props - Editor configuration props
 * @returns Editor JSX structure
 * 
 * @example
 * ```tsx
 * <Editor filePath="/path/to/file.md" />
 * ```
 */
export const Editor: React.FC<EditorProps> = ({
  filePath,
  className = ''
}) => {
  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Editor Header */}
      <header className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          {filePath ? (
            <>
              <FileText size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {filePath.split('/').pop() || 'Untitled'}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">No file selected</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Phase 0: Setup</span>
        </div>
      </header>

      {/* Editor Content Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          {/* Empty state icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center">
            <Folder size={24} className="text-muted-foreground" />
          </div>

          {/* Empty state content */}
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Welcome to GTD Space
          </h3>
          
          <p className="text-sm text-muted-foreground mb-6">
            A cross-platform markdown editor built with Tauri, React, and TypeScript.
          </p>

          {/* Phase 0 information */}
          <div className="bg-muted/50 p-4 rounded-lg text-left">
            <h4 className="text-sm font-medium text-foreground mb-2">
              Phase 0: Setup Complete ✅
            </h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Tauri application shell</li>
              <li>• React + TypeScript frontend</li>
              <li>• Basic UI layout structure</li>
              <li>• Dark theme implementation</li>
              <li>• Rust backend foundation</li>
            </ul>
            
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <strong>Next:</strong> Phase 1 will add file management and basic markdown editing
              </p>
            </div>
          </div>

          {/* Placeholder actions */}
          <div className="mt-6 space-y-2">
            <button 
              className="w-full p-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors opacity-50 cursor-not-allowed"
              disabled
            >
              Open Folder (Phase 1)
            </button>
            <button 
              className="w-full p-2 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors opacity-50 cursor-not-allowed"
              disabled
            >
              Create New File (Phase 1)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;