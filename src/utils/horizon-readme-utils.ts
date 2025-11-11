import type { MarkdownFile } from '@/types';
import { HORIZON_CONFIG, HorizonType } from '@/utils/horizon-config';

export interface HorizonReadmeBuildOptions {
  horizon: HorizonType;
  content?: string;
  referencePaths?: string[];
  createdDateTime?: string;
  title?: string;
}

export interface HorizonReadmeBuildResult {
  content: string;
  referenceCount: number;
  references: string[];
}

export interface HorizonReadmeSyncResult extends HorizonReadmeBuildResult {
  changed: boolean;
}

const CANONICAL_HEADING_MAP: Record<string, string> = {
  'altitude': '## Altitude',
  'review cadence': '## Review Cadence',
  'review cadence (optional)': '## Review Cadence',
  'created': '## Created',
  'created date': '## Created',
  'created date/time': '## Created',
  'why this horizon matters': '## Why this horizon matters',
  'how to work this horizon in gtd space': '## How to work this horizon in GTD Space',
  'horizon pages overview': '## Horizon Pages Overview',
  'reference index': '## Reference Index',
  'horizon pages': '## Horizon Pages',
};

function normalizeHeadingLabel(heading: string): string {
  return heading.replace(/^##\s*/, '').trim().toLowerCase();
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function sanitizeBlockBody(body?: string | null): string {
  if (!body) return '';
  return body.trim().replace(/\s+$/g, '').trim();
}

export function extractMarkdownTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function extractPreamble(markdown: string): string {
  const titleMatch = markdown.match(/^#\s+.+$/m);
  if (!titleMatch) return '';
  const titleEnd = (titleMatch.index ?? 0) + titleMatch[0].length;
  const remainder = markdown.slice(titleEnd);
  const headingIndex = remainder.search(/\n##\s+/);
  if (headingIndex === -1) {
    return remainder.trim();
  }
  return remainder.slice(0, headingIndex).trim();
}

interface ParsedSection {
  heading: string;
  body: string;
}

function parseSections(markdown: string): ParsedSection[] {
  const normalized = normalizeNewlines(markdown);
  const sectionRegex = /^##\s+[^\n]+$/gm;
  const matches = Array.from(normalized.matchAll(sectionRegex));
  return matches.map((match, index) => {
    const heading = match[0].trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
    const body = normalized.slice(start, end).trim();
    return { heading, body };
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSingleSelect(markdown: string, field: string): string | null {
  const pattern = new RegExp(`\\[!singleselect:${escapeRegex(field)}:([^\\]]+)\\]`, 'i');
  const match = pattern.exec(markdown);
  return match ? match[1].trim() : null;
}

function extractDatetime(markdown: string, field: string): string | null {
  const pattern = new RegExp(`\\[!datetime:${escapeRegex(field)}:([^\\]]*)\\]`, 'i');
  const match = pattern.exec(markdown);
  return match ? match[1].trim() : null;
}

function decodeLoose(value: string): string {
  let result = value;
  let attempts = 0;
  while (attempts < 3 && /%[0-9A-Fa-f]{2}/.test(result)) {
    try {
      const decoded = decodeURIComponent(result);
      if (decoded === result) break;
      result = decoded;
      attempts += 1;
    } catch {
      break;
    }
  }
  return result;
}

function extractReferenceValues(markdown: string, token: string): string[] {
  const pattern = new RegExp(`\\[!${escapeRegex(token)}:(.*?)\\]`, 's');
  const match = pattern.exec(markdown);
  if (!match) return [];
  const raw = match[1].trim();
  if (!raw) return [];
  const attemptParse = (input: string): string[] | null => {
    try {
      const parsed = JSON.parse(input);
      if (!Array.isArray(parsed)) return null;
      return parsed.map((value) => String(value));
    } catch {
      return null;
    }
  };

  const tryJson = attemptParse(raw);
  if (tryJson) return tryJson;

  const decoded = decodeLoose(raw);
  const decodedJson = attemptParse(decoded);
  if (decodedJson) return decodedJson;

  const csvSource = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw;
  return csvSource
    .split(',')
    .map((value) => value.replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean);
}

function normalizeReferencePaths(paths: string[]): string[] {
  const deduped = Array.from(
    new Set(
      paths
        .map((path) => path?.replace(/\\/g, '/').trim())
        .filter(Boolean)
    )
  );
  return deduped.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function sectionBlock(heading: string, body: string): string {
  return `${heading}\n${body}`.trim();
}

export function extractHorizonSection(content: string, headingLabel: string): string {
  const normalized = normalizeNewlines(content);
  const label = headingLabel.replace(/^##\s*/, '').trim();
  const pattern = new RegExp(`^##\\s+${escapeRegex(label)}\\s*\\n([\\s\\S]*?)(?=^##\\s|$)`, 'mi');
  const match = pattern.exec(normalized);
  return match ? match[1].trim() : '';
}

export function buildHorizonReadmeMarkdown(options: HorizonReadmeBuildOptions): HorizonReadmeBuildResult {
  const { horizon, content = '', referencePaths, createdDateTime, title } = options;
  const normalized = normalizeNewlines(content);
  const config = HORIZON_CONFIG[horizon];

  const sections = parseSections(normalized);
  const sectionMap = new Map<string, string>();
  const extras: ParsedSection[] = [];

  sections.forEach((section) => {
    const canonical = CANONICAL_HEADING_MAP[normalizeHeadingLabel(section.heading)];
    if (canonical) {
      if (!sectionMap.has(canonical)) {
        sectionMap.set(canonical, section.body.trim());
      }
    } else {
      extras.push(section);
    }
  });

  const existingTitle = title || extractMarkdownTitle(normalized) || `${config.label} Overview`;
  const altitudeValue = extractSingleSelect(normalized, 'horizon-altitude') || config.altitudeToken;
  const cadenceValue = extractSingleSelect(normalized, 'horizon-review-cadence') || config.defaultCadence;
  const createdValue = createdDateTime || extractDatetime(normalized, 'created_date_time') || new Date().toISOString();
  const whyBody = sanitizeBlockBody(sectionMap.get('## Why this horizon matters')) || config.copy.why;
  const howBody = sanitizeBlockBody(sectionMap.get('## How to work this horizon in GTD Space')) || config.copy.how;
  const overviewBody = sanitizeBlockBody(sectionMap.get('## Horizon Pages Overview')) || config.copy.overview;

  const referenceValues = referencePaths ?? extractReferenceValues(normalized, config.referenceToken);
  const normalizedRefs = normalizeReferencePaths(referenceValues);
  const referenceMarker = `[!${config.referenceToken}:${normalizedRefs.length ? JSON.stringify(normalizedRefs) : '[]'}]`;

  const preamble = extractPreamble(normalized);

  const docParts: string[] = [];
  docParts.push(`# ${existingTitle}`);
  docParts.push(sectionBlock('## Altitude', `[!singleselect:horizon-altitude:${altitudeValue}]`));
  docParts.push(sectionBlock('## Review Cadence', `[!singleselect:horizon-review-cadence:${cadenceValue}]`));
  docParts.push(sectionBlock('## Created', `[!datetime:created_date_time:${createdValue}]`));
  if (preamble) {
    docParts.push(preamble.trim());
  }
  docParts.push(sectionBlock('## Why this horizon matters', whyBody));
  docParts.push(sectionBlock('## How to work this horizon in GTD Space', howBody));
  docParts.push(sectionBlock('## Horizon Pages Overview', overviewBody));
  docParts.push(sectionBlock('## Reference Index', referenceMarker));
  docParts.push(sectionBlock('## Horizon Pages', `[!${config.listToken}]`));

  extras.forEach((extra) => {
    const trimmedBody = sanitizeBlockBody(extra.body);
    docParts.push(sectionBlock(extra.heading, trimmedBody));
  });

  const finalContent = docParts
    .filter(Boolean)
    .map((part) => part.trim())
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
    .concat('\n');

  return {
    content: finalContent,
    referenceCount: normalizedRefs.length,
    references: normalizedRefs,
  };
}

export function syncHorizonReadmeContent({
  horizon,
  existingContent,
  files,
}: {
  horizon: HorizonType;
  existingContent: string;
  files: MarkdownFile[];
}): HorizonReadmeSyncResult {
  const filtered = (files || [])
    .filter((file) => file.name.toLowerCase() !== 'readme.md')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((file) => file.path.replace(/\\/g, '/'));

  const buildResult = buildHorizonReadmeMarkdown({
    horizon,
    content: existingContent,
    referencePaths: filtered,
  });

  const normalizedOriginal = normalizeNewlines(existingContent).trimEnd();
  const normalizedNew = normalizeNewlines(buildResult.content).trimEnd();

  return {
    ...buildResult,
    changed: normalizedOriginal !== normalizedNew,
  };
}
