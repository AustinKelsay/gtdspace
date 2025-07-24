/**
 * @fileoverview Skeleton loading components for improved perceived performance
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - UI/UX polish and performance
 */

import React from 'react';

// === TYPES ===
/**
 * Skeleton animation types
 */
type SkeletonAnimation = 'pulse' | 'wave' | 'none';

/**
 * Base skeleton props
 */
interface BaseSkeletonProps {
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Animation type */
  animation?: SkeletonAnimation;
  /** Additional CSS className */
  className?: string;
  /** Whether skeleton respects reduced motion */
  respectsReducedMotion?: boolean;
}

/**
 * File list skeleton props
 */
interface FileListSkeletonProps {
  /** Number of skeleton items to show */
  count?: number;
  /** Show file icon placeholder */
  showIcon?: boolean;
  /** Show metadata placeholders */
  showMetadata?: boolean;
  /** Animation type */
  animation?: SkeletonAnimation;
  /** Additional CSS className */
  className?: string;
}

/**
 * Editor skeleton props
 */
interface EditorSkeletonProps {
  /** Number of text lines to show */
  lines?: number;
  /** Show toolbar skeleton */
  showToolbar?: boolean;
  /** Animation type */
  animation?: SkeletonAnimation;
  /** Additional CSS className */
  className?: string;
}

/**
 * Tab skeleton props
 */
interface TabSkeletonProps {
  /** Number of tabs to show */
  count?: number;
  /** Animation type */
  animation?: SkeletonAnimation;
  /** Additional CSS className */
  className?: string;
}

// === UTILITY FUNCTIONS ===
/**
 * Get animation classes based on type and motion preference
 */
const getAnimationClasses = (
  animation: SkeletonAnimation, 
  respectsReducedMotion: boolean = true
): string => {
  const prefersReducedMotion = respectsReducedMotion && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (prefersReducedMotion || animation === 'none') {
    return '';
  }
  
  switch (animation) {
    case 'pulse':
      return 'animate-pulse';
    case 'wave':
      return 'animate-shimmer';
    default:
      return '';
  }
};

/**
 * Get skeleton base classes
 */
const getSkeletonBaseClasses = (): string => {
  return 'bg-muted rounded';
};

// === BASE SKELETON COMPONENT ===
/**
 * Base skeleton component for creating custom skeletons
 * 
 * @param props - Component props
 * @returns Skeleton JSX element
 */
export const Skeleton: React.FC<BaseSkeletonProps> = ({
  width = '100%',
  height = '1rem',
  animation = 'pulse',
  className = '',
  respectsReducedMotion = true,
}) => {
  const animationClasses = getAnimationClasses(animation, respectsReducedMotion);
  const baseClasses = getSkeletonBaseClasses();
  
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div 
      className={`${baseClasses} ${animationClasses} ${className}`}
      style={style}
      role="status"
      aria-label="Loading..."
    />
  );
};

// === FILE LIST SKELETON ===
/**
 * File list skeleton component
 * 
 * Shows placeholder items that match the file list structure
 * 
 * @param props - Component props
 * @returns File list skeleton JSX element
 */
