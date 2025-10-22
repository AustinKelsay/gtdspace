import type { MarkdownFile } from '@/types';

type StatusNormalizer = (status: string) => string;

interface PartitionOptions {
  metadata?: Record<string, { status?: string }>;
  statuses?: Record<string, string>;
  normalize: StatusNormalizer;
  excludeReadme?: boolean;
}

export function partitionActions(
  items: MarkdownFile[],
  { metadata = {}, statuses = {}, normalize, excludeReadme = true }: PartitionOptions
) {
  const active: MarkdownFile[] = [];
  const completed: MarkdownFile[] = [];

  for (const action of items) {
    if (excludeReadme && action.name.toLowerCase().includes('readme')) continue;
    const raw = metadata[action.path]?.status ?? statuses[action.path] ?? 'in-progress';
    const st = normalize(raw);
    (st === 'completed' ? completed : active).push(action);
  }

  return { active, completed };
}

