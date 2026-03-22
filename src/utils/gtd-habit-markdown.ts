import type { GTDHabitFrequency, GTDHabitStatus } from '@/types';
import { extractMetadata } from '@/utils/metadata-extractor';
import {
  buildHabitMarkdown,
  DEFAULT_HABIT_HISTORY_BODY,
  type HabitReferenceGroups,
} from '@/utils/gtd-markdown-helpers';
import {
  parseReferenceList,
  stripReadmeReferences,
} from '@/utils/gtd-reference-utils';

export interface HabitHistoryRow {
  date: string;
  time: string;
  status: string;
  action: string;
  details: string;
  extraCells?: string[];
}

export interface ParsedHabitContent {
  title: string;
  status: GTDHabitStatus;
  frequency: GTDHabitFrequency;
  focusDateTime: string;
  references: HabitReferenceGroups;
  generalReferences: string[];
  createdDateTime: string;
  notes: string;
  history: string;
  historyIntro: string[];
  historyHeader: string[];
  historyRows: HabitHistoryRow[];
  historyOutro: string;
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
  /^##\s+References\s*$/i,
  /^##\s+Created\s*$/i,
];

const HABIT_FREQUENCIES: GTDHabitFrequency[] = [
  '5-minute',
  'daily',
  'every-other-day',
  'twice-weekly',
  'weekly',
  'weekdays',
  'biweekly',
  'monthly',
];

export function normalizeForCanonicalComparison(value: string): string {
  return value.replace(/\r\n/g, '\n').trimEnd();
}

export function parseHabitStatus(content: string): GTDHabitStatus {
  const checkboxMatch = content.match(/\[!checkbox:habit-status:(true|false)\]/i);
  if (checkboxMatch) {
    return checkboxMatch[1].toLowerCase() === 'true' ? 'completed' : 'todo';
  }

  const singleselectMatch = content.match(/\[!singleselect:habit-status:([^\]]+)\]/i);
  if (singleselectMatch) {
    const normalized = singleselectMatch[1]?.trim().toLowerCase();
    if (normalized === 'completed' || normalized === 'complete' || normalized === 'done') {
      return 'completed';
    }
  }

  return 'todo';
}

export function normalizeHabitFrequency(raw: unknown): GTDHabitFrequency {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return HABIT_FREQUENCIES.includes(value as GTDHabitFrequency)
    ? (value as GTDHabitFrequency)
    : 'daily';
}

function normalizeReferenceGroups(
  meta: ReturnType<typeof extractMetadata>
): HabitReferenceGroups {
  return {
    projects: stripReadmeReferences(
      parseReferenceList((meta as { projectsReferences?: unknown }).projectsReferences)
    ),
    areas: stripReadmeReferences(
      parseReferenceList((meta as { areasReferences?: unknown }).areasReferences)
    ),
    goals: stripReadmeReferences(
      parseReferenceList((meta as { goalsReferences?: unknown }).goalsReferences)
    ),
    vision: stripReadmeReferences(
      parseReferenceList((meta as { visionReferences?: unknown }).visionReferences)
    ),
    purpose: stripReadmeReferences(
      parseReferenceList((meta as { purposeReferences?: unknown }).purposeReferences)
    ),
  };
}

function findSectionEnd(lines: string[], headingPattern: RegExp, limit: number): number {
  const index = lines.findIndex((line, idx) => idx < limit && headingPattern.test(line.trim()));
  if (index === -1) {
    return -1;
  }

  let cursor = index + 1;
  while (cursor < limit && lines[cursor].trim() === '') {
    cursor += 1;
  }
  while (cursor < limit && /^\[!.*\]$/i.test(lines[cursor].trim())) {
    cursor += 1;
    while (cursor < limit && lines[cursor].trim() === '') {
      cursor += 1;
    }
  }

  return cursor;
}

function normalizeNoteLines(lines: string[]): string {
  const buffer = [...lines];
  while (buffer.length > 0 && buffer[0].trim() === '') {
    buffer.shift();
  }
  while (buffer.length > 0 && buffer[buffer.length - 1].trim() === '') {
    buffer.pop();
  }
  if (buffer.length > 0 && /^##\s+Notes/i.test(buffer[0].trim())) {
    buffer.shift();
    while (buffer.length > 0 && buffer[0].trim() === '') {
      buffer.shift();
    }
  }

  return buffer.join('\n').trim();
}

function extractNotes(lines: string[], historyHeadingIdx: number): string {
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

  return normalizeNoteLines(lines.slice(maxMetaEnd > -1 ? maxMetaEnd : 0, limit));
}

export function normalizeHabitHistoryStatus(raw: string): string {
  const value = raw.trim().toLowerCase();
  return value === 'complete' || value === 'completed' ? 'Complete' : 'To Do';
}

