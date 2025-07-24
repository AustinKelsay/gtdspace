/**
 * @fileoverview Lazy components exports
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Code splitting exports
 */

export * from './LazyComponents';
export { default as LazyComponents } from './LazyComponents';

// Explicitly export commonly used components
export {
  WYSIWYGEditorLazy,
  GlobalSearchLazy,
  SettingsManagerLazy,
  CommandPaletteLazy,
  DebugPanelLazy,
  ExportManagerLazy,
  DocumentOutlineLazy,
  TableOfContentsLazy,
  DocumentStatsLazy,
  PerformanceMonitorLazy,
  OnboardingTourLazy,
  HelpDocumentationLazy,
  KeyboardShortcutsReferenceLazy
} from './LazyComponents';