import React from "react";
import { Search, X } from "lucide-react";
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
import { EnhancedTextEditor } from "@/components/editor/EnhancedTextEditor";
import { extractMetadata } from "@/utils/metadata-extractor";
import {
  buildAreaMarkdown,
  DEFAULT_AREA_DESCRIPTION,
  type AreaReferenceGroups,
} from "@/utils/gtd-markdown-helpers";
import { syncHorizonBacklink } from "@/utils/horizon-backlinks";
import { checkTauriContextAsync } from "@/utils/tauri-ready";
import { safeInvoke } from "@/utils/safe-invoke";
import { formatDisplayDate } from "@/utils/format-display-date";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import type {
  GTDAreaReviewCadence,
  GTDAreaStatus,
  MarkdownFile,
} from "@/types";

export interface AreaPageProps {
  content: string;
  onChange: (nextContent: string) => void;
  filePath?: string;
  className?: string;
}

type AreaReferenceKey = "projects" | "goals" | "vision" | "purpose";

const HORIZON_DIRS: Record<AreaReferenceKey, string> = {
  projects: "Projects",
  goals: "Goals",
  vision: "Vision",
  purpose: "Purpose & Principles",
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
  references: AreaReferenceGroups;
  description: string;
}>;

interface AreaSections {
  description: string;
}

const AREA_STATUS_OPTIONS: Array<{ value: GTDAreaStatus; label: string }> = [
  { value: "steady", label: "Steady" },
  { value: "watch", label: "Watch" },
  { value: "incubating", label: "Incubating" },
  { value: "delegated", label: "Delegated" },
];

const AREA_REVIEW_CADENCE_OPTIONS: Array<{
  value: GTDAreaReviewCadence;
  label: string;
}> = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const REFERENCE_LABELS: Record<AreaReferenceKey, string> = {
  projects: "Projects References",
  goals: "Goals References",
  vision: "Vision References",
  purpose: "Purpose & Principles References",
};

const CANONICAL_METADATA_HEADINGS: RegExp[] = [
  /^##\s+Status\b/i,
  /^##\s+Review\s+Cadence\b/i,
  /^##\s+Projects\s+References\b/i,
  /^##\s+Goals\s+References\b/i,
  /^##\s+Vision\s+References\b/i,
  /^##\s+Purpose\s*&\s*Principles\s+References\b/i,
  /^##\s+Areas\s+References\b/i,
  /^##\s+Created\b/i,
  /^##\s+Description\b/i,
  /^##\s+Success\s+Criteria\b/i,
  /^##\s+Focus\s+Metrics\b/i,
  /^##\s+Supporting\s+Notes\b/i,
  /^##\s+Snapshots\b/i,
];

function parseAreaSections(content: string): AreaSections {
  const lines = content.split(/\r?\n/);
  let collecting = false;
  const buffer: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^##\s+(Description|Area\s+Narrative)\b.*$/i.test(line)) {
      collecting = true;
      buffer.length = 0;
      continue;
    }

    if (
      collecting &&
      CANONICAL_METADATA_HEADINGS.some((regex) => regex.test(line))
    ) {
      break;
    }

    if (collecting) {
      buffer.push(rawLine);
    }
  }

  const description = buffer.length
    ? buffer
        .join("\n")
        .replace(/^\s*\n+/, "")
        .trimEnd()
    : "";

  return { description };
}

function normalizeAreaStatus(raw: unknown): GTDAreaStatus {
  switch (typeof raw === "string" ? raw.trim().toLowerCase() : "") {
    case "steady":
    case "watch":
    case "incubating":
    case "delegated":
      return (
        typeof raw === "string" ? raw.trim().toLowerCase() : "steady"
      ) as GTDAreaStatus;
    default:
      return "steady";
  }
}

function normalizeReviewCadence(raw: unknown): GTDAreaReviewCadence {
  switch (typeof raw === "string" ? raw.trim().toLowerCase() : "") {
    case "weekly":
    case "monthly":
    case "quarterly":
    case "annually":
      return (
        typeof raw === "string" ? raw.trim().toLowerCase() : "monthly"
      ) as GTDAreaReviewCadence;
    default:
      return "monthly";
  }
}

function displayNameForReference(ref: string): string {
  const normalized = ref.replace(/\\/g, "/");
  const leaf = normalized.split("/").pop();
  if (!leaf) return normalized;
  return leaf.replace(/\.(md|markdown)$/i, "");
}

