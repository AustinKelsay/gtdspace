import React from 'react';
import { Search, X } from 'lucide-react';
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
  buildPurposeMarkdown,
  DEFAULT_PURPOSE_DESCRIPTION,
  type PurposeReferenceGroups,
} from '@/utils/gtd-markdown-helpers';
import { syncHorizonBacklink } from '@/utils/horizon-backlinks';
import { checkTauriContextAsync } from '@/utils/tauri-ready';
import { safeInvoke } from '@/utils/safe-invoke';
import { formatDisplayDate } from '@/utils/format-display-date';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import type { MarkdownFile } from '@/types';

export interface PurposePageProps {
  content: string;
  onChange: (nextContent: string) => void;
  filePath?: string;
  className?: string;
}

type PurposeReferenceKey = 'projects' | 'goals' | 'vision' | 'areas';

const HORIZON_DIRS: Record<Exclude<PurposeReferenceKey, 'projects'>, string> = {
  goals: 'Goals',
  vision: 'Vision',
  areas: 'Areas of Focus',
};

type PurposeReferenceOption = {
  path: string;
  name: string;
  horizon: PurposeReferenceKey;
};

const README_REGEX = /(?:^|\/)README(?:\.(md|markdown))?$/i;

type EmitOverrides = Partial<{
  title: string;
  references: PurposeReferenceGroups;
  description: string;
}>;

const PURPOSE_REFERENCE_LABELS: Record<PurposeReferenceKey, string> = {
  projects: 'Projects References',
  goals: 'Goals References',
  vision: 'Vision References',
  areas: 'Areas References',
};

const PURPOSE_REFERENCE_ORDER: PurposeReferenceKey[] = ['projects', 'goals', 'vision', 'areas'];

const CANONICAL_METADATA_HEADINGS: RegExp[] = [
  /^##\s+Projects\s+References\b/i,
  /^##\s+Goals\s+References\b/i,
  /^##\s+Vision\s+References\b/i,
  /^##\s+Areas\s+References\b/i,
  /^##\s+Created\b/i,
  /^##\s+Description\b/i,
];

const DESCRIPTION_HEADING = /^##\s+Description\b/i;
const LEGACY_PURPOSE_HEADING = /^##\s+Purpose\s+Statement\b/i;
const LEGACY_PRINCIPLES_HEADING = /^##\s+Principles\b/i;

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim().replace(/\\+/g, '/') : ''))
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
          .map((item) => (typeof item === 'string' ? item.trim().replace(/\\+/g, '/') : ''))
          .filter(Boolean);
      }
    } catch {
      // Fall through to CSV parsing
    }

    // Fall back to CSV split
    return trimmed
      .split(',')
      .map((entry) => entry.trim().replace(/\\+/g, '/'))
      .filter(Boolean);
  }
  return [];
}

function displayNameForReference(ref: string): string {
  const normalized = ref.replace(/\\/g, '/');
  const leaf = normalized.split('/').pop();
  if (!leaf) return normalized;
  return leaf.replace(/\.(md|markdown)$/i, '');
}

function collectSection(content: string, heading: RegExp): string {
  const lines = content.split(/\r?\n/);
  const buffer: string[] = [];
  let collecting = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (heading.test(trimmed)) {
      collecting = true;
      buffer.length = 0;
      continue;
    }

    if (!collecting) {
      continue;
    }

    if (CANONICAL_METADATA_HEADINGS.some((regex) => regex.test(trimmed))) {
      break;
    }

    if (/^##(?!#)/.test(trimmed)) {
      break;
    }

    buffer.push(rawLine);
  }

  return buffer.length ? buffer.join('\n').replace(/^\s*\n+/, '').trimEnd() : '';
}

function parsePurposeDescription(content: string): string {
  const canonicalDescription = collectSection(content, DESCRIPTION_HEADING);
  if (canonicalDescription) {
    return canonicalDescription;
  }

  const legacyStatement = collectSection(content, LEGACY_PURPOSE_HEADING);
  const legacyPrinciples = collectSection(content, LEGACY_PRINCIPLES_HEADING);

  let combined = '';
  if (legacyStatement) {
    combined += legacyStatement;
  }

  if (legacyPrinciples) {
    if (combined.length > 0) {
      combined += '\n\n### Principles\n';
    } else {
      combined += '### Principles\n';
    }
    combined += legacyPrinciples;
  }

  return combined.trim();
}

