/**
 * @fileoverview Advanced settings component for data management
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  HardDrive,
  AlertTriangle,
  ShieldCheck,
  GitBranch,
  FolderOpen,
  KeyRound,
  CloudUpload,
  CloudDownload,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { useGitSync } from '@/hooks/useGitSync';
import { safeInvoke } from '@/utils/safe-invoke';
import { formatRelativeTime } from '@/utils/time';

/**
 * Advanced settings component - simplified to only include working features
 */
export const AdvancedSettings: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
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
    refreshStatus: refreshGitStatus,
    push: pushGitBackup,
    pull: pullGitBackup,
    isPushing: gitPushing,
    isPulling: gitPulling,
  } = useGitSync({ settings, workspacePath: gitWorkspaceOverride, autoRefresh: false });
  const gitEnabled = settings.git_sync_enabled ?? false;
  const hasEncryptionKey = Boolean(settings.git_sync_encryption_key);

  React.useEffect(() => {
    if (settings.git_sync_enabled) {
      refreshGitStatus();
    }
  }, [
    settings.git_sync_enabled,
    settings.git_sync_repo_path,
    settings.git_sync_remote_url,
    settings.git_sync_branch,
    gitWorkspaceOverride,
    refreshGitStatus,
  ]);

  const handleExportSettings = async () => {
    setIsExporting(true);
    try {
      const settingsJson = JSON.stringify(settings, null, 2);
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gtdspace-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Settings Exported',
        description: 'Your settings have been exported successfully',
      });
    } catch (_error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export settings',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const importedSettings = JSON.parse(text);
      
      // Validate the imported settings have required fields
      if (!importedSettings.theme || !importedSettings.font_size) {
        throw new Error('Invalid settings file');
      }

      await updateSettings(importedSettings);
      
      toast({
        title: 'Settings Imported',
        description: 'Your settings have been imported successfully',
      });
      
      // Reset the input
      event.target.value = '';
    } catch (_error) {
      toast({
        title: 'Import Failed',
        description: 'Failed to import settings. Please check the file format.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetSettings = async () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      await updateSettings({
        theme: 'dark',
        font_size: 14,
        tab_size: 2,
        word_wrap: true,
        editor_mode: 'split',
      });
      
      toast({
        title: 'Settings Reset',
        description: 'All settings have been reset to defaults',
      });
    }
  };

  const handleClearCache = async () => {
    try {
      // Clear localStorage except for essential items
      const essentialKeys = ['gtdspace-current-path', 'gtdspace-tabs', 'gtdspace-sidebar-width'];
      const keysToKeep: Record<string, string> = {};
      
      essentialKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) keysToKeep[key] = value;
      });
      
      localStorage.clear();
      
      // Restore essential items
      Object.entries(keysToKeep).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      toast({
        title: 'Cache Cleared',
        description: 'Application cache has been cleared successfully',
      });
    } catch (_error) {
      toast({
        title: 'Clear Failed',
        description: 'Failed to clear cache',
        variant: 'destructive',
      });
    }
  };

  const describeError = (error: unknown) => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    return 'Unknown error';
  };

  const handleToggleGitSync = async (checked: boolean) => {
    await updateSettings({ git_sync_enabled: checked });
    if (checked) {
      await refreshGitStatus();
    }
  };

  const handleWorkspaceBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    await updateSettings({ git_sync_workspace_path: event.target.value.trim() || null });
    await refreshGitStatus();
  };

  const handleRepoBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    await updateSettings({ git_sync_repo_path: event.target.value.trim() || null });
    await refreshGitStatus();
  };

  const handleRemoteBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    await updateSettings({ git_sync_remote_url: event.target.value.trim() || null });
    await refreshGitStatus();
  };

  const handleBranchBlur = async (event: React.FocusEvent<HTMLInputElement>) => {
    await updateSettings({ git_sync_branch: event.target.value.trim() || 'main' });
    await refreshGitStatus();
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
        await refreshGitStatus();
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
    try {
      await updateSettings({ git_sync_encryption_key: encryptionKeyInput.trim() });
      setEncryptionKeyInput('');
      toast({
        title: 'Encryption key saved',
        description: 'Key stored locally and never synced.',
      });
      await refreshGitStatus();
    } catch (error) {
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
      <div>
        <h3 className="text-lg font-semibold mb-1">Advanced</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Data management and maintenance options
        </p>

        {/* Import/Export */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold">Settings Backup</Label>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Export your settings for backup or import them on another device
          </p>
          
          <div className="space-y-3">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleExportSettings}
                disabled={isExporting}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export Settings'}
              </Button>
              
              <div className="flex-1">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                  disabled={isImporting}
                  className="hidden"
                  id="import-settings"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('import-settings')?.click()}
                  disabled={isImporting}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isImporting ? 'Importing...' : 'Import Settings'}
                </Button>
              </div>
            </div>
            
            <Button
              variant="destructive"
              onClick={handleResetSettings}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>
        </Card>

        {/* Git Sync */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-semibold">Git Sync & Backups</Label>
                <Badge variant={gitStatus.configured ? 'outline' : 'secondary'}>
                  {gitStatus.configured ? 'Configured' : 'Needs setup'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Encrypt everything locally before pushing to GitHub. Manual push/pull only.
              </p>
            </div>
            <Switch
              checked={gitEnabled}
              onCheckedChange={handleToggleGitSync}
              aria-label="Toggle git sync"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Workspace Path</Label>
              <div className="flex gap-2 mt-1">
                <Input
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
              <Label>Git Repository Path</Label>
              <div className="flex gap-2 mt-1">
                <Input
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
              <Label>Remote URL</Label>
              <Input
                key={`remote-${settings.git_sync_remote_url ?? ''}`}
                defaultValue={settings.git_sync_remote_url ?? ''}
                placeholder="https://github.com/you/gtdspace-sync.git"
                onBlur={handleRemoteBlur}
                disabled={!gitEnabled}
              />
            </div>
            <div>
              <Label>Branch</Label>
              <div className="flex gap-2 mt-1">
                <Input
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
              <Label>Encryption Key</Label>
              <div className="flex gap-2 mt-1">
                <Input
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
                  <KeyRound className="h-4 w-4 mr-2" />
                  {isSavingKey ? 'Saving…' : 'Save'}
                </Button>
              </div>
              {hasEncryptionKey && (
                <p className="text-xs text-muted-foreground mt-1">
                  Stored locally only. Never synced.
                </p>
              )}
            </div>
            <div>
              <Label>Status</Label>
              <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                <div>Last push: {formatRelativeTime(gitStatus.lastPush)}</div>
                <div>Last pull: {formatRelativeTime(gitStatus.lastPull)}</div>
                <div>Latest backup: {formatRelativeTime(gitStatus.latestBackupAt)}</div>
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
              onClick={pushGitBackup}
              disabled={!gitEnabled || !gitStatus.configured || gitPushing}
            >
              <CloudUpload className="h-4 w-4 mr-2" />
              {gitPushing ? 'Pushing…' : 'Push Backup'}
            </Button>
            <Button
              variant="outline"
              onClick={pullGitBackup}
              disabled={!gitEnabled || !gitStatus.configured || gitPulling}
            >
              <CloudDownload className="h-4 w-4 mr-2" />
              {gitPulling ? 'Pulling…' : 'Pull & Restore'}
            </Button>
            <Button
              variant="ghost"
              onClick={refreshGitStatus}
              disabled={!gitEnabled}
            >
              Refresh Status
            </Button>
            <Badge variant={gitStatus.hasRemote ? 'outline' : 'secondary'}>
              {gitStatus.hasRemote ? 'Remote linked' : 'Local only'}
            </Badge>
          </div>
        </Card>

        {/* Cache Management */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold">Cache & Storage</Label>
          </div>
          
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Clearing cache will remove temporary browser data while preserving essential application state.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={handleClearCache}
              className="w-full"
            >
              <HardDrive className="h-4 w-4 mr-2" />
              Clear Application Cache
            </Button>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>What will be cleared:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• Search history and saved searches</li>
                <li>• Temporary browser cache data</li>
                <li>• Other non-essential cached information</li>
              </ul>
              <p className="mt-3"><strong>What will be preserved:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• Current workspace path</li>
                <li>• Open tabs and their content</li>
                <li>• Sidebar width preference</li>
                <li>• User settings (theme, preferences)</li>
                <li>• All files on disk (unchanged)</li>
              </ul>
              <p className="mt-2 text-muted-foreground/80 italic">
                This only affects browser storage, not your files or app settings.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdvancedSettings;
