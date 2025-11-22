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
import { extractMetadata } from "@/utils/metadata-extractor";
import {
  buildProjectMarkdown,
  DEFAULT_PROJECT_OUTCOME,
  type ProjectHorizonReferences,
} from "@/utils/gtd-markdown-helpers";
import { syncHorizonBacklink } from "@/utils/horizon-backlinks";
import { checkTauriContextAsync } from "@/utils/tauri-ready";
import { safeInvoke } from "@/utils/safe-invoke";
import { formatDisplayDate } from "@/utils/format-display-date";
import { normalizeStatus } from "@/utils/gtd-status";
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

const README_REGEX = /(?:^|\/)README(?:\.(md|markdown))?$/i;

const CANONICAL_HEADINGS: RegExp[] = [
  /^##\s+Status\b/i,
  /^##\s+Due\s+Date/i,
  /^##\s+Desired\s+Outcome\b/i,
  /^##\s+Horizon\s+References\b/i,
  /^##\s+References\b/i,
  /^##\s+Created\b/i,
  /^##\s+Actions\b/i,
  /^##\s+Related\s+Habits\b/i,
];

interface ProjectSections {
  desiredOutcome: string;
  includeHabitsList: boolean;
  additionalContent: string;
}

const CANONICAL_TRAILING_HEADINGS: RegExp[] = [
  /^##\s+References\s*(?:\(optional\))?\s*$/i,
  /^##\s+Horizon\s+References\s*(?:\(optional\))?\s*$/i,
];

const CANONICAL_MARKERS = [
  /\[!references:[^\]]*\]/i,
  /\[!projects-references:[^\]]*\]/i,
  /\[!areas-references:[^\]]*\]/i,
  /\[!goals-references:[^\]]*\]/i,
  /\[!vision-references:[^\]]*\]/i,
  /\[!purpose-references:[^\]]*\]/i,
];

