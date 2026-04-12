// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CalendarView } from '@/components/calendar/CalendarView';
import type { CalendarItem } from '@/hooks/useCalendarData';
import type { GTDSpace, MarkdownFile } from '@/types';

const mocks = vi.hoisted(() => ({
  checkTauriContextAsync: vi.fn(),
  toast: vi.fn(),
  useCalendarData: vi.fn(),
}));

vi.mock('@/utils/tauri-ready', () => ({
  checkTauriContextAsync: (...args: unknown[]) => mocks.checkTauriContextAsync(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

vi.mock('@/hooks/useCalendarData', () => ({
  useCalendarData: (...args: unknown[]) => mocks.useCalendarData(...args),
}));

vi.mock('@/components/calendar/EventDetailModal', () => ({
  EventDetailModal: () => null,
}));

const timedFocusItem: CalendarItem = {
  id: 'action-1',
  name: 'Timed focus',
  path: '/space/Projects/Alpha/Task.md',
  type: 'action',
  status: 'in-progress',
  focusDate: '2026-04-15T09:00:00',
  projectName: 'Alpha',
  effort: 'medium',
};

const untimedDueItem: CalendarItem = {
  id: 'project-1',
  name: 'Due today',
  path: '/space/Projects/Alpha/README.md',
  type: 'project',
  status: 'in-progress',
  dueDate: '2026-04-15',
};

const baseSpace = {
  root_path: '/space',
  isGTDSpace: true,
  projects: [],
} as GTDSpace;

const baseFiles: MarkdownFile[] = [];

const renderCalendar = (items: CalendarItem[] = []) => {
  mocks.useCalendarData.mockReturnValue({
    items,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  });

  return render(
    <CalendarView
      onFileSelect={vi.fn()}
      spacePath="/space"
      gtdSpace={baseSpace}
      files={baseFiles}
    />
  );
};

describe('CalendarView day mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:30:00'));
    mocks.checkTauriContextAsync.mockReset();
    mocks.checkTauriContextAsync.mockResolvedValue(false);
    mocks.toast.mockReset();
    mocks.useCalendarData.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('adds a day mode and supports drill-in from month and week views', () => {
    renderCalendar([timedFocusItem, untimedDueItem]);

    expect(screen.getByRole('button', { name: 'Day' })).toBeInTheDocument();
    expect(screen.getByText('Week of Apr 12, 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    fireEvent.click(screen.getByTestId('month-day-cell-2026-04-15'));
    expect(screen.getByText('Wednesday, Apr 15, 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    fireEvent.click(screen.getByTestId('week-day-header-2026-04-15'));
    expect(screen.getByText('Wednesday, Apr 15, 2026')).toBeInTheDocument();
  });

  it('navigates day view one day at a time and separates timed vs untimed events', () => {
    renderCalendar([timedFocusItem, untimedDueItem]);

    fireEvent.click(screen.getByRole('button', { name: 'Day' }));

    expect(screen.getByText('Wednesday, Apr 15, 2026')).toBeInTheDocument();
    expect(screen.getByTestId('untimed-cell-2026-04-15')).toHaveTextContent('Due today');
    expect(screen.getByTestId('hour-cell-2026-04-15-9')).toHaveTextContent('Timed focus');

    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(screen.getByText('Thursday, Apr 16, 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(screen.getByText('Wednesday, Apr 15, 2026')).toBeInTheDocument();
  });
});
