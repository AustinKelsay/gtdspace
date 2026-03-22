import React from 'react';
import { Briefcase, FileText, Folder, RefreshCw, Search, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileSearch } from '@/components/file-browser/FileSearch';

export type SidebarHeaderProps = {
  projectCount: number;
  actionCount: number;
  showSearch: boolean;
  searchQuery: string;
  onToggleSearch: () => void;
  onSearchChange: (value: string) => void;
  onOpenFolderInExplorer: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
};

export function SidebarHeader({
  projectCount,
  actionCount,
  showSearch,
  searchQuery,
  onToggleSearch,
  onSearchChange,
  onOpenFolderInExplorer,
  onRefresh,
}: SidebarHeaderProps) {
  return (
    <>
      <div className="flex-shrink-0 p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-1">
            <Target className="h-4 w-4 flex-shrink-0" />
            <span className="truncate inline-block">GTD Workspace</span>
          </h3>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button
              onClick={() => void onOpenFolderInExplorer()}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Open in File Explorer"
              aria-label="Open in File Explorer"
            >
              <Folder className="h-3.5 w-3.5" />
            </Button>
            <Button
              onClick={() => void onRefresh()}
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1 min-w-0">
            <Briefcase className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate inline-block">
              {projectCount} {projectCount === 1 ? 'Project' : 'Projects'}
            </span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate inline-block">
              {actionCount} {actionCount === 1 ? 'Action' : 'Actions'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0">
        <div className="px-3 pt-2">
          <Button
            onClick={onToggleSearch}
            variant="outline"
            size="sm"
            className="w-full justify-start"
            aria-expanded={showSearch}
            aria-controls="sidebar-search-region"
          >
            <Search className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
            <span className="truncate inline-block">Search</span>
          </Button>
        </div>

        {showSearch && (
          <div id="sidebar-search-region" className="px-3 py-2">
            <FileSearch value={searchQuery} onChange={onSearchChange} placeholder="Search..." />
          </div>
        )}
      </div>
    </>
  );
}
