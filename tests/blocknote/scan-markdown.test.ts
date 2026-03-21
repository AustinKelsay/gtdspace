import { beforeEach, describe, expect, it, vi } from "vitest";
import { scanMarkdownForCustomBlocks } from "@/utils/blocknote-preprocessing/scan-markdown";

describe("scanMarkdownForCustomBlocks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("recognizes canonical markers and normalizes list aliases", () => {
    const markdown = [
      "[!singleselect:status:in-progress]",
      "[!datetime:due_date:2026-03-21T09:30:00]",
      "[!references:/tmp/ref.md]",
      "[!actions-list:waiting]",
      "[!projects-and-areas-list]",
    ].join("\n");

    const result = scanMarkdownForCustomBlocks(markdown);

    expect(result.totalCustomBlocks).toBe(3);
    expect(result.hasReplacementBlocks).toBe(true);

    const statusEntry = result.replacementByText.get(
      "[!singleselect:status:in-progress]"
    );
    expect(statusEntry?.block).toMatchObject({
      type: "singleselect",
      props: {
        type: "status",
        value: "in-progress",
        label: "Status",
      },
    });

    const datetimeEntry = result.replacementByText.get(
      "[!datetime:due_date:2026-03-21T09:30:00]"
    );
    expect(datetimeEntry?.block).toMatchObject({
      type: "datetime",
      props: {
        type: "due_date",
        value: "2026-03-21T09:30:00",
      },
    });

    const actionsEntry = result.replacementByText.get("[!actions-list:waiting]");
    expect(actionsEntry?.block).toMatchObject({
      type: "actions-list",
      props: {
        statusFilter: "waiting",
      },
    });

    const referencesEntry = result.replacementByText.get(
      "[!references:/tmp/ref.md]"
    );
    expect(referencesEntry?.block).toMatchObject({
      type: "references",
      props: {
        references: "/tmp/ref.md",
      },
    });

    const aliasEntry = result.replacementByText.get("[!projects-and-areas-list]");
    expect(aliasEntry?.block).toMatchObject({
      type: "projects-areas-list",
      props: {
        listType: "projects-areas",
      },
    });
  });

  it("parses legacy html inputs and keeps exact-match checkbox conversion for habit status", () => {
    const markdown = [
      `<div data-singleselect='{"type":"habit-status","value":"completed","label":"Habit Status"}' class="singleselect-block">Habit Status: completed</div>`,
      `<div data-multiselect='{"type":"contexts","value":["home","desk"],"label":"Contexts"}' class="multiselect-block">Contexts: home, desk</div>`,
      `<div data-references='{"references":"/tmp/a.md,/tmp/b.md"}' class="references-block">refs</div>`,
    ].join("\n");

    const result = scanMarkdownForCustomBlocks(markdown);

    const singleselectHtml =
      `<div data-singleselect='{"type":"habit-status","value":"completed","label":"Habit Status"}' class="singleselect-block">Habit Status: completed</div>`;
    const singleselectEntry = result.replacementByText.get(singleselectHtml);
    expect(singleselectEntry?.block).toMatchObject({
      type: "singleselect",
      props: {
        type: "habit-status",
        value: "completed",
      },
    });
    expect(singleselectEntry?.exactMatchBlock).toMatchObject({
      type: "checkbox",
      props: {
        type: "habit-status",
        checked: true,
      },
    });

    const multiselectHtml =
      `<div data-multiselect='{"type":"contexts","value":["home","desk"],"label":"Contexts"}' class="multiselect-block">Contexts: home, desk</div>`;
    expect(result.replacementByText.get(multiselectHtml)?.block).toMatchObject({
      type: "multiselect",
      props: {
        type: "contexts",
        value: "home,desk",
        label: "Contexts",
      },
    });

    const referencesHtml =
      `<div data-references='{"references":"/tmp/a.md,/tmp/b.md"}' class="references-block">refs</div>`;
    expect(result.replacementByText.get(referencesHtml)?.block).toMatchObject({
      type: "references",
      props: {
        references: "/tmp/a.md,/tmp/b.md",
      },
    });
  });

  it("preserves valid escaped quotes in legacy json before attempting recovery parsing", () => {
    const markdown =
      `<div data-singleselect='{"type":"status","value":"quoted \\"text\\"","label":"Status"}' class="singleselect-block">Status</div>`;

    const result = scanMarkdownForCustomBlocks(markdown);

    expect(result.replacementByText.get(markdown)?.block).toMatchObject({
      type: "singleselect",
      props: {
        type: "status",
        value: 'quoted "text"',
        label: "Status",
      },
    });
  });

  it("skips legacy multiselect status markers", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = scanMarkdownForCustomBlocks(
      "[!multiselect:status:in-progress]"
    );

    expect(result.totalCustomBlocks).toBe(0);
    expect(result.hasReplacementBlocks).toBe(false);
    expect(result.replacementByText.size).toBe(0);
    expect(console.warn).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      'Legacy multiselect type "status" found in markdown. Skipping.'
    );
  });

  it("marks list-only markdown as having replacement blocks", () => {
    const result = scanMarkdownForCustomBlocks("[!actions-list:waiting]");

    expect(result.totalCustomBlocks).toBe(0);
    expect(result.hasReplacementBlocks).toBe(true);
    expect(result.replacementByText.get("[!actions-list:waiting]")?.block).toMatchObject({
      type: "actions-list",
      props: {
        statusFilter: "waiting",
      },
    });
  });
});
