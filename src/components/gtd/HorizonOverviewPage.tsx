import React from 'react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HORIZON_CONFIG, HorizonType } from '@/utils/horizon-config';
import { extractMetadata, FileMetadata } from '@/utils/metadata-extractor';
import {
  extractHorizonSection,
  extractMarkdownTitle,
} from '@/utils/horizon-readme-utils';
import { Layers, Calendar, List, FileText, ArrowRight, Edit } from 'lucide-react';

interface HorizonOverviewPageProps {
  horizon: HorizonType;
  content: string;
  filePath?: string;
  className?: string;
  onEdit?: () => void;
}

const SECTION_HEADINGS = {
  why: 'Why this horizon matters',
  how: 'How to work this horizon in GTD Space',
  overview: 'Horizon Pages Overview',
};

const formatCadenceLabel = (value: string) => {
  if (!value) return '—';
  return value
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
};

const formatCreated = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return format(date, 'MMM d, yyyy • h:mm a');
  } catch {
    return value;
  }
};

const normalizeReferencePath = (path?: string) =>
  (path ?? '').replace(/\\/g, '/');

const referenceDisplayName = (path: string) => {
  const normalized = normalizeReferencePath(path);
  const parts = normalized.split('/');
  const fileName = parts[parts.length - 1] || normalized;
  return fileName.replace(/\.md$/i, '');
};

const SectionCard: React.FC<{
  title: string;
  body: string;
}> = ({ title, body }) => (
  <Card className="p-5 space-y-3">
    <div className="flex items-center gap-2">
      <Layers className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:text-foreground prose-strong:text-foreground">
      <ReactMarkdown>{body || '—'}</ReactMarkdown>
    </div>
  </Card>
);

export const HorizonOverviewPage: React.FC<HorizonOverviewPageProps> = ({
  horizon,
  content,
  filePath,
  className = '',
  onEdit,
}) => {
  const config = HORIZON_CONFIG[horizon];
  const metadata = React.useMemo<FileMetadata>(
    () => extractMetadata(content),
    [content]
  );

  const title =
    extractMarkdownTitle(content) ?? `${config.label} Overview`;

  const reviewCadence =
    (metadata.horizonReviewCadence as string) ?? config.defaultCadence;

  const createdDate = metadata.createdDateTime as string | undefined;

  const rawReferences = metadata[
    config.referenceMetadataKey
  ] as string[] | string | undefined;

  const references = React.useMemo(() => {
    if (Array.isArray(rawReferences)) {
      return rawReferences.map(normalizeReferencePath);
    }
    if (typeof rawReferences === 'string' && rawReferences.trim().length > 0) {
      return [normalizeReferencePath(rawReferences)];
    }
    return [] as string[];
  }, [rawReferences]);

  const sections = React.useMemo(() => {
    const why =
      extractHorizonSection(content, SECTION_HEADINGS.why) || config.copy.why;
    const how =
      extractHorizonSection(content, SECTION_HEADINGS.how) || config.copy.how;
    const overview =
      extractHorizonSection(content, SECTION_HEADINGS.overview) ||
      config.copy.overview;
    return { why, how, overview };
  }, [content, config.copy]);

  const handleReferenceOpen = React.useCallback((path: string) => {
    window.dispatchEvent(
      new CustomEvent('open-reference-file', {
        detail: { path },
      })
    );
  }, []);

  const createdDisplay = formatCreated(createdDate);
  const pageCount = references.length;

  return (
    <div className={cn('flex flex-col gap-6 pb-10', className)}>
      <Card className="p-6 space-y-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Horizon Overview
            </p>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="flex items-center gap-2"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{title}</h1>
            <Badge variant="secondary" className="uppercase tracking-wide">
              {config.altitudeLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1 uppercase">
              Review Cadence
            </p>
            <p className="text-sm font-medium">
              {formatCadenceLabel(reviewCadence)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 uppercase">
              Created
            </p>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {createdDisplay}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 uppercase">
              Pages in this horizon
            </p>
            <p className="text-sm font-medium">{pageCount}</p>
          </div>
        </div>
      </Card>

      <SectionCard title={SECTION_HEADINGS.why} body={sections.why} />
      <SectionCard title={SECTION_HEADINGS.how} body={sections.how} />
      <SectionCard title={SECTION_HEADINGS.overview} body={sections.overview} />

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <List className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Reference Index</h3>
        </div>
        {references.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No horizon pages yet. Use the sidebar to create one.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {references.map((ref) => (
              <Button
                key={ref}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => handleReferenceOpen(ref)}
              >
                <FileText className="h-3.5 w-3.5" />
                {referenceDisplayName(ref)}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Horizon Pages</h3>
          </div>
          {filePath && (
            <Badge variant="secondary" className="text-xs">
              Auto-synced
            </Badge>
          )}
        </div>
        {references.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Create your first horizon page from the sidebar. It will appear here
            automatically.
          </p>
        ) : (
          <div className="space-y-2">
            {references.map((ref) => (
              <div
                key={ref}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {referenceDisplayName(ref)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[360px]">
                    {normalizeReferencePath(ref)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  onClick={() => handleReferenceOpen(ref)}
                >
                  Open
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default HorizonOverviewPage;
