import { describe, expect, it } from "vitest";
import { replaceParagraphWithCustomBlocks } from "@/utils/blocknote-preprocessing/replace-paragraph";
import { createReplacementEntry } from "@/utils/blocknote-preprocessing/marker-to-block";

describe("replaceParagraphWithCustomBlocks", () => {
  it("splits marker-only paragraphs into multiple custom blocks in order", () => {
    const block = {
      type: "paragraph",
      content: "[!references:/tmp/ref.md][!actions-list:waiting]",
    };

    const result = replaceParagraphWithCustomBlocks(
      block,
      "[!references:/tmp/ref.md][!actions-list:waiting]",
      new Map()
    );

    expect(result).toMatchObject([
      {
        type: "references",
        props: {
          references: "/tmp/ref.md",
        },
      },
      {
        type: "actions-list",
        props: {
          statusFilter: "waiting",
        },
      },
    ]);
  });

  it("uses the exact-match replacement block when the paragraph text matches a legacy html token", () => {
    const html =
      `<div data-singleselect='{"type":"habit-status","value":"completed"}' class="singleselect-block">Habit Status: completed</div>`;
    const replacementByText = new Map([
      [
        html,
        createReplacementEntry(
          html,
          {
            type: "singleselect",
            props: {
              type: "habit-status",
              value: "completed",
              label: "",
              placeholder: "",
              customOptionsJson: "[]",
            },
          },
          {
            type: "checkbox",
            props: {
              type: "habit-status",
              checked: true,
              label: "",
            },
          }
        ),
      ],
    ]);

    const result = replaceParagraphWithCustomBlocks(
      { type: "paragraph", content: html },
      html,
      replacementByText
    );

    expect(result).toMatchObject([
      {
        type: "checkbox",
        props: {
          type: "habit-status",
          checked: true,
        },
      },
    ]);
  });

  it("leaves mixed-content paragraphs untouched", () => {
    const result = replaceParagraphWithCustomBlocks(
      {
        type: "paragraph",
        content: "Before [!references:/tmp/ref.md] after",
      },
      "Before [!references:/tmp/ref.md] after",
      new Map()
    );

    expect(result).toBeNull();
  });

  it("preserves colons in marker-only values after the first separator", () => {
    const result = replaceParagraphWithCustomBlocks(
      {
        type: "paragraph",
        content: "[!datetime:due_date:2026-03-21T09:30:00]",
      },
      "[!datetime:due_date:2026-03-21T09:30:00]",
      new Map()
    );

    expect(result).toMatchObject([
      {
        type: "datetime",
        props: {
          type: "due_date",
          value: "2026-03-21T09:30:00",
        },
      },
    ]);
  });

  it("treats legacy completed checkbox markers as checked", () => {
    const result = replaceParagraphWithCustomBlocks(
      {
        type: "paragraph",
        content: "[!checkbox:habit-status:completed]",
      },
      "[!checkbox:habit-status:completed]",
      new Map()
    );

    expect(result).toMatchObject([
      {
        type: "checkbox",
        props: {
          type: "habit-status",
          checked: true,
        },
      },
    ]);
  });

  it("does not treat unknown markers as custom blocks", () => {
    const result = replaceParagraphWithCustomBlocks(
      {
        type: "paragraph",
        content: "[!unknown:value]",
      },
      "[!unknown:value]",
      new Map()
    );

    expect(result).toBeNull();
  });

  it("preserves invisible marker-free paragraphs that sanitize to only markers", () => {
    const block = {
      type: "paragraph",
      content: "\u200B",
    };

    const result = replaceParagraphWithCustomBlocks(
      block,
      "\u200B",
      new Map()
    );

    expect(result).toEqual([block]);
    expect(result?.[0]).toBe(block);
  });
});