const normalizeReferencePath = (raw: string): string =>
  raw.replace(/\\/g, "/").trim();

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" ? normalizeReferencePath(item) : ""
      )
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.replace(/\\/g, "/").trim();
    if (!trimmed) return [];
    return trimmed
      .split(",")
      .map((entry) => normalizeReferencePath(entry))
      .filter(Boolean);
  }
  return [];
}

const AreaPage: React.FC<AreaPageProps> = ({
  content,
  onChange,
  filePath,
  className,
}) => {
  const meta = React.useMemo(() => extractMetadata(content || ""), [content]);
  const parsedSections = React.useMemo(
    () => parseAreaSections(content || ""),
    [content]
  );

  const initialTitle =
    typeof meta.title === "string" && meta.title.trim().length > 0
      ? meta.title.trim()
      : "Untitled Area";

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
  const [status, setStatus] = React.useState<GTDAreaStatus>(
    normalizeAreaStatus((meta as any).areaStatus)
  );
  const [reviewCadence, setReviewCadence] =
    React.useState<GTDAreaReviewCadence>(
      normalizeReviewCadence((meta as any).areaReviewCadence)
    );
  const [references, setReferences] =
    React.useState<AreaReferenceGroups>(initialReferences);
  const [activePicker, setActivePicker] =
    React.useState<AreaReferenceKey | null>(null);
  const [pickerOptions, setPickerOptions] = React.useState<
    AreaReferenceOption[]
  >([]);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [pickerSearch, setPickerSearch] = React.useState("");
  const { withErrorHandling } = useErrorHandler();

  const normalizeSection = React.useCallback((value: string) => {
    const trimmed = value?.trim() ?? "";
    if (trimmed === DEFAULT_AREA_DESCRIPTION.trim()) {
      return "";
    }
    return trimmed;
  }, []);

  const [description, setDescription] = React.useState<string>(
    normalizeSection(parsedSections.description)
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
        : "Untitled Area";
    setTitle(nextTitle);
    setStatus(normalizeAreaStatus((meta as any).areaStatus));
    setReviewCadence(normalizeReviewCadence((meta as any).areaReviewCadence));
    setReferences({
      projects: toStringArray((meta as any).projectsReferences),
      areas: toStringArray((meta as any).areasReferences),
      goals: toStringArray((meta as any).goalsReferences),
      vision: toStringArray((meta as any).visionReferences),
      purpose: toStringArray((meta as any).purposeReferences),
    });
    const updatedSections = parseAreaSections(content || "");
    setDescription(normalizeSection(updatedSections.description));
  }, [meta, content, normalizeSection]);

  const loadReferenceOptions = React.useCallback(
    async (key: AreaReferenceKey): Promise<AreaReferenceOption[]> => {
      const spacePath =
        window.localStorage.getItem("gtdspace-current-path") || "";
      if (!spacePath) return [];

      const inTauri = await checkTauriContextAsync();
      if (!inTauri) return [];

      const result = await withErrorHandling(
        async () => {
          if (key === "projects") {
            const projects = await safeInvoke<
              Array<{ name: string; path: string }>
            >("list_gtd_projects", { spacePath }, []);
            if (!projects) return [];
            return projects
              .map((project) => ({
                path: (
                  project.path ||
                  `${spacePath}/${HORIZON_DIRS.projects}/${project.name}`
                ).replace(/\\/g, "/"),
                name: project.name,
                horizon: key,
              }))
              .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
              );
          }

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
            .sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
            );
        },
        "Failed to load references",
        `area-${key}-references`
      );

      return result ?? [];
    },
    [withErrorHandling]
  );

  React.useEffect(() => {
    if (!activePicker) return;
    let cancelled = false;
    setPickerLoading(true);
    setPickerSearch("");
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

  const normalizedFilePath = React.useMemo(
    () => (filePath ? filePath.replace(/\\/g, "/") : ""),
    [filePath]
  );

  const emitRebuild = React.useCallback(
    (overrides?: EmitOverrides) => {
      const nextTitle = overrides?.title ?? title;
      const nextStatus = overrides?.status ?? status;
      const nextCadence = overrides?.reviewCadence ?? reviewCadence;
      const nextReferences = overrides?.references ?? references;
      const nextDescription = overrides?.description ?? description;

      const built = buildAreaMarkdown({
        title: nextTitle,
        status: nextStatus,
        reviewCadence: nextCadence,
        references: nextReferences,
        createdDateTime: createdRef.current,
        description: nextDescription,
      });

      if (built !== content) {
        onChange(built);
      }
    },
    [title, status, reviewCadence, references, description, content, onChange]
  );

  const handleReferenceToggle = React.useCallback(
    (key: AreaReferenceKey, value: string) => {
      const normalizedTarget = normalizeReferencePath(value);
      if (!normalizedTarget) return;
      setReferences((current) => {
        const existingGroup = current[key] ?? [];
        const normalizedGroup = existingGroup.map(normalizeReferencePath);
        const isPresent = normalizedGroup.includes(normalizedTarget);
        const nextGroup = isPresent
          ? normalizedGroup.filter((ref) => ref !== normalizedTarget)
          : [...normalizedGroup, normalizedTarget];
        const next = { ...current, [key]: nextGroup };
        emitRebuild({ references: next });
        if (normalizedFilePath && normalizedTarget) {
          void syncHorizonBacklink({
            sourcePath: normalizedFilePath,
            sourceKind: "areas",
            targetPath: normalizedTarget,
            action: isPresent ? "remove" : "add",
          });
        }
        return next;
      });
    },
    [emitRebuild, normalizedFilePath]
  );

  const handleReferenceRemove = React.useCallback(
    (key: AreaReferenceKey, value: string) => {
      const normalizedTarget = normalizeReferencePath(value);
      if (!normalizedTarget) return;
      setReferences((current) => {
        const existingGroup = current[key] ?? [];
        const normalizedGroup = existingGroup.map(normalizeReferencePath);
        const nextGroup = normalizedGroup.filter(
          (item) => item !== normalizedTarget
        );
        const next = { ...current, [key]: nextGroup };
        emitRebuild({ references: next });
        if (normalizedFilePath && normalizedTarget) {
          void syncHorizonBacklink({
            sourcePath: normalizedFilePath,
            sourceKind: "areas",
            targetPath: normalizedTarget,
            action: "remove",
          });
        }
        return next;
      });
    },
    [emitRebuild, normalizedFilePath]
  );

  return (
    <div
      className={`flex flex-col min-h-0 h-full overflow-y-auto bg-background text-foreground ${
        className ?? ""
      }`}
    >
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
            <span className="text-sm text-muted-foreground">
              Review Cadence
            </span>
            <Select
              value={reviewCadence}
              onValueChange={(value) => {
                const next = value as GTDAreaReviewCadence;
                setReviewCadence(next);
                emitRebuild({ reviewCadence: next });
              }}
            >
              <SelectTrigger
                className="h-9 text-sm"
                aria-label="Area review cadence"
              >
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
            <div className="text-sm text-muted-foreground">
              {createdDisplayValue}
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
                    <span className="text-xs text-muted-foreground">
                      No references yet.
                    </span>
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
                    <DialogTitle>
                      Manage {REFERENCE_LABELS[activePicker]}
                    </DialogTitle>
                    <DialogDescription>
                      Select items to link with this area. Existing selections
                      stay highlighted.
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
                      <div className="py-12 text-center text-muted-foreground">
                        Loading references...
                      </div>
                    ) : filteredPickerOptions.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        No items found. Add files to the{" "}
                        {HORIZON_DIRS[activePicker]} folder to link them here.
                      </div>
                    ) : (
                      <div className="p-4 space-y-2">
                        {filteredPickerOptions.map((option) => {
                          const isSelected = activeRefs.includes(option.path);
                          return (
                            <button
                              key={option.path}
                              type="button"
                              onClick={() =>
                                handleReferenceToggle(activePicker, option.path)
                              }
                              className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                                isSelected
                                  ? "bg-muted text-muted-foreground"
                                  : "hover:bg-accent"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  {option.name}
                                </span>
                                {isSelected && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
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

      <div className="px-12 pb-16 pt-10 space-y-8 flex-1 overflow-y-auto">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Description</h2>
          </div>
          <EnhancedTextEditor
            content={description || DEFAULT_AREA_DESCRIPTION}
            onChange={(next) => {
              const clean =
                next.trim() === DEFAULT_AREA_DESCRIPTION.trim() ? "" : next;
              setDescription(clean);
              emitRebuild({ description: clean });
            }}
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

export default AreaPage;
