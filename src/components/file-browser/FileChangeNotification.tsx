/**
 * @fileoverview File change notification component for external file modifications
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - File watcher UI integration
 */

import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { BaseComponentProps, FileChangeEvent } from '@/types';

export interface FileChangeNotificationProps extends BaseComponentProps {
  /** File change event to display */
  event: FileChangeEvent;
  /** Whether the affected file is currently open */
  isFileOpen: boolean;
  /** Callback to reload the file */
  onReload?: () => void;
  /** Callback to dismiss the notification */
  onDismiss: () => void;
}

/**
 * Component that displays notifications for external file changes
 */
export const FileChangeNotification: React.FC<FileChangeNotificationProps> = ({
  event,
  isFileOpen,
  onReload,
  onDismiss,
  className = '',
  ...props
}) => {
  const getEventDescription = () => {
    switch (event.event_type) {
      case 'created':
        return `New file "${event.file_name}" was created`;
      case 'modified':
        return `File "${event.file_name}" was modified externally`;
      case 'deleted':
        return `File "${event.file_name}" was deleted`;
      default:
        return `File "${event.file_name}" was changed`;
    }
  };

  const getActionText = () => {
    switch (event.event_type) {
      case 'modified':
        return isFileOpen ? 'Reload' : 'Refresh';
      case 'created':
        return 'Refresh';
      case 'deleted':
        return 'Close Tab';
      default:
        return 'Refresh';
    }
  };

  const shouldShowReloadButton = () => {
    return event.event_type === 'modified' && isFileOpen && onReload;
  };

  return (
    <Alert className={`border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 ${className}`} {...props}>
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-amber-800 dark:text-amber-200">
          {getEventDescription()}
        </span>
        <div className="flex items-center gap-2 ml-4">
          {shouldShowReloadButton() && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReload}
              className="h-7 px-2 text-xs border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {getActionText()}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default FileChangeNotification;