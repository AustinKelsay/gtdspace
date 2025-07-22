/**
 * @fileoverview Central media management interface for organizing document assets
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
import React, { useState, useCallback, useMemo } from 'react';
import {
  Upload,
  Search,
  Grid,
  List,
  Image as ImageIcon,
  File,
  Video,
  FileText,
  Trash2,
  Edit,
  Eye
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { ImageEditor } from './ImageEditor';
import type {
  MediaItem,
  MediaType,
  MediaFilter,
  MediaSort,
  MediaViewMode,
  MediaSelectCallback,
  MediaUploadCallback,
  MediaDeleteCallback,
  MediaOperationResult,
  UploadProgress
} from './types';

// === TYPES ===
/**
 * Props for the MediaManager component
 */
export interface MediaManagerProps {
  /** Whether the media manager is open */
  isOpen: boolean;
  /** Callback to close the media manager */
  onClose: () => void;
  /** Callback when media is selected */
  onSelect?: MediaSelectCallback;
  /** Callback when media is uploaded */
  onUpload?: MediaUploadCallback;
  /** Callback when media is deleted */
  onDelete?: MediaDeleteCallback;
  /** Current media items */
  mediaItems?: MediaItem[];
  /** Whether to allow multiple selection */
  allowMultiple?: boolean;
  /** Allowed media types */
  allowedTypes?: MediaType[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Additional CSS classes */
  className?: string;
}

// === CONSTANTS ===
const MEDIA_TYPE_ICONS = {
  image: ImageIcon,
  video: Video,
  audio: File,
  document: FileText,
  archive: File,
  other: File
};

const MEDIA_TYPE_COLORS = {
  image: 'text-green-600',
  video: 'text-blue-600',
  audio: 'text-purple-600',
  document: 'text-red-600',
  archive: 'text-yellow-600',
  other: 'text-gray-600'
};

const VIEW_MODES: { value: MediaViewMode; label: string; icon: React.ReactNode }[] = [
  { value: 'grid', label: 'Grid', icon: <Grid className="w-4 h-4" /> },
  { value: 'list', label: 'List', icon: <List className="w-4 h-4" /> }
];

// === UTILITY FUNCTIONS ===
/**
 * Formats file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Gets file extension from filename
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Determines media type from file extension
 */
function getMediaType(filename: string): MediaType {
  const ext = getFileExtension(filename);

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext)) return 'audio';
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'document';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';

  return 'other';
}

// === MAIN COMPONENT ===
/**
 * Central media management interface for organizing document assets
 * 
 * Provides comprehensive media management capabilities including:
 * - File upload with drag-and-drop support
 * - Media organization and filtering
 * - Grid and list view modes
 * - Image editing integration
 * - File preview and download
 * 
 * @param props - Component props
 * @returns JSX element containing the media manager dialog
 */
