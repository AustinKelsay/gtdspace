export type HorizonType = "purpose" | "vision" | "goals" | "areas";

export interface HorizonConfig {
  /** Display name used in UI copy (e.g., Goals). */
  label: string;
  /** Folder name relative to the workspace root. */
  folderName: string;
  /** Canonical singleselect token inserted into README headers. */
  altitudeToken: HorizonType;
  /** Human-friendly altitude label (e.g., 20,000 ft). */
  altitudeLabel: string;
  /** Default review cadence token (single-select). */
  defaultCadence: "on-demand" | "monthly" | "quarterly" | "annually";
  /** Reference token inserted into README metadata. */
  referenceToken: string;
  /** Metadata key used by the extractor for the reference token. */
  referenceMetadataKey: string;
  /** Markdown list token rendered inside the README. */
  listToken: string;
  /** Short description/tagline explaining the horizon. */
  description: string;
  /** Structured copy seeds for README sections. */
  copy: {
    why: string;
    how: string;
    overview: string;
  };
}

export const HORIZON_CONFIG: Record<HorizonType, HorizonConfig> = {
  purpose: {
    label: "Purpose & Principles",
    folderName: "Purpose & Principles",
    altitudeToken: "purpose",
    altitudeLabel: "50,000 ft",
    defaultCadence: "on-demand",
    referenceToken: "purpose-references",
    referenceMetadataKey: "purposeReferences",
    listToken: "purpose-list",
    description: "Core values and life mission (50,000 ft)",
    copy: {
      why: "Capture your mission, values, and principles so every other horizon inherits clear decision filters. Writing them down keeps long-range choices aligned with what matters most.",
      how: "Use dedicated Purpose pages for core statements or principle sets. Link active goals or projects via the reference picker, and revisit this horizon whenever you feel a major pivot coming.",
      overview: "The list below reflects every Purpose & Principles page stored in this folder. Create more as your understanding evolves—GTD Space will keep this list synced automatically.",
    },
  },
  vision: {
    label: "Vision",
    folderName: "Vision",
    altitudeToken: "vision",
    altitudeLabel: "40,000 ft",
    defaultCadence: "annually",
    referenceToken: "vision-references",
    referenceMetadataKey: "visionReferences",
    listToken: "vision-list",
    description: "3–5 year aspirations (40,000 ft)",
    copy: {
      why: "Describe the vivid picture of life and work 3–5 years out so medium-term goals have a clear destination.",
      how: "Create a Vision page for each major narrative or pillar. Select the horizon duration, link the goals and areas it influences, and reflect annually or when strategy shifts.",
      overview: "All Vision narratives you add to this folder appear here. Expand the sidebar Vision row to jump into an individual page.",
    },
  },
  goals: {
    label: "Goals",
    folderName: "Goals",
    altitudeToken: "goals",
    altitudeLabel: "30,000 ft",
    defaultCadence: "quarterly",
    referenceToken: "goals-references",
    referenceMetadataKey: "goalsReferences",
    listToken: "goals-list",
    description: "1–2 year objectives (30,000 ft)",
    copy: {
      why: "Goals translate your vision into 12–24 month outcomes that focus your projects and habits.",
      how: "Each Goal page tracks status, target date, and supporting projects/areas. Review quarterly so you can adjust commitments and surface blocked work.",
      overview: "This list mirrors every Goal file in the folder. Add or rename goals and GTD Space will update the table of contents automatically.",
    },
  },
  areas: {
    label: "Areas of Focus",
    folderName: "Areas of Focus",
    altitudeToken: "areas",
    altitudeLabel: "20,000 ft",
    defaultCadence: "monthly",
    referenceToken: "areas-references",
    referenceMetadataKey: "areasReferences",
    listToken: "areas-list",
    description: "Ongoing responsibilities (20,000 ft)",
    copy: {
      why: "Areas represent ongoing responsibilities (roles, domains) that never finish but require balanced attention.",
      how: "Track status and review cadence for each Area, then link supporting projects, goals, or visions. Run a quick scan monthly to catch imbalances early.",
      overview: "Every Area page in this folder is listed here. Consider grouping areas by life vs. work when naming the files for easier scanning.",
    },
  },
};

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect the horizon type based on a file path.
 */
export function detectHorizonTypeFromPath(filePath?: string | null): HorizonType | null {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, '/');
  for (const [type, config] of Object.entries(HORIZON_CONFIG)) {
    const pattern = new RegExp(`/${escapeForRegex(config.folderName)}/README\\.md$`, 'i');
    if (pattern.test(normalized)) {
      return type as HorizonType;
    }
  }
  return null;
}
