import { createMarkerOnlyTokenRegex } from "./marker-patterns";
import {
  buildExactMatchBlock,
  buildMarkerOnlyBlock,
} from "./marker-to-block";
import type { ProcessedBlock, ReplacementEntry, UnknownBlock } from "./types";

export function replaceParagraphWithCustomBlocks(
  block: UnknownBlock,
  blockText: string,
  replacementByText: Map<string, ReplacementEntry>
): ProcessedBlock[] | null {
  const trimmedText = blockText.trim();
  if (!trimmedText) {
    return null;
  }

  const markerPattern = createMarkerOnlyTokenRegex();
  const markerTokenRegex = new RegExp(markerPattern.source, markerPattern.flags);
  const leftoverAfterRemoval = blockText.replace(markerTokenRegex, "");
  const leftoverSanitized = leftoverAfterRemoval
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "")
    .trim();
  const onlyMarkers =
    trimmedText.length > 0 && leftoverSanitized === "";

  if (onlyMarkers) {
    const markerMatchesRegex = new RegExp(markerPattern.source, markerPattern.flags);
    const matches = [...blockText.matchAll(markerMatchesRegex)];
    const processedBlocks: ProcessedBlock[] = [];
    let hasFailure = false;

    for (const match of matches) {
      const kind = match[1];
      const rest = (match[2] || "").replace(/^:/, "");
      const customBlock = buildMarkerOnlyBlock(kind, rest);
      if (customBlock) {
        processedBlocks.push(customBlock);
      } else {
        hasFailure = true;
      }
    }

    if (hasFailure) {
      return [block];
    }

    return processedBlocks;
  }

  const exactReplacement = replacementByText.get(trimmedText);
  if (!exactReplacement) {
    return null;
  }

  return [buildExactMatchBlock(exactReplacement)];
}
