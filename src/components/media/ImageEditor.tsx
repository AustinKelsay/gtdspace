/**
 * @fileoverview Advanced image editor with resize, crop, and editing tools
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Expand,
  Crop,
  Palette,
  Save,
  Undo2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
// import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type {
  MediaItem,
  ImageEditOptions,
  ImageResizeOptions,
  ImageAdjustmentOptions,
  MediaOperationResult
} from './types';

// === TYPES ===
/**
 * Props for the ImageEditor component
 */
export interface ImageEditorProps {
  /** Image to edit */
  image: MediaItem;
  /** Whether the editor is open */
  isOpen: boolean;
  /** Callback to close the editor */
  onClose: () => void;
  /** Callback when editing is complete */
  onSave: (result: MediaOperationResult) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Image editor tool
 */
type EditorTool = 'select' | 'crop' | 'resize' | 'adjustments';

/**
 * Edit history entry
 */
interface EditHistoryEntry {
  id: string;
  operation: string;
  options: any;
  timestamp: Date;
}

// === UTILITY FUNCTIONS ===
/**
 * Applies image editing operations to canvas
 */
function applyImageEdits(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  options: ImageEditOptions
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { resize, crop, rotate, flip, adjustments } = options;

  // Calculate dimensions
  let width = image.width;
  let height = image.height;

  if (resize) {
    if (resize.maintainAspectRatio && resize.width && !resize.height) {
      height = (image.height / image.width) * resize.width;
      width = resize.width;
    } else if (resize.maintainAspectRatio && resize.height && !resize.width) {
      width = (image.width / image.height) * resize.height;
      height = resize.height;
    } else {
      width = resize.width || width;
      height = resize.height || height;
    }
  }

  // Set canvas size
  canvas.width = width;
  canvas.height = height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Save context state
  ctx.save();

  // Apply transformations
  if (flip?.horizontal || flip?.vertical) {
    ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
    ctx.translate(flip.horizontal ? -width : 0, flip.vertical ? -height : 0);
  }

  if (rotate?.degrees) {
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((rotate.degrees * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  // Apply image adjustments
  if (adjustments) {
    const { brightness = 0, contrast = 0, saturation = 0 } = adjustments;

    // Create filter string
    const filters: string[] = [];
    if (brightness !== 0) filters.push(`brightness(${100 + brightness}%)`);
    if (contrast !== 0) filters.push(`contrast(${100 + contrast}%)`);
    if (saturation !== 0) filters.push(`saturate(${100 + saturation}%)`);

    if (filters.length > 0) {
      ctx.filter = filters.join(' ');
    }
  }

  // Draw image
  if (crop) {
    ctx.drawImage(
      image,
      crop.x, crop.y, crop.width, crop.height,
      0, 0, width, height
    );
  } else {
    ctx.drawImage(image, 0, 0, width, height);
  }

  // Restore context state
  ctx.restore();
}

/**
 * Converts canvas to blob
 */
function canvasToBlob(canvas: HTMLCanvasElement, quality: number = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to convert canvas to blob'));
      },
      'image/png',
      quality
    );
  });
}

// === MAIN COMPONENT ===
/**
 * Advanced image editor with resize, crop, and editing tools
 *
 * Provides comprehensive image editing capabilities including:
 * - Resize and crop operations
 * - Rotation and flipping
 * - Brightness, contrast, and saturation adjustments
 * - Edit history with undo/redo
 * - Real-time preview
 *
 * @param props - Component props
 * @returns JSX element containing the image editor dialog
 */
