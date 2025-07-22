/**
 * @fileoverview Central export management component
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
import React, { useState, useCallback } from 'react';
import {
  Download,
  FileText,
  Globe,
  Loader2,
  Printer,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import { PDFExporter } from './PDFExporter';
import { HTMLExporter } from './HTMLExporter';
import type {
  ExportOptions,
  ExportFormat,
  ExportResult,
  ExportStatus,
  ExportProgress,
  ExportTheme,
  ExportQuality
} from './types';

// === TYPES ===
/**
 * Props for the ExportManager component
 */
export interface ExportManagerProps {
  /** Document content to export */
  content: string;
  /** Current document title */
  title?: string;
  /** Current author */
  author?: string;
  /** Whether the export dialog is open */
  isOpen: boolean;
  /** Callback to close the export dialog */
  onClose: () => void;
  /** Callback when export is complete */
  onExportComplete?: (result: ExportResult) => void;
  /** Additional CSS classes */
  className?: string;
}

// === CONSTANTS ===
const EXPORT_FORMATS: { value: ExportFormat; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'pdf',
    label: 'PDF Document',
    icon: <FileText className="w-4 h-4" />,
    description: 'Portable document format with consistent formatting'
  },
  {
    value: 'html',
    label: 'HTML File',
    icon: <Globe className="w-4 h-4" />,
    description: 'Web page format for online sharing and viewing'
  },
  {
    value: 'print',
    label: 'Print',
    icon: <Printer className="w-4 h-4" />,
    description: 'Print document directly or save as PDF'
  }
];

const THEMES: { value: ExportTheme; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'github', label: 'GitHub Style' },
  { value: 'academic', label: 'Academic Paper' },
  { value: 'clean', label: 'Clean & Minimal' },
  { value: 'modern', label: 'Modern Design' }
];

