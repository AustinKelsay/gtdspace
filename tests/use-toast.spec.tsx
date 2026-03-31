// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.fn();
const dismissMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  ACTION_TOAST_DURATION_MS: 12000,
  DEFAULT_TOAST_DURATION_MS: 8000,
  useToast: () => ({
    toast: toastMock,
    dismiss: dismissMock,
    toasts: [],
  }),
}));

import { useToast } from '@/hooks/useToast';

describe('useToast helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an informational toast when a file is refreshed from disk', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showFileReloaded('Notes.md');
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Info',
      description: '"Notes.md" was refreshed from disk',
    });
  });

  it('uses a longer actionable toast with a reload action when a file can be reloaded', () => {
    const onReload = vi.fn();
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showFileModified('Notes.md', { onReload });
    });

    expect(toastMock).toHaveBeenCalledTimes(1);
    const payload = toastMock.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      title: 'Warning',
      description: '"Notes.md" was modified externally',
      duration: 12000,
    });
    expect(payload.action.props.altText).toBe('Reload file from disk');
    expect(payload.action.props.children).toBe('Reload file');

    act(() => {
      payload.action.props.onClick();
    });

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('marks loading toasts as non-expiring', () => {
    toastMock.mockReturnValue({
      id: 'loading-toast',
      dismiss: vi.fn(),
    });

    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showLoading('Syncing calendar');
    });

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Loading',
      description: 'Syncing calendar',
      duration: undefined,
    });
  });

  it('deduplicates repeated file-reloaded toasts inside the dedupe window', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showFileReloaded('Reloaded.md');
      result.current.showFileReloaded('Reloaded.md');
    });

    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it('allows another file-reloaded toast after the dedupe window expires', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showFileReloaded('Reloaded-again.md');
      result.current.showFileReloaded('Reloaded-again.md');
    });

    expect(toastMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(101);
      result.current.showFileReloaded('Reloaded-again.md');
    });

    expect(toastMock).toHaveBeenCalledTimes(2);
  });
});