function toDateOnly(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.length >= 10 && /\d{4}-\d{2}-\d{2}/.test(trimmed.slice(0, 10))) {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${parsed.getFullYear()}-${month}-${day}`;
  }
  return "";
}

function sanitizeAdditionalContent(content: string): string {
  if (!content.trim()) return "";

  const lines = content.split(/\r?\n/);
  const kept: string[] = [];
  let skipping = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (skipping) {
      if (trimmed.startsWith("## ")) {
        skipping = false;
        i -= 1; // re-process this heading normally
      }
      continue;
    }

    if (CANONICAL_TRAILING_HEADINGS.some((regex) => regex.test(trimmed))) {
      skipping = true;
      continue;
    }

    if (CANONICAL_MARKERS.some((regex) => regex.test(trimmed))) {
      continue;
    }

    kept.push(rawLine);
  }

  return kept.join("\n").replace(/\s+$/g, "").replace(/^\s*\n/, "");
}

function parseProjectSections(content: string): ProjectSections {
  const lines = content.split(/\r?\n/);
  const desiredBuffer: string[] = [];
  let collectingDesired = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^##\s+Desired\s+Outcome\b/i.test(line)) {
      collectingDesired = true;
      desiredBuffer.length = 0;
      continue;
    }

    if (collectingDesired) {
      if (CANONICAL_HEADINGS.some((regex) => regex.test(line))) {
        break;
      }
      desiredBuffer.push(rawLine);
    }
  }

  const desiredOutcome = desiredBuffer.length
    ? desiredBuffer.join("\n").replace(/^\s*\n+/, "").trimEnd()
    : "";

  const includeHabitsList = /\[!habits-list(?:[:\]])/i.test(content);

  let additionalContent = "";
  const habitsMatch = /\[!habits-list[^\]]*\]/i.exec(content);
  if (habitsMatch) {
    const start = habitsMatch.index + habitsMatch[0].length;
    additionalContent = content.slice(start).replace(/^\s*\n/, "");
  } else {
    const actionsMatch = /\[!actions-list[^\]]*\]/i.exec(content);
    if (actionsMatch) {
      const start = actionsMatch.index + actionsMatch[0].length;
      additionalContent = content.slice(start).replace(/^\s*\n/, "");
    }
  }

  return {
    desiredOutcome,
    includeHabitsList,
    additionalContent: sanitizeAdditionalContent(additionalContent),
  };
}

function normalizeProjectStatus(raw: unknown): GTDProjectStatus {
  const token = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  switch (token) {
    case "cancelled":
    case "canceled":
    case "cancel":
    case "abandoned":
    case "dropped":
      return "cancelled";
    case "waiting":
    case "on-hold":
    case "paused":
    case "blocked":
      return "waiting";
    case "completed":
    case "complete":
    case "done":
    case "finished":
      return "completed";
    case "in-progress":
    case "active":
    case "ongoing":
    case "working":
    default:
      return "in-progress";
  }
}

function normalizeReference(value: string): string {
  return value.replace(/\\/g, "/").trim();
}

function normalizeReferenceGroup(values?: ReadonlyArray<string>): string[] {
  if (!values || values.length === 0) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const candidate = normalizeReference(value);
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    normalized.push(candidate);
  }
  return normalized;
}

function normalizeHorizonReferences(groups: ProjectHorizonReferences): ProjectHorizonReferences {
  return {
    areas: normalizeReferenceGroup(groups.areas),
    goals: normalizeReferenceGroup(groups.goals),
    vision: normalizeReferenceGroup(groups.vision),
    purpose: normalizeReferenceGroup(groups.purpose),
  };
}

function normalizeGeneralReferences(values?: ReadonlyArray<string>): string[] {
  return normalizeReferenceGroup(values);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? normalizeReference(item) : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    // Try to decode and parse as JSON first
    try {
      const decoded = decodeURIComponent(trimmed);
      const parsed = JSON.parse(decoded);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? normalizeReference(item) : ""))
          .filter(Boolean);
      }
    } catch {
      // Fall through to CSV parsing
    }

    // Fall back to CSV split
    return trimmed
      .split(",")
      .map((entry) => normalizeReference(entry))
      .filter(Boolean);
  }
  return [];
}

function displayNameForReference(ref: string): string {
  const normalized = normalizeReference(ref);
  const leaf = normalized.split("/").pop();
  if (!leaf) return normalized;
  return leaf.replace(/\.(md|markdown)$/i, "");
}

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

function normalizeProjectPathFromReadme(filePath?: string): string | null {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/(.+\/Projects\/.+)\/README\.(md|markdown)$/i);
  if (!match) return null;
  const projectPath = match[1];

  const relative = projectPath.split("/Projects/")[1];
  if (!relative) return null;
  const segments = relative.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  return projectPath;
}

function normalizeProjectReferencePath(raw: string): string {
  return raw
    .replace(/\\/g, "/")
    .replace(/\/README\.(md|markdown)$/i, "")
    .replace(/\/+$/, "");
}

const ProjectActionsSection: React.FC<{ projectPath: string | null }> = ({ projectPath }) => {
  const [items, setItems] = React.useState<ProjectActionItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
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
          const content = await safeInvoke<string>("read_file", { path: file.path }, "");
          const meta = extractMetadata(content || "");
          const statusRaw = typeof meta.status === "string" ? meta.status : undefined;
          const status = normalizeStatus(statusRaw as string | undefined) ?? "in-progress";
          return {
            name: meta.title || file.name.replace(/\.md$/i, ""),
            path: file.path,
            status,
            dueDate: typeof meta.dueDate === "string" ? meta.dueDate : null,
            focusDate: typeof meta.focusDate === "string" ? meta.focusDate : null,
          } as ProjectActionItem;
        })
      );

      actions.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      setItems(actions);
    } catch (error) {
      console.error("ProjectActionsSection: failed to load actions", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

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

  const load = React.useCallback(async () => {
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
        const content = await safeInvoke<string>("read_file", { path: file.path }, "");
        const meta = extractMetadata(content || "");
        const refs = Array.isArray((meta as any).projectsReferences)
          ? ((meta as any).projectsReferences as string[])
          : typeof (meta as any).projectsReferences === "string"
            ? [(meta as any).projectsReferences as string]
            : [];

        const normalizedRefs = refs
          .map((ref) => normalizeProjectReferencePath(ref))
          .filter(Boolean);
        if (normalizedRefs.includes(projectNormalized)) {
          matches.push({
            name: file.name.replace(/\.md$/i, ""),
            path: file.path,
          });
        }
      }

      matches.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      setHabits(matches);
    } catch (error) {
      console.error("ProjectHabitsSection: failed to load habits", error);
      setHabits([]);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

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
  const meta = React.useMemo(() => extractMetadata(content || ""), [content]);
  const parsedSections = React.useMemo(
    () => parseProjectSections(content || ""),
    [content]
  );
  const { withErrorHandling } = useErrorHandler();

  const initialTitle =
    typeof meta.title === "string" && meta.title.trim().length > 0
      ? meta.title.trim()
      : "Untitled Project";

  const initialHorizonRefs = React.useMemo<ProjectHorizonReferences>(() => {
    const parsed: ProjectHorizonReferences = {
      areas: toStringArray((meta as any).areasReferences),
      goals: toStringArray((meta as any).goalsReferences),
      vision: toStringArray((meta as any).visionReferences),
      purpose: toStringArray((meta as any).purposeReferences),
    };
    return normalizeHorizonReferences(parsed);
  }, [meta]);

  const initialGeneralRefs = React.useMemo(
    () => normalizeGeneralReferences(toStringArray((meta as any).references)),
    [meta]
  );

  const [title, setTitle] = React.useState<string>(initialTitle);
  const [status, setStatus] = React.useState<GTDProjectStatus>(
    normalizeProjectStatus((meta as any).projectStatus ?? (meta as any).status)
  );
  const [dueDate, setDueDate] = React.useState<string>(
    typeof (meta as any).dueDate === "string"
      ? toDateOnly((meta as any).dueDate)
      : ""
  );
  const [desiredOutcome, setDesiredOutcome] = React.useState<string>(
    parsedSections.desiredOutcome?.trim() === DEFAULT_PROJECT_OUTCOME.trim()
      ? ""
      : parsedSections.desiredOutcome
  );
  const [horizonRefs, setHorizonRefs] = React.useState<ProjectHorizonReferences>(
    initialHorizonRefs
  );
  const [references, setReferences] = React.useState<string[]>(initialGeneralRefs);
  const [includeHabitsList, setIncludeHabitsList] = React.useState<boolean>(
    parsedSections.includeHabitsList
  );
  const [additionalContent, setAdditionalContent] = React.useState<string>(
    parsedSections.additionalContent
  );

  const [activeHorizonPicker, setActiveHorizonPicker] = React.useState<HorizonKey | null>(null);
  const [horizonOptions, setHorizonOptions] = React.useState<HorizonOption[]>([]);
  const [horizonSearch, setHorizonSearch] = React.useState<string>("");
  const [horizonLoading, setHorizonLoading] = React.useState(false);

  const createdRef = React.useRef<string>(new Date().toISOString());
  const [createdDisplayValue, setCreatedDisplayValue] = React.useState<string>(
    formatDisplayDate(createdRef.current)
  );
  const createdInitialized = React.useRef<boolean>(false);

  React.useEffect(() => {
    if (!createdInitialized.current) {
      const fromMeta = (meta as any).createdDateTime;
      createdRef.current =
        typeof fromMeta === "string" && fromMeta.trim().length > 0
          ? fromMeta.trim()
          : new Date().toISOString();
      createdInitialized.current = true;
      setCreatedDisplayValue(formatDisplayDate(createdRef.current));
    } else if (
      typeof (meta as any).createdDateTime === "string" &&
      (meta as any).createdDateTime.trim().length > 0
    ) {
      createdRef.current = (meta as any).createdDateTime.trim();
      setCreatedDisplayValue(formatDisplayDate(createdRef.current));
    }
  }, [meta]);

  React.useEffect(() => {
    const nextTitle =
      typeof meta.title === "string" && meta.title.trim().length > 0
        ? meta.title.trim()
        : "Untitled Project";
    setTitle(nextTitle);
    setStatus(
      normalizeProjectStatus((meta as any).projectStatus ?? (meta as any).status)
    );
    setDueDate(
      typeof (meta as any).dueDate === "string"
        ? toDateOnly((meta as any).dueDate)
        : ""
    );
    setHorizonRefs(
      normalizeHorizonReferences({
        areas: toStringArray((meta as any).areasReferences),
        goals: toStringArray((meta as any).goalsReferences),
        vision: toStringArray((meta as any).visionReferences),
        purpose: toStringArray((meta as any).purposeReferences),
      })
    );
    setReferences(normalizeGeneralReferences(toStringArray((meta as any).references)));

    const updatedSections = parseProjectSections(content || "");
    setDesiredOutcome(
      updatedSections.desiredOutcome?.trim() === DEFAULT_PROJECT_OUTCOME.trim()
        ? ""
        : updatedSections.desiredOutcome
    );
    setIncludeHabitsList(updatedSections.includeHabitsList);
    setAdditionalContent(updatedSections.additionalContent);
  }, [meta, content]);

  const normalizedFilePath = React.useMemo(
    () => (filePath ? filePath.replace(/\\/g, "/") : ""),
    [filePath]
  );
  const projectPath = React.useMemo(() => normalizeProjectPathFromReadme(filePath), [filePath]);

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
        createdDateTime: createdRef.current,
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
          .filter((file) => !README_REGEX.test(file.path.replace(/\\/g, "/")))
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
      const normalizedTarget = normalizeReference(value);
      if (!normalizedTarget) return;

      setHorizonRefs((current) => {
        const normalizedCurrent = normalizeHorizonReferences(current);
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

        emitRebuild({ horizonReferences: next });
        if (normalizedFilePath) {
          void syncHorizonBacklink({
            sourcePath: normalizedFilePath,
            sourceKind: "projects",
            targetPath: normalizedTarget,
            action,
          });
        }

        return next;
      });
    },
    [emitRebuild, normalizedFilePath]
  );

  const handleHorizonRemove = React.useCallback(
    (key: HorizonKey, value: string) => {
      const normalizedTarget = normalizeReference(value);
      if (!normalizedTarget) return;

      setHorizonRefs((current) => {
        const normalizedCurrent = normalizeHorizonReferences(current);
        const group = normalizedCurrent[key] ?? [];
        if (!group.includes(normalizedTarget)) {
          return normalizedCurrent;
        }

        const nextGroup = group.filter((ref) => ref !== normalizedTarget);
        const next = {
          ...normalizedCurrent,
          [key]: nextGroup,
        };

        emitRebuild({ horizonReferences: next });
        if (normalizedFilePath) {
          void syncHorizonBacklink({
            sourcePath: normalizedFilePath,
            sourceKind: "projects",
            targetPath: normalizedTarget,
            action: "remove",
          });
        }

        return next;
      });
    },
    [emitRebuild, normalizedFilePath]
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
      emitRebuild({ additionalContent: sanitizeAdditionalContent(next) });
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