const QUALITIES: { value: ExportQuality; label: string }[] = [
  { value: 'draft', label: 'Draft (Fast)' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High Quality' },
  { value: 'print', label: 'Print Quality' }
];

// === MAIN COMPONENT ===
/**
 * Central export management component
 * 
 * Provides a unified interface for exporting documents to various formats
 * including PDF, HTML, and print. Includes comprehensive options for
 * customizing the export output.
 * 
 * Features:
 * - Multiple export formats (PDF, HTML, Print)
 * - Theme selection and styling options
 * - Progress tracking and status updates
 * - Export configuration and settings
 * - Error handling and user feedback
 * 
 * @param props - Component props
 * @returns JSX element containing the export manager dialog
 */
export const ExportManager: React.FC<ExportManagerProps> = ({
  content,
  title = 'Document',
  author,
  isOpen,
  onClose,
  onExportComplete,
  className
}) => {
  // === STATE ===
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    filename: title.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase(),
    title,
    author: author || 'GTD Space User',
    date: new Date(),
    includeSyntaxHighlighting: true,
    includeMath: true,
    includeDiagrams: true,
    pdf: {
      format: 'A4',
      orientation: 'portrait',
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
      includeTOC: true,
      includePageNumbers: true,
      quality: 'standard',
      theme: 'default',
      includeMetadata: true
    },
    html: {
      inlineCSS: true,
      includeTOC: true,
      theme: 'default',
      standalone: true,
      includeMetadata: true,
      optimizeOffline: true
    }
  });

  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    step: '',
    progress: 0
  });
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  // === HANDLERS ===

  /**
   * Updates export options
   */
  const updateExportOptions = useCallback((updates: Partial<ExportOptions>) => {
    setExportOptions(prev => ({
      ...prev,
      ...updates,
      format: selectedFormat
    }));
  }, [selectedFormat]);

  /**
   * Handles export progress updates
   */
  const handleExportProgress = useCallback((progress: ExportProgress) => {
    setExportProgress(progress);
  }, []);

  /**
   * Handles export completion
   */
  const handleExportComplete = useCallback((result: ExportResult) => {
    setExportResult(result);
    setExportStatus(result.success ? 'success' : 'error');
    onExportComplete?.(result);
  }, [onExportComplete]);

  /**
   * Starts the export process
   */
  const handleStartExport = useCallback(async () => {
    setExportStatus('preparing');
    setExportProgress({ step: 'Preparing export...', progress: 0 });

    try {
      // The actual export will be handled by format-specific components
      setExportStatus('exporting');
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      setExportResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error'
      });
    }
  }, []);

  /**
   * Cancels the export process
   */
  const handleCancelExport = useCallback(() => {
    setExportStatus('cancelled');
    setExportProgress({ step: 'Cancelled', progress: 0 });
  }, []);

  /**
   * Resets the export state
   */
  const handleResetExport = useCallback(() => {
    setExportStatus('idle');
    setExportProgress({ step: '', progress: 0 });
    setExportResult(null);
  }, []);

  // === RENDER HELPERS ===

  /**
   * Renders format selection
   */
  const renderFormatSelection = () => (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Export Format</Label>
      <div className="grid grid-cols-1 gap-2">
        {EXPORT_FORMATS.map(format => (
          <div
            key={format.value}
            onClick={() => setSelectedFormat(format.value)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
              selectedFormat === format.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-accent'
            )}
          >
            <div className="text-muted-foreground">{format.icon}</div>
            <div className="flex-1">
              <div className="font-medium text-sm">{format.label}</div>
              <div className="text-xs text-muted-foreground">{format.description}</div>
            </div>
            <div className={cn(
              'w-4 h-4 rounded-full border-2',
              selectedFormat === format.value
                ? 'bg-primary border-primary'
                : 'border-muted-foreground'
            )}>
              {selectedFormat === format.value && (
                <div className="w-full h-full bg-white rounded-full scale-50" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Renders general options
   */
  const renderGeneralOptions = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="filename">Filename</Label>
          <Input
            id="filename"
            value={exportOptions.filename || ''}
            onChange={(e) => updateExportOptions({ filename: e.target.value })}
            placeholder="document-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="author">Author</Label>
          <Input
            id="author"
            value={exportOptions.author || ''}
            onChange={(e) => updateExportOptions({ author: e.target.value })}
            placeholder="Document author"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Document Title</Label>
        <Input
          id="title"
          value={exportOptions.title || ''}
          onChange={(e) => updateExportOptions({ title: e.target.value })}
          placeholder="Document title"
        />
      </div>

      <div className="space-y-3">
        <Label>Include Content</Label>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="syntax-highlighting"
              checked={exportOptions.includeSyntaxHighlighting}
              onCheckedChange={(checked) =>
                updateExportOptions({ includeSyntaxHighlighting: !!checked })
              }
            />
            <Label htmlFor="syntax-highlighting" className="text-sm">
              Syntax Highlighting
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="math-content"
              checked={exportOptions.includeMath}
              onCheckedChange={(checked) =>
                updateExportOptions({ includeMath: !!checked })
              }
            />
            <Label htmlFor="math-content" className="text-sm">
              Mathematical Content
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="diagrams"
              checked={exportOptions.includeDiagrams}
              onCheckedChange={(checked) =>
                updateExportOptions({ includeDiagrams: !!checked })
              }
            />
            <Label htmlFor="diagrams" className="text-sm">
              Diagrams
            </Label>
          </div>
        </div>
      </div>
    </div>
  );

  /**
   * Renders format-specific options
   */
  const renderFormatOptions = () => {
    if (selectedFormat === 'pdf' && exportOptions.pdf) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Page Format</Label>
              <Select
                value={exportOptions.pdf.format}
                onValueChange={(value: any) =>
                  updateExportOptions({
                    pdf: { ...exportOptions.pdf!, format: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4</SelectItem>
                  <SelectItem value="Letter">Letter</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                  <SelectItem value="A3">A3</SelectItem>
                  <SelectItem value="A5">A5</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Orientation</Label>
              <Select
                value={exportOptions.pdf.orientation}
                onValueChange={(value: any) =>
                  updateExportOptions({
                    pdf: { ...exportOptions.pdf!, orientation: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={exportOptions.pdf.theme}
                onValueChange={(value: ExportTheme) =>
                  updateExportOptions({
                    pdf: { ...exportOptions.pdf!, theme: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEMES.map(theme => (
                    <SelectItem key={theme.value} value={theme.value}>
                      {theme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quality</Label>
              <Select
                value={exportOptions.pdf.quality}
                onValueChange={(value: ExportQuality) =>
                  updateExportOptions({
                    pdf: { ...exportOptions.pdf!, quality: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUALITIES.map(quality => (
                    <SelectItem key={quality.value} value={quality.value}>
                      {quality.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-toc"
                checked={exportOptions.pdf.includeTOC}
                onCheckedChange={(checked) =>
                  updateExportOptions({
                    pdf: { ...exportOptions.pdf!, includeTOC: !!checked }
                  })
                }
              />
              <Label htmlFor="include-toc" className="text-sm">
                Include Table of Contents
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="page-numbers"
                checked={exportOptions.pdf.includePageNumbers}
                onCheckedChange={(checked) =>
                  updateExportOptions({
                    pdf: { ...exportOptions.pdf!, includePageNumbers: !!checked }
                  })
                }
              />
              <Label htmlFor="page-numbers" className="text-sm">
                Page Numbers
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="metadata"
                checked={exportOptions.pdf.includeMetadata}
                onCheckedChange={(checked) =>
                  updateExportOptions({
                    pdf: { ...exportOptions.pdf!, includeMetadata: !!checked }
                  })
                }
              />
              <Label htmlFor="metadata" className="text-sm">
                Document Metadata
              </Label>
            </div>
          </div>
        </div>
      );
    }

    if (selectedFormat === 'html' && exportOptions.html) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={exportOptions.html.theme}
                onValueChange={(value: ExportTheme) =>
                  updateExportOptions({
                    html: { ...exportOptions.html!, theme: value }
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEMES.map(theme => (
                    <SelectItem key={theme.value} value={theme.value}>
                      {theme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="inline-css"
                checked={exportOptions.html.inlineCSS}
                onCheckedChange={(checked) =>
                  updateExportOptions({
                    html: { ...exportOptions.html!, inlineCSS: !!checked }
                  })
                }
              />
              <Label htmlFor="inline-css" className="text-sm">
                Inline CSS
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="html-toc"
                checked={exportOptions.html.includeTOC}
                onCheckedChange={(checked) =>
                  updateExportOptions({
                    html: { ...exportOptions.html!, includeTOC: !!checked }
                  })
                }
              />
              <Label htmlFor="html-toc" className="text-sm">
                Table of Contents
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="standalone"
                checked={exportOptions.html.standalone}
                onCheckedChange={(checked) =>
                  updateExportOptions({
                    html: { ...exportOptions.html!, standalone: !!checked }
                  })
                }
              />
              <Label htmlFor="standalone" className="text-sm">
                Standalone File
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="optimize-offline"
                checked={exportOptions.html.optimizeOffline}
                onCheckedChange={(checked) =>
                  updateExportOptions({
                    html: { ...exportOptions.html!, optimizeOffline: !!checked }
                  })
                }
              />
              <Label htmlFor="optimize-offline" className="text-sm">
                Optimize for Offline
              </Label>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  /**
   * Renders export progress
   */
  const renderExportProgress = () => {
    if (exportStatus === 'idle') return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {exportStatus === 'exporting' && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          <span className="text-sm font-medium">
            {exportStatus === 'preparing' && 'Preparing Export...'}
            {exportStatus === 'exporting' && 'Exporting Document...'}
            {exportStatus === 'success' && 'Export Completed!'}
            {exportStatus === 'error' && 'Export Failed'}
            {exportStatus === 'cancelled' && 'Export Cancelled'}
          </span>
        </div>

        {exportProgress.progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{exportProgress.step}</span>
              <span>{exportProgress.progress}%</span>
            </div>
            <Progress value={exportProgress.progress} />
          </div>
        )}

        {exportResult && (
          <div className="p-3 rounded-lg bg-muted/30">
            {exportResult.success ? (
              <div className="text-sm text-green-600 dark:text-green-400">
                Export completed successfully!
                {exportResult.fileSize && (
                  <div className="text-xs text-muted-foreground mt-1">
                    File size: {(exportResult.fileSize / 1024).toFixed(1)} KB
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-red-600 dark:text-red-400">
                {exportResult.error || 'Export failed'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /**
   * Renders export action buttons
   */
  const renderActionButtons = () => (
    <div className="flex justify-between pt-4 border-t">
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>

      <div className="flex gap-2">
        {exportStatus === 'exporting' && (
          <Button variant="outline" onClick={handleCancelExport}>
            Cancel Export
          </Button>
        )}

        {(exportStatus === 'success' || exportStatus === 'error') && (
          <Button variant="outline" onClick={handleResetExport}>
            Export Again
          </Button>
        )}

        {exportStatus === 'idle' && (
          <Button onClick={handleStartExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export {selectedFormat.toUpperCase()}
          </Button>
        )}
      </div>
    </div>
  );

  // === MAIN RENDER ===
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn('max-w-2xl max-h-[80vh] overflow-y-auto', className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Document
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          {renderFormatSelection()}

          {/* Export Options */}
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="format">
                {selectedFormat.toUpperCase()} Options
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              {renderGeneralOptions()}
            </TabsContent>

            <TabsContent value="format" className="space-y-4">
              {renderFormatOptions()}
            </TabsContent>
          </Tabs>

          {/* Export Progress */}
          {renderExportProgress()}

          {/* Action Buttons */}
          {renderActionButtons()}
        </div>

        {/* Format-Specific Export Components */}
        {selectedFormat === 'pdf' && exportStatus === 'exporting' && (
          <PDFExporter
            content={content}
            options={exportOptions}
            onProgress={handleExportProgress}
            onComplete={handleExportComplete}
          />
        )}

        {selectedFormat === 'html' && exportStatus === 'exporting' && (
          <HTMLExporter
            content={content}
            options={exportOptions}
            onProgress={handleExportProgress}
            onComplete={handleExportComplete}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ExportManager;