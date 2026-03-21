import type { ReferencesBlock } from "./types";

export const MARKER_TYPES = [
  "references",
  "projects-references",
  "areas-references",
  "goals-references",
  "vision-references",
  "purpose-references",
  "habits-references",
  "multiselect",
  "singleselect",
  "checkbox",
  "datetime",
  "projects-list",
  "areas-list",
  "goals-list",
  "visions-list",
  "habits-list",
  "actions-list",
  "projects-areas-list",
  "goals-areas-list",
  "visions-goals-list",
  "projects-and-areas-list",
  "goals-and-areas-list",
  "visions-and-goals-list",
] as const;

export const SKIPPED_LEGACY_MULTISELECT_TYPES = new Set([
  "status",
  "effort",
  "project-status",
]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MARKER_TYPE_PATTERN = MARKER_TYPES.map(escapeRegex).join("|");

export const GTD_FIELD_MARKER_PATTERN = new RegExp(
  `\\[!(?:${MARKER_TYPE_PATTERN})(?::[^\\]]*)?\\]`,
  "g"
);

export const MULTISELECT_MARKER_PATTERN = /\[!multiselect:([^:]+):([^\]]*)\]/g;
export const MULTISELECT_HTML_PATTERN =
  /<div\s+data-multiselect='([^']+)'\s+class="multiselect-block">([^<]+)<\/div>/g;

export const SINGLESELECT_MARKER_PATTERN = /\[!singleselect:([^:]+):([^\]]*)\]/g;
export const SINGLESELECT_HTML_PATTERN =
  /<div\s+data-singleselect='([^']+)'\s+class="singleselect-block">([^<]+)<\/div>/g;

export const CHECKBOX_MARKER_PATTERN = /\[!checkbox:([^:]+):([^\]]*)\]/g;
export const CHECKBOX_HTML_PATTERN =
  /<div\s+data-checkbox='([^']+)'\s+class="checkbox-block">([^<]+)<\/div>/g;

export const DATETIME_MARKER_PATTERN = /\[!datetime:([^:]+):([^\]]*)\]/g;
export const DATETIME_HTML_PATTERN =
  /<div\s+data-datetime='([^']+)'\s+class="datetime-block">([^<]+)<\/div>/g;

// Some legacy reference markers store array-like payloads such as `[]` or
// `["/path.md"]`, so we tolerate the extra trailing `]` needed to consume the
// full marker token during preprocessing.
export const REFERENCES_MARKER_PATTERN = /\[!references:([^\]]*)\]\]?/g;
export const AREAS_REFERENCES_PATTERN = /\[!areas-references:([^\]]*)\]\]?/g;
export const GOALS_REFERENCES_PATTERN = /\[!goals-references:([^\]]*)\]\]?/g;
export const VISION_REFERENCES_PATTERN = /\[!vision-references:([^\]]*)\]\]?/g;
export const PURPOSE_REFERENCES_PATTERN = /\[!purpose-references:([^\]]*)\]\]?/g;
export const PROJECTS_REFERENCES_PATTERN = /\[!projects-references:([^\]]*)\]\]?/g;
export const HABITS_REFERENCES_PATTERN = /\[!habits-references:([^\]]*)\]\]?/g;
export const REFERENCES_HTML_PATTERN =
  /<div\s+data-references='([^']+)'\s+class="references-block">([^<]+)<\/div>/g;

export const PROJECTS_LIST_PATTERN = /\[!projects-list\]/g;
export const AREAS_LIST_PATTERN = /\[!areas-list\]/g;
export const GOALS_LIST_PATTERN = /\[!goals-list\]/g;
export const VISIONS_LIST_PATTERN = /\[!visions-list\]/g;
export const HABITS_LIST_PATTERN = /\[!habits-list\]/g;
export const ACTIONS_LIST_PATTERN = /\[!actions-list(?::([^\]]*))?\]/g;
export const PROJECTS_AREAS_LIST_PATTERN = /\[!projects-areas-list\]/g;
export const GOALS_AREAS_LIST_PATTERN = /\[!goals-areas-list\]/g;
export const VISIONS_GOALS_LIST_PATTERN = /\[!visions-goals-list\]/g;
export const PROJECTS_AND_AREAS_LIST_PATTERN = /\[!projects-and-areas-list\]/g;
export const GOALS_AND_AREAS_LIST_PATTERN = /\[!goals-and-areas-list\]/g;
export const VISIONS_AND_GOALS_LIST_PATTERN = /\[!visions-and-goals-list\]/g;

export function createMarkerOnlyTokenRegex(): RegExp {
  return new RegExp(
    `\\[!(${MARKER_TYPE_PATTERN})(:[^\\]]*)?\\](?:\\])?`,
    "g"
  );
}

export function isReferenceMarkerKind(
  kind: string
): kind is ReferencesBlock["type"] {
  return (
    kind === "references" ||
    kind === "projects-references" ||
    kind === "areas-references" ||
    kind === "goals-references" ||
    kind === "vision-references" ||
    kind === "purpose-references" ||
    kind === "habits-references"
  );
}
