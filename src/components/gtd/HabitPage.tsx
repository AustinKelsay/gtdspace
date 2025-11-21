import React from 'react';
import {
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit2,
  RefreshCw,
  Save,
  Search,
  Square,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  buildHabitMarkdown,
  DEFAULT_HABIT_HISTORY_BODY,
  type HabitReferenceGroups,
} from '@/utils/gtd-markdown-helpers';
import { calculateNextReset } from '@/hooks/useHabitsHistory';
import { safeInvoke } from '@/utils/safe-invoke';
import { checkTauriContextAsync } from '@/utils/tauri-ready';
import { formatDisplayDate } from '@/utils/format-display-date';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useHabitTracking } from '@/hooks/useHabitTracking';
import type { GTDHabitFrequency, GTDHabitStatus, MarkdownFile } from '@/types';

const HABIT_FREQUENCY_OPTIONS: Array<{ value: GTDHabitFrequency; label: string }> = [
  { value: '5-minute', label: 'Every 5 Minutes (Testing)' },
  { value: 'daily', label: 'Daily' },
  { value: 'every-other-day', label: 'Every Other Day' },
  { value: 'twice-weekly', label: 'Twice Weekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
];

type ReferenceKey = keyof HabitReferenceGroups;

type HabitReferenceOption = {
  path: string;
  name: string;
  horizon: ReferenceKey;
};

const HORIZON_DIRS: Record<ReferenceKey, string> = {
  projects: 'Projects',
  areas: 'Areas of Focus',
  goals: 'Goals',
  vision: 'Vision',
  purpose: 'Purpose & Principles',
};

const README_REGEX = /(?:^|\/)README(?:\.(md|markdown))?$/i;

interface HabitHistoryRow {
  date: string;
  time: string;
  status: string;
  action: string;
  details: string;
  /**
   * Any additional columns that follow the standard
   * Date/Time/Status/Action/Details cells. These are preserved
   * when rewriting the history table but not edited by the UI.
   */
  extraCells?: string[];
}

interface ParsedHabitContent {
  title: string;
  status: GTDHabitStatus;
  frequency: GTDHabitFrequency;
  focusDateTime: string;
  references: HabitReferenceGroups;
  createdDateTime: string;
  notes: string;
  history: string;
  historyIntro: string[];
  historyHeader: string[];
  historyRows: HabitHistoryRow[];
  historyOutro: string;
}

export interface HabitPageProps {
  content: string;
  onChange: (nextContent: string) => void;
  filePath?: string;
  className?: string;
}

const METADATA_SECTION_PATTERNS: RegExp[] = [
  /^##\s+Status\s*$/i,
  /^##\s+Frequency\s*$/i,
  /^##\s+Projects\s+References\s*$/i,
  /^##\s+Areas\s+References\s*$/i,
  /^##\s+Goals\s+References\s*$/i,
  /^##\s+Vision\s+References\s*$/i,
  /^##\s+Purpose\s*&\s+Principles\s+References\s*$/i,
  /^##\s+Horizon\s+References.*$/i,
  /^##\s+Created\s*$/i,
];

const referenceLabels: Record<ReferenceKey, string> = {
  projects: 'Projects References',
  areas: 'Areas References',
  goals: 'Goals References',
  vision: 'Vision References',
  purpose: 'Purpose & Principles References',
};

function normalizeForCanonicalComparison(value: string): string {
  return value.replace(/\r\n/g, '\n').trimEnd();
}

function ensureStringArray(value: unknown): string[] {
  const results = new Set<string>();

  const tryParseJson = (input: string): boolean => {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => normalizeAndAdd(item));
        return true;
      }
      if (typeof parsed === 'string') {
        normalizeAndAdd(parsed);
        return true;
      }
    } catch {
      // not JSON
    }
    return false;
  };

  const normalizeAndAdd = (candidate: unknown) => {
    if (candidate === null || candidate === undefined) return;
    const raw = String(candidate).trim();
    if (!raw) return;

    if (tryParseJson(raw)) return;

    const withoutQuotes = raw.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
    const decoded = (() => {
      try {
        return decodeURIComponent(withoutQuotes);
      } catch {
        return withoutQuotes;
      }
    })();

    if (tryParseJson(decoded)) return;

    const normalized = decoded.replace(/\\/g, '/').trim();
    if (!normalized) return;
    results.add(normalized);
  };

  const attemptJsonArray = (input: string) => {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        parsed.forEach(normalizeAndAdd);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  };

  if (Array.isArray(value)) {
    value.forEach(normalizeAndAdd);
    return Array.from(results);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    const candidates: string[] = [trimmed];
    try {
      const decoded = decodeURIComponent(trimmed);
      if (decoded && decoded !== trimmed) {
        candidates.unshift(decoded);
      }
    } catch {
      // not encoded, ignore
    }

    for (const candidate of candidates) {
      if (attemptJsonArray(candidate)) {
        return Array.from(results);
      }
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const inner = trimmed.slice(1, -1);
      for (const candidate of [inner, `[${inner}]`]) {
        if (attemptJsonArray(candidate)) {
          return Array.from(results);
        }
      }
      inner.split(',').forEach(normalizeAndAdd);
      return Array.from(results);
    }

    if (trimmed.includes(',')) {
      trimmed.split(',').forEach(normalizeAndAdd);
      return Array.from(results);
    }

    normalizeAndAdd(trimmed);
    return Array.from(results);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    normalizeAndAdd(value);
  }

  return Array.from(results);
}

