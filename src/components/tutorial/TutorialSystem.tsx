/**
 * @fileoverview Interactive tutorial and feature guidance system
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Tutorial and onboarding system
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { X, ChevronLeft, ChevronRight, Play, Pause, RotateCcw, BookOpen, Target, CheckCircle } from 'lucide-react';

// === TYPES ===
export interface TutorialStep {
  /** Unique identifier for the step */
  id: string;
  /** Step title */
  title: string;
  /** Detailed description */
  description: string;
  /** CSS selector for the element to highlight */
  target?: string;
  /** Position of the tooltip relative to target */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Content to display in the tutorial */
  content: React.ReactNode;
  /** Whether this step requires user interaction */
  requiresAction?: boolean;
  /** Action the user needs to perform */
  expectedAction?: string;
  /** Custom validation function */
  validate?: () => boolean | Promise<boolean>;
  /** Whether to auto-advance after validation */
  autoAdvance?: boolean;
  /** Step category for organization */
  category?: string;
  /** Estimated time to complete (in seconds) */
  estimatedTime?: number;
}

export interface Tutorial {
  /** Unique tutorial identifier */
  id: string;
  /** Tutorial title */
  title: string;
  /** Tutorial description */
  description: string;
  /** Tutorial category */
  category: 'basics' | 'editing' | 'advanced' | 'productivity';
  /** Difficulty level */
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  /** Estimated total time */
  estimatedTime: number;
  /** List of tutorial steps */
  steps: TutorialStep[];
  /** Prerequisites (other tutorial IDs) */
  prerequisites?: string[];
  /** Whether tutorial is required for onboarding */
  required?: boolean;
}

export interface TutorialState {
  /** Currently active tutorial */
  activeTutorial: Tutorial | null;
  /** Current step index */
  currentStepIndex: number;
  /** Whether tutorial is running */
  isRunning: boolean;
  /** Whether tutorial is paused */
  isPaused: boolean;
  /** Completed tutorials */
  completedTutorials: string[];
  /** Step completion status */
  stepProgress: Record<string, boolean>;
  /** User preferences */
  preferences: {
    showTooltips: boolean;
    autoAdvance: boolean;
    highlightIntensity: 'subtle' | 'normal' | 'strong';
    playbackSpeed: 'slow' | 'normal' | 'fast';
  };
}

export interface TutorialContextValue extends TutorialState {
  /** Start a tutorial */
  startTutorial: (tutorialId: string) => void;
  /** Stop current tutorial */
  stopTutorial: () => void;
  /** Pause/resume tutorial */
  togglePause: () => void;
  /** Go to next step */
  nextStep: () => void;
  /** Go to previous step */
  previousStep: () => void;
  /** Go to specific step */
  goToStep: (stepIndex: number) => void;
  /** Mark step as completed */
  completeStep: (stepId: string) => void;
  /** Reset tutorial progress */
  resetTutorial: (tutorialId: string) => void;
  /** Update preferences */
  updatePreferences: (preferences: Partial<TutorialState['preferences']>) => void;
  /** Check if tutorial is available */
  isTutorialAvailable: (tutorialId: string) => boolean;
}

export interface TutorialTooltipProps {
  step: TutorialStep;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  currentIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
}

export interface TutorialHighlightProps {
  target: string;
  intensity: 'subtle' | 'normal' | 'strong';
}

// === CONSTANTS ===
const TUTORIAL_STORAGE_KEY = 'gtd-tutorial-progress';

const DEFAULT_PREFERENCES: TutorialState['preferences'] = {
  showTooltips: true,
  autoAdvance: false,
  highlightIntensity: 'normal',
  playbackSpeed: 'normal'
};

