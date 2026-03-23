import {
  ACTIONS_LIST_PATTERN,
  AREAS_LIST_PATTERN,
  AREAS_REFERENCES_PATTERN,
  CHECKBOX_HTML_PATTERN,
  CHECKBOX_MARKER_PATTERN,
  DATETIME_HTML_PATTERN,
  DATETIME_MARKER_PATTERN,
  GOALS_AND_AREAS_LIST_PATTERN,
  GOALS_AREAS_LIST_PATTERN,
  GOALS_LIST_PATTERN,
  GOALS_REFERENCES_PATTERN,
  HABITS_LIST_PATTERN,
  HABITS_REFERENCES_PATTERN,
  MULTISELECT_HTML_PATTERN,
  MULTISELECT_MARKER_PATTERN,
  PROJECTS_AND_AREAS_LIST_PATTERN,
  PROJECTS_AREAS_LIST_PATTERN,
  PROJECTS_LIST_PATTERN,
  PROJECTS_REFERENCES_PATTERN,
  PURPOSE_LIST_PATTERN,
  PURPOSE_REFERENCES_PATTERN,
  REFERENCES_HTML_PATTERN,
  REFERENCES_MARKER_PATTERN,
  SINGLESELECT_HTML_PATTERN,
  SINGLESELECT_MARKER_PATTERN,
  VISION_REFERENCES_PATTERN,
  VISIONS_AND_GOALS_LIST_PATTERN,
  VISIONS_GOALS_LIST_PATTERN,
  VISIONS_LIST_PATTERN,
} from "./marker-patterns";
import {
  createCheckboxBlock,
  createDatetimeBlock,
  createHabitStatusCheckbox,
  createListBlock,
  createMultiselectBlock,
  createReferencesBlock,
  createReplacementEntry,
  createSingleselectBlock,
  labelForMultiselectType,
  labelForSingleselectType,
  shouldSkipLegacyMultiselectType,
} from "./marker-to-block";
import type { ReplacementEntry, ScannedMarkdown } from "./types";