export const MediaManager: React.FC<MediaManagerProps> = ({
  isOpen,
  onClose,
  onSelect,
  onUpload,
  onDelete,
  mediaItems = [],
  allowMultiple = false,
  allowedTypes,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  className
}) => {
  // === STATE ===
  const [viewMode, setViewMode] = useState<MediaViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<MediaFilter>({});
  const [sort, _setSort] = useState<MediaSort>({ field: 'createdAt', direction: 'desc' });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [_uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [editingImage, setEditingImage] = useState<MediaItem | null>(null);

  // === COMPUTED VALUES ===

  /**
   * Filtered and sorted media items
   */
  const filteredItems = useMemo(() => {
    let items = mediaItems.filter(item => {
      // Search filter
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Type filter
      if (filter.type && !Array.isArray(filter.type) && item.type !== filter.type) {
        return false;
      }
      if (filter.type && Array.isArray(filter.type) && !filter.type.includes(item.type)) {
        return false;
      }

      // Allowed types filter
      if (allowedTypes && !allowedTypes.includes(item.type)) {
        return false;
      }

      // Size filter
      if (filter.sizeRange) {
        const { min, max } = filter.sizeRange;
        if (item.size < min || item.size > max) {
          return false;
        }
      }

      // Date filter
      if (filter.dateRange) {
        const { from, to } = filter.dateRange;
        if (item.createdAt < from || item.createdAt > to) {
          return false;
        }
      }

      return true;
    });

    // Sort items
    items.sort((a, b) => {
      const { field, direction } = sort;
      let aValue: any = a[field];
      let bValue: any = b[field];

      if (field === 'createdAt' || field === 'updatedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return direction === 'asc' ? result : -result;
    });

    return items;
  }, [mediaItems, searchQuery, filter, sort, allowedTypes]);

  // === HANDLERS ===

  /**
   * Handles file upload
   */
  const handleFileUpload = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      // Check file size
      if (file.size > maxFileSize) {
        console.warn(`File ${file.name} exceeds maximum size limit`);
        continue;
      }

      // Check file type
      const mediaType = getMediaType(file.name);
      if (allowedTypes && !allowedTypes.includes(mediaType)) {
        console.warn(`File ${file.name} type not allowed`);
        continue;
      }

      const fileId = `upload-${Date.now()}-${Math.random()}`;

      // Create media item
      const mediaItem: MediaItem = {
        id: fileId,
        name: file.name,
        extension: getFileExtension(file.name),
        type: mediaType,
        size: file.size,
        mimeType: file.type,
        path: URL.createObjectURL(file),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add image dimensions for images
      if (mediaType === 'image') {
        const img = new Image();
        img.onload = () => {
          mediaItem.dimensions = {
            width: img.width,
            height: img.height
          };
        };
        img.src = mediaItem.path;
      }

      // Simulate upload progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(progressInterval);
          setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileId];
            return newProgress;
          });

          onUpload?.({
            success: true,
            item: mediaItem
          });
        }

        setUploadProgress(prev => ({
          ...prev,
          [fileId]: {
            loaded: (progress / 100) * file.size,
            total: file.size,
            percentage: progress
          }
        }));
      }, 100);
    }
  }, [maxFileSize, allowedTypes, onUpload]);

  /**
   * Handles drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  /**
   * Handles drag leave
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  /**
   * Handles file drop
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  /**
   * Handles item selection
   */
  const handleItemSelect = useCallback((item: MediaItem) => {
    if (allowMultiple) {
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
        return newSet;
      });
    } else {
      onSelect?.(item);
    }
  }, [allowMultiple, onSelect]);

  /**
   * Handles item deletion
   */
  const handleItemDelete = useCallback((itemId: string) => {
    onDelete?.(itemId);
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
  }, [onDelete]);

  /**
   * Handles image editing
   */
  const handleEditImage = useCallback((item: MediaItem) => {
    if (item.type === 'image') {
      setEditingImage(item);
    }
  }, []);

  /**
   * Handles image edit completion
   */
  const handleImageEditComplete = useCallback((result: MediaOperationResult) => {
    setEditingImage(null);
    if (result.success && result.item) {
      onUpload?.(result);
    }
  }, [onUpload]);

  // === RENDER HELPERS ===

  /**
   * Renders the toolbar
   */
  const renderToolbar = () => (
    <div className="flex items-center justify-between p-4 border-b border-border">
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search media..."
            className="pl-8 w-64"
          />
        </div>

        {/* Type Filter */}
        <Select
          value={filter.type as string || 'all'}
          onValueChange={(value) =>
            setFilter(prev => ({
              ...prev,
              type: value === 'all' ? undefined : value as MediaType
            }))
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex rounded-md border border-input">
          {VIEW_MODES.map((mode) => (
            <Button
              key={mode.value}
              variant={viewMode === mode.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode(mode.value)}
              className="rounded-none first:rounded-l-md last:rounded-r-md"
            >
              {mode.icon}
            </Button>
          ))}
        </div>

        {/* Upload Button */}
        <label>
          <input
            type="file"
            multiple
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            className="hidden"
          />
          <Button className="gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </Button>
        </label>
      </div>
    </div>
  );

  /**
   * Renders media item in grid view
   */
  const renderGridItem = (item: MediaItem) => {
    const Icon = MEDIA_TYPE_ICONS[item.type];
    const isSelected = selectedItems.has(item.id);

    return (
      <Card
        key={item.id}
        className={cn(
          'relative group cursor-pointer transition-all hover:shadow-md',
          isSelected && 'ring-2 ring-primary'
        )}
        onClick={() => handleItemSelect(item)}
      >
        <div className="aspect-square relative overflow-hidden rounded-t-lg">
          {item.type === 'image' ? (
            <img
              src={item.thumbnail || item.path}
              alt={item.altText || item.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Icon className={cn('w-12 h-12', MEDIA_TYPE_COLORS[item.type])} />
            </div>
          )}

          {/* Overlay Actions */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={(e) => {
              e.stopPropagation();
              // Preview logic
            }}>
              <Eye className="w-4 h-4" />
            </Button>
            {item.type === 'image' && (
              <Button size="sm" variant="secondary" onClick={(e) => {
                e.stopPropagation();
                handleEditImage(item);
              }}>
                <Edit className="w-4 h-4" />
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={(e) => {
              e.stopPropagation();
              handleItemDelete(item.id);
            }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Item Info */}
        <div className="p-3">
          <div className="font-medium text-sm truncate" title={item.name}>
            {item.name}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatFileSize(item.size)}
            {item.dimensions && (
              <span> • {item.dimensions.width}×{item.dimensions.height}</span>
            )}
          </div>
        </div>
      </Card>
    );
  };

  /**
   * Renders media item in list view
   */
  const renderListItem = (item: MediaItem) => {
    const Icon = MEDIA_TYPE_ICONS[item.type];
    const isSelected = selectedItems.has(item.id);

    return (
      <div
        key={item.id}
        className={cn(
          'flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors',
          isSelected && 'bg-accent border-primary'
        )}
        onClick={() => handleItemSelect(item)}
      >
        <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded bg-muted">
          {item.type === 'image' ? (
            <img
              src={item.thumbnail || item.path}
              alt={item.altText || item.name}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <Icon className={cn('w-5 h-5', MEDIA_TYPE_COLORS[item.type])} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{item.name}</div>
          <div className="text-sm text-muted-foreground">
            {item.type} • {formatFileSize(item.size)}
            {item.dimensions && (
              <span> • {item.dimensions.width}×{item.dimensions.height}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={(e) => {
            e.stopPropagation();
            // Preview logic
          }}>
            <Eye className="w-4 h-4" />
          </Button>
          {item.type === 'image' && (
            <Button size="sm" variant="ghost" onClick={(e) => {
              e.stopPropagation();
              handleEditImage(item);
            }}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={(e) => {
            e.stopPropagation();
            handleItemDelete(item.id);
          }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  /**
   * Renders upload area
   */
  const renderUploadArea = () => (
    <div
      className={cn(
        'border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center transition-colors',
        dragOver && 'border-primary bg-primary/5'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <div className="text-lg font-medium mb-2">Drop files here to upload</div>
      <div className="text-sm text-muted-foreground mb-4">
        or click the upload button above
      </div>
      <div className="text-xs text-muted-foreground">
        Maximum file size: {formatFileSize(maxFileSize)}
        {allowedTypes && (
          <div>Allowed types: {allowedTypes.join(', ')}</div>
        )}
      </div>
    </div>
  );

  // === MAIN RENDER ===
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={cn('max-w-6xl max-h-[90vh] p-0', className)}>
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Media Manager</DialogTitle>
          </DialogHeader>

          {/* Toolbar */}
          {renderToolbar()}

          {/* Content Area */}
          <ScrollArea className="flex-1 p-4" style={{ height: 'calc(90vh - 200px)' }}>
            {filteredItems.length === 0 ? (
              renderUploadArea()
            ) : (
              <div className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4'
                  : 'space-y-2'
              )}>
                {filteredItems.map(item =>
                  viewMode === 'grid' ? renderGridItem(item) : renderListItem(item)
                )}
              </div>
            )}
          </ScrollArea>

          {/* Selection Actions */}
          {allowMultiple && selectedItems.size > 0 && (
            <div className="border-t border-border p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedItems(new Set())}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    onClick={() => {
                      const selected = filteredItems.filter(item => selectedItems.has(item.id));
                      selected.forEach(onSelect!);
                      onClose();
                    }}
                  >
                    Insert Selected
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Editor */}
      {editingImage && (
        <ImageEditor
          image={editingImage}
          isOpen={!!editingImage}
          onClose={() => setEditingImage(null)}
          onSave={handleImageEditComplete}
        />
      )}
    </>
  );
};

export default MediaManager;