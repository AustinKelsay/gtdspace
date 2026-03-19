// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import type { MarkdownFile } from '@/types';
import { useFileManager } from '@/hooks/useFileManager';

const mocks = vi.hoisted(() => ({
  safeInvoke: vi.fn(),
  setLastFolder: vi.fn(),
  setEditorMode: vi.fn(),
  deserializeMarkersToMultiselects: vi.fn((content: string) => `DES:${content}`),
  serializeMultiselectsToMarkers: vi.fn((content: string) => `SER:${content}`),
}));

vi.mock('@/utils/safe-invoke', () => ({
  safeInvoke: mocks.safeInvoke,
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {
      theme: 'light',
      editor_mode: 'edit',
      last_folder: '',
    },
    setLastFolder: mocks.setLastFolder,
    setEditorMode: mocks.setEditorMode,
  }),
}));

vi.mock('@/utils/multiselect-block-helpers', () => ({
  deserializeMarkersToMultiselects: mocks.deserializeMarkersToMultiselects,
  serializeMultiselectsToMarkers: mocks.serializeMultiselectsToMarkers,
}));

function buildFile(path: string): MarkdownFile {
  return {
    id: path,
    name: path.split('/').pop() || 'file.md',
    path,
    size: 100,
    last_modified: 1700000000,
    extension: 'md',
  };
}

function renderFileManagerHook() {
  let current: ReturnType<typeof useFileManager> | null = null;

  const Harness = () => {
    current = useFileManager();
    return null;
  };

  render(<Harness />);

  return {
    getCurrent: () => {
      if (!current) {
        throw new Error('Hook state not initialized yet');
      }
      return current;
    },
  };
}

describe('useFileManager integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mocks.deserializeMarkersToMultiselects.mockImplementation((content: string) => `DES:${content}`);
    mocks.serializeMultiselectsToMarkers.mockImplementation((content: string) => `SER:${content}`);
    mocks.setLastFolder.mockResolvedValue(undefined);
    mocks.setEditorMode.mockResolvedValue(undefined);
    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'check_directory_exists') return true;
      if (command === 'list_markdown_files') return [];
      if (command === 'read_file') return '# raw';
      if (command === 'save_file') return 'ok';
      return null;
    });
  });

  it('initializes and seeds a missing folder, then loads markdown files', async () => {
    let checkExistsCalls = 0;
    const files = [buildFile('/new/workspace/README.md')];

    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'check_directory_exists') {
        checkExistsCalls += 1;
        return checkExistsCalls === 1 ? false : true;
      }
      if (command === 'initialize_gtd_space') return 'initialized';
      if (command === 'seed_example_gtd_content') return 'seeded';
      if (command === 'list_markdown_files') return files;
      return null;
    });

    const { getCurrent } = renderFileManagerHook();

    await act(async () => {
      await getCurrent().loadFolder('  /new/workspace  ');
    });

    await waitFor(() => {
      expect(getCurrent().state.currentFolder).toBe('/new/workspace');
      expect(getCurrent().state.files).toEqual(files);
      expect(getCurrent().state.error).toBeNull();
    });

    expect(mocks.safeInvoke).toHaveBeenCalledWith(
      'initialize_gtd_space',
      { spacePath: '/new/workspace' },
      null
    );
    expect(mocks.safeInvoke).toHaveBeenCalledWith(
      'seed_example_gtd_content',
      { spacePath: '/new/workspace' },
      null
    );
    expect(mocks.setLastFolder).toHaveBeenCalledWith('/new/workspace');
    expect(localStorage.getItem('gtdspace-current-path')).toBe('/new/workspace');
  });

  it('rejects corrupted GTD subfolder paths instead of re-initializing them', async () => {
    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'check_directory_exists') return false;
      if (command === 'check_is_gtd_space') return true;
      if (command === 'list_markdown_files') return [];
      return null;
    });

    const { getCurrent } = renderFileManagerHook();

    await act(async () => {
      await getCurrent().loadFolder('/root/GTD Space/Projects');
    });

    await waitFor(() => {
      expect(getCurrent().state.error).toContain('inside an existing GTD space');
      expect(getCurrent().state.currentFolder).toBeNull();
    });

    expect(
      mocks.safeInvoke.mock.calls.some(([command]) => command === 'initialize_gtd_space')
    ).toBe(false);
  });

  it('falls back to raw file content when marker deserialization fails', async () => {
    const file = buildFile('/mock/workspace/Task.md');
    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'read_file') return '# raw-content';
      return null;
    });
    mocks.deserializeMarkersToMultiselects.mockImplementation(() => {
      throw new Error('decode failed');
    });

    const { getCurrent } = renderFileManagerHook();

    await act(async () => {
      await getCurrent().loadFile(file);
    });

    await waitFor(() => {
      expect(getCurrent().state.currentFile?.path).toBe('/mock/workspace/Task.md');
      expect(getCurrent().state.fileContent).toBe('# raw-content');
      expect(getCurrent().state.error).toBeNull();
    });
  });

  it('serializes multiselect markers when saving the current file', async () => {
    const file = buildFile('/mock/workspace/Task.md');
    const { getCurrent } = renderFileManagerHook();

    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'read_file') return '# original';
      if (command === 'save_file') return 'saved';
      return null;
    });

    await act(async () => {
      await getCurrent().loadFile(file);
    });
    act(() => {
      getCurrent().updateContent('# edited');
    });

    await waitFor(() => {
      expect(getCurrent().state.hasUnsavedChanges).toBe(true);
    });

    await act(async () => {
      await getCurrent().saveCurrentFile();
    });

    expect(mocks.serializeMultiselectsToMarkers).toHaveBeenCalledWith('# edited');
    expect(mocks.safeInvoke).toHaveBeenCalledWith(
      'save_file',
      { path: '/mock/workspace/Task.md', content: 'SER:# edited' },
      null
    );
    await waitFor(() => {
      expect(getCurrent().state.hasUnsavedChanges).toBe(false);
      expect(getCurrent().state.autoSaveStatus).toBe('saved');
    });
  });

  it('sets error status when save_file fails', async () => {
    const file = buildFile('/mock/workspace/Fail.md');
    const { getCurrent } = renderFileManagerHook();

    mocks.safeInvoke.mockImplementation(async (command: string) => {
      if (command === 'read_file') return '# original';
      if (command === 'save_file') return null;
      return null;
    });

    await act(async () => {
      await getCurrent().loadFile(file);
    });
    act(() => {
      getCurrent().updateContent('# edited');
    });

    await waitFor(() => {
      expect(getCurrent().state.hasUnsavedChanges).toBe(true);
    });

    await act(async () => {
      await getCurrent().saveCurrentFile();
    });

    await waitFor(() => {
      expect(getCurrent().state.autoSaveStatus).toBe('error');
      expect(getCurrent().state.error).toContain('Failed to save file');
    });
  });
});
