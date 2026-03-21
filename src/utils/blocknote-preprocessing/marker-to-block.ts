import {
  SKIPPED_LEGACY_MULTISELECT_TYPES,
  isReferenceMarkerKind,
} from "./marker-patterns";
import type {
  CheckboxBlock,
  DatetimeBlock,
  ListBlock,
  MultiselectBlock,
  ProcessedBlock,
  ReferencesBlock,
  ReplacementEntry,
  SingleselectBlock,
} from "./types";

const EMPTY_OPTIONS_JSON = "[]";

export function cloneProcessedBlock<T extends ProcessedBlock>(block: T): T {
  if (!("props" in block) || !block.props) {
    return { ...block };
  }

  return {
    ...block,
    props: { ...block.props },
  };
}

export function createMultiselectBlock(
  type: string,
  value: string[] | string,
  label: string = ""
): MultiselectBlock {
  return {
    type: "multiselect",
    props: {
      type,
      value: Array.isArray(value) ? value.join(",") : value,
      label,
      placeholder: "",
      maxCount: 0,
      customOptionsJson: EMPTY_OPTIONS_JSON,
    },
  };
}

export function createSingleselectBlock(
  type: string,
  value: string,
  label: string = ""
): SingleselectBlock {
  return {
    type: "singleselect",
    props: {
      type,
      value,
      label,
      placeholder: "",
      customOptionsJson: EMPTY_OPTIONS_JSON,
    },
  };
}

export function createCheckboxBlock(
  type: string,
  checked: boolean,
  label: string = ""
): CheckboxBlock {
  return {
    type: "checkbox",
    props: {
      type,
      checked,
      label,
    },
  };
}

export function createDatetimeBlock(
  type: string,
  value: string,
  label: string = ""
): DatetimeBlock {
  return {
    type: "datetime",
    props: {
      type,
      value,
      label,
      optional: true,
    },
  };
}

export function createReferencesBlock(
  type: ReferencesBlock["type"],
  references: string
): ReferencesBlock {
  return {
    type,
    props: {
      references,
    },
  };
}

export function createListBlock(
  kind: string,
  statusFilter: string = ""
): ListBlock | null {
  if (kind === "actions-list") {
    return {
      type: "actions-list",
      props: statusFilter ? { statusFilter } : {},
    };
  }

  const listType =
    kind === "projects-list"
      ? "projects"
      : kind === "areas-list"
        ? "areas"
        : kind === "goals-list"
          ? "goals"
          : kind === "visions-list"
            ? "visions"
            : kind === "habits-list"
              ? "habits"
              : kind === "projects-areas-list" || kind === "projects-and-areas-list"
                ? "projects-areas"
                : kind === "goals-areas-list" || kind === "goals-and-areas-list"
                  ? "goals-areas"
                  : kind === "visions-goals-list" || kind === "visions-and-goals-list"
                    ? "visions-goals"
                    : null;

  if (!listType) {
    return null;
  }

  const blockType =
    kind === "projects-and-areas-list"
      ? "projects-areas-list"
      : kind === "goals-and-areas-list"
        ? "goals-areas-list"
        : kind === "visions-and-goals-list"
          ? "visions-goals-list"
          : (kind as ListBlock["type"]);

  return {
    type: blockType,
    props: {
      listType,
    },
  };
}

export function createHabitStatusCheckbox(
  value: string,
  label: string = ""
): CheckboxBlock {
  return createCheckboxBlock(
    "habit-status",
    value === "completed" || value === "true",
    label
  );
}

export function createReplacementEntry(
  text: string,
  block: ProcessedBlock,
  exactMatchBlock?: ProcessedBlock
): ReplacementEntry {
  return {
    text,
    block,
    exactMatchBlock,
  };
}

export function buildExactMatchBlock(entry: ReplacementEntry): ProcessedBlock {
  return cloneProcessedBlock(entry.exactMatchBlock ?? entry.block);
}

function splitMarkerRestLegacy(rest: string): [string, string] {
  const separatorIndex = rest.indexOf(":");
  if (separatorIndex === -1) {
    return [rest || "", ""];
  }

  return [
    rest.slice(0, separatorIndex) || "",
    rest.slice(separatorIndex + 1) || "",
  ];
}

export function buildMarkerOnlyBlock(
  kind: string,
  rest: string
): ProcessedBlock | null {
  if (isReferenceMarkerKind(kind)) {
    return createReferencesBlock(kind, rest || "");
  }

  if (kind === "singleselect") {
    const [type, value] = splitMarkerRestLegacy(rest);
    return createSingleselectBlock(type, value);
  }

  if (kind === "multiselect") {
    const [type, value] = splitMarkerRestLegacy(rest);
    return createMultiselectBlock(type, value);
  }

  if (kind === "datetime") {
    const [type, value] = splitMarkerRestLegacy(rest);
    return createDatetimeBlock(type, value);
  }

  if (kind === "checkbox") {
    const [type, checkedRaw] = splitMarkerRestLegacy(rest);
    return createCheckboxBlock(type, checkedRaw === "true");
  }

  return createListBlock(kind, rest || "");
}

export function labelForMultiselectType(type: string): string {
  return type === "tags"
    ? "Tags"
    : type === "contexts"
      ? "Contexts"
      : type === "categories"
        ? "Categories"
        : "";
}

export function labelForSingleselectType(type: string): string {
  return type === "status"
    ? "Status"
    : type === "effort"
      ? "Effort"
      : type === "project-status"
        ? "Project Status"
        : "";
}

export function shouldSkipLegacyMultiselectType(type: string): boolean {
  return SKIPPED_LEGACY_MULTISELECT_TYPES.has(type);
}
