/**
 * @fileoverview Dialog for creating new habits with frequency and status tracking
 * @author Development Team
 * @created 2025-01-13
 */

import React, { useState } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useToast } from '@/hooks/useToast';
import { RefreshCw, Clock, Search, X } from 'lucide-react';
import type { HabitReferenceGroups } from '@/utils/gtd-markdown-helpers';
import type { MarkdownFile } from '@/types';

interface CreateHabitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  spacePath: string;
  onSuccess?: (habitPath: string) => void;
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Every Day' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { value: 'every-other-day', label: 'Every Other Day' },
  { value: 'twice-weekly', label: 'Twice a Week' },
  { value: 'weekly', label: 'Once Every Week' },
  { value: 'biweekly', label: 'Once Every Other Week' },
  { value: 'monthly', label: 'Once a Month' },
  { value: '5-minute', label: 'Every 5 Minutes (Testing)' },
];

type ReferenceKey = keyof HabitReferenceGroups;

type HabitReferenceOption = {
  path: string;
  name: string;
};

const HORIZON_DIRS: Record<ReferenceKey, string> = {
  projects: 'Projects',
  areas: 'Areas of Focus',
  goals: 'Goals',
  vision: 'Vision',
  purpose: 'Purpose & Principles',
};

const referenceLabels: Record<ReferenceKey, string> = {
  projects: 'Projects References',
  areas: 'Areas References',
  goals: 'Goals References',
  vision: 'Vision References',
  purpose: 'Purpose & Principles References',
};

const REFERENCE_KEYS: ReferenceKey[] = ['projects', 'areas', 'goals', 'vision', 'purpose'];

const README_REGEX = /(?:^|\/)README(?:\.(md|markdown))?$/i;

function displayNameForReference(ref: string): string {
  const normalized = ref.replace(/\\/g, '/');
  const leaf = normalized.split('/').pop();
  if (!leaf) return normalized;
  return leaf.replace(/\.(md|markdown)$/i, '');
}

function stripReadmeReferences(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && !README_REGEX.test(value.replace(/\\/g, '/')));
}

const createEmptyReferences = (): HabitReferenceGroups => ({
  projects: [],
  areas: [],
  goals: [],
  vision: [],
  purpose: [],
});

const createEmptyOptionCache = (): Record<ReferenceKey, HabitReferenceOption[]> => ({
  projects: [],
  areas: [],
  goals: [],
  vision: [],
  purpose: [],
});

// Habits always start as 'todo' - removed status selection from UI

