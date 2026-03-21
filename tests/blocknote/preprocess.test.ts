import { beforeEach, describe, expect, it, vi } from "vitest";
import { preprocessMarkdownForBlockNote } from "@/utils/blocknote-preprocessing/preprocess";

describe("preprocessMarkdownForBlockNote", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces legacy multiselect html with placeholders", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    const result = preprocessMarkdownForBlockNote(
      `<div data-multiselect='{"type":"contexts","value":["home"]}' class="multiselect-block">Contexts: home</div>`
    );

    expect(result).toMatch(/\{\{MULTISELECT_\d+_[a-z0-9]+\}\}/i);
  });

  it("leaves invalid multiselect html untouched", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const input =
      `<div data-multiselect='{"type":' class="multiselect-block">bad</div>`;

    const result = preprocessMarkdownForBlockNote(input);

    expect(result).toBe(input);
  });
});
