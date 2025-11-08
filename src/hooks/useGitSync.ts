import { useState, useCallback, useEffect } from 'react';
import { safeInvoke } from '@/utils/safe-invoke';
import { useToast } from '@/hooks/use-toast';
import type { UserSettings, GitSyncStatus, GitOperationResult } from '@/types';

export interface UseGitSyncOptions {
  settings: UserSettings;
  workspacePath?: string | null;
  autoRefresh?: boolean;
}

export interface UseGitSyncResult {
  status: GitSyncStatus;
  isPushing: boolean;
  isPulling: boolean;
  operation: 'push' | 'pull' | null;
  refreshStatus: () => Promise<void>;
  push: () => Promise<boolean>;
  pull: () => Promise<boolean>;
}

const fallbackStatus: GitSyncStatus = {
  enabled: false,
  configured: false,
  encryptionConfigured: false,
  hasPendingCommits: false,
  hasRemote: false,
  message: 'Git sync disabled',
};

const formatError = (error: unknown) => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'Unknown error';
};

export const useGitSync = ({
  settings,
  workspacePath,
  autoRefresh = true,
}: UseGitSyncOptions): UseGitSyncResult => {
  const [status, setStatus] = useState<GitSyncStatus>({
    ...fallbackStatus,
    enabled: settings.git_sync_enabled ?? false,
    encryptionConfigured: false, // Will be updated by backend status check
    repoPath: settings.git_sync_repo_path,
    workspacePath:
      workspacePath ??
      settings.git_sync_workspace_path ??
      settings.default_space_path ??
      settings.last_folder ??
      null,
    remoteUrl: settings.git_sync_remote_url,
    branch: settings.git_sync_branch,
    lastPush: settings.git_sync_last_push,
    lastPull: settings.git_sync_last_pull,
  });
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [operation, setOperation] = useState<'push' | 'pull' | null>(null);
  const { toast } = useToast();

  const refreshStatus = useCallback(async () => {
    if (!settings.git_sync_enabled) {
      setStatus((prev) => ({
        ...prev,
        enabled: false,
        configured: false,
        message: 'Git sync disabled',
      }));
      return;
    }

    const resolvedWorkspacePath =
      workspacePath ??
      settings.git_sync_workspace_path ??
      settings.default_space_path ??
      settings.last_folder ??
      null;

    const optimisticStatus: GitSyncStatus = {
      ...fallbackStatus,
      enabled: true,
      encryptionConfigured: false, // Will be updated by backend status check
      repoPath: settings.git_sync_repo_path,
      workspacePath: resolvedWorkspacePath,
      remoteUrl: settings.git_sync_remote_url,
      branch: settings.git_sync_branch,
      lastPush: settings.git_sync_last_push,
      lastPull: settings.git_sync_last_pull,
      message: 'Waiting for git status…',
    };

    try {
      const result = await safeInvoke<GitSyncStatus>(
        'git_sync_status',
        { workspace_override: workspacePath ?? null },
        optimisticStatus,
      );

      if (result) {
        setStatus(result);
        return;
      }

      setStatus({
        ...optimisticStatus,
        enabled: false,
        configured: false,
        message: 'Git status unavailable.',
      });
    } catch (error) {
      setStatus({
        ...fallbackStatus,
        enabled: false,
        configured: false,
        repoPath: settings.git_sync_repo_path,
        workspacePath: resolvedWorkspacePath,
        remoteUrl: settings.git_sync_remote_url,
        branch: settings.git_sync_branch,
        lastPush: settings.git_sync_last_push,
        lastPull: settings.git_sync_last_pull,
        hasPendingCommits: false,
        hasRemote: false,
        message: `Failed to fetch git status: ${formatError(error)}`,
      });
    }
  }, [
    settings.git_sync_enabled,
    settings.git_sync_repo_path,
    settings.git_sync_workspace_path,
    settings.git_sync_remote_url,
    settings.git_sync_branch,
    settings.git_sync_last_push,
    settings.git_sync_last_pull,
    settings.default_space_path,
    settings.last_folder,
    workspacePath,
  ]);

  useEffect(() => {
    if (!autoRefresh) return;
    refreshStatus();
  }, [autoRefresh, refreshStatus]);

  const push = useCallback(async () => {
    if (!settings.git_sync_enabled) {
      toast({
        title: 'Git sync disabled',
        description: 'Enable git sync in Settings to push backups.',
        variant: 'destructive',
      });
      return false;
    }

    setIsPushing(true);
    setOperation('push');
    try {
      const result = await safeInvoke<GitOperationResult>(
        'git_sync_push',
        { workspace_override: workspacePath ?? null },
        null,
      );

      if (!result) {
        throw new Error('Git push is not available in this environment.');
      }

      if (!result.success) {
        throw new Error(result.message);
      }

      toast({
        title: 'Backup uploaded',
        description: result.message,
      });

      await refreshStatus();
      return true;
    } catch (error) {
      toast({
        title: 'Push failed',
        description: formatError(error),
        variant: 'destructive',
      });
      return false;
    } finally {
      setOperation((op) => (op === 'push' ? null : op));
      setIsPushing(false);
    }
  }, [settings.git_sync_enabled, workspacePath, toast, refreshStatus]);

  const pull = useCallback(async () => {
    if (!settings.git_sync_enabled) {
      toast({
        title: 'Git sync disabled',
        description: 'Enable git sync in Settings to pull backups.',
        variant: 'destructive',
      });
      return false;
    }

    setIsPulling(true);
    setOperation('pull');
    try {
      const result = await safeInvoke<GitOperationResult>(
        'git_sync_pull',
        { workspace_override: workspacePath ?? null },
        null,
      );

      if (!result) {
        throw new Error('Git pull is not available in this environment.');
      }

      if (!result.success) {
        throw new Error(result.message);
      }

      toast({
        title: 'Workspace restored',
        description: result.message,
      });

      await refreshStatus();
      return true;
    } catch (error) {
      toast({
        title: 'Pull failed',
        description: formatError(error),
        variant: 'destructive',
      });
      return false;
    } finally {
      setOperation((op) => (op === 'pull' ? null : op));
      setIsPulling(false);
    }
  }, [settings.git_sync_enabled, workspacePath, toast, refreshStatus]);

  return {
    status,
    isPushing,
    isPulling,
    operation,
    refreshStatus,
    push,
    pull,
  };
};
