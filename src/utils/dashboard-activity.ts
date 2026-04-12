import type { ActionItem } from '@/hooks/useActionsData';
import type { HabitWithHistory } from '@/hooks/useHabitsHistory';
import type { ProjectWithMetadata } from '@/hooks/useProjectsData';
import type { HorizonFile } from '@/hooks/useHorizonsRelationships';
import { toISOStringFromEpoch } from '@/utils/time';

export type DashboardActivityEntityType = 'project' | 'action' | 'habit' | 'horizon';
export type DashboardActivityType = 'created' | 'updated' | 'completed';

export interface DashboardActivityItem {
  id: string;
  entityType: DashboardActivityEntityType;
  activityType: DashboardActivityType;
  title: string;
  path: string;
  timestamp: string;
  context?: string;
  horizonLevel?: string;
}

type ActivityCandidate = DashboardActivityItem & {
  timestampMs: number;
};

const MAX_ACTIVITY_ITEMS = 10;
const RECENT_ACTIVITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const parseTimestamp = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseHabitTimestamp = (date?: string, time?: string): number | null => {
  if (!date) {
    return null;
  }

  if (!time || !time.trim()) {
    return Date.parse(`${date}T00:00:00`);
  }

  const trimmed = time.trim();
  const twentyFourHourMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    const [, hours, minutes] = twentyFourHourMatch;
    return Date.parse(`${date}T${hours.padStart(2, '0')}:${minutes}:00`);
  }

  const meridiemMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (meridiemMatch) {
    const [, rawHours, minutes, meridiem] = meridiemMatch;
    let hours = Number(rawHours) % 12;
    if (meridiem.toUpperCase() === 'PM') {
      hours += 12;
    }
    return Date.parse(`${date}T${String(hours).padStart(2, '0')}:${minutes}:00`);
  }

  const fallback = Date.parse(`${date} ${trimmed}`);
  return Number.isNaN(fallback) ? null : fallback;
};

const toRecentCandidate = (
  item: Omit<ActivityCandidate, 'timestampMs'>,
  timestampMs: number | null
): ActivityCandidate | null => {
  if (timestampMs === null || Number.isNaN(timestampMs)) {
    return null;
  }

  if (Date.now() - timestampMs > RECENT_ACTIVITY_WINDOW_MS) {
    return null;
  }

  return {
    ...item,
    timestampMs,
  };
};

const buildActionActivity = (action: ActionItem): ActivityCandidate | null => {
  const createdMs = parseTimestamp(action.createdDate);
  const modifiedMs = parseTimestamp(action.modifiedDate) ?? createdMs;
  const latestMs = modifiedMs ?? createdMs;

  if (latestMs === null) {
    return null;
  }

  const activityType: DashboardActivityType =
    action.status === 'completed' && modifiedMs !== null
      ? 'completed'
      : modifiedMs !== null && createdMs !== null && modifiedMs > createdMs
        ? 'updated'
        : 'created';

  return toRecentCandidate({
    id: `action:${action.path}`,
    entityType: 'action',
    activityType,
    title: action.name,
    path: action.path,
    timestamp: new Date(latestMs).toISOString(),
    context: action.projectName ? `Action in ${action.projectName}` : 'Action',
  }, latestMs);
};

const buildProjectActivity = (project: ProjectWithMetadata): ActivityCandidate | null => {
  const createdMs = parseTimestamp(project.createdDateTime);
  const modifiedMs = parseTimestamp(project.modifiedDate) ?? createdMs;
  const latestMs = modifiedMs ?? createdMs;

  if (latestMs === null) {
    return null;
  }

  const activityType: DashboardActivityType =
    project.status === 'completed' && modifiedMs !== null
      ? 'completed'
      : modifiedMs !== null && createdMs !== null && modifiedMs > createdMs
        ? 'updated'
        : 'created';

  return toRecentCandidate({
    id: `project:${project.path}`,
    entityType: 'project',
    activityType,
    title: project.name,
    path: project.path,
    timestamp: new Date(latestMs).toISOString(),
    context: 'Project',
  }, latestMs);
};

const buildHabitActivity = (habit: HabitWithHistory): ActivityCandidate | null => {
  const latestCompletionMs = habit.periodHistory
    .filter((entry) => entry.completed)
    .map((entry) => parseHabitTimestamp(entry.date, entry.time))
    .filter((value): value is number => value !== null)
    .sort((a, b) => b - a)[0] ?? null;

  if (latestCompletionMs !== null) {
    return toRecentCandidate({
      id: `habit:${habit.path}`,
      entityType: 'habit',
      activityType: 'completed',
      title: habit.name,
      path: habit.path,
      timestamp: new Date(latestCompletionMs).toISOString(),
      context: 'Habit',
    }, latestCompletionMs);
  }

  const createdMs = parseTimestamp(habit.createdDateTime);
  const updatedMs = parseTimestamp(habit.last_updated) ?? createdMs;
  const latestMs = updatedMs ?? createdMs;

  if (latestMs === null) {
    return null;
  }

  const activityType: DashboardActivityType =
    updatedMs !== null && createdMs !== null && updatedMs > createdMs
      ? 'updated'
      : 'created';

  return toRecentCandidate({
    id: `habit:${habit.path}`,
    entityType: 'habit',
    activityType,
    title: habit.name,
    path: habit.path,
    timestamp: new Date(latestMs).toISOString(),
    context: 'Habit',
  }, latestMs);
};

const buildHorizonActivity = (file: HorizonFile): ActivityCandidate | null => {
  const createdMs = parseTimestamp(file.createdDateTime);
  const modifiedMs = typeof file.last_modified === 'number'
    ? parseTimestamp(toISOStringFromEpoch(file.last_modified))
    : null;
  const latestMs = modifiedMs ?? createdMs;

  if (latestMs === null) {
    return null;
  }

  const displayTitle = file.name.replace(/\.(md|markdown)$/i, '');
  const activityType: DashboardActivityType =
    modifiedMs !== null && createdMs !== null && modifiedMs > createdMs
      ? 'updated'
      : 'created';

  return toRecentCandidate({
    id: `horizon:${file.path}`,
    entityType: 'horizon',
    activityType,
    title: displayTitle,
    path: file.path,
    timestamp: new Date(latestMs).toISOString(),
    context: file.horizonLevel,
    horizonLevel: file.horizonLevel,
  }, latestMs);
};

export const buildDashboardActivityFeed = (params: {
  actions: ActionItem[];
  projects: ProjectWithMetadata[];
  habits: HabitWithHistory[];
  horizonFiles: HorizonFile[];
}): DashboardActivityItem[] => {
  const items = [
    ...params.actions.map(buildActionActivity),
    ...params.projects.map(buildProjectActivity),
    ...params.habits.map(buildHabitActivity),
    ...params.horizonFiles
      .filter((file) => file.horizonLevel !== 'Projects')
      .map(buildHorizonActivity),
  ]
    .filter((item): item is ActivityCandidate => item !== null)
    .sort((a, b) => b.timestampMs - a.timestampMs)
    .slice(0, MAX_ACTIVITY_ITEMS);

  return items.map(({ timestampMs: _timestampMs, ...item }) => item);
};
