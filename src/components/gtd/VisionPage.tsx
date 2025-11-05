import React from 'react';
import { Search, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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
import { EnhancedTextEditor } from '@/components/editor/EnhancedTextEditor';
import { extractMetadata } from '@/utils/metadata-extractor';
import {
  buildVisionMarkdown,
  DEFAULT_VISION_NARRATIVE,
  type VisionReferenceGroups,
} from '@/utils/gtd-markdown-helpers';
import { syncHorizonBacklink } from '@/utils/horizon-backlinks';
import { checkTauriContextAsync } from '@/utils/tauri-ready';
import { safeInvoke } from '@/utils/safe-invoke';
import { formatDisplayDate } from '@/utils/format-display-date';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import type { GTDVisionHorizon, MarkdownFile } from '@/types';

export interface VisionPageProps {
  content: string;
  onChange: (nextContent: string) => void;
  filePath?: string;
  className?: string;
}

type VisionReferenceKey = 'projects' | 'goals' | 'areas' | 'purpose';

const HORIZON_DIRS: Record<Exclude<VisionReferenceKey, 'projects'>, string> = {
  goals: 'Goals',
  areas: 'Areas of Focus',
  purpose: 'Purpose & Principles',
};

type VisionReferenceOption = {
  path: string;
  name: string;
  horizon: VisionReferenceKey;
};

const README_REGEX = /(?:^|\/)README(?:\.(md|markdown))?$/i;

type EmitOverrides = Partial<{
  title: string;
  horizon: GTDVisionHorizon;
  references: VisionReferenceGroups;
  narrative: string;
}>;

interface VisionSections {
  narrative: string;
}

const VISION_HORIZON_OPTIONS: Array<{ value: GTDVisionHorizon; label: string }> = [
  { value: '3-years', label: '3 Years' },
  { value: '5-years', label: '5 Years' },
  { value: '10-years', label: '10 Years' },
  { value: 'custom', label: 'Custom' },
];

const VISION_REFERENCE_LABELS: Record<VisionReferenceKey, string> = {
  projects: 'Projects References',
  goals: 'Goals References',
  areas: 'Areas References',
  purpose: 'Purpose & Principles References',
};

const VISION_REFERENCE_ORDER: VisionReferenceKey[] = ['projects', 'goals', 'areas', 'purpose'];

const CANONICAL_METADATA_HEADINGS: RegExp[] = [
  /^##\s+Horizon\b/i,
  /^##\s+Projects\s+References\b/i,
  /^##\s+Goals\s+References\b/i,
  /^##\s+Areas\s+References\b/i,
  /^##\s+Purpose\s*&\s*Principles\s+References\b/i,
  /^##\s+Created\b/i,
];

const NARRATIVE_HEADINGS: RegExp[] = [
  /^##\s+Narrative\b/i,
  /^##\s+Vision\s+Narrative\b/i,
];

function parseVisionSections(content: string): VisionSections {
  const lines = content.split(/\r?\n/);
  const buffer: string[] = [];
  let collecting = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (NARRATIVE_HEADINGS.some((regex) => regex.test(trimmed))) {
      collecting = true;
      buffer.length = 0;
      continue;
    }

    if (collecting) {
      const isCanonicalHeading = CANONICAL_METADATA_HEADINGS.some((regex) => regex.test(trimmed));
      const isAnyHeading = /^##\s+/.test(trimmed);
      const isAnotherNarrative = NARRATIVE_HEADINGS.some((regex) => regex.test(trimmed));
      if (isCanonicalHeading || (isAnyHeading && !isAnotherNarrative)) {
        break;
      }
      buffer.push(rawLine);
    }
  }

  const narrative = buffer.length
    ? buffer.join('\n').replace(/^\s*\n+/, '').trimEnd()
    : '';

  return { narrative };
}

function normalizeVisionHorizon(raw: unknown): GTDVisionHorizon {
  switch (typeof raw === 'string' ? raw.trim().toLowerCase() : '') {
    case '5-years':
    case '5years':
    case '5-year':
    case '5year':
      return '5-years';
    case '10-years':
    case '10years':
    case '10-year':
    case '10year':
      return '10-years';
    case 'custom':
      return 'custom';
    case '3-years':
    case '3years':
    case '3-year':
    case '3year':
    default:
      return '3-years';
  }
}

