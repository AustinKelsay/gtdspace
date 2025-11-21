/**
 * @fileoverview Custom BlockNote block for GTD references to Cabinet and Someday Maybe pages
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
import { checkTauriContextAsync } from '@/utils/tauri-ready';
import {
  FileText,
  Plus,
  X,
  Archive,
  Lightbulb,
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

// Define prop schema
const referencesPropSchema = {
  references: {
    default: '',  // Store as comma-separated list of file paths
  },
} satisfies PropSchema;

interface ReferenceFile {
  path: string;
  name: string;
  type: 'cabinet' | 'someday';
}

export const ReferencesBlock = createReactBlockSpec(
  {
    type: 'references' as const,
    propSchema: referencesPropSchema,
    content: 'none' as const,
  },
  {
    render: (props) => <ReferencesBlockRenderer {...props} />,
    toExternalHTML: () => {
      // For blocks with no content, return null to skip HTML serialization
      // The actual markdown conversion happens in the editor's markdown exporter
      return null;
    },
    parse: (element) => {
      // Normalize tag name for robust comparisons
      const tag = (element.tagName || '').toUpperCase();

      // 1) Never parse inside tables — let native table parsing handle these nodes
      const tableElements = ['TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'];
      if (tableElements.includes(tag)) return undefined;
      // Also skip if the element is nested anywhere inside a table
      let parent: any = element.parentElement;
      while (parent) {
        const pTag = (parent.tagName || '').toUpperCase();
        if (tableElements.includes(pTag)) return undefined;
        parent = parent.parentElement;
      }

      // 2) Only consider paragraph elements for marker-style parsing
      if (tag !== 'P') return undefined;

      // 3) Parse only if the exact marker exists; otherwise return undefined
      const text = element.textContent || '';
      const prefix = '[!references:';
      const start = text.indexOf(prefix);
      const end = text.lastIndexOf(']');
      if (start === -1 || end <= start + prefix.length) return undefined;
      const raw = text.slice(start + prefix.length, end);
      try {
        return { references: decodeURIComponent(raw) };
      } catch {
        return { references: raw };
      }
    },
  }
);

interface ReferencesRenderProps {
  block: { id: string; props: { references?: string } };
  editor: {
    document: unknown;
    updateBlock: (
      id: string,
      update: { type: 'references'; props: { references: string } }
    ) => void;
  };
}

const ReferencesBlockRenderer = React.memo(function ReferencesBlockRenderer(props: ReferencesRenderProps) {
  const { block, editor } = props;
  const { references } = block.props;

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [availableFiles, setAvailableFiles] = React.useState<ReferenceFile[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const parsedReferences = React.useMemo(() => {
    const raw = (references || '').trim();
    if (!raw || raw === '[]') return [];

    const normalize = (value: string) => value.replace(/\\/g, '/').trim();
    const uniq = new Set<string>();

    let payload = raw;
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded) payload = decoded;
    } catch {
      // not encoded
    }

    if (payload.startsWith('[')) {
      try {
        const parsed = JSON.parse(payload);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            const norm = normalize(String(item));
            if (norm) uniq.add(norm);
          });
          return Array.from(uniq);
        }
      } catch {
        // fall back to CSV below
      }
    }

    payload.split(',').forEach((entry) => {
      const norm = normalize(entry);
      if (norm) uniq.add(norm);
    });

    return Array.from(uniq);
  }, [references]);

  const loadAvailableFiles = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const spacePath = window.localStorage.getItem('gtdspace-current-path') || '';

      if (import.meta.env.VITE_DEBUG_BLOCKNOTE) {
        console.log('ReferencesBlock: Loading files, spacePath:', spacePath);
      }

      if (!spacePath) {
        console.warn('No GTD space path found in localStorage');
        setIsLoading(false);
        return;
      }

      const cabinetPath = `${spacePath}/Cabinet`;
      const somedayPath = `${spacePath}/Someday Maybe`;

      if (import.meta.env.VITE_DEBUG_BLOCKNOTE) {
        console.log('ReferencesBlock: Loading from paths:', { cabinetPath, somedayPath });
      }

      // Guard Tauri-only APIs for web/dev builds
      const inTauriContext = await checkTauriContextAsync();
      if (!inTauriContext) {
        console.warn('[ReferencesBlock] Not in Tauri context; skipping filesystem listing');
        setAvailableFiles([]);
        return;
      }

      // Dynamically import Tauri core only when in Tauri context
      const core = await import('@tauri-apps/api/core');
      const invoke = core.invoke as <T>(cmd: string, args: unknown) => Promise<T>;

      let cabinetFiles: MarkdownFile[] = [];
      let somedayFiles: MarkdownFile[] = [];

      try {
        cabinetFiles = await invoke<MarkdownFile[]>('list_markdown_files', { path: cabinetPath });
      } catch (err) {
        console.error('Failed to load Cabinet files:', err);
      }

      try {
        somedayFiles = await invoke<MarkdownFile[]>('list_markdown_files', { path: somedayPath });
      } catch (err) {
        console.error('Failed to load Someday Maybe files:', err);
      }

      if (import.meta.env.VITE_DEBUG_BLOCKNOTE) {
        console.log('ReferencesBlock: Total loaded files:', {
          cabinet: cabinetFiles.length,
          someday: somedayFiles.length
        });
      }

      const files: ReferenceFile[] = [
        ...cabinetFiles.map(f => ({
          path: f.path,
          name: f.name.replace('.md', ''),
          type: 'cabinet' as const
        })),
        ...somedayFiles.map(f => ({
          path: f.path,
          name: f.name.replace('.md', ''),
          type: 'someday' as const
        }))
      ];

      setAvailableFiles(files);
    } catch (error) {
      console.error('Failed to load reference files:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isDialogOpen) loadAvailableFiles();
  }, [isDialogOpen, loadAvailableFiles]);

  const filteredFiles = React.useMemo(() => {
    if (!searchQuery) return availableFiles;
    const query = searchQuery.toLowerCase();
    return availableFiles.filter(f => f.name.toLowerCase().includes(query));
  }, [availableFiles, searchQuery]);

  const handleAddReference = (file: ReferenceFile) => {
    if (parsedReferences.includes(file.path)) return;
    const newReferences = [...parsedReferences, file.path];
    updateReferences(newReferences);
  };

  const handleRemoveReference = (path: string) => {
    const newReferences = parsedReferences.filter(r => r !== path);
    updateReferences(newReferences);
  };

  const updateReferences = (newReferences: string[]) => {
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
          type: 'references',
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

    findAndUpdateBlock();
  };

  const handleReferenceClick = (path: string) => {
    // Defensive check: if path looks like a JSON array, parse it
    let finalPath = path;
    if (path.startsWith('[') && path.endsWith(']')) {
      try {
        const parsed = JSON.parse(path);
        if (Array.isArray(parsed) && parsed.length > 0) {
          finalPath = parsed[0];
          console.warn('[ReferencesBlock] Path was JSON array, extracted first element:', finalPath);
        }
      } catch {
        // Not valid JSON, use as-is
      }
    }
    
    window.dispatchEvent(new CustomEvent('open-reference-file', { detail: { path: finalPath } }));
  };

  const getReferenceInfo = React.useCallback((path: string): { name: string; type: 'cabinet' | 'someday' } => {
    const file = availableFiles.find((f) => f.path === path);
    const normalized = path.replace(/\\/g, '/');
    const leaf = normalized.split('/').pop() || '';

    // If the reference targets a README, show the enclosing folder name instead
    const isReadme = /^readme(\.md|\.markdown)?$/i.test(leaf);
    const parent = normalized.split('/').filter(Boolean).slice(-2, -1)[0];
    const name = isReadme && parent ? parent : leaf.replace(/\.(md|markdown)$/i, '') || 'Unknown';
    const type =
      file?.type ??
      (normalized.includes('/Cabinet/')
        ? 'cabinet'
        : normalized.includes('/Someday Maybe/')
          ? 'someday'
          : 'cabinet');
    return { name, type };
  }, [availableFiles]);

  return (
    <div className="my-2">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">References</span>
        <Button
          onClick={() => setIsDialogOpen(true)}
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title="Add Reference"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {parsedReferences.length === 0 ? (
          <span className="text-sm text-muted-foreground italic">No references added</span>
        ) : (
          parsedReferences.map((ref) => {
            const info = getReferenceInfo(ref);
            const Icon = info.type === 'cabinet' ? Archive : Lightbulb;
            const color = info.type === 'cabinet' ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800/50 dark:hover:bg-gray-700/50' : 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/20 dark:hover:bg-purple-900/30';

            return (
              <Badge
                key={ref}
                variant="secondary"
                className={`cursor-pointer group ${color} transition-colors px-3 py-1.5`}
              >
                <Icon className="h-3 w-3 mr-1.5" />
                <span onClick={() => handleReferenceClick(ref)} className="hover:underline">
                  {info.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveReference(ref); }}
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
            <DialogTitle>Add References</DialogTitle>
            <DialogDescription>
              Select Cabinet or Someday Maybe pages to reference
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search references..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          <ScrollArea className="h-[400px] border rounded-md">
            <div className="p-4">
              {isLoading ? (
                <div className="text-center text-muted-foreground py-8">Loading available references...</div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">No reference files found</div>
              ) : (
                <div className="space-y-4">
                  {filteredFiles.some(f => f.type === 'cabinet') && (
                    <>
                      <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                        <Archive className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <span>Cabinet</span>
                      </div>
                      <div className="pl-6 space-y-2 mb-6">
                        {filteredFiles
                          .filter(f => f.type === 'cabinet')
                          .map((file) => {
                            const isSelected = parsedReferences.includes(file.path);
                            return (
                              <button
                                key={file.path}
                                onClick={() => !isSelected && handleAddReference(file)}
                                disabled={isSelected}
                                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${isSelected ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'hover:bg-accent cursor-pointer'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">{file.name}</span>
                                  {isSelected && (<span className="text-xs text-muted-foreground">Added</span>)}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </>
                  )}

                  {filteredFiles.some(f => f.type === 'someday') && (
                    <>
                      <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                        <Lightbulb className="h-4 w-4 text-purple-600" />
                        <span>Someday Maybe</span>
                      </div>
                      <div className="pl-6 space-y-2">
                        {filteredFiles
                          .filter(f => f.type === 'someday')
                          .map((file) => {
                            const isSelected = parsedReferences.includes(file.path);
                            return (
                              <button
                                key={file.path}
                                onClick={() => !isSelected && handleAddReference(file)}
                                disabled={isSelected}
                                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${isSelected ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'hover:bg-accent cursor-pointer'}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">{file.name}</span>
                                  {isSelected && (<span className="text-xs text-muted-foreground">Added</span>)}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
});