export function reconstructHabitHistory(
  intro: string[],
  header: string[],
  rows: HabitHistoryRow[],
  outro = ''
): string {
  const lines = [...intro];

  if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
    lines.push('');
  }

  if (header.length >= 2) {
    lines.push(...header);
  } else {
    lines.push('| Date | Time | Status | Action | Details |');
    lines.push('|------|------|--------|--------|---------|');
  }

  const encodeCell = (value: string) =>
    value.replace(/\r\n/g, '\n').replace(/\n/g, '<br>').replace(/\|/g, '\\|');

  for (const row of rows) {
    const baseCells = [
      encodeCell(row.date),
      encodeCell(row.time),
      encodeCell(row.status),
      encodeCell(row.action),
      encodeCell(row.details),
    ];
    const extraCells = (row.extraCells ?? []).map((cell) => encodeCell(cell));
    lines.push(`| ${[...baseCells, ...extraCells].join(' | ')} |`);
  }

  if (outro.length > 0) {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
      lines.push('');
    }
    lines.push(outro);
  }

  return lines.join('\n');
}

export function splitHabitHistory(raw?: string): {
  history: string;
  intro: string[];
  header: string[];
  rows: HabitHistoryRow[];
  outro: string;
} {
  const effective = raw && raw.trim().length > 0 ? raw : DEFAULT_HABIT_HISTORY_BODY;
  const lines = effective.split(/\r?\n/);

  let tableStart = lines.findIndex((line) => line.trim().startsWith('|'));
  if (tableStart === -1) {
    tableStart = lines.length;
  }

  const intro = lines.slice(0, tableStart);
  const header: string[] = [];
  const rows: HabitHistoryRow[] = [];
  let lastTableLineIndex = tableStart - 1;

  for (let i = tableStart; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('|')) {
      lastTableLineIndex = i;

      if (header.length < 2) {
        header.push(line);
        continue;
      }

      const escapedPipePlaceholder = '\uE000';
      const rawCells = trimmed
        .replace(/\\\|/g, escapedPipePlaceholder)
        .split('|')
        .map((cell) =>
          cell
            .trim()
            .replace(new RegExp(escapedPipePlaceholder, 'g'), '|')
            .replace(/<br\s*\/?>/gi, '\n')
        );

      if (rawCells.length < 7) {
        continue;
      }
      if (rawCells[1].toLowerCase() === 'date' && rawCells[2].toLowerCase() === 'time') {
        continue;
      }
      if (rawCells[1].startsWith('---')) {
        continue;
      }

      const cells = rawCells.slice(1, rawCells.length - 1);
      rows.push({
        date: cells[0] ?? '',
        time: cells[1] ?? '',
        status: normalizeHabitHistoryStatus(cells[2] ?? ''),
        action: cells[3] ?? '',
        details: cells[4] ?? '',
        extraCells: cells.length > 5 ? cells.slice(5) : [],
      });
    } else if (trimmed !== '') {
      break;
    }
  }

  return {
    history: effective,
    intro,
    header,
    rows,
    outro: lines.slice(lastTableLineIndex + 1).join('\n'),
  };
}

export function habitHistoryRowToDate(row: { date?: string; time?: string }): Date | null {
  if (!row.date) {
    return null;
  }

  const time = row.time?.trim() || '00:00';
  const match12Hour = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let normalizedTime = time;

  if (match12Hour) {
    let hour = Number.parseInt(match12Hour[1], 10);
    const minutes = match12Hour[2];
    const isPm = match12Hour[3].toUpperCase() === 'PM';
    if (isPm && hour < 12) {
      hour += 12;
    }
    if (!isPm && hour === 12) {
      hour = 0;
    }
    normalizedTime = `${hour.toString().padStart(2, '0')}:${minutes}`;
  } else {
    const match24Hour = time.match(/^(\d{1,2}):(\d{2})$/);
    if (match24Hour) {
      normalizedTime = `${match24Hour[1].padStart(2, '0')}:${match24Hour[2]}`;
    } else {
      normalizedTime = '00:00';
    }
  }

  const parsed = new Date(`${row.date}T${normalizedTime}`);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date(`${row.date} ${row.time ?? '00:00'}`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function isHabitResetAction(action?: string): boolean {
  const normalized = action?.trim().toLowerCase() ?? '';
  return normalized.includes('reset') || normalized.includes('backfill');
}

export function determineLastHabitResetDate(
  rows: HabitHistoryRow[],
  createdIso: string
): Date | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (!isHabitResetAction(rows[i].action)) {
      continue;
    }
    const parsed = habitHistoryRowToDate(rows[i]);
    if (parsed) {
      return parsed;
    }
  }

  const createdDate = new Date(createdIso);
  return Number.isNaN(createdDate.getTime()) ? null : createdDate;
}

export function findLastHabitCompletionDate(rows: HabitHistoryRow[]): Date | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (!/complete/i.test(rows[i].status)) {
      continue;
    }

    const parsed = habitHistoryRowToDate(rows[i]);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function nextFiveMinuteBoundary(after: Date): Date {
  const next = new Date(after);
  next.setSeconds(0, 0);

  const remainder = next.getMinutes() % 5;
  const minutesToAdd = remainder === 0 ? 5 : 5 - remainder;
  next.setMinutes(next.getMinutes() + minutesToAdd);

  if (next <= after) {
    next.setMinutes(next.getMinutes() + 5);
  }

  return next;
}