export const CreateHabitDialog: React.FC<CreateHabitDialogProps> = ({
  isOpen,
  onClose,
  spacePath,
  onSuccess,
}) => {
  const [habitName, setHabitName] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [focusTime, setFocusTime] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [references, setReferences] = useState<HabitReferenceGroups>(createEmptyReferences);
  const [activeReferenceKey, setActiveReferenceKey] = useState<ReferenceKey | null>(null);
  const [referenceOptionCache, setReferenceOptionCache] = useState<Record<ReferenceKey, HabitReferenceOption[]>>(createEmptyOptionCache);
  const [referenceOptions, setReferenceOptions] = useState<HabitReferenceOption[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referenceSearch, setReferenceSearch] = useState('');
  const [manualReference, setManualReference] = useState('');
  const { withErrorHandling } = useErrorHandler();
  const { showSuccess } = useToast();

  const updateReferenceGroup = React.useCallback(
    (key: ReferenceKey, updater: (current: string[]) => string[]) => {
      setReferences((prev) => {
        const current = prev[key] ?? [];
        const nextValues = stripReadmeReferences(updater(current));
        if (
          current.length === nextValues.length &&
          current.every((value, index) => value === nextValues[index])
        ) {
          return prev;
        }
        return {
          ...prev,
          [key]: nextValues,
        };
      });
    },
    []
  );

  const loadReferenceOptions = React.useCallback(
    async (key: ReferenceKey) => {
      const requestKey = key;
      if (!spacePath) {
        setReferenceOptions([]);
        return;
      }

      if (activeReferenceKey === requestKey) {
        setReferencesLoading(true);
      }
      try {
        let options: HabitReferenceOption[] = [];
        if (key === 'projects') {
          const projects = await safeInvoke<Array<{ name: string; path: string }>>(
            'list_gtd_projects',
            { spacePath },
            []
          );
          if (projects) {
            options = projects
              .map((project) => {
                const path = (project.path || `${spacePath}/${HORIZON_DIRS.projects}/${project.name}`).replace(/\\/g, '/');
                return { path, name: project.name };
              })
              .filter((option) => option.path.trim().length > 0);
          }
        } else {
          const dirPath = `${spacePath}/${HORIZON_DIRS[key]}`;
          const files = await safeInvoke<MarkdownFile[]>(
            'list_markdown_files',
            { path: dirPath },
            []
          );
          if (files) {
            options = files
              .filter((file) => !README_REGEX.test(file.path.replace(/\\/g, '/')))
              .map((file) => ({
                path: file.path.replace(/\\/g, '/'),
                name: file.name.replace(/\.(md|markdown)$/i, ''),
              }));
          }
        }

        const unique = options.filter(
          (option, index, arr) => arr.findIndex((candidate) => candidate.path === option.path) === index
        );

        if (activeReferenceKey === requestKey) {
          setReferenceOptionCache((prev) => ({
            ...prev,
            [key]: unique,
          }));
          setReferenceOptions(unique);
        }
      } catch (error) {
        console.error('[CreateHabitDialog] Failed to load references', error);
        if (activeReferenceKey === requestKey) {
          setReferenceOptionCache((prev) => ({
            ...prev,
            [key]: [],
          }));
          setReferenceOptions([]);
        }
      } finally {
        if (activeReferenceKey === requestKey) {
          setReferencesLoading(false);
        }
      }
    },
    [spacePath, activeReferenceKey]
  );

  React.useEffect(() => {
    if (!activeReferenceKey) {
      setReferenceOptions([]);
      setReferencesLoading(false);
      return;
    }

    const cached = referenceOptionCache[activeReferenceKey];
    if (cached && cached.length > 0) {
      setReferenceOptions(cached);
      setReferencesLoading(false);
      return;
    }

    loadReferenceOptions(activeReferenceKey);
  }, [activeReferenceKey, referenceOptionCache, loadReferenceOptions]);

  const filteredReferenceOptions = React.useMemo(() => {
    if (!referenceSearch) return referenceOptions;
    const query = referenceSearch.toLowerCase();
    return referenceOptions.filter((option) =>
      option.name.toLowerCase().includes(query) || option.path.toLowerCase().includes(query)
    );
  }, [referenceOptions, referenceSearch]);

  const toggleReferenceManager = React.useCallback(
    (key: ReferenceKey) => {
      if (activeReferenceKey === key) {
        setActiveReferenceKey(null);
        setReferenceSearch('');
        setManualReference('');
        return;
      }
      setReferenceSearch('');
      setManualReference('');
      setActiveReferenceKey(key);
    },
    [activeReferenceKey]
  );

  const handleReferenceToggle = React.useCallback(
    (key: ReferenceKey, value: string) => {
      const normalized = value.replace(/\\/g, '/').trim();
      if (!normalized) return;
      updateReferenceGroup(key, (current) => {
        if (current.includes(normalized)) {
          return current.filter((ref) => ref !== normalized);
        }
        return [...current, normalized];
      });
    },
    [updateReferenceGroup]
  );

  const handleManualReferenceAdd = React.useCallback(
    (key: ReferenceKey) => {
      const trimmed = manualReference.trim();
      if (!trimmed) return;
      handleReferenceToggle(key, trimmed);
      setManualReference('');
    },
    [manualReference, handleReferenceToggle]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!habitName.trim()) {
      return;
    }

    setIsCreating(true);

    const referencesPayload = REFERENCE_KEYS.reduce<HabitReferenceGroups>(
      (acc, key) => {
        acc[key] = Array.from(
          new Set(
            references[key]
              .map((value) => value.replace(/\\/g, '/').trim())
              .filter((value) => value.length > 0)
          )
        );
        return acc;
      },
      createEmptyReferences()
    );

    const focusTimeValue = focusTime.trim() || null;

    const payload = {
      spacePath,
      habitName: habitName.trim(),
      frequency,
      status: 'todo' as const, // Always start habits as 'todo'
      focusTime: focusTimeValue, // Optional focus time
      references: referencesPayload,
    };

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[CreateHabitDialog] create_gtd_habit payload', payload);
    }

    const result = await withErrorHandling(
      async () => {
        const habitPath = await safeInvoke<string>('create_gtd_habit', payload, null);
        if (!habitPath) {
          throw new Error('Failed to create habit');
        }
        return habitPath;
      },
      'Failed to create habit',
      'habit'
    );

    setIsCreating(false);

    if (result) {
      showSuccess(`Habit "${habitName}" created`);
      handleClose();
      if (onSuccess) {
        onSuccess(result);
      }
    }
  };

  const handleClose = () => {
    setHabitName('');
    setFrequency('daily');
    setFocusTime('');
    setIsCreating(false);
    setReferences(createEmptyReferences());
    setActiveReferenceKey(null);
    setReferenceOptionCache(createEmptyOptionCache());
    setReferenceOptions([]);
    setReferenceSearch('');
    setManualReference('');
    setReferencesLoading(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-green-600" />
            Create New Habit
          </DialogTitle>
          <DialogDescription>
            Set up a new habit to track regularly
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="habit-name">Habit Name</Label>
              <Input
                id="habit-name"
                value={habitName}
                onChange={(e) => setHabitName(e.target.value)}
                placeholder="Morning Exercise"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                What habit do you want to build?
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How often will you practice this habit?
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Horizon References</Label>
              <p className="text-xs text-muted-foreground">
                Link this habit to supporting projects, areas, and long-range outcomes.
              </p>
              <div className="space-y-4">
                {REFERENCE_KEYS.map((key) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {referenceLabels[key]}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => toggleReferenceManager(key)}
                      >
                        {activeReferenceKey === key ? 'Hide' : 'Manage'}
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {references[key].length > 0 ? (
                        references[key].map((ref, idx) => (
                          <Badge
                            key={`${ref}-${idx}`}
                            variant="outline"
                            className="px-2 py-0.5 text-xs flex items-center gap-1.5 h-6 max-w-[16rem] truncate"
                          >
                            {displayNameForReference(ref)}
                            <button
                              type="button"
                              onClick={() => handleReferenceToggle(key, ref)}
                              className="hover:text-muted-foreground transition-colors"
                              aria-label={`Remove ${displayNameForReference(ref)}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No references linked yet</span>
                      )}
                    </div>
                    {activeReferenceKey === key && (
                      <div className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={`Search ${referenceLabels[key].toLowerCase()}...`}
                            value={referenceSearch}
                            onChange={(e) => setReferenceSearch(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                        <ScrollArea className="h-40 border border-dashed border-border/60 rounded-md">
                          <div className="p-2 space-y-1">
                            {referencesLoading ? (
                              <div className="text-xs text-muted-foreground text-center py-6">
                                Loading references...
                              </div>
                            ) : filteredReferenceOptions.length > 0 ? (
                              filteredReferenceOptions.map((option) => {
                                const selected = references[key].includes(option.path);
                                return (
                                  <button
                                    type="button"
                                    key={option.path}
                                    onClick={() => handleReferenceToggle(key, option.path)}
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selected ? 'bg-muted text-muted-foreground' : 'hover:bg-accent'
                                      }`}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{option.name}</span>
                                      <span className="text-xs text-muted-foreground truncate">{option.path}</span>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="text-xs text-muted-foreground text-center py-6">
                                No matches found
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                        <div className="flex items-center gap-2">
                          <Input
                            value={manualReference}
                            onChange={(e) => setManualReference(e.target.value)}
                            placeholder="Paste path or URL"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleManualReferenceAdd(key)}
                            disabled={!manualReference.trim()}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="focus-time" className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Focus Time (Optional)
              </Label>
              <Input
                id="focus-time"
                type="time"
                value={focusTime}
                onChange={(e) => setFocusTime(e.target.value)}
                placeholder="09:00"
              />
              <p className="text-xs text-muted-foreground">
                What time of day will you do this habit? (e.g., 09:00 for 9 AM)
              </p>
            </div>

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
            <Button type="submit" disabled={!habitName.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create Habit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateHabitDialog;