function stripReadmeReferences(values: string[]): string[] {
  return values.filter((ref) => !README_REGEX.test(ref.replace(/\\/g, '/')));
}

function parseHabitStatus(content: string): GTDHabitStatus {
  const checkboxMatch = content.match(/\[!checkbox:habit-status:(true|false)\]/i);
  if (checkboxMatch) {
    return checkboxMatch[1].toLowerCase() === 'true' ? 'completed' : 'todo';
  }

  const singleselectMatch = content.match(/\[!singleselect:habit-status:([^\]]+)\]/i);
  if (singleselectMatch) {
    const value = singleselectMatch[1].trim().toLowerCase();
    if (value === 'completed') return 'completed';
  }

  return 'todo';
}

function normalizeFrequency(raw: unknown): GTDHabitFrequency {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (
    value === '5-minute' ||
    value === 'daily' ||
    value === 'every-other-day' ||
    value === 'twice-weekly' ||
    value === 'weekly' ||
    value === 'weekdays' ||
    value === 'biweekly' ||
    value === 'monthly'
  ) {
    return value;
  }
  return 'daily';
}

function normalizeReferenceGroups(meta: ReturnType<typeof extractMetadata>): HabitReferenceGroups {
  return {
    projects: ensureStringArray((meta as any).projectsReferences),
    areas: ensureStringArray((meta as any).areasReferences),
    goals: ensureStringArray((meta as any).goalsReferences),
    vision: ensureStringArray((meta as any).visionReferences),
    purpose: ensureStringArray((meta as any).purposeReferences),
  };
}

function findSectionEnd(lines: string[], headingPattern: RegExp, limit: number): number {
  const index = lines.findIndex((line, idx) => idx < limit && headingPattern.test(line.trim()));
  if (index === -1) return -1;

  let cursor = index + 1;
  while (cursor < limit && lines[cursor].trim() === '') cursor++;
  while (cursor < limit && /^\[!.*\]$/i.test(lines[cursor].trim())) {
    cursor++;
    while (cursor < limit && lines[cursor].trim() === '') cursor++;
  }
  return cursor;
}

function normalizeNoteLines(lines: string[]): string {
  const buffer = [...lines];
  while (buffer.length > 0 && buffer[0].trim() === '') buffer.shift();
  while (buffer.length > 0 && buffer[buffer.length - 1].trim() === '') buffer.pop();
  if (buffer.length > 0 && /^##\s+Notes/i.test(buffer[0].trim())) {
    buffer.shift();
    while (buffer.length > 0 && buffer[0].trim() === '') buffer.shift();
  }
  return buffer.join('\n').trim();
}

function reconstructHistory(intro: string[], header: string[], rows: HabitHistoryRow[], outro: string = ''): string {
  const lines = [...intro];

  // Ensure a blank line before table if the last intro line is not blank
  if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
    lines.push('');
  }

  // Add table header - reuse original or default if missing
  if (header.length >= 2) {
    lines.push(...header);
  } else {
    lines.push('| Date | Time | Status | Action | Details |');
    lines.push('|------|------|--------|--------|---------|');
  }

  const encodeCell = (s: string) => {
    // Normalize line endings, then convert newlines to <br> so that
    // multiline content stays within a single Markdown table cell.
    const normalized = s.replace(/\r\n/g, '\n');
    const withBreaks = normalized.replace(/\n/g, '<br>');
    // Escape pipes to avoid breaking table structure
    return withBreaks.replace(/\|/g, '\\|');
  };

  for (const row of rows) {
    const baseCells = [
      encodeCell(row.date),
      encodeCell(row.time),
      encodeCell(row.status),
      encodeCell(row.action),
      encodeCell(row.details),
    ];
    const extra = row.extraCells && row.extraCells.length > 0
      ? row.extraCells.map((cell) => encodeCell(cell))
      : [];

    const allCells = [...baseCells, ...extra];
    lines.push(`| ${allCells.join(' | ')} |`);
  }

  if (outro.length > 0) {
    // Ensure a blank line between the table and any following content
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('');
    }
    lines.push(outro);
  }
  
  return lines.join('\n');
}

