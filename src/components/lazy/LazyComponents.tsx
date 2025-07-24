/**
 * @fileoverview Lazy-loaded components for code splitting
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Performance optimization through code splitting
 */

import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// === LOADING FALLBACK ===
/**
 * Loading fallback component for lazy-loaded modules
 */
const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="h-6 w-6 animate-spin mr-2" />
    <span className="text-muted-foreground">{message}</span>
  </div>
);

// === LAZY LOADED COMPONENTS ===

// WYSIWYG Editor - Large component with dependencies
export const LazyWYSIWYGEditor = lazy(() => 
  import('@/components/wysiwyg/WYSIWYGEditor').then(module => ({
    default: module.WYSIWYGEditor
  }))
);

// Enhanced WYSIWYG Editor with all features
export const LazyWYSIWYGEnhancedEditor = lazy(() => 
  import('@/components/editor/WYSIWYGEnhancedEditor').then(module => ({
    default: module.WYSIWYGEnhancedEditor
  }))
);

// Block Manager for Notion-style editing
export const LazyBlockManager = lazy(() => 
  import('@/components/blocks/BlockManager').then(module => ({
    default: module.BlockManager
  }))
);

// Global Search functionality
export const LazyGlobalSearch = lazy(() => 
  import('@/components/search/GlobalSearch').then(module => ({
    default: module.GlobalSearch
  }))
);

// Export Manager for PDF/HTML export
export const LazyExportManager = lazy(() => 
  import('@/components/export/ExportManager').then(module => ({
    default: module.ExportManager
  }))
);

// Media Manager for image/file management
export const LazyMediaManager = lazy(() => 
  import('@/components/media/MediaManager').then(module => ({
    default: module.MediaManager
  }))
);

// Image Editor for advanced image manipulation
export const LazyImageEditor = lazy(() => 
  import('@/components/media/ImageEditor').then(module => ({
    default: module.ImageEditor
  }))
);

// Document Navigation components
export const LazyDocumentOutline = lazy(() => 
  import('@/components/navigation/DocumentOutline').then(module => ({
    default: module.DocumentOutline
  }))
);

export const LazyTableOfContents = lazy(() => 
  import('@/components/navigation/TableOfContents').then(module => ({
    default: module.TableOfContents
  }))
);

export const LazyDocumentStats = lazy(() => 
  import('@/components/navigation/DocumentStats').then(module => ({
    default: module.DocumentStats
  }))
);

// Performance Monitor
export const LazyPerformanceMonitor = lazy(() => 
  import('@/components/monitoring/PerformanceMonitor').then(module => ({
    default: module.PerformanceMonitorComponent
  }))
);

// Settings Manager
export const LazySettingsManager = lazy(() => 
  import('@/components/settings/SettingsManager').then(module => ({
    default: module.SettingsManager
  }))
);

// Command Palette
export const LazyCommandPalette = lazy(() => 
  import('@/components/command-palette/CommandPalette').then(module => ({
    default: module.CommandPalette
  }))
);

// Debug Panel
export const LazyDebugPanel = lazy(() => 
  import('@/components/debug/DebugPanel').then(module => ({
    default: module.DebugPanel
  }))
);

// Onboarding Tour for first-time users
const LazyOnboardingTour = lazy(() => 
  import('@/components/onboarding/OnboardingTour').then(module => ({
    default: module.OnboardingTour
  }))
);

// Help Documentation system
const LazyHelpDocumentation = lazy(() => 
  import('@/components/help/HelpDocumentation').then(module => ({
    default: module.HelpDocumentation
  }))
);

// Keyboard Shortcuts Reference overlay
const LazyKeyboardShortcutsReference = lazy(() => 
  import('@/components/help/KeyboardShortcutsReference').then(module => ({
    default: module.KeyboardShortcutsReference
  }))
);

// === WRAPPER COMPONENTS ===

/**
 * Wrapper for lazy-loaded WYSIWYG editor
 */
