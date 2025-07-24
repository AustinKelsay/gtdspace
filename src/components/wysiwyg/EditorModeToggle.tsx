/**
 * @fileoverview Editor mode toggle component for WYSIWYG/source mode switching
 * @author Development Team
 * @created 2024-01-XX
 * @updated 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import React, { useCallback } from 'react';
import { Edit3, Eye, Code, SplitSquareHorizontal } from 'lucide-react';

// Internal imports
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// === TYPES ===
/**
 * Available editor modes
 */
export type EditorMode = 'wysiwyg' | 'source' | 'split' | 'preview';

/**
 * Props for the EditorModeToggle component
 */
export interface EditorModeToggleProps {
  /** Current active mode */
  currentMode: EditorMode;
  /** Callback fired when mode changes */
  onModeChange: (mode: EditorMode) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show labels */
  showLabels?: boolean;
  /** Size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Available modes to show */
  availableModes?: EditorMode[];
}

/**
 * Configuration for each editor mode
 */
interface ModeConfig {
  /** Mode identifier */
  mode: EditorMode;
  /** Display label */
  label: string;
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Tooltip description */
  tooltip: string;
  /** Keyboard shortcut */
  shortcut?: string;
}

// === CONSTANTS ===
/**
 * Configuration for all available editor modes
 */
const MODE_CONFIGS: Record<EditorMode, ModeConfig> = {
  wysiwyg: {
    mode: 'wysiwyg',
    label: 'Rich Text',
    icon: Edit3,
    tooltip: 'WYSIWYG Editor - Rich text editing with visual formatting',
    shortcut: 'Ctrl+Shift+W'
  },
  source: {
    mode: 'source',
    label: 'Source',
    icon: Code,
    tooltip: 'Source Mode - Raw markdown editing with syntax highlighting',
    shortcut: 'Ctrl+Shift+S'
  },
  split: {
    mode: 'split',
    label: 'Split',
    icon: SplitSquareHorizontal,
    tooltip: 'Split View - Side-by-side source and preview',
    shortcut: 'Ctrl+Shift+P'
  },
  preview: {
    mode: 'preview',
    label: 'Preview',
    icon: Eye,
    tooltip: 'Preview Mode - Read-only rendered markdown preview',
    shortcut: 'Ctrl+Shift+V'
  }
};

/**
 * Default available modes
 */
const DEFAULT_MODES: EditorMode[] = ['wysiwyg', 'source', 'split', 'preview'];

// === MAIN COMPONENT ===
/**
 * Editor mode toggle component for switching between different editing modes
 * 
 * Provides a toggle group interface for switching between:
 * - WYSIWYG: Rich text editor with visual formatting
 * - Source: Raw markdown editor with syntax highlighting  
 * - Split: Side-by-side source and preview
 * - Preview: Read-only rendered preview
 * 
 * @param props - Component props
 * @returns JSX element containing the mode toggle buttons
 * 
 * @example
 * ```tsx
 * <EditorModeToggle
 *   currentMode="wysiwyg"
 *   onModeChange={(mode) => setEditorMode(mode)}
 *   showLabels={true}
 *   availableModes={['wysiwyg', 'source', 'preview']}
 * />
 * ```
 */
