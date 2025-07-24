/**
 * @fileoverview Transition manager for smooth page and component transitions
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - UI/UX polish and performance
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// === TYPES ===
/**
 * Transition configuration
 */
interface TransitionConfig {
  /** Transition duration in milliseconds */
  duration: number;
  /** CSS easing function */
  easing: string;
  /** Whether transition respects reduced motion preference */
  respectsReducedMotion: boolean;
}

/**
 * Available transition types
 */
type TransitionType = 
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'scale'
  | 'blur'
  | 'none';

/**
 * Transition state
 */
interface TransitionState {
  /** Whether transitions are enabled globally */
  enabled: boolean;
  /** Whether to respect user's reduced motion preference */
  respectReducedMotion: boolean;
  /** Default transition configuration */
  defaultConfig: TransitionConfig;
  /** Active transitions by ID */
  activeTransitions: Map<string, boolean>;
}

/**
 * Transition context value
 */
interface TransitionContextValue extends TransitionState {
  /** Enable/disable transitions globally */
  setEnabled: (enabled: boolean) => void;
  /** Set reduced motion preference */
  setRespectReducedMotion: (respect: boolean) => void;
  /** Update default transition configuration */
  updateDefaultConfig: (config: Partial<TransitionConfig>) => void;
  /** Start a transition */
  startTransition: (id: string) => void;
  /** End a transition */
  endTransition: (id: string) => void;
  /** Check if transition is active */
  isTransitioning: (id: string) => boolean;
}

/**
 * Props for transition wrapper component
 */
interface TransitionWrapperProps {
  /** Child components */
  children: React.ReactNode;
  /** Transition type */
  type?: TransitionType;
  /** Custom transition configuration */
  config?: Partial<TransitionConfig>;
  /** Whether transition is currently active */
  show: boolean;
  /** Callback when transition enters */
  onEnter?: () => void;
  /** Callback when transition exits */
  onExit?: () => void;
  /** Callback when transition completes */
  onComplete?: () => void;
  /** Optional className */
  className?: string;
}

// === CONSTANTS ===
/**
 * Default transition configurations
 */
const DEFAULT_TRANSITIONS: Record<TransitionType, TransitionConfig> = {
  fade: {
    duration: 300,
    easing: 'ease-in-out',
    respectsReducedMotion: true,
  },
  'slide-left': {
    duration: 300,
    easing: 'ease-out',
    respectsReducedMotion: true,
  },
  'slide-right': {
    duration: 300,
    easing: 'ease-out',
    respectsReducedMotion: true,
  },
  'slide-up': {
    duration: 300,
    easing: 'ease-out',
    respectsReducedMotion: true,
  },
  'slide-down': {
    duration: 300,
    easing: 'ease-out',
    respectsReducedMotion: true,
  },
  scale: {
    duration: 200,
    easing: 'ease-out',
    respectsReducedMotion: true,
  },
  blur: {
    duration: 250,
    easing: 'ease-in-out',
    respectsReducedMotion: true,
  },
  none: {
    duration: 0,
    easing: 'linear',
    respectsReducedMotion: false,
  },
};

/**
 * CSS transition classes for each type
 */
