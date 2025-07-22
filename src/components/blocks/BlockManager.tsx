/**
 * @fileoverview Block-based editing manager for Notion-style content blocks
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Plus } from 'lucide-react';

// Internal imports
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SortableBlock } from './SortableBlock';
import { BlockTypeSelector } from './BlockTypeSelector';
import type { ContentBlock, BlockType } from '@/types/blocks';

// === TYPES ===
/**
 * Props for the BlockManager component
 */
interface BlockManagerProps {
  /** Array of content blocks */
  blocks: ContentBlock[];
  /** Callback when blocks change */
  onChange: (blocks: ContentBlock[]) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to enable drag and drop */
  enableDragDrop?: boolean;
  /** Maximum number of blocks allowed */
  maxBlocks?: number;
  /** Available block types */
  availableBlockTypes?: BlockType[];
}

/**
 * Block selection state
 */
interface BlockSelection {
  /** ID of selected block */
  blockId: string | null;
  /** Selection range within block */
  range: { start: number; end: number } | null;
}

// === CONSTANTS ===
/**
 * Default block types available in the editor
 */
const DEFAULT_BLOCK_TYPES: BlockType[] = [
  { id: 'paragraph', name: 'Paragraph', icon: '¶', description: 'Plain text paragraph' },
  { id: 'heading1', name: 'Heading 1', icon: 'H1', description: 'Large heading' },
  { id: 'heading2', name: 'Heading 2', icon: 'H2', description: 'Medium heading' },
  { id: 'heading3', name: 'Heading 3', icon: 'H3', description: 'Small heading' },
  { id: 'bulleted-list', name: 'Bulleted List', icon: '•', description: 'Unordered list' },
  { id: 'numbered-list', name: 'Numbered List', icon: '1.', description: 'Ordered list' },
  { id: 'todo', name: 'To-do', icon: '☐', description: 'Task with checkbox' },
  { id: 'quote', name: 'Quote', icon: '"', description: 'Block quote' },
  { id: 'code', name: 'Code', icon: '</>', description: 'Code block' },
  { id: 'divider', name: 'Divider', icon: '—', description: 'Horizontal divider' },
];

/**
 * Maximum blocks allowed by default
 */
const DEFAULT_MAX_BLOCKS = 1000;

// === UTILITY FUNCTIONS ===
/**
 * Generates a unique block ID
 */
function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a new content block
 * 
 * @param type - Block type
 * @param content - Initial content
 * @param position - Position in the block list
 * @returns New content block
 */
