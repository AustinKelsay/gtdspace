import type { McpServerLogLevel } from '@/types';

export const VALID_MCP_LOG_LEVELS: readonly McpServerLogLevel[] = [
  'error',
  'warn',
  'info',
  'debug',
  'trace',
] as const;

export const normalizeMcpServerWorkspacePath = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === '/' || /^[A-Za-z]:[\\/]?$/.test(trimmed)) {
    return trimmed.length === 2 ? `${trimmed}\\` : trimmed;
  }
  return trimmed.replace(/[\\/]+$/, '');
};

export const getParentMcpWorkspacePath = (value: string): string | null => {
  const normalized = normalizeMcpServerWorkspacePath(value);
  if (!normalized || normalized === '/' || /^[A-Za-z]:[\\/]$/.test(normalized)) {
    return null;
  }

  const lastSeparator = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (lastSeparator < 0) {
    return null;
  }
  if (lastSeparator === 0) {
    return normalized[0];
  }

  const parent = normalized.slice(0, lastSeparator);
  if (/^[A-Za-z]:$/.test(parent)) {
    const separator = normalized.includes('\\') ? '\\' : '/';
    return `${parent}${separator}`;
  }

  return parent;
};

export const getMcpWorkspaceAncestors = (value: string): string[] => {
  const ancestors: string[] = [];
  let current = normalizeMcpServerWorkspacePath(value);

  while (current) {
    ancestors.push(current);
    const parent = getParentMcpWorkspacePath(current);
    if (!parent || parent === current) {
      break;
    }
    current = parent;
  }

  return ancestors;
};

export const coerceMcpServerReadOnlyLike = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', 'on', '1'].includes(normalized)) {
      return true;
    }
    if (['false', 'no', 'n', 'off', '0'].includes(normalized)) {
      return false;
    }
    return null;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  return null;
};
