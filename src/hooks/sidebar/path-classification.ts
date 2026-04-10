import type { GTDSection } from '@/components/gtd/sidebar/types';
import { GTD_SECTIONS } from '@/components/gtd/sidebar/constants';
import type { SidebarPathMatch } from '@/hooks/sidebar/types';
import { norm, isUnder } from '@/utils/path';

const MARKDOWN_FILE_PATTERN = /\.(md|markdown)$/i;
const README_FILE_PATTERN = /\/README\.(md|markdown)$/i;

function getSidebarSections(): GTDSection[] {
  return GTD_SECTIONS.filter(
    (section) => section.id !== 'calendar' && section.id !== 'projects'
  );
}

export function normalizeSidebarPath(path?: string | null): string | null {
  return norm(path) ?? null;
}

export const normalizePath = normalizeSidebarPath;

export function buildSectionPath(
  rootPath: string | null | undefined,
  sectionPath: string
): string {
  const base = (rootPath ?? '').replace(/[\\/]+$/, '');
  if (!base) return normalizeSidebarPath(sectionPath) ?? sectionPath;
  const separator = base.includes('\\') ? '\\' : '/';
  return normalizeSidebarPath(`${base}${separator}${sectionPath}`) ?? `${base}${separator}${sectionPath}`;
}

export function buildSectionPathCandidates(
  rootPath: string | null | undefined,
  section: Pick<GTDSection, 'path' | 'aliases'>
): string[] {
  const candidates = [section.path, ...(section.aliases ?? [])]
    .map((candidate) => buildSectionPath(rootPath, candidate));
  return [...new Set(candidates)];
}

export function getSectionPathVariants(
  sectionId: string,
  rootPath?: string | null
): string[] {
  const section = GTD_SECTIONS.find((candidate) => candidate.id === sectionId);
  if (!section) {
    return [];
  }

  const names = Array.from(new Set([section.path, ...(section.aliases ?? [])]));
  return names.map((name) => {
    if (rootPath) {
      return buildSectionPath(rootPath, name);
    }
    return normalizeSidebarPath(`/${name}/`) ?? `/${name}/`;
  });
}

export function getCombinedSectionPathVariants(
  sectionIds: readonly string[],
  rootPath?: string | null
): string[] {
  return sectionIds.flatMap((sectionId) => getSectionPathVariants(sectionId, rootPath));
}

export function isReadmePath(path?: string | null): boolean {
  const normalizedPath = normalizeSidebarPath(path);
  return normalizedPath ? README_FILE_PATTERN.test(normalizedPath) : false;
}

export function extractParentFolder(path?: string | null): string | null {
  const normalizedPath = normalizeSidebarPath(path);
  if (!normalizedPath) return null;
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    return null;
  }
  return normalizedPath.slice(0, lastSlashIndex);
}

export function extractProjectPathFromReadme(path?: string | null): string | null {
  if (!isReadmePath(path)) {
    return null;
  }
  return extractParentFolder(path);
}

function getProjectSectionRoot(rootPath?: string | null): string | null {
  const projectsSection = GTD_SECTIONS.find((section) => section.id === 'projects');
  if (!projectsSection) {
    return rootPath ? buildSectionPath(rootPath, 'Projects') : '/Projects';
  }
  return buildSectionPath(rootPath, projectsSection.path);
}

