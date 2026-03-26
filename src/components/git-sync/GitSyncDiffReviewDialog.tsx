import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { GitSyncDiffEntry, GitSyncPreviewResponse } from '@/types';
import { cn } from '@/lib/utils';
import { formatRelativeTimeShort } from '@/utils/time';

type FilterValue =
  | 'all'
  | 'text'
  | 'binary'
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed';

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'text', label: 'Text' },
  { value: 'binary', label: 'Binary' },
  { value: 'added', label: 'Added' },
  { value: 'modified', label: 'Modified' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'renamed', label: 'Renamed' },
];

const changeTypeOrder: Record<GitSyncDiffEntry['changeType'], number> = {
  renamed: 0,
  modified: 1,
  added: 2,
  deleted: 3,
};

const formatBytes = (value?: number | null) => {
  if (value === undefined || value === null) return 'n/a';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const describeEntry = (entry: GitSyncDiffEntry) => {
  if (entry.changeType === 'renamed' && entry.oldPath) {
    return `${entry.oldPath} -> ${entry.path}`;
  }
  return entry.path;
};

const DiffBadge: React.FC<{ value: GitSyncDiffEntry['changeType'] }> = ({ value }) => {
  const className =
    value === 'added'
      ? 'bg-emerald-100 text-emerald-900'
      : value === 'deleted'
        ? 'bg-red-100 text-red-900'
        : value === 'renamed'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-sky-100 text-sky-900';
  return <Badge className={className}>{value}</Badge>;
};

export interface GitSyncDiffReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: GitSyncPreviewResponse | null;
  isConfirming?: boolean;
  onConfirm: () => Promise<void> | void;
}

