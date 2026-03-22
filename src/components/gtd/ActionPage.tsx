import React from 'react';
import { Calendar, Plus, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EnhancedTextEditor } from '@/components/editor/EnhancedTextEditor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GeneralReferencesField } from '@/components/gtd/GeneralReferencesField';
import { GTDTagSelector } from '@/components/gtd/GTDTagSelector';
import type { GTDActionEffort, GTDActionStatus } from '@/types';
import {
  parseActionMarkdown,
  rebuildActionMarkdown,
} from '@/utils/gtd-action-markdown';

export interface ActionPageProps {
  content: string;
  onChange: (nextContent: string) => void;
  filePath?: string;
  className?: string;
}

export const ActionPage: React.FC<ActionPageProps> = ({
  content,
  onChange,
  filePath,
  className,
}) => {
  const parsed = React.useMemo(() => parseActionMarkdown(content || ''), [content]);
  const parsedTitle = parsed.title === 'Untitled' ? '' : parsed.title;
  const createdDisplay = React.useMemo(() => {
    const createdDate = new Date(parsed.createdDateTime);
    return Number.isNaN(createdDate.getTime()) ? '—' : createdDate.toLocaleString();
  }, [parsed.createdDateTime]);

  const [title, setTitle] = React.useState(parsedTitle);
  const [status, setStatus] = React.useState<GTDActionStatus>(parsed.status);
  const [effort, setEffort] = React.useState<GTDActionEffort>(parsed.effort);
  const [focusDate, setFocusDate] = React.useState(parsed.focusDate);
  const [focusTime, setFocusTime] = React.useState(parsed.focusTime);
  const [dueDate, setDueDate] = React.useState(parsed.dueDate);
  const [contexts, setContexts] = React.useState<string[]>(parsed.contexts);
  const [references, setReferences] = React.useState<string[]>(parsed.references);
  const [ctxPickerOpen, setCtxPickerOpen] = React.useState(false);

  const bodyRef = React.useRef(parsed.body);

  React.useEffect(() => {
    setTitle(parsedTitle);
    setStatus(parsed.status);
    setEffort(parsed.effort);
    setFocusDate(parsed.focusDate);
    setFocusTime(parsed.focusTime);
    setDueDate(parsed.dueDate);
    setContexts(parsed.contexts);
    setReferences(parsed.references);
    bodyRef.current = parsed.body;
  }, [parsed, parsedTitle]);

  const emitRebuild = React.useCallback(
    (
      overrides?: Partial<{
        title: string;
        status: GTDActionStatus;
        effort: GTDActionEffort;
        focusDate: string;
        focusTime: string;
        dueDate: string;
        contexts: string[];
        references: string[];
        body: string;
      }>
    ) => {
      const built = rebuildActionMarkdown(content, {
        title: overrides?.title ?? title,
        status: overrides?.status ?? status,
        effort: overrides?.effort ?? effort,
        focusDate: overrides?.focusDate ?? focusDate,
        focusTime: overrides?.focusTime ?? focusTime,
        dueDate: overrides?.dueDate ?? dueDate,
        contexts: overrides?.contexts ?? contexts,
        references: overrides?.references ?? references,
        body: overrides?.body ?? bodyRef.current,
      });

      if (built !== content) {
        onChange(built);
      }
    },
    [content, dueDate, effort, focusDate, focusTime, onChange, references, status, title, contexts]
  );

  return (
    <div className={`${className} w-full`}>
      <div className="px-12 py-6">
        <input
          type="text"
          value={title}
          onChange={(event) => {
            const nextTitle = event.target.value;
            setTitle(nextTitle);
            emitRebuild({ title: nextTitle });
          }}
          className="w-full bg-background text-foreground text-5xl font-bold leading-tight tracking-[-0.01em] border-0 outline-none placeholder:text-muted-foreground mb-6"
          placeholder="Untitled"
        />

        <div className="pt-5 pb-6 space-y-3">
          <div className="grid grid-cols-[120px_1fr_120px_1fr] gap-x-6 gap-y-3 items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Select
              value={status}
              onValueChange={(value) => {
                const nextStatus = value as GTDActionStatus;
                setStatus(nextStatus);
                emitRebuild({ status: nextStatus });
              }}
            >
              <SelectTrigger className="h-8 text-sm" aria-label="Status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground">Effort</span>
            <Select
              value={effort}
              onValueChange={(value) => {
                const nextEffort = value as GTDActionEffort;
                setEffort(nextEffort);
                emitRebuild({ effort: nextEffort });
              }}
            >
              <SelectTrigger className="h-8 text-sm" aria-label="Effort">
                <SelectValue placeholder="Select effort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small (&lt;30 min)</SelectItem>
                <SelectItem value="medium">Medium (30–90 min)</SelectItem>
                <SelectItem value="large">Large (&gt;90 min)</SelectItem>
                <SelectItem value="extra-large">Extra Large (&gt;3 hours)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[120px_1fr_120px_1fr] gap-x-6 gap-y-3 items-center">
            <span className="text-sm text-muted-foreground">Focus Date</span>
            <div className="flex items-center gap-2">
              <div className="relative w-[14rem]">
                <Input
                  type="date"
                  value={focusDate}
                  onChange={(event) => {
                    const nextFocusDate = event.target.value;
                    setFocusDate(nextFocusDate);
                    emitRebuild({ focusDate: nextFocusDate });
                  }}
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              <Input
                type="time"
                value={focusTime}
                onChange={(event) => {
                  const nextFocusTime = event.target.value;
                  setFocusTime(nextFocusTime);
                  emitRebuild({ focusTime: nextFocusTime });
                }}
                className="w-[9rem]"
              />
            </div>

            <span className="text-sm text-muted-foreground">Due Date</span>
            <div className="relative w-[14rem]">
              <Input
                type="date"
                value={dueDate}
                onChange={(event) => {
                  const nextDueDate = event.target.value;
                  setDueDate(nextDueDate);
                  emitRebuild({ dueDate: nextDueDate });
                }}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-x-6 items-center">
            <span className="text-sm text-muted-foreground">Contexts</span>
            <div className="flex items-center gap-2 flex-wrap">
              {contexts.map((context) => (
                <Badge
                  key={context}
                  variant="secondary"
                  className="capitalize px-2 py-0.5 text-xs flex items-center gap-1.5 h-6"
                >
                  {context}
                  <button
                    onClick={() => {
                      const nextContexts = contexts.filter((value) => value !== context);
                      setContexts(nextContexts);
                      emitRebuild({ contexts: nextContexts });
                    }}
                    className="hover:text-muted-foreground transition-colors"
                    aria-label={`Remove ${context}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Popover open={ctxPickerOpen} onOpenChange={setCtxPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="h-6 w-6 rounded-md border border-border flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label="Add context"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="start">
                  <div className="text-xs text-muted-foreground mb-2">Add contexts</div>
                  <GTDTagSelector
                    type="contexts"
                    value={contexts}
                    onValueChange={(nextContexts) => {
                      setContexts(nextContexts);
                      emitRebuild({ contexts: nextContexts });
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <GeneralReferencesField
            value={references}
            onChange={(nextReferences) => {
              setReferences(nextReferences);
              emitRebuild({ references: nextReferences });
            }}
            filePath={filePath}
          />

          <div className="grid grid-cols-[120px_1fr] gap-x-6 items-center">
            <span className="text-sm text-muted-foreground">Created</span>
            <div className="inline-flex items-center gap-2 px-2 py-1 border border-border rounded-md w-fit text-xs">
              <Calendar className="h-3.5 w-3.5" />
              <span>{createdDisplay}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border w-full" />

      <div className="px-12 pt-6 align-with-header">
        <EnhancedTextEditor
          content={parsed.body}
          onChange={(nextBody) => {
            bodyRef.current = nextBody;
            emitRebuild({ body: nextBody });
          }}
          readOnly={false}
          autoFocus={true}
          className="flex-1"
          filePath={filePath}
          frame="bare"
          showStatusBar={false}
        />
      </div>
    </div>
  );
};

export default ActionPage;