function extractProjectPathFromAction(
  path?: string | null,
  rootPath?: string | null
): string | null {
  const normalizedPath = normalizeSidebarPath(path);
  if (!normalizedPath) {
    return null;
  }

  if (rootPath) {
    const projectRoot = getProjectSectionRoot(rootPath);
    if (!projectRoot || !isUnder(normalizedPath, projectRoot)) {
      return null;
    }
    const relative = normalizedPath.slice(projectRoot.length).replace(/^\/+/, '');
    const firstSegment = relative.split('/')[0];
    if (!firstSegment) {
      return null;
    }
    return normalizeSidebarPath(`${projectRoot}/${firstSegment}`) ?? `${projectRoot}/${firstSegment}`;
  }

  const match = normalizedPath.match(/^(.*\/Projects\/[^/]+)\//i);
  return match?.[1] ?? null;
}

export function inferSectionContextFromPath(
  normalizedPath: string
): { root: string | null; section: GTDSection } | null {
  for (const section of getSidebarSections()) {
    const candidateNames = Array.from(new Set([section.path, ...(section.aliases ?? [])]));
    for (const candidateName of candidateNames) {
      const marker = `/${candidateName}`;
      const markerIndex = normalizedPath.lastIndexOf(marker);
      if (markerIndex < 0) {
        continue;
      }

      const nextChar = normalizedPath[markerIndex + marker.length];
      if (nextChar !== undefined && nextChar !== '/') {
        continue;
      }

      const inferredRoot = normalizedPath.slice(0, markerIndex) || null;
      return { root: inferredRoot, section };
    }
  }

  return null;
}

function resolveSectionPathMatch(
  normalizedPath: string,
  rootPath?: string | null
): { section: GTDSection; sectionPath: string } | null {
  if (rootPath) {
    for (const section of getSidebarSections()) {
      const candidatePaths = buildSectionPathCandidates(rootPath, section);
      for (const candidatePath of candidatePaths) {
        if (isUnder(normalizedPath, candidatePath)) {
          const sectionPath = extractParentFolder(normalizedPath);
          if (!sectionPath) {
            return null;
          }
          return { section, sectionPath };
        }
      }
    }
  }

  const inferred = inferSectionContextFromPath(normalizedPath);
  if (!inferred) {
    return null;
  }

  const sectionPath = extractParentFolder(normalizedPath);
  if (!sectionPath) {
    return null;
  }

  return { section: inferred.section, sectionPath };
}

export function isProjectReadmePath(
  path?: string | null,
  rootPath?: string | null
): boolean {
  const normalizedPath = normalizeSidebarPath(path);
  if (!normalizedPath || !isReadmePath(normalizedPath)) {
    return false;
  }

  if (rootPath) {
    const projectRoot = getProjectSectionRoot(rootPath);
    return Boolean(projectRoot && isUnder(normalizedPath, projectRoot));
  }

  return /\/Projects\/.+\/README\.(md|markdown)$/i.test(normalizedPath);
}

export function isProjectActionPath(
  path?: string | null,
  rootPath?: string | null
): boolean {
  const normalizedPath = normalizeSidebarPath(path);
  if (!normalizedPath || !MARKDOWN_FILE_PATTERN.test(normalizedPath) || isReadmePath(normalizedPath)) {
    return false;
  }

  if (rootPath) {
    const projectRoot = getProjectSectionRoot(rootPath);
    return Boolean(projectRoot && isUnder(normalizedPath, projectRoot));
  }

  return /\/Projects\/.+\.(md|markdown)$/i.test(normalizedPath);
}

export function isSectionFilePath(
  path?: string | null,
  rootPath?: string | null
): boolean {
  const normalizedPath = normalizeSidebarPath(path);
  if (!normalizedPath || !MARKDOWN_FILE_PATTERN.test(normalizedPath)) {
    return false;
  }

  return resolveSectionPathMatch(normalizedPath, rootPath) !== null;
}

export function matchesSectionPathVariants(
  path?: string | null,
  sectionIds: readonly string[] = [],
  rootPath?: string | null
): boolean {
  const normalizedPath = normalizeSidebarPath(path);
  if (!normalizedPath) {
    return false;
  }

  return getCombinedSectionPathVariants(sectionIds, rootPath).some((candidate) =>
    isUnder(normalizedPath, candidate)
  );
}

export function classifySidebarPath(
  path?: string | null,
  rootPath?: string | null
): SidebarPathMatch {
  const normalizedPath = normalizeSidebarPath(path);
  if (!normalizedPath) {
    return { kind: 'other', normalizedPath: '' };
  }

  if (isProjectReadmePath(normalizedPath, rootPath)) {
    return {
      kind: 'project-readme',
      normalizedPath,
      projectPath: extractProjectPathFromReadme(normalizedPath) ?? undefined,
    };
  }

  if (isProjectActionPath(normalizedPath, rootPath)) {
    return {
      kind: 'project-action',
      normalizedPath,
      projectPath: extractProjectPathFromAction(normalizedPath, rootPath) ?? undefined,
    };
  }

  const sectionMatch = resolveSectionPathMatch(normalizedPath, rootPath);
  if (sectionMatch) {
    return {
      kind: 'section-file',
      normalizedPath,
      sectionId: sectionMatch.section.id,
      sectionPath: sectionMatch.sectionPath,
    };
  }

  return { kind: 'other', normalizedPath };
}
