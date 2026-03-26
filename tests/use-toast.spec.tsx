// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.fn();
const dismissMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
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
