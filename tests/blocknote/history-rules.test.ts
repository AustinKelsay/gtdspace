import { describe, expect, it } from "vitest";
import {
  isHistoryHeading,
  isLevelTwoHeading,
  isHorizontalRuleParagraph,
  shouldDropArtifactReferencesBlock,
  shouldSkipBlockInsideHistory,
} from "@/utils/blocknote-preprocessing/history-rules";

describe("blocknote history rules", () => {
  it("detects the history heading and horizontal rules", () => {
    expect(
      isHistoryHeading(
        { type: "heading", props: { level: 2 }, content: "History" },
        "History"
      )
    ).toBe(true);

    expect(
      isHorizontalRuleParagraph(
        { type: "paragraph", content: "---" },
        "---"
      )
    ).toBe(true);

    expect(
      isHorizontalRuleParagraph(
        { type: "paragraph", content: "***" },
        "***"
      )
    ).toBe(true);

    expect(
      isHorizontalRuleParagraph(
        { type: "paragraph", content: "___" },
        "___"
      )
    ).toBe(true);
  });

  it("rejects non-level-two headings for history helpers", () => {
    expect(
      isLevelTwoHeading({ type: "heading", props: { level: 3 }, content: "Any" })
    ).toBe(false);

    expect(
      isHistoryHeading(
        { type: "heading", props: { level: 1 }, content: "History" },
        "History"
      )
    ).toBe(false);

    expect(
      isHistoryHeading(
        { type: "heading", props: { level: 2 }, content: "Not History" },
        "Not History"
      )
    ).toBe(false);
  });

  it("skips empty, helper, and italic-only paragraphs inside history", () => {
    expect(
      shouldSkipBlockInsideHistory(
        { type: "paragraph", content: "" },
        ""
      )
    ).toBe(true);

    expect(
      shouldSkipBlockInsideHistory(
        { type: "paragraph", content: "Track your habit daily" },
        "Track your habit daily"
      )
    ).toBe(false);

    expect(
      shouldSkipBlockInsideHistory(
        { type: "paragraph", content: "*Track your habit completions below:*" },
        "*Track your habit completions below:*"
      )
    ).toBe(true);

    expect(
      shouldSkipBlockInsideHistory(
        {
          type: "paragraph",
          content: [{ text: "helper", styles: { italic: true } }],
        },
        "helper"
      )
    ).toBe(false);

    expect(
      shouldSkipBlockInsideHistory(
        {
          type: "paragraph",
          content: [
            {
              text: "*Track your habit completions below:*",
              styles: { italic: true },
            },
          ],
        },
        "*Track your habit completions below:*"
      )
    ).toBe(true);

    expect(
      shouldSkipBlockInsideHistory(
        { type: "paragraph", content: "Keep this row" },
        "Keep this row"
      )
    ).toBe(false);

    expect(
      shouldSkipBlockInsideHistory(
        {
          type: "paragraph",
          content: [
            { text: "Keep ", styles: { italic: false } },
            { text: "this", styles: { italic: true } },
            { text: " row", styles: { italic: false } },
          ],
        },
        "Keep this row"
      )
    ).toBe(false);
  });

  it("filters generic reference artifacts outside history", () => {
    expect(
      shouldDropArtifactReferencesBlock({
        type: "references",
        props: { references: "" },
      })
    ).toBe(true);

    expect(
      shouldDropArtifactReferencesBlock({
        type: "references",
        props: { references: "a|b" },
      })
    ).toBe(true);

    expect(
      shouldDropArtifactReferencesBlock({
        type: "references",
        props: { references: "/tmp/ref.md" },
      })
    ).toBe(false);

    expect(
      shouldDropArtifactReferencesBlock({
        type: "references",
        props: { references: "/tmp/notes---archive.md" },
      })
    ).toBe(false);
  });
});
