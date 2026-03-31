import React from 'react';
import {
  BookOpenText,
  Copy,
  FolderOpen,
  Info,
  Server,
  Shield,
  TerminalSquare,
  Wrench,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { McpServerLogLevel } from '@/types';
import { getMcpWorkspaceAncestors } from '@/utils/mcp-settings';
import { checkTauriContextAsync } from '@/utils/tauri-ready';

const MCP_RESOURCES = [
  'gtdspace://spec/gtd-spec',
  'gtdspace://spec/markdown-schema',
  'gtdspace://spec/architecture',
  'gtdspace://workspace/context.json',
  'gtdspace://workspace/context.md',
  'gtdspace://item/<workspace-relative-path>',
] as const;

const READ_TOOLS = [
  'workspace_info',
  'workspace_refresh',
  'workspace_list_items',
  'workspace_search',
  'workspace_get_item',
  'workspace_get_relationships',
  'workspace_read_markdown',
] as const;

const PLANNING_TOOLS = [
  'project_create',
  'project_update',
  'project_rename',
  'action_create',
  'action_update',
  'action_rename',
  'habit_create',
  'habit_update_status',
  'horizon_page_create',
  'horizon_page_update',
  'reference_note_create',
  'reference_note_update',
] as const;

const LIFECYCLE_TOOLS = ['change_apply', 'change_discard'] as const;

const LOG_LEVEL_OPTIONS: Array<{
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

const FIELD_IDS = {
  workspace: 'mcp-server-workspace',
  readOnly: 'mcp-server-read-only',
  logLevel: 'mcp-server-log-level',
} as const;

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

const shellQuote = (value: string) => {
  if (isWindowsPlatform()) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return `"${value.replace(/["\\$`]/g, '\\$&')}"`;
};

const getWorkspaceResolutionLabel = (source: 'override' | 'resolved' | 'last-folder' | 'default-space' | 'platform-default' | 'unavailable') => {
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

type InvokeWithHandling = <T>(
  command: string,
  args?: Record<string, unknown>,
  options?: { errorMessage?: string }
) => Promise<T | null>;

const isValidWorkspaceCandidate = async (
  path: string,
  invokeWithHandling: InvokeWithHandling
) => {
  for (const candidate of getMcpWorkspaceAncestors(path)) {
    const isValid = await invokeWithHandling<boolean>(
      'check_is_gtd_space',
      { path: candidate },
      { errorMessage: 'Failed to validate the MCP workspace path.' }
    );

    if (isValid === null) {
      return null;
    }

    if (isValid) {
      return candidate;
    }
  }

  return false;
};

const DetailCard: React.FC<{
  label: string;
  value: string;
  muted?: boolean;
}> = ({ label, value, muted = false }) => (
  <div className="rounded-lg border bg-muted/20 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </p>
    <p className={cn('mt-2 text-sm font-medium break-words', muted && 'text-muted-foreground')}>
      {value}
    </p>
  </div>
);

const CodeBlock: React.FC<{
  label: string;
  value: string;
  onCopy: () => void;
}> = ({ label, value, onCopy }) => (
  <div className="rounded-lg border bg-muted/20 p-4">
    <div className="mb-2 flex items-center justify-between gap-3">
      <p className="text-sm font-medium">{label}</p>
      <Button variant="outline" size="sm" onClick={onCopy}>
        <Copy className="mr-2 h-4 w-4" />
        Copy
      </Button>
    </div>
    <pre className="overflow-x-auto rounded-md bg-background px-3 py-2 text-xs leading-6">
      <code>{value}</code>
    </pre>
  </div>
);

const ToolChipSection: React.FC<{
  title: string;
  description: string;
  items: readonly string[];
}> = ({ title, description, items }) => (
  <div className="space-y-3">
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <code
          key={item}
          className="rounded-md border bg-muted/20 px-2.5 py-1 text-xs"
        >
          {item}
        </code>
      ))}
    </div>
  </div>
);

