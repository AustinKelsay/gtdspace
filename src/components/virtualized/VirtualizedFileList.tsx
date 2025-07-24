/**
 * @fileoverview Virtualized file list for handling large numbers of files efficiently
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Performance optimization for 1000+ files
 */

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Search, FileText } from 'lucide-react';
import { FileItem } from '@/components/file-browser/FileItem';
import { FileListSkeleton } from '@/components/polish';
import type { MarkdownFile, FileOperation } from '@/types';

// === TYPES ===
interface VirtualizedFileListProps {
  /** Array of files to display */
  files: MarkdownFile[];
  /** Currently selected file */
  selectedFile?: MarkdownFile;
  /** Callback when a file is selected */
  onFileSelect: (file: MarkdownFile) => void;
  /** Callback for file operations (rename, delete, etc.) */
  onFileOperation?: (operation: FileOperation) => void;
  /** Search query for filtering */
  searchQuery?: string;
  /** Whether the list is loading */
  loading?: boolean;
  /** Height of the virtualized container */
  height?: number;
  /** Height of each file item */
  itemHeight?: number;
  /** Optional CSS class name */
  className?: string;
  /** Overscan count for better scrolling performance */
  overscanCount?: number;
}

interface VirtualizedItemProps {
  /** Index of the item */
  index: number;
  /** React Window style object */
  style: React.CSSProperties;
  /** Data passed from the parent list */
  data: {
    files: MarkdownFile[];
    selectedFile?: MarkdownFile;
    onFileSelect: (file: MarkdownFile) => void;
    onFileOperation?: (operation: FileOperation) => void;
  };
}

// === CONSTANTS ===
const DEFAULT_ITEM_HEIGHT = 56; // Height of each file item in pixels
const DEFAULT_HEIGHT = 400; // Default height of the virtualized list
const DEFAULT_OVERSCAN_COUNT = 5; // Number of items to render outside the visible area

// === VIRTUALIZED ITEM COMPONENT ===
const VirtualizedItem: React.FC<VirtualizedItemProps> = ({ index, style, data }) => {
  const { files, selectedFile, onFileSelect, onFileOperation } = data;
  const file = files[index];

  if (!file) {
    return <div style={style} />;
  }

  return (
    <div style={style}>
      <div className="px-1 py-0.5">
        <FileItem
          file={file}
          isSelected={selectedFile?.id === file.id}
          onSelect={() => onFileSelect(file)}
          onFileOperation={onFileOperation}
        />
      </div>
    </div>
  );
};

