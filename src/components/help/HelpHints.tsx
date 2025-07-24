/**
 * @fileoverview Help hints and contextual guidance system
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Contextual help and guidance
 */

import React, { useState, useEffect, useCallback } from 'react';
import { HelpCircle, X, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// === TYPES ===

interface HelpHint {
  id: string;
  title: string;
  description: string;
  category: 'getting-started' | 'productivity' | 'features' | 'shortcuts' | 'troubleshooting';
  priority: 'high' | 'medium' | 'low';
  trigger: {
    condition: 'first-visit' | 'no-files' | 'feature-unused' | 'error-occurred' | 'context-specific';
    context?: string[];
  };
  actions?: Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }>;
  dismissible?: boolean;
  persistent?: boolean;
  showCount?: number; // How many times to show before auto-dismissing
}

interface HelpHintsProps {
  /** Current application context */
  context: {
    hasFiles: boolean;
    hasSelectedFolder: boolean;
    currentMode: string;
    hasUnsavedChanges: boolean;
    recentError?: string;
  };
  /** Callback when hint action is triggered */
  onHintAction?: (hintId: string, action: string) => void;
  /** Optional CSS class name */
  className?: string;
}

interface HintState {
  id: string;
  isVisible: boolean;
  showCount: number;
  isDismissed: boolean;
  lastShown: number;
}

// === CONSTANTS ===

const HELP_HINTS: Record<string, HelpHint> = {
  'welcome-start': {
    id: 'welcome-start',
    title: 'Welcome to GTD Space!',
    description: 'Start by selecting a folder containing your markdown files. This will be your workspace for editing and organizing documents.',
    category: 'getting-started',
    priority: 'high',
    trigger: {
      condition: 'first-visit',
    },
    actions: [
      {
        label: 'Select Folder',
        action: () => {
          const folderButton = document.querySelector('[data-tour="folder-selector"]') as HTMLButtonElement;
          folderButton?.click();
        },
        primary: true,
      },
      {
        label: 'Take Tour',
        action: () => {
          // This would trigger the onboarding tour
          console.log('Starting onboarding tour');
        },
      },
    ],
    dismissible: true,
  },
  'no-files-found': {
    id: 'no-files-found',
    title: 'No Markdown Files Found',
    description: 'The selected folder doesn\'t contain any markdown files (.md). You can create a new file or select a different folder.',
    category: 'troubleshooting',
    priority: 'medium',
    trigger: {
      condition: 'no-files',
    },
    actions: [
      {
        label: 'Create New File',
        action: () => {
          console.log('Creating new file');
        },
        primary: true,
      },
      {
        label: 'Select Different Folder',
        action: () => {
          const folderButton = document.querySelector('[data-tour="folder-selector"]') as HTMLButtonElement;
          folderButton?.click();
        },
      },
    ],
    dismissible: true,
  },
  'discover-editor-modes': {
    id: 'discover-editor-modes',
    title: 'Try Different Editor Modes',
    description: 'Switch between WYSIWYG, Source, and Preview modes to find your preferred editing experience. Each mode offers unique advantages.',
    category: 'features',
    priority: 'medium',
    trigger: {
      condition: 'feature-unused',
      context: ['editor-modes-not-switched'],
    },
    dismissible: true,
    showCount: 3,
  },
  'unsaved-changes-tip': {
    id: 'unsaved-changes-tip',
    title: 'Auto-Save is Active',
    description: 'Your changes are automatically saved every few seconds. The orange dot on the tab indicates unsaved changes.',
    category: 'productivity',
    priority: 'low',
    trigger: {
      condition: 'context-specific',
      context: ['has-unsaved-changes'],
    },
    dismissible: true,
    showCount: 2,
  },
  'keyboard-shortcuts-tip': {
    id: 'keyboard-shortcuts-tip',
    title: 'Speed Up Your Workflow',
    description: 'Use keyboard shortcuts to work faster: Ctrl+S to save, Ctrl+N for new file, Ctrl+O to open folder.',
    category: 'shortcuts',
    priority: 'medium',
    trigger: {
      condition: 'feature-unused',
      context: ['shortcuts-not-used'],
    },
    dismissible: true,
    showCount: 2,
  },
  'search-files-tip': {
    id: 'search-files-tip',
    title: 'Quickly Find Files',
    description: 'Use the search box in the sidebar to quickly filter and find your files by name.',
    category: 'productivity',
    priority: 'medium',
    trigger: {
      condition: 'context-specific',
      context: ['many-files'],
    },
    dismissible: true,
    showCount: 1,
  },
};