const TRANSITION_CLASSES: Record<TransitionType, {
  enter: string;
  enterFrom: string;
  enterTo: string;
  leave: string;
  leaveFrom: string;
  leaveTo: string;
}> = {
  fade: {
    enter: 'transition-opacity',
    enterFrom: 'opacity-0',
    enterTo: 'opacity-100',
    leave: 'transition-opacity',
    leaveFrom: 'opacity-100',
    leaveTo: 'opacity-0',
  },
  'slide-left': {
    enter: 'transition-transform',
    enterFrom: 'transform translate-x-full',
    enterTo: 'transform translate-x-0',
    leave: 'transition-transform',
    leaveFrom: 'transform translate-x-0',
    leaveTo: 'transform -translate-x-full',
  },
  'slide-right': {
    enter: 'transition-transform',
    enterFrom: 'transform -translate-x-full',
    enterTo: 'transform translate-x-0',
    leave: 'transition-transform',
    leaveFrom: 'transform translate-x-0',
    leaveTo: 'transform translate-x-full',
  },
  'slide-up': {
    enter: 'transition-transform',
    enterFrom: 'transform translate-y-full',
    enterTo: 'transform translate-y-0',
    leave: 'transition-transform',
    leaveFrom: 'transform translate-y-0',
    leaveTo: 'transform -translate-y-full',
  },
  'slide-down': {
    enter: 'transition-transform',
    enterFrom: 'transform -translate-y-full',
    enterTo: 'transform translate-y-0',
    leave: 'transition-transform',
    leaveFrom: 'transform translate-y-0',
    leaveTo: 'transform translate-y-full',
  },
  scale: {
    enter: 'transition-transform',
    enterFrom: 'transform scale-95 opacity-0',
    enterTo: 'transform scale-100 opacity-100',
    leave: 'transition-transform',
    leaveFrom: 'transform scale-100 opacity-100',
    leaveTo: 'transform scale-95 opacity-0',
  },
  blur: {
    enter: 'transition-all',
    enterFrom: 'blur-sm opacity-0',
    enterTo: 'blur-0 opacity-100',
    leave: 'transition-all',
    leaveFrom: 'blur-0 opacity-100',
    leaveTo: 'blur-sm opacity-0',
  },
  none: {
    enter: '',
    enterFrom: '',
    enterTo: '',
    leave: '',
    leaveFrom: '',
    leaveTo: '',
  },
};

/**
 * Default transition state
 */
const DEFAULT_STATE: TransitionState = {
  enabled: true,
  respectReducedMotion: true,
  defaultConfig: DEFAULT_TRANSITIONS.fade,
  activeTransitions: new Map(),
};

// === CONTEXT ===
const TransitionContext = createContext<TransitionContextValue | undefined>(undefined);

// === TRANSITION MANAGER PROVIDER ===
/**
 * Transition manager provider component
 * 
 * Provides centralized transition management for the entire application.
 * Handles reduced motion preferences, global transition state, and
 * coordination between multiple animated components.
 * 
 * @param props - Provider props
 * @returns Provider JSX element
 */
export const TransitionManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TransitionState>(() => ({
    ...DEFAULT_STATE,
    // Check for user's reduced motion preference
    respectReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));

  /**
   * Enable/disable transitions globally
   */
  const setEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, enabled }));
  }, []);

  /**
   * Set reduced motion preference
   */
  const setRespectReducedMotion = useCallback((respect: boolean) => {
    setState(prev => ({ ...prev, respectReducedMotion: respect }));
  }, []);

  /**
   * Update default transition configuration
   */
  const updateDefaultConfig = useCallback((config: Partial<TransitionConfig>) => {
    setState(prev => ({
      ...prev,
      defaultConfig: { ...prev.defaultConfig, ...config }
    }));
  }, []);

  /**
   * Start a transition
   */
  const startTransition = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      activeTransitions: new Map(prev.activeTransitions).set(id, true)
    }));
  }, []);

  /**
   * End a transition
   */
  const endTransition = useCallback((id: string) => {
    setState(prev => {
      const newTransitions = new Map(prev.activeTransitions);
      newTransitions.delete(id);
      return { ...prev, activeTransitions: newTransitions };
    });
  }, []);

  /**
   * Check if transition is active
   */
  const isTransitioning = useCallback((id: string) => {
    return state.activeTransitions.has(id);
  }, [state.activeTransitions]);

  // Listen for reduced motion preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (event: MediaQueryListEvent) => {
      if (state.respectReducedMotion) {
        setEnabled(!event.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [state.respectReducedMotion, setEnabled]);

  const contextValue: TransitionContextValue = {
    ...state,
    setEnabled,
    setRespectReducedMotion,
    updateDefaultConfig,
    startTransition,
    endTransition,
    isTransitioning,
  };

  return (
    <TransitionContext.Provider value={contextValue}>
      {children}
    </TransitionContext.Provider>
  );
};