// === VIRTUALIZED FILE LIST COMPONENT ===
export const VirtualizedFileList: React.FC<VirtualizedFileListProps> = ({
  files,
  selectedFile,
  onFileSelect,
  onFileOperation,
  searchQuery = '',
  loading = false,
  height = DEFAULT_HEIGHT,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  className = '',
  overscanCount = DEFAULT_OVERSCAN_COUNT,
}) => {
  const [isScrolling, setIsScrolling] = useState(false);
  const listRef = useRef<List>(null);

  // === FILTERED FILES ===
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    
    const query = searchQuery.toLowerCase().trim();
    return files.filter(file => 
      file.name.toLowerCase().includes(query) ||
      file.path.toLowerCase().includes(query)
    );
  }, [files, searchQuery]);

  // === SCROLL HANDLERS ===
  const handleItemsRendered = useCallback(() => {
    // This callback is called when the visible range changes
    // Could be used for analytics or additional optimizations
  }, []);

  const handleScroll = useCallback(() => {
    setIsScrolling(true);
  }, []);

  // Note: react-window doesn't have onScrollStop, we'll use a timeout
  useEffect(() => {
    if (isScrolling) {
      const timer = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isScrolling]);

  // === KEYBOARD NAVIGATION ===
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedFile || !listRef.current) return;

      const selectedIndex = filteredFiles.findIndex(file => file.id === selectedFile.id);
      if (selectedIndex === -1) return;

      let newIndex = selectedIndex;
      
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          newIndex = Math.min(selectedIndex + 1, filteredFiles.length - 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          newIndex = Math.max(selectedIndex - 1, 0);
          break;
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          newIndex = filteredFiles.length - 1;
          break;
        case 'PageDown':
          event.preventDefault();
          const pageSize = Math.floor(height / itemHeight);
          newIndex = Math.min(selectedIndex + pageSize, filteredFiles.length - 1);
          break;
        case 'PageUp':
          event.preventDefault();
          const pageUpSize = Math.floor(height / itemHeight);
          newIndex = Math.max(selectedIndex - pageUpSize, 0);
          break;
        default:
          return;
      }

      if (newIndex !== selectedIndex && filteredFiles[newIndex]) {
        onFileSelect(filteredFiles[newIndex]);
        // Scroll to the selected item
        listRef.current.scrollToItem(newIndex, 'smart');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, filteredFiles, onFileSelect, height, itemHeight]);

  // === SCROLL TO SELECTED ITEM ===
  useEffect(() => {
    if (selectedFile && listRef.current) {
      const selectedIndex = filteredFiles.findIndex(file => file.id === selectedFile.id);
      if (selectedIndex >= 0) {
        listRef.current.scrollToItem(selectedIndex, 'smart');
      }
    }
  }, [selectedFile, filteredFiles]);

  // === DATA FOR VIRTUALIZED ITEMS ===
  const itemData = useMemo(() => ({
    files: filteredFiles,
    selectedFile,
    onFileSelect,
    onFileOperation,
  }), [filteredFiles, selectedFile, onFileSelect, onFileOperation]);

  // === LOADING STATE ===
  if (loading) {
    return (
      <div className={`h-full ${className}`}>
        <FileListSkeleton 
          count={Math.floor(height / itemHeight)}
          showIcon={true}
          showMetadata={true}
          animation="pulse"
          className="py-2"
        />
      </div>
    );
  }

  // === EMPTY STATE ===
  if (filteredFiles.length === 0) {
    if (searchQuery && files.length > 0) {
      return (
        <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`} style={{ height }}>
          <Search className="h-8 w-8 text-muted-foreground mb-4" />
          <p className="text-sm font-medium mb-2">No files found</p>
          <p className="text-xs text-muted-foreground">
            Try a different search term
          </p>
        </div>
      );
    }

    return (
      <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`} style={{ height }}>
        <FileText className="h-8 w-8 text-muted-foreground mb-4" />
        <p className="text-sm font-medium mb-2">No markdown files</p>
        <p className="text-xs text-muted-foreground">
          This folder doesn't contain any markdown files
        </p>
      </div>
    );
  }

  // === DEBUG INFO (only in development) ===
  const showDebugInfo = import.meta.env.DEV && filteredFiles.length > 100;

  return (
    <div className={`relative ${className}`}>
      {/* Debug info for large lists */}
      {showDebugInfo && (
        <div className="absolute top-0 right-0 z-10 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs px-2 py-1 rounded-bl">
          Virtualized: {filteredFiles.length} files
          {isScrolling && ' (scrolling)'}
        </div>
      )}

      {/* Virtualized List */}
      <List
        ref={listRef}
        height={height}
        width="100%"
        itemCount={filteredFiles.length}
        itemSize={itemHeight}
        itemData={itemData}
        overscanCount={overscanCount}
        onItemsRendered={handleItemsRendered}
        onScroll={handleScroll}
        className="scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-muted"
      >
        {VirtualizedItem}
      </List>

      {/* Performance hint for very large lists */}
      {filteredFiles.length > 1000 && (
        <div className="absolute bottom-0 left-0 right-0 bg-blue-50 dark:bg-blue-950 border-t border-blue-200 dark:border-blue-800 px-3 py-2">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Viewing {filteredFiles.length.toLocaleString()} files • Virtualized for performance
          </p>
        </div>
      )}
    </div>
  );
};

// === HOOKS ===

/**
 * Hook for managing virtualized file list state and performance
 */
export const useVirtualizedFileList = (files: MarkdownFile[]) => {
  const [shouldVirtualize, setShouldVirtualize] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    totalFiles: 0,
    renderTime: 0,
    memoryUsage: 0,
  });

  // Determine if virtualization should be enabled
  useEffect(() => {
    const fileCount = files.length;
    // Enable virtualization for 100+ files
    setShouldVirtualize(fileCount >= 100);

    // Update performance metrics
    setPerformanceMetrics(prev => ({
      ...prev,
      totalFiles: fileCount,
    }));
  }, [files.length]);

  // Performance monitoring
  useEffect(() => {
    if (shouldVirtualize) {
      const startTime = performance.now();
      
      // Measure render time
      requestAnimationFrame(() => {
        const endTime = performance.now();
        setPerformanceMetrics(prev => ({
          ...prev,
          renderTime: endTime - startTime,
        }));
      });

      // Memory usage (if available)
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setPerformanceMetrics(prev => ({
          ...prev,
          memoryUsage: memory.usedJSHeapSize,
        }));
      }
    }
  }, [shouldVirtualize, files]);

  return {
    shouldVirtualize,
    performanceMetrics,
  };
};

export default VirtualizedFileList;