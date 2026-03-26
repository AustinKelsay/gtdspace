// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

import { GitSyncDiffReviewDialog } from '@/components/git-sync/GitSyncDiffReviewDialog';

const preview = {
  hasBaseline: true,
  baselineBackupFile: 'backup-20260325.enc',
  baselineTimestamp: '2026-03-25T12:00:00Z',
  summary: {
    totalEntries: 2,
    added: 1,
    modified: 1,
    deleted: 0,
    renamed: 0,
    unchangedExcluded: 0,
    textDiffs: 1,
    binaryDiffs: 1,
    beforeBytes: 10,
    afterBytes: 20,
  },
  entries: [
    {
      id: 'modified:Projects/Alpha/README.md',
      path: 'Projects/Alpha/README.md',
      changeType: 'modified' as const,
      kind: 'text' as const,
      oldPath: null,
      isTruncated: false,
      text: {
        beforeHash: 'aaa',
        afterHash: 'bbb',
        beforeBytes: 10,
        afterBytes: 12,
        lineStats: {
          added: 1,
          removed: 1,
        },
        hunks: [
          {
            oldStart: 1,
            oldLines: 2,
            newStart: 1,
            newLines: 2,
            lines: [
              { kind: 'context' as const, oldLineNumber: 1, newLineNumber: 1, content: '# Alpha' },
              { kind: 'remove' as const, oldLineNumber: 2, newLineNumber: null, content: 'old' },
              { kind: 'add' as const, oldLineNumber: null, newLineNumber: 2, content: 'new' },
            ],
          },
        ],
      },
      binary: null,
    },
    {
      id: 'added:assets/logo.png',
      path: 'assets/logo.png',
      changeType: 'added' as const,
      kind: 'binary' as const,
      oldPath: null,
      isTruncated: false,
      text: null,
      binary: {
        beforeHash: null,
        afterHash: 'ccc',
        beforeBytes: null,
        afterBytes: 3000,
        mime: 'image/png',
      },
    },
  ],
  truncated: false,
  warnings: ['Preview contains truncated entries to keep the diff responsive.'],
};

describe('GitSyncDiffReviewDialog', () => {
  it('renders summary, warnings, and text diff details', () => {
    render(
      <GitSyncDiffReviewDialog
        open
        onOpenChange={() => undefined}
        preview={preview}
        onConfirm={() => undefined}
      />,
    );

    expect(screen.getByText('Review Encrypted Backup Diff')).toBeInTheDocument();
    expect(screen.getByText('2 changed')).toBeInTheDocument();
    expect(screen.getByText('Preview contains truncated entries to keep the diff responsive.')).toBeInTheDocument();
    expect(screen.getAllByText('Projects/Alpha/README.md')).toHaveLength(2);
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
  });

  it('filters to binary entries and renders binary metadata', () => {
    render(
      <GitSyncDiffReviewDialog
        open
        onOpenChange={() => undefined}
        preview={preview}
        onConfirm={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Binary' }));
    fireEvent.click(screen.getByRole('button', { name: /assets\/logo\.png/ }));

    expect(screen.getByText('MIME: image/png')).toBeInTheDocument();
    expect(screen.getByText(/Hash: ccc/)).toBeInTheDocument();
  });

  it('calls confirm when the user accepts the review', () => {
    const onConfirm = vi.fn();

    render(
      <GitSyncDiffReviewDialog
        open
        onOpenChange={() => undefined}
        preview={preview}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Encrypt & Push' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
