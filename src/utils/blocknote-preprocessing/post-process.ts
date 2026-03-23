import { getTextFromBlock, isParagraphBlock } from "./block-text";
import {
  createContentHash,
  pruneBlockProcessingCache,
  readCachedBlocks,
  writeCachedBlocks,
} from "./cache";
import {
  isHistoryHeading,
  isHorizontalRuleParagraph,
  isLevelTwoHeading,
  shouldDropArtifactReferencesBlock,
  shouldSkipBlockInsideHistory,
} from "./history-rules";
import { replaceParagraphWithCustomBlocks } from "./replace-paragraph";
import { scanMarkdownForCustomBlocks } from "./scan-markdown";
import type { ProcessedBlock, UnknownBlock } from "./types";

export function postProcessBlockNoteBlocks(
  blocks: unknown[],
  markdown: string
): unknown[] {
  const cacheKey = createContentHash(markdown, blocks.length);
  const now = Date.now();
  const cached = readCachedBlocks(cacheKey, now);
  if (cached) {
    return cached;
  }

  pruneBlockProcessingCache(now);

  const scannedMarkdown = scanMarkdownForCustomBlocks(markdown);
  if (import.meta?.env?.VITE_DEBUG_BLOCKNOTE && scannedMarkdown.totalCustomBlocks > 0) {
    console.log(
      `Found ${scannedMarkdown.totalCustomBlocks} custom GTD blocks to process`
    );
  }
  const hasReplacementCandidates = scannedMarkdown.replacementByText.size > 0;

  const processedBlocks: ProcessedBlock[] = [];
  let inHistorySection = false;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index] as UnknownBlock;
    const blockText = getTextFromBlock(block);

    if (isHorizontalRuleParagraph(block, blockText)) {
      processedBlocks.push(block);
      continue;
    }

    if (isHistoryHeading(block, blockText)) {
      inHistorySection = true;
      processedBlocks.push(block);
      continue;
    }

    if (inHistorySection && isLevelTwoHeading(block)) {
      inHistorySection = false;
    }

    if (inHistorySection) {
      if (block.type === "table") {
        processedBlocks.push(block);
        continue;
      }

      if (shouldSkipBlockInsideHistory(block, blockText)) {
        continue;
      }

      processedBlocks.push(block);
      continue;
    }

    if (shouldDropArtifactReferencesBlock(block)) {
      continue;
    }

    if (hasReplacementCandidates && isParagraphBlock(block) && block.content) {
      const replacements = replaceParagraphWithCustomBlocks(
        block,
        blockText,
        scannedMarkdown.replacementByText
      );

      if (replacements) {
        processedBlocks.push(...replacements);
        continue;
      }
    }

    processedBlocks.push(block);
  }

  const result = processedBlocks as unknown[];
  writeCachedBlocks(cacheKey, result, now);
  return result;
}
