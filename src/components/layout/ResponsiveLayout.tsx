/**
 * @fileoverview Responsive layout system for adaptive UI across screen sizes
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Responsive design implementation
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// === TYPES ===
export type BreakpointName = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type LayoutMode = 'mobile' | 'tablet' | 'desktop' | 'wide';

export interface BreakpointConfig {
  name: BreakpointName;
  minWidth: number;
  maxWidth?: number;
  layoutMode: LayoutMode;
}

export interface ResponsiveContextValue {
  /** Current screen width */
  width: number;
  /** Current screen height */
  height: number;
  /** Active breakpoint name */
  currentBreakpoint: BreakpointName;
  /** Current layout mode */
  layoutMode: LayoutMode;
  /** Whether screen is mobile size */
  isMobile: boolean;
  /** Whether screen is tablet size */
  isTablet: boolean;
  /** Whether screen is desktop size */
  isDesktop: boolean;
  /** Whether screen is wide/large desktop */
  isWide: boolean;
  /** Whether sidebar should be collapsed by default */
  shouldCollapseSidebar: boolean;
  /** Whether to use compact UI elements */
  useCompactUI: boolean;
}

export interface ResponsiveLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Whether to apply max-width constraints */
  constrain?: boolean;
  /** Padding configuration */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export interface AdaptiveGridProps {
  children: React.ReactNode;
  className?: string;
  /** Grid columns configuration for each breakpoint */
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };
  /** Gap between grid items */
  gap?: 'sm' | 'md' | 'lg' | 'xl';
}

// === CONSTANTS ===
const BREAKPOINTS: BreakpointConfig[] = [
  { name: 'xs', minWidth: 0, maxWidth: 474, layoutMode: 'mobile' },
  { name: 'sm', minWidth: 475, maxWidth: 639, layoutMode: 'mobile' },
  { name: 'md', minWidth: 640, maxWidth: 767, layoutMode: 'tablet' },
  { name: 'lg', minWidth: 768, maxWidth: 1023, layoutMode: 'tablet' },
  { name: 'xl', minWidth: 1024, maxWidth: 1279, layoutMode: 'desktop' },
  { name: '2xl', minWidth: 1280, maxWidth: 1399, layoutMode: 'desktop' },
  { name: '3xl', minWidth: 1400, layoutMode: 'wide' }
];

const DEFAULT_COLUMNS = {
  xs: 1,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
  '2xl': 4
};

// === CONTEXT ===
const ResponsiveContext = createContext<ResponsiveContextValue | null>(null);

// === HOOKS ===
export function useResponsive(): ResponsiveContextValue {
  const context = useContext(ResponsiveContext);
  if (!context) {
    throw new Error('useResponsive must be used within a ResponsiveProvider');
  }
  return context;
}

export function useBreakpoint(): BreakpointName {
  const { currentBreakpoint } = useResponsive();
  return currentBreakpoint;
}

export function useLayoutMode(): LayoutMode {
  const { layoutMode } = useResponsive();
  return layoutMode;
}

// === UTILITY FUNCTIONS ===
function getCurrentBreakpoint(width: number): BreakpointConfig {
  for (let i = BREAKPOINTS.length - 1; i >= 0; i--) {
    const breakpoint = BREAKPOINTS[i];
    if (width >= breakpoint.minWidth) {
      if (!breakpoint.maxWidth || width <= breakpoint.maxWidth) {
        return breakpoint;
      }
    }
  }
  return BREAKPOINTS[0]; // fallback to xs
}

function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial size

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}

// === COMPONENTS ===

/**
 * Responsive context provider
 */
