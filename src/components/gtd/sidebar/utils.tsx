import {
  CheckCircle2,
  Circle,
  CircleDot,
  XCircle,
} from 'lucide-react';
import { normalizeStatus } from '@/utils/gtd-status';
import { norm } from '@/utils/path';
import { CALENDAR_FILE_ID } from '@/utils/special-files';
import type { GTDProject, MarkdownFile } from '@/types';
import type {
  GTDSection,
  SidebarActionMetadata,
  SidebarProjectMetadata,
  SidebarSearchResults,
  SidebarSectionFileMetadata,
} from './types';

export const getFolderName = (fullPath: string): string => {
  const segments = fullPath.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] ?? '';
};

export const normalizePath = (path?: string | null): string | null => {
  return norm(path) ?? null;
};

export const isPathDescendant = (
  parent?: string | null,
  candidate?: string | null
): boolean => {
  const normParent = normalizePath(parent);
  const normCandidate = normalizePath(candidate);
  if (!normParent || !normCandidate) return false;
  const parentWithSlash = normParent.endsWith('/') ? normParent : `${normParent}/`;
  return normCandidate === normParent || normCandidate.startsWith(parentWithSlash);
};

export function parseLocalDateString(dateStr: string): Date | null {
  const trimmed = dateStr?.trim();
  if (!trimmed) return null;
  if (/\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const match = trimmed.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (!match) return null;
    const dt = new Date(trimmed);
    if (Number.isNaN(dt.getTime())) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hours = Number(match[4]);
    const minutes = Number(match[5]);
    const seconds = Number(match[6] || '0');
    if (
      dt.getUTCFullYear() !== year ||
      dt.getUTCMonth() + 1 !== month ||
      dt.getUTCDate() !== day ||
      dt.getUTCHours() !== hours ||
      dt.getUTCMinutes() !== minutes ||
      dt.getUTCSeconds() !== seconds
    ) {
      return null;
    }
    return dt;
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const dt = new Date(year, month, day);
    if (
      Number.isNaN(dt.getTime()) ||
      dt.getFullYear() !== year ||
      dt.getMonth() !== month ||
      dt.getDate() !== day
    ) {
      return null;
    }
    return dt;
  }

  const dt = new Date(trimmed);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export const sortMarkdownFiles = (files: MarkdownFile[]): MarkdownFile[] =>
  [...files].sort((a, b) =>
    a.name
      .replace(/\.(?:md|markdown)$/i, '')
      .localeCompare(b.name.replace(/\.(?:md|markdown)$/i, ''))
  );

export const getStatusColorClass = (statusInput: string): string => {
  switch (normalizeStatus(statusInput)) {
    case 'completed':
      return 'text-green-600 dark:text-green-500';
    case 'waiting':
      return 'text-purple-600 dark:text-purple-500';
    case 'in-progress':
      return 'text-blue-600 dark:text-blue-500';
    case 'cancelled':
      return 'text-red-600 dark:text-red-500';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

export const getStatusIcon = (statusInput: string) => {
  switch (normalizeStatus(statusInput)) {
    case 'completed':
      return CheckCircle2;
    case 'waiting':
      return CircleDot;
    case 'cancelled':
      return XCircle;
    case 'in-progress':
    default:
      return Circle;
  }
};

export const getDisplayName = (name: string): string => name.replace(/\.(?:md|markdown)$/i, '');

export const buildSectionPath = (
  rootPath: string | null | undefined,
  sectionPath: string
): string => {
  const base = (rootPath ?? '').replace(/[\\/]+$/, '');
  if (!base) return norm(sectionPath) ?? sectionPath;
  const separator = base.includes('\\') ? '\\' : '/';
  return norm(`${base}${separator}${sectionPath}`) ?? `${base}${separator}${sectionPath}`;
};

export const buildSectionPathCandidates = (
  rootPath: string | null | undefined,
  section: Pick<GTDSection, 'path' | 'aliases'>
): string[] => {
  const candidates = [section.path, ...(section.aliases ?? [])]
    .map((candidate) => buildSectionPath(rootPath, candidate));
  return [...new Set(candidates)];
};

export const createCalendarFile = (): MarkdownFile => ({
  id: CALENDAR_FILE_ID,
  name: 'Calendar',
  path: CALENDAR_FILE_ID,
  size: 0,
  last_modified: Math.floor(Date.now() / 1000),
  extension: 'calendar',
});

export const buildSidebarSearchResults = ({
  searchQuery,
  projects,
  projectActions,
  sectionFiles,
  sections,
  rootPath,
  projectMetadata,
  actionMetadata,
  actionStatuses,
  sectionFileMetadata,
}: {
  searchQuery: string;
  projects: GTDProject[];
  projectActions: Record<string, MarkdownFile[]>;
  sectionFiles: Record<string, MarkdownFile[]>;
  sections: GTDSection[];
  rootPath: string | null;
  projectMetadata: Record<string, SidebarProjectMetadata>;
  actionMetadata: Record<string, SidebarActionMetadata>;
  actionStatuses: Record<string, string>;
  sectionFileMetadata: Record<string, SidebarSectionFileMetadata>;
}): SidebarSearchResults | null => {
  if (!searchQuery) return null;

  const query = searchQuery.toLowerCase();
  const results: SidebarSearchResults = {
    projects: projects.filter(
      (project) => {
        const display = getProjectDisplay(project, projectMetadata);
        return (
          display.title.toLowerCase().includes(query) ||
          (project.description || '').toLowerCase().includes(query)
        );
      }
    ),
    actions: [],
    sections: [],
  };

  Object.entries(projectActions).forEach(([projectPath, actions]) => {
    const matches = actions.filter((action) => {
      const display = getActionDisplay(action, actionMetadata, actionStatuses);
      return display.title.toLowerCase().includes(query);
    });

    if (matches.length > 0) {
      const project = projects.find((candidate) => normalizePath(candidate.path) === normalizePath(projectPath));
      const projectName = project
        ? getProjectDisplay(project, projectMetadata).title
        : getFolderName(projectPath) || projectPath;
      results.actions.push({
        project: projectName,
        projectPath: normalizePath(projectPath) ?? projectPath,
        actions: matches,
      });
    }
  });

  sections.forEach((section) => {
    if (section.id === 'calendar' || section.id === 'projects') return;

    const sectionPaths = buildSectionPathCandidates(rootPath, section);
    const sectionPath = sectionPaths.find((candidate) => sectionFiles[candidate]) ?? sectionPaths[0];
    const matches = (sectionFiles[sectionPath] || []).filter((file) => {
      const display = getSectionFileDisplay(file, sectionFileMetadata);
      return display.title.toLowerCase().includes(query);
    });

    if (matches.length > 0) {
      results.sections.push({ section, files: matches });
    }
  });

  return results;
};

export const partitionProjectsByCompletion = ({
  projects,
  projectMetadata,
}: {
  projects: GTDProject[];
  projectMetadata: Record<string, SidebarProjectMetadata>;
}): [GTDProject[], GTDProject[]] => {
  const active: GTDProject[] = [];
  const completed: GTDProject[] = [];

  projects.forEach((project) => {
    const projectKey = norm(project.path) ?? project.path;
    const status = normalizeStatus(
      projectMetadata[projectKey]?.status || project.status || 'in-progress'
    );
    (status === 'completed' ? completed : active).push(project);
  });

  return [active, completed];
};

export const getProjectDisplay = (
  project: GTDProject,
  metadata: Record<string, SidebarProjectMetadata>
) => {
  const overlay = metadata[norm(project.path) ?? project.path];
  const hasOverlayDueDate =
    overlay != null && Object.prototype.hasOwnProperty.call(overlay, 'due_date');
  return {
    title: overlay?.title || project.name,
    path: overlay?.currentPath || project.path,
    status: overlay?.status || project.status || 'in-progress',
    dueDate: hasOverlayDueDate ? overlay?.due_date ?? '' : project.dueDate ?? '',
  };
};

export const getActionDisplay = (
  action: MarkdownFile,
  metadata: Record<string, SidebarActionMetadata>,
  statuses: Record<string, string>
) => {
  const key = norm(action.path) ?? action.path;
  const overlay = metadata[key];
  return {
    title: overlay?.title || getDisplayName(action.name),
    path: overlay?.currentPath || action.path,
    status: overlay?.status || statuses[key] || 'in-progress',
    dueDate: overlay?.due_date || '',
  };
};

export const getSectionFileDisplay = (
  file: MarkdownFile,
  metadata: Record<string, SidebarSectionFileMetadata>
) => {
  const overlay = metadata[norm(file.path) ?? file.path];
  return {
    title: overlay?.title || getDisplayName(file.name),
    path: overlay?.currentPath || file.path,
  };
};

export const isHorizonSection = (sectionId: string): boolean =>
  sectionId === 'areas' ||
  sectionId === 'goals' ||
  sectionId === 'vision' ||
  sectionId === 'purpose';

export const filterVisibleSectionFiles = (
  sectionId: string,
  files: MarkdownFile[]
): MarkdownFile[] =>
  isHorizonSection(sectionId)
    ? files.filter((file) => !['readme.md', 'readme.markdown'].includes(file.name.toLowerCase()))
    : files;
