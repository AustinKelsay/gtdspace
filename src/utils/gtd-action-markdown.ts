import type { GTDActionEffort, GTDActionStatus } from '@/types';
import { encodeReferenceCsv } from '@/utils/gtd-markdown-helpers';
import { extractMetadata } from '@/utils/metadata-extractor';
import {
  normalizeActionStatus,
} from '@/utils/gtd-status';
import {
  normalizeReferenceList,
  parseReferenceList,
} from '@/utils/gtd-reference-utils';

export type ActionHorizonReferences = {
  projects: string[];
  areas: string[];
  goals: string[];
  vision: string[];
  purpose: string[];
};

export type ActionHorizonRaw = Partial<
  Record<'projects' | 'areas' | 'goals' | 'vision' | 'purpose', string>
>;

export interface ParsedActionMarkdown {
  title: string;
  status: GTDActionStatus;
  effort: GTDActionEffort;
  focusDate: string;
  focusTime: string;
  focusDateTime?: string;
  dueDate: string;
  contexts: string[];
  references: string[];
  horizonReferences: ActionHorizonReferences;
  horizonRaw: ActionHorizonRaw;
  createdDateTime?: string;
  body: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function actionDateToDateOnly(value?: string | null): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (isDateOnlyString(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes('T')) {
    const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(trimmed);
    if (hasTimezone) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
      }
    } else {
      const [date] = trimmed.split('T');
      if (isDateOnlyString(date)) {
        return date;
      }
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed.split('T')[0] || '';
  }

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export function actionDateToTimeOnly(value?: string | null): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed || isDateOnlyString(trimmed)) {
    return '';
  }

  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(trimmed);
  if (hasTimezone) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
    }
  } else if (trimmed.includes('T')) {
    const match = trimmed.match(/T(\d{2}:\d{2})/);
    if (match?.[1]) {
      return match[1];
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export function normalizeActionEffort(raw?: string | null): GTDActionEffort {
  const normalized = raw?.trim().toLowerCase();
  switch (normalized) {
    case 'small':
    case 'medium':
    case 'large':
    case 'extra-large':
      return normalized;
    default:
      return 'medium';
  }
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseLegacyLabeledSection(content: string, heading: string): string | undefined {
  const escapedHeading = escapeHeadingText(heading);
  const pattern = new RegExp(
    `^##\\s+${escapedHeading}\\s*$\\n+([\\s\\S]*?)(?=\\n##\\s+|\\n<div\\s+data-singleselect=|\\n---\\s*$|$)`,
    'im'
  );
  const match = content.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  const value = match[1].trim();
  if (!value || value.toLowerCase() === 'not set') {
    return undefined;
  }

  return value;
}

function parseLegacyCreatedFooter(content: string): string | undefined {
  const match = content.match(
    /(?:^|\n)---\s*\n(?:\s*\n)*Created:\s*([^\n]+)(?:\n|$)/i
  );
  const value = match?.[1]?.trim();
  return value ? value : undefined;
}

export function stripActionHeader(content: string): string {
  const lines = content.split(/\r?\n/);
  let cursor = 0;

  while (cursor < lines.length && lines[cursor].trim() === '') {
    cursor += 1;
  }

  if (cursor < lines.length && /^#\s+/.test(lines[cursor])) {
    cursor += 1;
    while (cursor < lines.length && lines[cursor].trim() === '') {
      cursor += 1;
    }
  }

  const parseLegacySingleSelectType = (value: string): string | null => {
    const match = value.match(/data-singleselect='([^']+)'/i);
    if (!match?.[1]) {
      return null;
    }

    try {
      const decoded = match[1]
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      const parsed = JSON.parse(decoded) as { type?: string };
      return parsed.type ?? null;
    } catch {
      return null;
    }
  };

  const isHeaderHeading = (value: string): boolean =>
    /^(##)\s+(Status|Focus\s+Date|Due\s+Date|Effort|Contexts|References|Horizon\s+References.*|Created)\s*$/i.test(
      value.trim()
    );

  const isLegacySingleSelectBlock = (value: string): boolean => {
    if (!/<div\s+data-singleselect='[^']+'\s+class="singleselect-block">/i.test(value.trim())) {
      return false;
    }
    const type = parseLegacySingleSelectType(value);
    return type === 'status' || type === 'effort';
  };

  const isLegacyDateHeading = (value: string): boolean =>
    /^##\s+(Focus\s+Date|Due\s+Date)\s*$/i.test(value.trim());

  const isHeaderMarker = (value: string): boolean => {
    const trimmed = value.trim();
    return (
      /^\[!singleselect:status:[^\]]*\]$/i.test(trimmed) ||
      /^\[!datetime:focus_date:[^\]]*\]$/i.test(trimmed) ||
      /^\[!datetime:due_date:[^\]]*\]$/i.test(trimmed) ||
      /^\[!singleselect:effort:[^\]]*\]$/i.test(trimmed) ||
      /^\[!multiselect:contexts:[^\]]*\]$/i.test(trimmed) ||
      /^\[!references:[^\]]*\]$/i.test(trimmed) ||
      /^\[!projects-references:[^\]]*\]$/i.test(trimmed) ||
      /^\[!areas-references:[^\]]*\]$/i.test(trimmed) ||
      /^\[!goals-references:[^\]]*\]$/i.test(trimmed) ||
      /^\[!vision-references:[^\]]*\]$/i.test(trimmed) ||
      /^\[!purpose-references:[^\]]*\]$/i.test(trimmed) ||
      /^\[!datetime:created_date_time:[^\]]*\]$/i.test(trimmed)
    );
  };

  while (cursor < lines.length && (isHeaderHeading(lines[cursor]) || isLegacySingleSelectBlock(lines[cursor]) || isLegacyDateHeading(lines[cursor]))) {
    if (isLegacySingleSelectBlock(lines[cursor])) {
      cursor += 1;
      while (cursor < lines.length && lines[cursor].trim() === '') {
        cursor += 1;
      }
      continue;
    }

    if (isLegacyDateHeading(lines[cursor])) {
      cursor += 1;
      while (
        cursor < lines.length &&
        lines[cursor].trim() !== '' &&
        !/^##\s+/.test(lines[cursor].trim()) &&
        !isLegacySingleSelectBlock(lines[cursor]) &&
        lines[cursor].trim() !== '---'
      ) {
        cursor += 1;
      }
      while (cursor < lines.length && lines[cursor].trim() === '') {
        cursor += 1;
      }
      continue;
    }

    cursor += 1;
    while (cursor < lines.length && (lines[cursor].trim() === '' || isHeaderMarker(lines[cursor]))) {
      cursor += 1;
    }
    while (cursor < lines.length && lines[cursor].trim() === '') {
      cursor += 1;
    }
  }

  let bodyLines = lines.slice(cursor);

  const removeTrailingSection = (
    headingPattern: RegExp,
    markerPredicate: (line: string) => boolean
  ) => {
    let headingIndex = -1;
    for (let i = bodyLines.length - 1; i >= 0; i -= 1) {
      if (headingPattern.test(bodyLines[i].trim())) {
        headingIndex = i;
        break;
      }
    }

    if (headingIndex === -1) {
      return;
    }

    let cursorAfterHeading = headingIndex + 1;
    const markerIndexes: number[] = [];
    while (cursorAfterHeading < bodyLines.length && bodyLines[cursorAfterHeading].trim() === '') {
      cursorAfterHeading += 1;
    }
    while (cursorAfterHeading < bodyLines.length && markerPredicate(bodyLines[cursorAfterHeading])) {
      markerIndexes.push(cursorAfterHeading);
      cursorAfterHeading += 1;
      while (cursorAfterHeading < bodyLines.length && bodyLines[cursorAfterHeading].trim() === '') {
        cursorAfterHeading += 1;
      }
    }

    if (markerIndexes.length === 0) {
      return;
    }

    bodyLines = bodyLines
      .slice(0, headingIndex)
      .concat(bodyLines.slice(markerIndexes[markerIndexes.length - 1] + 1));

    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
      bodyLines.pop();
    }
  };

  removeTrailingSection(
    /^##\s+Created\s*$/i,
    (line) => /^\[!datetime:created_date_time:[^\]]*\]$/i.test(line.trim())
  );
  removeTrailingSection(
    /^##\s+Horizon\s+References.*$/i,
    (line) =>
      /^\[!(projects|areas|goals|vision|purpose)-references:[^\]]*\]$/i.test(line.trim())
  );
  removeTrailingSection(
    /^##\s+References\s*$/i,
    (line) => /^\[!references:[^\]]*\]$/i.test(line.trim())
  );

  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
    bodyLines.pop();
  }

  const createdFooterIndex = bodyLines.findIndex((line, index) => {
    if (line.trim() !== '---') {
      return false;
    }

    let cursor = index + 1;
    while (cursor < bodyLines.length && bodyLines[cursor].trim() === '') {
      cursor += 1;
    }

    return cursor < bodyLines.length && /^Created:\s*/i.test(bodyLines[cursor].trim());
  });

  if (createdFooterIndex !== -1) {
    bodyLines = bodyLines.slice(0, createdFooterIndex);
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
      bodyLines.pop();
    }
  }

  return bodyLines.join('\n').replace(/^(?:\s*\n)+|(?:\n\s*)+$/g, '');
}

