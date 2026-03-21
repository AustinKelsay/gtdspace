export type TextChild =
  | string
  | {
      text?: string;
      type?: string;
      styles?: { italic?: boolean; bold?: boolean };
    };

export interface UnknownBlock {
  id?: string;
  type: string;
  content?: unknown;
  props?: Record<string, unknown>;
}

export interface ParagraphBlock {
  type: "paragraph";
  content?: TextChild[] | string;
  props?: Record<string, unknown>;
}

export interface MultiselectBlock {
  type: "multiselect";
  props: {
    type: string;
    value: string;
    label: string;
    placeholder: string;
    maxCount: number;
    customOptionsJson: string;
  };
}

export interface SingleselectBlock {
  type: "singleselect";
  props: {
    type: string;
    value: string;
    label: string;
    placeholder: string;
    customOptionsJson: string;
  };
}

export interface CheckboxBlock {
  type: "checkbox";
  props: {
    type: string;
    checked: boolean;
    label: string;
  };
}

export interface DatetimeBlock {
  type: "datetime";
  props: {
    type: string;
    value: string;
    label: string;
    optional: boolean;
  };
}

export interface ReferencesBlock {
  type:
    | "references"
    | "projects-references"
    | "areas-references"
    | "goals-references"
    | "vision-references"
    | "purpose-references"
    | "habits-references";
  props: {
    references: string;
  };
}

export interface ListBlock {
  type:
    | "projects-list"
    | "areas-list"
    | "goals-list"
    | "visions-list"
    | "habits-list"
    | "projects-areas-list"
    | "goals-areas-list"
    | "visions-goals-list"
    | "actions-list";
  props: {
    listType?: string;
    statusFilter?: string;
    currentPath?: string;
  };
}

export type ProcessedBlock =
  | UnknownBlock
  | ParagraphBlock
  | MultiselectBlock
  | SingleselectBlock
  | CheckboxBlock
  | DatetimeBlock
  | ReferencesBlock
  | ListBlock;

export interface ReplacementEntry {
  text: string;
  block: ProcessedBlock;
  exactMatchBlock?: ProcessedBlock;
}

export interface ScannedMarkdown {
  replacementByText: Map<string, ReplacementEntry>;
  totalCustomBlocks: number;
  hasReplacementBlocks: boolean;
}
