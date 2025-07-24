/**
 * @fileoverview Error handling components and utilities index
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Error handling and user guidance
 */

// Error Boundary
export { 
  ErrorBoundary,
  default as DefaultErrorBoundary 
} from './ErrorBoundary';
export type { 
  ErrorBoundaryProps, 
  ErrorBoundaryState, 
  CrashRecoveryData 
} from './ErrorBoundary';

// Error Dialog
export { 
  ErrorDialog,
  default as DefaultErrorDialog 
} from './ErrorDialog';
export type { 
  ErrorSeverity, 
  ErrorCategory, 
  RecoveryAction, 
  AppError,
  ErrorDialogProps 
} from './ErrorDialog';

// Error Manager Service
export { 
  ErrorManager,
  getErrorManager,
  reportError,
  resolveError,
  default as DefaultErrorManager 
} from '@/services/ErrorManager';
export type { 
  ErrorListener, 
  ErrorResolutionListener 
} from '@/services/ErrorManager';

// Error Handler Hook
export { 
  useErrorHandler,
  useFileErrorHandler,
  useNetworkErrorHandler,
  useValidationErrorHandler,
  default as defaultUseErrorHandler 
} from '@/hooks/useErrorHandler';
export type { 
  UseErrorHandlerReturn, 
  UseErrorHandlerOptions 
} from '@/hooks/useErrorHandler';


// Logging Service Components
export {
  LogViewer,
  LogStats,
  LoggingProvider,
} from './LoggingService';

// Logging Service Core
export {
  logger,
  logError,
} from '@/services/logging/LoggingService';
export type {
  LogLevel,
  LogEntry,
  LoggerConfig,
  LogFilter,
  LogTransport,
} from '@/services/logging/LoggingService';