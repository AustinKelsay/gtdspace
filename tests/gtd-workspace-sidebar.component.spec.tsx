// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GTDWorkspaceSidebar } from '@/components/gtd/GTDWorkspaceSidebar';

vi.mock('@/hooks/useGTDSpace', () => ({
  useGTDSpace: () => ({
    gtdSpace: null,
    isLoading: false,
    checkGTDSpace: vi.fn().mockResolvedValue(false),
    loadProjects: vi.fn().mockResolvedValue([]),
  }),
}));

describe('GTDWorkspaceSidebar component', () => {
  const baseProps = {
    onFolderSelect: vi.fn(),
    onFileSelect: vi.fn(),
    onRefresh: vi.fn(),
  };

  it('renders welcome empty state when no folder is selected', () => {
    render(<GTDWorkspaceSidebar currentFolder={null} {...baseProps} />);

    expect(screen.getByText('Welcome to GTD Space')).toBeInTheDocument();
    expect(
      screen.getByText('Select a folder to create or open a GTD workspace')
    ).toBeInTheDocument();
  });

  it('renders non-GTD message when selected folder is not initialized as GTD space', () => {
    render(
      <GTDWorkspaceSidebar
        currentFolder="/tmp/not-gtd-space"
        gtdSpace={{
          root_path: '/tmp/not-gtd-space',
          is_initialized: false,
          isGTDSpace: false,
          projects: [],
        }}
        checkGTDSpace={vi.fn().mockResolvedValue(false)}
        loadProjects={vi.fn().mockResolvedValue([])}
        {...baseProps}
      />
    );

    expect(screen.getByText('This is not a GTD workspace')).toBeInTheDocument();
    expect(screen.getByText('Initialize from the prompt')).toBeInTheDocument();
  });
});
