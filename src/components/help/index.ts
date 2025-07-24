/**
 * @fileoverview Help system component exports
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Help and onboarding system
 */

export { HelpDocumentation } from './HelpDocumentation';
export { useTooltipManager } from './TooltipManager';
export { KeyboardShortcutsReference } from './KeyboardShortcutsReference';
export { FeedbackWidget } from './FeedbackWidget';
export { HelpHints } from './HelpHints';

// Export types
export type {
  UserFeedback,
  FeedbackType,
  FeedbackPriority,
  FeedbackStatus,
  FeedbackContext,
  SystemInfo,
  FeedbackAttachment,
  FeedbackWidgetConfig
} from './FeedbackWidget';