function nextScheduledDay(after: Date, allowedDays: number[]): Date {
  const base = startOfDay(after);
  for (let offset = 0; offset <= 14; offset += 1) {
    const candidate = addDays(base, offset);
    if (candidate <= after) {
      continue;
    }
    if (allowedDays.includes(candidate.getDay())) {
      return candidate;
    }
  }

  return addDays(base, 1);
}

function startOfWeekMonday(date: Date): Date {
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(date, delta));
}

export function calculateNextHabitReset(
  frequency: GTDHabitFrequency,
  baseline = new Date()
): Date {
  // Keep this logic in sync with the backend helper:
  // `next_reset_after` in `src-tauri/src/commands/gtd_habits_domain.rs`.
  // Shared semantics:
  // - twice-weekly uses Tuesday/Friday windows
  // - weekly/biweekly anchor to Monday-based weeks
  // - weekdays excludes weekends
  // - monthly resets on the first day of the next month
  switch (frequency) {
    case '5-minute':
      return nextFiveMinuteBoundary(baseline);
    case 'daily':
      return addDays(startOfDay(baseline), 1);
    case 'every-other-day':
      return addDays(startOfDay(baseline), 2);
    case 'twice-weekly':
      return nextScheduledDay(baseline, [2, 5]);
    case 'weekly':
      return addDays(startOfWeekMonday(baseline), 7);
    case 'weekdays':
      return nextScheduledDay(baseline, [1, 2, 3, 4, 5]);
    case 'biweekly': {
      const next = addDays(startOfWeekMonday(baseline), 14);
      return next > baseline ? next : addDays(next, 14);
    }
    case 'monthly': {
      const next = new Date(
        baseline.getFullYear(),
        baseline.getMonth() + 1,
        1,
        0,
        0,
        0,
        0
      );
      return next;
    }
    default:
      return addDays(startOfDay(baseline), 1);
  }
}

export function parseHabitContent(content: string): ParsedHabitContent {
  const meta = extractMetadata(content || '');
  const lines = content.split(/\r?\n/);

  const historyHeadingIdx = lines.findIndex((line) => /^##\s+History\s*$/i.test(line.trim()));
  const historyRaw = historyHeadingIdx >= 0 ? lines.slice(historyHeadingIdx + 1).join('\n') : '';
  const splitHistory = splitHabitHistory(historyRaw);

  let created =
    typeof (meta as { createdDateTime?: unknown }).createdDateTime === 'string'
      ? (meta as { createdDateTime: string }).createdDateTime.trim()
      : '';
  if (!created) {
    const createdMatch = content.match(/\[!datetime:created_date_time:([^\]]+)\]/i);
    created = createdMatch?.[1] ?? '';
  }
  if (!created) {
    created = new Date().toISOString();
  }

  let focusDateTime = '';
  const metaFocus = (meta as { focusDate?: unknown }).focusDate;
  if (typeof metaFocus === 'string') {
    focusDateTime = metaFocus.trim();
  } else if (Array.isArray(metaFocus) && metaFocus.length > 0) {
    focusDateTime = String(metaFocus[0]).trim();
  }
  if (!focusDateTime) {
    const focusMatch = content.match(/\[!datetime:focus_date:([^\]]+)\]/i);
    if (focusMatch?.[1]) {
      focusDateTime = focusMatch[1].trim();
    }
  }

  return {
    title:
      (typeof meta.title === 'string' && meta.title.trim()) || 'Untitled',
    status: parseHabitStatus(content),
    frequency: normalizeHabitFrequency(
      (meta as { habitFrequency?: unknown; 'habit-frequency'?: unknown }).habitFrequency ??
        (meta as { 'habit-frequency'?: unknown })['habit-frequency']
    ),
    focusDateTime,
    references: normalizeReferenceGroups(meta),
    generalReferences: stripReadmeReferences(
      parseReferenceList((meta as { references?: unknown }).references)
    ),
    createdDateTime: created,
    notes: extractNotes(lines, historyHeadingIdx),
    history: splitHistory.history,
    historyIntro: splitHistory.intro,
    historyHeader: splitHistory.header,
    historyRows: splitHistory.rows,
    historyOutro: splitHistory.outro,
  };
}

export function canonicalizeHabitMarkdown(content: string): string {
  const parsed = parseHabitContent(content || '');
  return buildHabitMarkdown({
    title: parsed.title,
    status: parsed.status,
    frequency: parsed.frequency,
    focusDateTime: parsed.focusDateTime,
    references: parsed.references,
    generalReferences: parsed.generalReferences,
    createdDateTime: parsed.createdDateTime,
    notes: parsed.notes,
    history: parsed.history,
  });
}
