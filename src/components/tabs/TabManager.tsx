/**
 * @fileoverview Tab manager component for Phase 2 multi-file editing
 * @author Development Team
 * @created 2024-01-XX 
 * @phase 2 - Central tab management interface
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileTab } from './FileTab';
import type { TabManagerProps } from '@/types';

/**
 * Tab manager component that handles all tab operations
 * 
 * Manages the tab bar, tab overflow scrolling, and coordinates tab actions.
 * Provides a unified interface for multi-file editing functionality.
 */
export const TabManager: React.FC<TabManagerProps> = ({
  tabState,
  onTabActivate,
  onTabClose,
  onNewTab,
  onTabAction,
  className = '',
  ...props
}) => {
  // === LOCAL STATE ===

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // === COMPUTED VALUES ===

  const hasOverflow = useMemo(() => {
    return tabState.openTabs.length > 8; // Approximate threshold for overflow
  }, [tabState.openTabs.length]);

  const tabsWithUnsavedChanges = useMemo(() => {
    return tabState.openTabs.filter(tab => tab.hasUnsavedChanges).length;
  }, [tabState.openTabs]);

  // === SCROLL HANDLING ===

  const updateScrollButtons = () => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const scrollLeft = scrollArea.scrollLeft;
    const scrollWidth = scrollArea.scrollWidth;
    const clientWidth = scrollArea.clientWidth;

    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const scrollAmount = 200;
    const newScrollLeft = direction === 'left'
      ? scrollArea.scrollLeft - scrollAmount
      : scrollArea.scrollLeft + scrollAmount;

    scrollArea.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    updateScrollButtons();
  }, [tabState.openTabs]);

  // === EVENT HANDLERS ===

  const handleTabActivate = (tabId: string) => {
    onTabActivate(tabId);
    
    // Scroll active tab into view if needed
    setTimeout(() => {
      const activeTabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
      if (activeTabElement) {
        activeTabElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'center' 
        });
      }
    }, 100);
  };

  const handleNewTab = () => {
    onNewTab?.();
  };

  // === KEYBOARD SHORTCUTS ===

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      switch (e.key) {
        case 'w':
        case 'W':
          // Ctrl+W: Close active tab
          if (tabState.activeTabId) {
            e.preventDefault();
            onTabClose(tabState.activeTabId);
          }
          break;

        case 't':
        case 'T':
          // Ctrl+T: New tab
          if (e.shiftKey) return; // Don't interfere with Ctrl+Shift+T
          e.preventDefault();
          handleNewTab();
          break;

        case 'Tab':
          // Ctrl+Tab: Next tab, Ctrl+Shift+Tab: Previous tab
          if (tabState.openTabs.length > 1) {
            e.preventDefault();
            const currentIndex = tabState.openTabs.findIndex(tab => tab.id === tabState.activeTabId);
            const nextIndex = e.shiftKey
              ? (currentIndex - 1 + tabState.openTabs.length) % tabState.openTabs.length
              : (currentIndex + 1) % tabState.openTabs.length;
            
            handleTabActivate(tabState.openTabs[nextIndex].id);
          }
          break;

        default:
          // Ctrl+1-9: Jump to tab by index
          if (e.key >= '1' && e.key <= '9') {
            const tabIndex = parseInt(e.key) - 1;
            if (tabIndex < tabState.openTabs.length) {
              e.preventDefault();
              handleTabActivate(tabState.openTabs[tabIndex].id);
            }
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tabState.activeTabId, tabState.openTabs, onTabClose, handleNewTab]);

  // === RENDER ===

  if (tabState.openTabs.length === 0) {
    return (
      <div className={`h-10 border-b border-border bg-muted/30 flex items-center justify-center ${className}`} {...props}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewTab}
          className="text-xs text-muted-foreground"
        >
          <Plus className="h-3 w-3 mr-1" />
          New File
        </Button>
      </div>
    );
  }

  return (
    <div className={`h-10 border-b border-border bg-muted/30 flex items-stretch ${className}`} {...props}>
      {/* Left scroll button */}
      {hasOverflow && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => scrollTabs('left')}
          disabled={!canScrollLeft}
          className="h-full rounded-none border-r border-border/50 flex-shrink-0"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
      )}

      {/* Tab container */}
      <div className="flex-1 relative">
        <ScrollArea
          ref={scrollAreaRef}
          className="h-full"
          onScroll={updateScrollButtons}
        >
          <div className="flex h-full">
            {tabState.openTabs.map((tab) => (
              <FileTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === tabState.activeTabId}
                onActivate={handleTabActivate}
                onClose={onTabClose}
                onContextMenu={onTabAction}
                data-tab-id={tab.id}
                className="flex-shrink-0"
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right scroll button */}
      {hasOverflow && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => scrollTabs('right')}
          disabled={!canScrollRight}
          className="h-full rounded-none border-l border-border/50 flex-shrink-0"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      )}

      {/* New tab button */}
      {onNewTab && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewTab}
          className="h-full rounded-none border-l border-border/50 flex-shrink-0 px-2"
          title="New file (Ctrl+T)"
        >
          <Plus className="h-3 w-3" />
        </Button>
      )}

      {/* Unsaved changes indicator */}
      {tabsWithUnsavedChanges > 0 && (
        <div className="flex items-center px-2 text-xs text-orange-500 border-l border-border/50">
          {tabsWithUnsavedChanges} unsaved
        </div>
      )}
    </div>
  );
};

export default TabManager;