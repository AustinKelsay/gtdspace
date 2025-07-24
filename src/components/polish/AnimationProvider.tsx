/**
 * @fileoverview Centralized animation configuration and provider
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Animation system and visual polish
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// === TYPES ===

export interface AnimationConfig {
  // Duration presets (in milliseconds)
  duration: {
    instant: number;
    fast: number;
    normal: number;
    slow: number;
    deliberate: number;
  };
  
  // Easing functions
  easing: {
    linear: string;
    ease: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
    bounceOut: string;
    circOut: string;
    backOut: string;
    elasticOut: string;
  };
  
  // Animation preferences
  preferences: {
    respectReducedMotion: boolean;
    disableOnLowPower: boolean;
    globallyEnabled: boolean;
    debugMode: boolean;
  };
  
  // Animation variants
  variants: {
    fadeIn: AnimationVariant;
    fadeOut: AnimationVariant;
    slideInFromLeft: AnimationVariant;
    slideInFromRight: AnimationVariant;
    slideInFromTop: AnimationVariant;
    slideInFromBottom: AnimationVariant;
    slideOutToLeft: AnimationVariant;
    slideOutToRight: AnimationVariant;
    slideOutToTop: AnimationVariant;
    slideOutToBottom: AnimationVariant;
    scaleIn: AnimationVariant;
    scaleOut: AnimationVariant;
    bounceIn: AnimationVariant;
    shake: AnimationVariant;
    pulse: AnimationVariant;
    spin: AnimationVariant;
  };
}

export interface AnimationVariant {
  duration: keyof AnimationConfig['duration'];
  easing: keyof AnimationConfig['easing'];
  keyframes: string;
  className?: string;
}

export interface AnimationContextType {
  config: AnimationConfig;
  updateConfig: (updates: Partial<AnimationConfig>) => void;
  shouldAnimate: boolean;
  isReducedMotion: boolean;
  isLowPower: boolean;
  animate: (element: HTMLElement, variant: keyof AnimationConfig['variants'] | AnimationVariant) => Promise<void>;
  getTransitionClass: (property: string, duration?: keyof AnimationConfig['duration'], easing?: keyof AnimationConfig['easing']) => string;
  getAnimationClass: (variant: keyof AnimationConfig['variants']) => string;
  registerCustomVariant: (name: string, variant: AnimationVariant) => void;
}

// === DEFAULT CONFIG ===

const defaultConfig: AnimationConfig = {
  duration: {
    instant: 0,
    fast: 150,
    normal: 300,
    slow: 500,
    deliberate: 750,
  },
  
  easing: {
    linear: 'linear',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounceOut: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    circOut: 'cubic-bezier(0.075, 0.82, 0.165, 1)',
    backOut: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    elasticOut: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
  
  preferences: {
    respectReducedMotion: true,
    disableOnLowPower: true,
    globallyEnabled: true,
    debugMode: false,
  },
  
  variants: {
    fadeIn: {
      duration: 'normal',
      easing: 'ease',
      keyframes: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `,
      className: 'animate-fadeIn',
    },
    
    fadeOut: {
      duration: 'normal',
      easing: 'ease',
      keyframes: `
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `,
      className: 'animate-fadeOut',
    },
    
    slideInFromLeft: {
      duration: 'normal',
      easing: 'easeOut',
      keyframes: `
        @keyframes slideInFromLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `,
      className: 'animate-slideInFromLeft',
    },
    
    slideInFromRight: {
      duration: 'normal',
      easing: 'easeOut',
      keyframes: `
        @keyframes slideInFromRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `,
      className: 'animate-slideInFromRight',
    },
    
    slideInFromTop: {
      duration: 'normal',
      easing: 'easeOut',
      keyframes: `
        @keyframes slideInFromTop {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `,
      className: 'animate-slideInFromTop',
    },
    
    slideInFromBottom: {
      duration: 'normal',
      easing: 'easeOut',
      keyframes: `
        @keyframes slideInFromBottom {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `,
      className: 'animate-slideInFromBottom',
    },
    
    slideOutToLeft: {
      duration: 'normal',
      easing: 'easeIn',
      keyframes: `
        @keyframes slideOutToLeft {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-100%); opacity: 0; }
        }
      `,
      className: 'animate-slideOutToLeft',
    },
    
    slideOutToRight: {
      duration: 'normal',
      easing: 'easeIn',
      keyframes: `
        @keyframes slideOutToRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `,
      className: 'animate-slideOutToRight',
    },
    
    slideOutToTop: {
      duration: 'normal',
      easing: 'easeIn',
      keyframes: `
        @keyframes slideOutToTop {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(-100%); opacity: 0; }
        }
      `,
      className: 'animate-slideOutToTop',
    },
    
    slideOutToBottom: {
      duration: 'normal',
      easing: 'easeIn',
      keyframes: `
        @keyframes slideOutToBottom {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100%); opacity: 0; }
        }
      `,
      className: 'animate-slideOutToBottom',
    },
    
    scaleIn: {
      duration: 'normal',
      easing: 'bounceOut',
      keyframes: `
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `,
      className: 'animate-scaleIn',
    },
    
    scaleOut: {
      duration: 'normal',
      easing: 'easeIn',
      keyframes: `
        @keyframes scaleOut {
          from { transform: scale(1); opacity: 1; }
          to { transform: scale(0.9); opacity: 0; }
        }
      `,
      className: 'animate-scaleOut',
    },
    
    bounceIn: {
      duration: 'slow',
      easing: 'bounceOut',
      keyframes: `
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
      `,
      className: 'animate-bounceIn',
    },
    
    shake: {
      duration: 'slow',
      easing: 'ease',
      keyframes: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(10px); }
        }
      `,
      className: 'animate-shake',
    },
    
    pulse: {
      duration: 'normal',
      easing: 'ease',
      keyframes: `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `,
      className: 'animate-pulse',
    },
    
    spin: {
      duration: 'normal',
      easing: 'linear',
      keyframes: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `,
      className: 'animate-spin',
    },
  },
};

// === CONTEXT ===

const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

export const useAnimation = (): AnimationContextType => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimation must be used within an AnimationProvider');
  }
  return context;
};

// === PROVIDER ===

interface AnimationProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<AnimationConfig>;
}

export const AnimationProvider: React.FC<AnimationProviderProps> = ({
  children,
  initialConfig,
}) => {
  const [config, setConfig] = useState<AnimationConfig>({
    ...defaultConfig,
    ...initialConfig,
  });
  
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isLowPower, setIsLowPower] = useState(false);
  const [customVariants, setCustomVariants] = useState<Record<string, AnimationVariant>>({});

  // Detect reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Detect low power mode (Safari only)
  useEffect(() => {
    const checkLowPowerMode = () => {
      // This is a heuristic check for low power mode
      // Safari may reduce requestAnimationFrame rate in low power mode
      let frameCount = 0;
      let start = Date.now();
      
      const checkFrame = () => {
        frameCount++;
        if (frameCount < 10) {
          requestAnimationFrame(checkFrame);
        } else {
          const elapsed = Date.now() - start;
          // If frames take longer than expected, assume low power mode
          setIsLowPower(elapsed > 200);
        }
      };
      
      requestAnimationFrame(checkFrame);
    };
    
    checkLowPowerMode();
  }, []);

  // Inject CSS keyframes
  useEffect(() => {
    const styleId = 'gtdspace-animations';
    let existingStyle = document.getElementById(styleId);
    
    if (!existingStyle) {
      existingStyle = document.createElement('style');
      existingStyle.id = styleId;
      document.head.appendChild(existingStyle);
    }
    
    const allVariants = { ...config.variants, ...customVariants };
    const css = Object.values(allVariants)
      .map(variant => variant.keyframes)
      .join('\n');
    
    existingStyle.textContent = css;
    
    return () => {
      // Cleanup on unmount
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, [config.variants, customVariants]);

  // Update config
  const updateConfig = useCallback((updates: Partial<AnimationConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...updates,
      duration: { ...prev.duration, ...updates.duration },
      easing: { ...prev.easing, ...updates.easing },
      preferences: { ...prev.preferences, ...updates.preferences },
      variants: { ...prev.variants, ...updates.variants },
    }));
  }, []);

  // Should animate check
  const shouldAnimate = config.preferences.globallyEnabled && 
    (!config.preferences.respectReducedMotion || !isReducedMotion) &&
    (!config.preferences.disableOnLowPower || !isLowPower);

  // Animate element
  const animate = useCallback(async (
    element: HTMLElement, 
    variant: keyof AnimationConfig['variants'] | AnimationVariant
  ): Promise<void> => {
    if (!shouldAnimate) return;
    
    const animationVariant = typeof variant === 'string' 
      ? config.variants[variant] || customVariants[variant]
      : variant;
    
    if (!animationVariant) {
      console.warn(`Animation variant not found: ${variant}`);
      return;
    }
    
    const duration = config.duration[animationVariant.duration];
    const easing = config.easing[animationVariant.easing];
    
    return new Promise((resolve) => {
      const animationName = typeof variant === 'string' ? variant : 'customAnimation';
      
      element.style.animation = `${animationName} ${duration}ms ${easing}`;
      
      const handleComplete = () => {
        element.style.animation = '';
        element.removeEventListener('animationend', handleComplete);
        resolve();
      };
      
      element.addEventListener('animationend', handleComplete);
      
      // Fallback timeout
      setTimeout(() => {
        handleComplete();
      }, duration + 100);
    });
  }, [shouldAnimate, config, customVariants]);

  // Get transition class
  const getTransitionClass = useCallback((
    property: string,
    duration: keyof AnimationConfig['duration'] = 'normal',
    easing: keyof AnimationConfig['easing'] = 'ease'
  ): string => {
    if (!shouldAnimate) return '';
    
    const durationMs = config.duration[duration];
    const easingValue = config.easing[easing];
    
    return `transition-${property} duration-${durationMs} ${easingValue}`;
  }, [shouldAnimate, config]);

  // Get animation class
  const getAnimationClass = useCallback((variant: keyof AnimationConfig['variants']): string => {
    if (!shouldAnimate) return '';
    
    const animationVariant = config.variants[variant] || customVariants[variant];
    return animationVariant?.className || '';
  }, [shouldAnimate, config.variants, customVariants]);

  // Register custom variant
  const registerCustomVariant = useCallback((name: string, variant: AnimationVariant) => {
    setCustomVariants(prev => ({
      ...prev,
      [name]: variant,
    }));
  }, []);

  const contextValue: AnimationContextType = {
    config,
    updateConfig,
    shouldAnimate,
    isReducedMotion,
    isLowPower,
    animate,
    getTransitionClass,
    getAnimationClass,
    registerCustomVariant,
  };

  return (
    <AnimationContext.Provider value={contextValue}>
      {children}
    </AnimationContext.Provider>
  );
};

// === UTILITY HOOKS ===

/**
 * Hook for common animation operations
 */
export const useAnimatedMount = (variant: keyof AnimationConfig['variants'] = 'fadeIn') => {
  const { animate, shouldAnimate } = useAnimation();
  const [ref, setRef] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (ref && shouldAnimate) {
      animate(ref, variant);
    }
  }, [ref, animate, variant, shouldAnimate]);

  return setRef;
};

/**
 * Hook for animated state transitions
 */
export const useAnimatedState = <T extends any>(
  initialState: T,
  enterVariant: keyof AnimationConfig['variants'] = 'fadeIn',
  exitVariant: keyof AnimationConfig['variants'] = 'fadeOut'
) => {
  const { animate } = useAnimation();
  const [state, setState] = useState(initialState);
  const [ref, setRef] = useState<HTMLElement | null>(null);

  const animatedSetState = useCallback(async (newState: T) => {
    if (ref && state !== newState) {
      await animate(ref, exitVariant);
      setState(newState);
      setTimeout(() => {
        if (ref) animate(ref, enterVariant);
      }, 50);
    } else {
      setState(newState);
    }
  }, [ref, state, animate, enterVariant, exitVariant]);

  return [state, animatedSetState, setRef] as const;
};

export default AnimationProvider;