// === TRANSITION WRAPPER COMPONENT ===
/**
 * Transition wrapper component
 * 
 * Wraps content with smooth transitions. Handles enter/exit animations
 * based on the show prop and respects user motion preferences.
 * 
 * @param props - Component props
 * @returns Transition wrapper JSX element
 */
export const TransitionWrapper: React.FC<TransitionWrapperProps> = ({
  children,
  type = 'fade',
  config,
  show,
  onEnter,
  onExit,
  onComplete,
  className = '',
}) => {
  const context = useContext(TransitionContext);
  const [isVisible, setIsVisible] = useState(show);
  const [transitionState, setTransitionState] = useState<'entering' | 'entered' | 'exiting' | 'exited'>(
    show ? 'entered' : 'exited'
  );

  if (!context) {
    throw new Error('TransitionWrapper must be used within a TransitionManagerProvider');
  }

  const { enabled, respectReducedMotion } = context;
  
  // Get transition configuration
  const transitionConfig = {
    ...DEFAULT_TRANSITIONS[type],
    ...config,
  };

  // Disable transitions if user prefers reduced motion
  const shouldAnimate = enabled && !(respectReducedMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const effectiveType = shouldAnimate ? type : 'none';
  const classes = TRANSITION_CLASSES[effectiveType];

  // Handle show/hide changes
  useEffect(() => {
    if (show && !isVisible) {
      // Starting to show
      setIsVisible(true);
      setTransitionState('entering');
      onEnter?.();
      
      if (shouldAnimate) {
        // Trigger enter animation after DOM update
        requestAnimationFrame(() => {
          setTransitionState('entered');
        });
      } else {
        setTransitionState('entered');
      }
    } else if (!show && isVisible) {
      // Starting to hide
      setTransitionState('exiting');
      onExit?.();
      
      if (shouldAnimate) {
        // Hide after transition completes
        setTimeout(() => {
          setIsVisible(false);
          setTransitionState('exited');
          onComplete?.();
        }, transitionConfig.duration);
      } else {
        setIsVisible(false);
        setTransitionState('exited');
        onComplete?.();
      }
    }
  }, [show, isVisible, shouldAnimate, transitionConfig.duration, onEnter, onExit, onComplete]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Build CSS classes
  const baseClasses = className;
  let transitionClasses = '';
  let stateClasses = '';

  if (shouldAnimate) {
    if (transitionState === 'entering') {
      transitionClasses = classes.enter;
      stateClasses = classes.enterFrom;
    } else if (transitionState === 'entered') {
      transitionClasses = classes.enter;
      stateClasses = classes.enterTo;
    } else if (transitionState === 'exiting') {
      transitionClasses = classes.leave;
      stateClasses = classes.leaveTo;
    }
  }

  const finalClasses = [baseClasses, transitionClasses, stateClasses]
    .filter(Boolean)
    .join(' ');

  const style = shouldAnimate ? {
    transitionDuration: `${transitionConfig.duration}ms`,
    transitionTimingFunction: transitionConfig.easing,
  } : undefined;

  return (
    <div className={`h-full ${finalClasses}`} style={style}>
      {children}
    </div>
  );
};

// === CUSTOM HOOKS ===
/**
 * Hook for accessing transition context
 */
export const useTransitions = (): TransitionContextValue => {
  const context = useContext(TransitionContext);
  
  if (context === undefined) {
    throw new Error('useTransitions must be used within a TransitionManagerProvider');
  }
  
  return context;
};

/**
 * Hook for managing component transitions
 */
export const useTransition = (id: string, type: TransitionType = 'fade') => {
  const { startTransition, endTransition, isTransitioning } = useTransitions();
  
  const trigger = useCallback((show: boolean) => {
    if (show) {
      startTransition(id);
    } else {
      setTimeout(() => endTransition(id), DEFAULT_TRANSITIONS[type].duration);
    }
  }, [id, type, startTransition, endTransition]);

  return {
    trigger,
    isActive: isTransitioning(id),
  };
};

// === EXPORTS ===
export default TransitionManagerProvider;
export type { 
  TransitionConfig, 
  TransitionType, 
  TransitionState, 
  TransitionWrapperProps 
};