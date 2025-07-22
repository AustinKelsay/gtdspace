/**
 * @fileoverview File attachment support for non-image files
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
import React, { useState, useCallback, useRef } from 'react';
import {
  Paperclip,
  File,
  FileText,
  Archive,
  Image as ImageIcon,
  Video,
  Music,
  Download,
  Trash2,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type {
  MediaItem,
  MediaType,
  UploadProgress
} from './types';

// === TYPES ===
/**
 * Props for the FileAttachments component
 */
export interface FileAttachmentsProps {
  /** Current file attachments */
  attachments?: MediaItem[];
  /** Callback when files are uploaded */
  onUpload: (files: MediaItem[]) => void;
  /** Callback when attachment is removed */
  onRemove: (id: string) => void;
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Maximum number of attachments */
  maxAttachments?: number;
  /** Allowed file types */
  allowedTypes?: string[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * File attachment with upload status
 */
interface FileAttachment extends MediaItem {
  uploadStatus: 'pending' | 'uploading' | 'success' | 'error';
  uploadProgress?: UploadProgress;
  errorMessage?: string;
}

// === CONSTANTS ===
const FILE_TYPE_ICONS = {
  document: FileText,
  archive: Archive,
  image: ImageIcon,
  video: Video,
  audio: Music,
  other: File
};

const FILE_TYPE_COLORS = {
  document: 'text-blue-600',
  archive: 'text-yellow-600',
  image: 'text-green-600',
  video: 'text-red-600',
  audio: 'text-purple-600',
  other: 'text-gray-600'
};

const DEFAULT_ALLOWED_TYPES = [
  'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', // Documents
  'zip', 'rar', '7z', 'tar', 'gz', // Archives
  'json', 'xml', 'csv', 'log' // Data files
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
function getMediaTypeFromExtension(filename: string): MediaType {
  const ext = getFileExtension(filename);

  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'document';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';

  return 'other';
}

/**
 * Validates file for upload
 */
function validateFile(
  file: File,
  maxSize: number,
  allowedTypes: string[]
): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds limit of ${formatFileSize(maxSize)}`
    };
  }

  // Check file type
  const extension = getFileExtension(file.name);
  if (!allowedTypes.includes(extension)) {
    return {
      valid: false,
      error: `File type '${extension}' not allowed`
    };
  }

  return { valid: true };
}

// === MAIN COMPONENT ===
/**
 * File attachment support for non-image files
 * 
 * Provides functionality for attaching various file types to documents
 * including documents, archives, and other file formats. Features:
 * - Drag and drop file upload
 * - Upload progress tracking
 * - File validation and error handling
 * - Attachment management and removal
 * 
 * @param props - Component props
 * @returns JSX element containing file attachment interface
 */
export const FileAttachments: React.FC<FileAttachmentsProps> = ({
  attachments = [],
  onUpload,
  onRemove,
  maxFileSize = 25 * 1024 * 1024, // 25MB default
  maxAttachments = 10,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  className
}) => {
  // === STATE ===
  const [dragOver, setDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, FileAttachment>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === COMPUTED VALUES ===
  const canAddMore = attachments.length + uploadingFiles.size < maxAttachments;
  const allAttachments = [
    ...attachments,
    ...Array.from(uploadingFiles.values())
  ];

  // === HANDLERS ===

  /**
   * Handles file selection
   */
  const handleFileSelect = useCallback((files: FileList) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Validate each file
    fileArray.forEach(file => {
      if (!canAddMore) {
        errors.push(`Maximum ${maxAttachments} attachments allowed`);
        return;
      }

      const validation = validateFile(file, maxFileSize, allowedTypes);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    // Show errors (you might want to use a proper notification system)
    if (errors.length > 0) {
      console.warn('File upload errors:', errors);
    }

    // Process valid files
    validFiles.forEach(file => processFileUpload(file));
  }, [canAddMore, maxAttachments, maxFileSize, allowedTypes]);

  /**
   * Processes individual file upload
   */
  const processFileUpload = useCallback(async (file: File) => {
    const fileId = `upload-${Date.now()}-${Math.random()}`;

    // Create attachment object
    const attachment: FileAttachment = {
      id: fileId,
      name: file.name,
      extension: getFileExtension(file.name),
      type: getMediaTypeFromExtension(file.name),
      size: file.size,
      mimeType: file.type,
      path: '', // Will be set after upload
      createdAt: new Date(),
      updatedAt: new Date(),
      uploadStatus: 'uploading',
      uploadProgress: {
        loaded: 0,
        total: file.size,
        percentage: 0
      }
    };

    // Add to uploading files
    setUploadingFiles(prev => new Map(prev.set(fileId, attachment)));

    try {
      // Simulate file upload with progress
      const uploadFile = (): Promise<string> => {
        return new Promise((resolve, reject) => {
          let progress = 0;

          const interval = setInterval(() => {
            progress += Math.random() * 15;

            if (progress >= 100) {
              progress = 100;
              clearInterval(interval);

              // Create object URL for the file
              const objectUrl = URL.createObjectURL(file);
              resolve(objectUrl);
            }

            // Update progress
            setUploadingFiles(prev => {
              const newMap = new Map(prev);
              const currentAttachment = newMap.get(fileId);
              if (currentAttachment) {
                newMap.set(fileId, {
                  ...currentAttachment,
                  uploadProgress: {
                    loaded: (progress / 100) * file.size,
                    total: file.size,
                    percentage: progress
                  }
                });
              }
              return newMap;
            });
          }, 100);

          // Simulate potential upload failure (5% chance)
          if (Math.random() < 0.05) {
            setTimeout(() => {
              clearInterval(interval);
              reject(new Error('Upload failed'));
            }, 2000);
          }
        });
      };

      const filePath = await uploadFile();

      // Mark as successful
      const successfulAttachment: MediaItem = {
        ...attachment,
        path: filePath
      };

      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });

      onUpload([successfulAttachment]);

    } catch (error) {
      // Mark as failed
      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        const currentAttachment = newMap.get(fileId);
        if (currentAttachment) {
          newMap.set(fileId, {
            ...currentAttachment,
            uploadStatus: 'error',
            errorMessage: error instanceof Error ? error.message : 'Upload failed'
          });
        }
        return newMap;
      });
    }
  }, [onUpload]);

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
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  /**
   * Handles remove attachment
   */
  const handleRemove = useCallback((id: string) => {
    // Check if it's an uploading file
    if (uploadingFiles.has(id)) {
      setUploadingFiles(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    } else {
      onRemove(id);
    }
  }, [uploadingFiles, onRemove]);

  /**
   * Handles download attachment
   */
  const handleDownload = useCallback((attachment: MediaItem) => {
    const link = document.createElement('a');
    link.href = attachment.path;
    link.download = attachment.name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // === RENDER HELPERS ===

  /**
   * Renders individual attachment
   */
  const renderAttachment = (attachment: MediaItem | FileAttachment) => {
    const Icon = FILE_TYPE_ICONS[attachment.type] || File;
    const isUploading = 'uploadStatus' in attachment && attachment.uploadStatus === 'uploading';
    const hasError = 'uploadStatus' in attachment && attachment.uploadStatus === 'error';

    return (
      <Card key={attachment.id} className="p-3 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Icon className={cn('w-8 h-8', FILE_TYPE_COLORS[attachment.type])} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate" title={attachment.name}>
              {attachment.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatFileSize(attachment.size)}
              {attachment.extension && (
                <span className="ml-1 uppercase">
                  {attachment.extension}
                </span>
              )}
            </div>

            {/* Upload Progress */}
            {isUploading && 'uploadProgress' in attachment && attachment.uploadProgress && (
              <div className="mt-2 space-y-1">
                <Progress value={attachment.uploadProgress.percentage} />
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Uploading... {Math.round(attachment.uploadProgress.percentage)}%
                </div>
              </div>
            )}

            {/* Error Message */}
            {hasError && 'errorMessage' in attachment && (
              <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {attachment.errorMessage}
              </div>
            )}

            {/* Success Status */}
            {'uploadStatus' in attachment && attachment.uploadStatus === 'success' && (
              <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Upload complete
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!isUploading && !hasError && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDownload(attachment)}
                title="Download"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRemove(attachment.id)}
              title="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  /**
   * Renders upload area
   */
  const renderUploadArea = () => (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
        dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
        !canAddMore && 'opacity-50 cursor-not-allowed'
      )}
      onDragOver={canAddMore ? handleDragOver : undefined}
      onDragLeave={canAddMore ? handleDragLeave : undefined}
      onDrop={canAddMore ? handleDrop : undefined}
      onClick={canAddMore ? () => fileInputRef.current?.click() : undefined}
    >
      <Paperclip className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
      <div className="font-medium text-sm mb-1">
        {canAddMore ? 'Attach files' : 'Maximum attachments reached'}
      </div>
      {canAddMore && (
        <div className="text-xs text-muted-foreground">
          Drop files here or click to browse
          <br />
          Max {formatFileSize(maxFileSize)} • {allowedTypes.join(', ')}
        </div>
      )}
    </div>
  );

  // === MAIN RENDER ===
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          File Attachments ({allAttachments.length}/{maxAttachments})
        </Label>

        {canAddMore && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Add Files
          </Button>
        )}
      </div>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={allowedTypes.map(type => `.${type}`).join(',')}
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Upload Area */}
      {allAttachments.length === 0 ? (
        renderUploadArea()
      ) : (
        <div className="space-y-2">
          {allAttachments.map(renderAttachment)}

          {/* Add More Button */}
          {canAddMore && (
            <div className="pt-2">
              {renderUploadArea()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileAttachments;