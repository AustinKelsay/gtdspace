/**
 * @fileoverview Sidebar component for file browser and navigation
 * @author Development Team
 * @created 2024-01-XX
 * @phase 0 - Empty sidebar shell with basic structure
 */

import React from 'react';
import { FileText, Folder, Menu, Settings } from 'lucide-react';
import type { BaseComponentProps } from '@/types';

/**
 * Props for the Sidebar component
 */
interface SidebarProps extends BaseComponentProps {
  /** Whether the sidebar is currently open */
  isOpen: boolean;
  /** Callback when sidebar toggle is requested */
  onToggle?: () => void;
}

/**
 * Sidebar component for file browser and application navigation
 * 
 * In Phase 0, this is a placeholder component that shows the basic structure
 * and styling. In Phase 1, it will contain the actual file browser functionality.
 * 
 * @param props - Sidebar configuration props
 * @returns Sidebar JSX structure
 * 
 * @example
 * ```tsx
 * <Sidebar 
 *   isOpen={true}
 *   onToggle={() => setSidebarOpen(!sidebarOpen)}
 * />
 * ```
 */
export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  className = ''
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className={`flex flex-col h-full bg-card border-r border-border ${className}`}>
      {/* Header with toggle button */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Files</h2>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={16} />
        </button>
      </header>

      {/* File Browser Area - Placeholder for Phase 1 */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-2">
          {/* Placeholder folder structure */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Folder size={16} />
            <span>No folder selected</span>
          </div>
          
          {/* Placeholder file list */}
          <div className="pl-4 space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground opacity-50">
              <FileText size={14} />
              <span>example.md</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground opacity-50">
              <FileText size={14} />
              <span>notes.md</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground opacity-50">
              <FileText size={14} />
              <span>README.md</span>
            </div>
          </div>
        </div>

        {/* Empty state message */}
        <div className="mt-8 text-center">
          <div className="text-muted-foreground text-xs">
            <p>Phase 0: Basic UI Shell</p>
            <p className="mt-1">File browser will be implemented in Phase 1</p>
          </div>
        </div>
      </div>

      {/* Footer with settings */}
      <footer className="p-4 border-t border-border">
        <button className="flex items-center gap-2 w-full p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
          <Settings size={16} />
          <span>Settings</span>
        </button>
      </footer>
    </div>
  );
};

export default Sidebar;