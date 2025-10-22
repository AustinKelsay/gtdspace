import type { GTDActionStatus } from '@/types';

// Normalize various free-form status strings into a canonical set
// Returned union matches GTDActionStatus and is also suitable for projects
export const normalizeStatus = (status?: string | null): GTDActionStatus => {
  if (!status) return 'in-progress';

  const normalized = status.toLowerCase().trim().replace(/[\s_]+/g, '-');
  switch (normalized) {
    case 'completed':
    case 'complete':
    case 'done':
      return 'completed';
    case 'waiting':
    case 'wait':
    case 'blocked':
    case 'on-hold':
    case 'waiting-for':
      return 'waiting';
    case 'cancelled':
    case 'canceled':
    case 'cancel':
      return 'cancelled';
    case 'in-progress':
    case 'inprogress':
    case 'active':
    case 'doing':
    case 'planning':
    case 'not-started':
    case 'todo':
    default:
      return 'in-progress';
  }
};