function parseLegacyJson(rawJson: string): unknown | null {
  try {
    return JSON.parse(rawJson);
  } catch {
    try {
      return JSON.parse(rawJson.replace(/\\"/g, '"'));
    } catch {
      return null;
    }
  }
}

function registerReplacement(
  replacementByText: Map<string, ReplacementEntry>,
  entry: ReplacementEntry
): void {
  if (!replacementByText.has(entry.text.trim())) {
    replacementByText.set(entry.text.trim(), entry);
  }
}

function scanMarkerMatches(
  markdown: string,
  pattern: RegExp,
  visitor: (match: RegExpExecArray) => void
): void {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    visitor(match);
  }
  pattern.lastIndex = 0;
}

export function scanMarkdownForCustomBlocks(markdown: string): ScannedMarkdown {
  const replacementByText = new Map<string, ReplacementEntry>();
  // Preserve the old debug semantics: this counts scanned non-list custom tokens,
  // not unique replacement entries after de-duplication by exact text.
  let totalCustomBlocks = 0;

  scanMarkerMatches(markdown, MULTISELECT_MARKER_PATTERN, (match) => {
    const type = match[1];
    if (shouldSkipLegacyMultiselectType(type)) {
      console.warn(`Legacy multiselect type "${type}" found in markdown. Skipping.`);
      return;
    }

    registerReplacement(
      replacementByText,
      createReplacementEntry(
        match[0],
        createMultiselectBlock(type, match[2].split(","), labelForMultiselectType(type))
      )
    );
    totalCustomBlocks += 1;
  });

  scanMarkerMatches(markdown, MULTISELECT_HTML_PATTERN, (match) => {
    const parsed = parseLegacyJson(match[1]);
    if (!parsed || typeof parsed !== "object") {
      console.error("Error parsing multiselect data:", new Error("Invalid JSON"), "JSON string:", match[1]);
      return;
    }

    const data = parsed as { type?: string; value?: unknown; label?: string };
    const type = data.type || "tags";
    if (shouldSkipLegacyMultiselectType(type)) {
      console.warn(`Legacy multiselect type "${type}" found in HTML. Skipping.`);
      return;
    }

    registerReplacement(
      replacementByText,
      createReplacementEntry(
        match[0],
        createMultiselectBlock(
          type,
          Array.isArray(data.value)
            ? data.value.map((value) => String(value))
            : typeof data.value === "string"
              ? [data.value]
              : [],
          data.label || ""
        )
      )
    );
    totalCustomBlocks += 1;
  });

  scanMarkerMatches(markdown, SINGLESELECT_MARKER_PATTERN, (match) => {
    const type = match[1];
    const value = match[2];
    registerReplacement(
      replacementByText,
      createReplacementEntry(
        match[0],
        createSingleselectBlock(type, value, labelForSingleselectType(type)),
        type === "habit-status" ? createHabitStatusCheckbox(value) : undefined
      )
    );
    totalCustomBlocks += 1;
  });

  scanMarkerMatches(markdown, SINGLESELECT_HTML_PATTERN, (match) => {
    const parsed = parseLegacyJson(match[1]);
    if (!parsed || typeof parsed !== "object") {
      console.error("Error parsing singleselect data:", new Error("Invalid JSON"), "JSON string:", match[1]);
      return;
    }

    const data = parsed as { type?: string; value?: string; label?: string };
    const type = data.type || "status";
    const value = data.value || "";
    registerReplacement(
      replacementByText,
      createReplacementEntry(
        match[0],
        createSingleselectBlock(type, value, data.label || ""),
        type === "habit-status" ? createHabitStatusCheckbox(value, data.label || "") : undefined
      )
    );
    totalCustomBlocks += 1;
  });

  scanMarkerMatches(markdown, CHECKBOX_MARKER_PATTERN, (match) => {
    registerReplacement(
      replacementByText,
      createReplacementEntry(
        match[0],
        createCheckboxBlock(match[1], match[2] === "true")
      )
    );
    totalCustomBlocks += 1;
  });

  scanMarkerMatches(markdown, CHECKBOX_HTML_PATTERN, (match) => {
    const parsed = parseLegacyJson(match[1]);
    if (!parsed || typeof parsed !== "object") {
      console.error("Error parsing checkbox data:", new Error("Invalid JSON"), "JSON string:", match[1]);
      return;
    }

    const data = parsed as { type?: string; checked?: boolean; label?: string };
    registerReplacement(
      replacementByText,
      createReplacementEntry(
        match[0],
        createCheckboxBlock(data.type || "habit-status", data.checked || false, data.label || "")
      )
    );
    totalCustomBlocks += 1;
  });

  scanMarkerMatches(markdown, DATETIME_MARKER_PATTERN, (match) => {
    registerReplacement(
      replacementByText,
      createReplacementEntry(
        match[0],
        createDatetimeBlock(match[1], match[2])
      )
    );
    totalCustomBlocks += 1;
  });

  scanMarkerMatches(markdown, DATETIME_HTML_PATTERN, (match) => {
    const parsed = parseLegacyJson(match[1]);
    if (!parsed || typeof parsed !== "object") {
      console.error("Error parsing datetime data:", new Error("Invalid JSON"), "JSON string:", match[1]);
      return;
    }

    const data = parsed as { type?: string; value?: string; label?: string };
    registerReplacement(
      replacementByText,
      createReplacementEntry(
        match[0],
        createDatetimeBlock((data.type ?? "due_date") as string, data.value ?? "", data.label || "")
      )
    );
    totalCustomBlocks += 1;
  });

  const referencePatterns: Array<{
    pattern: RegExp;
    type:
      | "references"
      | "areas-references"
      | "goals-references"
      | "vision-references"
      | "purpose-references"
      | "projects-references"
      | "habits-references";
  }> = [
    { pattern: REFERENCES_MARKER_PATTERN, type: "references" },
    { pattern: AREAS_REFERENCES_PATTERN, type: "areas-references" },
    { pattern: GOALS_REFERENCES_PATTERN, type: "goals-references" },
    { pattern: VISION_REFERENCES_PATTERN, type: "vision-references" },
    { pattern: PURPOSE_REFERENCES_PATTERN, type: "purpose-references" },
    { pattern: PROJECTS_REFERENCES_PATTERN, type: "projects-references" },
    { pattern: HABITS_REFERENCES_PATTERN, type: "habits-references" },
  ];

  for (const referencePattern of referencePatterns) {
    scanMarkerMatches(markdown, referencePattern.pattern, (match) => {
      registerReplacement(
        replacementByText,
        createReplacementEntry(
          match[0],
          createReferencesBlock(referencePattern.type, match[1])
        )
      );
      totalCustomBlocks += 1;
    });
  }

  scanMarkerMatches(markdown, REFERENCES_HTML_PATTERN, (match) => {
    const parsed = parseLegacyJson(match[1]);
    if (!parsed || typeof parsed !== "object") {
      console.error("Error parsing references data:", new Error("Invalid JSON"), "JSON string:", match[1]);
      return;
    }

    const data = parsed as { references?: string };
    registerReplacement(
      replacementByText,
      createReplacementEntry(
        match[0],
        createReferencesBlock("references", data.references || "")
      )
    );
    totalCustomBlocks += 1;
  });

  const listPatterns: Array<{ pattern: RegExp; type: string }> = [
    { pattern: PROJECTS_LIST_PATTERN, type: "projects-list" },
    { pattern: AREAS_LIST_PATTERN, type: "areas-list" },
    { pattern: GOALS_LIST_PATTERN, type: "goals-list" },
    { pattern: VISIONS_LIST_PATTERN, type: "vision-list" },
    { pattern: PURPOSE_LIST_PATTERN, type: "purpose-list" },
    { pattern: HABITS_LIST_PATTERN, type: "habits-list" },
    { pattern: PROJECTS_AREAS_LIST_PATTERN, type: "projects-areas-list" },
    { pattern: GOALS_AREAS_LIST_PATTERN, type: "goals-areas-list" },
    { pattern: VISIONS_GOALS_LIST_PATTERN, type: "visions-goals-list" },
    { pattern: PROJECTS_AND_AREAS_LIST_PATTERN, type: "projects-and-areas-list" },
    { pattern: GOALS_AND_AREAS_LIST_PATTERN, type: "goals-and-areas-list" },
    { pattern: VISIONS_AND_GOALS_LIST_PATTERN, type: "visions-and-goals-list" },
  ];

  for (const listPattern of listPatterns) {
    scanMarkerMatches(markdown, listPattern.pattern, (match) => {
      const listBlock = createListBlock(listPattern.type);
      if (!listBlock) return;

      registerReplacement(
        replacementByText,
        createReplacementEntry(match[0], listBlock)
      );
    });
  }

  scanMarkerMatches(markdown, ACTIONS_LIST_PATTERN, (match) => {
    const listBlock = createListBlock("actions-list", match[1] || "");
    if (!listBlock) return;

    registerReplacement(
      replacementByText,
      createReplacementEntry(match[0], listBlock)
    );
  });

  return {
    replacementByText,
    totalCustomBlocks,
    hasReplacementBlocks: replacementByText.size > 0,
  };
}
