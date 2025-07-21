/**
 * @fileoverview Individual file tab component for Phase 2
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Tabbed interface for multi-file editing
 */

import React, { useState, useRef } from 'react';
import { X, MoreVertical, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FileTabProps, TabAction } from '@/types';

/**
 * Individual file tab component
 * 
 * Displays a single tab with file name, unsaved indicator, and close button.
 * Provides context menu with tab actions and handles tab activation/closing.
 */
export const FileTab: React.FC<FileTabProps> = ({
  tab,
  isActive,
  onActivate,
  onClose,
  onContextMenu,
  closable = true,
  className = '',
  ...props
}) => {
  // === LOCAL STATE ===

  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const tabRef = useRef<HTMLButtonElement>(null);

  // === EVENT HANDLERS ===

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.button === 0) { // Left click
      onActivate(tab.id);
    }
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose(tab.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsContextMenuOpen(true);
  };

  const handleTabAction = (action: TabAction) => {
    onContextMenu?.(tab.id, action);
    setIsContextMenuOpen(false);
  };

  const handleMiddleClick = (e: React.MouseEvent) => {
    if (e.button === 1) { // Middle click
      e.preventDefault();
      onClose(tab.id);
    }
  };

  // === DISPLAY HELPERS ===

  const getFileName = () => {
    return tab.file.name.replace(/\.(md|markdown)$/i, '');
  };

  const getTabTitle = () => {
    return `${tab.file.name}${tab.hasUnsavedChanges ? ' (unsaved)' : ''}\n${tab.file.path}`;
  };

  // === RENDER ===

  return (
    <div
      className={`relative group ${className}`}
      onContextMenu={handleContextMenu}
      {...props}
    >
      <Button
        ref={tabRef}
        variant="ghost"
        size="sm"
        onClick={handleClick}
        onMouseDown={handleMiddleClick}
        title={getTabTitle()}
        className={`
          h-8 px-3 py-1 text-xs font-normal rounded-none border-r border-border/50
          transition-all duration-150 ease-in-out
          max-w-[200px] min-w-[100px] justify-start relative
          ${isActive
            ? 'bg-background text-foreground border-b-2 border-b-primary shadow-sm' 
            : 'bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          }
          ${tab.hasUnsavedChanges ? 'italic' : ''}
        `}
      >
        {/* File name */}
        <span className="truncate flex-1 text-left">
          {getFileName()}
        </span>

        {/* Unsaved changes indicator */}
        {tab.hasUnsavedChanges && (
          <Circle 
            className="h-2 w-2 ml-1 flex-shrink-0 fill-current text-orange-500" 
            strokeWidth={0}
          />
        )}

        {/* Close button */}
        {closable && (
          <X
            className={`
              h-3 w-3 ml-1 flex-shrink-0 rounded-sm
              transition-opacity duration-150
              ${isActive || tab.hasUnsavedChanges 
                ? 'opacity-70 hover:opacity-100' 
                : 'opacity-0 group-hover:opacity-70 hover:opacity-100'
              }
              hover:bg-muted-foreground/20
            `}
            onClick={handleCloseClick}
          />
        )}
      </Button>

      {/* Context Menu */}
      {onContextMenu && (
        <DropdownMenu open={isContextMenuOpen} onOpenChange={setIsContextMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute -right-1 top-0 h-full w-4 opacity-0 group-hover:opacity-100 rounded-none"
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => handleTabAction('close')}>
              Close
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTabAction('close-others')}>
              Close Others
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTabAction('close-to-right')}>
              Close to Right
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleTabAction('close-all')}>
              Close All
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleTabAction('copy-path')}>
              Copy Path
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTabAction('reveal-in-folder')}>
              Reveal in Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default FileTab;