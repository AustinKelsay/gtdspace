import {
  CheckCircle2,
  Circle,
  CircleDot,
  XCircle,
} from 'lucide-react';
import { normalizeStatus } from '@/utils/gtd-status';
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
  if (!path) return null;
  return path.replace(/\\/g, '/').toLowerCase();
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
    const dt = new Date(trimmed);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const dt = new Date(year, month, day);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dt = new Date(trimmed);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export const sortMarkdownFiles = (files: MarkdownFile[]): MarkdownFile[] =>
  [...files].sort((a, b) =>
    a.name.replace(/\.md$/i, '').localeCompare(b.name.replace(/\.md$/i, ''))
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

export const getDisplayName = (name: string): string => name.replace(/\.md$/i, '');

export const buildSectionPath = (
  rootPath: string | null | undefined,
  sectionPath: string
): string => {
  const base = (rootPath ?? '').replace(/[\\/]+$/, '');
  if (!base) return sectionPath;
  const separator = base.includes('\\') ? '\\' : '/';
  return `${base}${separator}${sectionPath}`;
};

export const createCalendarFile = (): MarkdownFile => ({
  id: '::calendar::',
  name: 'Calendar',
  path: '::calendar::',
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
}: {
  searchQuery: string;
  projects: GTDProject[];
  projectActions: Record<string, MarkdownFile[]>;
  sectionFiles: Record<string, MarkdownFile[]>;
  sections: GTDSection[];
  rootPath: string | null;
}): SidebarSearchResults | null => {
  if (!searchQuery) return null;

  const query = searchQuery.toLowerCase();
  const results: SidebarSearchResults = {
    projects: projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        (project.description || '').toLowerCase().includes(query)
    ),
    actions: [],
    sections: [],
  };

  Object.entries(projectActions).forEach(([projectPath, actions]) => {
    const matches = actions.filter((action) =>
      getDisplayName(action.name).toLowerCase().includes(query)
    );

    if (matches.length > 0) {
      const projectName = getFolderName(projectPath) || projectPath;
      results.actions.push({ project: projectName, actions: matches });
    }
  });

  sections.forEach((section) => {
    if (section.id === 'calendar' || section.id === 'projects') return;

    const sectionPath = buildSectionPath(rootPath, section.path);
    const matches = (sectionFiles[sectionPath] || []).filter((file) =>
      getDisplayName(file.name).toLowerCase().includes(query)
    );

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
    const status = normalizeStatus(
      projectMetadata[project.path]?.status || project.status || 'in-progress'
    );
    (status === 'completed' ? completed : active).push(project);
  });

  return [active, completed];
};

export const getProjectDisplay = (
  project: GTDProject,
  metadata: Record<string, SidebarProjectMetadata>
) => {
  const overlay = metadata[project.path];
  return {
    title: overlay?.title || project.name,
    path: overlay?.currentPath || project.path,
    status: overlay?.status || project.status || 'in-progress',
    dueDate: overlay?.due_date ?? project.dueDate ?? '',
  };
};

export const getActionDisplay = (
  action: MarkdownFile,
  metadata: Record<string, SidebarActionMetadata>,
  statuses: Record<string, string>
) => {
  const overlay = metadata[action.path];
  return {
    title: overlay?.title || getDisplayName(action.name),
    path: overlay?.currentPath || action.path,
    status: overlay?.status || statuses[action.path] || 'in-progress',
    dueDate: overlay?.due_date || '',
  };
};

export const getSectionFileDisplay = (
  file: MarkdownFile,
  metadata: Record<string, SidebarSectionFileMetadata>
) => {
  const overlay = metadata[file.path];
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
    ? files.filter((file) => file.name.toLowerCase() !== 'readme.md')
    : files;
