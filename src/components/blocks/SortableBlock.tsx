/**
 * @fileoverview Sortable block component for drag-and-drop functionality
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreHorizontal, Copy, Trash2, Type } from 'lucide-react';

// Internal imports
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { BlockRenderer } from './BlockRenderer';
import { BlockTypeSelector } from './BlockTypeSelector';
import type { ContentBlock, BlockType } from '@/types/blocks';

// === TYPES ===
/**
 * Props for the SortableBlock component
 */
interface SortableBlockProps {
  /** Content block data */
  block: ContentBlock;
  /** Whether this block is currently selected */
  isSelected: boolean;
  /** Whether this block is being dragged */
  isDragging: boolean;
  /** Whether the editor is read-only */
  readOnly: boolean;
  /** Available block types */
  availableTypes: BlockType[];
  /** Whether to show the type selector */
  showTypeSelector: boolean;
  /** Callback when block is selected */
  onSelect: (blockId: string) => void;
  /** Callback when block content changes */
  onUpdate: (updates: Partial<ContentBlock>) => void;
  /** Callback when block should be removed */
  onRemove: () => void;
  /** Callback when block should be duplicated */
  onDuplicate: () => void;
  /** Callback when block type should change */
  onChangeType: (type: string) => void;
  /** Callback to show type selector */
  onShowTypeSelector: () => void;
  /** Callback to hide type selector */
  onHideTypeSelector: () => void;
  /** Whether drag and drop is enabled */
  enableDragDrop: boolean;
}

// === MAIN COMPONENT ===
/**
 * Sortable block component with drag-and-drop functionality
 * 
 * Provides a draggable block interface with:
 * - Drag handle for reordering
 * - Block type indicator and conversion
 * - Content editing and rendering
 * - Context menu for block operations
 * - Selection and focus states
 * 
 * @param props - Component props
 * @returns JSX element containing the sortable block
 * 
 * @example
 * ```tsx
 * <SortableBlock
 *   block={contentBlock}
 *   isSelected={true}
 *   isDragging={false}
 *   readOnly={false}
 *   availableTypes={blockTypes}
 *   onUpdate={handleBlockUpdate}
 *   onRemove={handleBlockRemove}
 * />
 * ```
 */
export const SortableBlock: React.FC<SortableBlockProps> = ({
  block,
  isSelected,
  isDragging,
  readOnly,
  availableTypes,
  showTypeSelector,
  onSelect,
  onUpdate,
  onRemove,
  onDuplicate,
  onChangeType,
  onShowTypeSelector,
  onHideTypeSelector,
  enableDragDrop,
}) => {
  // === LOCAL STATE ===
  const [isHovered, setIsHovered] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  // Refs
  const blockRef = useRef<HTMLDivElement>(null);
  
  // === DRAG AND DROP SETUP ===
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ 
    id: block.id,
    disabled: !enableDragDrop || readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // === HANDLERS ===
  
  /**
   * Handles block selection
   */
  const handleSelect = useCallback(() => {
    if (!isSelected) {
      onSelect(block.id);
    }
  }, [block.id, isSelected, onSelect]);

  /**
   * Handles content changes
   */
  const handleContentChange = useCallback((content: any) => {
    onUpdate({ content });
  }, [onUpdate]);

  /**
   * Handles keyboard events
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Show type selector with /
    if (event.key === '/' && event.currentTarget === event.target) {
      event.preventDefault();
      onShowTypeSelector();
    }
    
    // Delete block with Backspace if empty
    if (event.key === 'Backspace' && !block.content) {
      event.preventDefault();
      onRemove();
    }
  }, [block.content, onRemove, onShowTypeSelector]);

  /**
   * Handles mouse enter
   */
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (!readOnly) {
      setShowControls(true);
    }
  }, [readOnly]);

  /**
   * Handles mouse leave
   */
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (!isSelected && !showTypeSelector) {
      setShowControls(false);
    }
  }, [isSelected, showTypeSelector]);

  // === EFFECTS ===
  
  /**
   * Show controls when selected
   */
  useEffect(() => {
    if (isSelected && !readOnly) {
      setShowControls(true);
    } else if (!isHovered && !showTypeSelector) {
      setShowControls(false);
    }
  }, [isSelected, isHovered, showTypeSelector, readOnly]);

  // === RENDER HELPERS ===
  
  /**
   * Gets block type configuration
   */
  const getBlockTypeConfig = useCallback(() => {
    return availableTypes.find(type => type.id === block.type) || {
      id: block.type,
      name: block.type,
      icon: '?',
      description: 'Unknown block type'
    };
  }, [block.type, availableTypes]);

  /**
   * Renders the drag handle
   */
  const renderDragHandle = () => {
    if (!enableDragDrop || readOnly || !showControls) return null;
    
    return (
      <Button
        variant="ghost"
        size="sm"
        className="drag-handle opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </Button>
    );
  };

  /**
   * Renders the block type indicator
   */
  const renderTypeIndicator = () => {
    const typeConfig = getBlockTypeConfig();
    
    return (
      <Button
        variant="ghost"
        size="sm"
        className="type-indicator opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6 text-xs font-mono"
        onClick={onShowTypeSelector}
        disabled={readOnly}
        title={`Change type (${typeConfig.name})`}
        aria-label={`Block type: ${typeConfig.name}`}
      >
        {typeConfig.icon}
      </Button>
    );
  };

  /**
   * Renders the block actions menu
   */
  const renderActionsMenu = () => {
    if (readOnly || !showControls) return null;
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="actions-menu opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6"
            aria-label="Block actions"
          >
            <MoreHorizontal className="w-3 h-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onShowTypeSelector}>
            <Type className="w-4 h-4 mr-2" />
            Change Type
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="w-4 h-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={onRemove}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  /**
   * Renders the block controls
   */
  const renderControls = () => {
    return (
      <div className="block-controls flex items-center gap-1 absolute -left-12 top-1">
        {renderDragHandle()}
        {renderTypeIndicator()}
        {renderActionsMenu()}
      </div>
    );
  };

  // === MAIN RENDER ===
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'sortable-block group relative',
        'border rounded-lg transition-all duration-200',
        isSelected && 'border-primary ring-2 ring-primary/20',
        !isSelected && 'border-transparent hover:border-muted-foreground/20',
        isDragging && 'opacity-50',
        isSortableDragging && 'z-50'
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
    >
      {/* Block Controls */}
      {renderControls()}
      
      {/* Block Content */}
      <div 
        ref={blockRef}
        className={cn(
          'block-content p-3',
          isSelected && 'outline-none'
        )}
        onClick={handleSelect}
        tabIndex={0}
        role="button"
        aria-label={`${getBlockTypeConfig().name} block`}
      >
        <BlockRenderer
          block={block}
          isSelected={isSelected}
          readOnly={readOnly}
          onChange={handleContentChange}
        />
      </div>
      
      {/* Type Selector */}
      {showTypeSelector && (
        <div className="absolute top-full left-0 z-10 mt-2">
          <BlockTypeSelector
            availableTypes={availableTypes}
            currentType={block.type}
            onSelect={onChangeType}
            onCancel={onHideTypeSelector}
          />
        </div>
      )}
      
      {/* Selection Indicator */}
      {isSelected && (
        <div 
          className="absolute inset-0 pointer-events-none border-2 border-primary rounded-lg"
          aria-hidden="true" 
        />
      )}
    </div>
  );
};

// === EXPORTS ===
export default SortableBlock;