const HINT_CATEGORIES = {
  'getting-started': {
    label: 'Getting Started',
    color: 'bg-blue-500',
    icon: <HelpCircle className="h-4 w-4" />,
  },
  'productivity': {
    label: 'Productivity',
    color: 'bg-green-500',
    icon: <ArrowRight className="h-4 w-4" />,
  },
  'features': {
    label: 'Features',
    color: 'bg-purple-500',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  'shortcuts': {
    label: 'Shortcuts',
    color: 'bg-orange-500',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  'troubleshooting': {
    label: 'Help',
    color: 'bg-red-500',
    icon: <AlertCircle className="h-4 w-4" />,
  },
};

// === HELP HINTS COMPONENT ===

/**
 * Help hints component that shows contextual guidance
 * 
 * Provides contextual help hints based on application state and user behavior.
 * Hints are automatically shown/hidden based on relevance and user interaction.
 */
export const HelpHints: React.FC<HelpHintsProps> = ({
  context,
  onHintAction,
  className = '',
}) => {
  // === STATE ===
  const [hintStates, setHintStates] = useState<Record<string, HintState>>({});
  const [visibleHints, setVisibleHints] = useState<string[]>([]);

  // === INITIALIZATION ===
  useEffect(() => {
    // Load hint states from localStorage
    const savedStates = localStorage.getItem('help-hint-states');
    if (savedStates) {
      try {
        setHintStates(JSON.parse(savedStates));
      } catch (error) {
        console.warn('Failed to parse help hint states:', error);
      }
    }
  }, []);

  // === HINT EVALUATION ===
  const shouldShowHint = useCallback((hint: HelpHint): boolean => {
    const state = hintStates[hint.id];
    
    // Check if dismissed
    if (state?.isDismissed) return false;
    
    // Check show count limit
    if (hint.showCount && state?.showCount >= hint.showCount) return false;
    
    // Check trigger conditions
    switch (hint.trigger.condition) {
      case 'first-visit':
        return !state || state.showCount === 0;
      
      case 'no-files':
        return context.hasSelectedFolder && !context.hasFiles;
      
      case 'context-specific':
        if (hint.trigger.context?.includes('has-unsaved-changes')) {
          return context.hasUnsavedChanges;
        }
        if (hint.trigger.context?.includes('many-files')) {
          return context.hasFiles; // Simplified - would check actual file count
        }
        return false;
      
      case 'feature-unused':
        // This would require tracking feature usage
        return true; // Simplified for now
      
      case 'error-occurred':
        return !!context.recentError;
      
      default:
        return false;
    }
  }, [hintStates, context]);

  // === EFFECTS ===
  useEffect(() => {
    // Evaluate which hints should be visible
    const hintsToShow = Object.values(HELP_HINTS)
      .filter(shouldShowHint)
      .sort((a, b) => {
        // Sort by priority
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 2) // Limit to 2 visible hints at once
      .map(hint => hint.id);

    setVisibleHints(hintsToShow);
  }, [shouldShowHint]);

  // === HANDLERS ===
  const handleHintAction = useCallback((hintId: string, actionLabel: string) => {
    const hint = HELP_HINTS[hintId];
    const action = hint.actions?.find(a => a.label === actionLabel);
    
    if (action) {
      action.action();
      onHintAction?.(hintId, actionLabel);
    }
    
    // Mark hint as interacted with
    updateHintState(hintId, { isVisible: false });
  }, [onHintAction]);

  const handleDismissHint = useCallback((hintId: string) => {
    updateHintState(hintId, { 
      isDismissed: true, 
      isVisible: false 
    });
  }, []);

  const updateHintState = useCallback((hintId: string, updates: Partial<HintState>) => {
    setHintStates(prev => {
      const currentState = prev[hintId] || {
        id: hintId,
        isVisible: false,
        showCount: 0,
        isDismissed: false,
        lastShown: 0,
      };

      const newState = {
        ...currentState,
        ...updates,
        showCount: updates.isVisible ? currentState.showCount + 1 : currentState.showCount,
        lastShown: updates.isVisible ? Date.now() : currentState.lastShown,
      };

      const newStates = { ...prev, [hintId]: newState };
      
      // Save to localStorage
      localStorage.setItem('help-hint-states', JSON.stringify(newStates));
      
      return newStates;
    });
  }, []);

  // === RENDER HELPERS ===
  const renderHint = (hintId: string) => {
    const hint = HELP_HINTS[hintId];
    if (!hint) return null;

    const category = HINT_CATEGORIES[hint.category];

    return (
      <Card key={hintId} className="mb-4 border-l-4 border-l-primary shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`p-1 rounded ${category.color} text-white`}>
                {category.icon}
              </div>
              <div>
                <CardTitle className="text-sm">{hint.title}</CardTitle>
                <Badge variant="outline" className="text-xs mt-1">
                  {category.label}
                </Badge>
              </div>
            </div>
            {hint.dismissible && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDismissHint(hintId)}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-sm leading-relaxed mb-4">
            {hint.description}
          </CardDescription>
          
          {hint.actions && hint.actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {hint.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.primary ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleHintAction(hintId, action.label)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // === RENDER ===
  if (visibleHints.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {visibleHints.map(renderHint)}
    </div>
  );
};

// === HINT PROGRESS COMPONENT ===

interface HintProgressProps {
  category: keyof typeof HINT_CATEGORIES;
  completedHints: string[];
  totalHints: number;
}

export const HintProgress: React.FC<HintProgressProps> = ({
  category,
  completedHints,
  totalHints,
}) => {
  const categoryConfig = HINT_CATEGORIES[category];
  const progress = (completedHints.length / totalHints) * 100;

  return (
    <Card className="p-4">
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded ${categoryConfig.color} text-white`}>
          {categoryConfig.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{categoryConfig.label}</span>
            <span className="text-xs text-muted-foreground">
              {completedHints.length}/{totalHints} completed
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>
    </Card>
  );
};

// === UTILITY FUNCTIONS ===

/**
 * Reset all help hint states (for testing/debugging)
 */
export const resetHelpHints = () => {
  localStorage.removeItem('help-hint-states');
};

/**
 * Get all available help hints
 */
export const getAllHelpHints = (): HelpHint[] => {
  return Object.values(HELP_HINTS);
};

/**
 * Register a new help hint
 */
export const registerHelpHint = (hint: HelpHint) => {
  HELP_HINTS[hint.id] = hint;
};

// === EXPORTS ===
export default HelpHints;
export { HELP_HINTS, HINT_CATEGORIES };
export type { HelpHint, HelpHintsProps };