const PurposePage: React.FC<PurposePageProps> = ({ content, onChange, filePath, className }) => {
  const meta = React.useMemo(() => extractMetadata(content || ''), [content]);
  const parsedDescription = React.useMemo(() => parsePurposeDescription(content || ''), [content]);
  const { withErrorHandling } = useErrorHandler();

  const syncBacklinkSafely = React.useCallback(
    (options: Parameters<typeof syncHorizonBacklink>[0]) =>
      withErrorHandling(
        () => syncHorizonBacklink(options),
        'Failed to update purpose backlinks. Please try again.',
        'sync-horizon-backlink'
      ),
    [withErrorHandling]
  );

  const initialTitle =
    typeof meta.title === 'string' && meta.title.trim().length > 0 ? meta.title.trim() : 'Purpose & Principles';

  const initialReferences = React.useMemo<PurposeReferenceGroups>(
    () => ({
      projects: toStringArray((meta as any).projectsReferences),
      goals: toStringArray((meta as any).goalsReferences),
      vision: toStringArray((meta as any).visionReferences),
      areas: toStringArray((meta as any).areasReferences),
    }),
    [meta]
  );

  const [title, setTitle] = React.useState<string>(initialTitle);
  const [references, setReferences] = React.useState<PurposeReferenceGroups>(initialReferences);
  const [description, setDescription] = React.useState<string>(
    parsedDescription.trim() === DEFAULT_PURPOSE_DESCRIPTION.trim() ? '' : parsedDescription
  );
  const [activePicker, setActivePicker] = React.useState<PurposeReferenceKey | null>(null);
  const [pickerOptions, setPickerOptions] = React.useState<PurposeReferenceOption[]>([]);
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
      typeof meta.title === 'string' && meta.title.trim().length > 0 ? meta.title.trim() : 'Purpose & Principles';
    setTitle(nextTitle);
    setReferences({
      projects: toStringArray((meta as any).projectsReferences),
      goals: toStringArray((meta as any).goalsReferences),
      vision: toStringArray((meta as any).visionReferences),
      areas: toStringArray((meta as any).areasReferences),
    });

    const updatedDescription = parsePurposeDescription(content || '');
    setDescription(
      updatedDescription.trim() === DEFAULT_PURPOSE_DESCRIPTION.trim() ? '' : updatedDescription
    );
  }, [meta, content]);

  const loadReferenceOptions = React.useCallback(
    async (key: PurposeReferenceKey): Promise<PurposeReferenceOption[]> => {
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
          
          // Process projects with path validation
          const validatedProjects = await Promise.all(
            projects.map(async (project): Promise<PurposeReferenceOption | null> => {
              const normalizedName = project.name.trim();
              let resolvedPath: string | null = null;
              
              // Check if project.path is falsy
              if (!project.path || project.path.trim() === '') {
                // Construct fallback path - try the project directory first, then README files
                const projectDirPath = `${spacePath}/Projects/${normalizedName}`.replace(/\\/g, '/');
                const readmeMdPath = `${projectDirPath}/README.md`;
                const readmeMarkdownPath = `${projectDirPath}/README.markdown`;
                
                // Check fallback paths in order: directory, README.md, README.markdown
                const dirExists = await safeInvoke<boolean>(
                  'check_directory_exists',
                  { path: projectDirPath },
                  false
                );
                
                if (dirExists) {
                  resolvedPath = projectDirPath;
                } else {
                  const readmeMdExists = await safeInvoke<boolean>(
                    'check_file_exists',
                    { filePath: readmeMdPath },
                    false
                  );
                  
                  if (readmeMdExists) {
                    resolvedPath = readmeMdPath;
                  } else {
                    const readmeMarkdownExists = await safeInvoke<boolean>(
                      'check_file_exists',
                      { filePath: readmeMarkdownPath },
                      false
                    );
                    
                    if (readmeMarkdownExists) {
                      resolvedPath = readmeMarkdownPath;
                    }
                  }
                }
                
                if (!resolvedPath) {
                  // No valid fallback path found
                  console.warn(
                    `[PurposePage] Project "${normalizedName}" has no valid path. ` +
                    `Original path was missing/empty, and none of the fallback paths exist: ` +
                    `"${projectDirPath}", "${readmeMdPath}", "${readmeMarkdownPath}"`
                  );
                  return null;
                }
                
                // Log warning when fallback is used
                console.warn(
                  `[PurposePage] Project "${normalizedName}" had missing/empty path. ` +
                  `Using fallback path: "${resolvedPath}"`
                );
              } else {
                // Use provided path and normalize it
                resolvedPath = project.path.replace(/\\/g, '/');
                
                // Verify the provided path exists (file or directory)
                let pathExists = await safeInvoke<boolean>(
                  'check_file_exists',
                  { filePath: resolvedPath },
                  false
                );
                
                if (!pathExists) {
                  pathExists = await safeInvoke<boolean>(
                    'check_directory_exists',
                    { path: resolvedPath },
                    false
                  );
                }
                
                if (!pathExists) {
                  // Log warning for missing file or directory
                  console.warn(
                    `[PurposePage] Project "${normalizedName}" has invalid path: "${resolvedPath}" does not exist. ` +
                    `Skipping this project.`
                  );
                  return null;
                }
              }
              
              return {
                path: resolvedPath,
                name: normalizedName,
                horizon: key,
              };
            })
          );
          
          // Filter out null entries (invalid projects) and sort
          return validatedProjects
            .filter((project): project is PurposeReferenceOption => project !== null)
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
      }, 'Failed to load references', `purpose-${key}-references`);

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
      const nextReferences = overrides?.references ?? references;
      const nextDescription = overrides?.description ?? description;

      const built = buildPurposeMarkdown({
        title: nextTitle,
        references: nextReferences,
        createdDateTime: createdRef.current,
        description: nextDescription,
      });

      if (built !== content) {
        onChange(built);
      }
    },
    [title, references, description, content, onChange]
  );

  const handleReferenceToggle = React.useCallback(
    (key: PurposeReferenceKey, value: string) => {
      const normalizedTarget = value.replace(/\\/g, '/');
      let action: 'add' | 'remove' = 'add';

      setReferences((current) => {
        const group = current[key] ?? [];
        const isPresent = group.includes(value);
        action = isPresent ? 'remove' : 'add';
        const nextGroup = isPresent ? group.filter((ref) => ref !== value) : [...group, value];
        const next = { ...current, [key]: nextGroup };
        emitRebuild({ references: next });
        const attemptedAction = action;

        if (normalizedFilePath && normalizedTarget) {
          void syncBacklinkSafely({
            sourcePath: normalizedFilePath,
            sourceKind: 'purpose',
            targetPath: normalizedTarget,
            action: attemptedAction,
          }).then((result) => {
            if (result === null) {
              const originalHadValue = attemptedAction === 'remove';
              setReferences((latest) => {
                const latestGroup = latest[key] ?? [];
                const currentlyHas = latestGroup.includes(value);
                if (currentlyHas === originalHadValue) {
                  return latest;
                }
                const revertedGroup = originalHadValue
                  ? [...latestGroup, value]
                  : latestGroup.filter((ref) => ref !== value);
                const reverted = { ...latest, [key]: revertedGroup };
                emitRebuild({ references: reverted });
                return reverted;
              });
            }
          });
        }

        return next;
      });
    },
    [emitRebuild, normalizedFilePath, syncBacklinkSafely]
  );

  const handleReferenceRemove = React.useCallback(
    (key: PurposeReferenceKey, value: string) => {
      const normalizedTarget = value.replace(/\\/g, '/');
      setReferences((current) => {
        const group = current[key] ?? [];
        if (!group.includes(value)) {
          return current;
        }

        const nextGroup = group.filter((item) => item !== value);
        const next = { ...current, [key]: nextGroup };
        emitRebuild({ references: next });

        if (normalizedFilePath && normalizedTarget) {
          void syncBacklinkSafely({
            sourcePath: normalizedFilePath,
            sourceKind: 'purpose',
            targetPath: normalizedTarget,
            action: 'remove',
          }).then((result) => {
            if (result === null) {
              setReferences((latest) => {
                const latestGroup = latest[key] ?? [];
                if (latestGroup.includes(value)) {
                  return latest;
                }
                const revertedGroup = [...latestGroup, value];
                const reverted = { ...latest, [key]: revertedGroup };
                emitRebuild({ references: reverted });
                return reverted;
              });
            }
          });
        }

        return next;
      });
    },
    [emitRebuild, normalizedFilePath, syncBacklinkSafely]
  );

  const onDescriptionChange = React.useCallback(
    (nextValue: string) => {
      const trimmed = nextValue.trim();
      const clean = trimmed === DEFAULT_PURPOSE_DESCRIPTION.trim() ? '' : nextValue;
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
          placeholder="Purpose & Principles"
        />

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Created</span>
            </div>
            <div className="text-sm text-muted-foreground">{createdDisplayValue}</div>
          </div>

          {PURPOSE_REFERENCE_ORDER.map((key) => {
            const currentRefs = references[key] ?? [];
            const label = PURPOSE_REFERENCE_LABELS[key];
            const isOptional = key === 'areas';

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {label}
                    {isOptional ? ' (optional)' : ''}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{currentRefs.length} linked</span>
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
                    <DialogTitle>Manage {PURPOSE_REFERENCE_LABELS[activePicker]}</DialogTitle>
                    <DialogDescription>
                      Select items to link with this purpose document. Existing selections stay highlighted.
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
                        {activePicker === 'projects' ? 'Projects' : HORIZON_DIRS[activePicker]} folder to link them here.
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
                              <div className="text-xs text-muted-foreground mt-1 truncate">{option.path}</div>
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
            content={description || DEFAULT_PURPOSE_DESCRIPTION}
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

export default PurposePage;
