import type { ParagraphBlock, UnknownBlock } from "./types";

export function isParagraphBlock(block: UnknownBlock): block is ParagraphBlock {
  return block.type === "paragraph";
}

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
