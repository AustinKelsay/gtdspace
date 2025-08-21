/**
 * @fileoverview Custom BlockNote blocks for GTD horizon-specific references
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { PropSchema } from '@blocknote/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { invoke } from '@tauri-apps/api/core';
import {
  Plus,
  X,
  Target,
  Search
} from 'lucide-react';
import type { MarkdownFile } from '@/types';

/**
 * Minimal structural type for traversing the editor document tree
 */
type EditorBlockNode = {
  id: string;
  type: string;
  props?: {
    references?: string;
    [key: string]: unknown;
  };
  children?: EditorBlockNode[];
};

interface HorizonFile {
  path: string;
  name: string;
  horizon: 'areas' | 'goals' | 'vision' | 'purpose';
}

// Define horizon colors for consistent UI
const HORIZON_COLORS = {
  areas: 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/30',
  goals: 'bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/20 dark:hover:bg-violet-900/30',
  vision: 'bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30',
  purpose: 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/20 dark:hover:bg-purple-900/30'
};

const HORIZON_LABELS = {
  areas: 'Areas of Focus',
  goals: 'Goals',
  vision: 'Vision',
  purpose: 'Purpose & Principles'
};

// Relative directory names for each horizon within a GTD space
const HORIZON_DIRS: Record<'areas' | 'goals' | 'vision' | 'purpose', string> = {
  areas: 'Areas of Focus',
  goals: 'Goals',
  vision: 'Vision',
  purpose: 'Purpose & Principles'
};

/**
 * Normalize a filesystem-like path to a forward-slash form, removing dot segments.
 * Rejects traversal attempts by returning an empty string if `..` would escape base when joined later.
 */
function normalizePath(inputPath: string): string {
  const forwardSlashes = inputPath.replace(/\\/g, '/');
  const parts = forwardSlashes.split('/');
  const normalizedParts: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      // Defer rejection to join validation; represent as a marker here
      normalizedParts.push('..');
      continue;
    }
    normalizedParts.push(part);
  }
  let normalized = normalizedParts.join('/');
  if (forwardSlashes.startsWith('/')) normalized = '/' + normalized;
  return normalized;
}

/**
 * Safely get the GTD space path from localStorage with robust guards.
 * - Handles SSR and storage access errors
 * - Ensures a non-empty string
 * - Trims and normalizes path separators
 * - Rejects obviously suspicious values (null bytes, raw traversal)
 */
function getSafeSpacePathFromStorage(): string | null {
  if (typeof window === 'undefined') {
    console.warn('HorizonReferences: window is undefined (SSR); cannot read localStorage');
    return null;
  }
  let raw: string | null = null;
  try {
    raw = window.localStorage?.getItem('gtdspace-current-path') ?? null;
  } catch (err) {
    console.warn('HorizonReferences: failed to access localStorage (possibly disabled or quota)', err);
    return null;
  }
  if (typeof raw !== 'string') {
    console.warn('HorizonReferences: GTD space path not a string in localStorage');
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    console.warn('HorizonReferences: GTD space path is empty after trim');
    return null;
  }
  if (/\0/.test(trimmed)) {
    console.warn('HorizonReferences: GTD space path contains null byte; rejecting');
    return null;
  }
  const normalized = normalizePath(trimmed);
  if (!normalized) {
    console.warn('HorizonReferences: GTD space path normalization produced empty value');
    return null;
  }
  if (normalized.includes('/../') || normalized.endsWith('/..') || normalized.startsWith('../')) {
    console.warn('HorizonReferences: GTD space path appears to contain traversal; rejecting', { normalized });
    return null;
  }
  return normalized.replace(/\/+$/, '');
}

/**
 * Safely join a base path with a child segment ensuring the result remains within base.
 * Rejects if child is absolute or attempts traversal.
 */
