/**
 * @fileoverview Helpers for Cabinet/Someday reference loading and two-way backlinks
 */

import { safeInvoke } from '@/utils/safe-invoke';
import { extractMetadata } from '@/utils/metadata-extractor';
import { checkTauriContextAsync } from '@/utils/tauri-ready';
import { encodeReferenceCsv } from '@/utils/gtd-markdown-helpers';

export type GeneralReferenceOption = {
  path: string;
  name: string;
  type: 'cabinet' | 'someday';
};

const README_REGEX = /(?:^|\/)README(?:\.(md|markdown))?$/i;

export const normalizeReferencePath = (value: string | undefined | null): string =>
  (value ?? '').replace(/\\/g, '/').trim();

export const isCabinetOrSomedayPath = (path: string, spacePath?: string | null): boolean => {
  const normalized = normalizeReferencePath(path).toLowerCase();
  if (!normalized) return false;
  const base = normalizeReferencePath(spacePath).toLowerCase();
  const inBase = base ? normalized.startsWith(base) : true;
  return (
    inBase &&
    (normalized.includes('/cabinet/') || normalized.includes('/someday maybe/'))
  );
};

export async function listCabinetSomedayReferences(spacePath: string): Promise<GeneralReferenceOption[]> {
  const sanitizedBase = normalizeReferencePath(spacePath).replace(/\/+$/, '');
  if (!sanitizedBase) return [];

  const inTauri = await checkTauriContextAsync();
  if (!inTauri) return [];

  const cabinetPath = `${sanitizedBase}/Cabinet`;
  const somedayPath = `${sanitizedBase}/Someday Maybe`;

  type MarkdownFile = { path: string; name: string };

  const [cabinet, someday] = await Promise.all([
    safeInvoke<MarkdownFile[]>('list_markdown_files', { path: cabinetPath }, []),
    safeInvoke<MarkdownFile[]>('list_markdown_files', { path: somedayPath }, []),
  ]);

  const toOption = (file: MarkdownFile, type: 'cabinet' | 'someday'): GeneralReferenceOption => ({
    path: normalizeReferencePath(file.path),
    name: file.name.replace(/\.(md|markdown)$/i, ''),
    type,
  });

  return [
    ...(cabinet || []).filter((f) => f?.name && !README_REGEX.test(f.name)).map((f) => toOption(f, 'cabinet')),
    ...(someday || []).filter((f) => f?.name && !README_REGEX.test(f.name)).map((f) => toOption(f, 'someday')),
  ];
}

const ensureStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => normalizeReferencePath(String(v))).filter(Boolean);

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];

    // Try decode + JSON first
    const attempts = [raw];
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded && decoded !== raw) attempts.unshift(decoded);
    } catch {
      // ignore
    }

    for (const candidate of attempts) {
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => normalizeReferencePath(String(v))).filter(Boolean);
        }
      } catch {
        // fall back to CSV
      }
    }

    return raw
      .split(',')
      .map((entry) => normalizeReferencePath(entry))
      .filter(Boolean);
  }

  return [];
};

const setReferencesToken = (content: string, values: string[]): string => {
  const encoded = encodeReferenceCsv(values);
  const token = `[!references:${encoded}]`;
  const tokenPattern = /\[!references:[^\]]*\]/i;

  if (tokenPattern.test(content)) {
    return content.replace(tokenPattern, token);
  }

  // Match both "## References" and "## References (optional)" headings
  const headingPattern = /(##\s+References(?:\s*\(optional\))?\s*\n?)/i;
  if (headingPattern.test(content)) {
    return content.replace(headingPattern, `$1${token}\n`);
  }

  return `${content.trimEnd()}

## References
${token}
`;
};

interface BacklinkOptions {
  spacePath: string;
  sourcePath: string;
  targetPath: string;
  action: 'add' | 'remove';
}

/**
 * Ensure Cabinet/Someday pages maintain backlinks to GTD items.
 */
export async function syncGeneralBacklink({ spacePath, sourcePath, targetPath, action }: BacklinkOptions): Promise<void> {
  try {
    const inTauri = await checkTauriContextAsync();
    if (!inTauri) return;

    const normalizedSource = normalizeReferencePath(sourcePath);
    const normalizedTarget = normalizeReferencePath(targetPath);
    if (!normalizedSource || !normalizedTarget || normalizedSource === normalizedTarget) return;

    if (!isCabinetOrSomedayPath(normalizedTarget, spacePath)) return;

    const rawContent = await safeInvoke<string>('read_file', { path: normalizedTarget }, null);
    if (rawContent === null || rawContent === undefined) return;

    const metadata = extractMetadata(rawContent);
    const existing = ensureStringArray((metadata as any).references);

    const next = new Set(existing.map((v) => normalizeReferencePath(v)).filter(Boolean));
    if (action === 'add') next.add(normalizedSource);
    else next.delete(normalizedSource);

    const nextValues = Array.from(next).sort();
    const encodedExisting = encodeReferenceCsv(existing);
    const encodedNext = encodeReferenceCsv(nextValues);
    if (encodedExisting === encodedNext) return;

    const updated = setReferencesToken(rawContent, nextValues);
    if (updated !== rawContent) {
      await safeInvoke('save_file', { path: normalizedTarget, content: updated }, null);
    }
  } catch (error) {
    console.error('Failed to sync general reference backlink', error);
  }
}
