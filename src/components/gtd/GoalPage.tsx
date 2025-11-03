import React from 'react';
import { Calendar, Search, X } from 'lucide-react';
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
  buildGoalMarkdown,
  DEFAULT_GOAL_DESCRIPTION,
  type GoalReferenceGroups,
} from '@/utils/gtd-markdown-helpers';
import { syncHorizonBacklink } from '@/utils/horizon-backlinks';
import { checkTauriContextAsync } from '@/utils/tauri-ready';
import { safeInvoke } from '@/utils/safe-invoke';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import type { GTDGoalStatus, MarkdownFile } from '@/types';

export interface GoalPageProps {
  content: string;
  onChange: (nextContent: string) => void;
  filePath?: string;
  className?: string;
}

type GoalReferenceKey = 'areas' | 'projects' | 'vision' | 'purpose';

const HORIZON_DIRS: Record<GoalReferenceKey, string> = {
  areas: 'Areas of Focus',
  projects: 'Projects',
  vision: 'Vision',
  purpose: 'Purpose & Principles',
};

type GoalReferenceOption = {
  path: string;
  name: string;
  horizon: GoalReferenceKey;
};

const README_REGEX = /(?:^|\/)README(?:\.(md|markdown))?$/i;

type EmitOverrides = Partial<{
  title: string;
  status: GTDGoalStatus;
  targetDate?: string | null;
  references: GoalReferenceGroups;
  description: string;
}>;

interface GoalSections {
  description: string;
}

const GOAL_STATUS_OPTIONS: Array<{ value: GTDGoalStatus; label: string }> = [
  { value: 'in-progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
];

const GOAL_REFERENCE_LABELS: Record<GoalReferenceKey, string> = {
  areas: 'Areas References',
  projects: 'Projects References',
  vision: 'Vision References',
  purpose: 'Purpose & Principles References',
};

const GOAL_REFERENCE_ORDER: GoalReferenceKey[] = ['projects', 'areas', 'vision', 'purpose'];

const CANONICAL_METADATA_HEADINGS: RegExp[] = [
  /^##\s+Status\b/i,
  /^##\s+Target\s+Date\b/i,
  /^##\s+Projects\s+References\b/i,
  /^##\s+Areas\s+References\b/i,
  /^##\s+Vision\s+References\b/i,
  /^##\s+Purpose\s*&\s*Principles\s+References\b/i,
  /^##\s+Created\b/i,
];

const GOAL_DESCRIPTION_HEADINGS: RegExp[] = [
  /^##\s+Description\b/i,
  /^##\s+Summary\b/i,
];

function parseGoalSections(content: string): GoalSections {
  const lines = content.split(/\r?\n/);
  const buffer: string[] = [];
  let collecting = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (GOAL_DESCRIPTION_HEADINGS.some((regex) => regex.test(trimmed))) {
      collecting = true;
      buffer.length = 0;
      continue;
    }

    if (collecting) {
      const isCanonicalHeading = CANONICAL_METADATA_HEADINGS.some((regex) => regex.test(trimmed));
      const isAnyHeading = /^##\s+/.test(trimmed);
      const isAnotherDescriptionHeading = GOAL_DESCRIPTION_HEADINGS.some((regex) => regex.test(trimmed));
      if (isCanonicalHeading || (isAnyHeading && !isAnotherDescriptionHeading)) {
        break;
      }
      buffer.push(rawLine);
    }
  }

  const description = buffer.length
    ? buffer.join('\n').replace(/^\s*\n+/, '').trimEnd()
    : '';

  return { description };
}

function normalizeGoalStatus(raw: unknown): GTDGoalStatus {
  switch (typeof raw === 'string' ? raw.trim().toLowerCase() : '') {
    case 'waiting':
      return 'waiting';
    case 'completed':
      return 'completed';
    case 'in-progress':
    default:
      return 'in-progress';
  }
}

function displayNameForReference(ref: string): string {
  const normalized = ref.replace(/\\/g, '/');
  const leaf = normalized.split('/').pop();
  if (!leaf) return normalized;
  return leaf.replace(/\.(md|markdown)$/i, '');
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
  return [];
}

function formatDisplayDate(iso?: string | null): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  } catch {
    return parsed.toISOString();
  }
}

