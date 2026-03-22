import { isParagraphBlock } from "./block-text";
import type { TextChild, UnknownBlock } from "./types";

export function isHorizontalRuleParagraph(
  block: UnknownBlock,
  blockText: string
): boolean {
  return (
    block.type === "paragraph" &&
    (blockText === "---" || blockText === "***" || blockText === "___")
  );
}

export function isHistoryHeading(block: UnknownBlock, blockText: string): boolean {
  return block.type === "heading" && block.props?.level === 2 && blockText.trim() === "History";
}

export function isLevelTwoHeading(block: UnknownBlock): boolean {
  return block.type === "heading" && block.props?.level === 2;
}

export function shouldSkipBlockInsideHistory(
  block: UnknownBlock,
  blockText: string
): boolean {
  if (!isParagraphBlock(block)) {
    return false;
  }

  const hasOnlyItalicContent =
    Array.isArray(block.content) &&
    block.content.length > 0 &&
    block.content.every((item: unknown) => {
      const child = item as TextChild;
      return child !== null && typeof child === "object" && child.styles?.italic;
    });

  return (
    blockText.includes("Track your habit") ||
    blockText.trim() === "" ||
    hasOnlyItalicContent
  );
}

export function shouldDropArtifactReferencesBlock(block: UnknownBlock): boolean {
  if (block.type !== "references" || !block.props) {
    return false;
  }

  const referencesValue = block.props.references;
  const references =
    typeof referencesValue === "string" ? referencesValue.trim() : "";

  return (
    references === "" ||
    references.includes("|") ||
    references.includes("---")
  );
}
