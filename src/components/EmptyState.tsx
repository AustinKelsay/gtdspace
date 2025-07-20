/**
 * @fileoverview Empty state component for various application states
 * @author Development Team
 * @created 2024-01-XX
 * @phase 0 - Reusable empty state component
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';
import type { BaseComponentProps } from '@/types';

/**
 * Props for the EmptyState component
 */
interface EmptyStateProps extends BaseComponentProps {
  /** Icon to display in the empty state */
  icon: LucideIcon;
  /** Main heading text */
  title: string;
  /** Descriptive text below the title */
  description: string;
  /** Optional action button text */
  actionLabel?: string;
  /** Optional action button click handler */
  onAction?: () => void;
  /** Whether the action button should be disabled */
  actionDisabled?: boolean;
}

/**
 * Reusable empty state component
 * 
 * Displays a consistent empty state UI across the application with
 * an icon, title, description, and optional action button. Used for
 * various scenarios like no files selected, empty folders, etc.
 * 
 * @param props - Empty state configuration props
 * @returns EmptyState JSX structure
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon={Folder}
 *   title="No folder selected"
 *   description="Select a folder to view your markdown files"
 *   actionLabel="Open Folder"
 *   onAction={() => openFolderDialog()}
 * />
 * ```
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 ${className}`}>
      {/* Icon */}
      <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center">
        <Icon size={24} className="text-muted-foreground" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {description}
      </p>

      {/* Action Button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          disabled={actionDisabled}
          className={`
            px-4 py-2 text-sm font-medium rounded-md transition-colors
            ${actionDisabled 
              ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }
          `}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;