function safeJoinWithinBase(basePath: string, childSegment: string): string | null {
  const base = normalizePath(basePath).replace(/\/+$/, '');
  const child = childSegment.trim();
  if (!child) {
    console.warn('HorizonReferences: child segment is empty');
    return null;
  }
  if (child.startsWith('/') || /^[A-Za-z]:\//.test(child)) {
    console.warn('HorizonReferences: child segment is absolute; rejecting', { child });
    return null;
  }
  if (child.includes('..')) {
    console.warn('HorizonReferences: child segment contains traversal; rejecting', { child });
    return null;
  }
  const joined = `${base}/${child}`;
  const normalizedJoined = normalizePath(joined);
  if (!normalizedJoined || !(normalizedJoined === base || normalizedJoined.startsWith(base + '/'))) {
    console.warn('HorizonReferences: composed path escapes base; rejecting', { base, child, normalizedJoined });
    return null;
  }
  return normalizedJoined;
}

// Base component for horizon references
interface HorizonReferencesProps {
  block: { id: string; props: { references?: string } };
  editor: {
    document: unknown;
    updateBlock: (
      id: string,
      update: { type: string; props: { references: string } }
    ) => void;
  };
  horizonType: 'areas' | 'goals' | 'vision' | 'purpose';
  allowedHorizons: Array<'areas' | 'goals' | 'vision' | 'purpose'>;
  label: string;
}

/**
 * Base props provided to BlockNote React block renderers that we rely on.
 * Includes optional React presentation props to avoid using `any` during spreads.
 */
interface HorizonBlockRenderProps {
  block: { id: string; props: { references?: string } };
  editor: {
    document: unknown;
    updateBlock: (
      id: string,
      update: { type: string; props: { references: string } }
    ) => void;
  };
  children?: React.ReactNode;
  className?: string;
}

/**
 * Map the BlockNote renderer props to the minimal, explicit props we use.
 */
function toHorizonBlockRenderProps(
  incomingProps: unknown
): HorizonBlockRenderProps {
  const p = incomingProps as {
    block: { id: string; props?: { references?: string } };
    editor: { document: unknown; updateBlock: (...args: unknown[]) => unknown };
    children?: React.ReactNode;
    className?: string;
  };

  return {
    block: {
      id: p.block.id,
      props: { references: p.block.props?.references },
    },
    editor: {
      document: p.editor.document,
      updateBlock: (id, update) => {
        (p.editor.updateBlock as unknown as (a: unknown, b: unknown) => unknown)(
          id,
          update
        );
      },
    },
    children: p.children,
    className: p.className,
  };
}

