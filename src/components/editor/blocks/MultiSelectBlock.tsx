/**
 * @fileoverview Custom BlockNote block for multiselect fields
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import { MultiSelect, Option } from '@/components/ui/multi-select';
import { GTDTagSelector } from '@/components/gtd/GTDTagSelector';
import type { MultiSelectBlockType } from '@/utils/multiselect-block-helpers';

/**
 * Minimal structural type for traversing the editor document tree
 * without relying on BlockNote internals.
 */
type EditorBlockNode = {
  id: string;
  type: string;
  props?: {
    type?: string;
    label?: string;
    [key: string]: unknown;
  };
  children?: EditorBlockNode[];
};

// Note: Status, Effort, and Project Status fields should use SingleSelectBlock
// MultiSelectBlock is only for fields that support multiple values (tags, contexts, etc.)

// Memoized renderer component for multi select blocks
const MultiSelectRenderer = React.memo(function MultiSelectRenderer(props: {
  block: { id: string; props: { type: MultiSelectBlockType; value: string; label: string; placeholder: string; maxCount: number; customOptionsJson: string } };
  editor: { document: unknown; updateBlock: (block: unknown, update: { props: Record<string, unknown> }) => void };
}) {
  const { block, editor } = props;
  const { type, value, label, placeholder, maxCount, customOptionsJson } = block.props;

  // Parse value from comma-separated string - memoized
  const parsedValue = React.useMemo(() =>
    value ? value.split(',').filter(Boolean) : [],
    [value]
  );

  // Parse custom options from JSON - memoized
  const customOptions: Option[] = React.useMemo(() => {
    try {
      return customOptionsJson ? JSON.parse(customOptionsJson) : [];
    } catch {
      return [];
    }
  }, [customOptionsJson]);

  // Get options based on type - memoized
  const options = React.useMemo((): Option[] => {
    switch (type) {
      case 'contexts':
      case 'categories':
        // Use GTDTagSelector for these types
        return [];
      case 'custom':
        return customOptions || [];
      case 'tags':
        // Tags can have custom options
        return customOptions || [];
      default:
        // Status, effort, and project-status should use SingleSelectBlock
        if (import.meta.env.DEV) {
          console.warn(`MultiSelectBlock: Type '${type}' should use SingleSelectBlock instead`);
        }
        return [];
    }
  }, [type, customOptions]);

  const handleChange = React.useCallback((newValue: string[]) => {
    // Find and update the block in the current document
    const findAndUpdateBlock = () => {
      if (!editor.document) {
        console.error('Editor document is not available');
        return false;
      }
      const blocks = editor.document as unknown as EditorBlockNode[];

      // Recursively search for the block with matching properties
      const findBlock = (nodes: EditorBlockNode[], targetId: string): EditorBlockNode | null => {
        for (const node of nodes) {
          if (node.id === targetId) {
            return node;
          }
          if (node.children && node.children.length > 0) {
            const found = findBlock(node.children, targetId);
            if (found) return found;
          }
        }
        return null;
      };

      // Try to find the block by ID first
      let targetBlock: EditorBlockNode | null = findBlock(blocks, block.id);

      // If not found by ID, try to find by content and type
      if (!targetBlock) {
        const findByContent = (nodes: EditorBlockNode[]): EditorBlockNode | null => {
          for (const n of nodes) {
            if (
              n.type === 'multiselect' &&
              n.props?.type === block.props.type &&
              n.props?.label === block.props.label
            ) {
              return n;
            }
            if (n.children && n.children.length > 0) {
              const found = findByContent(n.children);
              if (found) return found;
            }
          }
          return null;
        };
        targetBlock = findByContent(blocks);
      }

      if (targetBlock) {
        try {
          editor.updateBlock(
            targetBlock as unknown as typeof block,
            {
              props: {
                ...targetBlock.props,
                value: newValue.join(','),
              },
            }
          );
          return true;
        } catch (e) {
          console.error('Failed to update found block:', e);
          return false;
        }
      }
      return false;
    };

    // Try the update
    if (!findAndUpdateBlock()) {
      console.warn('Could not find block to update, value may not persist');
    }
  }, [block.id, block.props, editor]);

  // Use GTDTagSelector for context and category types
  if (type === 'contexts' || type === 'categories') {
    return (
      <div className="inline-block min-w-[200px] align-middle mx-1">
        {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
        <GTDTagSelector
          type={type}
          value={parsedValue}
          onValueChange={handleChange}
          placeholder={placeholder}
          maxCount={maxCount}
          className="w-full"
        />
      </div>
    );
  }

  // Use regular MultiSelect for other types
  return (
    <div className="inline-block min-w-[200px] align-middle mx-1">
      {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
      <MultiSelect
        options={options}
        value={parsedValue}
        onValueChange={handleChange}
        placeholder={placeholder || `Select ${type}...`}
        maxCount={maxCount}
        className="w-full"
      />
    </div>
  );
});

// Define prop schema with proper types
const multiSelectPropSchema = {
  type: {
    default: 'tags' as MultiSelectBlockType,
  },
  value: {
    default: '',  // Store as comma-separated string
  },
  label: {
    default: '',
  },
  placeholder: {
    default: '',
  },
  maxCount: {
    default: 0,  // 0 means no limit
  },
  customOptionsJson: {
    default: '',  // Store options as JSON string
  },
} satisfies PropSchema;

export const MultiSelectBlock = createReactBlockSpec(
  {
    type: 'multiselect' as const,
    propSchema: multiSelectPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any; // Type assertion needed for BlockNote v0.35
      return <MultiSelectRenderer block={block} editor={props.editor} />;
    },
    parse: (element) => {
      if (import.meta.env.DEV) {
        console.log('MultiSelectBlock parse called with element:', element.tagName, element.outerHTML?.substring(0, 100));
      }

      // Check for new markdown format in paragraph
      if (element.tagName === 'P') {
        const text = element.textContent || '';
        const match = text.match(/\[!multiselect:([^:]+):([^\]]*)\]/);
        if (match) {
          const type = match[1] || 'tags';
          const value = match[2] || '';

          if (['status', 'effort', 'project-status'].includes(type)) {
            console.warn(`Legacy type "${type}" found for MultiSelectBlock. These should be migrated to SingleSelectBlock. Skipping.`);
            return undefined;
          }

          // Get the label from the type
          const label = type === 'tags' ? 'Tags' :
            type === 'contexts' ? 'Contexts' :
              type === 'categories' ? 'Categories' : '';

          return {
            type,
            value,
            label,
            placeholder: '',
            maxCount: 0,
            customOptionsJson: '',
          };
        }
      }

      // Legacy support for div with data-multiselect attribute
      if (element.tagName === 'DIV' && element.getAttribute('data-multiselect')) {
        try {
          const data = JSON.parse(element.getAttribute('data-multiselect') || '{}');
          const type = data.type || 'tags';

          if (['status', 'effort', 'project-status'].includes(type)) {
            console.warn(`Legacy type "${type}" found for MultiSelectBlock. These should be migrated to SingleSelectBlock. Skipping.`);
            return undefined;
          }

          // console.log('Parsed multiselect data:', data);
          return {
            type: type,
            value: (data.value || []).join(','),
            label: data.label || '',
            placeholder: data.placeholder || '',
            maxCount: data.maxCount || 0,
            customOptionsJson: JSON.stringify(data.customOptions || []),
          };
        } catch (e) {
          console.error('Error parsing multiselect data:', e);
          return;
        }
      }
    },
    toExternalHTML: (props) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = props.block as any;
      const { type, value } = block.props;
      // Return the markdown format that can be parsed back
      const markdownFormat = `[!multiselect:${type}:${value || ''}]`;
      // Wrap in a paragraph to ensure it's preserved in the markdown
      return <p>{markdownFormat}</p>;
    },
  }
);