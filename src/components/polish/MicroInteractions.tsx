/**
 * @fileoverview Micro-interactions and hover effects for enhanced UX
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - UI/UX polish and performance
 */

import React, { useState, useRef, useEffect } from 'react';

// === TYPES ===
/**
 * Hover effect types
 */
type HoverEffect = 
  | 'scale'
  | 'glow'
  | 'lift'
  | 'ripple'
  | 'bounce'
  | 'fade'
  | 'none';

/**
 * Animation configuration
 */
interface AnimationConfig {
  /** Animation duration in milliseconds */
  duration: number;
  /** CSS easing function */
  easing: string;
  /** Scale factor for scale animations */
  scale?: number;
  /** Glow intensity for glow effects */
  glowIntensity?: number;
  /** Lift distance in pixels for lift effects */
  liftDistance?: number;
}

/**
 * Interactive element props
 */
interface InteractiveElementProps {
  /** Child components */
  children: React.ReactNode;
  /** Hover effect type */
  effect?: HoverEffect;
  /** Custom animation configuration */
  config?: Partial<AnimationConfig>;
  /** Whether to respect reduced motion preference */
  respectReducedMotion?: boolean;
  /** Additional CSS className */
  className?: string;
  /** Click handler */
  onClick?: (event: React.MouseEvent) => void;
  /** Hover enter handler */
  onHoverEnter?: () => void;
  /** Hover leave handler */
  onHoverLeave?: () => void;
  /** Whether element is disabled */
  disabled?: boolean;
}

/**
 * Ripple effect props
 */
interface RippleEffectProps {
  /** Mouse event for ripple position */
  event: React.MouseEvent;
  /** Ripple color */
  color?: string;
  /** Animation duration */
  duration?: number;
}

// === CONSTANTS ===
/**
 * Default animation configurations for each effect
 */
const DEFAULT_CONFIGS: Record<HoverEffect, AnimationConfig> = {
  scale: {
    duration: 200,
    easing: 'ease-out',
    scale: 1.05,
  },
  glow: {
    duration: 300,
    easing: 'ease-out',
    glowIntensity: 0.15,
  },
  lift: {
    duration: 250,
    easing: 'ease-out',
    liftDistance: 4,
  },
  ripple: {
    duration: 600,
    easing: 'ease-out',
  },
  bounce: {
    duration: 400,
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    scale: 1.1,
  },
  fade: {
    duration: 200,
    easing: 'ease-in-out',
  },
  none: {
    duration: 0,
    easing: 'linear',
  },
};

// === UTILITY FUNCTIONS ===
/**
 * Check if user prefers reduced motion
 */
const prefersReducedMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Generate CSS classes for hover effects
 */
const getHoverClasses = (
  effect: HoverEffect,
  config: AnimationConfig,
  respectsMotion: boolean
): string => {
  if (respectsMotion && prefersReducedMotion()) {
    return '';
  }

  const baseTransition = `transition-all duration-${Math.round(config.duration / 50) * 50}`;

  switch (effect) {
    case 'scale':
      return `${baseTransition} hover:scale-105 active:scale-95`;
    case 'glow':
      return `${baseTransition} hover:shadow-lg hover:shadow-primary/20`;
    case 'lift':
      return `${baseTransition} hover:shadow-md hover:-translate-y-1`;
    case 'bounce':
      return `${baseTransition} hover:scale-110 active:scale-95`;
    case 'fade':
      return `${baseTransition} hover:opacity-80`;
    case 'ripple':
      return `${baseTransition} relative overflow-hidden`;
    default:
      return '';
  }
};

// === RIPPLE EFFECT COMPONENT ===
/**
 * Ripple effect component for click feedback
 */
const RippleEffect: React.FC<RippleEffectProps> = ({
  event,
  color = 'rgba(255, 255, 255, 0.6)',
  duration = 600,
}) => {
  const [ripples, setRipples] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
  }>>([]);

  useEffect(() => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const newRipple = {
      id: Date.now(),
      x,
      y,
      size,
    };

    setRipples(prev => [...prev, newRipple]);

    // Remove ripple after animation completes
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, duration);
  }, [event, duration]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {ripples.map(ripple => (
        <div
          key={ripple.id}
          className="absolute rounded-full animate-ping"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: color,
            animationDuration: `${duration}ms`,
          }}
        />
      ))}
    </div>
  );
};

