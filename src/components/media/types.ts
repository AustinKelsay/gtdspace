/**
 * @fileoverview Media system types and interfaces
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === MEDIA TYPES ===
/**
 * Supported media types
 */
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

/**
 * Image format types
 */
export type ImageFormat = 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp' | 'svg' | 'bmp';

/**
 * Video format types
 */
export type VideoFormat = 'mp4' | 'webm' | 'ogg' | 'avi' | 'mov';

/**
 * Document format types
 */
export type DocumentFormat = 'pdf' | 'doc' | 'docx' | 'txt' | 'rtf' | 'odt';

// === MEDIA ITEM ===
/**
 * Media item representation
 */
export interface MediaItem {
  /** Unique identifier */
  id: string;
  /** Original filename */
  name: string;
  /** File extension */
  extension: string;
  /** Media type category */
  type: MediaType;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
  /** File path or URL */
  path: string;
  /** Thumbnail path (for images/videos) */
  thumbnail?: string;
  /** Alt text for accessibility */
  altText?: string;
  /** Image dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
  /** Upload/creation date */
  createdAt: Date;
  /** Last modification date */
  updatedAt: Date;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

// === IMAGE EDITING ===
/**
 * Image editing operations
 */
export type ImageEditOperation = 'resize' | 'crop' | 'rotate' | 'flip' | 'brightness' | 'contrast' | 'saturation';

/**
 * Image resize options
 */
export interface ImageResizeOptions {
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  quality?: number; // 0-100
}

/**
 * Image crop options
 */
export interface ImageCropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Image rotation options
 */
export interface ImageRotateOptions {
  degrees: number; // 0, 90, 180, 270
}

/**
 * Image flip options
 */
export interface ImageFlipOptions {
  horizontal?: boolean;
  vertical?: boolean;
}

/**
 * Image adjustment options
 */
export interface ImageAdjustmentOptions {
  brightness?: number; // -100 to 100
  contrast?: number;   // -100 to 100
  saturation?: number; // -100 to 100
}

/**
 * Combined image editing options
 */
export interface ImageEditOptions {
  resize?: ImageResizeOptions;
  crop?: ImageCropOptions;
  rotate?: ImageRotateOptions;
  flip?: ImageFlipOptions;
  adjustments?: ImageAdjustmentOptions;
}

// === EMBED TYPES ===
/**
 * Supported embed types
 */
export type EmbedType = 'youtube' | 'github' | 'codepen' | 'figma' | 'twitter' | 'custom';

/**
 * Embed content item
 */
export interface EmbedItem {
  /** Unique identifier */
  id: string;
  /** Embed type */
  type: EmbedType;
  /** Source URL */
  url: string;
  /** Display title */
  title?: string;
  /** Description */
  description?: string;
  /** Thumbnail URL */
  thumbnail?: string;
  /** Embed HTML code */
  embedCode?: string;
  /** Custom dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
  /** Additional metadata */
  metadata?: Record<string, any>;
}

// === OPERATIONS ===
/**
 * Media operation result
 */
export interface MediaOperationResult {
  /** Operation success status */
  success: boolean;
  /** Processed media item */
  item?: MediaItem;
  /** Error message if failed */
  error?: string;
  /** Additional operation data */
  data?: any;
}

/**
 * File upload progress
 */
export interface UploadProgress {
  /** Loaded bytes */
  loaded: number;
  /** Total bytes */
  total: number;
  /** Progress percentage */
  percentage: number;
  /** Upload speed in bytes/sec */
  speed?: number;
  /** Estimated time remaining in seconds */
  estimatedTime?: number;
}

/**
 * Media upload options
 */
export interface MediaUploadOptions {
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Allowed MIME types */
  allowedTypes?: string[];
  /** Auto-generate thumbnails */
  generateThumbnails?: boolean;
  /** Compress images */
  compressImages?: boolean;
  /** Compression quality (0-100) */
  compressionQuality?: number;
  /** Progress callback */
  onProgress?: (progress: UploadProgress) => void;
}

// === MEDIA LIBRARY ===
/**
 * Media library filter options
 */
export interface MediaFilter {
  /** Media type filter */
  type?: MediaType | MediaType[];
  /** Search query */
  search?: string;
  /** Date range filter */
  dateRange?: {
    from: Date;
    to: Date;
  };
  /** Size range filter (in bytes) */
  sizeRange?: {
    min: number;
    max: number;
  };
  /** File extensions filter */
  extensions?: string[];
}

/**
 * Media library sort options
 */
export interface MediaSort {
  /** Sort field */
  field: 'name' | 'size' | 'createdAt' | 'updatedAt' | 'type';
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Media library view options
 */
export type MediaViewMode = 'grid' | 'list' | 'masonry';

// === CALLBACKS ===
/**
 * Media selection callback
 */
export type MediaSelectCallback = (item: MediaItem) => void;

/**
 * Media upload callback
 */
export type MediaUploadCallback = (result: MediaOperationResult) => void;

/**
 * Media delete callback
 */
export type MediaDeleteCallback = (id: string) => void;

/**
 * Media edit callback
 */
export type MediaEditCallback = (item: MediaItem, options: ImageEditOptions) => void;