// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const safeInvokeMock = vi.fn();
const toastMock = vi.fn();

vi.mock('@/utils/safe-invoke', () => ({
  safeInvoke: (...args: unknown[]) => safeInvokeMock(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

import { useGitSync } from '@/hooks/useGitSync';
import type { UserSettings } from '@/types';

const baseSettings: UserSettings = {
  theme: 'light',
  font_size: 14,
  tab_size: 2,
  word_wrap: true,
  font_family: 'inter',
  line_height: 1.4,
  keybindings: {},
  editor_mode: 'source',
  git_sync_enabled: true,
  git_sync_repo_path: '/repo',
  git_sync_workspace_path: '/workspace',
  git_sync_remote_url: null,
  git_sync_branch: 'main',
  git_sync_encryption_key: null,
  git_sync_keep_history: 5,
  git_sync_author_name: null,
  git_sync_author_email: null,
  git_sync_last_push: null,
  git_sync_last_pull: null,
  git_sync_auto_pull_interval_minutes: null,
  default_space_path: null,
  last_folder: null,
  auto_initialize: true,
  seed_example_content: true,
  restore_tabs: true,
  max_tabs: 10,
  mcp_server_workspace_path: null,
  mcp_server_read_only: false,
  mcp_server_log_level: 'info',
};

describe('useGitSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the preview command and returns the preview payload', async () => {
    safeInvokeMock.mockResolvedValue({
      hasBaseline: true,
      baselineBackupFile: 'backup.enc',
      baselineTimestamp: '2026-03-25T12:00:00Z',
      summary: {
        totalEntries: 1,
        added: 0,
        modified: 1,
        deleted: 0,
        renamed: 0,
        unchangedExcluded: 0,
        textDiffs: 1,
        binaryDiffs: 0,
        beforeBytes: 10,
        afterBytes: 11,
      },
      entries: [],
      truncated: false,
      warnings: null,
    });

    const { result } = renderHook(() =>
      useGitSync({ settings: baseSettings, workspacePath: '/workspace', autoRefresh: false }),
    );

    let preview = null;
    await act(async () => {
      preview = await result.current.previewPush();
    });

    expect(safeInvokeMock).toHaveBeenCalledWith(
      'git_sync_preview_push',
      { workspace_override: '/workspace' },
      null,
    );
    expect(preview).toMatchObject({
      hasBaseline: true,
      baselineBackupFile: 'backup.enc',
    });
  });

  it('shows a destructive toast when preview generation fails', async () => {
    safeInvokeMock.mockRejectedValue(new Error('preview exploded'));

    const { result } = renderHook(() =>
      useGitSync({ settings: baseSettings, workspacePath: '/workspace', autoRefresh: false }),
    );

    await act(async () => {
      const preview = await result.current.previewPush();
      expect(preview).toBeNull();
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Backup review failed',
      description: 'preview exploded',
      variant: 'destructive',
    });
  });
});
