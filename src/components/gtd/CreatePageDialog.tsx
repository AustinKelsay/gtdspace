/**
 * @fileoverview Dialog for creating simple pages in Cabinet or Someday Maybe sections
 * @author Development Team
 * @created 2025-01-13
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { checkTauriContextAsync, isTauriContext } from '@/utils/tauri-ready';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect, type Option } from '@/components/ui/multi-select';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useToast } from '@/hooks/useToast';
import { FileText, Loader2 } from 'lucide-react';
import type { MarkdownFile, GTDVisionHorizon } from '@/types';
import {
  buildAreaMarkdown,
  buildGoalMarkdown,
  buildVisionMarkdown,
  buildPurposeMarkdown,
} from '@/utils/gtd-markdown-helpers';

interface CreatePageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  directory: string;
  directoryName: string;
  onSuccess?: (filePath: string) => void;
  sectionId?: string;
  spacePath?: string;
}

type ReferenceKey = 'projects' | 'areas' | 'goals' | 'vision' | 'purpose';
type HorizonSectionId = 'purpose' | 'vision' | 'goals' | 'areas';

const HORIZON_SECTION_IDS: ReadonlyArray<HorizonSectionId> = [
  'purpose',
  'vision',
  'goals',
  'areas',
];

const REFERENCE_DIR_MAP: Record<ReferenceKey, string> = {
  projects: 'Projects',
  areas: 'Areas of Focus',
  goals: 'Goals',
  vision: 'Vision',
  purpose: 'Purpose & Principles',
};

const README_REGEX = /(?:^|\/)README(?:\.(md|markdown))?$/i;

const VISION_HORIZON_OPTIONS: Array<{ value: GTDVisionHorizon; label: string }> = [
  { value: '3-years', label: '3 Years' },
  { value: '5-years', label: '5 Years' },
  { value: '10-years', label: '10 Years' },
  { value: 'custom', label: 'Custom' },
];

const HORIZON_REFERENCE_FIELDS: Record<
  HorizonSectionId,
  Array<{ key: ReferenceKey; label: string; optional?: boolean }>
> = {
  purpose: [
    { key: 'projects', label: 'Project References' },
    { key: 'goals', label: 'Goal References' },
    { key: 'vision', label: 'Vision References' },
    { key: 'areas', label: 'Area References', optional: true },
  ],
  vision: [
    { key: 'projects', label: 'Project References' },
    { key: 'goals', label: 'Goal References' },
    { key: 'areas', label: 'Area References' },
    { key: 'purpose', label: 'Purpose & Principles References', optional: true },
  ],
  goals: [
    { key: 'projects', label: 'Project References' },
    { key: 'areas', label: 'Area References' },
    { key: 'vision', label: 'Vision References', optional: true },
    { key: 'purpose', label: 'Purpose & Principles References', optional: true },
  ],
  areas: [
    { key: 'projects', label: 'Project References' },
    { key: 'goals', label: 'Goal References' },
    { key: 'areas', label: 'Area References', optional: true },
    { key: 'vision', label: 'Vision References', optional: true },
    { key: 'purpose', label: 'Purpose & Principles References', optional: true },
  ],
};

const createEmptyReferenceSelections = (): Record<ReferenceKey, string[]> => ({
  projects: [],
  areas: [],
  goals: [],
  vision: [],
  purpose: [],
});

const createEmptyReferenceOptions = (): Record<ReferenceKey, Option[]> => ({
  projects: [],
  areas: [],
  goals: [],
  vision: [],
  purpose: [],
});

const isHorizonSectionId = (value?: string): value is HorizonSectionId =>
  !!value && HORIZON_SECTION_IDS.includes(value as HorizonSectionId);

const normalizeReferenceValue = (value: string): string =>
  value.replace(/\\/g, '/').trim();

const stripMarkdownExtension = (value: string): string =>
  value.replace(/\.(md|markdown)$/i, '');

const dedupeNormalized = (values: string[]): string[] => {
  const seen = new Set<string>();
  return values
    .map((value) => normalizeReferenceValue(value))
    .filter((value) => value.length > 0 && !README_REGEX.test(value))
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
};

export const CreatePageDialog: React.FC<CreatePageDialogProps> = ({
  isOpen,
  onClose,
  directory,
  directoryName,
  onSuccess,
  sectionId,
  spacePath,
}) => {
  const [pageName, setPageName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [referenceSelections, setReferenceSelections] = useState<Record<ReferenceKey, string[]>>(() => createEmptyReferenceSelections());
  const [referenceOptions, setReferenceOptions] = useState<Record<ReferenceKey, Option[]>>(() => createEmptyReferenceOptions());
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [visionHorizonValue, setVisionHorizonValue] = useState<GTDVisionHorizon>('3-years');
  const { withErrorHandling } = useErrorHandler();
  const { showSuccess } = useToast();
  const activeHorizonSection = useMemo(() => (isHorizonSectionId(sectionId) ? sectionId : null), [sectionId]);
  const referenceFields = useMemo(
    () => (activeHorizonSection ? HORIZON_REFERENCE_FIELDS[activeHorizonSection] : []),
    [activeHorizonSection],
  );

  const resetReferenceState = useCallback(() => {
    setReferenceSelections(createEmptyReferenceSelections());
    setReferenceOptions(createEmptyReferenceOptions());
    setVisionHorizonValue('3-years');
    setReferencesLoading(false);
  }, []);

  const handleReferenceChange = useCallback((key: ReferenceKey, values: string[]) => {
    setReferenceSelections((prev) => ({
      ...prev,
      [key]: dedupeNormalized(values),
    }));
  }, []);

  useEffect(() => {
    if (!isOpen || !activeHorizonSection || !spacePath || referenceFields.length === 0) {
      return;
    }

    let isCancelled = false;
    const sanitizedBase = spacePath.replace(/[\\/]+$/, '');
    const separator = spacePath.includes('\\') ? '\\' : '/';

    const resolveDir = (subFolder: string) =>
      sanitizedBase ? `${sanitizedBase}${separator}${subFolder}` : subFolder;

    const loadOptions = async () => {
      setReferencesLoading(true);
      const keys = Array.from(new Set(referenceFields.map((field) => field.key)));
      try {
        const nextOptions = createEmptyReferenceOptions();
        await Promise.all(
          keys.map(async (key) => {
            if (key === 'projects') {
              const projects = await safeInvoke<Array<{ name: string; path?: string }>>(
                'list_gtd_projects',
                { spacePath },
                [],
              );
              if (projects) {
                nextOptions.projects = projects
                  .map((project) => ({
                    value: normalizeReferenceValue(project.path || `${resolveDir(REFERENCE_DIR_MAP.projects)}/${project.name}`),
                    label: project.name,
                  }))
                  .filter((option) => option.value.length > 0)
                  .sort((a, b) => a.label.localeCompare(b.label));
              }
            } else {
              const dirPath = resolveDir(REFERENCE_DIR_MAP[key]);
              const files = await safeInvoke<MarkdownFile[]>(
                'list_markdown_files',
                { path: dirPath },
                [],
              );
              if (files) {
                nextOptions[key] = files
                  .filter((file) => !README_REGEX.test(file.path.replace(/\\/g, '/')))
                  .map((file) => ({
                    value: normalizeReferenceValue(file.path),
                    label: stripMarkdownExtension(file.name),
                  }))
                  .sort((a, b) => a.label.localeCompare(b.label));
              }
            }
          }),
        );

        if (!isCancelled) {
          setReferenceOptions((prev) => ({
            ...prev,
            ...nextOptions,
          }));
        }
      } catch (error) {
        console.error('Failed to load horizon references', error);
      } finally {
        if (!isCancelled) {
          setReferencesLoading(false);
        }
      }
    };

    void loadOptions();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, activeHorizonSection, spacePath, referenceFields]);

  const applyHorizonTemplate = useCallback(async (
    filePath: string,
    rawFileName: string
  ): Promise<boolean> => {
    if (!activeHorizonSection) {
      return true;
    }

    const normalizedTitle = stripMarkdownExtension(rawFileName).trim();
    const normalizedRefs = {
      projects: dedupeNormalized(referenceSelections.projects),
      areas: dedupeNormalized(referenceSelections.areas),
      goals: dedupeNormalized(referenceSelections.goals),
      vision: dedupeNormalized(referenceSelections.vision),
      purpose: dedupeNormalized(referenceSelections.purpose),
    };
    const timestamp = new Date().toISOString();

    let nextContent = '';
    switch (activeHorizonSection) {
      case 'vision':
        nextContent = buildVisionMarkdown({
          title: normalizedTitle,
          horizon: visionHorizonValue,
          references: {
            projects: normalizedRefs.projects,
            goals: normalizedRefs.goals,
            areas: normalizedRefs.areas,
            purpose: normalizedRefs.purpose,
          },
          createdDateTime: timestamp,
        });
        break;
      case 'goals':
        nextContent = buildGoalMarkdown({
          title: normalizedTitle,
          status: 'in-progress',
          targetDate: null,
          references: {
            projects: normalizedRefs.projects,
            areas: normalizedRefs.areas,
            vision: normalizedRefs.vision,
            purpose: normalizedRefs.purpose,
          },
          createdDateTime: timestamp,
        });
        break;
      case 'areas':
        nextContent = buildAreaMarkdown({
          title: normalizedTitle,
          status: 'steady',
          reviewCadence: 'monthly',
          references: {
            projects: normalizedRefs.projects,
            areas: normalizedRefs.areas,
            goals: normalizedRefs.goals,
            vision: normalizedRefs.vision,
            purpose: normalizedRefs.purpose,
          },
          createdDateTime: timestamp,
        });
        break;
      case 'purpose':
        nextContent = buildPurposeMarkdown({
          title: normalizedTitle,
          references: {
            projects: normalizedRefs.projects,
            goals: normalizedRefs.goals,
            vision: normalizedRefs.vision,
            areas: normalizedRefs.areas,
          },
          createdDateTime: timestamp,
        });
        break;
      default:
        break;
    }

    if (nextContent.trim().length === 0) {
      return true;
    }

    await safeInvoke('save_file', { path: filePath, content: nextContent }, null);

    return true;
  }, [activeHorizonSection, referenceSelections, visionHorizonValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pageName.trim()) {
      return;
    }

    console.log('Creating page:', pageName, 'in directory:', directory);
    setIsCreating(true);

    try {
      const result = await withErrorHandling(
        async () => {
          console.log('Starting file creation process for:', pageName, 'in:', directory);
          // First check if the directory exists and create if needed
          try {
            console.log('Checking if directory exists:', directory);
            const directoryExistsBefore = await safeInvoke<boolean>('check_directory_exists', { path: directory }, false);
            console.log('Directory exists before:', directoryExistsBefore);
            if (!directoryExistsBefore) {
              let createResponse: unknown;
              try {
                createResponse = await safeInvoke<string>('create_directory', { path: directory }, null);
                if (!createResponse) {
                  throw new Error('Failed to create directory');
                }
              } catch (err) {
                const detail = err instanceof Error ? err.message : String(err);
                throw new Error(`Failed to create directory at '${directory}': ${detail}`);
              }

              const directoryExistsAfter = await safeInvoke<boolean>('check_directory_exists', { path: directory }, false);
              if (!directoryExistsAfter) {
                throw new Error(`Directory '${directory}' does not exist after creation attempt. Response: ${String(createResponse)}`);
              }
            }
          } catch (err) {
            console.error('Error checking/creating directory:', err);
            const detail = err instanceof Error ? err.message : String(err);
            throw new Error(`Unable to ensure directory exists at '${directory}': ${detail}`);
          }

          // Ensure the name ends with .md
          const fileName = pageName.trim().endsWith('.md') ? pageName.trim() : `${pageName.trim()}.md`;
          console.log('Creating file with name:', fileName);

          // Create the file - using FileOperationResult type
          const createResult = await safeInvoke<{ success: boolean; path?: string; message?: string }>('create_file', {
            directory,
            name: fileName,
          }, { success: false, message: 'Failed to create file' });

          if (!createResult.success) {
            throw new Error(createResult.message || 'Failed to create file');
          }

          // Prefer the backend-created path, fallback to OS-safe join
          // Ensure Tauri context check runs first to prime the cache
          await checkTauriContextAsync();
          const filePath = createResult.path || (isTauriContext()
            ? await import('@tauri-apps/api/path').then(m => m.join(directory, fileName))
            : `${directory}/${fileName}`);

          // Overwrite template with enriched metadata when creating horizon pages
          if (filePath && activeHorizonSection) {
            const templateApplied = await applyHorizonTemplate(filePath, fileName);
            if (!templateApplied) {
              throw new Error('Failed to apply horizon template to new page');
            }
          }

          return filePath;
        },
        `Failed to create page in ${directoryName}`,
        'file'
      );

      if (result) {
        showSuccess(`Page "${pageName}" created in ${directoryName}`);
        onSuccess?.(result);
        handleClose();
      }
    } catch (unexpectedError) {
      // Catch any unexpected errors that weren't handled by withErrorHandling
      console.error('Unexpected error in CreatePageDialog:', unexpectedError);
    } finally {
      // Always reset isCreating, even if there's an error
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setPageName('');
    setIsCreating(false);
    resetReferenceState();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Page in {directoryName}
          </DialogTitle>
          <DialogDescription>
            Create a new page in the {directoryName} directory
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="page-name">Page Name</Label>
              <Input
                id="page-name"
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
                placeholder={directoryName === 'Someday Maybe' ? 'Learn new language' : 'Important contacts'}
                required
                autoFocus
                disabled={isCreating}
              />
              <p className="text-xs text-muted-foreground">
                {directoryName === 'Someday Maybe'
                  ? 'Ideas and projects for future consideration'
                  : 'Reference materials and documentation'}
              </p>
            </div>

            {activeHorizonSection && (
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="space-y-1">
                  <Label>Horizon Metadata</Label>
                  <p className="text-xs text-muted-foreground">
                    Link this page to related projects and horizons for richer navigation.
                  </p>
                </div>

                {activeHorizonSection === 'vision' && (
                  <div className="grid gap-2">
                    <Label htmlFor="vision-horizon">Vision Horizon</Label>
                    <Select
                      value={visionHorizonValue}
                      onValueChange={(value) => setVisionHorizonValue(value as GTDVisionHorizon)}
                      disabled={isCreating}
                    >
                      <SelectTrigger id="vision-horizon">
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
                )}

                {!spacePath && (
                  <p className="text-xs text-muted-foreground">
                    Reference selectors become available once a GTD space is connected.
                  </p>
                )}

                {spacePath && referencesLoading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading reference options…
                  </p>
                )}

                {spacePath && referenceFields.map((field) => {
                  const labelText = field.optional ? `${field.label} (optional)` : field.label;
                  return (
                    <div key={field.key} className="space-y-2">
                      <Label>{labelText}</Label>
                      <MultiSelect
                        options={referenceOptions[field.key] ?? []}
                        value={referenceSelections[field.key]}
                        onValueChange={(values) => handleReferenceChange(field.key, values)}
                        placeholder={referencesLoading ? `Loading ${field.label.toLowerCase()}...` : `Select ${field.label.toLowerCase()}`}
                        disabled={isCreating || referencesLoading}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!pageName.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create Page'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePageDialog;
