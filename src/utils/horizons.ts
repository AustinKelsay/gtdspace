import type { HorizonFile } from '@/hooks/useHorizonsRelationships';

export type ProjectLike = {
  path: string;
  name: string;
  status?: string;
  dueDate?: string;
  description?: string;
  actionStats?: { total: number } | null;
};

/**
 * Merge project metadata (status, dueDate, description, action counts) into
 * horizon files for the Projects level. Files are matched by README path.
 */
export function mergeProjectInfoIntoHorizonFiles(
  files: Array<HorizonFile>,
  projects: Array<ProjectLike>
): Array<HorizonFile & { action_count?: number; description?: string; status?: string; dueDate?: string }> {
  if (!files || files.length === 0 || !projects || projects.length === 0) return files;

  const projectMap = new Map<string, ProjectLike>();
  projects.forEach((p) => {
    const readmePath = `${p.path}/README.md`;
    projectMap.set(readmePath, p);
  });

  return files.map((f) => {
    const p = projectMap.get(f.path);
    if (!p) return f;

    const merged: HorizonFile & {
      action_count?: number;
      description?: string;
      status?: string;
      dueDate?: string;
    } = {
      ...f,
      action_count: p.actionStats?.total ?? undefined,
      // prefer project description, then existing file description/content preview
      description: p.description ?? (f as unknown as { description?: string }).description ?? f.content,
    };

    if (p.status) merged.status = p.status;
    if (p.dueDate) merged.dueDate = p.dueDate;

    return merged;
  });
}
