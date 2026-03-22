import type { ParagraphBlock, UnknownBlock } from "./types";

export function isParagraphBlock(block: UnknownBlock): block is ParagraphBlock {
  return block.type === "paragraph";
}

/**
 * Returns flattened text content from a paragraph-like BlockNote block.
 *
 * Accepts either a `ParagraphBlock` or an `UnknownBlock`, handles supported
 * `block.content` shapes such as a plain string or an array containing strings
 * and text objects, and concatenates any discovered text fragments.
 *
 * @param block - The `ParagraphBlock` or `UnknownBlock` whose content should be flattened.
 * @returns A concatenated text string, or an empty string when the block has no readable content.
 */
export function getTextFromBlock(block: ParagraphBlock | UnknownBlock): string {
  if (!block.content) return "";

  if (typeof block.content === "string") {
    return block.content;
  }

  if (Array.isArray(block.content)) {
    return block.content
      .map((item) => {
        if (typeof item === "string") return item;
        if (
          item &&
          typeof item === "object" &&
          "text" in item &&
          typeof item.text === "string"
        ) {
          return item.text;
        }
        return "";
      })
      .join("");
  }

  return "";
}
