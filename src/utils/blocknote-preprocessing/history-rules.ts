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
      if (typeof item !== "object" || item === null) {
        return false;
      }
      const child = item as Exclude<TextChild, string>;
      return child.styles?.italic === true;
    });

  return (
    blockText.includes("Track your habit") ||
    blockText.trim() === "" ||
    hasOnlyItalicContent
  );
}

export function shouldDropArtifactReferencesBlock(block: UnknownBlock): boolean {
  if (block.type !== "references") {
    return false;
  }
  if (!block.props) {
    return true;
  }

  const referencesValue = block.props.references;
  const references =
    typeof referencesValue === "string" ? referencesValue.trim() : "";
  const hasSeparatorRow = references
    .split(/\r?\n/)
    .some((line) => /^\s*-{3,}\s*$/.test(line));

  return (
    references === "" ||
    references.includes("|") ||
    hasSeparatorRow
  );
}
