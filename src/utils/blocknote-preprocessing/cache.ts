import { GTD_FIELD_MARKER_PATTERN } from "./marker-patterns";

const blockProcessingCache = new Map<
  string,
  { blocks: unknown[]; timestamp: number }
>();

export const CACHE_DURATION = 5000;

function cloneCachedBlocks(blocks: unknown[]): unknown[] {
  if (typeof structuredClone === "function") {
    return structuredClone(blocks);
  }

  return JSON.parse(JSON.stringify(blocks)) as unknown[];
}

function createNumericHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charCodeAt(index);
    hash = (hash << 5) - hash + character;
    hash &= hash;
  }

  return Math.abs(hash).toString(36);
}

export function createContentHash(markdown: string, blockCount: number): string {
  const gtdFieldMarkers = markdown.match(GTD_FIELD_MARKER_PATTERN) || [];
  const gtdFieldCount = gtdFieldMarkers.length;

  if (gtdFieldCount === 0) {
    const contentHash = createNumericHash(markdown);
    return `empty-${blockCount}-${contentHash}`;
  }

  const structuralHash = createNumericHash(gtdFieldMarkers.join("|"));
  const contentHash = createNumericHash(markdown);
  return `${blockCount}-${gtdFieldCount}-${structuralHash}-${contentHash}`;
}

export function readCachedBlocks(
  cacheKey: string,
  now: number = Date.now()
): unknown[] | null {
  const cached = blockProcessingCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cloneCachedBlocks(cached.blocks);
  }
  if (cached) {
    blockProcessingCache.delete(cacheKey);
  }

  return null;
}

// pruneBlockProcessingCache only scans blockProcessingCache once it grows past a
// small heuristic threshold of 50 entries: below that, CACHE_DURATION-based TTL
// expiry is enough for the typical editor post-processing workload.
export function pruneBlockProcessingCache(now: number = Date.now()): void {
  if (blockProcessingCache.size <= 50) {
    return;
  }

  for (const [key, value] of blockProcessingCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      blockProcessingCache.delete(key);
    }
  }
}

export function writeCachedBlocks(
  cacheKey: string,
  blocks: unknown[],
  now: number = Date.now()
): void {
  if (blockProcessingCache.size > 50) {
    for (const [key, value] of blockProcessingCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION) {
        blockProcessingCache.delete(key);
      }
    }
  }
  blockProcessingCache.set(cacheKey, {
    blocks: cloneCachedBlocks(blocks),
    timestamp: now,
  });
}

export function clearBlockProcessingCache(): void {
  blockProcessingCache.clear();
}

export function getBlockProcessingCacheSize(): number {
  return blockProcessingCache.size;
}