export const EditorModeToggle: React.FC<EditorModeToggleProps> = ({
  currentMode,
  onModeChange,
  disabled = false,
  className,
  showLabels = false,
  size = 'default',
  availableModes = DEFAULT_MODES
}) => {
  // Handle mode selection
  const handleModeChange = useCallback((mode: EditorMode) => {
    if (disabled || mode === currentMode) return;
    onModeChange(mode);
  }, [currentMode, disabled, onModeChange]);

  // Filter configurations by available modes
  const visibleModes = availableModes
    .filter(mode => MODE_CONFIGS[mode])
    .map(mode => MODE_CONFIGS[mode]);

  if (visibleModes.length === 0) {
    return null;
  }

  return (
    <div 
      className={cn(
        'inline-flex rounded-lg bg-muted p-1 gap-1',
        className
      )}
      role="tablist"
      aria-label="Editor mode selection"
      data-tour="editor-modes"
    >
      {visibleModes.map((config) => {
        const isActive = config.mode === currentMode;
        const Icon = config.icon;

        return (
          <Button
            key={config.mode}
            variant={isActive ? 'default' : 'ghost'}
            size={size}
            disabled={disabled}
            onClick={() => handleModeChange(config.mode)}
            className={cn(
              'relative transition-all duration-200',
              isActive && 'shadow-sm',
              showLabels ? 'px-3 py-2' : 'px-2 py-2',
              size === 'sm' && 'h-8 text-xs',
              size === 'lg' && 'h-12 text-base'
            )}
            title={config.tooltip + (config.shortcut ? ` (${config.shortcut})` : '')}
            role="tab"
            aria-selected={isActive}
            aria-controls={`editor-panel-${config.mode}`}
          >
            <Icon className={cn(
              'shrink-0',
              size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4',
              showLabels && 'mr-2'
            )} />
            {showLabels && (
              <span className="font-medium">
                {config.label}
              </span>
            )}
            
            {/* Active indicator */}
            {isActive && (
              <div 
                className="absolute inset-0 rounded-md ring-2 ring-primary/20 ring-inset pointer-events-none"
                aria-hidden="true"
              />
            )}
          </Button>
        );
      })}
    </div>
  );
};

// === UTILITY COMPONENTS ===
/**
 * Compact version of EditorModeToggle with icons only
 */
const CompactEditorModeToggle: React.FC<Omit<EditorModeToggleProps, 'showLabels' | 'size'>> = (props) => (
  <EditorModeToggle 
    {...props} 
    showLabels={false} 
    size="sm"
    className={cn('bg-transparent border border-border', props.className)}
  />
);

/**
 * Full-width EditorModeToggle with labels
 */
const FullEditorModeToggle: React.FC<Omit<EditorModeToggleProps, 'showLabels'>> = (props) => (
  <EditorModeToggle 
    {...props} 
    showLabels={true}
    className={cn('w-full justify-center', props.className)}
  />
);

// === UTILITY FUNCTIONS ===
/**
 * Get the next editor mode in sequence
 * 
 * @param currentMode - Current active mode
 * @param availableModes - Available modes to cycle through
 * @returns Next mode in sequence
 */
export function getNextEditorMode(
  currentMode: EditorMode, 
  availableModes: EditorMode[] = DEFAULT_MODES
): EditorMode {
  const currentIndex = availableModes.indexOf(currentMode);
  const nextIndex = (currentIndex + 1) % availableModes.length;
  return availableModes[nextIndex];
}

/**
 * Get the previous editor mode in sequence
 * 
 * @param currentMode - Current active mode
 * @param availableModes - Available modes to cycle through
 * @returns Previous mode in sequence
 */
export function getPreviousEditorMode(
  currentMode: EditorMode, 
  availableModes: EditorMode[] = DEFAULT_MODES
): EditorMode {
  const currentIndex = availableModes.indexOf(currentMode);
  const prevIndex = currentIndex === 0 ? availableModes.length - 1 : currentIndex - 1;
  return availableModes[prevIndex];
}

/**
 * Check if a mode is available in the provided list
 * 
 * @param mode - Mode to check
 * @param availableModes - Available modes list
 * @returns Whether the mode is available
 */
export function isModeAvailable(mode: EditorMode, availableModes: EditorMode[]): boolean {
  return availableModes.includes(mode);
}

/**
 * Get mode configuration by mode type
 * 
 * @param mode - Editor mode
 * @returns Mode configuration object
 */
export function getModeConfig(mode: EditorMode): ModeConfig | undefined {
  return MODE_CONFIGS[mode];
}

/**
 * Get keyboard shortcut for a mode
 * 
 * @param mode - Editor mode
 * @returns Keyboard shortcut string or undefined
 */
export function getModeShortcut(mode: EditorMode): string | undefined {
  return MODE_CONFIGS[mode]?.shortcut;
}

// === EXPORTS ===
export default EditorModeToggle;
export { CompactEditorModeToggle, FullEditorModeToggle };
export { MODE_CONFIGS, DEFAULT_MODES };