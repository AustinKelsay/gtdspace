import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { HorizonFile as HookHorizonFile } from '@/hooks/useHorizonsRelationships';
import { norm } from '@/utils/path';
import { Layers3, Link2, Network, Sparkles, Waypoints } from 'lucide-react';

interface HorizonGraph {
  nodes: Array<{ id: string; label: string; level: string; group: number }>;
  edges: Array<{ from: string; to: string }>;
}

interface RelatedFiles {
  parents: HookHorizonFile[];
  children: HookHorizonFile[];
  siblings: HookHorizonFile[];
}

interface HorizonRelationshipMapProps {
  allFilesByLevel: Record<string, HookHorizonFile[]>;
  visibleFilesByLevel: Record<string, HookHorizonFile[]>;
  graph: HorizonGraph;
  selectedLevel?: string;
  selectedNodePath?: string | null;
  findRelated?: (filePath: string) => RelatedFiles;
  onSelectNode?: (filePath: string) => void;
  onOpenFile?: (file: HookHorizonFile) => void;
}

const LEVEL_ORDER = [
  'Purpose & Principles',
  'Vision',
  'Goals',
  'Areas of Focus',
  'Projects',
] as const;

const LEVEL_META: Record<string, { accent: string; fill: string; mutedFill: string }> = {
  'Purpose & Principles': {
    accent: '#a855f7',
    fill: 'rgba(168, 85, 247, 0.18)',
    mutedFill: 'rgba(168, 85, 247, 0.08)',
  },
  'Vision': {
    accent: '#2563eb',
    fill: 'rgba(37, 99, 235, 0.18)',
    mutedFill: 'rgba(37, 99, 235, 0.08)',
  },
  'Goals': {
    accent: '#16a34a',
    fill: 'rgba(22, 163, 74, 0.18)',
    mutedFill: 'rgba(22, 163, 74, 0.08)',
  },
  'Areas of Focus': {
    accent: '#ea580c',
    fill: 'rgba(234, 88, 12, 0.18)',
    mutedFill: 'rgba(234, 88, 12, 0.08)',
  },
  'Projects': {
    accent: '#dc2626',
    fill: 'rgba(220, 38, 38, 0.18)',
    mutedFill: 'rgba(220, 38, 38, 0.08)',
  },
};

const NODE_WIDTH = 196;
const NODE_HEIGHT = 44;
const COLUMN_WIDTH = 252;
const PADDING_X = 42;
const PADDING_Y = 66;
const ROW_GAP = 72;

const truncateLabel = (value: string, max = 24): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const isActivationKey = (key: string): boolean => key === 'Enter' || key === ' ';
const normalizePathKey = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const normalized = norm(value);
  return typeof normalized === 'string' ? normalized : value;
};

const sortFiles = (files: HookHorizonFile[] = []): HookHorizonFile[] =>
  [...files].sort((a, b) => a.name.localeCompare(b.name));

const buildFileLookup = (filesByLevel: Record<string, HookHorizonFile[]>): Map<string, HookHorizonFile> => {
  const lookup = new Map<string, HookHorizonFile>();
  LEVEL_ORDER.forEach((level) => {
    (filesByLevel[level] ?? []).forEach((file) => {
      const normalizedPath = normalizePathKey(file.path);
      if (normalizedPath) {
        lookup.set(normalizedPath, file);
      }
    });
  });
  return lookup;
};

const renderInspectorSection = (
  label: string,
  items: HookHorizonFile[],
  visiblePaths: Set<string>,
  onSelectNode?: (filePath: string) => void,
  onOpenFile?: (file: HookHorizonFile) => void
) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <Badge variant="outline">{items.length}</Badge>
    </div>
    {items.length === 0 ? (
      <p className="text-sm text-muted-foreground">None</p>
    ) : (
      <div className="space-y-2">
        {items.map((item) => (
          <Button
            key={`${label}-${item.path}`}
            variant="ghost"
            className="h-auto w-full justify-start rounded-lg border border-border/50 px-3 py-2 text-left"
            onClick={() => {
              const normalizedItemPath = normalizePathKey(item.path);
              if (normalizedItemPath && visiblePaths.has(normalizedItemPath)) {
                onSelectNode?.(item.path);
              }
              onOpenFile?.(item);
            }}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{item.name.replace(/\.(md|markdown)$/i, '')}</div>
              <div className="truncate text-xs text-muted-foreground">{item.horizonLevel}</div>
            </div>
          </Button>
        ))}
      </div>
    )}
  </div>
);

