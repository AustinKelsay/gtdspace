import type { GTDProjectStatus } from '@/types';
import { extractMetadata } from '@/utils/metadata-extractor';
import {
  DEFAULT_PROJECT_OUTCOME,
  type ProjectHorizonReferences,
} from '@/utils/gtd-markdown-helpers';
import { normalizeProjectStatus } from '@/utils/gtd-status';
import {
  normalizeReferenceList,
  parseReferenceList,
} from '@/utils/gtd-reference-utils';

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

export interface ParsedProjectMarkdown {
  title: string;
  status: GTDProjectStatus;
  dueDate: string;
  desiredOutcome: string;
  horizonReferences: ProjectHorizonReferences;
  references: string[];
  includeHabitsList: boolean;
  additionalContent: string;
  createdDateTime: string;
}

export function toDateOnly(value?: string | null): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.length >= 10 && /\d{4}-\d{2}-\d{2}/.test(trimmed.slice(0, 10))) {
    return trimmed.slice(0, 10);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
}

export function normalizeProjectHorizonReferences(
  groups: ProjectHorizonReferences
): ProjectHorizonReferences {
  return {
    areas: normalizeReferenceList(groups.areas),
    goals: normalizeReferenceList(groups.goals),
    vision: normalizeReferenceList(groups.vision),
    purpose: normalizeReferenceList(groups.purpose),
  };
}

export function sanitizeProjectAdditionalContent(content: string): string {
  if (!content.trim()) {
    return '';
  }

  const lines = content.split(/\r?\n/);
  const kept: string[] = [];
  let skipping = false;

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (skipping) {
      if (trimmed.startsWith('## ')) {
        skipping = false;
        i -= 1;
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

  return kept.join('\n').replace(/\s+$/g, '').replace(/^\s*\n/, '');
}

function parseProjectSections(content: string): {
  desiredOutcome: string;
  includeHabitsList: boolean;
  additionalContent: string;
} {
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
    ? desiredBuffer.join('\n').replace(/^\s*\n+/, '').trimEnd()
    : '';

  const includeHabitsList = /\[!habits-list(?:[:\]])/i.test(content);

  let additionalContent = '';
  const habitsMatch = /\[!habits-list[^\]]*\]/i.exec(content);
  if (habitsMatch) {
    additionalContent = content.slice(habitsMatch.index + habitsMatch[0].length).replace(/^\s*\n/, '');
  } else {
    const actionsMatch = /\[!actions-list[^\]]*\]/i.exec(content);
    if (actionsMatch) {
      additionalContent = content
        .slice(actionsMatch.index + actionsMatch[0].length)
        .replace(/^\s*\n/, '');
    }
  }

  return {
    desiredOutcome,
    includeHabitsList,
    additionalContent: sanitizeProjectAdditionalContent(additionalContent),
  };
}

function extractCreatedDateTime(
  meta: ReturnType<typeof extractMetadata>,
  content: string
): string {
  const created = typeof (meta as { createdDateTime?: unknown }).createdDateTime === 'string'
    ? (meta as { createdDateTime: string }).createdDateTime.trim()
    : '';
  if (created) {
    return created;
  }

  const match = content.match(/\[!datetime:created_date_time:([^\]]+)\]/i);
  if (match?.[1]) {
    return match[1].trim();
  }

  return new Date().toISOString();
}

export function parseProjectMarkdown(content: string): ParsedProjectMarkdown {
  const meta = extractMetadata(content || '');
  const sections = parseProjectSections(content || '');

  const horizonReferences = normalizeProjectHorizonReferences({
    areas: parseReferenceList((meta as { areasReferences?: unknown }).areasReferences),
    goals: parseReferenceList((meta as { goalsReferences?: unknown }).goalsReferences),
    vision: parseReferenceList((meta as { visionReferences?: unknown }).visionReferences),
    purpose: parseReferenceList((meta as { purposeReferences?: unknown }).purposeReferences),
  });

  const desiredOutcome = sections.desiredOutcome?.trim() === DEFAULT_PROJECT_OUTCOME.trim()
    ? ''
    : sections.desiredOutcome;

  return {
    title:
      typeof meta.title === 'string' && meta.title.trim().length > 0
        ? meta.title.trim()
        : 'Untitled Project',
    status: normalizeProjectStatus(
      (meta as { projectStatus?: string; status?: string }).projectStatus ??
        (meta as { status?: string }).status
    ),
    dueDate: toDateOnly(
      typeof (meta as { dueDate?: unknown }).dueDate === 'string'
        ? (meta as { dueDate: string }).dueDate
        : ''
    ),
    desiredOutcome,
    horizonReferences,
    references: normalizeReferenceList(
      parseReferenceList((meta as { references?: unknown }).references)
    ),
    includeHabitsList: sections.includeHabitsList,
    additionalContent: sections.additionalContent,
    createdDateTime: extractCreatedDateTime(meta, content || ''),
  };
}
