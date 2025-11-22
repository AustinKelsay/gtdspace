import React from 'react';
import { Calendar, Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EnhancedTextEditor } from '@/components/editor/EnhancedTextEditor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GeneralReferencesField } from '@/components/gtd/GeneralReferencesField';
import { GTDTagSelector } from '@/components/gtd/GTDTagSelector';
import { GTDActionEffort, GTDActionStatus } from '@/types';
import { extractMetadata } from '@/utils/metadata-extractor';

/**
 * Standardized Action page layout with compact metadata header
 * and a full WYSIWYG body area below (Notion-like).
 *
 * This component parses the markdown for an Action, exposes
 * the canonical fields in a compact header, and passes only the
 * freeform body to the WYSIWYG editor. On any change, it rebuilds
 * the full markdown (title + markers + body) and emits it upward.
 */
export interface ActionPageProps {
  content: string;
  onChange: (nextContent: string) => void;
  filePath?: string;
  className?: string;
}

type HorizonRefs = {
  projects: string[];
  areas: string[];
  goals: string[];
  vision: string[];
  purpose: string[];
};

type HorizonRaw = Partial<Record<'projects' | 'areas' | 'goals' | 'vision' | 'purpose', string>>;

function isoDate(date: Date): string {
  return date.toISOString();
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function isDateOnlyString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

function toDateOnly(isoOrDate?: string | null): string {
  if (!isoOrDate) return '';
  const v = String(isoOrDate).trim();
  // Critical: If value is a plain date string, return as-is to avoid timezone shifts
  if (isDateOnlyString(v)) return v;
  // If it contains a time component, prefer string split first
  if (v.includes('T')) {
    // If timestamp includes timezone, compute local date from Date to present consistent local fields
    const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(v);
    if (hasTimezone) {
      const dTz = new Date(v);
      if (!isNaN(dTz.getTime())) {
        return `${dTz.getFullYear()}-${pad(dTz.getMonth() + 1)}-${pad(dTz.getDate())}`;
      }
    } else {
      const [date] = v.split('T');
      if (isDateOnlyString(date)) return date;
    }
  }
  // Fallback to Date parsing for miscellaneous formats (with time)
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  // Last resort: return best-effort date portion
  return v.split('T')[0] || '';
}

function toTimeOnly(isoOrDate?: string | null): string {
  if (!isoOrDate) return '';
  const v = String(isoOrDate).trim();
  if (isDateOnlyString(v)) return '';
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(v);

  if (hasTimezone) {
    // Convert from stored UTC/offset time back to local clock time
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  } else if (v.includes('T')) {
    // Treat bare ISO without timezone as already-local; read HH:MM directly
    const m = v.match(/T(\d{2}:\d{2})/);
    if (m) return m[1];
  }

  // Fallback
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return '';
}

// Extract body-only markdown by removing only the header TITLE and the top-of-file
// header sections (Status, Focus Date, Due Date, Effort, Contexts, References, Horizon References, Created).
// Custom block markers elsewhere in the document must be preserved.
function stripActionHeader(content: string): string {
  const lines = content.split(/\r?\n/);
  let i = 0;

  // Remove leading BOM/empty lines
  while (i < lines.length && lines[i].trim() === '') i++;

  // Skip H1 title if present
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    i++;
    // Drop any immediate blank lines after title
    while (i < lines.length && lines[i].trim() === '') i++;
  }

  // Helper to recognize header headings
  const isHeaderHeading = (s: string) => /^(##)\s+(Status|Focus\s+Date|Due\s+Date|Effort|Contexts|References|Horizon\s+References.*|Created)\s*$/i.test(s.trim());

  // Helper to recognize header markers that immediately follow a heading
  const isHeaderMarker = (s: string) => {
    const t = s.trim();
    return (
      /^\[!singleselect:status:[^\]]*\]$/i.test(t) ||
      /^\[!datetime:focus_date:[^\]]*\]$/i.test(t) ||
      /^\[!datetime:due_date:[^\]]*\]$/i.test(t) ||
      /^\[!singleselect:effort:[^\]]*\]$/i.test(t) ||
      /^\[!multiselect:contexts:[^\]]*\]$/i.test(t) ||
      /^\[!references:[^\]]*\]$/i.test(t) ||
      /^\[!projects-references:[^\]]*\]$/i.test(t) ||
      /^\[!areas-references:[^\]]*\]$/i.test(t) ||
      /^\[!goals-references:[^\]]*\]$/i.test(t) ||
      /^\[!vision-references:[^\]]*\]$/i.test(t) ||
      /^\[!purpose-references:[^\]]*\]$/i.test(t) ||
      /^\[!datetime:created_date_time:[^\]]*\]$/i.test(t)
    );
  };

  // Consume a contiguous top-of-file block of known header sections only
  while (i < lines.length && isHeaderHeading(lines[i])) {
    i++; // skip the heading line
    // Skip following header markers and blank lines
    while (i < lines.length && (lines[i].trim() === '' || isHeaderMarker(lines[i]))) {
      i++;
    }
    // Skip one optional blank line between sections
    while (i < lines.length && lines[i].trim() === '') i++;
  }

  // Return the remainder as the body; keep original markers intact
  let bodyLines = lines.slice(i);

  // Remove trailing canonical metadata sections if present at the end of the document.
  const removeTrailingSection = (
    headingRe: RegExp,
    markerPredicate: (s: string) => boolean
  ) => {
    let idx = -1;
    for (let k = bodyLines.length - 1; k >= 0; k--) {
      if (headingRe.test(bodyLines[k].trim())) { idx = k; break; }
    }
    if (idx === -1) return; // section not found

    // Verify this heading is the canonical metadata section by checking for marker lines after it
    let j = idx + 1;
    const sectionStart = idx;
    const markers: number[] = [];
    while (j < bodyLines.length && bodyLines[j].trim() === '') j++;
    while (j < bodyLines.length && markerPredicate(bodyLines[j])) {
      markers.push(j);
      j++;
      while (j < bodyLines.length && bodyLines[j].trim() === '') j++;
    }
    if (markers.length === 0) return;

    // Remove heading + marker lines but keep any content after them
    const keepPrefix = bodyLines.slice(0, sectionStart);
    const keepSuffix = bodyLines.slice(markers[markers.length - 1] + 1);
    bodyLines = keepPrefix.concat(keepSuffix);
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();
  };

  // Remove Created section
  removeTrailingSection(/^##\s+Created\s*$/i, (s) => /^\[!datetime:created_date_time:[^\]]*\]$/i.test(s.trim()));
  // Remove Horizon References section
  removeTrailingSection(/^##\s+Horizon\s+References.*$/i, (s) => (
    /^\[!projects-references:[^\]]*\]$/i.test(s.trim()) ||
    /^\[!areas-references:[^\]]*\]$/i.test(s.trim()) ||
    /^\[!goals-references:[^\]]*\]$/i.test(s.trim()) ||
    /^\[!vision-references:[^\]]*\]$/i.test(s.trim()) ||
    /^\[!purpose-references:[^\]]*\]$/i.test(s.trim())
  ));
  // Remove References section
  removeTrailingSection(/^##\s+References\s*$/i, (s) => /^\[!references:[^\]]*\]$/i.test(s.trim()));

  const remainder = bodyLines.join('\n');
  // Collapse excessive leading blank lines
  return remainder.replace(/^\s*\n/, '').replace(/\n{3,}/g, '\n\n');
}