export const WYSIWYGEditorLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading WYSIWYG Editor..." />}>
    <LazyWYSIWYGEditor {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded enhanced WYSIWYG editor
 */
export const WYSIWYGEnhancedEditorLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Enhanced Editor..." />}>
    <LazyWYSIWYGEnhancedEditor {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded block manager
 */
export const BlockManagerLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Block Editor..." />}>
    <LazyBlockManager {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded global search
 */
export const GlobalSearchLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Search..." />}>
    <LazyGlobalSearch {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded export manager
 */
export const ExportManagerLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Export Options..." />}>
    <LazyExportManager {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded media manager
 */
export const MediaManagerLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Media Manager..." />}>
    <LazyMediaManager {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded document navigation
 */
export const DocumentOutlineLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Outline..." />}>
    <LazyDocumentOutline {...props} />
  </Suspense>
);

export const TableOfContentsLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Table of Contents..." />}>
    <LazyTableOfContents {...props} />
  </Suspense>
);

export const DocumentStatsLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Statistics..." />}>
    <LazyDocumentStats {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded performance monitor
 */
export const PerformanceMonitorLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Performance Monitor..." />}>
    <LazyPerformanceMonitor {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded settings
 */
export const SettingsManagerLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Settings..." />}>
    <LazySettingsManager {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded command palette
 */
export const CommandPaletteLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Command Palette..." />}>
    <LazyCommandPalette {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded debug panel
 */
export const DebugPanelLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Debug Panel..." />}>
    <LazyDebugPanel {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded onboarding tour
 */
export const OnboardingTourLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Onboarding..." />}>
    <LazyOnboardingTour {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded help documentation
 */
export const HelpDocumentationLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Help Documentation..." />}>
    <LazyHelpDocumentation {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded keyboard shortcuts reference
 */
export const KeyboardShortcutsReferenceLazy: React.FC<any> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Keyboard Shortcuts..." />}>
    <LazyKeyboardShortcutsReference {...props} />
  </Suspense>
);

// === PRELOAD FUNCTIONS ===

/**
 * Preload critical components to improve perceived performance
 */
export const preloadCriticalComponents = () => {
  // Preload editor components
  import('@/components/wysiwyg/WYSIWYGEditor');
  import('@/components/editor/WYSIWYGEnhancedEditor');
};

/**
 * Preload navigation components
 */
export const preloadNavigationComponents = () => {
  import('@/components/navigation/DocumentOutline');
  import('@/components/navigation/TableOfContents');
  import('@/components/navigation/DocumentStats');
};

/**
 * Preload advanced features
 */
export const preloadAdvancedFeatures = () => {
  import('@/components/blocks/BlockManager');
  import('@/components/search/GlobalSearch');
  import('@/components/export/ExportManager');
  import('@/components/media/MediaManager');
};

// === ROUTE-BASED PRELOADING ===

/**
 * Preload components based on user navigation patterns
 */
export const preloadBasedOnRoute = (route: string) => {
  switch (route) {
    case 'editor':
      preloadCriticalComponents();
      break;
    case 'search':
      import('@/components/search/GlobalSearch');
      break;
    case 'export':
      import('@/components/export/ExportManager');
      break;
    case 'media':
      import('@/components/media/MediaManager');
      import('@/components/media/ImageEditor');
      break;
    default:
      // Preload commonly used components
      preloadCriticalComponents();
  }
};

export default {
  WYSIWYGEditorLazy,
  WYSIWYGEnhancedEditorLazy,
  BlockManagerLazy,
  GlobalSearchLazy,
  ExportManagerLazy,
  MediaManagerLazy,
  DocumentOutlineLazy,
  TableOfContentsLazy,
  DocumentStatsLazy,
  PerformanceMonitorLazy,
  SettingsManagerLazy,
  CommandPaletteLazy,
  DebugPanelLazy,
  OnboardingTourLazy,
  HelpDocumentationLazy,
  KeyboardShortcutsReferenceLazy,
  preloadCriticalComponents,
  preloadNavigationComponents,
  preloadAdvancedFeatures,
  preloadBasedOnRoute,
};