import type { McpServerLogLevel } from '@/types';

export const MCP_RESOURCES = [
  'gtdspace://spec/gtd-spec',
  'gtdspace://spec/markdown-schema',
  'gtdspace://spec/architecture',
  'gtdspace://workspace/context.json',
  'gtdspace://workspace/context.md',
] as const;

export const READ_TOOLS = [
  'workspace_info',
  'workspace_refresh',
  'workspace_list_items',
  'workspace_search',
  'workspace_get_item',
  'workspace_get_relationships',
  'workspace_read_markdown',
  'habit_get_history',
  'google_calendar_list_events',
] as const;

export const PLANNING_TOOLS = [
  'project_create',
  'project_update',
  'project_rename',
  'action_create',
  'action_update',
  'action_rename',
  'habit_create',
  'habit_update_status',
  'habit_write_history_entry',
  'habit_replace_history',
  'horizon_page_create',
  'horizon_page_update',
  'reference_note_create',
  'reference_note_update',
] as const;

export const LIFECYCLE_TOOLS = ['change_apply', 'change_discard'] as const;

export const LOG_LEVEL_OPTIONS: Array<{
  value: McpServerLogLevel;
  label: string;
  description: string;
}> = [
  { value: 'error', label: 'Error', description: 'Only failures' },
  { value: 'warn', label: 'Warn', description: 'Warnings and errors' },
  { value: 'info', label: 'Info', description: 'Recommended default' },
  { value: 'debug', label: 'Debug', description: 'Verbose local troubleshooting' },
  { value: 'trace', label: 'Trace', description: 'Maximum diagnostics' },
];

export const FIELD_IDS = {
  workspace: 'mcp-server-workspace',
  readOnly: 'mcp-server-read-only',
  logLevel: 'mcp-server-log-level',
} as const;

export type WorkspaceResolutionSource =
  | 'override'
  | 'resolved'
  | 'last-folder'
  | 'default-space'
  | 'platform-default'
  | 'unavailable';

export type InvokeWithHandling = <T>(
  command: string,
  args?: Record<string, unknown>,
  options?: { errorMessage?: string }
) => Promise<T | null>;

const isWindowsPlatform = () => {
  const navigatorWithUserAgentData = globalThis.navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform =
    navigatorWithUserAgentData?.userAgentData?.platform ??
    globalThis.navigator?.platform ??
    globalThis.navigator?.userAgent ??
    '';
  return /win/i.test(platform);
};

export const shellQuote = (value: string) => {
  if (isWindowsPlatform()) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return `"${value.replace(/["\\$`]/g, '\\$&')}"`;
};

export const getWorkspaceResolutionLabel = (source: WorkspaceResolutionSource) => {
  switch (source) {
    case 'override':
      return 'MCP workspace override';
    case 'resolved':
      return 'Resolved GTD workspace ancestor';
    case 'last-folder':
      return 'Last opened workspace';
    case 'default-space':
      return 'Preferred GTD workspace';
    case 'platform-default':
      return 'Platform default GTD Space path';
    default:
      return 'Unavailable';
  }
};