// === TUTORIAL DEFINITIONS ===
const BUILT_IN_TUTORIALS: Tutorial[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of using GTD Space',
    category: 'basics',
    difficulty: 'beginner',
    estimatedTime: 180, // 3 minutes
    required: true,
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to GTD Space',
        description: 'Your powerful markdown editor',
        content: (
          <div className="space-y-3">
            <p>Welcome! This tutorial will guide you through the essential features of GTD Space.</p>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              <span className="text-sm">Estimated time: 3 minutes</span>
            </div>
          </div>
        ),
        position: 'center'
      },
      {
        id: 'folder-selection',
        title: 'Select Your Folder',
        description: 'Choose a folder containing your markdown files',
        content: (
          <div className="space-y-3">
            <p>Start by selecting a folder that contains your markdown files.</p>
            <p className="text-sm text-muted-foreground">
              Click the "Select Folder" button to browse your file system.
            </p>
          </div>
        ),
        target: '[data-tutorial="folder-selector"]',
        position: 'bottom',
        requiresAction: true,
        expectedAction: 'Select a folder',
        autoAdvance: true
      },
      {
        id: 'file-browser',
        title: 'File Browser',
        description: 'Navigate your markdown files',
        content: (
          <div className="space-y-3">
            <p>The sidebar shows all your markdown files. You can:</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Click any file to open it</li>
              <li>Use the search box to filter files</li>
              <li>Right-click for more options</li>
            </ul>
          </div>
        ),
        target: '[data-tutorial="file-browser"]',
        position: 'right'
      },
      {
        id: 'editor-basics',
        title: 'Editor Basics',
        description: 'Start editing your markdown',
        content: (
          <div className="space-y-3">
            <p>The main editor supports rich markdown editing:</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Type markdown syntax directly</li>
              <li>Use the toolbar for formatting</li>
              <li>Switch between editor modes</li>
            </ul>
          </div>
        ),
        target: '[data-tutorial="editor"]',
        position: 'top'
      }
    ]
  },
  {
    id: 'wysiwyg-editing',
    title: 'Rich Text Editing',
    description: 'Master the WYSIWYG editor',
    category: 'editing',
    difficulty: 'intermediate',
    estimatedTime: 300,
    prerequisites: ['getting-started'],
    steps: [
      {
        id: 'mode-switching',
        title: 'Editor Modes',
        description: 'Switch between editing modes',
        content: (
          <div className="space-y-3">
            <p>GTD Space offers multiple editing modes:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">WYSIWYG</Badge>
                <span>Rich text</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Source</Badge>
                <span>Markdown</span>
              </div>
            </div>
          </div>
        ),
        target: '[data-tutorial="mode-toggle"]',
        position: 'bottom'
      },
      {
        id: 'formatting-toolbar',
        title: 'Formatting Toolbar',
        description: 'Use the formatting controls',
        content: (
          <div className="space-y-3">
            <p>The toolbar provides quick access to formatting options:</p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">Bold</Badge>
              <Badge variant="outline" className="text-xs">Italic</Badge>
              <Badge variant="outline" className="text-xs">Headers</Badge>
              <Badge variant="outline" className="text-xs">Lists</Badge>
              <Badge variant="outline" className="text-xs">Links</Badge>
            </div>
          </div>
        ),
        target: '[data-tutorial="formatting-toolbar"]',
        position: 'bottom'
      }
    ]
  },
  {
    id: 'productivity-features',
    title: 'Productivity Features',
    description: 'Advanced features for power users',
    category: 'productivity',
    difficulty: 'advanced',
    estimatedTime: 600,
    prerequisites: ['getting-started', 'wysiwyg-editing'],
    steps: [
      {
        id: 'keyboard-shortcuts',
        title: 'Keyboard Shortcuts',
        description: 'Work faster with shortcuts',
        content: (
          <div className="space-y-3">
            <p>Essential keyboard shortcuts:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span>Save</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+S</kbd>
              </div>
              <div className="flex justify-between">
                <span>New File</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+N</kbd>
              </div>
              <div className="flex justify-between">
                <span>Find</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+F</kbd>
              </div>
              <div className="flex justify-between">
                <span>Bold</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+B</kbd>
              </div>
            </div>
          </div>
        ),
        position: 'center'
      }
    ]
  }
];

