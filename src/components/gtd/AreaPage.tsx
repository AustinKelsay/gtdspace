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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  buildAreaMarkdown,
  DEFAULT_AREA_NARRATIVE,
  type AreaReferenceGroups,
} from '@/utils/gtd-markdown-helpers';
import { checkTauriContextAsync } from '@/utils/tauri-ready';
import { safeInvoke } from '@/utils/safe-invoke';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import type { GTDAreaReviewCadence, GTDAreaStatus, MarkdownFile } from '@/types';

export interface AreaPageProps {
  content: string;
  onChange: (nextContent: string) => void;
  filePath?: string;
  className?: string;
}

type AreaReferenceKey = 'projects' | 'goals' | 'vision' | 'purpose';

const HORIZON_DIRS: Record<AreaReferenceKey, string> = {
  projects: 'Projects',
  goals: 'Goals',
  vision: 'Vision',
  purpose: 'Purpose & Principles',
};

type AreaReferenceOption = {
  path: string;
  name: string;
  horizon: AreaReferenceKey;
};

const README_REGEX = /(?:^|\/)README(?:\.(md|markdown))?$/i;

type EmitOverrides = Partial<{
  title: string;
  status: GTDAreaStatus;
  reviewCadence: GTDAreaReviewCadence;
  stewards: string[];
  references: AreaReferenceGroups;
  narrative: string;
  successCriteria: string;
  focusMetrics: string;
  supportingNotes: string;
  includeProjectsSnapshot: boolean;
  includeGoalsSnapshot: boolean;
  snapshotsAdditional: string;
  projectsSnapshotBlock: string;
  goalsSnapshotBlock: string;
}>;

interface AreaSections {
  narrative: string;
  successCriteria: string;
  focusMetrics: string;
  supportingNotes: string;
  includeProjectsSnapshot: boolean;
  includeGoalsSnapshot: boolean;
  snapshotsAdditional: string;
  projectsSnapshotBlock: string | null;
  goalsSnapshotBlock: string | null;
}

const AREA_STATUS_OPTIONS: Array<{ value: GTDAreaStatus; label: string }> = [
  { value: 'steady', label: 'Steady' },
  { value: 'watch', label: 'Watch' },
  { value: 'incubating', label: 'Incubating' },
  { value: 'delegated', label: 'Delegated' },
];

const AREA_REVIEW_CADENCE_OPTIONS: Array<{ value: GTDAreaReviewCadence; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
];

const REFERENCE_LABELS: Record<AreaReferenceKey, string> = {
  projects: 'Projects References',
  goals: 'Goals References',
  vision: 'Vision References',
  purpose: 'Purpose & Principles References',
};

const DEFAULT_METRICS_TABLE =
  '| Metric | Target | Current | Updated |\n|--------|--------|---------|---------|\n';

function parseAreaSections(content: string): AreaSections {
  type SectionKey = 'narrative' | 'successCriteria' | 'focusMetrics' | 'supportingNotes' | 'snapshots';

  const SECTION_DEFS: Array<{ key: SectionKey; regex: RegExp }> = [
    { key: 'narrative', regex: /^##\s+Area\s+Narrative\b.*$/i },
    { key: 'successCriteria', regex: /^##\s+Success\s+Criteria\b.*$/i },
    { key: 'focusMetrics', regex: /^##\s+Focus\s+Metrics\b.*$/i },
    { key: 'supportingNotes', regex: /^##\s+Supporting\s+Notes\b.*$/i },
    { key: 'snapshots', regex: /^##\s+Snapshots\b.*$/i },
  ];

  const buffers: Record<SectionKey, string[]> = {
    narrative: [],
    successCriteria: [],
    focusMetrics: [],
    supportingNotes: [],
    snapshots: [],
  };

  const lines = content.split(/\r?\n/);
  let currentKey: SectionKey | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const matched = SECTION_DEFS.find((def) => def.regex.test(trimmed));
    if (matched) {
      currentKey = matched.key;
      continue;
    }

    if (currentKey) {
      buffers[currentKey].push(line);
    }
  }

  const cleanupSection = (linesForSection: string[]): string => {
    if (linesForSection.length === 0) return '';
    let text = linesForSection.join('\n');
    text = text.replace(/^\s*\n+/, '');
    return text.trimEnd();
  };

  const narrative = cleanupSection(buffers.narrative);
  const successCriteria = cleanupSection(buffers.successCriteria);
  const focusMetrics = cleanupSection(buffers.focusMetrics);
  const supportingNotes = cleanupSection(buffers.supportingNotes);
  const snapshotsContent = cleanupSection(buffers.snapshots);

  const projectsSnapshotMatch = snapshotsContent.match(/\[!projects-list[^\]]*\]/i);
  const goalsSnapshotMatch = snapshotsContent.match(/\[!goals-list[^\]]*\]/i);
  const includeProjectsSnapshot = Boolean(projectsSnapshotMatch);
  const includeGoalsSnapshot = Boolean(goalsSnapshotMatch);
  const snapshotsAdditional = snapshotsContent
    .replace(/\[!projects-list[^\]]*\]\s*/gi, '')
    .replace(/\[!goals-list[^\]]*\]\s*/gi, '')
    .trim();

  return {
    narrative,
    successCriteria,
    focusMetrics,
    supportingNotes,
    includeProjectsSnapshot,
    includeGoalsSnapshot,
    snapshotsAdditional,
    projectsSnapshotBlock: projectsSnapshotMatch?.[0] ?? null,
    goalsSnapshotBlock: goalsSnapshotMatch?.[0] ?? null,
  };
}

