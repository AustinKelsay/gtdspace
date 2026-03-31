// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toastHookMock } = vi.hoisted(() => ({
  toastHookMock: vi.fn(),
}));

vi.mock('@radix-ui/react-toast', async () => {
  const ReactModule = await import('react');

  return {
    Provider: ({ children }: { children: React.ReactNode }) => <div data-testid="toast-provider">{children}</div>,
    Viewport: ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => (
        <div ref={ref} data-testid="toast-viewport" {...props}>
          {children}
        </div>
      )
    ),
    Root: ReactModule.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & {
        duration?: number;
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
      }
    >(({ children, duration, onOpenChange: _onOpenChange, open, ...props }, ref) => (
      <div
        ref={ref}
        data-testid="toast-root"
        data-duration={duration}
        data-open={String(open)}
        {...props}
      >
        {children}
      </div>
    )),
    Title: ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
    Description: ReactModule.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
    Action: ReactModule.forwardRef<
      HTMLButtonElement,
      React.ButtonHTMLAttributes<HTMLButtonElement> & { altText?: string }
    >(({ children, ...props }, ref) => (
      <button ref={ref} type="button" {...props}>
        {children}
      </button>
    )),
    Close: ReactModule.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
      ({ children, ...props }, ref) => (
        <button ref={ref} type="button" {...props}>
          {children}
        </button>
      )
    ),
  };
});

vi.mock('@/hooks/use-toast', () => ({
  DEFAULT_TOAST_DURATION_MS: 8000,
  ACTION_TOAST_DURATION_MS: 12000,
  useToast: () => toastHookMock(),
}));

import { ToastViewport } from '@/components/ui/toast';
import { Toaster } from '@/components/ui/toaster';

describe('Toaster components', () => {
  beforeEach(() => {
    toastHookMock.mockReset();
    toastHookMock.mockReturnValue({
      toasts: [],
      dismiss: vi.fn(),
      toast: vi.fn(),
    });
  });

  it('renders the viewport as a fixed bottom-right upward stack', () => {
    render(<ToastViewport />);

    const viewport = screen.getByTestId('toast-viewport');
    expect(viewport).toHaveClass('fixed');
    expect(viewport).toHaveClass('bottom-0');
    expect(viewport).toHaveClass('right-0');
    expect(viewport).toHaveClass('flex-col-reverse');
    expect(viewport.className).toContain('max-w-[420px]');
  });

  it('forwards default and actionable toast durations', () => {
    toastHookMock.mockReturnValue({
      dismiss: vi.fn(),
      toast: vi.fn(),
      toasts: [
        {
          id: 'toast-default',
          open: true,
          title: 'Info',
          description: 'Default duration',
        },
        {
          id: 'toast-action',
          open: true,
          title: 'Warning',
          description: 'Action duration',
          duration: 12000,
        },
      ],
    });

    render(<Toaster />);

    const toasts = screen.getAllByTestId('toast-root');
    expect(toasts[0]).toHaveAttribute('data-duration', '8000');
    expect(toasts[1]).toHaveAttribute('data-duration', '12000');
  });

  it('keeps loading toasts open until they are dismissed', () => {
    toastHookMock.mockReturnValue({
      dismiss: vi.fn(),
      toast: vi.fn(),
      toasts: [
        {
          id: 'toast-loading',
          open: true,
          title: 'Loading',
          description: 'Syncing calendar',
        },
      ],
    });

    render(<Toaster />);

    const toast = screen.getByTestId('toast-root');
    expect(toast).not.toHaveAttribute('data-duration');
  });

  it('renders an accessible dismiss label on the close control', () => {
    toastHookMock.mockReturnValue({
      dismiss: vi.fn(),
      toast: vi.fn(),
      toasts: [
        {
          id: 'toast-info',
          open: true,
          title: 'Info',
          description: 'Dismiss me',
        },
      ],
    });

    render(<Toaster />);

    expect(
      screen.getByRole('button', { name: 'Dismiss notification' })
    ).toBeInTheDocument();
  });
});
