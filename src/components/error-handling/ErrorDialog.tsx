/**
 * @fileoverview User-friendly error reporting dialog with recovery suggestions
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Error handling and user guidance
 */

import React, { useState } from 'react';
import { AlertTriangle, Copy, RefreshCw, FileX, HelpCircle, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

// === TYPES ===
/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories for better user guidance
 */
export type ErrorCategory = 
  | 'file_operation'
  | 'network'
  | 'permission'
  | 'validation'
  | 'system'
  | 'unknown';

/**
 * Recovery action interface
 */
export interface RecoveryAction {
  /** Unique action ID */
  id: string;
  /** Action label for button */
  label: string;
  /** Action description */
  description: string;
  /** Action handler function */
  action: () => void | Promise<void>;
  /** Whether action is primary */
  primary?: boolean;
  /** Whether action is destructive */
  destructive?: boolean;
}

/**
 * Application error interface
 */
export interface AppError {
  /** Error ID for tracking */
  id: string;
  /** Error message for users */
  message: string;
  /** Technical error details */
  details?: string;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Timestamp when error occurred */
  timestamp: number;
  /** Suggested recovery actions */
  recoveryActions?: RecoveryAction[];
  /** Related file path if applicable */
  filePath?: string;
  /** Whether error was recovered */
  recovered?: boolean;
}

/**
 * Error dialog props interface
 */
export interface ErrorDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Callback to close dialog */
  onClose: () => void;
  /** Error to display */
  error: AppError;
  /** Callback when error is resolved */
  onErrorResolved?: (errorId: string) => void;
}

// === CONSTANTS ===
/**
 * Error category display information
 */
const ERROR_CATEGORY_INFO: Record<ErrorCategory, { label: string; color: string; icon: React.ComponentType<any> }> = {
  file_operation: {
    label: 'File Operation',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    icon: FileX,
  },
  network: {
    label: 'Network',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    icon: ExternalLink,
  },
  permission: {
    label: 'Permission',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    icon: AlertTriangle,
  },
  validation: {
    label: 'Validation',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    icon: HelpCircle,
  },
  system: {
    label: 'System',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    icon: AlertTriangle,
  },
  unknown: {
    label: 'Unknown',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    icon: HelpCircle,
  },
};

/**
 * Severity display information
 */
const SEVERITY_INFO: Record<ErrorSeverity, { label: string; color: string }> = {
  low: {
    label: 'Low',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  },
  medium: {
    label: 'Medium',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  },
  high: {
    label: 'High',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  },
  critical: {
    label: 'Critical',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  },
};

// === UTILITY FUNCTIONS ===
/**
 * Copy error details to clipboard
 */
const copyErrorDetails = async (error: AppError): Promise<boolean> => {
  try {
    const errorReport = {
      id: error.id,
      message: error.message,
      details: error.details,
      category: error.category,
      severity: error.severity,
      timestamp: new Date(error.timestamp).toISOString(),
      filePath: error.filePath,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    await navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to copy error details:', error);
    return false;
  }
};

/**
 * Get user-friendly error guidance
 */
const getErrorGuidance = (category: ErrorCategory, severity: ErrorSeverity): string => {
  switch (category) {
    case 'file_operation':
      return severity === 'critical' 
        ? 'This is a critical file operation error. Your data may be at risk. Please try the suggested recovery actions immediately.'
        : 'There was a problem with a file operation. This usually resolves quickly with a retry.';
    
    case 'permission':
      return 'The application needs permission to access files or folders. Please check your system permissions and try again.';
    
    case 'network':
      return 'There was a network connectivity issue. Check your internet connection and try again.';
    
    case 'validation':
      return 'The input provided was not valid. Please check the format and try again.';
    
    case 'system':
      return 'A system-level error occurred. This may require restarting the application or checking system resources.';
    
    default:
      return 'An unexpected error occurred. Please try the suggested recovery actions.';
  }
};

// === ERROR DIALOG COMPONENT ===
/**
 * User-friendly error dialog with recovery suggestions
 * 
 * Displays errors in a clear, actionable format with suggested recovery
 * actions and detailed technical information when needed.
 */
export const ErrorDialog: React.FC<ErrorDialogProps> = ({
  isOpen,
  onClose,
  error,
  onErrorResolved,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState<string | null>(null);

  const categoryInfo = ERROR_CATEGORY_INFO[error.category];
  const severityInfo = SEVERITY_INFO[error.severity];
  const CategoryIcon = categoryInfo.icon;

  /**
   * Handle recovery action execution
   */
  const handleRecoveryAction = async (action: RecoveryAction): Promise<void> => {
    setIsExecutingAction(action.id);
    
    try {
      await action.action();
      onErrorResolved?.(error.id);
      onClose();
    } catch (actionError) {
      console.error('Recovery action failed:', actionError);
      // TODO: Show toast notification
    } finally {
      setIsExecutingAction(null);
    }
  };

  /**
   * Handle copying error details
   */
  const handleCopyDetails = async (): Promise<void> => {
    const success = await copyErrorDetails(error);
    if (success) {
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    }
  };

  /**
   * Handle dialog close
   */
  const handleClose = (): void => {
    setShowDetails(false);
    setCopiedToClipboard(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CategoryIcon className="h-5 w-5 text-destructive" />
            Error Occurred
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Categories and Severity */}
          <div className="flex items-center gap-2">
            <Badge className={categoryInfo.color}>
              {categoryInfo.label}
            </Badge>
            <Badge className={severityInfo.color}>
              {severityInfo.label}
            </Badge>
          </div>

          {/* Error Message */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-medium">
              {error.message}
            </AlertDescription>
          </Alert>

          {/* File Path if applicable */}
          {error.filePath && (
            <div className="text-sm">
              <span className="text-muted-foreground">File: </span>
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                {error.filePath}
              </code>
            </div>
          )}

          {/* Error Guidance */}
          <div className="text-sm text-muted-foreground">
            {getErrorGuidance(error.category, error.severity)}
          </div>

          {/* Recovery Actions */}
          {error.recoveryActions && error.recoveryActions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Suggested Actions:</h4>
              <div className="space-y-2">
                {error.recoveryActions.map((action) => (
                  <div key={action.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{action.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {action.description}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={action.primary ? 'default' : action.destructive ? 'destructive' : 'outline'}
                      onClick={() => handleRecoveryAction(action)}
                      disabled={isExecutingAction !== null}
                      className="ml-2"
                    >
                      {isExecutingAction === action.id && (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      )}
                      {action.label}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Technical Details */}
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start">
                {showDetails ? 'Hide' : 'Show'} Technical Details
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-3 mt-2">
              <div className="space-y-2">
                <div className="text-xs">
                  <span className="text-muted-foreground">Error ID: </span>
                  <code className="bg-muted px-1 py-0.5 rounded">{error.id}</code>
                </div>
                
                <div className="text-xs">
                  <span className="text-muted-foreground">Timestamp: </span>
                  {new Date(error.timestamp).toLocaleString()}
                </div>
                
                {error.details && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Details:</div>
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                      {error.details}
                    </pre>
                  </div>
                )}
              </div>
              
              <Button
                onClick={handleCopyDetails}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={copiedToClipboard}
              >
                <Copy className="h-3 w-3 mr-2" />
                {copiedToClipboard ? 'Copied!' : 'Copy Error Report'}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// === EXPORTS ===
export default ErrorDialog;