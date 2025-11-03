import { safeInvoke } from '@/utils/safe-invoke';
import { extractMetadata } from '@/utils/metadata-extractor';
import { encodeReferenceArray } from './gtd-markdown-helpers';

type HorizonKind = 'projects' | 'areas' | 'goals' | 'vision' | 'purpose';

type BacklinkAction = 'add' | 'remove';

const INBOUND_REFERENCE_MAP: Record<HorizonKind, Partial<Record<HorizonKind, { token: string; heading: string }>>> = {
  projects: {
    vision: { token: 'vision-references', heading: 'Vision References (optional)' },
    goals: { token: 'goals-references', heading: 'Goals References' },
    areas: { token: 'areas-references', heading: 'Areas References' },
    purpose: { token: 'purpose-references', heading: 'Purpose & Principles References (optional)' },
  },
  areas: {
    projects: { token: 'projects-references', heading: 'Projects References' },
    goals: { token: 'goals-references', heading: 'Goals References' },
    vision: { token: 'vision-references', heading: 'Vision References (optional)' },
    purpose: { token: 'purpose-references', heading: 'Purpose & Principles References (optional)' },
  },
  goals: {
    projects: { token: 'projects-references', heading: 'Projects References' },
    areas: { token: 'areas-references', heading: 'Areas References' },
    vision: { token: 'vision-references', heading: 'Vision References (optional)' },
    purpose: { token: 'purpose-references', heading: 'Purpose & Principles References (optional)' },
  },
  vision: {
    projects: { token: 'projects-references', heading: 'Projects References' },
    areas: { token: 'areas-references', heading: 'Areas References' },
    goals: { token: 'goals-references', heading: 'Goals References' },
    purpose: { token: 'purpose-references', heading: 'Purpose & Principles References (optional)' },
  },
  purpose: {
    projects: { token: 'projects-references', heading: 'Projects References' },
    areas: { token: 'areas-references', heading: 'Areas References (optional)' },
    goals: { token: 'goals-references', heading: 'Goals References' },
    vision: { token: 'vision-references', heading: 'Vision References' },
  },
};

const TOKEN_TO_METADATA_KEY: Record<string, string> = {
  'projects-references': 'projectsReferences',
  'areas-references': 'areasReferences',
  'goals-references': 'goalsReferences',
  'vision-references': 'visionReferences',
  'purpose-references': 'purposeReferences',
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizePath = (path: string | undefined | null): string | null => {
  if (!path) return null;
  return path.replace(/\\/g, '/').trim();
};

const detectHorizonKind = (path: string): HorizonKind | null => {
  const normalized = path.toLowerCase();
  if (normalized.includes('/projects/')) return 'projects';
  if (normalized.includes('/areas of focus/')) return 'areas';
  if (normalized.includes('/goals/')) return 'goals';
  if (normalized.includes('/vision/')) return 'vision';
  if (normalized.includes('/purpose & principles/')) return 'purpose';
  return null;
};

const resolveTargetFilePath = (path: string, kind: HorizonKind): string => {
  let normalized = path.replace(/\\/g, '/');
  if (kind === 'projects') {
    normalized = normalized.replace(/\/$/, '');
    if (!normalized.toLowerCase().endsWith('.md')) {
      return `${normalized}/README.md`;
    }
  }
  return normalized;
};

const ensureStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

const setReferenceToken = (content: string, token: string, heading: string, values: string[]): string => {
  const encoded = encodeReferenceArray(values);
  const tokenPattern = new RegExp(`\\[!${escapeRegExp(token)}:[^\\]]*\\]`, 'g');
  const replacement = `[!${token}:${encoded}]`;

  if (tokenPattern.test(content)) {
    return content.replace(tokenPattern, replacement);
  }

  const headingPattern = new RegExp(`(##\\s+${escapeRegExp(heading)}\\s*\\n?)`, 'i');
  if (headingPattern.test(content)) {
    return content.replace(headingPattern, `$1${replacement}\n`);
  }

  return `${content.trimEnd()}\n\n## ${heading}\n${replacement}\n`;
};

interface SyncBacklinkOptions {
  sourcePath: string;
  sourceKind: HorizonKind;
  targetPath: string;
  action: BacklinkAction;
}

export async function syncHorizonBacklink({
  sourcePath,
  sourceKind,
  targetPath,
  action,
}: SyncBacklinkOptions): Promise<void> {
  try {
    const normalizedSource = normalizePath(sourcePath);
    const normalizedTarget = normalizePath(targetPath);
    if (!normalizedSource || !normalizedTarget || normalizedSource === normalizedTarget) {
      return;
    }

    const targetKind = detectHorizonKind(normalizedTarget);
    if (!targetKind) return;

    const config = INBOUND_REFERENCE_MAP[targetKind]?.[sourceKind];
    if (!config) return;

    const targetFilePath = resolveTargetFilePath(normalizedTarget, targetKind);

    const rawContent = await safeInvoke<string>('read_file', { path: targetFilePath }, null);
    if (rawContent === null || rawContent === undefined) {
      return;
    }

    const metadata = extractMetadata(rawContent);
    const metadataKey = TOKEN_TO_METADATA_KEY[config.token];
    const existingValues = ensureStringArray((metadata as any)[metadataKey])
      .map((value) => normalizePath(value))
      .filter((value): value is string => Boolean(value));

    const normalizedExisting = new Set(existingValues);
    const targetValues = new Set(existingValues);

    if (action === 'add') {
      targetValues.add(normalizedSource);
    } else {
      targetValues.delete(normalizedSource);
    }

    const updatedValues = Array.from(targetValues).filter(Boolean).sort();

    if (arraysEqual(Array.from(normalizedExisting).sort(), updatedValues)) {
      return;
    }

    const updateReferences = (baseContent: string | null | undefined) =>
      setReferenceToken(baseContent ?? '', config.token, config.heading, updatedValues);

    let skipDiskWrite = false;
    if (typeof window !== 'undefined' && typeof window.applyBacklinkChange === 'function') {
      const result = window.applyBacklinkChange(targetFilePath, updateReferences);
      if (result?.handled && result.wasDirty) {
        skipDiskWrite = true;
      }
    }

    if (!skipDiskWrite) {
      const updatedContent = updateReferences(rawContent);
      if (updatedContent !== rawContent) {
        await safeInvoke<string>('save_file', { path: targetFilePath, content: updatedContent }, null);
      }
    }
  } catch (error) {
    console.error('Failed to sync horizon backlinks', error);
  }
}
