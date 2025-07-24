/**
 * @fileoverview Interactive onboarding tour for first-time users
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Onboarding and user guidance
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, ArrowRight, ArrowLeft, Check, FolderOpen, FileText, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// === TYPES ===

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon?: React.ReactNode;
  action?: {
    label: string;
    callback: () => void;
  };
  canSkip?: boolean;
}

interface OnboardingTourProps {
  /** Whether the tour is active */
  isActive: boolean;
  /** Callback when tour is completed */
  onComplete: () => void;
  /** Callback when tour is skipped */
  onSkip: () => void;
  /** Optional CSS class name */
  className?: string;
}

interface TourState {
  currentStep: number;
  isCompleted: boolean;
  skippedSteps: string[];
}

// === CONSTANTS ===

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to GTD Space',
    description: 'A powerful markdown editor for local file management and editing. Let\'s take a quick tour of the key features.',
    position: 'center',
    icon: <FileText className="h-6 w-6" />,
    canSkip: true,
  },
  {
    id: 'folder-selection',
    title: 'Select Your Workspace',
    description: 'Start by selecting a folder containing your markdown files. This will be your workspace for editing and organizing documents.',
    targetSelector: '[data-tour="folder-selector"]',
    position: 'right',
    icon: <FolderOpen className="h-6 w-6" />,
    action: {
      label: 'Select Folder',
      callback: () => {
        // This would trigger the folder selection
        const folderButton = document.querySelector('[data-tour="folder-selector"]') as HTMLButtonElement;
        folderButton?.click();
      },
    },
  },
  {
    id: 'file-browser',
    title: 'File Browser',
    description: 'Browse and manage your markdown files in the sidebar. Click any file to open it in the editor.',
    targetSelector: '[data-tour="file-browser"]',
    position: 'right',
    icon: <FileText className="h-6 w-6" />,
  },
  {
    id: 'editor-modes',
    title: 'Editor Modes',
    description: 'Switch between WYSIWYG, source, and preview modes to find your preferred editing experience.',
    targetSelector: '[data-tour="editor-modes"]',
    position: 'bottom',
    icon: <Settings className="h-6 w-6" />,
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Use Ctrl+S to save, Ctrl+N for new file, Ctrl+O to open folder, and many more shortcuts for efficient editing.',
    position: 'center',
    icon: <Settings className="h-6 w-6" />,
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'You\'re ready to start editing. Remember, you can always access help and settings from the menu.',
    position: 'center',
    icon: <Check className="h-6 w-6" />,
  },
];

// === ONBOARDING TOUR COMPONENT ===

/**
 * Interactive onboarding tour component
 * 
 * Provides a step-by-step introduction to the application's key features
 * for first-time users. Includes:
 * - Progressive step navigation
 * - Contextual highlighting of UI elements
 * - Interactive actions within the tour
 * - Skip and completion options
 */
export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isActive,
  onComplete,
  onSkip,
  className = '',
}) => {
  // === STATE ===
  const [tourState, setTourState] = useState<TourState>({
    currentStep: 0,
    isCompleted: false,
    skippedSteps: [],
  });

  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null);

  // === COMPUTED VALUES ===
  const currentStepData = ONBOARDING_STEPS[tourState.currentStep];
  const isFirstStep = tourState.currentStep === 0;
  const isLastStep = tourState.currentStep === ONBOARDING_STEPS.length - 1;
  const progress = ((tourState.currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  // === EFFECTS ===
  useEffect(() => {
    if (!isActive) return;

    // Highlight target element if specified
    if (currentStepData?.targetSelector) {
      const element = document.querySelector(currentStepData.targetSelector);
      if (element) {
        setHighlightedElement(element);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add highlight class
        element.classList.add('onboarding-highlight');
      }
    } else {
      setHighlightedElement(null);
    }

    // Cleanup function
    return () => {
      if (highlightedElement) {
        highlightedElement.classList.remove('onboarding-highlight');
      }
    };
  }, [isActive, tourState.currentStep, currentStepData, highlightedElement]);

  // === HANDLERS ===
  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleComplete();
      return;
    }

    setTourState(prev => ({
      ...prev,
      currentStep: prev.currentStep + 1,
    }));
  }, [isLastStep]);

  const handlePrevious = useCallback(() => {
    if (isFirstStep) return;

    setTourState(prev => ({
      ...prev,
      currentStep: prev.currentStep - 1,
    }));
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    // Clean up any highlighting
    if (highlightedElement) {
      highlightedElement.classList.remove('onboarding-highlight');
    }
    
    onSkip();
  }, [highlightedElement, onSkip]);

  const handleComplete = useCallback(() => {
    // Clean up any highlighting
    if (highlightedElement) {
      highlightedElement.classList.remove('onboarding-highlight');
    }

    setTourState(prev => ({
      ...prev,
      isCompleted: true,
    }));

    onComplete();
  }, [highlightedElement, onComplete]);

  const handleStepAction = useCallback(() => {
    if (currentStepData?.action) {
      currentStepData.action.callback();
    }
  }, [currentStepData]);

  // === RENDER HELPERS ===
  const getTooltipPosition = (): React.CSSProperties => {
    if (!currentStepData?.targetSelector || !highlightedElement) {
      // Center position for steps without target
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
      };
    }

    const rect = highlightedElement.getBoundingClientRect();
    const position = currentStepData.position || 'bottom';

    switch (position) {
      case 'top':
        return {
          position: 'fixed',
          bottom: `${window.innerHeight - rect.top + 10}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)',
          zIndex: 1000,
        };
      case 'bottom':
        return {
          position: 'fixed',
          top: `${rect.bottom + 10}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)',
          zIndex: 1000,
        };
      case 'left':
        return {
          position: 'fixed',
          top: `${rect.top + rect.height / 2}px`,
          right: `${window.innerWidth - rect.left + 10}px`,
          transform: 'translateY(-50%)',
          zIndex: 1000,
        };
      case 'right':
        return {
          position: 'fixed',
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + 10}px`,
          transform: 'translateY(-50%)',
          zIndex: 1000,
        };
      default:
        return {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
        };
    }
  };

  if (!isActive || tourState.isCompleted) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-black/50 z-[999]" />

      {/* Tour tooltip */}
      <Card 
        className={`w-80 shadow-lg border ${className}`}
        style={getTooltipPosition()}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {currentStepData.icon && (
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {currentStepData.icon}
                </div>
              )}
              <div>
                <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    Step {tourState.currentStep + 1} of {ONBOARDING_STEPS.length}
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <Progress value={progress} className="h-1" />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <CardDescription className="text-sm leading-relaxed">
            {currentStepData.description}
          </CardDescription>

          {/* Action button for interactive steps */}
          {currentStepData.action && (
            <Button
              onClick={handleStepAction}
              className="w-full"
              variant="outline"
            >
              {currentStepData.action.label}
            </Button>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={isFirstStep}
              className="flex items-center space-x-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Previous</span>
            </Button>

            <div className="flex items-center space-x-2">
              {currentStepData.canSkip && (
                <Button variant="ghost" onClick={handleSkip} className="text-xs">
                  Skip Tour
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                className="flex items-center space-x-1"
              >
                <span>{isLastStep ? 'Get Started' : 'Next'}</span>
                {isLastStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global styles for highlighting */}
      <style>{`
        .onboarding-highlight {
          position: relative !important;
          z-index: 1000 !important;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5) !important;
          border-radius: 8px !important;
          animation: onboarding-pulse 2s infinite !important;
        }

        @keyframes onboarding-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3);
          }
        }
      `}</style>
    </>
  );
};

export default OnboardingTour;