// === INTERACTIVE ELEMENT COMPONENT ===
/**
 * Interactive element with micro-interactions
 * 
 * Wraps any element with hover effects and micro-interactions.
 * Respects user motion preferences and provides smooth animations.
 * 
 * @param props - Component props
 * @returns Interactive element JSX
 */
export const InteractiveElement: React.FC<InteractiveElementProps> = ({
  children,
  effect = 'scale',
  config,
  respectReducedMotion = true,
  className = '',
  onClick,
  onHoverEnter,
  onHoverLeave,
  disabled = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [rippleEvent, setRippleEvent] = useState<React.MouseEvent | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  // Merge default and custom config
  const animationConfig = {
    ...DEFAULT_CONFIGS[effect],
    ...config,
  };

  // Generate CSS classes
  const hoverClasses = getHoverClasses(effect, animationConfig, respectReducedMotion);
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer';

  // Handle mouse enter
  const handleMouseEnter = () => {
    if (disabled) return;
    setIsHovered(true);
    onHoverEnter?.();
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    if (disabled) return;
    setIsHovered(false);
    onHoverLeave?.();
  };

  // Handle click with ripple effect
  const handleClick = (event: React.MouseEvent) => {
    if (disabled) return;
    
    if (effect === 'ripple') {
      setRippleEvent(event);
    }
    
    onClick?.(event);
  };

  // Custom styles for effects that need JS control
  const customStyles: React.CSSProperties = {};
  
  if (isHovered && !disabled && !(respectReducedMotion && prefersReducedMotion())) {
    switch (effect) {
      case 'scale':
        customStyles.transform = `scale(${animationConfig.scale})`;
        break;
      case 'glow':
        customStyles.boxShadow = `0 0 20px rgba(var(--primary), ${animationConfig.glowIntensity})`;
        break;
      case 'lift':
        customStyles.transform = `translateY(-${animationConfig.liftDistance}px)`;
        customStyles.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.1)';
        break;
    }
  }

  return (
    <div
      ref={elementRef}
      className={`${hoverClasses} ${disabledClasses} ${className}`}
      style={{
        transitionDuration: `${animationConfig.duration}ms`,
        transitionTimingFunction: animationConfig.easing,
        ...customStyles,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && !disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick(e as any);
        }
      }}
    >
      {children}
      {effect === 'ripple' && rippleEvent && (
        <RippleEffect
          event={rippleEvent}
          duration={animationConfig.duration}
        />
      )}
    </div>
  );
};

// === ANIMATED BUTTON COMPONENT ===
/**
 * Pre-configured animated button component
 */
const AnimatedButton: React.FC<{
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  effect?: HoverEffect;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  className?: string;
}> = ({
  children,
  variant = 'primary',
  size = 'md',
  effect = 'scale',
  disabled = false,
  onClick,
  className = '',
}) => {
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  };

  const sizeClasses = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4',
    lg: 'h-12 px-6 text-lg',
  };

  const baseClasses = `
    inline-flex items-center justify-center whitespace-nowrap rounded-md 
    font-medium ring-offset-background transition-colors 
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring 
    focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
  `;

  return (
    <InteractiveElement
      effect={effect}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </InteractiveElement>
  );
};

// === ANIMATED CARD COMPONENT ===
/**
 * Pre-configured animated card component
 */
const AnimatedCard: React.FC<{
  children: React.ReactNode;
  effect?: HoverEffect;
  onClick?: (event: React.MouseEvent) => void;
  className?: string;
}> = ({
  children,
  effect = 'lift',
  onClick,
  className = '',
}) => {
  const baseClasses = `
    rounded-lg border bg-card text-card-foreground shadow-sm
  `;

  return (
    <InteractiveElement
      effect={effect}
      onClick={onClick}
      className={`${baseClasses} ${className}`}
    >
      {children}
    </InteractiveElement>
  );
};

// === EXPORTS ===
export default InteractiveElement;
export { AnimatedButton, AnimatedCard, RippleEffect };
export type {
  HoverEffect,
  AnimationConfig,
  InteractiveElementProps,
  RippleEffectProps,
};