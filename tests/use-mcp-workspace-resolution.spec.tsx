// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InvokeWithHandling } from '@/components/settings/mcp-server-settings-contract';
import { useMcpWorkspaceResolution } from '@/components/settings/useMcpWorkspaceResolution';

describe('useMcpWorkspaceResolution', () => {
  it('treats blank overrides as absent and continues to fallback candidates', async () => {
    const invokeMock = vi.fn(
      async (
        command: string,
        args?: Record<string, unknown>,
        _options?: { errorMessage?: string }
      ) => {
      if (command !== 'check_is_gtd_space') {
        return null;
      }

      return args?.path === '/spaces/fallback';
      }
    );
    const invokeWithHandling = ((command, args, options) =>
      invokeMock(command, args, options)) as InvokeWithHandling;

    const { result } = renderHook(() =>
      useMcpWorkspaceResolution({
        workspaceOverride: '   ',
        lastFolder: '/spaces/fallback',
        defaultSpacePath: '/spaces/default',
        platformDefaultPath: '/spaces/platform',
        invokeWithHandling,
      })
    );

    await waitFor(() => {
      expect(result.current.isCheckingWorkspace).toBe(false);
      expect(result.current.workspaceResolution).toEqual({
        path: '/spaces/fallback',
        source: 'last-folder',
      });
    });

    expect(invokeMock).toHaveBeenCalledWith(
      'check_is_gtd_space',
      { path: '/spaces/fallback' },
      { errorMessage: 'Failed to validate the MCP workspace path.' }
    );
  });
});
