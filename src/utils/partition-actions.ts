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
  const open: MarkdownFile[] = [];
  const completed: MarkdownFile[] = [];
  const cancelled: MarkdownFile[] = [];

  for (const action of items) {
    if (excludeReadme && action.name.toLowerCase().includes('readme')) continue;
    const raw = metadata[action.path]?.status ?? statuses[action.path] ?? 'in-progress';
    const st = normalize(raw);
    if (st === 'completed') {
      completed.push(action);
      continue;
    }

    if (st === 'cancelled') {
      cancelled.push(action);
      continue;
    }

    open.push(action);
  }

  return { open, completed, cancelled };
}