function HorizonReferencesRenderer(props: HorizonReferencesProps) {
  const { block, editor, horizonType, allowedHorizons, label } = props;
  const { references } = block.props;

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [availableFiles, setAvailableFiles] = React.useState<HorizonFile[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  // Parse references from comma-separated string
  const parsedReferences = references ? references.split(',').filter(Boolean) : [];

  // Load available horizon files
  const loadAvailableFiles = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const spacePath = getSafeSpacePathFromStorage();
      if (!spacePath) {
        console.warn('HorizonReferences: aborting load; invalid or missing GTD space path');
        setIsLoading(false);
        return;
      }

      const allFiles: HorizonFile[] = [];

      // Load files from each allowed horizon
      for (const horizon of allowedHorizons) {
        const subDir = HORIZON_DIRS[horizon];
        const horizonPath = safeJoinWithinBase(spacePath, subDir);
        if (!horizonPath) {
          console.warn('HorizonReferences: skipping horizon due to unsafe path resolution', { horizon, base: spacePath, subDir });
          continue;
        }

        try {
          const files = await invoke<MarkdownFile[]>('list_markdown_files', { path: horizonPath });
          const horizonFiles = files
            .filter(f => !f.name.toLowerCase().includes('readme'))
            .map(f => ({
              path: f.path,
              name: f.name.replace('.md', ''),
              horizon
            }));
          allFiles.push(...horizonFiles);
        } catch (err) {
          console.error(`Failed to load ${HORIZON_LABELS[horizon]} files:`, err);
        }
      }

      setAvailableFiles(allFiles);
    } catch (error) {
      console.error('Failed to load horizon files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [allowedHorizons]);

  // Load files when dialog opens
  React.useEffect(() => {
    if (isDialogOpen) loadAvailableFiles();
  }, [isDialogOpen, loadAvailableFiles]);

  // Filter files based on search
  const filteredFiles = React.useMemo(() => {
    if (!searchQuery) return availableFiles;
    const query = searchQuery.toLowerCase();
    return availableFiles.filter(f =>
      f.name.toLowerCase().includes(query)
    );
  }, [availableFiles, searchQuery]);

  // Group files by horizon
  const groupedFiles = React.useMemo(() => {
    const groups: Record<string, HorizonFile[]> = {};
    for (const file of filteredFiles) {
      if (!groups[file.horizon]) groups[file.horizon] = [];
      groups[file.horizon].push(file);
    }
    return groups;
  }, [filteredFiles]);

  const handleAddReference = (file: HorizonFile) => {
    if (parsedReferences.includes(file.path)) return;

    const newReferences = [...parsedReferences, file.path];
    const didUpdate = updateReferences(newReferences);
    if (!didUpdate) {
      console.error('Failed to add reference; update did not apply', {
        blockId: block.id,
        horizonType,
        file
      });
    }
  };

  const handleRemoveReference = (path: string) => {
    const newReferences = parsedReferences.filter(r => r !== path);
    const didUpdate = updateReferences(newReferences);
    if (!didUpdate) {
      console.error('Failed to remove reference; update did not apply', {
        blockId: block.id,
        horizonType,
        path
      });
    }
  };

  const updateReferences = (newReferences: string[]): boolean => {
    const findAndUpdateBlock = () => {
      if (!editor.document) {
        console.error('Editor document is not available');
        return false;
      }
      const blocks = editor.document as unknown as EditorBlockNode[];

      for (const docBlock of blocks) {
        if (updateBlockRecursive(docBlock)) return true;
      }
      return false;
    };

    const updateBlockRecursive = (node: EditorBlockNode): boolean => {
      if (node.id === block.id) {
        editor.updateBlock(block.id, {
          type: `${horizonType}-references`,
          props: { references: newReferences.join(',') }
        });
        return true;
      }

      if (node.children) {
        for (const child of node.children) {
          if (updateBlockRecursive(child)) return true;
        }
      }

      return false;
    };

    const didUpdate = findAndUpdateBlock();
    if (!didUpdate) {
      console.error('Failed to update references: target block not found', {
        blockId: block.id,
        horizonType,
        newReferences
      });
    }
    return didUpdate;
  };

  const handleReferenceClick = (path: string) => {
    window.dispatchEvent(new CustomEvent('open-reference-file', {
      detail: { path }
    }));
  };

  // Get display info for a reference path
  const getReferenceInfo = (path: string): { name: string; horizon: string } => {
    const file = availableFiles.find(f => f.path === path);
    if (file) return { name: file.name, horizon: file.horizon };

    const normalized = path.replace(/\\/g, '/');
    const name = normalized.split('/').pop()?.replace(/\.md$/i, '') || 'Unknown';

    let horizon = 'areas';
    if (normalized.includes('/Areas of Focus/')) horizon = 'areas';
    else if (normalized.includes('/Goals/')) horizon = 'goals';
    else if (normalized.includes('/Vision/')) horizon = 'vision';
    else if (normalized.includes('/Purpose & Principles/')) horizon = 'purpose';

    return { name, horizon };
  };

  return (
    <div className="my-2">
      <div className="flex items-center gap-2 mb-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
        <Button
          onClick={() => setIsDialogOpen(true)}
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title={`Add ${label}`}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {parsedReferences.length === 0 ? (
          <span className="text-sm text-muted-foreground italic">No {label.toLowerCase()} linked</span>
        ) : (
          parsedReferences.map((ref) => {
            const info = getReferenceInfo(ref);
            const color = HORIZON_COLORS[info.horizon as keyof typeof HORIZON_COLORS];

            return (
              <Badge
                key={ref}
                variant="secondary"
                className={`cursor-pointer group ${color} transition-colors px-3 py-1.5`}
              >
                <Target className="h-3 w-3 mr-1.5" />
                <span
                  onClick={() => handleReferenceClick(ref)}
                  className="hover:underline"
                >
                  {info.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveReference(ref);
                  }}
                  className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove reference"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add {label}</DialogTitle>
            <DialogDescription>
              Select horizon items to reference
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          <ScrollArea className="h-[400px] border rounded-md">
            <div className="p-4">
              {isLoading ? (
                <div className="text-center text-muted-foreground py-8">
                  Loading available items...
                </div>
              ) : Object.keys(groupedFiles).length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No items found
                </div>
              ) : (
                <div className="space-y-4">
                  {allowedHorizons.map(horizon => {
                    const files = groupedFiles[horizon];
                    if (!files || files.length === 0) return null;

                    return (
                      <div key={horizon}>
                        <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                          <Target className="h-4 w-4" />
                          <span>{HORIZON_LABELS[horizon]}</span>
                        </div>
                        <div className="pl-6 space-y-2 mb-6">
                          {files.map((file) => {
                            const isSelected = parsedReferences.includes(file.path);
                            return (
                              <button
                                key={file.path}
                                onClick={() => !isSelected && handleAddReference(file)}
                                disabled={isSelected}
                                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${isSelected
                                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                  : 'hover:bg-accent cursor-pointer'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">{file.name}</span>
                                  {isSelected && (
                                    <span className="text-xs text-muted-foreground">Added</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Define prop schema for each reference type
const horizonReferencesPropSchema = {
  references: {
    default: '',  // Store as comma-separated list of file paths
  },
} satisfies PropSchema;

// Areas References Block (for Projects)
export const AreasReferencesBlock = createReactBlockSpec(
  {
    type: 'areas-references' as const,
    propSchema: horizonReferencesPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toHorizonBlockRenderProps(props);
      return (
        <HorizonReferencesRenderer
          {...baseProps}
          horizonType="areas"
          allowedHorizons={['areas']}
          label="Related Areas of Focus"
        />
      );
    },
    toExternalHTML: () => null,
    parse: (element) => {
      const textContent = element.textContent || '';
      const match = textContent.match(/\[!areas-references:([^\]]*)\]/);
      if (match) {
        return { references: match[1] || '' };
      }
      return { references: '' };
    },
  }
);

// Goals References Block (for Projects and Areas)
export const GoalsReferencesBlock = createReactBlockSpec(
  {
    type: 'goals-references' as const,
    propSchema: horizonReferencesPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toHorizonBlockRenderProps(props);
      return (
        <HorizonReferencesRenderer
          {...baseProps}
          horizonType="goals"
          allowedHorizons={['goals']}
          label="Related Goals"
        />
      );
    },
    toExternalHTML: () => null,
    parse: (element) => {
      const textContent = element.textContent || '';
      const match = textContent.match(/\[!goals-references:([^\]]*)\]/);
      if (match) {
        return { references: match[1] || '' };
      }
      return { references: '' };
    },
  }
);

// Vision References Block (for Areas and Goals)
export const VisionReferencesBlock = createReactBlockSpec(
  {
    type: 'vision-references' as const,
    propSchema: horizonReferencesPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toHorizonBlockRenderProps(props);
      return (
        <HorizonReferencesRenderer
          {...baseProps}
          horizonType="vision"
          allowedHorizons={['vision']}
          label="Related Vision"
        />
      );
    },
    toExternalHTML: () => null,
    parse: (element) => {
      const textContent = element.textContent || '';
      const match = textContent.match(/\[!vision-references:([^\]]*)\]/);
      if (match) {
        return { references: match[1] || '' };
      }
      return { references: '' };
    },
  }
);

// Purpose References Block (for Areas, Goals, and Vision)
export const PurposeReferencesBlock = createReactBlockSpec(
  {
    type: 'purpose-references' as const,
    propSchema: horizonReferencesPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => {
      const baseProps = toHorizonBlockRenderProps(props);
      return (
        <HorizonReferencesRenderer
          {...baseProps}
          horizonType="purpose"
          allowedHorizons={['purpose']}
          label="Related Purpose & Principles"
        />
      );
    },
    toExternalHTML: () => null,
    parse: (element) => {
      const textContent = element.textContent || '';
      const match = textContent.match(/\[!purpose-references:([^\]]*)\]/);
      if (match) {
        return { references: match[1] || '' };
      }
      return { references: '' };
    },
  }
);