function captureRawHorizonPayload(
  content: string,
  marker: 'projects' | 'areas' | 'goals' | 'vision' | 'purpose'
): string | undefined {
  const pattern = new RegExp(`\\[!${marker}-references:([^\\]]*)\\]`, 'i');
  const match = content.match(pattern);
  return match?.[1];
}

function escapeHeadingText(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeFocusDateTime(date: string, time: string): string | undefined {
  if (!date) {
    return undefined;
  }
  if (!time.trim()) {
    return date;
  }

  const local = new Date(`${date}T${time}:00`);
  if (Number.isNaN(local.getTime())) {
    return `${date}T${time}:00`;
  }

  return local.toISOString();
}

export function buildActionMarkdown(
  document: Omit<ParsedActionMarkdown, 'body'>,
  body: string
): string {
  const parts: string[] = [];

  parts.push(`# ${document.title.trim() || 'Untitled'}`);

  parts.push('\n## Status\n');
  parts.push(`[!singleselect:status:${normalizeActionStatus(document.status)}]\n`);

  parts.push('\n## Focus Date\n');
  parts.push(`[!datetime:focus_date:${document.focusDateTime ?? ''}]\n`);

  parts.push('\n## Due Date\n');
  parts.push(`[!datetime:due_date:${document.dueDate || ''}]\n`);

  parts.push('\n## Effort\n');
  parts.push(`[!singleselect:effort:${normalizeActionEffort(document.effort)}]\n`);

  parts.push('\n## Contexts\n');
  parts.push(`[!multiselect:contexts:${document.contexts.join(',')}]\n`);

  const cleanBody = (body || '').replace(/\s+$/s, '');
  if (cleanBody.length > 0) {
    parts.push('\n');
    parts.push(cleanBody);
    parts.push('\n');
  }

  parts.push('\n## References\n');
  parts.push(`[!references:${encodeReferenceCsv(document.references)}]\n`);

  const encodeHorizon = (
    key: keyof ActionHorizonReferences,
    values: string[]
  ): string => {
    const raw = document.horizonRaw[key];
    if (typeof raw === 'string') {
      return raw;
    }

    const normalized = normalizeReferenceList(values);
    if (normalized.length === 0) {
      return '';
    }

    return encodeURIComponent(JSON.stringify(normalized));
  };

  parts.push('\n## Horizon References (optional)\n');
  parts.push(`[!projects-references:${encodeHorizon('projects', document.horizonReferences.projects)}]\n`);
  parts.push(`[!areas-references:${encodeHorizon('areas', document.horizonReferences.areas)}]\n`);
  parts.push(`[!goals-references:${encodeHorizon('goals', document.horizonReferences.goals)}]\n`);
  parts.push(`[!vision-references:${encodeHorizon('vision', document.horizonReferences.vision)}]\n`);
  parts.push(`[!purpose-references:${encodeHorizon('purpose', document.horizonReferences.purpose)}]\n`);

  const createdDateTime = document.createdDateTime?.trim() || new Date().toISOString();
  parts.push('\n## Created\n');
  parts.push(`[!datetime:created_date_time:${createdDateTime}]\n`);

  return `${parts.join('').trim()}\n`;
}

export function parseActionMarkdown(content: string): ParsedActionMarkdown {
  const meta = extractMetadata(content || '');
  const legacyCreated = parseLegacyCreatedFooter(content || '');
  const focusDateTime = (
    typeof (meta as { focusDate?: unknown }).focusDate === 'string'
      ? (meta as { focusDate: string }).focusDate
      : parseLegacyLabeledSection(content || '', 'Focus Date')
  ) || undefined;
  const dueDateValue = (
    typeof (meta as { dueDate?: unknown }).dueDate === 'string'
      ? (meta as { dueDate: string }).dueDate
      : parseLegacyLabeledSection(content || '', 'Due Date')
  ) || undefined;
  const createdDateTime =
    typeof (meta as { createdDateTime?: unknown }).createdDateTime === 'string' &&
    (meta as { createdDateTime: string }).createdDateTime.trim()
      ? (meta as { createdDateTime: string }).createdDateTime.trim()
      : legacyCreated;

  return {
    title:
      typeof meta.title === 'string' && meta.title.trim()
        ? meta.title.trim()
        : 'Untitled',
    status: normalizeActionStatus(
      typeof (meta as { status?: unknown }).status === 'string'
        ? (meta as { status: string }).status
        : undefined
    ),
    effort: normalizeActionEffort(
      typeof (meta as { effort?: unknown }).effort === 'string'
        ? (meta as { effort: string }).effort
        : undefined
    ),
    focusDate: actionDateToDateOnly(focusDateTime),
    focusTime: actionDateToTimeOnly(focusDateTime),
    focusDateTime,
    dueDate: actionDateToDateOnly(dueDateValue),
    contexts: normalizeStringList((meta as { contexts?: unknown }).contexts),
    references: normalizeReferenceList(
      parseReferenceList((meta as { references?: unknown }).references)
    ),
    horizonReferences: {
      projects: normalizeReferenceList(
        parseReferenceList((meta as { projectsReferences?: unknown }).projectsReferences)
      ),
      areas: normalizeReferenceList(
        parseReferenceList((meta as { areasReferences?: unknown }).areasReferences)
      ),
      goals: normalizeReferenceList(
        parseReferenceList((meta as { goalsReferences?: unknown }).goalsReferences)
      ),
      vision: normalizeReferenceList(
        parseReferenceList((meta as { visionReferences?: unknown }).visionReferences)
      ),
      purpose: normalizeReferenceList(
        parseReferenceList((meta as { purposeReferences?: unknown }).purposeReferences)
      ),
    },
    horizonRaw: {
      projects: captureRawHorizonPayload(content, 'projects'),
      areas: captureRawHorizonPayload(content, 'areas'),
      goals: captureRawHorizonPayload(content, 'goals'),
      vision: captureRawHorizonPayload(content, 'vision'),
      purpose: captureRawHorizonPayload(content, 'purpose'),
    },
    createdDateTime,
    body: stripActionHeader(content || ''),
  };
}

export function rebuildActionMarkdown(
  currentContent: string,
  updates: Partial<{
    title: string;
    status: GTDActionStatus | string;
    effort: GTDActionEffort;
    focusDate: string;
    focusTime: string;
    dueDate: string;
    contexts: string[];
    references: string[];
    horizonReferences: ActionHorizonReferences;
    body: string;
  }>
): string {
  const parsed = parseActionMarkdown(currentContent);
  const nextFocusDate = updates.focusDate ?? parsed.focusDate;
  const nextFocusTime = updates.focusTime ?? parsed.focusTime;
  const nextHorizonReferences = updates.horizonReferences ?? parsed.horizonReferences;
  const nextHorizonRaw = updates.horizonReferences
    ? {}
    : parsed.horizonRaw;

  return buildActionMarkdown(
    {
      ...parsed,
      title: updates.title ?? parsed.title,
      status: normalizeActionStatus(updates.status ?? parsed.status),
      effort: updates.effort ?? parsed.effort,
      focusDate: nextFocusDate,
      focusTime: nextFocusTime,
      focusDateTime: normalizeFocusDateTime(nextFocusDate, nextFocusTime),
      dueDate: updates.dueDate ?? parsed.dueDate,
      contexts: normalizeStringList(updates.contexts ?? parsed.contexts),
      references: normalizeReferenceList(updates.references ?? parsed.references),
      horizonReferences: nextHorizonReferences,
      horizonRaw: nextHorizonRaw,
    },
    updates.body ?? parsed.body
  );
}

export function upsertReferenceMarker(
  content: string,
  marker: string,
  payload: string,
  headings: string[]
): string {
  const markerRegex = new RegExp(`\\[!${marker}:[^\\]]*\\]`, 'i');
  if (markerRegex.test(content)) {
    return content.replace(markerRegex, `[!${marker}:${payload}]`);
  }

  for (const heading of headings) {
    const headingRegex = new RegExp(`${escapeHeadingText(heading)}\\s*(?:\\r?\\n)+`, 'i');
    if (headingRegex.test(content)) {
      return content.replace(headingRegex, `${heading}\n[!${marker}:${payload}]\n\n`);
    }
  }

  const fallbackHeading = headings[0] || '## References';
  return `${content.trimEnd()}\n\n${fallbackHeading}\n[!${marker}:${payload}]\n`;
}
