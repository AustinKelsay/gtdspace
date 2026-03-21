import { GTD_FIELD_MARKER_PATTERN } from "./marker-patterns";

const blockProcessingCache = new Map<
  string,
  { blocks: unknown[]; timestamp: number }
>();

export const CACHE_DURATION = 5000;

function createNumericHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charCodeAt(index);
    hash = (hash << 5) - hash + character;
    hash &= hash;
  }

  return Math.abs(hash).toString(36);
}

function toBase64(input: string): string {
  const value = String(input);

  if (typeof btoa !== "undefined") {
    try {
      return btoa(
        encodeURIComponent(value).replace(
          /%([0-9A-F]{2})/g,
          (_match, part) => String.fromCharCode(parseInt(part, 16))
        )
      );
    } catch (error) {
      console.error("Failed to encode to base64:", error);
      return createNumericHash(value);
    }
  }

  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { Buffer?: typeof Buffer }).Buffer !== "undefined"
  ) {
    return (globalThis as { Buffer: typeof Buffer }).Buffer.from(
      value,
      "utf-8"
    ).toString("base64");
  }

  return createNumericHash(value);
}

export function createContentHash(markdown: string, blockCount: number): string {
  const gtdFieldMarkers = markdown.match(GTD_FIELD_MARKER_PATTERN) || [];
  const gtdFieldCount = gtdFieldMarkers.length;

  if (gtdFieldCount === 0) {
    const contentHash = toBase64(markdown.trim()).slice(0, 8);
    return `empty-${blockCount}-${contentHash}`;
  }

  const structuralHash = toBase64(gtdFieldMarkers.join("|")).slice(0, 12);
  const contentHash = toBase64(markdown.trim()).slice(0, 8);
  return `${blockCount}-${gtdFieldCount}-${structuralHash}-${contentHash}`;
}

export function readCachedBlocks(
  cacheKey: string,
  now: number = Date.now()
): unknown[] | null {
  const cached = blockProcessingCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.blocks;
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
  blockProcessingCache.set(cacheKey, { blocks, timestamp: now });
}

export function clearBlockProcessingCache(): void {
  blockProcessingCache.clear();
}

export function getBlockProcessingCacheSize(): number {
  return blockProcessingCache.size;
}
