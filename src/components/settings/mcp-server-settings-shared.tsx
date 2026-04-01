import React from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const DetailCard: React.FC<{
  label: string;
  value: string;
  muted?: boolean;
}> = ({ label, value, muted = false }) => (
  <div className="rounded-lg border bg-muted/20 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {label}
    </p>
    <p className={cn('mt-2 break-words text-sm font-medium', muted && 'text-muted-foreground')}>
      {value}
    </p>
  </div>
);

export const CodeBlock: React.FC<{
  label: string;
  value: string;
  onCopy: () => void;
}> = ({ label, value, onCopy }) => (
  <div className="rounded-lg border bg-muted/20 p-4">
    <div className="mb-2 flex items-center justify-between gap-3">
      <p className="text-sm font-medium">{label}</p>
      <Button variant="outline" size="sm" onClick={onCopy}>
        <Copy className="mr-2 h-4 w-4" />
        Copy
      </Button>
    </div>
    <pre className="overflow-x-auto rounded-md bg-background px-3 py-2 text-xs leading-6">
      <code>{value}</code>
    </pre>
  </div>
);

export const ToolChipSection: React.FC<{
  title: string;
  description: string;
  items: readonly string[];
}> = ({ title, description, items }) => (
  <div className="space-y-3">
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <code
          key={item}
          className="rounded-md border bg-muted/20 px-2.5 py-1 text-xs"
        >
          {item}
        </code>
      ))}
    </div>
  </div>
);
