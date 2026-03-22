import React from "react";
import { Calendar, Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { EnhancedTextEditor } from "@/components/editor/EnhancedTextEditor";
import {
  buildProjectMarkdown,
  DEFAULT_PROJECT_OUTCOME,
  type ProjectHorizonReferences,
} from "@/utils/gtd-markdown-helpers";
import { parseActionMarkdown } from "@/utils/gtd-action-markdown";
import { parseHabitContent } from "@/utils/gtd-habit-markdown";
import {
  normalizeProjectHorizonReferences,
  parseProjectMarkdown,
  sanitizeProjectAdditionalContent,
  toDateOnly,
} from "@/utils/gtd-project-content";
import {
  displayNameForReference,
  normalizeProjectPathFromReadme,
  normalizeProjectReferencePath,
  normalizeReferencePath,
  README_REFERENCE_REGEX,
} from "@/utils/gtd-reference-utils";
import { syncHorizonBacklink } from "@/utils/horizon-backlinks";
import { checkTauriContextAsync } from "@/utils/tauri-ready";
import { safeInvoke } from "@/utils/safe-invoke";
import { formatDisplayDate } from "@/utils/format-display-date";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import type { GTDProjectStatus, MarkdownFile } from "@/types";
import { Circle, CircleDot, CheckCircle2, RefreshCw, LayoutList, Activity, CircleOff } from "lucide-react";
import { GeneralReferencesField } from "@/components/gtd/GeneralReferencesField";

export interface ProjectPageProps {
  content: string;
  onChange: (nextContent: string) => void;
  filePath?: string;
  className?: string;
}

type HorizonKey = "areas" | "goals" | "vision" | "purpose";

const HORIZON_DIRS: Record<HorizonKey, string> = {
  areas: "Areas of Focus",
  goals: "Goals",
  vision: "Vision",
  purpose: "Purpose & Principles",
};

const HORIZON_LABELS: Record<HorizonKey, string> = {
  areas: "Areas References",
  goals: "Goals References",
  vision: "Vision References",
  purpose: "Purpose & Principles References",
};

const HORIZON_ORDER: HorizonKey[] = ["areas", "goals", "vision", "purpose"];

const PROJECT_STATUS_OPTIONS: Array<{ value: GTDProjectStatus; label: string }> = [
  { value: "in-progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

type HorizonOption = {
  path: string;
  name: string;
  horizon: HorizonKey;
};

type ProjectActionItem = {
  name: string;
  path: string;
  status: "in-progress" | "waiting" | "completed" | "cancelled";
  dueDate?: string | null;
  focusDate?: string | null;
};

const statusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "waiting":
      return <CircleDot className="h-4 w-4 text-purple-500" />;
    case "cancelled":
      return <CircleOff className="h-4 w-4 text-muted-foreground" />;
    case "in-progress":
    default:
      return <Circle className="h-4 w-4 text-blue-500" />;
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "completed":
      return "Completed";
    case "waiting":
      return "Waiting";
    case "cancelled":
      return "Cancelled";
    case "in-progress":
    default:
      return "In Progress";
  }
};

const ProjectActionsSection: React.FC<{ projectPath: string | null }> = ({ projectPath }) => {
  const [items, setItems] = React.useState<ProjectActionItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const requestIdRef = React.useRef(0);
  const { withErrorHandling } = useErrorHandler();

  const load = React.useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const requestedProjectPath = projectPath;

    if (!projectPath) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const inTauri = await checkTauriContextAsync();
      if (!inTauri) {
        setItems([]);
        return;
      }

      const files = await safeInvoke<MarkdownFile[]>(
        "list_project_actions",
        { projectPath },
        []
      );

      const actions = await Promise.all(
        (files ?? []).map(async (file) => {
          if (requestId !== requestIdRef.current || requestedProjectPath !== projectPath) {
            return null;
          }

          const content = await withErrorHandling(async () => {
            const result = await safeInvoke<string>("read_file", { path: file.path }, null);
            if (result == null) {
              throw new Error(`Failed to read action file: ${file.path}`);
            }
            return result;
          });
          if (typeof content !== "string") {
            return null;
          }
          const parsedAction = parseActionMarkdown(content);
          const fallbackName = file.name.replace(/\.(md|markdown)$/i, "");
          return {
            name:
              parsedAction.title && parsedAction.title !== "Untitled"
                ? parsedAction.title
                : fallbackName,
            path: file.path,
            status: parsedAction.status,
            dueDate: parsedAction.dueDate || null,
            focusDate: parsedAction.focusDate || null,
          } as ProjectActionItem;
        })
      );

      if (requestId !== requestIdRef.current || requestedProjectPath !== projectPath) {
        return;
      }

      const validActions = actions.filter((item): item is ProjectActionItem => item !== null);
      validActions.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      setItems(validActions);
    } catch (error) {
      if (requestId === requestIdRef.current && requestedProjectPath === projectPath) {
        console.error("ProjectActionsSection: failed to load actions", error);
        setItems([]);
      }
    } finally {
      if (requestId === requestIdRef.current && requestedProjectPath === projectPath) {
        setLoading(false);
      }
    }
  }, [projectPath, withErrorHandling]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!projectPath) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutList className="h-4 w-4" />
          <h2 className="text-xl font-semibold">Actions</h2>
          <span className="text-sm text-muted-foreground">{items.length}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => load()}
          disabled={loading}
          className="gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No actions yet. Create one to kick things off.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.path}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                {statusIcon(item.status)}
                <span className="font-medium">{item.name}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{statusLabel(item.status)}</span>
                {item.dueDate && <span>Due {formatDisplayDate(item.dueDate)}</span>}
                {item.focusDate && <span>Focus {formatDisplayDate(item.focusDate)}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

type ProjectHabitItem = {
  name: string;
  path: string;
};

const ProjectHabitsSection: React.FC<{ projectPath: string | null }> = ({ projectPath }) => {
  const [habits, setHabits] = React.useState<ProjectHabitItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const requestIdRef = React.useRef(0);
  const { withErrorHandling } = useErrorHandler();

  const load = React.useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const requestedProjectPath = projectPath;

    if (!projectPath) {
      setHabits([]);
      return;
    }

    const spacePath = window.localStorage.getItem("gtdspace-current-path") || "";
    if (!spacePath) {
      setHabits([]);
      return;
    }

    setLoading(true);
    try {
      const inTauri = await checkTauriContextAsync();
      if (!inTauri) {
        setHabits([]);
        return;
      }

      const habitsDir = `${spacePath}/Habits`;
      const files = await safeInvoke<MarkdownFile[]>(
        "list_markdown_files",
        { path: habitsDir },
        []
      );

      const projectNormalized = normalizeProjectReferencePath(projectPath);

      const matches: ProjectHabitItem[] = [];
      for (const file of files ?? []) {
        if (requestId !== requestIdRef.current || requestedProjectPath !== projectPath) {
          return;
        }

        const content = await withErrorHandling(async () => {
          const result = await safeInvoke<string>("read_file", { path: file.path }, null);
          if (result == null) {
            throw new Error(`Failed to read habit file: ${file.path}`);
          }
          return result;
        });
        if (typeof content !== "string") {
          continue;
        }
        const parsedHabit = parseHabitContent(content);
        const normalizedRefs = parsedHabit.references.projects.map((ref) =>
          normalizeProjectReferencePath(ref)
        );
        if (normalizedRefs.includes(projectNormalized)) {
          matches.push({
            name: file.name.replace(/\.(md|markdown)$/i, ""),
            path: file.path,
          });
        }
      }

      if (requestId !== requestIdRef.current || requestedProjectPath !== projectPath) {
        return;
      }

      matches.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      setHabits(matches);
    } catch (error) {
      if (requestId === requestIdRef.current && requestedProjectPath === projectPath) {
        console.error("ProjectHabitsSection: failed to load habits", error);
        setHabits([]);
      }
    } finally {
      if (requestId === requestIdRef.current && requestedProjectPath === projectPath) {
        setLoading(false);
      }
    }
  }, [projectPath, withErrorHandling]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!projectPath) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <h2 className="text-xl font-semibold">Related Habits</h2>
          <span className="text-sm text-muted-foreground">{habits.length}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => load()}
          disabled={loading}
          className="gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <div className="space-y-2">
        {habits.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No related habits yet.</p>
        ) : (
          habits.map((habit) => (
            <div
              key={habit.path}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <span className="font-medium">{habit.name}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[50%]">{habit.path.replace(/\\/g, "/")}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

const ProjectPage: React.FC<ProjectPageProps> = ({
  content,
  onChange,
  filePath,
  className,
}) => {
  const parsed = React.useMemo(() => parseProjectMarkdown(content || ""), [content]);
  const { withErrorHandling } = useErrorHandler();
  const [title, setTitle] = React.useState<string>(parsed.title);
  const [status, setStatus] = React.useState<GTDProjectStatus>(parsed.status);
  const [dueDate, setDueDate] = React.useState<string>(parsed.dueDate);
  const [desiredOutcome, setDesiredOutcome] = React.useState<string>(parsed.desiredOutcome);
  const [horizonRefs, setHorizonRefs] = React.useState<ProjectHorizonReferences>(
    parsed.horizonReferences
  );
  const [references, setReferences] = React.useState<string[]>(parsed.references);
  const [includeHabitsList, setIncludeHabitsList] = React.useState<boolean>(
    parsed.includeHabitsList
  );
  const [additionalContent, setAdditionalContent] = React.useState<string>(
    parsed.additionalContent
  );

  const [activeHorizonPicker, setActiveHorizonPicker] = React.useState<HorizonKey | null>(null);
  const [horizonOptions, setHorizonOptions] = React.useState<HorizonOption[]>([]);
  const [horizonSearch, setHorizonSearch] = React.useState<string>("");
  const [horizonLoading, setHorizonLoading] = React.useState(false);

  React.useEffect(() => {
    setTitle(parsed.title);
    setStatus(parsed.status);
    setDueDate(parsed.dueDate);
    setHorizonRefs(parsed.horizonReferences);
    setReferences(parsed.references);
    setDesiredOutcome(parsed.desiredOutcome);
    setIncludeHabitsList(parsed.includeHabitsList);
    setAdditionalContent(parsed.additionalContent);
  }, [parsed]);

  const normalizedFilePath = React.useMemo(
    () => (filePath ? filePath.replace(/\\/g, "/") : ""),
    [filePath]
  );
  const projectPath = React.useMemo(() => normalizeProjectPathFromReadme(filePath), [filePath]);
  const createdDisplayValue = React.useMemo(
    () => formatDisplayDate(parsed.createdDateTime),
    [parsed.createdDateTime]
  );

  const emitRebuild = React.useCallback(
    (
      overrides?: Partial<{
        title: string;
        status: GTDProjectStatus;
        dueDate: string;
        desiredOutcome: string;
        horizonReferences: ProjectHorizonReferences;
        references: string[];
        includeHabitsList: boolean;
        additionalContent: string;
      }>
    ) => {
      const nextTitle = overrides?.title ?? title;
      const nextStatus = overrides?.status ?? status;
      const nextDueDate = toDateOnly(overrides?.dueDate ?? dueDate);
      const nextOutcome = overrides?.desiredOutcome ?? desiredOutcome;
      const nextHorizon = overrides?.horizonReferences ?? horizonRefs;
      const nextReferences = overrides?.references ?? references;
      const nextIncludeHabits =
        overrides?.includeHabitsList ?? includeHabitsList;
      const nextAdditional = overrides?.additionalContent ?? additionalContent;

      const built = buildProjectMarkdown({
        title: nextTitle,
        status: nextStatus,
        dueDate: nextDueDate,
        desiredOutcome: nextOutcome,
        horizonReferences: nextHorizon,
        references: nextReferences,
        createdDateTime: parsed.createdDateTime,
        includeHabitsList: nextIncludeHabits,
        additionalContent: nextAdditional,
      });

      if (built !== content) {
        onChange(built);
      }
    },
    [
      title,
      status,
      dueDate,
      desiredOutcome,
      horizonRefs,
      references,
      includeHabitsList,
      additionalContent,
      parsed.createdDateTime,
      content,
      onChange,
    ]
  );

  const loadHorizonOptions = React.useCallback(
    async (key: HorizonKey): Promise<HorizonOption[]> => {
      const spacePath = window.localStorage.getItem("gtdspace-current-path") || "";
      if (!spacePath) return [];

      const inTauri = await checkTauriContextAsync();
      if (!inTauri) return [];

      return withErrorHandling(async () => {
        const dirName = HORIZON_DIRS[key];
        const dirPath = `${spacePath}/${dirName}`;
        const files = await safeInvoke<MarkdownFile[]>(
          "list_markdown_files",
          { path: dirPath },
          []
        );
        if (!files) return [];
        return files
          .filter((file) => !README_REFERENCE_REGEX.test(file.path.replace(/\\/g, "/")))
          .map((file) => ({
            path: file.path.replace(/\\/g, "/"),
            name: file.name.replace(/\.(md|markdown)$/i, ""),
            horizon: key,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      }, "Failed to load horizon references", `project-${key}-references`) ?? [];
    },
    [withErrorHandling]
  );

  React.useEffect(() => {
    if (!activeHorizonPicker) return;
    let cancelled = false;
    setHorizonLoading(true);
    setHorizonSearch("");
    setHorizonOptions([]);

    loadHorizonOptions(activeHorizonPicker)
      .then((options) => {
        if (!cancelled) {
          setHorizonOptions(options);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHorizonLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeHorizonPicker, loadHorizonOptions]);

  const filteredHorizonOptions = React.useMemo(() => {
    if (!horizonSearch) return horizonOptions;
    const query = horizonSearch.toLowerCase();
    return horizonOptions.filter((option) => {
      const nameMatch = option.name.toLowerCase().includes(query);
      const pathMatch = option.path.toLowerCase().includes(query);
      return nameMatch || pathMatch;
    });
  }, [horizonOptions, horizonSearch]);

  const handleHorizonToggle = React.useCallback(
    (key: HorizonKey, value: string) => {
      const normalizedTarget = normalizeReferencePath(value);
      if (!normalizedTarget) return;

      const normalizedCurrent = normalizeProjectHorizonReferences(horizonRefs);
      const group = normalizedCurrent[key] ?? [];
      const isPresent = group.includes(normalizedTarget);
      const action: "add" | "remove" = isPresent ? "remove" : "add";
      const nextGroup = isPresent
        ? group.filter((ref) => ref !== normalizedTarget)
        : [...group, normalizedTarget];
      const next = {
        ...normalizedCurrent,
        [key]: nextGroup,
      };

      setHorizonRefs(next);
      emitRebuild({ horizonReferences: next });
      if (normalizedFilePath) {
        void syncHorizonBacklink({
          sourcePath: normalizedFilePath,
          sourceKind: "projects",
          targetPath: normalizedTarget,
          action,
        });
      }
    },
    [emitRebuild, horizonRefs, normalizedFilePath]
  );

  const handleHorizonRemove = React.useCallback(
    (key: HorizonKey, value: string) => {
      const normalizedTarget = normalizeReferencePath(value);
      if (!normalizedTarget) return;

      const normalizedCurrent = normalizeProjectHorizonReferences(horizonRefs);
      const group = normalizedCurrent[key] ?? [];
      if (!group.includes(normalizedTarget)) {
        return;
      }

      const nextGroup = group.filter((ref) => ref !== normalizedTarget);
      const next = {
        ...normalizedCurrent,
        [key]: nextGroup,
      };

      setHorizonRefs(next);
      emitRebuild({ horizonReferences: next });
      if (normalizedFilePath) {
        void syncHorizonBacklink({
          sourcePath: normalizedFilePath,
          sourceKind: "projects",
          targetPath: normalizedTarget,
          action: "remove",
        });
      }
    },
    [emitRebuild, horizonRefs, normalizedFilePath]
  );

  const handleDesiredOutcomeChange = React.useCallback(
    (next: string) => {
      setDesiredOutcome(next);
      emitRebuild({ desiredOutcome: next });
    },
    [emitRebuild]
  );

  const handleAdditionalContentChange = React.useCallback(
    (next: string) => {
      setAdditionalContent(next);
      emitRebuild({ additionalContent: sanitizeProjectAdditionalContent(next) });
    },
    [emitRebuild]
  );

  const manageHabitsToggle = React.useCallback(
    (checked: boolean) => {
      setIncludeHabitsList(checked);
      emitRebuild({ includeHabitsList: checked });
    },
    [emitRebuild]
  );

  return (
    <div className={`${className ?? ""} w-full`}>
      <div className="px-12 py-6 space-y-6">
        <input
          type="text"
          value={title}
          onChange={(event) => {
            const next = event.target.value;
            setTitle(next);
            emitRebuild({ title: next });
          }}
          className="w-full bg-background text-foreground text-5xl font-bold leading-tight tracking-[-0.01em] border-0 outline-none placeholder:text-muted-foreground"
          placeholder="Untitled Project"
        />

        <div className="grid gap-y-4">
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Project Status</span>
              <Select
                value={status}
                onValueChange={(value) => {
                  const next = value as GTDProjectStatus;
                  setStatus(next);
                  emitRebuild({ status: next });
                }}
              >
                <SelectTrigger className="h-9 text-sm" aria-label="Project status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Due Date</span>
              <div className="relative w-full max-w-[16rem]">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => {
                    const next = toDateOnly(event.target.value);
                    setDueDate(next);
                    emitRebuild({ dueDate: next });
                  }}
                  className="pr-10"
                  aria-label="Project due date"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Created</span>
              <div className="text-sm text-muted-foreground">{createdDisplayValue}</div>
            </div>

            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Related Habits Section</span>
              <div className="flex items-center gap-3">
                <Switch
                  checked={includeHabitsList}
                  onCheckedChange={manageHabitsToggle}
                  aria-label="Toggle related habits section"
                />
                <span className="text-xs text-muted-foreground">
                  {includeHabitsList ? "Visible" : "Hidden"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
            {HORIZON_ORDER.map((key) => {
              const group = horizonRefs[key] ?? [];
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      {HORIZON_LABELS[key]}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {group.length} linked
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setActiveHorizonPicker(key)}
                      >
                        Manage
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.length > 0 ? (
                      group.map((ref) => (
                        <Badge
                          key={ref}
                          variant="outline"
                          className="px-2 py-0.5 text-xs flex items-center gap-1.5 h-6 max-w-[16rem] truncate"
                          title={ref}
                        >
                          {displayNameForReference(ref)}
                          <button
                            type="button"
                            onClick={() => handleHorizonRemove(key, ref)}
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

          <GeneralReferencesField
            value={references}
            onChange={(next) => {
              setReferences(next);
              emitRebuild({ references: next });
            }}
            filePath={filePath}
            className="pt-2"
          />
        </div>
      </div>

      <Dialog
        open={activeHorizonPicker !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveHorizonPicker(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          {activeHorizonPicker && (
            <>
              <DialogHeader>
                <DialogTitle>{HORIZON_LABELS[activeHorizonPicker]}</DialogTitle>
                <DialogDescription>
                  Link existing {HORIZON_DIRS[activeHorizonPicker]} pages to this project.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 mt-4">
                <Input
                  value={horizonSearch}
                  onChange={(event) => setHorizonSearch(event.target.value)}
                  placeholder="Search by name or path"
                />
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>

              <ScrollArea className="mt-4 max-h-80 border border-border rounded-md">
                <div className="p-3 space-y-2">
                  {horizonLoading ? (
                    <span className="text-sm text-muted-foreground">Loading…</span>
                  ) : filteredHorizonOptions.length > 0 ? (
                    filteredHorizonOptions.map((option) => {
                      const group = horizonRefs[activeHorizonPicker] ?? [];
                      const isActive = group.includes(option.path);
                      return (
                        <Button
                          key={option.path}
                          variant={isActive ? "secondary" : "ghost"}
                          className="w-full justify-between"
                          onClick={() => handleHorizonToggle(activeHorizonPicker, option.path)}
                        >
                          <span className="truncate text-left">{option.name}</span>
                          <span className="text-xs text-muted-foreground truncate max-w-[12rem]">
                            {option.path}
                          </span>
                        </Button>
                      );
                    })
                  ) : (
                    <span className="text-sm text-muted-foreground">No results found.</span>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="border-t border-border w-full" />

      <div className="px-12 pt-6 pb-12 space-y-8 align-with-header">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Desired Outcome</h2>
          <EnhancedTextEditor
            content={desiredOutcome || DEFAULT_PROJECT_OUTCOME}
            onChange={handleDesiredOutcomeChange}
            readOnly={false}
            autoFocus={false}
            className="flex-1"
            filePath={filePath}
            frame="bare"
            showStatusBar={false}
          />
        </section>

        <ProjectActionsSection projectPath={projectPath} />

        {includeHabitsList && <ProjectHabitsSection projectPath={projectPath} />}

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Project Notes</h2>
          <EnhancedTextEditor
            content={additionalContent}
            onChange={handleAdditionalContentChange}
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

export default ProjectPage;