export const ImageEditor: React.FC<ImageEditorProps> = ({
  image,
  isOpen,
  onClose,
  onSave,
  className
}) => {
  // === STATE ===
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [editOptions, setEditOptions] = useState<ImageEditOptions>({});
  const [isLoading, setIsLoading] = useState(false);
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // === EFFECTS ===

  /**
   * Initialize image when dialog opens
   */
  useEffect(() => {
    if (isOpen && image && imageRef.current) {
      imageRef.current.src = image.path;
      imageRef.current.onload = () => {
        updatePreview();
      };
    }
  }, [isOpen, image]);

  /**
   * Update preview when edit options change
   */
  useEffect(() => {
    updatePreview();
  }, [editOptions]);

  // === HANDLERS ===

  /**
   * Updates the preview canvas
   */
  const updatePreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;

    if (!canvas || !img || !img.complete) return;

    applyImageEdits(canvas, img, editOptions);
  }, [editOptions]);

  /**
   * Handles resize options change
   */
  const handleResizeChange = useCallback((resize: Partial<ImageResizeOptions>) => {
    setEditOptions(prev => ({
      ...prev,
      resize: { ...prev.resize, ...resize }
    }));
  }, []);

  /**
   * Handles crop options change
   */
  // Crop handling functionality temporarily removed

  /**
   * Handles adjustments change
   */
  const handleAdjustmentChange = useCallback((adjustments: Partial<ImageAdjustmentOptions>) => {
    setEditOptions(prev => ({
      ...prev,
      adjustments: { ...prev.adjustments, ...adjustments }
    }));
  }, []);

  /**
   * Handles rotation
   */
  const handleRotate = useCallback((degrees: number) => {
    setEditOptions(prev => ({
      ...prev,
      rotate: { degrees }
    }));

    addToHistory('rotate', { degrees });
  }, []);

  /**
   * Handles flipping
   */
  const handleFlip = useCallback((horizontal: boolean, vertical: boolean) => {
    setEditOptions(prev => ({
      ...prev,
      flip: { horizontal, vertical }
    }));

    addToHistory('flip', { horizontal, vertical });
  }, []);

  /**
   * Adds operation to edit history
   */
  const addToHistory = useCallback((operation: string, options: any) => {
    const entry: EditHistoryEntry = {
      id: Date.now().toString(),
      operation,
      options,
      timestamp: new Date()
    };

    setEditHistory(prev => [...prev.slice(0, historyIndex + 1), entry]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  /**
   * Handles undo operation
   */
  const handleUndo = useCallback(() => {
    if (historyIndex >= 0) {
      setHistoryIndex(prev => prev - 1);
      // Apply previous state logic here
    }
  }, [historyIndex]);

  /**
   * Handles redo operation
   */
  const handleRedo = useCallback(() => {
    if (historyIndex < editHistory.length - 1) {
      setHistoryIndex(prev => prev + 1);
      // Apply next state logic here
    }
  }, [historyIndex, editHistory.length]);

  /**
   * Saves the edited image
   */
  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsLoading(true);

    try {
      const blob = await canvasToBlob(canvas, 0.9);
      const url = URL.createObjectURL(blob);

      const editedImage: MediaItem = {
        ...image,
        id: `${image.id}-edited-${Date.now()}`,
        name: `${image.name.split('.')[0]}-edited.png`,
        path: url,
        size: blob.size,
        updatedAt: new Date(),
        dimensions: {
          width: canvas.width,
          height: canvas.height
        }
      };

      onSave({
        success: true,
        item: editedImage
      });
    } catch (error) {
      console.error('Save error:', error);
      onSave({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save image'
      });
    } finally {
      setIsLoading(false);
    }
  }, [image, onSave]);

  /**
   * Resets all edits
   */
  const handleReset = useCallback(() => {
    setEditOptions({});
    setEditHistory([]);
    setHistoryIndex(-1);
  }, []);

  // === RENDER HELPERS ===

  /**
   * Renders the tool panel
   */
  const renderToolPanel = () => (
    <div className="w-64 border-r border-border bg-muted/20 p-4 space-y-4">
      {/* Tool Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Tools</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={activeTool === 'resize' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool('resize')}
            className="justify-start"
          >
            <Expand className="w-4 h-4 mr-2" />
            Resize
          </Button>
          <Button
            variant={activeTool === 'crop' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool('crop')}
            className="justify-start"
          >
            <Crop className="w-4 h-4 mr-2" />
            Crop
          </Button>
          <Button
            variant={activeTool === 'adjustments' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool('adjustments')}
            className="justify-start"
          >
            <Palette className="w-4 h-4 mr-2" />
            Adjust
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Transform</Label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRotate(90)}
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleFlip(true, false)}
          >
            <FlipHorizontal className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleFlip(false, true)}
          >
            <FlipVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tool-specific Controls */}
      {activeTool === 'resize' && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Resize</Label>
          <div className="space-y-2">
            <div>
              <Label htmlFor="width" className="text-xs">Width (px)</Label>
              <Input
                id="width"
                type="number"
                value={editOptions.resize?.width || image.dimensions?.width || ''}
                onChange={(e) => handleResizeChange({ width: parseInt(e.target.value) || undefined })}
                placeholder="Width"
                className="h-8"
              />
            </div>
            <div>
              <Label htmlFor="height" className="text-xs">Height (px)</Label>
              <Input
                id="height"
                type="number"
                value={editOptions.resize?.height || image.dimensions?.height || ''}
                onChange={(e) => handleResizeChange({ height: parseInt(e.target.value) || undefined })}
                placeholder="Height"
                className="h-8"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="aspect-ratio"
                checked={editOptions.resize?.maintainAspectRatio ?? true}
                onChange={(e) => handleResizeChange({ maintainAspectRatio: e.target.checked })}
                className="rounded border-input"
              />
              <Label htmlFor="aspect-ratio" className="text-xs">
                Maintain aspect ratio
              </Label>
            </div>
          </div>
        </div>
      )}

      {activeTool === 'adjustments' && (
        <div className="space-y-4">
          <Label className="text-sm font-medium">Adjustments</Label>

          {/* Brightness */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {/* <Sun className="w-4 h-4" /> */}
              <Label className="text-xs">Brightness</Label>
              <span className="text-xs text-muted-foreground ml-auto">
                {editOptions.adjustments?.brightness || 0}
              </span>
            </div>
            <Slider
              value={[editOptions.adjustments?.brightness || 0]}
              onValueChange={([value]: [number]) => handleAdjustmentChange({ brightness: value })}
              min={-100}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* Contrast */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {/* <Contrast className="w-4 h-4" /> */}
              <Label className="text-xs">Contrast</Label>
              <span className="text-xs text-muted-foreground ml-auto">
                {editOptions.adjustments?.contrast || 0}
              </span>
            </div>
            <Slider
              value={[editOptions.adjustments?.contrast || 0]}
              onValueChange={([value]: [number]) => handleAdjustmentChange({ contrast: value })}
              min={-100}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* Saturation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {/* <Palette className="w-4 h-4" /> */}
              <Label className="text-xs">Saturation</Label>
              <span className="text-xs text-muted-foreground ml-auto">
                {editOptions.adjustments?.saturation || 0}
              </span>
            </div>
            <Slider
              value={[editOptions.adjustments?.saturation || 0]}
              onValueChange={([value]: [number]) => handleAdjustmentChange({ saturation: value })}
              min={-100}
              max={100}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  );

  /**
   * Renders the image preview area
   */
  const renderPreviewArea = () => (
    <div className="flex-1 flex flex-col">
      {/* Preview Canvas */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800">
        <div className="max-w-full max-h-full overflow-auto border border-border rounded-lg bg-white dark:bg-gray-900">
          <canvas
            ref={canvasRef}
            className="block max-w-full max-h-full"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          />
        </div>
      </div>

      {/* Image Info */}
      <div className="border-t border-border bg-muted/20 p-3 text-sm text-muted-foreground">
        <div className="flex justify-between items-center">
          <span>{image.name}</span>
          <span>
            {image.dimensions?.width || 0} × {image.dimensions?.height || 0}
          </span>
        </div>
      </div>
    </div>
  );

  // === MAIN RENDER ===
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn('max-w-6xl max-h-[90vh] p-0', className)}>
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>Image Editor</span>
            <div className="flex items-center gap-2">
              {/* History Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={historyIndex < 0}
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={historyIndex >= editHistory.length - 1}
              >
                <Save className="w-4 h-4" />
              </Button>

              {/* Action Buttons */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                Reset
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={isLoading}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {isLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[calc(90vh-100px)]">
          {/* Tool Panel */}
          {renderToolPanel()}

          {/* Preview Area */}
          {renderPreviewArea()}
        </div>

        {/* Hidden Image Element */}
        <img
          ref={imageRef}
          style={{ display: 'none' }}
          alt="Source"
        />
      </DialogContent>
    </Dialog>
  );
};

export default ImageEditor;