export const McpServerSettings: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const { withErrorHandling } = useErrorHandler();
  const [workspaceDraft, setWorkspaceDraft] = React.useState(settings.mcp_server_workspace_path ?? '');
  const [platformDefaultPath, setPlatformDefaultPath] = React.useState<string | null>(null);
  const [isBrowsingWorkspace, setIsBrowsingWorkspace] = React.useState(false);
  const [isCheckingWorkspace, setIsCheckingWorkspace] = React.useState(false);
  const [resolvedWorkspaceIsValid, setResolvedWorkspaceIsValid] = React.useState<boolean | null>(null);
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const workspaceValidationRequestRef = React.useRef(0);

  const invokeWithHandling = React.useCallback(async <T,>(
    command: string,
    args?: Record<string, unknown>,
    options?: {
      errorMessage?: string;
      fallback?: T | null;
    }
  ): Promise<T | null> => {
    const fallback = options?.fallback ?? null;
    const result = await withErrorHandling(async () => {
      const inTauri = await checkTauriContextAsync();
      if (!inTauri) {
        return fallback;
      }

      const core = await import('@tauri-apps/api/core');
      const response = await core.invoke<T>(command, args);
      return (response ?? fallback) as T | null;
    }, options?.errorMessage ?? 'An error occurred', 'mcp-server-settings');

    return result ?? fallback;
  }, [withErrorHandling]);

  React.useEffect(() => {
    setWorkspaceDraft(settings.mcp_server_workspace_path ?? '');
  }, [settings.mcp_server_workspace_path]);

  React.useEffect(() => {
    const loadPlatformDefault = async () => {
      const result = await invokeWithHandling<string>(
        'get_default_gtd_space_path',
        undefined,
        { errorMessage: 'Failed to load the platform default MCP workspace path.' }
      );
      setPlatformDefaultPath(result);
    };

    void loadPlatformDefault();
  }, [invokeWithHandling]);

  const workspaceOverride = settings.mcp_server_workspace_path?.trim() || null;
  const defaultLogLevel = settings.mcp_server_log_level ?? 'info';
  const readOnlyDefault = settings.mcp_server_read_only ?? false;

  const fallbackWorkspaceCandidates = React.useMemo(
    () => [
      settings.last_folder?.trim() || null,
      settings.default_space_path?.trim() || null,
      platformDefaultPath?.trim() || null,
    ]
      .filter((path): path is string => Boolean(path))
      .map((path) => {
        if (path === settings.last_folder?.trim()) {
          return { path, source: 'last-folder' as const };
        }
        if (path === settings.default_space_path?.trim()) {
          return { path, source: 'default-space' as const };
        }
        return { path, source: 'platform-default' as const };
      }),
    [platformDefaultPath, settings.default_space_path, settings.last_folder]
  );

  const [workspaceResolution, setWorkspaceResolution] = React.useState<{
    path: string | null;
    source: 'override' | 'resolved' | 'last-folder' | 'default-space' | 'platform-default' | 'unavailable';
  }>({ path: null, source: 'unavailable' });

  React.useEffect(() => {
    const requestId = workspaceValidationRequestRef.current + 1;
    workspaceValidationRequestRef.current = requestId;
    let isActive = true;

    const validateWorkspace = async () => {
      if (workspaceOverride) {
        setWorkspaceResolution({ path: workspaceOverride, source: 'override' });
        setIsCheckingWorkspace(true);
        setValidationError(null);
        const resolvedPath = await isValidWorkspaceCandidate(workspaceOverride, invokeWithHandling);

        if (!isActive || workspaceValidationRequestRef.current !== requestId) {
          return;
        }

        if (resolvedPath === null) {
          setResolvedWorkspaceIsValid(null);
          setValidationError(null);
          setIsCheckingWorkspace(false);
          return;
        }

        if (resolvedPath) {
          setWorkspaceResolution({ path: resolvedPath, source: 'resolved' });
        }
        setResolvedWorkspaceIsValid(Boolean(resolvedPath));
        setValidationError(resolvedPath ? null : 'Workspace path is not a valid GTD space');
        setIsCheckingWorkspace(false);
        return;
      }

      if (fallbackWorkspaceCandidates.length === 0) {
        setWorkspaceResolution({ path: null, source: 'unavailable' });
        setIsCheckingWorkspace(false);
        setResolvedWorkspaceIsValid(null);
        setValidationError(null);
        return;
      }

      setIsCheckingWorkspace(true);
      setValidationError(null);

      for (const candidate of fallbackWorkspaceCandidates) {
        const isValid = await isValidWorkspaceCandidate(candidate.path, invokeWithHandling);
        if (!isActive || workspaceValidationRequestRef.current !== requestId) {
          return;
        }

        if (isValid === null) {
          setWorkspaceResolution({ path: null, source: 'unavailable' });
          setResolvedWorkspaceIsValid(null);
          setValidationError(null);
          setIsCheckingWorkspace(false);
          return;
        }

        if (isValid) {
          setWorkspaceResolution({ ...candidate, path: isValid });
          setResolvedWorkspaceIsValid(true);
          setValidationError(null);
          setIsCheckingWorkspace(false);
          return;
        }
      }

      setWorkspaceResolution({ path: null, source: 'unavailable' });
      setResolvedWorkspaceIsValid(false);
      setValidationError('Workspace path is not a valid GTD space');
      setIsCheckingWorkspace(false);
    };

    void validateWorkspace();

    return () => {
      isActive = false;
    };
  }, [fallbackWorkspaceCandidates, invokeWithHandling, workspaceOverride]);

  const persistWorkspaceOverride = React.useCallback(async (nextValue: string) => {
    await updateSettings({
      mcp_server_workspace_path: nextValue.trim() || null,
    });
  }, [updateSettings]);

  const handleWorkspaceBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    await persistWorkspaceOverride(event.target.value);
  };

  const handleBrowseWorkspace = async () => {
    setIsBrowsingWorkspace(true);
    try {
      const selected = await invokeWithHandling<string>(
        'select_folder',
        undefined,
        { errorMessage: 'Failed to browse for an MCP workspace folder.' }
      );
      if (!selected) {
        return;
      }

      setWorkspaceDraft(selected);
      await persistWorkspaceOverride(selected);
    } finally {
      setIsBrowsingWorkspace(false);
    }
  };

  const handleClearWorkspaceOverride = async () => {
    setWorkspaceDraft('');
    await persistWorkspaceOverride('');
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied to clipboard',
        description: `${label} is ready to paste.`,
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: error instanceof Error ? error.message : 'Clipboard access was unavailable.',
        variant: 'destructive',
      });
    }
  };

  const explicitArgs: string[] = [];
  if (workspaceResolution.path) {
    explicitArgs.push(`--workspace ${shellQuote(workspaceResolution.path)}`);
  }
  if (readOnlyDefault) {
    explicitArgs.push('--read-only');
  } else {
    explicitArgs.push('--read-only=false');
  }
  explicitArgs.push(`--log-level ${defaultLogLevel}`);

  const npmSavedDefaultsCommand = 'npm run mcp:dev --';
  const npmPinnedCommand = `npm run mcp:dev -- ${explicitArgs.join(' ')}`.trim();
  const cargoPinnedCommand = `cargo run --manifest-path src-tauri/mcp-server/Cargo.toml -- ${explicitArgs.join(' ')}`.trim();

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">MCP Server</CardTitle>
              </div>
              <CardDescription className="max-w-3xl">
                GTD Space exposes a standalone stdio MCP server for local-model clients. It reuses
                the app&apos;s GTD-aware backend, stays bound to a single workspace for the life of the
                process, and keeps context-pack cache files outside your workspace.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">gtdspace-mcp</Badge>
              <Badge variant="outline">stdio transport</Badge>
              <Badge variant="outline">1 workspace / process</Badge>
              <Badge variant="outline">dry-run + apply writes</Badge>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              When a client omits flags, the standalone server now inherits the defaults configured
              here. Workspace resolution order is: MCP override, last opened workspace, preferred
              GTD workspace, then the platform default <code>~/GTD Space</code> path.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailCard
              label="Resolved Workspace"
              value={workspaceResolution.path ?? 'No workspace path available yet'}
              muted={!workspaceResolution.path}
            />
            <DetailCard
              label="Workspace Source"
              value={getWorkspaceResolutionLabel(workspaceResolution.source)}
            />
            <DetailCard
              label="Default Mode"
              value={readOnlyDefault ? 'Read-only' : 'Read-write'}
            />
            <DetailCard
              label="Default Log Level"
              value={defaultLogLevel}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={resolvedWorkspaceIsValid ? 'outline' : 'secondary'}>
              {isCheckingWorkspace
                ? 'Checking workspace'
                : resolvedWorkspaceIsValid === null
                  ? 'Workspace unresolved'
                  : resolvedWorkspaceIsValid
                    ? 'Valid GTD workspace'
                    : validationError ?? 'Workspace path is not a valid GTD space'}
            </Badge>
            <span className="text-muted-foreground">
              Read-only mode disables the mutation planning and apply tools for that process.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Defaults</CardTitle>
          </div>
          <CardDescription>
            These are the only app-level MCP defaults we persist. External clients can still override
            them with explicit CLI flags when launching the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor={FIELD_IDS.workspace}>Workspace override</Label>
            <p className="text-sm text-muted-foreground">
              Optional dedicated workspace for MCP. Leave this blank if you want the server to follow
              your current GTD Space selection and saved workspace preferences.
            </p>
            <div className="flex flex-col gap-2 lg:flex-row">
              <Input
                id={FIELD_IDS.workspace}
                value={workspaceDraft}
                onChange={(event) => setWorkspaceDraft(event.target.value)}
                onBlur={handleWorkspaceBlur}
                placeholder="/Users/me/GTD Space"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleBrowseWorkspace}
                  disabled={isBrowsingWorkspace}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {isBrowsingWorkspace ? 'Browsing...' : 'Browse'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleClearWorkspaceOverride}
                  disabled={!workspaceOverride}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr,280px]">
            <div className="space-y-2">
              <Label htmlFor={FIELD_IDS.logLevel}>Default log level</Label>
              <p className="text-sm text-muted-foreground">
                Controls how noisy the standalone server is when clients launch it without an explicit
                {' '}
                <code>--log-level</code>
                {' '}
                flag.
              </p>
              <Select
                value={defaultLogLevel}
                onValueChange={(value) => {
                  void updateSettings({ mcp_server_log_level: value as McpServerLogLevel });
                }}
              >
                <SelectTrigger id={FIELD_IDS.logLevel} className="max-w-sm">
                  <SelectValue placeholder="Select log level" />
                </SelectTrigger>
                <SelectContent>
                  {LOG_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label} - {option.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor={FIELD_IDS.readOnly}>Default read-only mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Block all mutating MCP tools unless the client explicitly opts into read-write mode.
                  </p>
                </div>
                <Switch
                  id={FIELD_IDS.readOnly}
                  checked={readOnlyDefault}
                  onCheckedChange={(checked) => {
                    void updateSettings({ mcp_server_read_only: checked });
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TerminalSquare className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Launch Commands</CardTitle>
          </div>
          <CardDescription>
            Use the npm helper during app development, or run the Rust package directly. Leaving flags
            out means the server will read the defaults saved on this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock
            label="Use saved defaults"
            value={npmSavedDefaultsCommand}
            onCopy={() => {
              void copyText(npmSavedDefaultsCommand, 'The saved-defaults command');
            }}
          />
          <CodeBlock
            label="Pin the current defaults explicitly"
            value={npmPinnedCommand}
            onCopy={() => {
              void copyText(npmPinnedCommand, 'The pinned npm command');
            }}
          />
          <CodeBlock
            label="Run the Rust package directly"
            value={cargoPinnedCommand}
            onCopy={() => {
              void copyText(cargoPinnedCommand, 'The pinned cargo command');
            }}
          />

          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            If you leave workspace override blank, the pinned command reflects the workspace that would
            resolve right now. The saved-defaults command stays dynamic and will follow future settings
            changes automatically.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpenText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">What The Server Exposes</CardTitle>
          </div>
          <CardDescription>
            Everything below is available over stdio to any MCP-capable client. Reads are direct; write
            flows are intentionally plan-first and require an explicit apply step.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ToolChipSection
            title="Resources"
            description="Static GTD docs, generated workspace context, and item-specific reads."
            items={MCP_RESOURCES}
          />
          <ToolChipSection
            title="Read and query tools"
            description="Workspace inspection, search, relationship lookup, and markdown reads."
            items={READ_TOOLS}
          />
          <ToolChipSection
            title="Planning tools"
            description="Project, action, habit, horizon, and reference-note mutations return planned changes before anything is written. Clients must call change_apply to commit them."
            items={PLANNING_TOOLS}
          />
          <ToolChipSection
            title="Lifecycle tools"
            description="Apply or discard a previously planned change set."
            items={LIFECYCLE_TOOLS}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Behavior Notes</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <DetailCard
            label="Write Safety"
            value="Mutating tools are dry-run first. Planned changes do not touch workspace files until change_apply succeeds."
          />
          <DetailCard
            label="Project Discovery"
            value="If a client is unsure which project path to use for action_create, call workspace_list_items with itemType set to project and reuse one of the returned paths."
          />
          <DetailCard
            label="Version Surface"
            value="workspace_info and the generated workspace context resources expose serverVersion so clients can identify the backend build they are connected to."
          />
          <DetailCard
            label="Refresh Behavior"
            value="workspace_refresh clears cached workspace state and invalidates any pending change sets."
          />
          <DetailCard
            label="Cache Location"
            value="Context-pack cache artifacts live outside the workspace in the app cache directory so GTD files stay clean."
          />
          <DetailCard
            label="Boundary"
            value="The v1 server allows reads and GTD-aware mutations only. Generic raw writes are intentionally not exposed."
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default McpServerSettings;
