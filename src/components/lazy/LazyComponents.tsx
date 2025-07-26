/**
 * @fileoverview Lazy-loaded components for code splitting
 * @author Development Team
 * @created 2024-01-XX
 */

import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import type { GlobalSearchProps } from '@/components/search/GlobalSearch';
import type { DocumentStatsProps } from '@/components/navigation/DocumentStats';
import type { SettingsManagerProps } from '@/components/settings/SettingsManager';
import type { KeyboardShortcutsModalProps } from '@/components/settings/KeyboardShortcutsModal';

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

// Global Search functionality
export const LazyGlobalSearch = lazy(() => 
  import('@/components/search/GlobalSearch').then(module => ({
    default: module.GlobalSearch
  }))
);

// Document Navigation components
export const LazyDocumentStats = lazy(() => 
  import('@/components/navigation/DocumentStats').then(module => ({
    default: module.DocumentStats
  }))
);

// Settings Manager
export const LazySettingsManager = lazy(() => 
  import('@/components/settings/SettingsManager').then(module => ({
    default: module.SettingsManager
  }))
);

// Keyboard Shortcuts Reference overlay
const LazyKeyboardShortcutsReference = lazy(() => 
  import('@/components/settings/KeyboardShortcutsModal').then(module => ({
    default: module.KeyboardShortcutsModal
  }))
);

// === WRAPPER COMPONENTS ===

/**
 * Wrapper for lazy-loaded global search
 */
export const GlobalSearchLazy: React.FC<GlobalSearchProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Search..." />}>
    <LazyGlobalSearch {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded document navigation
 */
export const DocumentStatsLazy: React.FC<DocumentStatsProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Statistics..." />}>
    <LazyDocumentStats {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded settings
 */
export const SettingsManagerLazy: React.FC<SettingsManagerProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Settings..." />}>
    <LazySettingsManager {...props} />
  </Suspense>
);

/**
 * Wrapper for lazy-loaded keyboard shortcuts reference
 */
export const KeyboardShortcutsReferenceLazy: React.FC<KeyboardShortcutsModalProps> = (props) => (
  <Suspense fallback={<LoadingFallback message="Loading Keyboard Shortcuts..." />}>
    <LazyKeyboardShortcutsReference {...props} />
  </Suspense>
);

export default {
  GlobalSearchLazy,
  DocumentStatsLazy,
  SettingsManagerLazy,
  KeyboardShortcutsReferenceLazy,
};