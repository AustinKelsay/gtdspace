/**
 * @fileoverview Block type selector component for changing block types
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Search, X } from 'lucide-react';

// Internal imports
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BlockType } from '@/types/blocks';

// === TYPES ===
/**
 * Props for the BlockTypeSelector component
 */
interface BlockTypeSelectorProps {
  /** Available block types */
  availableTypes: BlockType[];
  /** Currently selected block type */
  currentType?: string;
  /** Callback when a type is selected */
  onSelect: (type: string) => void;
  /** Callback when selection is cancelled */
  onCancel: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show search */
  showSearch?: boolean;
  /** Maximum height of the selector */
  maxHeight?: number;
}

// === CONSTANTS ===
/**
 * Categories for organizing block types
 */
const BLOCK_CATEGORIES: Record<string, string[]> = {
  'Basic': ['paragraph', 'heading1', 'heading2', 'heading3'],
  'Lists': ['bulleted-list', 'numbered-list', 'todo'],
  'Content': ['quote', 'code', 'divider'],
  'Advanced': [], // Will be filled with remaining types
};

// === MAIN COMPONENT ===
/**
 * Block type selector component
 * 
 * Provides a searchable, categorized interface for selecting block types.
 * Shows block type icons, names, descriptions, and keyboard shortcuts.
 * 
 * Features:
 * - Searchable type filtering
 * - Categorized type organization
 * - Keyboard navigation
 * - Visual type indicators
 * - Current type highlighting
 * 
 * @param props - Component props
 * @returns JSX element containing the block type selector
 * 
 * @example
 * ```tsx
 * <BlockTypeSelector
 *   availableTypes={blockTypes}
 *   currentType="paragraph"
 *   onSelect={(type) => changeBlockType(type)}
 *   onCancel={() => hideSeletor()}
 *   showSearch={true}
 * />
 * ```
 */