function toStringArray(value: unknown): string[] {
  const normalize = (input: string) => input.replace(/\\/g, '/').trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? normalize(item) : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    // Try to decode and parse as JSON first
    try {
      const decoded = decodeURIComponent(trimmed);
      const parsed = JSON.parse(decoded);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? normalize(item) : ''))
          .filter(Boolean);
      }
    } catch {
      // Fall through to CSV parsing
    }

    // Fall back to CSV split
    return trimmed.split(',').map((entry) => normalize(entry)).filter(Boolean);
  }
  return [];
}

function displayNameForReference(ref: string): string {
  const normalized = ref.replace(/\\/g, '/');
  const leaf = normalized.split('/').pop();
  if (!leaf) return normalized;
  return leaf.replace(/\.(md|markdown)$/i, '');
}

const VisionPage: React.FC<VisionPageProps> = ({ content, onChange, filePath, className }) => {
  const meta = React.useMemo(() => extractMetadata(content || ''), [content]);
  const parsedSections = React.useMemo(() => parseVisionSections(content || ''), [content]);
  const { withErrorHandling } = useErrorHandler();

  const initialTitle =
    typeof meta.title === 'string' && meta.title.trim().length > 0 ? meta.title.trim() : 'Untitled Vision';

  const initialReferences = React.useMemo<VisionReferenceGroups>(
    () => ({
      projects: toStringArray((meta as any).projectsReferences),
      goals: toStringArray((meta as any).goalsReferences),
      areas: toStringArray((meta as any).areasReferences),
      purpose: toStringArray((meta as any).purposeReferences),
    }),
    [meta]
  );

  const [title, setTitle] = React.useState<string>(initialTitle);
  const [horizon, setHorizon] = React.useState<GTDVisionHorizon>(normalizeVisionHorizon((meta as any).visionHorizon));
  const [references, setReferences] = React.useState<VisionReferenceGroups>(initialReferences);
  const [narrative, setNarrative] = React.useState<string>(
    parsedSections.narrative?.trim() === DEFAULT_VISION_NARRATIVE.trim() ? '' : parsedSections.narrative
  );
  const [activePicker, setActivePicker] = React.useState<VisionReferenceKey | null>(null);
  const [pickerOptions, setPickerOptions] = React.useState<VisionReferenceOption[]>([]);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [pickerSearch, setPickerSearch] = React.useState('');

  const createdRef = React.useRef<string>(new Date().toISOString());
  const [createdDisplayValue, setCreatedDisplayValue] = React.useState<string>(
    formatDisplayDate(createdRef.current)
  );
  const createdInitialized = React.useRef<boolean>(false);

  React.useEffect(() => {
    if (!createdInitialized.current) {
      const fromMeta = (meta as any).createdDateTime;
      createdRef.current =
        typeof fromMeta === 'string' && fromMeta.trim().length > 0
          ? fromMeta.trim()
          : new Date().toISOString();
      createdInitialized.current = true;
      setCreatedDisplayValue(formatDisplayDate(createdRef.current));
    } else if (typeof (meta as any).createdDateTime === 'string' && (meta as any).createdDateTime.trim().length > 0) {
      createdRef.current = (meta as any).createdDateTime.trim();
      setCreatedDisplayValue(formatDisplayDate(createdRef.current));
    }
  }, [meta]);

  React.useEffect(() => {
    const nextTitle =
      typeof meta.title === 'string' && meta.title.trim().length > 0 ? meta.title.trim() : 'Untitled Vision';
    setTitle(nextTitle);
    setHorizon(normalizeVisionHorizon((meta as any).visionHorizon));
    setReferences({
      projects: toStringArray((meta as any).projectsReferences),
      goals: toStringArray((meta as any).goalsReferences),
      areas: toStringArray((meta as any).areasReferences),
      purpose: toStringArray((meta as any).purposeReferences),
    });

    const updatedSections = parseVisionSections(content || '');
    setNarrative(
      updatedSections.narrative?.trim() === DEFAULT_VISION_NARRATIVE.trim()
        ? ''
        : updatedSections.narrative
    );
  }, [meta, content]);

  const loadReferenceOptions = React.useCallback(
    async (key: VisionReferenceKey): Promise<VisionReferenceOption[]> => {
      const spacePath = window.localStorage.getItem('gtdspace-current-path') || '';
      if (!spacePath) return [];

      const inTauri = await checkTauriContextAsync();
      if (!inTauri) return [];

      const result = await withErrorHandling(async () => {
        if (key === 'projects') {
          const projects = await safeInvoke<Array<{ name: string; path: string }>>(
            'list_gtd_projects',
            { spacePath },
            []
          );
          if (!projects) return [];
          return projects
            .map((project) => ({
              path: (project.path || `${spacePath}/Projects/${project.name}`).replace(/\\/g, '/'),
              name: project.name,
              horizon: key,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        }

        const dirName = HORIZON_DIRS[key];
        const dirPath = `${spacePath}/${dirName}`;
        const files = await safeInvoke<MarkdownFile[]>(
          'list_markdown_files',
          { path: dirPath },
          []
        );
        if (!files) return [];

        return files
          .filter((file) => !README_REGEX.test(file.path.replace(/\\/g, '/')))
          .map((file) => ({
            path: file.path.replace(/\\/g, '/'),
            name: file.name.replace(/\.(md|markdown)$/i, ''),
            horizon: key,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      }, 'Failed to load references', `vision-${key}-references`);

      return result ?? [];
    },
    [withErrorHandling]
  );

  React.useEffect(() => {
    if (!activePicker) return;
    let cancelled = false;
    setPickerLoading(true);
    setPickerSearch('');
    setPickerOptions([]);

    loadReferenceOptions(activePicker)
      .then((options) => {
        if (!cancelled) {
          setPickerOptions(options);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPickerLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activePicker, loadReferenceOptions]);

  const filteredPickerOptions = React.useMemo(() => {
    if (!pickerSearch) return pickerOptions;
    const query = pickerSearch.toLowerCase();
    return pickerOptions.filter((option) => {
      const nameMatch = option.name.toLowerCase().includes(query);
      const pathMatch = option.path.toLowerCase().includes(query);
      return nameMatch || pathMatch;
    });
  }, [pickerOptions, pickerSearch]);

  const normalizedFilePath = React.useMemo(() => (filePath ? filePath.replace(/\\/g, '/') : ''), [filePath]);

  const emitRebuild = React.useCallback(
    (overrides?: EmitOverrides) => {
      const nextTitle = overrides?.title ?? title;
      const nextHorizon = overrides?.horizon ?? horizon;
      const nextReferences = overrides?.references ?? references;
      const nextNarrative = overrides?.narrative ?? narrative;

      const built = buildVisionMarkdown({
        title: nextTitle,
        horizon: nextHorizon,
        references: nextReferences,
        createdDateTime: createdRef.current,
        narrative: nextNarrative,
      });

      if (built !== content) {
        onChange(built);
      }
    },
    [title, horizon, references, narrative, content, onChange]
  );

  const handleReferenceToggle = React.useCallback(
    (key: VisionReferenceKey, value: string) => {
      const normalizedTarget = value.replace(/\\/g, '/');
      setReferences((current) => {
        const group = current[key] ?? [];
        const isPresent = group.includes(value);
        const nextGroup = isPresent ? group.filter((ref) => ref !== value) : [...group, value];
        const next = { ...current, [key]: nextGroup };
        emitRebuild({ references: next });
        if (normalizedFilePath && normalizedTarget) {
          void syncHorizonBacklink({
            sourcePath: normalizedFilePath,
            sourceKind: 'vision',
            targetPath: normalizedTarget,
            action: isPresent ? 'remove' : 'add',
          });
        }
        return next;
      });
    },
    [emitRebuild, normalizedFilePath]
  );

  const handleReferenceRemove = React.useCallback(
    (key: VisionReferenceKey, value: string) => {
      const normalizedTarget = value.replace(/\\/g, '/');
      setReferences((current) => {
        const nextGroup = (current[key] ?? []).filter((item) => item !== value);
        const next = { ...current, [key]: nextGroup };
        emitRebuild({ references: next });
        if (normalizedFilePath && normalizedTarget) {
          void syncHorizonBacklink({
            sourcePath: normalizedFilePath,
            sourceKind: 'vision',
            targetPath: normalizedTarget,
            action: 'remove',
          });
        }
        return next;
      });
    },
    [emitRebuild, normalizedFilePath]
  );

  const onNarrativeChange = React.useCallback(
    (nextValue: string) => {
      const trimmed = nextValue.trim();
      const clean = trimmed === DEFAULT_VISION_NARRATIVE.trim() ? '' : nextValue;
      setNarrative(clean);
      emitRebuild({ narrative: clean });
    },
    [emitRebuild]
  );

  return (
    <div className={`flex flex-col min-h-0 h-full overflow-y-auto bg-background text-foreground ${className ?? ''}`}>
      <div className="px-12 pt-10 pb-6 space-y-6">
        <input
          type="text"
          value={title}
          onChange={(event) => {
            const next = event.target.value;
            setTitle(next);
            emitRebuild({ title: next });
          }}
          className="w-full bg-background text-foreground text-5xl font-bold leading-tight tracking-[-0.01em] border-0 outline-none placeholder:text-muted-foreground"
          placeholder="Untitled Vision"
        />

        <div className="grid lg:grid-cols-3 gap-x-6 gap-y-4">
          <div className="grid grid-cols-[140px_1fr] gap-x-4 items-center">
            <span className="text-sm text-muted-foreground">Horizon</span>
            <Select
              value={horizon}
              onValueChange={(value) => {
                const next = value as GTDVisionHorizon;
                setHorizon(next);
                emitRebuild({ horizon: next });
              }}
            >
              <SelectTrigger className="h-9 text-sm" aria-label="Vision horizon">
                <SelectValue placeholder="Select horizon" />
              </SelectTrigger>
              <SelectContent>
                {VISION_HORIZON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-x-4 items-center">
            <span className="text-sm text-muted-foreground">Created</span>
            <div className="text-sm text-muted-foreground">{createdDisplayValue}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
          {VISION_REFERENCE_ORDER.map((key) => {
            const currentRefs = references[key] ?? [];
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {VISION_REFERENCE_LABELS[key]}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {currentRefs.length} linked
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setActivePicker(key)}
                    >
                      Manage
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentRefs.length > 0 ? (
                    currentRefs.map((ref) => (
                      <Badge
                        key={ref}
                        variant="outline"
                        className="px-2 py-0.5 text-xs flex items-center gap-1.5 h-6 max-w-[16rem] truncate"
                        title={ref}
                      >
                        {displayNameForReference(ref)}
                        <button
                          type="button"
                          onClick={() => handleReferenceRemove(key, ref)}
                          className="hover:text-muted-foreground transition-colors"
                          aria-label={`Remove reference ${ref}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No references yet.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={activePicker !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActivePicker(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          {activePicker &&
            (() => {
              const activeRefs = references[activePicker] ?? [];
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>Manage {VISION_REFERENCE_LABELS[activePicker]}</DialogTitle>
                    <DialogDescription>
                      Select items to link with this vision narrative. Existing selections stay highlighted.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex items-center gap-2 mb-4">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={pickerSearch}
                      onChange={(event) => setPickerSearch(event.target.value)}
                      placeholder="Search references..."
                      className="flex-1"
                    />
                  </div>

                  <ScrollArea className="h-[360px] border border-border rounded-md">
                    {pickerLoading ? (
                      <div className="py-12 text-center text-muted-foreground">Loading references...</div>
                    ) : filteredPickerOptions.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        No items found. Add files to the{' '}
                        {activePicker === 'projects' ? 'Projects' : HORIZON_DIRS[activePicker]}
                        {' '}folder to link them here.
                      </div>
                    ) : (
                      <div className="p-4 space-y-2">
                        {filteredPickerOptions.map((option) => {
                          const isSelected = activeRefs.includes(option.path);
                          return (
                            <button
                              key={option.path}
                              type="button"
                              onClick={() => handleReferenceToggle(activePicker, option.path)}
                              className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                                isSelected ? 'bg-muted text-muted-foreground' : 'hover:bg-accent'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{option.name}</span>
                                {isSelected && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Linked
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 truncate">
                                {option.path}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

  <div className="border-t border-border mt-8" />

      <div className="px-12 pb-16 pt-10 space-y-10 flex-1 overflow-y-auto">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Narrative</h2>
          </div>
          <EnhancedTextEditor
            content={narrative || DEFAULT_VISION_NARRATIVE}
            onChange={onNarrativeChange}
            readOnly={false}
            autoFocus={false}
            className="flex-1"
            filePath={filePath}
            frame="bare"
            showStatusBar={false}
          />
        </section>
      </div>
    </div>
  );
};

export default VisionPage;
