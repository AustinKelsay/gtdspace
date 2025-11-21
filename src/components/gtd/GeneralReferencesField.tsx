import React from 'react';
import { Archive, Lightbulb, Search, X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  listCabinetSomedayReferences,
  normalizeReferencePath,
  syncGeneralBacklink,
  isCabinetOrSomedayPath,
  type GeneralReferenceOption,
} from '@/utils/general-references';
import { checkTauriContextAsync } from '@/utils/tauri-ready';

interface GeneralReferencesFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  filePath?: string; // Source file for backlinking and opening
  className?: string;
}

const displayNameForReference = (ref: string): string => {
  const normalized = normalizeReferencePath(ref);
  if (!normalized) return '';

  // Show parent folder when the leaf is README (common for project roots)
  const leaf = normalized.split('/').pop();
  const isReadme = leaf ? /^readme(?:\.(md|markdown))?$/i.test(leaf) : false;
  if (isReadme) {
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 2];
    return 'README';
  }

  if (!leaf) return normalized;
  return leaf.replace(/\.(md|markdown)$/i, '');
};

export const GeneralReferencesField: React.FC<GeneralReferencesFieldProps> = ({
  value,
  onChange,
  label = 'References',
  filePath,
  className = '',
}) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [options, setOptions] = React.useState<GeneralReferenceOption[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [manualRef, setManualRef] = React.useState('');
  const spacePathRef = React.useRef('');

  const normalizedValue = React.useMemo(
    () => Array.from(new Set(value.map(normalizeReferencePath).filter(Boolean))),
    [value]
  );

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      spacePathRef.current = window.localStorage.getItem('gtdspace-current-path') || '';
    }
  }, []);

  const handleChange = React.useCallback(
    (next: string[]) => {
      const normalized = Array.from(new Set(next.map(normalizeReferencePath).filter(Boolean)));
      onChange(normalized);
    },
    [onChange]
  );

  const syncBacklink = React.useCallback(
    async (targetPath: string, action: 'add' | 'remove') => {
      if (!filePath || !targetPath) return;
      const spacePath = spacePathRef.current;
      if (!spacePath) return;
      if (!isCabinetOrSomedayPath(targetPath, spacePath)) return;
      await syncGeneralBacklink({ spacePath, sourcePath: filePath, targetPath, action });
    },
    [filePath]
  );

  const handleAdd = React.useCallback(
    (path: string) => {
      const normalized = normalizeReferencePath(path);
      if (!normalized || normalizedValue.includes(normalized)) return;
      const next = [...normalizedValue, normalized];
      handleChange(next);
      void syncBacklink(normalized, 'add');
    },
    [handleChange, normalizedValue, syncBacklink]
  );

  const handleRemove = React.useCallback(
    (path: string) => {
      const normalized = normalizeReferencePath(path);
      const next = normalizedValue.filter((ref) => ref !== normalized);
      handleChange(next);
      void syncBacklink(normalized, 'remove');
    },
    [handleChange, normalizedValue, syncBacklink]
  );

  const handleOpenReference = React.useCallback((path: string) => {
    if (!path) return;
    try {
      window.dispatchEvent(
        new CustomEvent('open-reference-file', {
          detail: { path },
        })
      );
    } catch (error) {
      console.error('Failed to open reference path', error);
    }
  }, []);

  const loadOptions = React.useCallback(async () => {
    const spacePath = spacePathRef.current;
    if (!spacePath) {
      setOptions([]);
      return;
    }

    const inTauri = await checkTauriContextAsync();
    if (!inTauri) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const refs = await listCabinetSomedayReferences(spacePath);
      setOptions(refs);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (dialogOpen) {
      void loadOptions();
    }
  }, [dialogOpen, loadOptions]);

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) => opt.name.toLowerCase().includes(q) || opt.path.toLowerCase().includes(q)
    );
  }, [options, search]);

  const renderOptionList = (type: 'cabinet' | 'someday', icon: React.ReactNode, label: string) => {
    const entries = filteredOptions.filter((opt) => opt.type === type);
    if (entries.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium mb-1">
          {icon}
          <span>{label}</span>
        </div>
        <div className="pl-6 space-y-2">
          {entries.map((opt) => {
            const isActive = normalizedValue.includes(opt.path);
            return (
              <button
                key={opt.path}
                onClick={() => (isActive ? handleRemove(opt.path) : handleAdd(opt.path))}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${isActive ? 'bg-muted text-muted-foreground' : 'hover:bg-accent'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{opt.name}</span>
                  {isActive && <span className="text-xs text-muted-foreground">Linked</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{opt.path}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{normalizedValue.length} linked</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDialogOpen(true)}
          >
            Manage
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {normalizedValue.length > 0 ? (
          normalizedValue.map((ref) => (
            <Badge
              key={ref}
              variant="outline"
              className="px-2 py-0.5 text-xs flex items-center gap-1.5 h-6 max-w-[18rem] truncate cursor-pointer"
              title={ref}
              onClick={() => handleOpenReference(ref)}
            >
              {displayNameForReference(ref)}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(ref);
                }}
                className="hover:text-muted-foreground transition-colors"
                aria-label={`Remove reference ${ref}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">No references yet.</span>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              Link Cabinet or Someday Maybe pages, or add external URLs.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 mt-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search references"
            />
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>

          <ScrollArea className="mt-4 max-h-80 border border-border rounded-md">
            <div className="p-4 space-y-6">
              {loading ? (
                <span className="text-sm text-muted-foreground">Loading…</span>
              ) : filteredOptions.length === 0 ? (
                <span className="text-sm text-muted-foreground">No references found.</span>
              ) : (
                <>
                  {renderOptionList('cabinet', <Archive className="h-4 w-4 text-muted-foreground" />, 'Cabinet')}
                  {renderOptionList('someday', <Lightbulb className="h-4 w-4 text-purple-600" />, 'Someday Maybe')}
                </>
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center gap-2 mt-4">
            <Input
              value={manualRef}
              onChange={(event) => setManualRef(event.target.value)}
              placeholder="/path/to/file.md or https://..."
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={() => {
                const trimmed = manualRef.trim();
                if (!trimmed) return;
                handleAdd(trimmed);
                setManualRef('');
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GeneralReferencesField;