function createBlock(type: string, content: any = '', position?: number): ContentBlock {
  return {
    id: generateBlockId(),
    type,
    content,
    attributes: {},
    position: position ?? 0,
    children: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// === MAIN COMPONENT ===
/**
 * Block-based editing manager component
 * 
 * Provides Notion-style block editing with drag-and-drop reordering,
 * dynamic block type switching, and hierarchical content structure.
 * 
 * Features:
 * - Drag and drop block reordering
 * - Dynamic block type conversion
 * - Keyboard navigation between blocks
 * - Block selection and manipulation
 * - Hierarchical block nesting
 * 
 * @param props - Component props
 * @returns JSX element containing the block manager
 * 
 * @example
 * ```tsx
 * <BlockManager
 *   blocks={contentBlocks}
 *   onChange={setContentBlocks}
 *   enableDragDrop={true}
 *   availableBlockTypes={customBlockTypes}
 * />
 * ```
 */
export const BlockManager: React.FC<BlockManagerProps> = ({
  blocks,
  onChange,
  readOnly = false,
  className,
  enableDragDrop = true,
  maxBlocks = DEFAULT_MAX_BLOCKS,
  availableBlockTypes = DEFAULT_BLOCK_TYPES,
}) => {
  // === LOCAL STATE ===
  const [selection, setSelection] = useState<BlockSelection>({ blockId: null, range: null });
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState<string | null>(null);
  const [isAddingBlock, setIsAddingBlock] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  // === DRAG AND DROP SETUP ===
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // === BLOCK OPERATIONS ===

  /**
   * Adds a new block at the specified position
   */
  const addBlock = useCallback((type: string, position?: number, content: any = '') => {
    if (readOnly || blocks.length >= maxBlocks) return;

    const newPosition = position ?? blocks.length;
    const newBlock = createBlock(type, content, newPosition);

    const updatedBlocks = [...blocks];
    updatedBlocks.splice(newPosition, 0, newBlock);

    // Update positions
    updatedBlocks.forEach((block, index) => {
      block.position = index;
    });

    onChange(updatedBlocks);
    setSelection({ blockId: newBlock.id, range: null });
    setIsAddingBlock(false);
  }, [blocks, onChange, readOnly, maxBlocks]);

  /**
   * Removes a block by ID
   */
  const removeBlock = useCallback((blockId: string) => {
    if (readOnly) return;

    const updatedBlocks = blocks.filter(block => block.id !== blockId);

    // Update positions
    updatedBlocks.forEach((block, index) => {
      block.position = index;
    });

    onChange(updatedBlocks);

    // Update selection
    if (selection.blockId === blockId) {
      setSelection({ blockId: null, range: null });
    }
  }, [blocks, onChange, readOnly, selection.blockId]);

  /**
   * Updates a block's content
   */
  const updateBlock = useCallback((blockId: string, updates: Partial<ContentBlock>) => {
    if (readOnly) return;

    const updatedBlocks = blocks.map(block =>
      block.id === blockId
        ? { ...block, ...updates, updatedAt: Date.now() }
        : block
    );

    onChange(updatedBlocks);
  }, [blocks, onChange, readOnly]);

  /**
   * Changes a block's type
   */
  const changeBlockType = useCallback((blockId: string, newType: string) => {
    if (readOnly) return;

    updateBlock(blockId, { type: newType });
    setShowTypeSelector(null);
  }, [updateBlock, readOnly]);

  /**
   * Duplicates a block
   */
  const duplicateBlock = useCallback((blockId: string) => {
    if (readOnly) return;

    const blockToDuplicate = blocks.find(block => block.id === blockId);
    if (!blockToDuplicate) return;

    const position = blockToDuplicate.position + 1;
    const duplicatedContent = typeof blockToDuplicate.content === 'object'
      ? { ...blockToDuplicate.content }
      : blockToDuplicate.content;

    addBlock(blockToDuplicate.type, position, duplicatedContent);
  }, [blocks, addBlock, readOnly]);

  // === DRAG AND DROP HANDLERS ===

  /**
   * Handles drag start
   */
  const handleDragStart = useCallback((event: any) => {
    setDraggedBlock(event.active.id);
  }, []);

  /**
   * Handles drag end
   */
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;

    setDraggedBlock(null);

    if (active.id !== over?.id) {
      const oldIndex = blocks.findIndex(block => block.id === active.id);
      const newIndex = blocks.findIndex(block => block.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedBlocks = arrayMove(blocks, oldIndex, newIndex);

        // Update positions
        reorderedBlocks.forEach((block, index) => {
          block.position = index;
        });

        onChange(reorderedBlocks);
      }
    }
  }, [blocks, onChange]);

  // === KEYBOARD HANDLERS ===

  /**
   * Handles global keyboard shortcuts
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (readOnly) return;

    // Add new block with Enter at the end
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      addBlock('paragraph');
    }

    // Show type selector with /
    if (event.key === '/' && selection.blockId) {
      event.preventDefault();
      setShowTypeSelector(selection.blockId);
    }
  }, [addBlock, readOnly, selection.blockId]);

  // === EFFECTS ===

  /**
   * Set up keyboard event listeners
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // === RENDER HELPERS ===

  /**
   * Renders the add block button
   */
  const renderAddBlockButton = () => {
    if (readOnly || blocks.length >= maxBlocks) return null;

    return (
      <div className="flex items-center justify-center p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAddingBlock(true)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
          Add Block
        </Button>
      </div>
    );
  };

  /**
   * Renders the block list
   */
  const renderBlocks = () => {
    if (blocks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div className="text-lg font-medium mb-2">No blocks yet</div>
          <div className="text-sm mb-4">Click "Add Block" to get started</div>
          {renderAddBlockButton()}
        </div>
      );
    }

    const blockIds = blocks.map(block => block.id);

    return (
      <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
        {blocks.map((block) => (
          <SortableBlock
            key={block.id}
            block={block}
            isSelected={selection.blockId === block.id}
            isDragging={draggedBlock === block.id}
            readOnly={readOnly}
            availableTypes={availableBlockTypes}
            showTypeSelector={showTypeSelector === block.id}
            onSelect={(blockId) => setSelection({ blockId, range: null })}
            onUpdate={(updates) => updateBlock(block.id, updates)}
            onRemove={() => removeBlock(block.id)}
            onDuplicate={() => duplicateBlock(block.id)}
            onChangeType={(type) => changeBlockType(block.id, type)}
            onShowTypeSelector={() => setShowTypeSelector(block.id)}
            onHideTypeSelector={() => setShowTypeSelector(null)}
            enableDragDrop={enableDragDrop}
          />
        ))}
      </SortableContext>
    );
  };

  // === MAIN RENDER ===

  if (enableDragDrop) {
    return (
      <div
        ref={containerRef}
        className={cn('block-manager space-y-2 p-4', className)}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          {renderBlocks()}
        </DndContext>

        {/* Add Block Button */}
        {renderAddBlockButton()}

        {/* Type Selector for New Block */}
        {isAddingBlock && (
          <BlockTypeSelector
            availableTypes={availableBlockTypes}
            onSelect={(type) => addBlock(type)}
            onCancel={() => setIsAddingBlock(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('block-manager space-y-2 p-4', className)}
    >
      {renderBlocks()}
      {renderAddBlockButton()}

      {/* Type Selector for New Block */}
      {isAddingBlock && (
        <BlockTypeSelector
          availableTypes={availableBlockTypes}
          onSelect={(type) => addBlock(type)}
          onCancel={() => setIsAddingBlock(false)}
        />
      )}
    </div>
  );
};

// === EXPORTS ===
export default BlockManager;