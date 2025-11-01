import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import { MultiSelect, type Option } from '@/components/ui/multi-select';
import type { MarkdownFile } from '@/types';
import { safeInvoke } from '@/utils/safe-invoke';
import { useToast } from '@/hooks/useToast';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTDProjectCreate, GTDProjectStatus } from '@/types';
import { extractMetadata } from '@/utils/metadata-extractor';

// Horizon marker constants used in README
const HORIZON_MARKERS = {
  projects: 'projects-references',
  areas: 'areas-references',
  goals: 'goals-references',
  vision: 'vision-references',
  purpose: 'purpose-references',
} as const;

const normalizeReferencePath = (value: string): string =>
  value.replace(/\\/g, '/').trim();

const uniqueSortedPaths = (values: string[]): string[] => {
  const normalized = values
    .map(normalizeReferencePath)
    .filter(Boolean);
  return Array.from(new Set(normalized)).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
};

const encodeReferencePayload = (values: string[]): string => {
  const unique = uniqueSortedPaths(values);
  if (unique.length === 0) return '';
  try {
    return encodeURIComponent(JSON.stringify(unique));
  } catch {
    return encodeURIComponent(unique.join(','));
  }
};

const escapeForRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const upsertReferenceMarker = (
  content: string,
  marker: string,
  encodedPayload: string,
  headings: string[]
): string => {
  const markerRegex = new RegExp(`\\[!${marker}:[^\\]]*\\]`, 'i');
  if (markerRegex.test(content)) {
    return content.replace(markerRegex, `[!${marker}:${encodedPayload}]`);
  }

  for (const heading of headings) {
    const headingRegex = new RegExp(
      `${escapeForRegex(heading)}\\s*(?:\\r?\\n)+`,
      'i'
    );
    if (headingRegex.test(content)) {
      return content.replace(
        headingRegex,
        `${heading}\n[!${marker}:${encodedPayload}]\n\n`
      );
    }
  }

  const fallbackHeading = headings[0] || '## Projects References';
  const trimmed = content.trimEnd();
  return `${trimmed}\n\n${fallbackHeading}\n[!${marker}:${encodedPayload}]\n`;
};

const ensureProjectLinkedInHorizon = async (
  filePath: string,
  projectRef: string,
  horizonType: 'area' | 'goal' | 'vision' | 'purpose'
) => {
  const normalizedPath = normalizeReferencePath(filePath);
  const current = await safeInvoke<string>('read_file', { path: normalizedPath }, null);
  if (typeof current !== 'string') return;

  const metadata = extractMetadata(current);
  const existingRaw = metadata.projectsReferences;
  const existing =
    Array.isArray(existingRaw)
      ? existingRaw
      : typeof existingRaw === 'string' && existingRaw.trim()
      ? [existingRaw]
      : [];

  const merged = uniqueSortedPaths([...existing, projectRef]);
  if (merged.length === existing.length) {
    // No change needed
    return;
  }

  const encodedPayload = encodeReferencePayload(merged);
  const headings =
    horizonType === 'area'
      ? ['## Projects References']
      : ['## Horizon References', '## Projects References'];

  const updated = upsertReferenceMarker(
    current,
    HORIZON_MARKERS.projects,
    encodedPayload,
    headings
  );

  if (updated !== current) {
    await safeInvoke('save_file', { path: normalizedPath, content: updated }, null);
  }
};

const linkProjectToHorizons = async (
  projectPath: string,
  horizonSelections: {
    areas: string[];
    goals: string[];
    visions: string[];
    purposes: string[];
  }
) => {
  const normalizedProjectPath = normalizeReferencePath(projectPath);
  const operations: Promise<void>[] = [];

  horizonSelections.areas.forEach((areaPath) => {
    operations.push(
      ensureProjectLinkedInHorizon(areaPath, normalizedProjectPath, 'area')
    );
  });

  horizonSelections.goals.forEach((goalPath) => {
    operations.push(
      ensureProjectLinkedInHorizon(goalPath, normalizedProjectPath, 'goal')
    );
  });

  horizonSelections.visions.forEach((visionPath) => {
    operations.push(
      ensureProjectLinkedInHorizon(visionPath, normalizedProjectPath, 'vision')
    );
  });

  horizonSelections.purposes.forEach((purposePath) => {
    operations.push(
      ensureProjectLinkedInHorizon(
        purposePath,
        normalizedProjectPath,
        'purpose'
      )
    );
  });

  if (operations.length > 0) {
    await Promise.allSettled(operations);
  }
};

interface GTDProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  spacePath: string;
  onSuccess?: () => void;
}

