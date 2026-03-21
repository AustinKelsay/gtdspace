import { describe, expect, it } from "vitest";
import {
  isHistoryHeading,
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
    ).toBe(true);

    expect(
      shouldSkipBlockInsideHistory(
        {
          type: "paragraph",
          content: [{ text: "helper", styles: { italic: true } }],
        },
        "helper"
      )
    ).toBe(true);

    expect(
      shouldSkipBlockInsideHistory(
        { type: "paragraph", content: "Keep this row" },
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
  });
});
