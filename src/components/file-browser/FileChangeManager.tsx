/**
 * @fileoverview File change manager for handling external file modifications
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - File watcher UI integration
 */

import React, { useState, useCallback, useEffect } from 'react';
import { FileChangeNotification } from './FileChangeNotification';
import type { BaseComponentProps, FileChangeEvent, FileTab } from '@/types';

export interface FileChangeManagerProps extends BaseComponentProps {
  /** Recent file change events */
  events: FileChangeEvent[];
  /** Currently open tabs */
  openTabs: FileTab[];
  /** Callback to reload a file in a tab */
  onReloadFile: (filePath: string) => Promise<void>;
  /** Callback to close a tab */
  onCloseTab: (tabId: string) => void;
  /** Callback to refresh file list */
  onRefreshFileList: () => Promise<void>;
}

interface ProcessedEvent extends FileChangeEvent {
  id: string;
  dismissed: boolean;
  isFileOpen: boolean;
  affectedTabId?: string;
}

/**
 * Manager component for handling and displaying file change notifications
 */
export const FileChangeManager: React.FC<FileChangeManagerProps> = ({
  events,
  openTabs,
  onReloadFile,
  onCloseTab,
  onRefreshFileList,
  className = '',
  ...props
}) => {
  const [processedEvents, setProcessedEvents] = useState<ProcessedEvent[]>([]);

  // Process new events
  useEffect(() => {
    const newEvents = events.filter(event => 
      !processedEvents.some(pe => pe.timestamp === event.timestamp && pe.file_path === event.file_path)
    );

    if (newEvents.length === 0) return;

    const processed = newEvents.map(event => {
      const affectedTab = openTabs.find(tab => tab.file.path === event.file_path);
      
      return {
        ...event,
        id: `${event.file_path}-${event.timestamp}`,
        dismissed: false,
        isFileOpen: !!affectedTab,
        affectedTabId: affectedTab?.id,
      };
    });

    setProcessedEvents(prev => [...prev, ...processed]);

    // Auto-handle certain events
    newEvents.forEach(event => {
      const affectedTab = openTabs.find(tab => tab.file.path === event.file_path);
      
      if (event.event_type === 'deleted' && affectedTab) {
        // Auto-close tab for deleted files
        onCloseTab(affectedTab.id);
      } else if (event.event_type === 'created') {
        // Auto-refresh file list for new files
        onRefreshFileList();
      }
    });
  }, [events, openTabs, onCloseTab, onRefreshFileList, processedEvents]);

  // Clean up old dismissed events
  useEffect(() => {
    const cleanupTimer = setTimeout(() => {
      setProcessedEvents(prev => 
        prev.filter(event => !event.dismissed || Date.now() - event.timestamp * 1000 < 30000)
      );
    }, 30000); // Clean up after 30 seconds

    return () => clearTimeout(cleanupTimer);
  }, [processedEvents]);

  const handleDismiss = useCallback((eventId: string) => {
    setProcessedEvents(prev => 
      prev.map(event => 
        event.id === eventId ? { ...event, dismissed: true } : event
      )
    );
  }, []);

  const handleReload = useCallback(async (event: ProcessedEvent) => {
    try {
      await onReloadFile(event.file_path);
      handleDismiss(event.id);
    } catch (error) {
      console.error('Failed to reload file:', error);
    }
  }, [onReloadFile, handleDismiss]);

  const visibleEvents = processedEvents.filter(event => !event.dismissed);

  if (visibleEvents.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`} {...props}>
      {visibleEvents.map(event => (
        <FileChangeNotification
          key={event.id}
          event={event}
          isFileOpen={event.isFileOpen}
          onReload={event.event_type === 'modified' && event.isFileOpen ? 
            () => handleReload(event) : undefined
          }
          onDismiss={() => handleDismiss(event.id)}
        />
      ))}
    </div>
  );
};

export default FileChangeManager;