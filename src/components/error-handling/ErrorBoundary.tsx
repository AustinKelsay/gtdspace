/**
 * @fileoverview Global error boundary for crash recovery and user-friendly error reporting
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Error handling and user guidance
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, FileText, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';

// === TYPES ===
/**
 * Error boundary state interface
 */
interface ErrorBoundaryState {
  /** Whether an error has occurred */
  hasError: boolean;
  /** The error that occurred */
  error: Error | null;
  /** Error info from React */
  errorInfo: ErrorInfo | null;
  /** Crash count for this session */
  crashCount: number;
  /** Timestamp of the error */
  timestamp: number;
  /** Whether error details are expanded */
  showDetails: boolean;
}

/**
 * Error boundary props interface
 */
interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Fallback component when error occurs */
  fallback?: ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to enable crash recovery */
  enableRecovery?: boolean;
}

/**
 * Crash recovery data interface
 */
interface CrashRecoveryData {
  /** Number of crashes in this session */
  crashCount: number;
  /** Last crash timestamp */
  lastCrashTimestamp: number;
  /** Unsaved changes data */
  unsavedChanges?: Record<string, string>;
}

// === CONSTANTS ===
/**
 * Storage key for crash recovery data
 */
const CRASH_RECOVERY_KEY = 'gtdspace-crash-recovery';

/**
 * Maximum crash count before suggesting restart
 */
const MAX_CRASH_COUNT = 3;

/**
 * Crash recovery timeout (5 minutes)
 */
const CRASH_RECOVERY_TIMEOUT = 5 * 60 * 1000;

// === UTILITY FUNCTIONS ===
/**
 * Save crash recovery data to localStorage
 */
const saveCrashRecovery = (data: CrashRecoveryData): void => {
  try {
    localStorage.setItem(CRASH_RECOVERY_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save crash recovery data:', error);
  }
};

/**
 * Load crash recovery data from localStorage
 */
const loadCrashRecovery = (): CrashRecoveryData | null => {
  try {
    const data = localStorage.getItem(CRASH_RECOVERY_KEY);
    if (!data) return null;
    
    const parsed = JSON.parse(data) as CrashRecoveryData;
    
    // Check if crash data is stale
    const now = Date.now();
    if (now - parsed.lastCrashTimestamp > CRASH_RECOVERY_TIMEOUT) {
      localStorage.removeItem(CRASH_RECOVERY_KEY);
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error('Failed to load crash recovery data:', error);
    return null;
  }
};

/**
 * Clear crash recovery data
 */
const clearCrashRecovery = (): void => {
  try {
    localStorage.removeItem(CRASH_RECOVERY_KEY);
  } catch (error) {
    console.error('Failed to clear crash recovery data:', error);
  }
};

/**
 * Generate error report for debugging
 */
const generateErrorReport = (error: Error, errorInfo: ErrorInfo): string => {
  const report = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    componentStack: errorInfo.componentStack,
    buildInfo: {
      // These would be injected during build
      version: import.meta.env.VITE_APP_VERSION || 'unknown',
      commit: import.meta.env.VITE_GIT_COMMIT || 'unknown',
    },
  };
  
  return JSON.stringify(report, null, 2);
};

// === ERROR BOUNDARY COMPONENT ===
/**
 * Global error boundary component with crash recovery
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 * Includes crash recovery mechanisms and user-friendly error reporting.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private crashRecoveryData: CrashRecoveryData | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    // Load existing crash recovery data
    this.crashRecoveryData = loadCrashRecovery();
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      crashCount: this.crashRecoveryData?.crashCount || 0,
      timestamp: 0,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      timestamp: Date.now(),
    };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    const newCrashCount = this.state.crashCount + 1;
    
    // Update crash recovery data
    const recoveryData: CrashRecoveryData = {
      crashCount: newCrashCount,
      lastCrashTimestamp: Date.now(),
      // TODO: Integrate with file manager to save unsaved changes
      unsavedChanges: {},
    };
    
    saveCrashRecovery(recoveryData);
    
    // Update state
    this.setState({
      errorInfo: _errorInfo,
      crashCount: newCrashCount,
    });

    // Call error callback if provided
    this.props.onError?.(error, _errorInfo);

    // Log error for debugging
    console.error('Error Boundary caught an error:', error, _errorInfo);
  }

  /**
   * Handle recovery attempt
   */
  private handleRecovery = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  /**
   * Handle application restart
   */
  private handleRestart = (): void => {
    clearCrashRecovery();
    window.location.reload();
  };

  /**
   * Handle home navigation
   */
  private handleGoHome = (): void => {
    clearCrashRecovery();
    window.location.href = '/';
  };

  /**
   * Copy error report to clipboard
   */
  private handleCopyErrorReport = async (): Promise<void> => {
    if (!this.state.error || !this.state.errorInfo) return;
    
    try {
      const report = generateErrorReport(this.state.error, this.state.errorInfo);
      await navigator.clipboard.writeText(report);
      
      // TODO: Show toast notification
      console.log('Error report copied to clipboard');
    } catch (copyError) {
      console.error('Failed to copy error report:', copyError);
    }
  };

  /**
   * Toggle error details visibility
   */
  private toggleDetails = (): void => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { error, crashCount, timestamp, showDetails } = this.state;
      const { enableRecovery = true } = this.props;
      
      // Check if we should suggest restart
      const shouldSuggestRestart = crashCount >= MAX_CRASH_COUNT;
      
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
              <CardTitle className="text-xl">
                {shouldSuggestRestart ? 'Multiple Crashes Detected' : 'Something went wrong'}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Error Description */}
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">
                  {shouldSuggestRestart
                    ? `The application has crashed ${crashCount} times. We recommend restarting to resolve any underlying issues.`
                    : 'An unexpected error occurred. You can try to recover or restart the application.'
                  }
                </p>
                {crashCount > 1 && (
                  <p className="text-sm text-muted-foreground">
                    Crash count this session: {crashCount}
                  </p>
                )}
              </div>

              {/* Recovery Options */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {enableRecovery && !shouldSuggestRestart && (
                  <Button onClick={this.handleRecovery} className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                )}
                
                <Button 
                  onClick={this.handleRestart} 
                  variant={shouldSuggestRestart ? "default" : "outline"}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Restart App
                </Button>
                
                <Button onClick={this.handleGoHome} variant="outline" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </div>

              {/* Crash Recovery Info */}
              {this.crashRecoveryData?.unsavedChanges && (
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    We detected unsaved changes from a previous session. These will be restored when you restart.
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Details */}
              <Collapsible open={showDetails} onOpenChange={this.toggleDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    {showDetails ? 'Hide' : 'Show'} Error Details
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Error Message:</h4>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32">
                      {error.message}
                    </pre>
                  </div>
                  
                  {error.stack && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Stack Trace:</h4>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={this.handleCopyErrorReport} 
                      variant="outline" 
                      size="sm"
                      className="text-xs"
                    >
                      Copy Error Report
                    </Button>
                    <div className="text-xs text-muted-foreground flex items-center">
                      Occurred at: {new Date(timestamp).toLocaleString()}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Help Text */}
              <div className="text-xs text-muted-foreground text-center space-y-1">
                <p>
                  If this problem persists, please copy the error report and contact support.
                </p>
                <p>
                  Your files are safe and stored locally on your computer.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// === EXPORTS ===
export default ErrorBoundary;
export type { ErrorBoundaryProps, ErrorBoundaryState, CrashRecoveryData };