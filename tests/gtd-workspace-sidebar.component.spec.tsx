// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { GTDWorkspaceSidebar } from '@/components/gtd/GTDWorkspaceSidebar';
import { emitContentSaved, emitMetadataChange } from '@/utils/content-event-bus';
import type { GTDProject, GTDSpace, MarkdownFile } from '@/types';

const safeInvokeMock = vi.fn();
const readFileTextMock = vi.fn();
const useGTDSpaceMock = vi.fn();

vi.mock('@/hooks/useGTDSpace', () => ({
  useGTDSpace: () => useGTDSpaceMock(),
}));

vi.mock('@/utils/safe-invoke', () => ({
  safeInvoke: (...args: unknown[]) => safeInvokeMock(...args),
}));

vi.mock('@/hooks/useFileManager', () => ({
  readFileText: (...args: unknown[]) => readFileTextMock(...args),
}));

vi.mock('@/components/gtd/GTDProjectDialog', () => ({
  GTDProjectDialog: () => null,
}));

vi.mock('@/components/gtd/GTDActionDialog', () => ({
  GTDActionDialog: () => null,
}));

vi.mock('@/components/gtd/CreatePageDialog', () => ({
  CreatePageDialog: () => null,
}));

vi.mock('@/components/gtd/CreateHabitDialog', () => ({
  CreateHabitDialog: () => null,
}));

const rootPath = '/tmp/gtd-space';

const activeProject: GTDProject = {
  name: 'Project Alpha',
  description: 'Alpha delivery',
  status: 'in-progress',
  path: `${rootPath}/Projects/Project Alpha`,
  dueDate: '2026-03-30',
  createdDateTime: '2026-03-01T10:00:00Z',
  action_count: 4,
};

const completedProject: GTDProject = {
  name: 'Project Done',
  description: 'Done work',
  status: 'completed',
  path: `${rootPath}/Projects/Project Done`,
  dueDate: undefined,
  createdDateTime: '2026-02-01T10:00:00Z',
  action_count: 0,
};

const cancelledProject: GTDProject = {
  name: 'Project Cancelled',
  description: 'Stopped work',
  status: 'cancelled',
  path: `${rootPath}/Projects/Project Cancelled`,
  dueDate: undefined,
  createdDateTime: '2026-02-10T10:00:00Z',
  action_count: 0,
};

const gtdSpace: GTDSpace = {
  root_path: rootPath,
  is_initialized: true,
  isGTDSpace: true,
  projects: [activeProject, completedProject, cancelledProject],
  total_actions: 4,
};

const projectActions: MarkdownFile[] = [
  {
    id: `${activeProject.path}/Write spec.md`,
    name: 'Write spec.md',
    path: `${activeProject.path}/Write spec.md`,
    size: 100,
    last_modified: 1,
    extension: 'md',
  },
  {
    id: `${activeProject.path}/Clean desk.md`,
    name: 'Clean desk.md',
    path: `${activeProject.path}/Clean desk.md`,
    size: 100,
    last_modified: 1,
    extension: 'md',
  },
  {
    id: `${activeProject.path}/Waiting on legal.md`,
    name: 'Waiting on legal.md',
    path: `${activeProject.path}/Waiting on legal.md`,
    size: 100,
    last_modified: 1,
    extension: 'md',
  },
  {
    id: `${activeProject.path}/Old draft.md`,
    name: 'Old draft.md',
    path: `${activeProject.path}/Old draft.md`,
    size: 100,
    last_modified: 1,
    extension: 'md',
  },
];

const markdownFile = (path: string, name: string): MarkdownFile => ({
  id: path,
  name,
  path,
  size: 100,
  last_modified: 1,
  extension: 'md',
});

const renderSidebar = (overrides: Partial<React.ComponentProps<typeof GTDWorkspaceSidebar>> = {}) =>
  render(
    <GTDWorkspaceSidebar
      currentFolder={rootPath}
      gtdSpace={gtdSpace}
      checkGTDSpace={vi.fn().mockResolvedValue(true)}
      loadProjects={vi.fn().mockResolvedValue(gtdSpace.projects || [])}
      onFolderSelect={vi.fn()}
      onFileSelect={vi.fn()}
      onRefresh={vi.fn()}
      {...overrides}
    />
  );