export const HorizonRelationshipMap: React.FC<HorizonRelationshipMapProps> = ({
  allFilesByLevel,
  visibleFilesByLevel,
  graph,
  selectedLevel = 'All',
  selectedNodePath,
  findRelated,
  onSelectNode,
  onOpenFile,
}) => {
  const allLookup = React.useMemo(() => buildFileLookup(allFilesByLevel), [allFilesByLevel]);
  const visibleLookup = React.useMemo(() => buildFileLookup(visibleFilesByLevel), [visibleFilesByLevel]);
  const normalizedSelectedNodePath = React.useMemo(
    () => normalizePathKey(selectedNodePath),
    [selectedNodePath]
  );

  const allPaths = React.useMemo(() => new Set(allLookup.keys()), [allLookup]);
  const visiblePaths = React.useMemo(() => new Set(visibleLookup.keys()), [visibleLookup]);
  const visibleSelectedNodePath = React.useMemo(
    () =>
      normalizedSelectedNodePath && visiblePaths.has(normalizedSelectedNodePath)
        ? normalizedSelectedNodePath
        : null,
    [normalizedSelectedNodePath, visiblePaths]
  );

  const normalizedEdges = React.useMemo(
    () =>
      graph.edges
        .map((edge) => ({
          from: normalizePathKey(edge.from),
          to: normalizePathKey(edge.to),
        }))
        .filter((edge): edge is { from: string; to: string } => !!edge.from && !!edge.to),
    [graph.edges]
  );

  const allEdges = React.useMemo(
    () => normalizedEdges.filter((edge) => allPaths.has(edge.from) && allPaths.has(edge.to)),
    [allPaths, normalizedEdges]
  );

  const visibleEdges = React.useMemo(
    () => normalizedEdges.filter((edge) => visiblePaths.has(edge.from) && visiblePaths.has(edge.to)),
    [normalizedEdges, visiblePaths]
  );

  const positions = React.useMemo(() => {
    const next = new Map<string, { x: number; y: number; level: string }>();
    const maxRows = Math.max(
      ...LEVEL_ORDER.map((level) => Math.max(sortFiles(visibleFilesByLevel[level]).length, 1)),
      1
    );

    LEVEL_ORDER.forEach((level, columnIndex) => {
      const files = sortFiles(visibleFilesByLevel[level]);
      const columnHeight = Math.max(files.length - 1, 0) * ROW_GAP;
      const offsetY = PADDING_Y + ((maxRows - 1) * ROW_GAP - columnHeight) / 2;
      files.forEach((file, rowIndex) => {
        const normalizedPath = normalizePathKey(file.path);
        if (normalizedPath) {
          next.set(normalizedPath, {
            x: PADDING_X + columnIndex * COLUMN_WIDTH + COLUMN_WIDTH / 2,
            y: offsetY + rowIndex * ROW_GAP,
            level,
          });
        }
      });
    });

    return next;
  }, [visibleFilesByLevel]);

  const maxRows = React.useMemo(
    () => Math.max(...LEVEL_ORDER.map((level) => Math.max((visibleFilesByLevel[level] ?? []).length, 1)), 1),
    [visibleFilesByLevel]
  );
  const svgWidth = PADDING_X * 2 + LEVEL_ORDER.length * COLUMN_WIDTH;
  const svgHeight = Math.max(340, PADDING_Y * 2 + NODE_HEIGHT + Math.max(maxRows - 1, 0) * ROW_GAP);

  const selectedFile = normalizedSelectedNodePath ? allLookup.get(normalizedSelectedNodePath) ?? null : null;
  const related = normalizedSelectedNodePath && findRelated ? findRelated(normalizedSelectedNodePath) : null;

  if (allEdges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Relationship Map
          </CardTitle>
          <CardDescription>Visual connections between your horizons</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20">
            <div className="text-center">
              <Layers3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No horizon relationships yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add references between horizons to see the map populate.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (visibleEdges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Relationship Map
          </CardTitle>
          <CardDescription>Visual connections between your horizons</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20">
            <div className="text-center">
              <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No relationships match the current filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Adjust search or filter settings to bring linked items back into view.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Relationship Map
            </CardTitle>
            <CardDescription>Visual connections between your horizons</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{visibleEdges.length} links</Badge>
            <Badge variant="outline">{visiblePaths.size} visible nodes</Badge>
            {selectedLevel !== 'All' && (
              <Badge variant="secondary">Focused on {selectedLevel}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-border/70 bg-card/50 p-3">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {LEVEL_ORDER.map((level) => {
                const meta = LEVEL_META[level];
                const muted = selectedLevel !== 'All' && selectedLevel !== level;
                return (
                  <div key={level} className={cn('flex items-center gap-2 text-xs', muted && 'opacity-50')}>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: meta.accent }}
                    />
                    <span>{level}</span>
                  </div>
                );
              })}
            </div>

            <div className="overflow-x-auto">
              <svg
                aria-label="Horizon relationship map"
                className="min-w-[1120px]"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                role="img"
              >
                {LEVEL_ORDER.map((level, index) => {
                  const columnX = PADDING_X + index * COLUMN_WIDTH + COLUMN_WIDTH / 2;
                  const meta = LEVEL_META[level];
                  const dimmed = selectedLevel !== 'All' && selectedLevel !== level;
                  return (
                    <g key={`column-${level}`}>
                      <text
                        x={columnX}
                        y={28}
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight="700"
                        fill={meta.accent}
                        opacity={dimmed ? 0.38 : 0.92}
                      >
                        {level}
                      </text>
                    </g>
                  );
                })}

                {visibleEdges.map((edge) => {
                  const from = positions.get(edge.from);
                  const to = positions.get(edge.to);
                  if (!from || !to) {
                    return null;
                  }

                  const isSelectedEdge =
                    visibleSelectedNodePath != null &&
                    (edge.from === visibleSelectedNodePath || edge.to === visibleSelectedNodePath);
                  const touchesFocusedLevel =
                    selectedLevel === 'All' ||
                    from.level === selectedLevel ||
                    to.level === selectedLevel;
                  const leftToRight = from.x <= to.x;
                  const startX = leftToRight ? from.x + NODE_WIDTH / 2 : from.x - NODE_WIDTH / 2;
                  const endX = leftToRight ? to.x - NODE_WIDTH / 2 : to.x + NODE_WIDTH / 2;
                  const controlOffset = Math.max(Math.abs(endX - startX) * 0.5, 72);

                  return (
                    <path
                      key={`${edge.from}-${edge.to}`}
                      d={`M ${startX} ${from.y} C ${startX + (leftToRight ? controlOffset : -controlOffset)} ${from.y}, ${endX - (leftToRight ? controlOffset : -controlOffset)} ${to.y}, ${endX} ${to.y}`}
                      fill="none"
                      stroke={isSelectedEdge ? '#38bdf8' : '#64748b'}
                      strokeOpacity={visibleSelectedNodePath ? (isSelectedEdge ? 0.9 : 0.12) : (touchesFocusedLevel ? 0.44 : 0.14)}
                      strokeWidth={isSelectedEdge ? 3 : 1.5}
                    />
                  );
                })}

                {LEVEL_ORDER.flatMap((level) => {
                  const meta = LEVEL_META[level];
                  return sortFiles(visibleFilesByLevel[level]).map((file) => {
                    const normalizedFilePath = normalizePathKey(file.path);
                    if (!normalizedFilePath) {
                      return null;
                    }

                    const position = positions.get(normalizedFilePath);
                    if (!position) {
                      return null;
                    }

                    const isSelected = visibleSelectedNodePath === normalizedFilePath;
                    const isConnected =
                      !!visibleSelectedNodePath &&
                      visibleEdges.some(
                        (edge) =>
                          (edge.from === visibleSelectedNodePath && edge.to === normalizedFilePath) ||
                          (edge.to === visibleSelectedNodePath && edge.from === normalizedFilePath)
                      );
                    const dimmed = selectedLevel !== 'All' && selectedLevel !== level;
                    const fill = isSelected
                      ? meta.accent
                      : isConnected
                        ? meta.fill
                        : dimmed
                          ? meta.mutedFill
                          : 'hsl(var(--card))';
                    const stroke = isSelected ? 'hsl(var(--background))' : meta.accent;

                    return (
                      <g
                        key={file.path}
                        aria-label={file.name.replace(/\.(md|markdown)$/i, '')}
                        className="cursor-pointer"
                        onClick={() => {
                          onSelectNode?.(file.path);
                          onOpenFile?.(file);
                        }}
                        onKeyDown={(event) => {
                          if (!isActivationKey(event.key)) {
                            return;
                          }
                          event.preventDefault();
                          onSelectNode?.(file.path);
                          onOpenFile?.(file);
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <rect
                          x={position.x - NODE_WIDTH / 2}
                          y={position.y - NODE_HEIGHT / 2}
                          width={NODE_WIDTH}
                          height={NODE_HEIGHT}
                          rx={14}
                          fill={fill}
                          opacity={visibleSelectedNodePath ? (isSelected || isConnected ? 1 : 0.68) : (dimmed ? 0.52 : 0.95)}
                          stroke={stroke}
                          strokeWidth={isSelected ? 2.5 : 1.2}
                        />
                        <text
                          x={position.x}
                          y={position.y + 5}
                          textAnchor="middle"
                          fontSize="12.5"
                          fontWeight={isSelected ? '700' : '600'}
                          fill={isSelected ? 'hsl(var(--background))' : 'hsl(var(--foreground))'}
                          opacity={visibleSelectedNodePath ? (isSelected || isConnected ? 1 : 0.62) : (dimmed ? 0.58 : 0.92)}
                        >
                          {truncateLabel(file.name.replace(/\.(md|markdown)$/i, ''))}
                        </text>
                      </g>
                    );
                  });
                })}
              </svg>
            </div>
          </div>

          <Card className="border-border/70 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Waypoints className="h-4 w-4" />
                {selectedFile ? selectedFile.name.replace(/\.(md|markdown)$/i, '') : 'Inspector'}
              </CardTitle>
              <CardDescription>
                {selectedFile
                  ? `${selectedFile.horizonLevel} relationships`
                  : 'Select a node to inspect parents, children, and siblings.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedFile && related ? (
                <ScrollArea className="h-[360px] pr-4">
                  <div className="space-y-5">
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{selectedFile.horizonLevel}</p>
                          <p className="text-xs text-muted-foreground">{selectedFile.path}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenFile?.(selectedFile)}
                        >
                          <Link2 className="mr-2 h-3.5 w-3.5" />
                          Open
                        </Button>
                      </div>
                      {selectedFile.content && (
                        <p className="mt-3 text-sm text-muted-foreground">{selectedFile.content}</p>
                      )}
                    </div>

                    {renderInspectorSection('Parents', related.parents, visiblePaths, onSelectNode, onOpenFile)}
                    {renderInspectorSection('Children', related.children, visiblePaths, onSelectNode, onOpenFile)}
                    {renderInspectorSection('Siblings', related.siblings, visiblePaths, onSelectNode, onOpenFile)}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
                  <div>
                    <Layers3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No node selected</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Click a node in the map to inspect its nearby relationships.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

export default HorizonRelationshipMap;