export const FileListSkeleton: React.FC<FileListSkeletonProps> = ({
  count = 5,
  showIcon = true,
  showMetadata = true,
  animation = 'pulse',
  className = '',
}) => {
  
  return (
    <div className={`space-y-2 p-3 ${className}`} role="status" aria-label="Loading files...">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center space-x-3 p-2">
          {/* File icon skeleton */}
          {showIcon && (
            <Skeleton 
              width={16} 
              height={16} 
              animation={animation}
              className="flex-shrink-0"
            />
          )}
          
          {/* File content */}
          <div className="flex-1 space-y-1">
            {/* File name skeleton - varies width for realistic look */}
            <Skeleton 
              width={`${60 + Math.random() * 30}%`}
              height="0.875rem"
              animation={animation}
            />
            
            {/* File metadata skeleton */}
            {showMetadata && (
              <div className="flex items-center space-x-4">
                <Skeleton 
                  width="3rem"
                  height="0.75rem"
                  animation={animation}
                />
                <Skeleton 
                  width="4rem"
                  height="0.75rem"
                  animation={animation}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// === EDITOR SKELETON ===
/**
 * Editor skeleton component
 * 
 * Shows placeholder content that matches the editor structure
 * 
 * @param props - Component props
 * @returns Editor skeleton JSX element
 */
export const EditorSkeleton: React.FC<EditorSkeletonProps> = ({
  lines = 10,
  showToolbar = true,
  animation = 'pulse',
  className = '',
}) => {
  return (
    <div className={`w-full h-full ${className}`} role="status" aria-label="Loading editor...">
      {/* Toolbar skeleton */}
      {showToolbar && (
        <div className="border-b border-border p-2 mb-4">
          <div className="flex items-center space-x-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton 
                key={index}
                width={32} 
                height={32} 
                animation={animation}
                className="rounded"
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {Array.from({ length: lines }).map((_, index) => {
          // Vary line widths for realistic text appearance
          let width;
          if (index === 0) {
            width = '60%'; // Title line
          } else if (index % 4 === 0) {
            width = '40%'; // Paragraph break
          } else if (index === lines - 1) {
            width = `${40 + Math.random() * 30}%`; // Last line varies
          } else {
            width = `${80 + Math.random() * 20}%`; // Content lines
          }
          
          return (
            <Skeleton 
              key={index}
              width={width}
              height="1rem"
              animation={animation}
            />
          );
        })}
      </div>
    </div>
  );
};

// === TAB SKELETON ===
/**
 * Tab skeleton component
 * 
 * Shows placeholder tabs in the tab bar
 * 
 * @param props - Component props
 * @returns Tab skeleton JSX element
 */
export const TabSkeleton: React.FC<TabSkeletonProps> = ({
  count = 3,
  animation = 'pulse',
  className = '',
}) => {
  return (
    <div className={`flex items-center space-x-1 p-1 ${className}`} role="status" aria-label="Loading tabs...">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center space-x-2 px-3 py-2 border-b-2 border-transparent">
          <Skeleton 
            width={`${60 + Math.random() * 40}px`}
            height="0.875rem"
            animation={animation}
          />
          {/* Close button skeleton */}
          <Skeleton 
            width={16} 
            height={16} 
            animation={animation}
            className="rounded-full"
          />
        </div>
      ))}
    </div>
  );
};

// === SEARCH SKELETON ===
/**
 * Search results skeleton component
 * 
 * @param props - Component props
 * @returns Search skeleton JSX element
 */
export const SearchSkeleton: React.FC<{ count?: number; animation?: SkeletonAnimation; className?: string }> = ({
  count = 3,
  animation = 'pulse',
  className = '',
}) => {
  return (
    <div className={`space-y-4 p-4 ${className}`} role="status" aria-label="Loading search results...">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-2">
          {/* Result title */}
          <Skeleton 
            width={`${70 + Math.random() * 20}%`}
            height="1.125rem"
            animation={animation}
          />
          
          {/* Result path */}
          <Skeleton 
            width={`${40 + Math.random() * 30}%`}
            height="0.75rem"
            animation={animation}
          />
          
          {/* Result snippet */}
          <div className="space-y-1">
            <Skeleton 
              width="90%"
              height="0.875rem"
              animation={animation}
            />
            <Skeleton 
              width={`${60 + Math.random() * 25}%`}
              height="0.875rem"
              animation={animation}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// === MODAL SKELETON ===
/**
 * Modal content skeleton component
 * 
 * @param props - Component props
 * @returns Modal skeleton JSX element
 */
export const ModalSkeleton: React.FC<{ 
  showHeader?: boolean; 
  showFooter?: boolean; 
  animation?: SkeletonAnimation; 
  className?: string;
}> = ({
  showHeader = true,
  showFooter = true,
  animation = 'pulse',
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`} role="status" aria-label="Loading...">
      {/* Header skeleton */}
      {showHeader && (
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <Skeleton 
            width="40%"
            height="1.25rem"
            animation={animation}
          />
          <Skeleton 
            width={24} 
            height={24} 
            animation={animation}
            className="rounded"
          />
        </div>
      )}
      
      {/* Content skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton 
            key={index}
            width={`${70 + Math.random() * 25}%`}
            height="1rem"
            animation={animation}
          />
        ))}
      </div>
      
      {/* Footer skeleton */}
      {showFooter && (
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
          <Skeleton 
            width={60} 
            height={32} 
            animation={animation}
            className="rounded"
          />
          <Skeleton 
            width={80} 
            height={32} 
            animation={animation}
            className="rounded"
          />
        </div>
      )}
    </div>
  );
};

// === CONTENT CARD SKELETON ===
/**
 * Content card skeleton for dashboard-style layouts
 * 
 * @param props - Component props
 * @returns Card skeleton JSX element
 */
export const CardSkeleton: React.FC<{
  showImage?: boolean;
  showFooter?: boolean;
  animation?: SkeletonAnimation;
  className?: string;
}> = ({
  showImage = false,
  showFooter = true,
  animation = 'pulse',
  className = '',
}) => {
  return (
    <div className={`border border-border rounded-lg p-4 space-y-3 ${className}`} role="status" aria-label="Loading...">
      {/* Image skeleton */}
      {showImage && (
        <Skeleton 
          width="100%"
          height="12rem"
          animation={animation}
          className="rounded"
        />
      )}
      
      {/* Title skeleton */}
      <Skeleton 
        width="80%"
        height="1.25rem"
        animation={animation}
      />
      
      {/* Content skeleton */}
      <div className="space-y-2">
        <Skeleton 
          width="100%"
          height="1rem"
          animation={animation}
        />
        <Skeleton 
          width="90%"
          height="1rem"
          animation={animation}
        />
        <Skeleton 
          width="70%"
          height="1rem"
          animation={animation}
        />
      </div>
      
      {/* Footer skeleton */}
      {showFooter && (
        <div className="flex items-center justify-between pt-2">
          <Skeleton 
            width="30%"
            height="0.875rem"
            animation={animation}
          />
          <Skeleton 
            width={60} 
            height={24} 
            animation={animation}
            className="rounded"
          />
        </div>
      )}
    </div>
  );
};

// === EXPORTS ===
export default Skeleton;
export type {
  BaseSkeletonProps,
  FileListSkeletonProps,
  EditorSkeletonProps,
  TabSkeletonProps,
  SkeletonAnimation,
};