describe('GTDWorkspaceSidebar component', () => {
  const baseProps = {
    onFolderSelect: vi.fn(),
    onFileSelect: vi.fn(),
    onRefresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useGTDSpaceMock.mockReturnValue({
      gtdSpace: null,
      isLoading: false,
      checkGTDSpace: vi.fn().mockResolvedValue(false),
      loadProjects: vi.fn().mockResolvedValue([]),
    });
    readFileTextMock.mockImplementation(async (path: string) => {
      if (path.endsWith('Write spec.md')) {
        return '# Write spec\n\n[!singleselect:status:in-progress]\n[!datetime:due_date:2026-03-29]';
      }
      if (path.endsWith('Clean desk.md')) {
        return '# Clean desk\n\n[!singleselect:status:done]';
      }
      if (path.endsWith('Waiting on legal.md')) {
        return '# Waiting on legal\n\n[!singleselect:status:waiting_for]';
      }
      if (path.endsWith('Old draft.md')) {
        return '# Old draft\n\n[!singleselect:status:canceled]';
      }
      return '# File';
    });
  });

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

  it('renders projects, preloaded sections, and completed buckets for an initialized GTD workspace', async () => {
    let habitsLoadCount = 0;

    safeInvokeMock.mockImplementation(
      async (command: string, args?: { path?: string; projectPath?: string }, fallback?: unknown) => {
        if (command === 'check_directory_exists') {
          return true;
        }

        if (command === 'list_project_actions' && args?.projectPath === activeProject.path) {
          return projectActions;
        }

        if (command === 'list_markdown_files') {
          switch (args?.path) {
            case `${rootPath}/Habits`:
              habitsLoadCount += 1;
              return [
                markdownFile(
                  `${rootPath}/Habits/${habitsLoadCount > 1 ? 'Habit Renamed' : 'Morning Run'}.md`,
                  `${habitsLoadCount > 1 ? 'Habit Renamed' : 'Morning Run'}.md`
                ),
              ];
            case `${rootPath}/Areas of Focus`:
              return [
                markdownFile(`${rootPath}/Areas of Focus/README.md`, 'README.md'),
                markdownFile(`${rootPath}/Areas of Focus/Health.md`, 'Health.md'),
              ];
            case `${rootPath}/Goals`:
              return [];
            case `${rootPath}/Vision`:
            case `${rootPath}/Purpose & Principles`:
            case `${rootPath}/Someday Maybe`:
            case `${rootPath}/Cabinet`:
              return [];
            default:
              return fallback ?? [];
          }
        }

        if (command === 'read_file') {
          return '# README';
        }

        if (command === 'save_file') {
          return 'ok';
        }

        return fallback ?? null;
      }
    );

    renderSidebar();

    expect(await screen.findByText('Project Alpha')).toBeInTheDocument();
    expect(await screen.findByText('Morning Run')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('2 Actions')).toBeInTheDocument();
      expect(screen.getByText('2 actions')).toBeInTheDocument();
    });
    expect(screen.getByText('Completed Projects')).toBeInTheDocument();
    expect(screen.getByText('Cancelled Projects')).toBeInTheDocument();
    expect(screen.queryByText('Project Cancelled')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand Project Alpha'));

    expect(await screen.findByText('Write spec')).toBeInTheDocument();
    expect(screen.getByText('Waiting on legal')).toBeInTheDocument();
    expect(screen.queryByText('Old draft')).not.toBeInTheDocument();

    const completedActionsGroup = screen.getByText('Completed Actions').closest('[data-sidebar-group="completed-actions"]');
    expect(completedActionsGroup).toBeTruthy();
    expect(within(completedActionsGroup as HTMLElement).getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Completed Actions'));
    expect(await screen.findByText('Clean desk')).toBeInTheDocument();
    expect(screen.queryByText('Old draft')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Completed Projects'));
    expect(await screen.findByText('Project Done')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancelled Projects'));
    expect(await screen.findByText('Project Cancelled')).toBeInTheDocument();
  });

  it('shows cross-section search results for projects, actions, and section files', async () => {
    safeInvokeMock.mockImplementation(
      async (command: string, args?: { path?: string; projectPath?: string }, fallback?: unknown) => {
        if (command === 'check_directory_exists') {
          return true;
        }

        if (command === 'list_project_actions' && args?.projectPath === activeProject.path) {
          return projectActions;
        }

        if (command === 'list_markdown_files') {
          switch (args?.path) {
            case `${rootPath}/Habits`:
              return [markdownFile(`${rootPath}/Habits/Morning Run.md`, 'Morning Run.md')];
            case `${rootPath}/Areas of Focus`:
              return [markdownFile(`${rootPath}/Areas of Focus/README.md`, 'README.md')];
            case `${rootPath}/Goals`:
            case `${rootPath}/Vision`:
            case `${rootPath}/Purpose & Principles`:
            case `${rootPath}/Someday Maybe`:
            case `${rootPath}/Cabinet`:
              return [];
            default:
              return fallback ?? [];
          }
        }

        if (command === 'read_file') return '# README';
        if (command === 'save_file') return 'ok';
        return fallback ?? null;
      }
    );

    renderSidebar();

    await screen.findByText('Project Alpha');
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'clean' },
    });
    expect(await screen.findByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Clean desk')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'morning' },
    });
    expect(await screen.findByText('Habits')).toBeInTheDocument();
    expect(screen.getByText('Morning Run')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'alpha' },
    });
    expect(await screen.findByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
  });

  it('reloads a section when content events report a file change inside it', async () => {
    let habitsLoadCount = 0;

    safeInvokeMock.mockImplementation(
      async (command: string, args?: { path?: string; projectPath?: string }, fallback?: unknown) => {
        if (command === 'check_directory_exists') {
          return true;
        }

        if (command === 'list_project_actions' && args?.projectPath === activeProject.path) {
          return projectActions;
        }

        if (command === 'list_markdown_files') {
          switch (args?.path) {
            case `${rootPath}/Habits`:
              habitsLoadCount += 1;
              return [
                markdownFile(
                  `${rootPath}/Habits/${habitsLoadCount > 1 ? 'Habit Renamed' : 'Morning Run'}.md`,
                  `${habitsLoadCount > 1 ? 'Habit Renamed' : 'Morning Run'}.md`
                ),
              ];
            case `${rootPath}/Areas of Focus`:
            case `${rootPath}/Goals`:
            case `${rootPath}/Vision`:
            case `${rootPath}/Purpose & Principles`:
            case `${rootPath}/Someday Maybe`:
            case `${rootPath}/Cabinet`:
              return [];
            default:
              return fallback ?? [];
          }
        }

        if (command === 'read_file') return '# README';
        if (command === 'save_file') return 'ok';
        return fallback ?? null;
      }
    );

    renderSidebar();

    expect(await screen.findByText('Morning Run')).toBeInTheDocument();

    act(() => {
      emitMetadataChange({
        filePath: `${rootPath}/Habits/Morning Run.md`,
        fileName: 'Morning Run.md',
        content: '# Morning Run',
        metadata: { title: 'Habit Renamed' } as never,
        changedFields: { title: 'Habit Renamed' } as never,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Habit Renamed')).toBeInTheDocument();
    });

    const habitListCalls = (safeInvokeMock as Mock).mock.calls.filter(
      ([command, args]) => command === 'list_markdown_files' && args?.path === `${rootPath}/Habits`
    );
    expect(habitListCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not preload missing alias section paths when the canonical directory exists', async () => {
    safeInvokeMock.mockImplementation(
      async (command: string, args?: { path?: string; projectPath?: string }, fallback?: unknown) => {
        if (command === 'check_directory_exists') {
          return args?.path === `${rootPath}/Purpose & Principles`;
        }

        if (command === 'list_project_actions' && args?.projectPath === activeProject.path) {
          return projectActions;
        }

        if (command === 'list_markdown_files') {
          switch (args?.path) {
            case `${rootPath}/Habits`:
            case `${rootPath}/Areas of Focus`:
            case `${rootPath}/Goals`:
            case `${rootPath}/Vision`:
            case `${rootPath}/Purpose & Principles`:
            case `${rootPath}/Someday Maybe`:
            case `${rootPath}/Cabinet`:
              return [];
            default:
              return fallback ?? [];
          }
        }

        if (command === 'read_file') return '# README';
        if (command === 'save_file') return 'ok';
        return fallback ?? null;
      }
    );

    renderSidebar();

    expect(await screen.findByText('Project Alpha')).toBeInTheDocument();

    await waitFor(() => {
      const listCalls = (safeInvokeMock as Mock).mock.calls
        .filter(([command]) => command === 'list_markdown_files')
        .map(([, args]) => args?.path);

      expect(listCalls).toContain(`${rootPath}/Purpose & Principles`);
      expect(listCalls).not.toContain(`${rootPath}/Purpose and Principles`);
    });
  });

  it.each([
    { label: 'false', result: false },
    { label: 'null', result: null },
  ])(
    'skips stale alias section reloads when the reported directory check returns $label',
    async ({ result }) => {
      safeInvokeMock.mockImplementation(
        async (command: string, args?: { path?: string; projectPath?: string }, fallback?: unknown) => {
          if (command === 'check_directory_exists') {
            if (args?.path === `${rootPath}/Purpose and Principles`) {
              return result;
            }
            return true;
          }

          if (command === 'list_project_actions' && args?.projectPath === activeProject.path) {
            return projectActions;
          }

          if (command === 'list_markdown_files') {
            switch (args?.path) {
              case `${rootPath}/Habits`:
              case `${rootPath}/Areas of Focus`:
              case `${rootPath}/Goals`:
              case `${rootPath}/Vision`:
              case `${rootPath}/Purpose & Principles`:
              case `${rootPath}/Someday Maybe`:
              case `${rootPath}/Cabinet`:
                return [];
              default:
                return fallback ?? [];
            }
          }

          if (command === 'read_file') return '# README';
          if (command === 'save_file') return 'ok';
          return fallback ?? null;
        }
      );

      renderSidebar();

      expect(await screen.findByText('Project Alpha')).toBeInTheDocument();

      act(() => {
        emitMetadataChange({
          filePath: `${rootPath}/Purpose and Principles/Focus.md`,
          fileName: 'Focus.md',
          content: '# Focus',
          metadata: { title: 'Focus' } as never,
          changedFields: { title: 'Focus' } as never,
        });
      });

      await waitFor(() => {
        const aliasListCalls = (safeInvokeMock as Mock).mock.calls.filter(
          ([command, args]) =>
            command === 'list_markdown_files' && args?.path === `${rootPath}/Purpose and Principles`
        );
        expect(aliasListCalls).toHaveLength(0);
      });
    }
  );

  it('resolves stale alias section reloads even before the workspace root is hydrated', async () => {
    safeInvokeMock.mockImplementation(
      async (command: string, args?: { path?: string; projectPath?: string }, fallback?: unknown) => {
        if (command === 'check_directory_exists') {
          if (args?.path === `${rootPath}/Purpose and Principles`) {
            return false;
          }
          if (args?.path === `${rootPath}/Purpose & Principles`) {
            return true;
          }
          return false;
        }

        if (command === 'list_markdown_files') {
          if (args?.path === `${rootPath}/Purpose & Principles`) {
            return [markdownFile(`${rootPath}/Purpose & Principles/Focus.md`, 'Focus.md')];
          }
          return fallback ?? [];
        }

        if (command === 'read_file') return '# README';
        if (command === 'save_file') return 'ok';
        return fallback ?? null;
      }
    );

    render(<GTDWorkspaceSidebar currentFolder={null} {...baseProps} />);

    act(() => {
      emitMetadataChange({
        filePath: `${rootPath}/Purpose and Principles/Focus.md`,
        fileName: 'Focus.md',
        content: '# Focus',
        metadata: { title: 'Focus' } as never,
        changedFields: { title: 'Focus' } as never,
      });
    });

    await waitFor(() => {
      const canonicalListCalls = (safeInvokeMock as Mock).mock.calls.filter(
        ([command, args]) =>
          command === 'list_markdown_files' && args?.path === `${rootPath}/Purpose & Principles`
      );
      expect(canonicalListCalls.length).toBeGreaterThan(0);
    });

    const aliasListCalls = (safeInvokeMock as Mock).mock.calls.filter(
      ([command, args]) =>
        command === 'list_markdown_files' && args?.path === `${rootPath}/Purpose and Principles`
    );
    expect(aliasListCalls).toHaveLength(0);
  });

  it('resolves stale alias section reloads back to the canonical folder', async () => {
    safeInvokeMock.mockImplementation(
      async (command: string, args?: { path?: string; projectPath?: string }, fallback?: unknown) => {
        if (command === 'check_directory_exists') {
          if (args?.path === `${rootPath}/Purpose and Principles`) {
            return false;
          }
          return true;
        }

        if (command === 'list_project_actions' && args?.projectPath === activeProject.path) {
          return projectActions;
        }

        if (command === 'list_markdown_files') {
          switch (args?.path) {
            case `${rootPath}/Habits`:
            case `${rootPath}/Areas of Focus`:
            case `${rootPath}/Goals`:
            case `${rootPath}/Vision`:
            case `${rootPath}/Someday Maybe`:
            case `${rootPath}/Cabinet`:
              return [];
            case `${rootPath}/Purpose & Principles`:
              return [markdownFile(`${rootPath}/Purpose & Principles/Focus.md`, 'Focus.md')];
            default:
              return fallback ?? [];
          }
        }

        if (command === 'read_file') return '# README';
        if (command === 'save_file') return 'ok';
        return fallback ?? null;
      }
    );

    renderSidebar();

    expect(await screen.findByText('Project Alpha')).toBeInTheDocument();

    const countCanonicalListCalls = () =>
      (safeInvokeMock as Mock).mock.calls.filter(
        ([command, args]) =>
          command === 'list_markdown_files' && args?.path === `${rootPath}/Purpose & Principles`
      ).length;

    const canonicalCallCountBeforeMetadataChange = countCanonicalListCalls();

    act(() => {
      emitMetadataChange({
        filePath: `${rootPath}/Purpose and Principles/Focus.md`,
        fileName: 'Focus.md',
        content: '# Focus',
        metadata: { title: 'Focus' } as never,
        changedFields: { title: 'Focus' } as never,
      });
    });

    await waitFor(() => {
      expect(countCanonicalListCalls()).toBeGreaterThan(canonicalCallCountBeforeMetadataChange);
    });

    const aliasListCalls = (safeInvokeMock as Mock).mock.calls.filter(
      ([command, args]) =>
        command === 'list_markdown_files' && args?.path === `${rootPath}/Purpose and Principles`
    );

    expect(aliasListCalls).toHaveLength(0);
  });

  it('does not let stale section loads overwrite the next workspace after a root switch', async () => {
    const firstRoot = '/tmp/gtd-space-a';
    const secondRoot = '/tmp/gtd-space-b';
    const firstSpace: GTDSpace = {
      root_path: firstRoot,
      is_initialized: true,
      isGTDSpace: true,
      projects: [],
      total_actions: 0,
    };
    const secondSpace: GTDSpace = {
      root_path: secondRoot,
      is_initialized: true,
      isGTDSpace: true,
      projects: [],
      total_actions: 0,
    };
    let resolveFirstHabits:
      | ((files: MarkdownFile[]) => void)
      | undefined;

    safeInvokeMock.mockImplementation(
      async (command: string, args?: { path?: string }, fallback?: unknown) => {
        if (command === 'check_directory_exists') {
          return true;
        }

        if (command === 'list_markdown_files') {
          switch (args?.path) {
            case `${firstRoot}/Habits`:
              return new Promise<MarkdownFile[]>((resolve) => {
                resolveFirstHabits = resolve;
              });
            case `${secondRoot}/Habits`:
              return [markdownFile(`${secondRoot}/Habits/Second Habit.md`, 'Second Habit.md')];
            case `${firstRoot}/Areas of Focus`:
            case `${firstRoot}/Goals`:
            case `${firstRoot}/Vision`:
            case `${firstRoot}/Purpose & Principles`:
            case `${firstRoot}/Someday Maybe`:
            case `${firstRoot}/Cabinet`:
            case `${secondRoot}/Areas of Focus`:
            case `${secondRoot}/Goals`:
            case `${secondRoot}/Vision`:
            case `${secondRoot}/Purpose & Principles`:
            case `${secondRoot}/Someday Maybe`:
            case `${secondRoot}/Cabinet`:
              return [];
            default:
              return fallback ?? [];
          }
        }

        if (command === 'read_file') return '# README';
        if (command === 'save_file') return 'ok';
        return fallback ?? null;
      }
    );

    const loadProjects = vi.fn().mockResolvedValue([]);
    const { rerender } = render(
      <GTDWorkspaceSidebar
        currentFolder={firstRoot}
        gtdSpace={firstSpace}
        checkGTDSpace={vi.fn().mockResolvedValue(true)}
        loadProjects={loadProjects}
        onFolderSelect={vi.fn()}
        onFileSelect={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(resolveFirstHabits).toBeTypeOf('function');
    });

    rerender(
      <GTDWorkspaceSidebar
        currentFolder={secondRoot}
        gtdSpace={secondSpace}
        checkGTDSpace={vi.fn().mockResolvedValue(true)}
        loadProjects={loadProjects}
        onFolderSelect={vi.fn()}
        onFileSelect={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(await screen.findByText('Second Habit')).toBeInTheDocument();

    await act(async () => {
      resolveFirstHabits?.([
        markdownFile(`${firstRoot}/Habits/First Habit.md`, 'First Habit.md'),
      ]);
    });

    await waitFor(() => {
      expect(screen.getByText('Second Habit')).toBeInTheDocument();
      expect(screen.queryByText('First Habit')).not.toBeInTheDocument();
    });
  });

  it('does not reload an empty workspace after project hydration completes', async () => {
    const emptySpace: GTDSpace = {
      root_path: rootPath,
      is_initialized: true,
      isGTDSpace: true,
      projects: [],
      total_actions: 0,
    };

    safeInvokeMock.mockImplementation(
      async (command: string, _args?: { path?: string; projectPath?: string }, fallback?: unknown) => {
        if (command === 'check_directory_exists') {
          return true;
        }

        if (command === 'list_markdown_files') {
          return [];
        }

        if (command === 'read_file') return '# README';
        if (command === 'save_file') return 'ok';
        return fallback ?? null;
      }
    );

    const loadProjects = vi.fn().mockResolvedValue([]);
    const { rerender } = render(
      <GTDWorkspaceSidebar
        currentFolder={rootPath}
        gtdSpace={emptySpace}
        checkGTDSpace={vi.fn().mockResolvedValue(true)}
        loadProjects={loadProjects}
        onFolderSelect={vi.fn()}
        onFileSelect={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(loadProjects).toHaveBeenCalledTimes(1);
    });

    rerender(
      <GTDWorkspaceSidebar
        currentFolder={rootPath}
        gtdSpace={{ ...emptySpace, projects: [] }}
        checkGTDSpace={vi.fn().mockResolvedValue(true)}
        loadProjects={loadProjects}
        onFolderSelect={vi.fn()}
        onFileSelect={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadProjects).toHaveBeenCalledTimes(1);
  });

  it('does not treat equivalent root paths as a new workspace generation', async () => {
    const windowsRoot = 'C:\\tmp\\gtd-space';
    const normalizedRoot = 'C:/tmp/gtd-space';
    const firstSpace: GTDSpace = {
      root_path: windowsRoot,
      is_initialized: true,
      isGTDSpace: true,
      projects: [],
      total_actions: 0,
    };
    const secondSpace: GTDSpace = {
      root_path: normalizedRoot,
      is_initialized: true,
      isGTDSpace: true,
      projects: [],
      total_actions: 0,
    };

    safeInvokeMock.mockImplementation(
      async (command: string, _args?: { path?: string; projectPath?: string }, fallback?: unknown) => {
        if (command === 'check_directory_exists') {
          return true;
        }

        if (command === 'list_markdown_files') {
          return [];
        }

        if (command === 'read_file') return '# README';
        if (command === 'save_file') return 'ok';
        return fallback ?? null;
      }
    );

    const loadProjects = vi.fn().mockResolvedValue([]);
    const { rerender } = render(
      <GTDWorkspaceSidebar
        currentFolder={windowsRoot}
        gtdSpace={firstSpace}
        checkGTDSpace={vi.fn().mockResolvedValue(true)}
        loadProjects={loadProjects}
        onFolderSelect={vi.fn()}
        onFileSelect={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(loadProjects).toHaveBeenCalledTimes(1);
    });

    rerender(
      <GTDWorkspaceSidebar
        currentFolder={normalizedRoot}
        gtdSpace={secondSpace}
        checkGTDSpace={vi.fn().mockResolvedValue(true)}
        loadProjects={loadProjects}
        onFolderSelect={vi.fn()}
        onFileSelect={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadProjects).toHaveBeenCalledTimes(1);
  });
  it('renders project due-date overlays before the project reload settles after README saves', async () => {
    let resolveProjects: ((projects: GTDProject[]) => void) | undefined;

    safeInvokeMock.mockImplementation(
      async (command: string, args?: { path?: string; projectPath?: string }, fallback?: unknown) => {
        if (command === 'check_directory_exists') {
          return true;
        }

        if (command === 'list_project_actions' && args?.projectPath === activeProject.path) {
          return projectActions;
        }

        if (command === 'list_markdown_files') {
          switch (args?.path) {
            case `${rootPath}/Habits`:
            case `${rootPath}/Areas of Focus`:
            case `${rootPath}/Goals`:
            case `${rootPath}/Vision`:
            case `${rootPath}/Purpose & Principles`:
            case `${rootPath}/Someday Maybe`:
            case `${rootPath}/Cabinet`:
              return [];
            default:
              return fallback ?? [];
          }
        }

        if (command === 'read_file') return '# README';
        if (command === 'save_file') return 'ok';
        return fallback ?? null;
      }
    );

    const loadProjects = vi.fn().mockImplementation(
      async () =>
        new Promise<GTDProject[]>((resolve) => {
          resolveProjects = resolve;
        })
    );

    render(
      <GTDWorkspaceSidebar
        currentFolder={rootPath}
        gtdSpace={gtdSpace}
        checkGTDSpace={vi.fn().mockResolvedValue(true)}
        loadProjects={loadProjects}
        onFolderSelect={vi.fn()}
        onFileSelect={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(await screen.findByText('Project Alpha')).toBeInTheDocument();

    act(() => {
      emitContentSaved({
        filePath: `${activeProject.path}/README.markdown`,
        fileName: 'README.markdown',
        content: '# Project Alpha',
        metadata: {
          title: 'Project Alpha',
          due_date: '2026-04-20',
        } as never,
      });
    });

    expect(
      await screen.findByText(new Date(2026, 3, 20).toLocaleDateString())
    ).toBeInTheDocument();
    expect(loadProjects).toHaveBeenCalledWith(rootPath);

    await act(async () => {
      resolveProjects?.(gtdSpace.projects || []);
    });
  });
});