export const BlockTypeSelector: React.FC<BlockTypeSelectorProps> = ({
  availableTypes,
  currentType,
  onSelect,
  onCancel,
  className,
  showSearch = true,
  maxHeight = 400,
}) => {
  // === LOCAL STATE ===
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredTypes, setFilteredTypes] = useState<BlockType[]>(availableTypes);

  // Refs
  const selectorRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // === FILTERING AND SEARCH ===

  /**
   * Filters block types based on search query
   */
  const filterTypes = useCallback((query: string) => {
    if (!query.trim()) {
      setFilteredTypes(availableTypes);
      return;
    }

    const lowercaseQuery = query.toLowerCase();
    const filtered = availableTypes.filter(type =>
      type.name.toLowerCase().includes(lowercaseQuery) ||
      type.description.toLowerCase().includes(lowercaseQuery) ||
      type.id.toLowerCase().includes(lowercaseQuery)
    );

    setFilteredTypes(filtered);
    setSelectedIndex(0);
  }, [availableTypes]);

  /**
   * Handles search input changes
   */
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    filterTypes(value);
  }, [filterTypes]);

  // === KEYBOARD NAVIGATION ===

  /**
   * Handles keyboard navigation
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredTypes.length - 1));
        break;

      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;

      case 'Enter':
        event.preventDefault();
        if (filteredTypes[selectedIndex]) {
          onSelect(filteredTypes[selectedIndex].id);
        }
        break;

      case 'Escape':
        event.preventDefault();
        onCancel();
        break;

      case 'Tab':
        event.preventDefault();
        onCancel();
        break;
    }
  }, [filteredTypes, selectedIndex, onSelect, onCancel]);

  /**
   * Handles clicking outside to close
   */
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
      onCancel();
    }
  }, [onCancel]);

  // === EFFECTS ===

  /**
   * Set up keyboard and click outside listeners
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    // Focus search input
    if (showSearch && searchRef.current) {
      searchRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleKeyDown, handleClickOutside, showSearch]);

  /**
   * Scroll selected item into view
   */
  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex];
    if (selectedItem) {
      selectedItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  /**
   * Initialize filtered types
   */
  useEffect(() => {
    filterTypes(searchQuery);
  }, [filterTypes, searchQuery]);

  // === RENDER HELPERS ===

  /**
   * Renders the search input
   */
  const renderSearch = () => {
    if (!showSearch) return null;

    return (
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search block types..."
          className="pl-10 pr-8"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSearchChange('')}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  };

  /**
   * Renders a block type item
   */
  const renderTypeItem = (type: BlockType, index: number) => {
    const isSelected = index === selectedIndex;
    const isCurrent = type.id === currentType;

    return (
      <Button
        key={type.id}
        ref={(el) => (itemRefs.current[index] = el)}
        variant={isSelected ? 'secondary' : 'ghost'}
        className={cn(
          'w-full justify-start p-3 h-auto text-left',
          isSelected && 'bg-accent',
          isCurrent && 'border border-primary/50 bg-primary/5'
        )}
        onClick={() => onSelect(type.id)}
        onMouseEnter={() => setSelectedIndex(index)}
      >
        <div className="flex items-center gap-3 w-full">
          {/* Type Icon */}
          <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded border text-sm font-mono',
            isSelected ? 'bg-background border-border' : 'bg-muted border-muted-foreground/20'
          )}>
            {type.icon}
          </div>

          {/* Type Info */}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">
              {type.name}
              {isCurrent && (
                <span className="ml-2 text-xs text-primary font-normal">(current)</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1 truncate">
              {type.description}
            </div>
          </div>

          {/* Keyboard Shortcut (if available) */}
          {type.shortcut && (
            <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
              {type.shortcut}
            </div>
          )}
        </div>
      </Button>
    );
  };

  /**
   * Organizes types by category
   */
  const organizeTypesByCategory = () => {
    const organized: Record<string, BlockType[]> = {};
    const uncategorized: BlockType[] = [];

    filteredTypes.forEach(type => {
      let categorized = false;

      for (const [categoryName, categoryTypes] of Object.entries(BLOCK_CATEGORIES)) {
        if (categoryTypes.includes(type.id)) {
          if (!organized[categoryName]) {
            organized[categoryName] = [];
          }
          organized[categoryName].push(type);
          categorized = true;
          break;
        }
      }

      if (!categorized) {
        uncategorized.push(type);
      }
    });

    // Add uncategorized to Advanced category
    if (uncategorized.length > 0) {
      organized['Advanced'] = uncategorized;
    }

    return organized;
  };

  /**
   * Renders categorized types
   */
  const renderCategorizedTypes = () => {
    const organizedTypes = organizeTypesByCategory();
    let currentIndex = 0;

    return Object.entries(organizedTypes).map(([categoryName, types]) => {
      if (types.length === 0) return null;

      const categoryItems = types.map(type => {
        const item = renderTypeItem(type, currentIndex);
        currentIndex++;
        return item;
      });

      return (
        <div key={categoryName} className="mb-4 last:mb-0">
          <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
            {categoryName}
          </div>
          <div className="space-y-1">
            {categoryItems}
          </div>
        </div>
      );
    });
  };

  /**
   * Renders flat list of types (when searching)
   */
  const renderFlatTypes = () => {
    return filteredTypes.map((type, index) => renderTypeItem(type, index));
  };

  // === MAIN RENDER ===

  if (filteredTypes.length === 0) {
    return (
      <Card className={cn('w-80', className)} ref={selectorRef}>
        <CardHeader className="pb-3">
          {renderSearch()}
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <div className="text-sm">No block types found</div>
            {searchQuery && (
              <div className="text-xs mt-2">
                Try a different search term
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-80 shadow-lg', className)} ref={selectorRef}>
      <CardHeader className="pb-3">
        {renderSearch()}
      </CardHeader>
      <CardContent>
        <div
          className="max-h-96 overflow-y-auto"
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {searchQuery ? renderFlatTypes() : renderCategorizedTypes()}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t text-xs text-muted-foreground text-center">
          Use ↑↓ to navigate • Enter to select • Esc to cancel
        </div>
      </CardContent>
    </Card>
  );
};

// === EXPORTS ===
export default BlockTypeSelector;