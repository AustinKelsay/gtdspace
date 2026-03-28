// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserSettings } from '@/types';

const updateSettingsMock = vi.fn<(...args: unknown[]) => Promise<void>>();
const toastMock = vi.fn();
const invokeMock = vi.fn();
const checkTauriContextAsyncMock = vi.fn();

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

vi.mock('@/utils/tauri-ready', () => ({
  checkTauriContextAsync: () => checkTauriContextAsyncMock(),
}));

import McpServerSettings from '@/components/settings/McpServerSettings';

const buildSettings = (overrides: Partial<UserSettings> = {}): UserSettings => ({
  theme: 'dark',
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
  const originalNavigatorPlatform = window.navigator.platform;

  beforeEach(() => {
    mockSettings = buildSettings();
    updateSettingsMock.mockReset();
    updateSettingsMock.mockResolvedValue(undefined);
    invokeMock.mockReset();
    checkTauriContextAsyncMock.mockReset();
    toastMock.mockReset();
    checkTauriContextAsyncMock.mockResolvedValue(true);
    (window as typeof window & {
      __TAURI_INTERNALS__?: {
        invoke: (...args: unknown[]) => Promise<unknown>;
      };
    }).__TAURI_INTERNALS__ = {
      invoke: (...args: unknown[]) => invokeMock(...args),
    };
    invokeMock.mockImplementation((command: string, payload?: { path?: string }) => {
      if (command === 'get_default_gtd_space_path') return Promise.resolve('/Users/me/GTD Space');
      if (command === 'check_is_gtd_space') {
        return Promise.resolve(payload?.path === '/Users/me/GTD Space');
      }
      if (command === 'select_folder') return Promise.resolve(null);
      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: originalNavigatorPlatform,
    });
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('renders saved defaults and pinned launch commands from current settings', async () => {
    mockSettings = buildSettings({
      mcp_server_workspace_path: '/spaces/work',
      mcp_server_read_only: true,
      mcp_server_log_level: 'debug',
      last_folder: '/spaces/last',
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_default_gtd_space_path') return Promise.resolve('/Users/me/GTD Space');
      if (command === 'check_is_gtd_space') return Promise.resolve(true);
      return Promise.resolve(null);
    });

    render(<McpServerSettings />);

    await screen.findByText('Valid GTD workspace');
    expect(screen.getByText('/spaces/work')).toBeInTheDocument();
    expect(screen.getByText('Resolved GTD workspace ancestor')).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes('npm run mcp:dev -- --workspace "/spaces/work" --read-only --log-level debug')
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Project Discovery')).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes('workspace_list_items with itemType set to project')
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Version Surface')).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes('workspace_info and the generated workspace context resources expose serverVersion')
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

  it('quotes pinned Windows workspace commands without escaping path separators', async () => {
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    });

    mockSettings = buildSettings({
      mcp_server_workspace_path: 'C:\\Users\\me\\GTD Space',
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_default_gtd_space_path') return Promise.resolve(null);
      if (command === 'check_is_gtd_space') return Promise.resolve(true);
      return Promise.resolve(null);
    });

    render(<McpServerSettings />);

    await screen.findByText('Valid GTD workspace');
    expect(
      screen.getAllByText((content) =>
        content.includes('--workspace "C:\\Users\\me\\GTD Space"')
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText((content) =>
        content.includes('--workspace "C:\\\\Users\\\\me\\\\GTD Space"')
      )
    ).not.toBeInTheDocument();
  });

  it('accepts an ancestor GTD workspace when the selected path is nested beneath it', async () => {
    mockSettings = buildSettings({
      mcp_server_workspace_path: '/spaces/work/Projects/Alpha',
    });

    invokeMock.mockImplementation((command: string, payload?: { path?: string }) => {
      if (command === 'get_default_gtd_space_path') return Promise.resolve(null);
      if (command === 'check_is_gtd_space') {
        return Promise.resolve(payload?.path === '/spaces/work');
      }
      return Promise.resolve(null);
    });

    render(<McpServerSettings />);

    await screen.findByText('Valid GTD workspace');
    expect(invokeMock).toHaveBeenCalledWith('check_is_gtd_space', { path: '/spaces/work/Projects/Alpha' }, undefined);
    expect(invokeMock).toHaveBeenCalledWith('check_is_gtd_space', { path: '/spaces/work/Projects' }, undefined);
    expect(invokeMock).toHaveBeenCalledWith('check_is_gtd_space', { path: '/spaces/work' }, undefined);
  });

  it('ignores stale workspace validation responses and keeps the newest result', async () => {
    const slow = deferred<boolean>();
    const fast = deferred<boolean>();

    mockSettings = buildSettings({
      mcp_server_workspace_path: '/spaces/slow',
    });

    invokeMock.mockImplementation((command: string, payload?: { path?: string }) => {
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