function splitHistory(raw: string | undefined): { history: string; intro: string[]; header: string[]; rows: HabitHistoryRow[]; outro: string } {
  const hasContent = raw && raw.trim().length > 0;
  const effective = hasContent ? (raw as string) : DEFAULT_HABIT_HISTORY_BODY;
  const lines = effective.split(/\r?\n/);

  let tableStart = lines.findIndex((line) => line.trim().startsWith('|'));
  if (tableStart === -1) {
    tableStart = lines.length;
  }

  // Capture intro as raw lines up to tableStart to preserve formatting
  const intro = lines.slice(0, tableStart);
  
  const rows: HabitHistoryRow[] = [];
  const header: string[] = [];
  let lastTableLineIndex = tableStart - 1;

  for (let i = tableStart; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // If line is empty, it might be a separator within the table block or end of table
    // For robustness, we'll treat contiguous pipe lines as table.
    if (trimmed.startsWith('|')) {
      lastTableLineIndex = i;
      
      // Capture header lines (title row + separator row)
      if (header.length < 2) {
        header.push(line); // Preserve original spacing/alignment
        continue; 
      }
      
      // Safety check: if for some reason we grabbed a non-separator as 2nd line
      // (unlikely if table is valid, but ensures we don't eat data rows)
      if (header.length === 2 && !/^\|\s*-/.test(header[1].trim())) {
         // The previous line wasn't a separator? 
         // Standard markdown tables require separator.
         // We'll assume the parser logic above is sound for standard tables.
      }

      // Robust splitting: Handle escaped pipes (\|) in content and convert
      // <br> tags back into newlines for UI display.
      const ESCAPED_PIPE_PH = "%%ESCAPED_PIPE%%";
      const rawCells = trimmed
        .replace(/\\\|/g, ESCAPED_PIPE_PH)
        .split('|')
        .map((cell) => {
          const restoredPipes = cell.trim().replace(new RegExp(ESCAPED_PIPE_PH, 'g'), '|');
          // Treat common <br> variants as actual newlines in the UI model
          return restoredPipes.replace(/<br\s*\/?>/gi, '\n');
        });

      if (rawCells.length < 7) continue;
      
      // Additional check to avoid reparsing header if loop logic fails
      if (rawCells[1].toLowerCase() === 'date' && rawCells[2].toLowerCase() === 'time') continue;
      if (rawCells[1].startsWith('---')) continue;

      const cells = rawCells.slice(1, rawCells.length - 1);

      rows.push({
        date: cells[0] ?? '',
        time: cells[1] ?? '',
        status: cells[2] ?? '',
        action: cells[3] ?? '',
        details: cells[4] ?? '',
        extraCells: cells.length > 5 ? cells.slice(5) : [],
      });
    } else if (trimmed === '') {
      // Allow empty lines inside table block (e.g. spacers)
      // We track the last valid table line index, so if this is truly the end of the table,
      // the loop will eventually finish or hit a non-table line that breaks.
      continue;
    } else {
      // Non-empty line that doesn't start with pipe -> End of table block
      break;
    }
  }

  // Capture everything after the table block as outro
  const outroLines = lines.slice(lastTableLineIndex + 1);
  const outro = outroLines.join('\n');

  return { history: effective, intro, header, rows, outro };
}

// Expose internals for unit tests to guard against regressions
// eslint-disable-next-line react-refresh/only-export-components
export const __habitHistoryInternals = {
  splitHistory,
  reconstructHistory,
};