export const GitSyncDiffReviewDialog: React.FC<GitSyncDiffReviewDialogProps> = ({
  open,
  onOpenChange,
  preview,
  isConfirming = false,
  onConfirm,
}) => {
  const [filter, setFilter] = React.useState<FilterValue>('all');
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setFilter('all');
      setSelectedEntryId(null);
    }
  }, [open]);

  const filteredEntries = React.useMemo(() => {
    if (!preview) return [];
    const entries = [...preview.entries].sort((left, right) => {
      const order = changeTypeOrder[left.changeType] - changeTypeOrder[right.changeType];
      return order === 0 ? left.path.localeCompare(right.path) : order;
    });

    return entries.filter((entry) => {
      if (filter === 'all') return true;
      if (filter === 'text' || filter === 'binary') return entry.kind === filter;
      return entry.changeType === filter;
    });
  }, [filter, preview]);

  const selectedEntry = React.useMemo(() => {
    if (!filteredEntries.length) return null;
    if (!selectedEntryId) return filteredEntries[0];
    return filteredEntries.find((entry) => entry.id === selectedEntryId) ?? filteredEntries[0];
  }, [filteredEntries, selectedEntryId]);

  React.useEffect(() => {
    if (selectedEntry && selectedEntry.id !== selectedEntryId) {
      setSelectedEntryId(selectedEntry.id);
    }
  }, [selectedEntry, selectedEntryId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Review Encrypted Backup Diff</DialogTitle>
          <DialogDescription>
            {preview?.hasBaseline
              ? `Comparing the current workspace against ${preview.baselineBackupFile ?? 'the latest local backup'} (${formatRelativeTimeShort(preview?.baselineTimestamp)}).`
              : 'No previous local backup was found. This first backup will include all workspace files.'}
          </DialogDescription>
        </DialogHeader>

        {preview && (
          <div className="px-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{preview.summary.totalEntries} changed</Badge>
              <Badge variant="outline">{preview.summary.added} added</Badge>
              <Badge variant="outline">{preview.summary.modified} modified</Badge>
              <Badge variant="outline">{preview.summary.deleted} deleted</Badge>
              <Badge variant="outline">{preview.summary.renamed} renamed</Badge>
              <Badge variant="outline">{formatBytes(preview.summary.afterBytes)} current size</Badge>
            </div>

            {preview.warnings?.length ? (
              <Alert className="mt-4">
                <AlertDescription>
                  {preview.warnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-6 pb-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="min-h-0 overflow-hidden">
            <div className="border-b px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    size="sm"
                    variant={filter === item.value ? 'default' : 'outline'}
                    onClick={() => setFilter(item.value)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <ScrollArea className="h-[52vh]">
              <div className="space-y-2 p-3">
                {filteredEntries.length ? (
                  filteredEntries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={cn(
                        'w-full rounded-md border p-3 text-left transition-colors hover:bg-muted',
                        selectedEntry?.id === entry.id && 'border-primary bg-muted',
                      )}
                      onClick={() => setSelectedEntryId(entry.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs">{describeEntry(entry)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {entry.kind === 'text' ? 'Text diff' : 'Binary metadata'}
                            {entry.isTruncated ? ' • truncated' : ''}
                          </div>
                        </div>
                        <DiffBadge value={entry.changeType} />
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">No entries for this filter.</div>
                )}
              </div>
            </ScrollArea>
          </Card>

          <Card className="min-h-0 overflow-hidden">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4 p-4">
                {selectedEntry ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <DiffBadge value={selectedEntry.changeType} />
                      <Badge variant="outline">{selectedEntry.kind}</Badge>
                      {selectedEntry.isTruncated ? <Badge variant="secondary">truncated</Badge> : null}
                    </div>
                    <div className="font-mono text-sm break-all">{describeEntry(selectedEntry)}</div>

                    {selectedEntry.kind === 'binary' ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Card className="p-3">
                          <div className="text-xs uppercase text-muted-foreground">Before</div>
                          <div className="mt-2 text-sm">Size: {formatBytes(selectedEntry.binary?.beforeBytes)}</div>
                          <div className="mt-2 break-all font-mono text-xs">
                            Hash: {selectedEntry.binary?.beforeHash ?? 'n/a'}
                          </div>
                        </Card>
                        <Card className="p-3">
                          <div className="text-xs uppercase text-muted-foreground">After</div>
                          <div className="mt-2 text-sm">Size: {formatBytes(selectedEntry.binary?.afterBytes)}</div>
                          <div className="mt-2 break-all font-mono text-xs">
                            Hash: {selectedEntry.binary?.afterHash ?? 'n/a'}
                          </div>
                          <div className="mt-2 text-sm">MIME: {selectedEntry.binary?.mime ?? 'unknown'}</div>
                        </Card>
                      </div>
                    ) : selectedEntry.text ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>+{selectedEntry.text.lineStats.added}</span>
                          <span>-{selectedEntry.text.lineStats.removed}</span>
                          <span>before {formatBytes(selectedEntry.text.beforeBytes)}</span>
                          <span>after {formatBytes(selectedEntry.text.afterBytes)}</span>
                        </div>
                        <div className="space-y-3">
                          {selectedEntry.text.hunks.map((hunk, hunkIndex) => (
                            <Card key={`${selectedEntry.id}-${hunkIndex}`} className="overflow-hidden">
                              <div className="border-b bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                              </div>
                              <div className="divide-y">
                                {hunk.lines.map((line, lineIndex) => (
                                  <div
                                    key={`${selectedEntry.id}-${hunkIndex}-${lineIndex}`}
                                    className={cn(
                                      'grid grid-cols-[72px_72px_minmax(0,1fr)] gap-3 px-3 py-1 font-mono text-xs',
                                      line.kind === 'add' && 'bg-emerald-50',
                                      line.kind === 'remove' && 'bg-red-50',
                                    )}
                                  >
                                    <span className="text-muted-foreground">{line.oldLineNumber ?? ''}</span>
                                    <span className="text-muted-foreground">{line.newLineNumber ?? ''}</span>
                                    <span className="break-all whitespace-pre-wrap">{line.content || ' '}</span>
                                  </div>
                                ))}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Diff body omitted because this file exceeded preview limits.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No changes since the latest local backup.
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onConfirm()} disabled={isConfirming || !preview}>
            {isConfirming ? 'Encrypting…' : 'Confirm Encrypt & Push'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GitSyncDiffReviewDialog;