export const GTDProjectDialog: React.FC<GTDProjectDialogProps> = ({
  isOpen,
  onClose,
  spacePath,
  onSuccess,
}) => {
  const [projectName, setProjectName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [dueTime, setDueTime] = React.useState('');
  const [status, setStatus] = React.useState<GTDProjectStatus>('in-progress');
  const [isCreating, setIsCreating] = React.useState(false);
  const { createProject } = useGTDSpace();
  const { showError } = useToast();

  // Horizon linking (optional)
  const [areaOptions, setAreaOptions] = React.useState<Option[]>([]);
  const [goalOptions, setGoalOptions] = React.useState<Option[]>([]);
  const [visionOptions, setVisionOptions] = React.useState<Option[]>([]);
  const [purposeOptions, setPurposeOptions] = React.useState<Option[]>([]);

  const [areas, setAreas] = React.useState<string[]>([]);
  const [goals, setGoals] = React.useState<string[]>([]);
  const [visions, setVisions] = React.useState<string[]>([]);
  const [purposes, setPurposes] = React.useState<string[]>([]);

  const [isLoadingHorizons, setIsLoadingHorizons] = React.useState(false);

  const loadHorizonOptions = React.useCallback(async () => {
    if (!spacePath) return;
    setIsLoadingHorizons(true);
    try {
      const mapFilesToOptions = (files: MarkdownFile[] | null | undefined): Option[] => {
        if (!files) return [];
        return files
          .filter(f => !f.name.toLowerCase().includes('readme'))
          .map((f) => ({ value: f.path.replace(/\\/g, '/'), label: f.name.replace(/\.md$/i, '') }));
      };

      const areasPath = `${spacePath}/Areas of Focus`;
      const goalsPath = `${spacePath}/Goals`;
      const visionPath = `${spacePath}/Vision`;
      const purposePath = `${spacePath}/Purpose & Principles`;

      const [areasFiles, goalsFiles, visionFiles, purposeFiles] = await Promise.all([
        safeInvoke<MarkdownFile[]>('list_markdown_files', { path: areasPath }, []),
        safeInvoke<MarkdownFile[]>('list_markdown_files', { path: goalsPath }, []),
        safeInvoke<MarkdownFile[]>('list_markdown_files', { path: visionPath }, []),
        safeInvoke<MarkdownFile[]>('list_markdown_files', { path: purposePath }, []),
      ]);

      setAreaOptions(mapFilesToOptions(areasFiles));
      setGoalOptions(mapFilesToOptions(goalsFiles));
      setVisionOptions(mapFilesToOptions(visionFiles));
      setPurposeOptions(mapFilesToOptions(purposeFiles));
    } finally {
      setIsLoadingHorizons(false);
    }
  }, [spacePath]);

  // Load horizon options whenever dialog opens
  React.useEffect(() => {
    if (isOpen) {
      loadHorizonOptions();
    } else {
      // Reset selections when closing
      setAreas([]);
      setGoals([]);
      setVisions([]);
      setPurposes([]);
    }
  }, [isOpen, loadHorizonOptions]);

  const handleCreate = async () => {
    console.log('[GTDProjectDialog] handleCreate called with:', {
      projectName: projectName.trim(),
      description: description.trim(),
      dueDate,
      status,
      spacePath
    });

    if (!projectName.trim() || !description.trim()) {
      console.log('[GTDProjectDialog] Validation failed - missing name or description');
      return;
    }

    console.log('[GTDProjectDialog] Setting isCreating to true');
    setIsCreating(true);

    try {
      // Use date-only format (YYYY-MM-DD) as per type definition
      const dueDateOnly: string | null = dueDate || null;

      const projectData: GTDProjectCreate = {
        spacePath: spacePath,
        projectName: projectName.trim(),
        description: description.trim(),
        dueDate: dueDateOnly,
        status: status,
      };

      console.log('[GTDProjectDialog] Calling createProject with:', projectData);
      const result = await createProject(projectData);
      console.log('[GTDProjectDialog] createProject result:', result);

      if (result) {
        const horizonSelections = {
          areas: [...areas],
          goals: [...goals],
          visions: [...visions],
          purposes: [...purposes],
        };
        // If horizon links were selected, write them to the new README
        const hasAnyHorizon = areas.length || goals.length || visions.length || purposes.length;
        if (hasAnyHorizon) {
          try {
            const readmePath = `${result}/README.md`;
            const current = await safeInvoke<string>('read_file', { path: readmePath }, '');
            if (current != null) {
              const toJson = (arr: string[]) => JSON.stringify(arr.map(p => p.replace(/\\/g, '/')));
              const replaceMarker = (content: string, marker: string, payload: string) => {
                const re = new RegExp(`\\[!${marker}:([^\\]]*)\\]`);
                if (re.test(content)) return content.replace(re, `[!${marker}:${payload}]`);
                // Fallback: append under Horizon References if available
                if (/## Horizon References/.test(content)) {
                  return content.replace(
                    /## Horizon References\n/,
                    `## Horizon References\n\n[!${marker}:${payload}]\n\n`
                  );
                }
                // Last resort: append at end
                return `${content.trim()}\n\n[!${marker}:${payload}]\n`;
              };

              let updated = current;
              if (areas.length)   updated = replaceMarker(updated, HORIZON_MARKERS.areas, toJson(areas));
              if (goals.length)   updated = replaceMarker(updated, HORIZON_MARKERS.goals, toJson(goals));
              if (visions.length) updated = replaceMarker(updated, HORIZON_MARKERS.vision, toJson(visions));
              if (purposes.length)updated = replaceMarker(updated, HORIZON_MARKERS.purpose, toJson(purposes));

              if (updated !== current) {
                await safeInvoke('save_file', { path: readmePath, content: updated }, null);
              }
            }
          } catch (e) {
            console.warn('[GTDProjectDialog] Failed to write horizon references to README', e);
            showError('Failed to link selected horizons to the project README. You can try again after opening the project.');
          }
        }

        if (areas.length || goals.length || visions.length || purposes.length) {
          try {
            await linkProjectToHorizons(result, horizonSelections);
          } catch (e) {
            console.warn('[GTDProjectDialog] Failed to sync project references with horizons', e);
          }
        }

        // Reset form
        setProjectName('');
        setDescription('');
        setDueDate('');
        setDueTime('');
        setStatus('in-progress');
        setAreas([]);
        setGoals([]);
        setVisions([]);
        setPurposes([]);

        // Call success callback if provided
        if (onSuccess) {
          console.log('[GTDProjectDialog] Calling onSuccess callback');
          onSuccess();
        }

        onClose();
      }
    } catch (error) {
      console.error('[GTDProjectDialog] Error creating project:', error);
    } finally {
      console.log('[GTDProjectDialog] Setting isCreating to false');
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setProjectName('');
      setDescription('');
      setDueDate('');
      setDueTime('');
      setStatus('in-progress');
      setAreas([]);
      setGoals([]);
      setVisions([]);
      setPurposes([]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Define a project with a clear outcome. Projects are multi-step endeavors that move you toward your goals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="e.g., Launch Company Blog"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Desired Outcome</Label>
            <Textarea
              id="description"
              placeholder="What is the desired outcome of this project?"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as GTDProjectStatus)} disabled={isCreating}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select project status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

        <div className="space-y-2">
          <Label htmlFor="due-date">Due Date (Optional)</Label>
          <p className="text-xs text-muted-foreground mb-2">
            When does this project need to be completed?
          </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isCreating}
                  placeholder="Date"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              <Input
                id="due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={isCreating}
                placeholder="Time"
              />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Horizon Links (Optional)</Label>
          <p className="text-xs text-muted-foreground">
            Link this project to higher horizons. These references will be written to the project README.
          </p>

          {([
            { key: 'areas' as const,   label: 'Areas of Focus',       options: areaOptions,   value: areas,    onChange: setAreas,    placeholderNoun: 'areas' },
            { key: 'goals' as const,   label: 'Goals',                 options: goalOptions,   value: goals,    onChange: setGoals,    placeholderNoun: 'goals' },
            { key: 'vision' as const,  label: 'Vision',                options: visionOptions, value: visions,  onChange: setVisions,  placeholderNoun: 'vision docs' },
            { key: 'purpose' as const, label: 'Purpose & Principles',  options: purposeOptions,value: purposes, onChange: setPurposes, placeholderNoun: 'purpose docs' },
          ]).map(cfg => (
            <div key={cfg.key} className="space-y-2">
              <Label>{cfg.label}</Label>
              <MultiSelect
                options={cfg.options}
                value={cfg.value}
                onValueChange={cfg.onChange}
                placeholder={isLoadingHorizons ? `Loading ${cfg.placeholderNoun}...` : `Select related ${cfg.placeholderNoun}`}
                disabled={isCreating || isLoadingHorizons}
              />
            </div>
          ))}
        </div>

      </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              console.log('[GTDProjectDialog] Create button clicked');
              handleCreate();
            }}
            disabled={!projectName.trim() || !description.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
