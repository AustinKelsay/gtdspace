import React from 'react';
import {
  ShieldCheck,
  FolderOpen,
  GitBranch,
  KeyRound,
  CloudUpload,
  CloudDownload,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSettings } from '@/hooks/useSettings';
import { useGitSync } from '@/hooks/useGitSync';
import { useToast } from '@/hooks/use-toast';
import { safeInvoke } from '@/utils/safe-invoke';
import { formatRelativeTimeShort } from '@/utils/time';
import { QuestionMarkTooltip } from '@/components/ui/QuestionMarkTooltip';

const FIELD_IDS = {
  workspace: 'git-sync-workspace',
  repo: 'git-sync-repo',
  remote: 'git-sync-remote',
  branch: 'git-sync-branch',
  key: 'git-sync-key',
  status: 'git-sync-status',
} as const;

const FieldLabel: React.FC<{ label: string; help: React.ReactNode; id?: string }> = ({ label, help, id }) => (
  <div className="flex items-center gap-2">
    <Label htmlFor={id}>{label}</Label>
    <QuestionMarkTooltip content={help} label={`${label} help`} className="h-5 w-5" />
  </div>
);

const SECURE_STORE_FAILURE_TOKEN = '__SECURE_STORE_WRITE_FAILED__';

export const GitSyncSettings: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const [encryptionKeyInput, setEncryptionKeyInput] = React.useState('');
  const [isSavingKey, setIsSavingKey] = React.useState(false);
  const [pathLoading, setPathLoading] = React.useState<'repo' | 'workspace' | null>(null);

  const gitWorkspaceOverride =
    settings.git_sync_workspace_path ??
    settings.default_space_path ??
    settings.last_folder ??
    null;

  const {
    status: gitStatus,
    refreshStatus,
    push: pushGitBackup,
    pull: pullGitBackup,
    isPushing: gitPushing,
    isPulling: gitPulling,
  } = useGitSync({ settings, workspacePath: gitWorkspaceOverride, autoRefresh: false });

  const gitEnabled = settings.git_sync_enabled ?? false;
  const [hasEncryptionKey, setHasEncryptionKey] = React.useState(false);
  const [showForcePushDialog, setShowForcePushDialog] = React.useState(false);
  const [showForcePullDialog, setShowForcePullDialog] = React.useState(false);

  // Check secure storage for encryption key on mount and when status refreshes
  React.useEffect(() => {
    const checkEncryptionKey = async () => {
      try {
        const key = await safeInvoke<string>(
          'secure_store_get',
          { key: 'git_sync_encryption_key' },
          null,
        );
        setHasEncryptionKey(Boolean(key && key.trim().length > 0));
      } catch {
        setHasEncryptionKey(false);
      }
    };
    checkEncryptionKey();
  }, [gitStatus.encryptionConfigured]);

  React.useEffect(() => {
    refreshStatus();
  }, [
    settings.git_sync_enabled,
    settings.git_sync_repo_path,
    settings.git_sync_remote_url,
    settings.git_sync_branch,
    gitWorkspaceOverride,
    refreshStatus,
  ]);

  const describeError = (error: unknown) => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return 'Unknown error';
  };

  const handleToggleGitSync = async (checked: boolean) => {
    await updateSettings({ git_sync_enabled: checked });
    await refreshStatus();
  };

  const handleWorkspaceBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    await updateSettings({ git_sync_workspace_path: event.target.value.trim() || null });
    await refreshStatus();
  };

  const handleRepoBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    await updateSettings({ git_sync_repo_path: event.target.value.trim() || null });
    await refreshStatus();
  };

  const handleRemoteBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    await updateSettings({ git_sync_remote_url: event.target.value.trim() || null });
    await refreshStatus();
  };

  const handleBranchBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    await updateSettings({ git_sync_branch: event.target.value.trim() || 'main' });
    await refreshStatus();
  };

  const handleBrowsePath = async (field: 'git_sync_workspace_path' | 'git_sync_repo_path') => {
    if (!settings.git_sync_enabled) return;
    setPathLoading(field === 'git_sync_repo_path' ? 'repo' : 'workspace');
    try {
      const selected = await safeInvoke<string>('select_folder', undefined, null);
      if (selected) {
        if (field === 'git_sync_workspace_path') {
          await updateSettings({ git_sync_workspace_path: selected });
        } else {
          await updateSettings({ git_sync_repo_path: selected });
        }
        await refreshStatus();
      }
    } catch (error) {
      toast({
        title: 'Folder selection failed',
        description: describeError(error),
        variant: 'destructive',
      });
    } finally {
      setPathLoading(null);
    }
  };

  const handleSaveKey = async () => {
    if (!encryptionKeyInput.trim()) {
      toast({
        title: 'Missing key',
        description: 'Enter a passphrase before saving.',
        variant: 'destructive',
      });
      return;
    }
    setIsSavingKey(true);
    const trimmedKey = encryptionKeyInput.trim();
    try {
      const result = await safeInvoke<string>(
        'secure_store_set',
        { key: 'git_sync_encryption_key', value: trimmedKey },
        SECURE_STORE_FAILURE_TOKEN,
      );

      if (!result || result === SECURE_STORE_FAILURE_TOKEN) {
        throw new Error(
          'Secure storage is unavailable. Unlock your OS keychain or run the desktop app to store the encryption key.',
        );
      }

      setEncryptionKeyInput('');
      setHasEncryptionKey(true);
      toast({
        title: 'Encryption key saved',
        description: 'Stored securely in OS keychain and never synced.',
      });
      await refreshStatus();
    } catch (error) {
      setHasEncryptionKey(false);
      toast({
        title: 'Failed to save key',
        description: describeError(error),
        variant: 'destructive',
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card className="p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Encrypted Git Sync & Backups</h2>
              <Badge variant={gitStatus.configured ? 'outline' : 'secondary'}>
                {gitStatus.configured ? 'Configured' : 'Needs setup'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Use any git repo (like GitHub) to shuttle encrypted snapshots between devices. Push when you finish on one Mac, pull when you switch to another.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Enable</span>
            <Switch
              checked={gitEnabled}
              onCheckedChange={handleToggleGitSync}
              aria-label="Toggle git sync"
            />
          </div>
        </div>

        <Alert className="mt-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Backups are encrypted with AES-256 before touching git. Store your encryption key somewhere safe—you need the same key on every device to decrypt.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <div>
            <FieldLabel
              label="Workspace Path"
              id={FIELD_IDS.workspace}
              help="Absolute path to the GTD workspace you want to protect."
            />
            <div className="flex gap-2 mt-1">
              <Input
                id={FIELD_IDS.workspace}
                key={`workspace-${settings.git_sync_workspace_path ?? ''}`}
                defaultValue={settings.git_sync_workspace_path ?? ''}
                placeholder="/Users/me/GTD Space"
                onBlur={handleWorkspaceBlur}
                disabled={!gitEnabled}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBrowsePath('git_sync_workspace_path')}
                disabled={!gitEnabled || pathLoading === 'workspace'}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <FieldLabel
              label="Git Repository Path"
              id={FIELD_IDS.repo}
              help="Dedicated git repo that stores only the encrypted backup blobs (must be outside the workspace)."
            />
            <div className="flex gap-2 mt-1">
              <Input
                id={FIELD_IDS.repo}
                key={`repo-${settings.git_sync_repo_path ?? ''}`}
                defaultValue={settings.git_sync_repo_path ?? ''}
                placeholder="/Users/me/GTD Sync Repo"
                onBlur={handleRepoBlur}
                disabled={!gitEnabled}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBrowsePath('git_sync_repo_path')}
                disabled={!gitEnabled || pathLoading === 'repo'}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div>
            <FieldLabel
              label="Remote URL"
              id={FIELD_IDS.remote}
              help="Optional Git remote (HTTPS or SSH). Leave blank to keep backups local-only."
            />
            <Input
              id={FIELD_IDS.remote}
              key={`remote-${settings.git_sync_remote_url ?? ''}`}
              defaultValue={settings.git_sync_remote_url ?? ''}
              placeholder="https://github.com/you/gtdspace-sync.git"
              onBlur={handleRemoteBlur}
              disabled={!gitEnabled}
            />
          </div>
          <div>
            <FieldLabel
              label="Branch"
              id={FIELD_IDS.branch}
              help="Branch that will store the encrypted snapshots (e.g., main, backups)."
            />
            <div className="flex gap-2 mt-1">
              <Input
                id={FIELD_IDS.branch}
                key={`branch-${settings.git_sync_branch ?? ''}`}
                defaultValue={settings.git_sync_branch ?? 'main'}
                onBlur={handleBranchBlur}
                disabled={!gitEnabled}
              />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <GitBranch className="h-4 w-4" />
                Target branch
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div>
            <FieldLabel
              label="Encryption Key"
              id={FIELD_IDS.key}
              help="Local-only passphrase that derives the AES-256 key. You must reuse the same key on every device."
            />
            <div className="flex gap-2 mt-1">
              <Input
                id={FIELD_IDS.key}
                type="password"
                placeholder={
                  hasEncryptionKey ? 'Key saved (enter to replace)' : 'Enter secret passphrase'
                }
                value={encryptionKeyInput}
                onChange={(event) => setEncryptionKeyInput(event.target.value)}
                disabled={!gitEnabled}
              />
              <Button
                variant="secondary"
                onClick={handleSaveKey}
                disabled={!gitEnabled || !encryptionKeyInput.trim() || isSavingKey}
              >
                <KeyRound className="h-4 w-4 mr-1" />
                {isSavingKey ? 'Saving…' : 'Save'}
              </Button>
            </div>
            {hasEncryptionKey && (
              <p className="text-xs text-muted-foreground mt-1">
                Stored locally only — never written to git.
              </p>
            )}
          </div>
          <div>
            <FieldLabel
              label="Status"
              id={FIELD_IDS.status}
              help="Shows when the last push/pull occurred and when the most recent encrypted archive was created."
            />
            <div className="mt-1 space-y-1 text-sm text-muted-foreground">
              <div id={FIELD_IDS.status}>Last push: {formatRelativeTimeShort(gitStatus.lastPush)}</div>
              <div>Last pull: {formatRelativeTimeShort(gitStatus.lastPull)}</div>
              <div>Latest backup: {formatRelativeTimeShort(gitStatus.latestBackupAt)}</div>
              {gitStatus.latestBackupFile && (
                <div className="text-xs text-muted-foreground/80">
                  File: {gitStatus.latestBackupFile}
                </div>
              )}
            </div>
          </div>
        </div>

        {gitStatus.message && (
          <Alert
            variant={gitStatus.configured ? 'default' : 'destructive'}
            className="mt-4"
          >
            <AlertDescription>{gitStatus.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-6">
          <Button
            variant="secondary"
            onClick={() => pushGitBackup(false)}
            disabled={!gitEnabled || !gitStatus.configured || gitPushing}
          >
            <CloudUpload className="h-4 w-4 mr-2" />
            {gitPushing ? 'Pushing…' : 'Push Backup'}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowForcePushDialog(true)}
            disabled={!gitEnabled || !gitStatus.configured || gitPushing || !gitStatus.hasRemote}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Force Push
          </Button>
          <Button
            variant="outline"
            onClick={() => pullGitBackup(false)}
            disabled={!gitEnabled || !gitStatus.configured || gitPulling}
          >
            <CloudDownload className="h-4 w-4 mr-2" />
            {gitPulling ? 'Pulling…' : 'Pull & Restore'}
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowForcePullDialog(true)}
            disabled={!gitEnabled || !gitStatus.configured || gitPulling || !gitStatus.hasRemote}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Force Pull
          </Button>
          <Button
            variant="ghost"
            onClick={refreshStatus}
            disabled={!gitEnabled}
          >
            Refresh Status
          </Button>
          <Badge variant={gitStatus.hasRemote ? 'outline' : 'secondary'}>
            {gitStatus.hasRemote ? 'Remote linked' : 'Local only'}
          </Badge>
        </div>

        <AlertDialog open={showForcePushDialog} onOpenChange={setShowForcePushDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Force Push Encrypted Backup
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <div>
                    Force pushing will overwrite the remote branch with your local changes. This is useful when you know your local version is the latest and the remote has conflicting commits.
                  </div>
                  <div className="font-semibold text-foreground">
                    Safety checks ensure only encrypted backup files (.enc) are pushed—no unencrypted data will be included.
                  </div>
                  <div className="text-xs text-muted-foreground">
                    The system verifies that only files in the <code className="font-mono bg-muted px-1 py-0.5 rounded">backups/</code> directory with <code className="font-mono bg-muted px-1 py-0.5 rounded">.enc</code> extensions are staged before pushing.
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  setShowForcePushDialog(false);
                  await pushGitBackup(true);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Force Push
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showForcePullDialog} onOpenChange={setShowForcePullDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Force Pull Encrypted Backup
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <div>
                    Force pulling will discard all local changes and reset your workspace to match the remote exactly. This is useful when you know the remote has the latest version you want and you want to completely overwrite local changes.
                  </div>
                  <div className="font-semibold text-destructive">
                    Warning: This will permanently discard any local commits or changes in the git repository. Your workspace will be restored from the latest encrypted backup on the remote.
                  </div>
                  <div className="text-xs text-muted-foreground">
                    The system will fetch the latest from remote, reset the local branch to match, then decrypt and restore your workspace from the most recent encrypted backup.
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  setShowForcePullDialog(false);
                  await pullGitBackup(true);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Force Pull
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
};

export default GitSyncSettings;