function buildActionMarkdown(
  {
    title,
    status,
    effort,
    focusDate,
    dueDate,
    contexts,
    references,
    horizonRefs,
    createdDateTime,
    horizonRaw,
  }: {
    title: string;
    status: GTDActionStatus;
    effort: GTDActionEffort;
    focusDate?: string;
    dueDate?: string;
    contexts: string[];
    references: string[];
    horizonRefs: HorizonRefs;
    createdDateTime: string;
    horizonRaw?: HorizonRaw;
  },
  body: string
): string {
  const parts: string[] = [];

  const safeTitle = title?.trim() || 'Untitled';
  parts.push(`# ${safeTitle}`);

  parts.push('\n## Status\n');
  parts.push(`[!singleselect:status:${status}]\n`);

  parts.push('\n## Focus Date\n');
  parts.push(`[!datetime:focus_date:${focusDate ?? ''}]\n`);

  parts.push('\n## Due Date\n');
  parts.push(`[!datetime:due_date:${dueDate ?? ''}]\n`);

  parts.push('\n## Effort\n');
  parts.push(`[!singleselect:effort:${effort}]\n`);

  parts.push('\n## Contexts\n');
  parts.push(`[!multiselect:contexts:${(contexts || []).join(',')}]\n`);

  // Body content
  // Preserve leading whitespace of the first body line; only trim excessive trailing newlines
  const bodyClean = (body || '').replace(/\s+$/s, '');
  if (bodyClean.length > 0) {
    parts.push('\n');
    parts.push(bodyClean);
    parts.push('\n');
  }

  // Notes are part of the body; do not emit an extra Notes section here

  // References
  parts.push('\n## References\n');
  // Store as simple CSV to avoid any JSON escaping issues in parsers
  parts.push(`[!references:${(references || []).join(',')}]\n`);

  // Horizon references
  parts.push('\n## Horizon References (optional)\n');
  const fallbackEncode = (arr?: string[]) => encodeURIComponent((arr || []).map(s => s.replace(/\\/g, '/')).join(','));
  parts.push(`[!projects-references:${horizonRaw?.projects ?? fallbackEncode(horizonRefs.projects)}]\n`);
  parts.push(`[!areas-references:${horizonRaw?.areas ?? fallbackEncode(horizonRefs.areas)}]\n`);
  parts.push(`[!goals-references:${horizonRaw?.goals ?? fallbackEncode(horizonRefs.goals)}]\n`);
  parts.push(`[!vision-references:${horizonRaw?.vision ?? fallbackEncode(horizonRefs.vision)}]\n`);
  parts.push(`[!purpose-references:${horizonRaw?.purpose ?? fallbackEncode(horizonRefs.purpose)}]\n`);

  // Created
  parts.push('\n## Created\n');
  parts.push(`[!datetime:created_date_time:${createdDateTime}]\n`);

  return parts.join('').trim() + '\n';
}