function normalizeAreaStatus(raw: unknown): GTDAreaStatus {
  switch (typeof raw === 'string' ? raw.trim().toLowerCase() : '') {
    case 'steady':
    case 'watch':
    case 'incubating':
    case 'delegated':
      return raw as GTDAreaStatus;
    default:
      return 'steady';
  }
}

function normalizeReviewCadence(raw: unknown): GTDAreaReviewCadence {
  switch (typeof raw === 'string' ? raw.trim().toLowerCase() : '') {
    case 'weekly':
    case 'monthly':
    case 'quarterly':
    case 'annually':
      return raw as GTDAreaReviewCadence;
    default:
      return 'monthly';
  }
}

function normalizeSteward(value: string): string {
  return value.trim().replace(/\s+/g, '-').toLowerCase();
}

function stewardDisplay(value: string): string {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

const AreaPage: React.FC<AreaPageProps> = ({ content, onChange, filePath, className }) => {
  const meta = React.useMemo(() => extractMetadata(content || ''), [content]);
  const parsedSections = React.useMemo(() => parseAreaSections(content || ''), [content]);

  const initialTitle =
    typeof meta.title === 'string' && meta.title.trim().length > 0 ? meta.title.trim() : 'Untitled Area';

  const initialStewards = React.useMemo(
    () => Array.from(new Set(toStringArray((meta as any).areaStewards).map(normalizeSteward))),
    [meta]
  );

  const initialReferences = React.useMemo<AreaReferenceGroups>(
    () => ({
      projects: toStringArray((meta as any).projectsReferences),
      areas: toStringArray((meta as any).areasReferences),
      goals: toStringArray((meta as any).goalsReferences),
      vision: toStringArray((meta as any).visionReferences),
      purpose: toStringArray((meta as any).purposeReferences),
    }),
    [meta]
  );

  const [title, setTitle] = React.useState<string>(initialTitle);
  const [status, setStatus] = React.useState<GTDAreaStatus>(normalizeAreaStatus((meta as any).areaStatus));
  const [reviewCadence, setReviewCadence] = React.useState<GTDAreaReviewCadence>(
    normalizeReviewCadence((meta as any).areaReviewCadence)
  );
  const [stewards, setStewards] = React.useState<string[]>(initialStewards);
  const [references, setReferences] = React.useState<AreaReferenceGroups>(initialReferences);
  const [snapshotsAdditional, setSnapshotsAdditional] = React.useState<string>(
    parsedSections.snapshotsAdditional ?? ''
  );
  const [activePicker, setActivePicker] = React.useState<AreaReferenceKey | null>(null);
  const [pickerOptions, setPickerOptions] = React.useState<AreaReferenceOption[]>([]);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [pickerSearch, setPickerSearch] = React.useState('');
  const { withErrorHandling } = useErrorHandler();

  const normalizeSection = React.useCallback(
    (value: string) => {
      const trimmed = value?.trim() ?? '';
      if (trimmed === DEFAULT_AREA_NARRATIVE.trim()) {
        return '';
      }
      return trimmed;
    },
    []
  );

  const [narrative, setNarrative] = React.useState<string>(
    normalizeSection(parsedSections.narrative)
  );
  const [successCriteria, setSuccessCriteria] = React.useState<string>(
    parsedSections.successCriteria ?? ''
  );
  const [focusMetrics, setFocusMetrics] = React.useState<string>(
    parsedSections.focusMetrics ?? ''
  );
  const [supportingNotes, setSupportingNotes] = React.useState<string>(
    parsedSections.supportingNotes ?? ''
  );
  const [includeProjectsSnapshot, setIncludeProjectsSnapshot] = React.useState<boolean>(
    parsedSections.includeProjectsSnapshot
  );
  const [includeGoalsSnapshot, setIncludeGoalsSnapshot] = React.useState<boolean>(
    parsedSections.includeGoalsSnapshot
  );
  const [projectsSnapshotBlock, setProjectsSnapshotBlock] = React.useState<string>(
    parsedSections.projectsSnapshotBlock ?? ''
  );
  const [goalsSnapshotBlock, setGoalsSnapshotBlock] = React.useState<string>(
    parsedSections.goalsSnapshotBlock ?? ''
  );

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
      typeof meta.title === 'string' && meta.title.trim().length > 0 ? meta.title.trim() : 'Untitled Area';
    setTitle(nextTitle);
    setStatus(normalizeAreaStatus((meta as any).areaStatus));
    setReviewCadence(normalizeReviewCadence((meta as any).areaReviewCadence));
    const nextStewards = Array.from(new Set(toStringArray((meta as any).areaStewards).map(normalizeSteward)));
    setStewards(nextStewards);
    setReferences({
      projects: toStringArray((meta as any).projectsReferences),
      areas: toStringArray((meta as any).areasReferences),
      goals: toStringArray((meta as any).goalsReferences),
      vision: toStringArray((meta as any).visionReferences),
      purpose: toStringArray((meta as any).purposeReferences),
    });
    const updatedSections = parseAreaSections(content || '');
    setNarrative(normalizeSection(updatedSections.narrative));
    setSuccessCriteria(updatedSections.successCriteria ?? '');
    setFocusMetrics(updatedSections.focusMetrics ?? '');
   setSupportingNotes(updatedSections.supportingNotes ?? '');
   setIncludeProjectsSnapshot(updatedSections.includeProjectsSnapshot);
   setIncludeGoalsSnapshot(updatedSections.includeGoalsSnapshot);
   setSnapshotsAdditional(updatedSections.snapshotsAdditional ?? '');
    setProjectsSnapshotBlock(updatedSections.projectsSnapshotBlock ?? '');
    setGoalsSnapshotBlock(updatedSections.goalsSnapshotBlock ?? '');
  }, [meta, content, normalizeSection]);

  const loadReferenceOptions = React.useCallback(
    async (key: AreaReferenceKey): Promise<AreaReferenceOption[]> => {
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
      }, 'Failed to load references', `area-${key}-references`);

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

  const emitRebuild = React.useCallback(
    (overrides?: EmitOverrides) => {
      const nextTitle = overrides?.title ?? title;
      const nextStatus = overrides?.status ?? status;
      const nextCadence = overrides?.reviewCadence ?? reviewCadence;
      const nextStewards = overrides?.stewards ?? stewards;
      const nextReferences = overrides?.references ?? references;
      const nextNarrative = overrides?.narrative ?? narrative;
      const nextSuccess = overrides?.successCriteria ?? successCriteria;
      const nextMetrics = overrides?.focusMetrics ?? focusMetrics;
      const nextNotes = overrides?.supportingNotes ?? supportingNotes;
      const nextProjectsSnapshot =
        overrides?.includeProjectsSnapshot ?? includeProjectsSnapshot;
      const nextGoalsSnapshot =
        overrides?.includeGoalsSnapshot ?? includeGoalsSnapshot;
      const nextSnapshotsAdditional =
        overrides?.snapshotsAdditional ?? snapshotsAdditional;
      const nextProjectsSnapshotBlock =
        overrides?.projectsSnapshotBlock ?? projectsSnapshotBlock;
      const nextGoalsSnapshotBlock =
        overrides?.goalsSnapshotBlock ?? goalsSnapshotBlock;

      const built = buildAreaMarkdown({
        title: nextTitle,
        status: nextStatus,
        reviewCadence: nextCadence,
        stewards: nextStewards,
        references: nextReferences,
        createdDateTime: createdRef.current,
        narrative: nextNarrative,
        successCriteria: nextSuccess,
        focusMetrics: nextMetrics,
        supportingNotes: nextNotes,
        includeProjectsSnapshot: nextProjectsSnapshot,
        includeGoalsSnapshot: nextGoalsSnapshot,
        snapshotsAdditional: nextSnapshotsAdditional,
        projectsSnapshotBlock: nextProjectsSnapshotBlock,
        goalsSnapshotBlock: nextGoalsSnapshotBlock,
      });

      if (built !== content) {
        onChange(built);
      }
    },
    [
      title,
      status,
      reviewCadence,
      stewards,
      references,
      narrative,
      successCriteria,
      focusMetrics,
      supportingNotes,
      includeProjectsSnapshot,
      includeGoalsSnapshot,
      snapshotsAdditional,
      projectsSnapshotBlock,
      goalsSnapshotBlock,
      content,
      onChange,
    ]
  );

  const [stewardDraft, setStewardDraft] = React.useState('');

  const handleStewardSubmit = () => {
    const normalized = normalizeSteward(stewardDraft);
    if (!normalized) return;
    if (stewards.includes(normalized)) {
      setStewardDraft('');
      return;
    }
    const next = [...stewards, normalized];
    setStewards(next);
    setStewardDraft('');
    emitRebuild({ stewards: next });
  };

  const handleRemoveSteward = (value: string) => {
    setStewards((current) => {
      const next = current.filter((item) => item !== value);
      emitRebuild({ stewards: next });
      return next;
    });
  };

  const handleReferenceToggle = React.useCallback(
    (key: AreaReferenceKey, value: string) => {
      setReferences((current) => {
        const group = current[key] ?? [];
        const nextGroup = group.includes(value)
          ? group.filter((ref) => ref !== value)
          : [...group, value];
        const next = { ...current, [key]: nextGroup };
        emitRebuild({ references: next });
        return next;
      });
    },
    [emitRebuild]
  );

  const handleReferenceRemove = (key: AreaReferenceKey, value: string) => {
    setReferences((current) => {
      const nextGroup = (current[key] ?? []).filter((item) => item !== value);
      const next = { ...current, [key]: nextGroup };
      emitRebuild({ references: next });
      return next;
    });
  };

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
          placeholder="Untitled Area"
        />

        <div className="grid lg:grid-cols-3 gap-x-6 gap-y-4">
          <div className="grid grid-cols-[140px_1fr] gap-x-4 items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Select
              value={status}
              onValueChange={(value) => {
                const next = value as GTDAreaStatus;
                setStatus(next);
                emitRebuild({ status: next });
              }}
            >
              <SelectTrigger className="h-9 text-sm" aria-label="Area status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {AREA_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-x-4 items-center">
            <span className="text-sm text-muted-foreground">Review Cadence</span>
            <Select
              value={reviewCadence}
              onValueChange={(value) => {
                const next = value as GTDAreaReviewCadence;
                setReviewCadence(next);
                emitRebuild({ reviewCadence: next });
              }}
            >
              <SelectTrigger className="h-9 text-sm" aria-label="Area review cadence">
                <SelectValue placeholder="Select cadence" />
              </SelectTrigger>
              <SelectContent>
                {AREA_REVIEW_CADENCE_OPTIONS.map((option) => (
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

        <div className="grid grid-cols-[140px_1fr] gap-x-4 items-start">
          <span className="text-sm text-muted-foreground mt-2">Stewards</span>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {stewards.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No stewards yet. Add owners or accountable teams.
                </span>
              ) : (
                stewards.map((steward) => (
                  <Badge
                    key={steward}
                    variant="secondary"
                    className="px-2 py-0.5 text-xs flex items-center gap-1.5 h-6"
                  >
                    {stewardDisplay(steward)}
                    <button
                      type="button"
                      onClick={() => handleRemoveSteward(steward)}
                      className="hover:text-muted-foreground transition-colors"
                      aria-label={`Remove steward ${stewardDisplay(steward)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                value={stewardDraft}
                onChange={(event) => setStewardDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleStewardSubmit();
                  }
                }}
                placeholder="Add steward (e.g., marketing-ops)"
                className="w-64 h-9"
              />
              <Button
                type="button"
                size="sm"
                className="h-9 px-3"
                onClick={handleStewardSubmit}
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
          {(Object.keys(REFERENCE_LABELS) as AreaReferenceKey[]).map((key) => {
            const currentRefs = references[key] ?? [];
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {REFERENCE_LABELS[key]}
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
                    <DialogTitle>Manage {REFERENCE_LABELS[activePicker]}</DialogTitle>
                    <DialogDescription>
                      Select items to link with this area. Existing selections stay highlighted.
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

      <div className="border-t border-border" />

      <div className="px-12 pb-16 space-y-10 flex-1 overflow-y-auto">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Area Narrative</h2>
            <span className="text-xs text-muted-foreground">Autosaves as you type</span>
          </div>
          <EnhancedTextEditor
            content={narrative || DEFAULT_AREA_NARRATIVE}
            onChange={(next) => {
              const clean = next.trim() === DEFAULT_AREA_NARRATIVE.trim() ? '' : next;
              setNarrative(clean);
              emitRebuild({ narrative: clean });
            }}
            readOnly={false}
            autoFocus={false}
            className="flex-1"
            filePath={filePath}
            frame="bare"
            showStatusBar={false}
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Success Criteria</h2>
            <span className="text-xs text-muted-foreground">Optional</span>
          </div>
          <Textarea
            value={successCriteria}
            onChange={(event) => {
              const next = event.target.value;
              setSuccessCriteria(next);
              emitRebuild({ successCriteria: next });
            }}
            placeholder="- Maintain onboarding completion above 95%\n- Weekly 1:1s completed for all direct reports"
            className="min-h-[140px]"
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Focus Metrics</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Track quantitative signals (e.g., health, coverage, satisfaction).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!focusMetrics.trim()) {
                  setFocusMetrics(DEFAULT_METRICS_TABLE);
                  emitRebuild({ focusMetrics: DEFAULT_METRICS_TABLE });
                }
              }}
            >
              Insert Table
            </Button>
          </div>
          <Textarea
            value={focusMetrics}
            onChange={(event) => {
              const next = event.target.value;
              setFocusMetrics(next);
              emitRebuild({ focusMetrics: next });
            }}
            placeholder={DEFAULT_METRICS_TABLE.trim()}
            className="min-h-[140px] font-mono"
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Supporting Notes</h2>
            <span className="text-xs text-muted-foreground">Optional</span>
          </div>
          <Textarea
            value={supportingNotes}
            onChange={(event) => {
              const next = event.target.value;
              setSupportingNotes(next);
              emitRebuild({ supportingNotes: next });
            }}
            placeholder="Document context, link to meeting notes, or add quick references."
            className="min-h-[140px]"
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Snapshots</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Projects List</p>
                <p className="text-xs text-muted-foreground">
                  Embed `[!projects-list]` scoped to this area.
                </p>
              </div>
              <Switch
                checked={includeProjectsSnapshot}
                onCheckedChange={(checked) => {
                  setIncludeProjectsSnapshot(checked);
                  let nextBlock = projectsSnapshotBlock;
                  if (checked && (!nextBlock || nextBlock.trim().length === 0)) {
                    nextBlock = '[!projects-list]';
                    setProjectsSnapshotBlock(nextBlock);
                  }
                  emitRebuild({
                    includeProjectsSnapshot: checked,
                    projectsSnapshotBlock: nextBlock ?? '',
                  });
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Goals List</p>
                <p className="text-xs text-muted-foreground">
                  Embed `[!goals-list]` scoped to this area.
                </p>
              </div>
              <Switch
                checked={includeGoalsSnapshot}
                onCheckedChange={(checked) => {
                  setIncludeGoalsSnapshot(checked);
                  let nextBlock = goalsSnapshotBlock;
                  if (checked && (!nextBlock || nextBlock.trim().length === 0)) {
                    nextBlock = '[!goals-list]';
                    setGoalsSnapshotBlock(nextBlock);
                  }
                  emitRebuild({
                    includeGoalsSnapshot: checked,
                    goalsSnapshotBlock: nextBlock ?? '',
                  });
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Additional Snapshot Content</p>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
            <Textarea
              value={snapshotsAdditional}
              onChange={(event) => {
                const next = event.target.value;
                setSnapshotsAdditional(next);
                emitRebuild({ snapshotsAdditional: next });
              }}
              placeholder="Add guidance, embeds, or context to accompany the snapshot lists."
              className="min-h-[140px]"
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default AreaPage;