export function ResponsiveProvider({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowSize();
  const currentBreakpointConfig = getCurrentBreakpoint(width);

  const contextValue: ResponsiveContextValue = {
    width,
    height,
    currentBreakpoint: currentBreakpointConfig.name,
    layoutMode: currentBreakpointConfig.layoutMode,
    isMobile: currentBreakpointConfig.layoutMode === 'mobile',
    isTablet: currentBreakpointConfig.layoutMode === 'tablet',
    isDesktop: ['desktop', 'wide'].includes(currentBreakpointConfig.layoutMode),
    isWide: currentBreakpointConfig.layoutMode === 'wide',
    shouldCollapseSidebar: width < 1024,
    useCompactUI: width < 768
  };

  return (
    <ResponsiveContext.Provider value={contextValue}>
      {children}
    </ResponsiveContext.Provider>
  );
}

/**
 * Main responsive layout container
 */
export function ResponsiveLayout({ children, className }: ResponsiveLayoutProps) {
  const { layoutMode, shouldCollapseSidebar } = useResponsive();

  const layoutClasses = cn(
    'min-h-screen w-full',
    // Base layout
    layoutMode === 'mobile' && 'flex flex-col',
    layoutMode === 'tablet' && 'flex flex-col md:flex-row',
    ['desktop', 'wide'].includes(layoutMode) && 'flex',
    // Sidebar behavior
    shouldCollapseSidebar && 'relative',
    !shouldCollapseSidebar && 'relative lg:flex',
    className
  );

  return (
    <div className={layoutClasses}>
      {children}
    </div>
  );
}

/**
 * Adaptive container with responsive padding and max-width
 */
export function ResponsiveContainer({ 
  children, 
  className, 
  constrain = true,
  padding = 'md' 
}: ResponsiveContainerProps) {
  const { currentBreakpoint } = useResponsive();

  const containerClasses = cn(
    'w-full',
    // Max width constraints
    constrain && 'mx-auto',
    constrain && currentBreakpoint === 'xs' && 'max-w-none',
    constrain && currentBreakpoint === 'sm' && 'max-w-sm',
    constrain && currentBreakpoint === 'md' && 'max-w-2xl',
    constrain && currentBreakpoint === 'lg' && 'max-w-4xl',
    constrain && currentBreakpoint === 'xl' && 'max-w-6xl',
    constrain && ['2xl', '3xl'].includes(currentBreakpoint) && 'max-w-7xl',
    // Responsive padding
    padding === 'none' && 'p-0',
    padding === 'sm' && 'px-3 py-2 sm:px-4 sm:py-3',
    padding === 'md' && 'px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-6',
    padding === 'lg' && 'px-6 py-4 sm:px-8 sm:py-6 lg:px-12 lg:py-8',
    className
  );

  return (
    <div className={containerClasses}>
      {children}
    </div>
  );
}

/**
 * Adaptive grid system that adjusts columns based on screen size
 */
export function AdaptiveGrid({ 
  children, 
  className, 
  columns = DEFAULT_COLUMNS,
  gap = 'md' 
}: AdaptiveGridProps) {
  const { currentBreakpoint } = useResponsive();

  // Get current number of columns
  const currentColumns = columns[currentBreakpoint] || columns.lg || 3;

  const gridClasses = cn(
    'grid',
    // Dynamic grid columns
    currentColumns === 1 && 'grid-cols-1',
    currentColumns === 2 && 'grid-cols-2',
    currentColumns === 3 && 'grid-cols-3',
    currentColumns === 4 && 'grid-cols-4',
    currentColumns === 5 && 'grid-cols-5',
    currentColumns === 6 && 'grid-cols-6',
    // Gap sizes
    gap === 'sm' && 'gap-2',
    gap === 'md' && 'gap-4',
    gap === 'lg' && 'gap-6',
    gap === 'xl' && 'gap-8',
    className
  );

  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
}

/**
 * Responsive sidebar that adapts to screen size
 */
export function ResponsiveSidebar({ 
  children, 
  className,
  collapsible = true 
}: { 
  children: React.ReactNode; 
  className?: string;
  collapsible?: boolean;
}) {
  const { shouldCollapseSidebar, isMobile } = useResponsive();
  const [isCollapsed, setIsCollapsed] = useState(shouldCollapseSidebar);

  useEffect(() => {
    if (collapsible) {
      setIsCollapsed(shouldCollapseSidebar);
    }
  }, [shouldCollapseSidebar, collapsible]);

  const sidebarClasses = cn(
    'bg-sidebar border-r border-border',
    // Mobile behavior
    isMobile && 'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300',
    isMobile && isCollapsed && '-translate-x-full',
    isMobile && !isCollapsed && 'translate-x-0',
    // Desktop behavior
    !isMobile && 'relative',
    !isMobile && 'w-sidebar-sm lg:w-sidebar xl:w-sidebar-lg',
    !isMobile && isCollapsed && collapsible && 'w-16',
    className
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && !isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsCollapsed(true)}
        />
      )}
      
      <aside className={sidebarClasses}>
        {children}
      </aside>
      
      {/* Toggle button for mobile */}
      {isMobile && collapsible && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="fixed top-4 left-4 z-60 lg:hidden bg-background border border-border rounded-md p-2 shadow-lg"
          aria-label={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}
    </>
  );
}

/**
 * Responsive main content area
 */
export function ResponsiveMain({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  const { isMobile } = useResponsive();

  const mainClasses = cn(
    'flex-1 min-w-0', // min-w-0 prevents flex overflow
    isMobile && 'w-full',
    !isMobile && 'overflow-hidden',
    className
  );

  return (
    <main className={mainClasses}>
      {children}
    </main>
  );
}

/**
 * Responsive text that adapts size based on screen
 */
export function ResponsiveText({ 
  children, 
  className,
  variant = 'body' 
}: { 
  children: React.ReactNode; 
  className?: string;
  variant?: 'heading' | 'subheading' | 'body' | 'caption';
}) {
  const textClasses = cn(
    // Heading variants
    variant === 'heading' && 'text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold',
    variant === 'subheading' && 'text-lg sm:text-xl lg:text-2xl font-semibold',
    // Body variants
    variant === 'body' && 'text-sm sm:text-base',
    variant === 'caption' && 'text-xs sm:text-sm text-muted-foreground',
    className
  );

  return (
    <div className={textClasses}>
      {children}
    </div>
  );
}

export default ResponsiveLayout;