export const ActionPage: React.FC<ActionPageProps> = ({ content, onChange, filePath, className }) => {
  // Parse current metadata
  const meta = React.useMemo(() => extractMetadata(content || ''), [content]);

  // Local state reflecting header fields
  const [title, setTitle] = React.useState<string>(
    (typeof meta.title === 'string' && meta.title) || 'Untitled'
  );
  const [status, setStatus] = React.useState<GTDActionStatus>(
    (meta.status as GTDActionStatus) || 'in-progress'
  );
  const [effort, setEffort] = React.useState<GTDActionEffort>(
    (meta.effort as GTDActionEffort) || 'medium'
  );
  const [focusDate, setFocusDate] = React.useState<string>(toDateOnly(meta.focusDate as string | undefined));
  const [focusTime, setFocusTime] = React.useState<string>(toTimeOnly(meta.focusDate as string | undefined));
  const [dueDate, setDueDate] = React.useState<string>(toDateOnly(meta.dueDate as string | undefined));
  const [contexts, setContexts] = React.useState<string[]>(Array.isArray((meta as any).contexts) ? ((meta as any).contexts as string[]) : []);
  const [references, setReferences] = React.useState<string[]>(Array.isArray((meta as any).references) ? ((meta as any).references as string[]) : []);
  const [ctxPickerOpen, setCtxPickerOpen] = React.useState(false);
  const [focusEdited, setFocusEdited] = React.useState(false);

  const horizonRefs: HorizonRefs = React.useMemo(() => ({
    projects: Array.isArray((meta as any).projectsReferences) ? ((meta as any).projectsReferences as string[]) : [],
    areas: Array.isArray((meta as any).areasReferences) ? ((meta as any).areasReferences as string[]) : [],
    goals: Array.isArray((meta as any).goalsReferences) ? ((meta as any).goalsReferences as string[]) : [],
    vision: Array.isArray((meta as any).visionReferences) ? ((meta as any).visionReferences as string[]) : [],
    purpose: Array.isArray((meta as any).purposeReferences) ? ((meta as any).purposeReferences as string[]) : [],
  }), [meta]);

  // Stable created timestamp: take from file if present, otherwise set once
  const createdRef = React.useRef<string>(isoDate(new Date()));
  const originalFocusRef = React.useRef<string | undefined>(undefined);
  const createdSetRef = React.useRef(false);
  React.useEffect(() => {
    if (!createdSetRef.current) {
      const fromMeta = (meta as any).createdDateTime;
      createdRef.current = typeof fromMeta === 'string' && fromMeta ? fromMeta : isoDate(new Date());
      createdSetRef.current = true;
    }
  }, [meta]);

  // Body-only markdown for the WYSIWYG
  const bodyOnly = React.useMemo(() => stripActionHeader(content || ''), [content]);
  const bodyRef = React.useRef<string>(bodyOnly);
  const horizonRawRef = React.useRef<HorizonRaw>({});
  React.useEffect(() => {
    // Sync local body cache when external content changes
    bodyRef.current = bodyOnly;
  }, [bodyOnly]);

  // Track original raw (encoded) horizon references payloads for exact round-trip
  React.useEffect(() => {
    const capture = (marker: 'projects' | 'areas' | 'goals' | 'vision' | 'purpose') => {
      const re = new RegExp(`\\[!${marker}-references:([^\\]]*)\\]`, 'i');
      const m = content.match(re);
      return m ? m[1] : undefined;
    };
    horizonRawRef.current = {
      projects: capture('projects'),
      areas: capture('areas'),
      goals: capture('goals'),
      vision: capture('vision'),
      purpose: capture('purpose'),
    };
  }, [content]);

  // Keep header state in sync when content prop changes externally (file reload etc.)
  React.useEffect(() => {
    setTitle((typeof meta.title === 'string' && meta.title) || 'Untitled');
    setStatus((meta.status as GTDActionStatus) || 'in-progress');
    setEffort((meta.effort as GTDActionEffort) || 'medium');
    setFocusDate(toDateOnly(meta.focusDate as string | undefined));
    setFocusTime(toTimeOnly(meta.focusDate as string | undefined));
    setDueDate(toDateOnly(meta.dueDate as string | undefined));
    setContexts(Array.isArray((meta as any).contexts) ? ((meta as any).contexts as string[]) : []);
    setReferences(Array.isArray((meta as any).references) ? ((meta as any).references as string[]) : []);
    originalFocusRef.current = typeof (meta as any).focusDate === 'string' ? (meta as any).focusDate : undefined;
    setFocusEdited(false);
    // horizonRefs are memoized from meta
  }, [meta]);

  // Rebuild helper that allows overriding current header/body
  const emitRebuild = React.useCallback(
    (
      overrides?: Partial<{
        title: string;
        status: GTDActionStatus;
        effort: GTDActionEffort;
        focusDate: string;
        focusTime: string;
        dueDate: string;
        contexts: string[];
        references: string[];
        body: string;
      }>
    ) => {
      const nextTitle = overrides?.title ?? title;
      const nextStatus = overrides?.status ?? status;
      const nextEffort = overrides?.effort ?? effort;
      const nextFocusDate = overrides?.focusDate ?? focusDate;
      const nextFocusTime = overrides?.focusTime ?? focusTime;
      const nextDueDate = overrides?.dueDate ?? dueDate;
      const nextContexts = overrides?.contexts ?? contexts;
      const nextReferences = overrides?.references ?? references;
      const nextBody = overrides?.body ?? bodyRef.current;

      // Determine whether focus fields were edited in this call
      const focusEditedThisCall = overrides?.focusDate !== undefined || overrides?.focusTime !== undefined;
      const useOriginalFocus = !focusEdited && !focusEditedThisCall;

      // Preserve original ISO exactly unless the user edited focus fields.
      let focusFieldValue: string | undefined;
      if (useOriginalFocus) {
        focusFieldValue = originalFocusRef.current || undefined;
      } else if (nextFocusDate) {
        if (nextFocusTime && nextFocusTime.trim()) {
          const local = new Date(`${nextFocusDate}T${nextFocusTime}:00`); // local time
          focusFieldValue = isNaN(local.getTime()) ? `${nextFocusDate}T${nextFocusTime}:00` : local.toISOString();
        } else {
          focusFieldValue = nextFocusDate; // date-only
        }
      }

      const built = buildActionMarkdown(
        {
          title: nextTitle,
          status: nextStatus,
          effort: nextEffort,
          focusDate: focusFieldValue,
          dueDate: nextDueDate || undefined,
          contexts: nextContexts,
          references: nextReferences,
          horizonRefs,
          createdDateTime: createdRef.current,
          horizonRaw: horizonRawRef.current,
        },
        nextBody
      );

      if (built !== content) {
        onChange(built);
      }
    },
    [title, status, effort, focusDate, focusTime, dueDate, contexts, references, horizonRefs, content, onChange, focusEdited]
  );

  // Handlers that update state then rebuild
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTitle(v);
    emitRebuild({ title: v });
  };

  return (
    <div className={`${className} w-full`}>
      <div className="px-12 py-6">
        {/* Title - H1 sized, seamless */}
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          className="w-full bg-background text-foreground text-5xl font-bold leading-tight tracking-[-0.01em] border-0 outline-none placeholder:text-muted-foreground mb-6"
          placeholder="Untitled"
        />

        {/* Compact header grid */}
        <div className="pt-5 pb-6 space-y-3">
          {/* Status & Effort */}
          <div className="grid grid-cols-[120px_1fr_120px_1fr] gap-x-6 gap-y-3 items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Select value={status} onValueChange={(v) => { const nv = v as GTDActionStatus; setStatus(nv); emitRebuild({ status: nv }); }}>
              <SelectTrigger className="h-8 text-sm" aria-label="Status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground">Effort</span>
            <Select value={effort} onValueChange={(v) => { const nv = v as GTDActionEffort; setEffort(nv); emitRebuild({ effort: nv }); }}>
              <SelectTrigger className="h-8 text-sm" aria-label="Effort">
                <SelectValue placeholder="Select effort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small (&lt;30 min)</SelectItem>
                <SelectItem value="medium">Medium (30–90 min)</SelectItem>
                <SelectItem value="large">Large (&gt;90 min)</SelectItem>
                <SelectItem value="extra-large">Extra Large (&gt;3 hours)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Focus & Due */}
          <div className="grid grid-cols-[120px_1fr_120px_1fr] gap-x-6 gap-y-3 items-center">
            <span className="text-sm text-muted-foreground">Focus Date</span>
            <div className="flex items-center gap-2">
              <div className="relative w-[14rem]">
                <Input
                  type="date"
                  value={focusDate}
                  onChange={(e) => { setFocusDate(e.target.value); setFocusEdited(true); emitRebuild({ focusDate: e.target.value }); }}
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              <Input
                type="time"
                value={focusTime}
                onChange={(e) => { setFocusTime(e.target.value); setFocusEdited(true); emitRebuild({ focusTime: e.target.value }); }}
                className="w-[9rem]"
              />
            </div>

            <span className="text-sm text-muted-foreground">Due Date</span>
            <div className="relative w-[14rem]">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); emitRebuild({ dueDate: e.target.value }); }}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Contexts */}
          <div className="grid grid-cols-[120px_1fr] gap-x-6 items-center">
            <span className="text-sm text-muted-foreground">Contexts</span>
            <div className="flex items-center gap-2 flex-wrap">
              {contexts.map((ctx) => (
                <Badge key={ctx} variant="secondary" className="capitalize px-2 py-0.5 text-xs flex items-center gap-1.5 h-6">
                  {ctx}
                  <button onClick={() => { const next = contexts.filter(c => c !== ctx); setContexts(next); emitRebuild({ contexts: next }); }} className="hover:text-muted-foreground transition-colors" aria-label={`Remove ${ctx}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Popover open={ctxPickerOpen} onOpenChange={setCtxPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="h-6 w-6 rounded-md border border-border flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label="Add context"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="start">
                  <div className="text-xs text-muted-foreground mb-2">Add contexts</div>
                  <GTDTagSelector
                    type="contexts"
                    value={contexts}
                    onValueChange={(vals) => { setContexts(vals); emitRebuild({ contexts: vals }); }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <GeneralReferencesField
            value={references}
            onChange={(next) => { setReferences(next); emitRebuild({ references: next }); }}
            filePath={filePath}
          />

          {/* Created timestamp (read-only) */}
          <div className="grid grid-cols-[120px_1fr] gap-x-6 items-center">
            <span className="text-sm text-muted-foreground">Created</span>
            <div className="inline-flex items-center gap-2 px-2 py-1 border border-border rounded-md w-fit text-xs">
              <Calendar className="h-3.5 w-3.5" />
              <span>{new Date(createdRef.current).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Separator line between header and body */}
      <div className="border-t border-border w-full" />

      {/* Body WYSIWYG - seamless, full-width container */}
      <div className="px-12 pt-6 align-with-header">
        <EnhancedTextEditor
          content={bodyOnly}
          onChange={(nextBody) => { bodyRef.current = nextBody; emitRebuild({ body: nextBody }); }}
          readOnly={false}
          autoFocus={true}
          className="flex-1"
          filePath={filePath}
          frame="bare"
          showStatusBar={false}
        />
      </div>
    </div>
  );
};

export default ActionPage;
