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
const LIST_KIND_META: Record<
  string,
  {
    listType: NonNullable<ListBlock["props"]["listType"]>;
    type: ListBlock["type"];
  }
> = {
  "projects-list": { listType: "projects", type: "projects-list" },
  "areas-list": { listType: "areas", type: "areas-list" },
  "goals-list": { listType: "goals", type: "goals-list" },
  "visions-list": { listType: "visions", type: "visions-list" },
  "habits-list": { listType: "habits", type: "habits-list" },
  "projects-areas-list": {
    listType: "projects-areas",
    type: "projects-areas-list",
  },
  "projects-and-areas-list": {
    listType: "projects-areas",
    type: "projects-areas-list",
  },
  "goals-areas-list": {
    listType: "goals-areas",
    type: "goals-areas-list",
  },
  "goals-and-areas-list": {
    listType: "goals-areas",
    type: "goals-areas-list",
  },
  "visions-goals-list": {
    listType: "visions-goals",
    type: "visions-goals-list",
  },
  "visions-and-goals-list": {
    listType: "visions-goals",
    type: "visions-goals-list",
  },
};

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

  const listMeta = LIST_KIND_META[kind];
  if (!listMeta) {
    return null;
  }

  return {
    type: listMeta.type,
    props: {
      listType: listMeta.listType,
    },
  };
}

export function createHabitStatusCheckbox(
  value: string,
  label: string = ""
): CheckboxBlock {
  const normalizedValue = value.trim().toLowerCase();
  return createCheckboxBlock(
    "habit-status",
    normalizedValue === "completed" ||
      normalizedValue === "complete" ||
      normalizedValue === "true",
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
    const normalizedChecked = checkedRaw.trim().toLowerCase();
    const checked =
      type === "habit-status"
        ? normalizedChecked === "true" ||
          normalizedChecked === "completed" ||
          normalizedChecked === "complete"
        : normalizedChecked === "true";

    return createCheckboxBlock(type, checked);
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
