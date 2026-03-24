// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSettings } from '@/types';

const updateSettingsMock = vi.fn<(...args: unknown[]) => Promise<void>>();
const toastMock = vi.fn();
const safeInvokeMock = vi.fn();

let mockSettings: UserSettings;

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: updateSettingsMock,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock('@/utils/safe-invoke', () => ({
  safeInvoke: (...args: unknown[]) => safeInvokeMock(...args),
}));

import McpServerSettings from '@/components/settings/McpServerSettings';

const buildSettings = (overrides: Partial<UserSettings> = {}): UserSettings => ({
  theme: 'light',
  font_size: 14,
  tab_size: 2,
  word_wrap: true,
  font_family: 'Inter',
  line_height: 1.5,
  editor_mode: 'split',
  keybindings: {
    save: 'mod+s',
    open: 'mod+o',
    commandPalette: 'mod+k',
    newNote: 'mod+shift+n',
  },
  last_folder: null,
  max_tabs: 10,
  restore_tabs: true,
  auto_initialize: false,
  seed_example_content: false,
  default_space_path: null,
  mcp_server_workspace_path: null,
  mcp_server_read_only: false,
  mcp_server_log_level: 'info',
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('McpServerSettings component', () => {
  beforeEach(() => {
    mockSettings = buildSettings();
    updateSettingsMock.mockReset();
    updateSettingsMock.mockResolvedValue(undefined);
    safeInvokeMock.mockReset();
    toastMock.mockReset();
    safeInvokeMock.mockImplementation((command: string, payload?: { path?: string }) => {
      if (command === 'get_default_gtd_space_path') return Promise.resolve('/Users/me/GTD Space');
      if (command === 'check_is_gtd_space') {
        return Promise.resolve(payload?.path === '/Users/me/GTD Space');
      }
      if (command === 'select_folder') return Promise.resolve(null);
      return Promise.resolve(null);
    });
  });

  it('renders saved defaults and pinned launch commands from current settings', async () => {
    mockSettings = buildSettings({
      mcp_server_workspace_path: '/spaces/work',
      mcp_server_read_only: true,
      mcp_server_log_level: 'debug',
      last_folder: '/spaces/last',
    });
    safeInvokeMock.mockImplementation((command: string) => {
      if (command === 'get_default_gtd_space_path') return Promise.resolve('/Users/me/GTD Space');
      if (command === 'check_is_gtd_space') return Promise.resolve(true);
      return Promise.resolve(null);
    });

    render(<McpServerSettings />);

    await screen.findByText('Valid GTD workspace');
    expect(screen.getByText('/spaces/work')).toBeInTheDocument();
    expect(screen.getByText('MCP workspace override')).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes('npm run mcp:dev -- --workspace "/spaces/work" --read-only --log-level debug')
      )
    ).toBeInTheDocument();
  });

  it('persists the workspace override on blur', async () => {
    render(<McpServerSettings />);

    const input = screen.getByLabelText('Workspace override');
    fireEvent.change(input, { target: { value: '/spaces/new-root' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({
        mcp_server_workspace_path: '/spaces/new-root',
      });
    });
  });

  it('ignores stale workspace validation responses and keeps the newest result', async () => {
    const slow = deferred<boolean>();
    const fast = deferred<boolean>();

    mockSettings = buildSettings({
      mcp_server_workspace_path: '/spaces/slow',
    });

    safeInvokeMock.mockImplementation((command: string, payload?: { path?: string }) => {
      if (command === 'get_default_gtd_space_path') return Promise.resolve('/Users/me/GTD Space');
      if (command === 'check_is_gtd_space' && payload?.path === '/spaces/slow') return slow.promise;
      if (command === 'check_is_gtd_space' && payload?.path === '/spaces/fast') return fast.promise;
      return Promise.resolve(false);
    });

    const { rerender } = render(<McpServerSettings />);

    mockSettings = buildSettings({
      mcp_server_workspace_path: '/spaces/fast',
    });
    rerender(<McpServerSettings />);

    await act(async () => {
      fast.resolve(false);
      await fast.promise;
    });

    await screen.findByText('Workspace path is not a valid GTD space');

    await act(async () => {
      slow.resolve(true);
      await slow.promise;
    });

    await waitFor(() => {
      expect(screen.getByText('Workspace path is not a valid GTD space')).toBeInTheDocument();
    });
    expect(screen.queryByText('Valid GTD workspace')).not.toBeInTheDocument();
  });
});
