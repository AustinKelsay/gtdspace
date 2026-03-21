import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearBlockProcessingCache,
  postProcessBlockNoteBlocks,
} from "@/utils/blocknote-preprocessing";

describe("postProcessBlockNoteBlocks", () => {
  beforeEach(() => {
    clearBlockProcessingCache();
  });

  afterEach(() => {
    clearBlockProcessingCache();
    vi.useRealTimers();
  });

  it("preserves history tables, skips helper paragraphs, and filters artifact references outside history", () => {
    const blocks = [
      { type: "heading", props: { level: 2 }, content: "History" },
      { type: "paragraph", content: "" },
      {
        type: "paragraph",
        content: [{ text: "helper", styles: { italic: true } }],
      },
      { type: "table", content: [] },
      { type: "paragraph", content: "Actual history row" },
      { type: "heading", props: { level: 2 }, content: "After History" },
      { type: "references", props: { references: "---" } },
      { type: "paragraph", content: "[!references:/tmp/ref.md]" },
    ];

    const result = postProcessBlockNoteBlocks(
      blocks,
      "[!references:/tmp/ref.md]"
    );

    expect(result).toMatchObject([
      { type: "heading" },
      { type: "table" },
      { type: "paragraph", content: "Actual history row" },
      { type: "heading", content: "After History" },
      {
        type: "references",
        props: { references: "/tmp/ref.md" },
      },
    ]);
  });

  it("replaces list-only marker paragraphs with custom list blocks", () => {
    const blocks = [{ type: "paragraph", content: "[!actions-list:waiting]" }];

    const result = postProcessBlockNoteBlocks(
      blocks,
      "[!actions-list:waiting]"
    );

    expect(result).toMatchObject([
      {
        type: "actions-list",
        props: {
          statusFilter: "waiting",
        },
      },
    ]);
  });

  it("uses the cache for identical input within the ttl and recomputes after expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T10:00:00Z"));

    const blocks = [{ type: "paragraph", content: "[!references:/tmp/ref.md]" }];
    const markdown = "[!references:/tmp/ref.md]";

    const firstResult = postProcessBlockNoteBlocks(blocks, markdown);
    (firstResult as Array<{ type: string }>).push({ type: "mutated" });
    const secondResult = postProcessBlockNoteBlocks(blocks, markdown);

    expect(secondResult).not.toBe(firstResult);
    expect(secondResult).not.toContainEqual({ type: "mutated" });

    vi.advanceTimersByTime(6000);
    const thirdResult = postProcessBlockNoteBlocks(blocks, markdown);

    expect(thirdResult).not.toBe(firstResult);
    expect(thirdResult).toMatchObject([
      {
        type: "references",
        props: { references: "/tmp/ref.md" },
      },
    ]);
  });
});