function toDateFromHistory(row: { date?: string; time?: string }): Date | null {
  if (!row.date) return null;
  const time = row.time?.trim() || '00:00';
  const match12 = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let normalized = time;
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minutes = match12[2];
    const isPm = match12[3].toUpperCase() === 'PM';
    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    normalized = `${hour.toString().padStart(2, '0')}:${minutes}`;
  } else {
    const match24 = time.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      normalized = `${match24[1].padStart(2, '0')}:${match24[2]}`;
    } else {
      normalized = '00:00';
    }
  }

  const isoCandidate = `${row.date}T${normalized}`;
  const parsed = new Date(isoCandidate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(`${row.date} ${row.time ?? '00:00'}`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatHabitDisplayDate(date: Date | null): string {
  return formatDisplayDate(date, {
    includeTime: true,
    timeSeparator: ' • ',
    timeStyle: 'short',
  });
}

function formatLastCompletion(rows: HabitHistoryRow[]): string {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (/complete/i.test(row.status)) {
      return formatHabitDisplayDate(toDateFromHistory(row));
    }
  }
  return '—';
}

function determineLastResetDate(rows: HabitHistoryRow[], createdIso: string): Date | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const action = rows[i].action.toLowerCase();
    if (action.includes('reset') || action.includes('backfill')) {
      const parsed = toDateFromHistory(rows[i]);
      if (parsed) return parsed;
    }
  }

  const createdDate = new Date(createdIso);
  if (!Number.isNaN(createdDate.getTime())) {
    return createdDate;
  }

  return null;
}

function displayNameForReference(ref: string): string {
  const normalized = ref.replace(/\\/g, '/');
  const leaf = normalized.split('/').pop();
  if (!leaf) return normalized;
  return leaf.replace(/\.(md|markdown)$/i, '');
}

function extractNotes(
  lines: string[],
  historyHeadingIdx: number
): string {
  const limit = historyHeadingIdx === -1 ? lines.length : historyHeadingIdx;
  const notesHeadingIdx = lines.findIndex(
    (line, idx) => idx < limit && /^##\s+Notes/i.test(line.trim())
  );
  if (notesHeadingIdx !== -1) {
    return normalizeNoteLines(lines.slice(notesHeadingIdx + 1, limit));
  }

  let maxMetaEnd = -1;
  for (const pattern of METADATA_SECTION_PATTERNS) {
    const endIndex = findSectionEnd(lines, pattern, limit);
    if (endIndex > maxMetaEnd) {
      maxMetaEnd = endIndex;
    }
  }
  const start = maxMetaEnd > -1 ? maxMetaEnd : 0;
  return normalizeNoteLines(lines.slice(start, limit));
}

function parseHabitContent(content: string): ParsedHabitContent {
  const meta = extractMetadata(content || '');
  const lines = content.split(/\r?\n/);

  const historyHeadingIdx = lines.findIndex((line) => /^##\s+History\s*$/i.test(line.trim()));
  const historyRaw = historyHeadingIdx >= 0 ? lines.slice(historyHeadingIdx + 1).join('\n') : '';
  const { history, intro: historyIntro, rows: historyRows, outro: historyOutro, header: historyHeader } = splitHistory(historyRaw);
  const notes = extractNotes(lines, historyHeadingIdx);

  let created = typeof (meta as any).createdDateTime === 'string'
    ? ((meta as any).createdDateTime as string).trim()
    : '';
  if (!created) {
    const createdMatch = content.match(/\[!datetime:created_date_time:([^\]]+)\]/i);
    created = createdMatch ? createdMatch[1] : '';
  }
  if (!created) {
    created = new Date().toISOString();
  }

  const references = normalizeReferenceGroups(meta);
  const sanitizedReferences: HabitReferenceGroups = {
    projects: stripReadmeReferences(references.projects),
    areas: stripReadmeReferences(references.areas),
    goals: stripReadmeReferences(references.goals),
    vision: stripReadmeReferences(references.vision),
    purpose: stripReadmeReferences(references.purpose),
  };

  let focusDateTime = '';
  const metaFocus = (meta as any).focusDate;
  if (typeof metaFocus === 'string') {
    focusDateTime = metaFocus.trim();
  } else if (Array.isArray(metaFocus) && metaFocus.length > 0) {
    focusDateTime = String(metaFocus[0]).trim();
  }
  if (!focusDateTime) {
    const focusMatch = content.match(/\[!datetime:focus_date:([^\]]+)\]/i);
    if (focusMatch && focusMatch[1]) {
      focusDateTime = focusMatch[1].trim();
    }
  }

  return {
    title: (typeof meta.title === 'string' && meta.title.trim()) || 'Untitled',
    status: parseHabitStatus(content),
    frequency: normalizeFrequency((meta as any)['habit-frequency']),
    focusDateTime,
    references: sanitizedReferences,
    createdDateTime: created,
    notes,
    history,
    historyIntro,
    historyHeader,
    historyRows,
    historyOutro,
  };
}

