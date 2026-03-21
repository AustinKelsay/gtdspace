import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, FileText, Plus } from 'lucide-react';
import { SIDEBAR_ACTIVE_ROW_CLASSES } from './constants';
import {
  filterVisibleSectionFiles,
  getSectionFileDisplay,
  isHorizonSection,
  isPathDescendant,
} from './utils';
import { SidebarItemMenu } from './SidebarItemMenu';
import type { GTDSection, SidebarDeleteItem, SidebarSectionFileMetadata } from './types';
import type { MarkdownFile } from '@/types';

type SidebarStandardSectionProps = {
  section: GTDSection;
  sectionPath: string;
  files: MarkdownFile[];
  isExpanded: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  activeFilePath?: string | null;
  sectionFileMetadata: Record<string, SidebarSectionFileMetadata>;
  onToggleSection: (sectionId: string) => void;
  onLoadSection: (sectionPath: string, force?: boolean) => Promise<MarkdownFile[]>;
  onOpenHorizonReadme: (folderPath: string) => void;
  onOpenFile: (file: MarkdownFile, path: string) => void;
  onCreatePage: (sectionId: string) => void;
  onOpenFileLocation: (path: string) => void | Promise<void>;
  onQueueDelete: (item: SidebarDeleteItem) => void;
  isPathActive: (candidatePath?: string | null) => boolean;
};

export function SidebarStandardSection({
  section,
  sectionPath,
  files,
  isExpanded,
  isLoaded,
  isLoading,
  activeFilePath,
  sectionFileMetadata,
  onToggleSection,
  onLoadSection,
  onOpenHorizonReadme,
  onOpenFile,
  onCreatePage,
  onOpenFileLocation,
  onQueueDelete,
  isPathActive,
}: SidebarStandardSectionProps) {
  const horizonSection = isHorizonSection(section.id);
  const visibleFiles = filterVisibleSectionFiles(section.id, files);
  const showBadge = isLoaded && visibleFiles.length > 0;
  const canCreatePage =
    section.id === 'someday' ||
    section.id === 'cabinet' ||
    section.id === 'habits' ||
    horizonSection;
  const sectionReadmePath = `${sectionPath}/README.md`;
  const hasActiveChild = isPathDescendant(sectionPath, activeFilePath);
  const isSectionHeaderActive = horizonSection ? isPathActive(sectionReadmePath) : false;
  const shouldHighlightHeader = isSectionHeaderActive || (!isExpanded && hasActiveChild);

  const createButton = canCreatePage ? (
    <Button
      onClick={(event) => {
        event.stopPropagation();
        onCreatePage(section.id);
      }}
      variant="ghost"
      size="icon"
      className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      title={`Add ${section.name} Page`}
    >
      <Plus className="h-3 w-3" />
    </Button>
  ) : null;

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={() => {
        onToggleSection(section.id);
        if (!isExpanded && !isLoaded) {
          void onLoadSection(sectionPath);
        }
      }}
    >
      <div
        className={`group flex items-center justify-between p-1.5 hover:bg-accent rounded-lg transition-colors ${shouldHighlightHeader ? SIDEBAR_ACTIVE_ROW_CLASSES : ''}`}
      >
        {horizonSection ? (
          <>
            <button
              type="button"
              className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
              onClick={() => onOpenHorizonReadme(sectionPath)}
            >
              <section.icon className={`h-3.5 w-3.5 ${section.color} flex-shrink-0`} />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium text-sm truncate inline-block">{section.name}</span>
                <span className="text-[11px] text-muted-foreground truncate inline-block">
                  {section.description}
                </span>
              </div>
              {showBadge && (
                <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                  {visibleFiles.length}
                </Badge>
              )}
            </button>
            <div className="flex items-center gap-0.5">
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  title={`${isExpanded ? 'Collapse' : 'Expand'} ${section.name}`}
                >
                  <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              {createButton}
            </div>
          </>
        ) : (
          <>
            <CollapsibleTrigger className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                <section.icon className={`h-3.5 w-3.5 ${section.color} flex-shrink-0`} />
                <span className="font-medium text-sm truncate inline-block">{section.name}</span>
                {showBadge && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1 py-0 h-4">
                    {visibleFiles.length}
                  </Badge>
                )}
              </div>
            </CollapsibleTrigger>
            {createButton}
          </>
        )}
      </div>

      <CollapsibleContent>
        <div className="pl-6 pr-2 py-1 space-y-1">
          {!isLoaded && isLoading ? (
            <div className="space-y-2 py-2">
              {[...Array(2)].map((_, index) => (
                <div key={index} className="flex items-center gap-2 animate-pulse">
                  <div className="h-2.5 w-2.5 bg-muted rounded" />
                  <div className="h-3.5 bg-muted rounded flex-1 max-w-[160px]" />
                </div>
              ))}
            </div>
          ) : visibleFiles.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">No pages yet</div>
          ) : (
            visibleFiles.map((file) => {
              const display = getSectionFileDisplay(file, sectionFileMetadata);
              const isActive = isPathActive(display.path);

              return (
                <div
                  key={file.path}
                  className={`group flex items-center justify-between gap-1 px-1 py-0.5 hover:bg-accent/50 rounded text-xs ${isActive ? SIDEBAR_ACTIVE_ROW_CLASSES : ''}`}
                >
                  <div
                    className="flex items-center gap-1 flex-1 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenFile(file, display.path)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenFile(file, display.path);
                      }
                    }}
                  >
                    <FileText className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground" />
                    <span className="truncate inline-block">{display.title}</span>
                  </div>
                  <SidebarItemMenu
                    path={display.path}
                    onOpenFileLocation={onOpenFileLocation}
                    onDelete={() =>
                      onQueueDelete({
                        type: 'file',
                        path: display.path,
                        name: display.title,
                      })
                    }
                  />
                </div>
              );
            })
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
