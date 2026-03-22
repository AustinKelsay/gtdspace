export const README_REFERENCE_REGEX = /(?:^|\/)README(?:\.(md|markdown))?$/i;

function decodeLoose(input: string): string {
  let result = input;
  let attempts = 0;

  while (attempts < 3 && /%[0-9A-Fa-f]{2}/.test(result)) {
    try {
      const decoded = decodeURIComponent(result);
      if (decoded === result) {
        break;
      }
      result = decoded;
      attempts += 1;
    } catch {
      break;
    }
  }

  return result;
}

function stripWrappingQuotes(input: string): string {
  return input.replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '');
}

function tryParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export function normalizeReferencePath(value: string | null | undefined): string {
  return (value ?? '').replace(/\\/g, '/').trim();
}

function appendReferenceValue(candidate: unknown, results: Set<string>): void {
  if (candidate === null || candidate === undefined) {
    return;
  }

  if (Array.isArray(candidate)) {
    candidate.forEach((item) => appendReferenceValue(item, results));
    return;
  }

  const raw = String(candidate).trim();
  if (!raw) {
    return;
  }

  const parsed = tryParseJson(raw);
  if (Array.isArray(parsed)) {
    parsed.forEach((item) => appendReferenceValue(item, results));
    return;
  }
  if (typeof parsed === 'string' && parsed !== raw) {
    appendReferenceValue(parsed, results);
    return;
  }

  const decoded = decodeLoose(stripWrappingQuotes(raw));
  const decodedParsed = tryParseJson(decoded);
  if (Array.isArray(decodedParsed)) {
    decodedParsed.forEach((item) => appendReferenceValue(item, results));
    return;
  }
  if (typeof decodedParsed === 'string' && decodedParsed !== decoded) {
    appendReferenceValue(decodedParsed, results);
    return;
  }

  const normalized = normalizeReferencePath(decoded);
  if (normalized) {
    results.add(normalized);
  }
}

export function parseReferenceList(value: unknown): string[] {
  const results = new Set<string>();

  if (Array.isArray(value)) {
    value.forEach((item) => appendReferenceValue(item, results));
    return Array.from(results);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    const parsed = tryParseJson(trimmed);
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => appendReferenceValue(item, results));
      return Array.from(results);
    }

    const decoded = decodeLoose(trimmed);
    if (decoded !== trimmed) {
      const decodedParsed = tryParseJson(decoded);
      if (Array.isArray(decodedParsed)) {
        decodedParsed.forEach((item) => appendReferenceValue(item, results));
        return Array.from(results);
      }
    }

    const repairedBracketValue =
      trimmed.startsWith('[') && !trimmed.endsWith(']') ? `${trimmed}]` : trimmed;
    const repairedParsed = tryParseJson(repairedBracketValue);
    if (Array.isArray(repairedParsed)) {
      repairedParsed.forEach((item) => appendReferenceValue(item, results));
      return Array.from(results);
    }

    const csvSource =
      repairedBracketValue.startsWith('[') && repairedBracketValue.endsWith(']')
        ? repairedBracketValue.slice(1, -1)
        : repairedBracketValue;

    if (csvSource.includes(',')) {
      csvSource.split(',').forEach((item) => appendReferenceValue(item, results));
      return Array.from(results);
    }

    appendReferenceValue(csvSource, results);
    return Array.from(results);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    appendReferenceValue(value, results);
  }

  return Array.from(results);
}

export function normalizeReferenceList(
  values?: ReadonlyArray<string>,
  options: { stripReadme?: boolean } = {}
): string[] {
  const results = new Set<string>();

  for (const value of values ?? []) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = normalizeReferencePath(value);
    if (!normalized) {
      continue;
    }
    if (options.stripReadme && README_REFERENCE_REGEX.test(normalized)) {
      continue;
    }

    results.add(normalized);
  }

  return Array.from(results);
}

export function stripReadmeReferences(values: ReadonlyArray<string>): string[] {
  return normalizeReferenceList(values, { stripReadme: true });
}

export function displayNameForReference(referencePath: string): string {
  const normalized = normalizeReferencePath(referencePath);
  const leaf = normalized.split('/').pop();
  if (!leaf) {
    return normalized;
  }

  return leaf.replace(/\.(md|markdown)$/i, '');
}

export function normalizeProjectReferencePath(raw: string): string {
  return normalizeReferencePath(raw)
    .replace(/\/README\.(md|markdown)$/i, '')
    .replace(/\/+$/g, '');
}

export function normalizeProjectPathFromReadme(filePath?: string): string | null {
  if (!filePath) {
    return null;
  }

  const normalized = normalizeReferencePath(filePath);
  const readmeMatch = normalized.match(/\/README(?:\.(md|markdown))?$/i);
  if (!readmeMatch || readmeMatch.index === undefined) {
    return null;
  }

  const projectPath = normalized.slice(0, readmeMatch.index);
  if (!/(^|\/)Projects\/.+$/i.test(projectPath)) {
    return null;
  }

  return normalizeProjectReferencePath(projectPath);
}
