/**
 * @fileoverview Polish components index for UI/UX enhancements
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - UI/UX polish and performance
 */

// Transition management
export { 
  TransitionManagerProvider,
  TransitionWrapper,
  useTransitions,
  useTransition 
} from './TransitionManager';
export type { 
  TransitionConfig, 
  TransitionType, 
  TransitionState, 
  TransitionWrapperProps 
} from './TransitionManager';

// Loading skeletons
export {
  default as Skeleton,
  FileListSkeleton,
  EditorSkeleton,
  TabSkeleton,
  SearchSkeleton,
  ModalSkeleton,
  CardSkeleton
} from './LoadingSkeletons';
export type {
  BaseSkeletonProps,
  FileListSkeletonProps,
  EditorSkeletonProps,
  TabSkeletonProps,
  SkeletonAnimation
} from './LoadingSkeletons';

// Micro-interactions and animations
export {
  default as InteractiveElement,
  AnimatedButton,
  AnimatedCard,
  RippleEffect
} from './MicroInteractions';
export type {
  HoverEffect,
  AnimationConfig as MicroAnimationConfig,
  InteractiveElementProps,
  RippleEffectProps
} from './MicroInteractions';


// Animation system
export {
  AnimationProvider,
  useAnimation,
  useAnimatedMount,
  useAnimatedState as useAnimatedStateManagement,
} from './AnimationProvider';
export type {
  AnimationConfig as AnimationProviderConfig,
  AnimationVariant,
  AnimationContextType,
} from './AnimationProvider';