// === CONTEXT ===
const TutorialContext = createContext<TutorialContextValue | null>(null);

// === HOOKS ===
export function useTutorial(): TutorialContextValue {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}

// === COMPONENTS ===

/**
 * Tutorial tooltip component
 */
function TutorialTooltip({
  step,
  onNext,
  onPrevious,
  onClose,
  currentIndex,
  totalSteps,
  isFirst,
  isLast
}: TutorialTooltipProps) {
  const progressPercent = ((currentIndex + 1) / totalSteps) * 100;

  return (
    <Card className="w-80 shadow-lg border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{step.title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Step {currentIndex + 1} of {totalSteps}</span>
          <Progress value={progressPercent} className="flex-1 h-1" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{step.description}</p>
          <div>{step.content}</div>
        </div>
        
        {step.requiresAction && (
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Action required:</span>
            <span className="text-sm">{step.expectedAction}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={isFirst}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-3 w-3" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "w-2 h-2 rounded-full",
                  index === currentIndex ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          <Button
            size="sm"
            onClick={onNext}
            disabled={step.requiresAction && !step.validate?.()}
            className="flex items-center gap-1"
          >
            {isLast ? 'Finish' : 'Next'}
            {!isLast && <ChevronRight className="h-3 w-3" />}
            {isLast && <CheckCircle className="h-3 w-3" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Tutorial highlight component
 */
function TutorialHighlight({ target, intensity }: TutorialHighlightProps) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const targetElement = document.querySelector(target) as HTMLElement;
    if (targetElement) {
      setElement(targetElement);
      setRect(targetElement.getBoundingClientRect());

      // Add highlight class
      targetElement.classList.add('tutorial-highlight');
      targetElement.setAttribute('data-tutorial-intensity', intensity);

      const updateRect = () => {
        setRect(targetElement.getBoundingClientRect());
      };

      // Update position on scroll/resize
      window.addEventListener('scroll', updateRect);
      window.addEventListener('resize', updateRect);

      return () => {
        targetElement.classList.remove('tutorial-highlight');
        targetElement.removeAttribute('data-tutorial-intensity');
        window.removeEventListener('scroll', updateRect);
        window.removeEventListener('resize', updateRect);
      };
    }
  }, [target, intensity]);

  if (!rect) return null;

  const intensityStyles = {
    subtle: 'ring-2 ring-primary/30 bg-primary/5',
    normal: 'ring-2 ring-primary/50 bg-primary/10',
    strong: 'ring-4 ring-primary/70 bg-primary/20'
  };

  return (
    <div
      className={cn(
        'fixed pointer-events-none z-50 rounded-lg transition-all duration-300',
        intensityStyles[intensity]
      )}
      style={{
        left: rect.left - 4,
        top: rect.top - 4,
        width: rect.width + 8,
        height: rect.height + 8
      }}
    />
  );
}

/**
 * Tutorial overlay component
 */
function TutorialOverlay() {
  const {
    activeTutorial,
    currentStepIndex,
    isRunning,
    isPaused,
    nextStep,
    previousStep,
    stopTutorial,
    togglePause
  } = useTutorial();

  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  const currentStep = activeTutorial?.steps[currentStepIndex];

  useEffect(() => {
    if (!currentStep || !isRunning) return;

    const updateTooltipPosition = () => {
      if (currentStep.target) {
        const targetElement = document.querySelector(currentStep.target);
        if (targetElement && tooltipRef.current) {
          const targetRect = targetElement.getBoundingClientRect();
          const tooltipRect = tooltipRef.current.getBoundingClientRect();
          
          let top = 0, left = 0;

          switch (currentStep.position) {
            case 'top':
              top = targetRect.top - tooltipRect.height - 16;
              left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
              break;
            case 'bottom':
              top = targetRect.bottom + 16;
              left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
              break;
            case 'left':
              top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
              left = targetRect.left - tooltipRect.width - 16;
              break;
            case 'right':
              top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
              left = targetRect.right + 16;
              break;
            case 'center':
            default:
              top = window.innerHeight / 2 - tooltipRect.height / 2;
              left = window.innerWidth / 2 - tooltipRect.width / 2;
              break;
          }

          // Keep tooltip within viewport
          top = Math.max(16, Math.min(window.innerHeight - tooltipRect.height - 16, top));
          left = Math.max(16, Math.min(window.innerWidth - tooltipRect.width - 16, left));

          setTooltipPosition({ top, left });
        }
      } else {
        // Center position for steps without target
        if (tooltipRef.current) {
          const tooltipRect = tooltipRef.current.getBoundingClientRect();
          setTooltipPosition({
            top: window.innerHeight / 2 - tooltipRect.height / 2,
            left: window.innerWidth / 2 - tooltipRect.width / 2
          });
        }
      }
    };

    updateTooltipPosition();
    window.addEventListener('scroll', updateTooltipPosition);
    window.addEventListener('resize', updateTooltipPosition);

    return () => {
      window.removeEventListener('scroll', updateTooltipPosition);
      window.removeEventListener('resize', updateTooltipPosition);
    };
  }, [currentStep, isRunning]);

  if (!activeTutorial || !currentStep || !isRunning) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" />
      
      {/* Highlight */}
      {currentStep.target && (
        <TutorialHighlight
          target={currentStep.target}
          intensity="normal"
        />
      )}
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 transition-all duration-300"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left
        }}
      >
        <TutorialTooltip
          step={currentStep}
          onNext={nextStep}
          onPrevious={previousStep}
          onClose={stopTutorial}
          currentIndex={currentStepIndex}
          totalSteps={activeTutorial.steps.length}
          isFirst={currentStepIndex === 0}
          isLast={currentStepIndex === activeTutorial.steps.length - 1}
        />
      </div>
      
      {/* Pause overlay */}
      {isPaused && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 text-center">
            <Pause className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Tutorial Paused</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Click resume to continue with the tutorial
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={togglePause} className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Resume
              </Button>
              <Button variant="outline" onClick={stopTutorial}>
                Stop Tutorial
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

/**
 * Tutorial provider component
 */
export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TutorialState>(() => {
    const saved = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    const savedState = saved ? JSON.parse(saved) : {};
    
    return {
      activeTutorial: null,
      currentStepIndex: 0,
      isRunning: false,
      isPaused: false,
      completedTutorials: savedState.completedTutorials || [],
      stepProgress: savedState.stepProgress || {},
      preferences: { ...DEFAULT_PREFERENCES, ...savedState.preferences }
    };
  });

  // Save state to localStorage
  useEffect(() => {
    const toSave = {
      completedTutorials: state.completedTutorials,
      stepProgress: state.stepProgress,
      preferences: state.preferences
    };
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(toSave));
  }, [state.completedTutorials, state.stepProgress, state.preferences]);

  const startTutorial = useCallback((tutorialId: string) => {
    const tutorial = BUILT_IN_TUTORIALS.find(t => t.id === tutorialId);
    if (!tutorial) return;

    setState(prev => ({
      ...prev,
      activeTutorial: tutorial,
      currentStepIndex: 0,
      isRunning: true,
      isPaused: false
    }));
  }, []);

  const stopTutorial = useCallback(() => {
    setState(prev => ({
      ...prev,
      activeTutorial: null,
      currentStepIndex: 0,
      isRunning: false,
      isPaused: false
    }));
  }, []);

  const togglePause = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPaused: !prev.isPaused
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => {
      if (!prev.activeTutorial) return prev;

      const nextIndex = prev.currentStepIndex + 1;
      
      // Mark current step as completed
      const currentStep = prev.activeTutorial.steps[prev.currentStepIndex];
      const newStepProgress = {
        ...prev.stepProgress,
        [currentStep.id]: true
      };

      // Check if tutorial is completed
      if (nextIndex >= prev.activeTutorial.steps.length) {
        const newCompletedTutorials = prev.completedTutorials.includes(prev.activeTutorial.id)
          ? prev.completedTutorials
          : [...prev.completedTutorials, prev.activeTutorial.id];

        return {
          ...prev,
          activeTutorial: null,
          currentStepIndex: 0,
          isRunning: false,
          isPaused: false,
          completedTutorials: newCompletedTutorials,
          stepProgress: newStepProgress
        };
      }

      return {
        ...prev,
        currentStepIndex: nextIndex,
        stepProgress: newStepProgress
      };
    });
  }, []);

  const previousStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStepIndex: Math.max(0, prev.currentStepIndex - 1)
    }));
  }, []);

  const goToStep = useCallback((stepIndex: number) => {
    setState(prev => ({
      ...prev,
      currentStepIndex: Math.max(0, Math.min(stepIndex, (prev.activeTutorial?.steps.length || 1) - 1))
    }));
  }, []);

  const completeStep = useCallback((stepId: string) => {
    setState(prev => ({
      ...prev,
      stepProgress: {
        ...prev.stepProgress,
        [stepId]: true
      }
    }));
  }, []);

  const resetTutorial = useCallback((tutorialId: string) => {
    setState(prev => ({
      ...prev,
      completedTutorials: prev.completedTutorials.filter(id => id !== tutorialId),
      stepProgress: Object.fromEntries(
        Object.entries(prev.stepProgress).filter(([stepId]) => {
          const tutorial = BUILT_IN_TUTORIALS.find(t => t.id === tutorialId);
          return !tutorial?.steps.some(step => step.id === stepId);
        })
      )
    }));
  }, []);

  const updatePreferences = useCallback((newPreferences: Partial<TutorialState['preferences']>) => {
    setState(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        ...newPreferences
      }
    }));
  }, []);

  const isTutorialAvailable = useCallback((tutorialId: string) => {
    const tutorial = BUILT_IN_TUTORIALS.find(t => t.id === tutorialId);
    if (!tutorial) return false;

    // Check prerequisites
    if (tutorial.prerequisites) {
      return tutorial.prerequisites.every(prereqId => 
        state.completedTutorials.includes(prereqId)
      );
    }

    return true;
  }, [state.completedTutorials]);

  const contextValue: TutorialContextValue = {
    ...state,
    startTutorial,
    stopTutorial,
    togglePause,
    nextStep,
    previousStep,
    goToStep,
    completeStep,
    resetTutorial,
    updatePreferences,
    isTutorialAvailable
  };

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
      <TutorialOverlay />
    </TutorialContext.Provider>
  );
}

/**
 * Tutorial launcher component
 */
export function TutorialLauncher() {
  const { startTutorial, completedTutorials, isTutorialAvailable } = useTutorial();
  const [isOpen, setIsOpen] = useState(false);

  const availableTutorials = BUILT_IN_TUTORIALS.filter(tutorial => 
    isTutorialAvailable(tutorial.id)
  );

  if (availableTutorials.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <BookOpen className="h-4 w-4" />
        Tutorials
      </Button>

      {isOpen && (
        <Card className="absolute top-full right-0 mt-2 w-80 z-50 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Available Tutorials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableTutorials.map(tutorial => {
              const isCompleted = completedTutorials.includes(tutorial.id);
              
              return (
                <div
                  key={tutorial.id}
                  className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    startTutorial(tutorial.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{tutorial.title}</h4>
                      {isCompleted && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{tutorial.description}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary" className="text-xs">
                        {tutorial.difficulty}
                      </Badge>
                      <span className="text-muted-foreground">
                        {Math.ceil(tutorial.estimatedTime / 60)}min
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { BUILT_IN_TUTORIALS };
export default TutorialLauncher;