export const HabitPage: React.FC<HabitPageProps> = ({
  content,
  onChange,
  filePath,
  className,
}) => {
  const parsed = React.useMemo(() => parseHabitContent(content || ''), [content]);

  const [title, setTitle] = React.useState(parsed.title);
  const [status, setStatus] = React.useState<GTDHabitStatus>(parsed.status);
  const [frequency, setFrequency] = React.useState<GTDHabitFrequency>(parsed.frequency);
  const [references, setReferences] = React.useState<HabitReferenceGroups>({
    projects: stripReadmeReferences([...parsed.references.projects]),
    areas: stripReadmeReferences([...parsed.references.areas]),
    goals: stripReadmeReferences([...parsed.references.goals]),
    vision: stripReadmeReferences([...parsed.references.vision]),
    purpose: stripReadmeReferences([...parsed.references.purpose]),
  });
  const [notes, setNotes] = React.useState(parsed.notes);
  const [historyRows, setHistoryRows] = React.useState(parsed.historyRows);
  const [historyIntro, setHistoryIntro] = React.useState(parsed.historyIntro);
  const [historyHeader, setHistoryHeader] = React.useState(parsed.historyHeader);
  const [historyOutro, setHistoryOutro] = React.useState(parsed.historyOutro);
  const [created, setCreated] = React.useState(parsed.createdDateTime);
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  const [activePicker, setActivePicker] = React.useState<ReferenceKey | null>(null);
  const [pickerOptions, setPickerOptions] = React.useState<HabitReferenceOption[]>([]);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [pickerSearch, setPickerSearch] = React.useState('');

  const [editingRowIndex, setEditingRowIndex] = React.useState<number | null>(null);
  const [editingRowData, setEditingRowData] = React.useState<HabitHistoryRow | null>(null);

  const notesRef = React.useRef(notes);
  const historyRef = React.useRef(parsed.history);
  const createdRef = React.useRef(parsed.createdDateTime);
  const focusRef = React.useRef(parsed.focusDateTime);
  const { withErrorHandling, reportError } = useErrorHandler();
  const { updateHabitStatus } = useHabitTracking();

  React.useEffect(() => {
    setTitle(parsed.title);
    setStatus(parsed.status);
    setFrequency(parsed.frequency);
    setReferences({
      projects: stripReadmeReferences([...parsed.references.projects]),
      areas: stripReadmeReferences([...parsed.references.areas]),
      goals: stripReadmeReferences([...parsed.references.goals]),
      vision: stripReadmeReferences([...parsed.references.vision]),
      purpose: stripReadmeReferences([...parsed.references.purpose]),
    });
    setNotes(parsed.notes);
    setHistoryRows(parsed.historyRows);
    setHistoryIntro(parsed.historyIntro);
    setHistoryHeader(parsed.historyHeader);
    setHistoryOutro(parsed.historyOutro);
    setCreated(parsed.createdDateTime);
    notesRef.current = parsed.notes;
    historyRef.current = parsed.history;
    createdRef.current = parsed.createdDateTime;
    focusRef.current = parsed.focusDateTime;
  }, [parsed]);

  React.useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  React.useEffect(() => {
    const canonical = buildHabitMarkdown({
      title: parsed.title,
      status: parsed.status,
      frequency: parsed.frequency,
      focusDateTime: parsed.focusDateTime,
      references: parsed.references,
      createdDateTime: parsed.createdDateTime,
      notes: parsed.notes,
      history: parsed.history,
    });
    const canonicalNormalized = normalizeForCanonicalComparison(canonical);
    const contentNormalized = normalizeForCanonicalComparison(content);
    if (canonicalNormalized !== contentNormalized) {
      onChange(canonical);
    }
  }, [parsed, content, onChange]);

  const loadReferenceOptions = React.useCallback(
    async (key: ReferenceKey): Promise<HabitReferenceOption[]> => {
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

        const subDir = HORIZON_DIRS[key];
        const dirPath = `${spacePath}/${subDir}`;
        const files = await safeInvoke<MarkdownFile[]>(
          'list_markdown_files',
          { path: dirPath },
          []
        );
        if (!files) return [];
        return files
          .filter((file) => !README_REGEX.test(file.name))
          .map((file) => ({
            path: file.path.replace(/\\/g, '/'),
            name: file.name.replace(/\.(md|markdown)$/i, ''),
            horizon: key,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      }, 'Failed to load references', `habit-${key}-references`);

      return result ?? [];
    },
    [withErrorHandling]
  );

  React.useEffect(() => {
    if (!activePicker) return;
    let cancelled = false;
    setPickerLoading(true);
    setPickerSearch('');

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
      const pathMatch = option.path?.toLowerCase()?.includes(query) ?? false;
      return nameMatch || pathMatch;
    });
  }, [pickerOptions, pickerSearch]);

  const emitRebuild = React.useCallback(
    (overrides?: Partial<{
      title: string;
      status: GTDHabitStatus;
      frequency: GTDHabitFrequency;
      references: HabitReferenceGroups;
      notes: string;
      history: string;
    }>) => {
      const nextTitle = overrides?.title ?? title;
      const nextStatus = overrides?.status ?? status;
      const nextFrequency = overrides?.frequency ?? frequency;
      const nextReferences = overrides?.references ?? references;
      const nextNotes = overrides?.notes ?? notesRef.current;
      const nextHistory = overrides?.history ?? historyRef.current;

      const built = buildHabitMarkdown({
        title: nextTitle,
        status: nextStatus,
        frequency: nextFrequency,
        focusDateTime: focusRef.current,
        references: nextReferences,
        createdDateTime: createdRef.current,
        notes: nextNotes,
        history: nextHistory,
      });

      if (built !== content) {
        onChange(built);
      }
    },
    [title, status, frequency, references, content, onChange]
  );

  const createdDisplay = React.useMemo(() => {
    const parsedDate = new Date(created);
    if (!Number.isNaN(parsedDate.getTime())) {
      return formatHabitDisplayDate(parsedDate);
    }
    return created || '—';
  }, [created]);

  const lastCompletionDisplay = React.useMemo(
    () => formatLastCompletion(historyRows),
    [historyRows]
  );

  const lastResetMoment = React.useMemo(
    () => determineLastResetDate(historyRows, created),
    [historyRows, created]
  );

  const nextResetDate = React.useMemo(() => {
    try {
      const baseline = lastResetMoment ?? new Date();
      const iso = calculateNextReset(frequency, baseline);
      const candidate = new Date(iso);
      if (Number.isNaN(candidate.getTime())) return null;
      return candidate;
    } catch {
      return null;
    }
  }, [frequency, lastResetMoment]);

  const nextResetDisplay = React.useMemo(() => {
    if (!nextResetDate) return '—';
    if (nextResetDate.getTime() <= nowTick) return 'Now';
    return formatHabitDisplayDate(nextResetDate);
  }, [nextResetDate, nowTick]);

  const toggleStatus = async () => {
    const previous = status;
    const next = previous === 'completed' ? 'todo' : 'completed';
    setStatus(next);

    if (filePath) {
      const updated = await updateHabitStatus(filePath, next);
      if (updated === null) {
        setStatus(previous);
        return;
      }

      if (updated) {
        const latestContent = await safeInvoke<string>('read_file', { path: filePath }, null);
        if (latestContent) {
          const refreshed = parseHabitContent(latestContent);
          historyRef.current = refreshed.history;
          createdRef.current = refreshed.createdDateTime;
          notesRef.current = refreshed.notes;
          setHistoryRows(refreshed.historyRows);
          setHistoryIntro(refreshed.historyIntro);
          setHistoryHeader(refreshed.historyHeader);
          setHistoryOutro(refreshed.historyOutro);
          setCreated(refreshed.createdDateTime);
          setStatus(refreshed.status);
          onChange(latestContent);
          return;
        }

        reportError('Failed to refresh habit after updating status. Please reopen the habit to stay in sync.');
        setStatus(previous);
        return;
      } else {
        // No change on backend - keep optimistic UI state
        // (status already set to next)
      }
    } else {
      emitRebuild({ status: next });
    }
  };

  const updateReferencesGroup = React.useCallback(
    (key: ReferenceKey, updater: (current: string[]) => string[]) => {
      setReferences((prev) => {
        const current = prev[key] ?? [];
        const nextValues = stripReadmeReferences(updater(current));

        const unchanged =
          current.length === nextValues.length &&
          current.every((ref, idx) => ref === nextValues[idx]);
        if (unchanged) {
          return prev;
        }

        const nextRefs = { ...prev, [key]: nextValues };
        emitRebuild({ references: nextRefs });
        return nextRefs;
      });
    },
    [emitRebuild]
  );

  const handleReferenceToggle = React.useCallback(
    (key: ReferenceKey, value: string) => {
      updateReferencesGroup(key, (current) => {
        if (current.includes(value)) {
          return current.filter((ref) => ref !== value);
        }
        return [...current, value];
      });
    },
    [updateReferencesGroup]
  );

  const handleRemoveReference = React.useCallback(
    (key: ReferenceKey, value: string) => {
      updateReferencesGroup(key, (current) => current.filter((ref) => ref !== value));
    },
    [updateReferencesGroup]
  );

  const handleNotesChange = (nextBody: string) => {
    setNotes(nextBody);
    notesRef.current = nextBody;
    emitRebuild({ notes: nextBody });
  };

  const handleEditRow = (index: number) => {
    setEditingRowIndex(index);
    setEditingRowData({ ...historyRows[index] });
  };

  const handleCancelEdit = () => {
    setEditingRowIndex(null);
    setEditingRowData(null);
  };

  const handleSaveRow = () => {
    if (editingRowIndex === null || !editingRowData) return;

    const newRows = [...historyRows];
    newRows[editingRowIndex] = editingRowData;
    setHistoryRows(newRows);

    const newHistory = reconstructHistory(historyIntro, historyHeader, newRows, historyOutro);
    historyRef.current = newHistory;
    emitRebuild({ history: newHistory });

    setEditingRowIndex(null);
    setEditingRowData(null);
  };

  const handleToggleRowStatus = (index: number) => {
    const newRows = [...historyRows];
    const row = { ...newRows[index] };
    
    if (row.status.toLowerCase() === 'complete' || row.status.toLowerCase() === 'completed') {
       row.status = 'To Do';
    } else {
       row.status = 'Complete';
    }
    
    newRows[index] = row;
    setHistoryRows(newRows);
    
    const newHistory = reconstructHistory(historyIntro, historyHeader, newRows, historyOutro);
    historyRef.current = newHistory;
    emitRebuild({ history: newHistory });
  };

  return (
    <div className={`flex flex-col min-h-0 h-full overflow-y-auto bg-background text-foreground ${className ?? ''}`}>
      <div className="px-12 pt-10 pb-6 space-y-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-[240px]">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                const next = e.target.value;
                setTitle(next);
                emitRebuild({ title: next });
              }}
              className="w-full bg-background text-foreground text-5xl font-bold leading-tight tracking-[-0.01em] border-0 outline-none placeholder:text-muted-foreground"
              placeholder="Untitled Habit"
            />
          </div>
          <Button
            type="button"
            variant={status === 'completed' ? 'default' : 'outline'}
            size="icon"
            onClick={toggleStatus}
            aria-pressed={status === 'completed'}
            aria-label={status === 'completed' ? 'Mark habit as to do' : 'Mark habit as completed'}
            className="h-11 w-11 rounded-lg mt-1"
          >
            {status === 'completed' ? (
              <CheckSquare className="h-5 w-5" />
            ) : (
              <Square className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
          <div className="grid grid-cols-[140px_1fr] gap-x-4 items-center">
            <span className="text-sm text-muted-foreground">Frequency</span>
            <Select
              value={frequency}
              onValueChange={(value) => {
                const next = value as GTDHabitFrequency;
                setFrequency(next);
                emitRebuild({ frequency: next });
              }}
            >
              <SelectTrigger className="h-9 text-sm" aria-label="Habit frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {HABIT_FREQUENCY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-x-4 items-center">
            <span className="text-sm text-muted-foreground">Next Reset</span>
            <div className="inline-flex items-center gap-2 px-2 py-1 border border-border rounded-md text-xs">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{nextResetDisplay}</span>
            </div>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-x-4 items-center">
            <span className="text-sm text-muted-foreground">Last Completion</span>
            <div className="inline-flex items-center gap-2 px-2 py-1 border border-border rounded-md text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{lastCompletionDisplay}</span>
            </div>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-x-4 items-center">
            <span className="text-sm text-muted-foreground">Created</span>
            <div className="inline-flex items-center gap-2 px-2 py-1 border border-border rounded-md text-xs">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{createdDisplay}</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-6 pt-2">
          {(Object.keys(referenceLabels) as ReferenceKey[]).map((key) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{referenceLabels[key]}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {references[key].length} linked
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
                {references[key].length > 0 ? (
                  references[key].map((ref) => (
                    <Badge
                      key={ref}
                      variant="secondary"
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <span className="max-w-[200px] truncate">{displayNameForReference(ref)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveReference(key, ref)}
                        className="inline-flex"
                        aria-label={`Remove ${ref}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    No references
                  </span>
                )}
              </div>
            </div>
          ))}
          {/* Spacer to balance grid if odd number of reference groups */}
          <div className="hidden md:block" aria-hidden="true" />
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
          {activePicker && (
            <>
              <DialogHeader>
                <DialogTitle>Manage {referenceLabels[activePicker]}</DialogTitle>
                <DialogDescription>
                  Select items to link to this habit. Existing selections stay highlighted.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 mb-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search references..."
                  className="flex-1"
                />
              </div>

              <ScrollArea className="h-[380px] border border-border rounded-md">
                {pickerLoading ? (
                  <div className="py-12 text-center text-muted-foreground">Loading references...</div>
                ) : filteredPickerOptions.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No items found. Create content in the {HORIZON_DIRS[activePicker]} folder to link it here.
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {filteredPickerOptions.map((option) => {
                      const isSelected = references[activePicker].includes(option.path);
                      return (
                        <button
                          key={option.path}
                          type="button"
                          onClick={() => handleReferenceToggle(activePicker, option.path)}
                          className={`w-full text-left px-4 py-3 rounded-md transition-colors ${isSelected ? 'bg-muted text-muted-foreground' : 'hover:bg-accent'
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
          )}
        </DialogContent>
      </Dialog>

      <div className="border-t border-border w-full" />

      <div className="px-12 pt-6 pb-10 space-y-10 align-with-header">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Notes</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Autosaves as you type</span>
            </div>
          </div>
          <EnhancedTextEditor
            content={notes}
            onChange={handleNotesChange}
            readOnly={false}
            autoFocus={false}
            className="flex-1"
            filePath={filePath}
            frame="bare"
            showStatusBar={false}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            History
            <span className="text-xs text-muted-foreground font-normal">
              Automatic log of resets and manual updates
            </span>
          </h2>
          {historyIntro.length > 0 && (
            <div className="text-sm text-muted-foreground space-y-1">
              {historyIntro.map((line, idx) => (
                <p key={`${line}-${idx}`}>{line}</p>
              ))}
            </div>
          )}
          {historyRows.length > 0 ? (
            <div className="border border-border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead className="w-[120px]">Time</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[140px]">Action</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRows.map((row, idx) => {
                    const isEditing = editingRowIndex === idx;
                    return (
                      <TableRow key={`${row.date}-${row.time}-${idx}`}>
                        <TableCell>
                          {isEditing && editingRowData ? (
                            <Input
                              value={editingRowData.date}
                              onChange={(e) => setEditingRowData({ ...editingRowData, date: e.target.value })}
                              className="h-8"
                            />
                          ) : (
                            row.date
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing && editingRowData ? (
                            <Input
                              value={editingRowData.time}
                              onChange={(e) => setEditingRowData({ ...editingRowData, time: e.target.value })}
                              className="h-8"
                            />
                          ) : (
                            row.time
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing && editingRowData ? (
                            <Select
                              value={editingRowData.status}
                              onValueChange={(value) => setEditingRowData({ ...editingRowData, status: value })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Complete">Complete</SelectItem>
                                <SelectItem value="To Do">To Do</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            row.status
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing && editingRowData ? (
                            <Input
                              value={editingRowData.action}
                              onChange={(e) => setEditingRowData({ ...editingRowData, action: e.target.value })}
                              className="h-8"
                            />
                          ) : (
                            row.action
                          )}
                        </TableCell>
                        <TableCell className={isEditing ? '' : 'whitespace-pre-wrap'}>
                          {isEditing && editingRowData ? (
                            <Textarea
                              value={editingRowData.details}
                              onChange={(e) => setEditingRowData({ ...editingRowData, details: e.target.value })}
                              className="min-h-[64px] text-sm"
                            />
                          ) : (
                            row.details
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={handleSaveRow}
                                  title="Save"
                                >
                                  <Save className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={handleCancelEdit}
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleToggleRowStatus(idx)}
                                  title="Swap Status"
                                >
                                  <ArrowLeftRight className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditRow(idx)}
                                  title="Edit Row"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md px-4 py-6">
              History entries will appear here once the habit is updated.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HabitPage;