const GoalPage: React.FC<GoalPageProps> = ({ content, onChange, filePath, className }) => {
  const meta = React.useMemo(() => extractMetadata(content || ''), [content]);
  const parsedSections = React.useMemo(() => parseGoalSections(content || ''), [content]);
  const { withErrorHandling } = useErrorHandler();

  const initialTitle =
    typeof meta.title === 'string' && meta.title.trim().length > 0 ? meta.title.trim() : 'Untitled Goal';

  const initialReferences = React.useMemo<GoalReferenceGroups>(
    () => ({
      areas: toStringArray((meta as any).areasReferences),
      projects: toStringArray((meta as any).projectsReferences),
      vision: toStringArray((meta as any).visionReferences),
      purpose: toStringArray((meta as any).purposeReferences),
    }),
    [meta]
  );

  const [title, setTitle] = React.useState<string>(initialTitle);
  const [status, setStatus] = React.useState<GTDGoalStatus>(normalizeGoalStatus((meta as any).goalStatus ?? (meta as any).status));
  const [targetDate, setTargetDate] = React.useState<string>(
    typeof (meta as any).goalTargetDate === 'string' && (meta as any).goalTargetDate.trim().length > 0
      ? (meta as any).goalTargetDate.trim()
      : typeof (meta as any).targetDate === 'string'
        ? (meta as any).targetDate.trim()
        : ''
  );
  const [references, setReferences] = React.useState<GoalReferenceGroups>(initialReferences);
  const [description, setDescription] = React.useState<string>(
    parsedSections.description?.trim() === DEFAULT_GOAL_DESCRIPTION.trim() ? '' : parsedSections.description
  );
  const [activePicker, setActivePicker] = React.useState<GoalReferenceKey | null>(null);
  const [pickerOptions, setPickerOptions] = React.useState<GoalReferenceOption[]>([]);
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
      typeof meta.title === 'string' && meta.title.trim().length > 0 ? meta.title.trim() : 'Untitled Goal';
    setTitle(nextTitle);
    setStatus(normalizeGoalStatus((meta as any).goalStatus ?? (meta as any).status));
    const metaTarget =
      typeof (meta as any).goalTargetDate === 'string' && (meta as any).goalTargetDate.trim().length > 0
        ? (meta as any).goalTargetDate.trim()
        : typeof (meta as any).targetDate === 'string'
          ? (meta as any).targetDate.trim()
          : '';
    setTargetDate(metaTarget);
    setReferences({
      areas: toStringArray((meta as any).areasReferences),
      projects: toStringArray((meta as any).projectsReferences),
      vision: toStringArray((meta as any).visionReferences),
      purpose: toStringArray((meta as any).purposeReferences),
    });

    const updatedSections = parseGoalSections(content || '');
    setDescription(
      updatedSections.description?.trim() === DEFAULT_GOAL_DESCRIPTION.trim()
        ? ''
        : updatedSections.description
    );
  }, [meta, content]);

  const loadReferenceOptions = React.useCallback(
    async (key: GoalReferenceKey): Promise<GoalReferenceOption[]> => {
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
              path: (project.path || `${spacePath}/${HORIZON_DIRS.projects}/${project.name}`).replace(/\\/g, '/'),
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
      }, 'Failed to load references', `goal-${key}-references`);

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
      const nextStatus = overrides?.status ?? status;
      const nextTargetDate =
        overrides?.targetDate === undefined ? targetDate : (overrides.targetDate ?? '');
      const nextReferences = overrides?.references ?? references;
      const nextDescription = overrides?.description ?? description;

      const built = buildGoalMarkdown({
        title: nextTitle,
        status: nextStatus,
        targetDate: nextTargetDate,
        references: nextReferences,
        createdDateTime: createdRef.current,
        description: nextDescription,
      });

      if (built !== content) {
        onChange(built);
      }
    },
    [
      title,
      status,
      targetDate,
      references,
      description,
      content,
      onChange,
    ]
  );

  const handleReferenceToggle = React.useCallback(
    (key: GoalReferenceKey, value: string) => {
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
            sourceKind: 'goals',
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
    (key: GoalReferenceKey, value: string) => {
      const normalizedTarget = value.replace(/\\/g, '/');
      setReferences((current) => {
        const nextGroup = (current[key] ?? []).filter((item) => item !== value);
        const next = { ...current, [key]: nextGroup };
        emitRebuild({ references: next });
        if (normalizedFilePath && normalizedTarget) {
          void syncHorizonBacklink({
            sourcePath: normalizedFilePath,
            sourceKind: 'goals',
            targetPath: normalizedTarget,
            action: 'remove',
          });
        }
        return next;
      });
    },
    [emitRebuild, normalizedFilePath]
  );

  const onDescriptionChange = React.useCallback(
    (nextValue: string) => {
      const trimmed = nextValue.trim();
      const clean = trimmed === DEFAULT_GOAL_DESCRIPTION.trim() ? '' : nextValue;
      setDescription(clean);
      emitRebuild({ description: clean });
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
          placeholder="Untitled Goal"
        />

        <div className="grid lg:grid-cols-3 gap-x-6 gap-y-4">
          <div className="grid grid-cols-[140px_1fr] gap-x-4 items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Select
              value={status}
              onValueChange={(value) => {
                const next = value as GTDGoalStatus;
                setStatus(next);
                emitRebuild({ status: next });
              }}
            >
              <SelectTrigger className="h-9 text-sm" aria-label="Goal status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {GOAL_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-x-4 items-center">
            <span className="text-sm text-muted-foreground">Target Date</span>
            <div className="relative w-full max-w-[16rem]">
              <Input
                type="date"
                value={targetDate}
                onChange={(event) => {
                  const next = event.target.value;
                  setTargetDate(next);
                  emitRebuild({ targetDate: next });
                }}
                className="pr-10"
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-x-4 items-center">
            <span className="text-sm text-muted-foreground">Created</span>
            <div className="text-sm text-muted-foreground">{createdDisplayValue}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
          {GOAL_REFERENCE_ORDER.map((key) => {
            const currentRefs = references[key] ?? [];
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {GOAL_REFERENCE_LABELS[key]}
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
                    <DialogTitle>Manage {GOAL_REFERENCE_LABELS[activePicker]}</DialogTitle>
                    <DialogDescription>
                      Select items to link with this goal. Existing selections stay highlighted.
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
                        No items found. Add files to the {HORIZON_DIRS[activePicker]} folder to link them here.
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
            <h2 className="text-xl font-semibold">Description</h2>
          </div>
          <EnhancedTextEditor
            content={description || DEFAULT_GOAL_DESCRIPTION}
            onChange={onDescriptionChange}
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

export default GoalPage;
