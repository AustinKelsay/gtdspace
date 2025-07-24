/**
 * @fileoverview Contextual tooltip and help system
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Help and guidance system
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Lightbulb, Keyboard, Mouse, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

// === TYPES ===

interface TooltipData {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'tip' | 'shortcut' | 'feature';
  icon?: React.ReactNode;
  trigger?: 'hover' | 'click' | 'focus';
  position?: 'top' | 'bottom' | 'left' | 'right';
  showDelay?: number;
  hideDelay?: number;
  persistent?: boolean;
  contextualHelp?: {
    when: 'first-use' | 'error' | 'feature-discovery';
    conditions: string[];
  };
}


interface TooltipSettings {
  enabled: boolean;
  showContextualHelp: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast';
  showShortcuts: boolean;
  showTips: boolean;
  showFeatureHighlights: boolean;
}

interface SmartTooltipProps {
  id: string;
  title: string;
  content: string;
  type?: 'info' | 'tip' | 'shortcut' | 'feature';
  trigger?: 'hover' | 'click' | 'focus';
  position?: 'top' | 'bottom' | 'left' | 'right';
  shortcut?: string;
  showOnFirstUse?: boolean;
  children: React.ReactNode;
  className?: string;
}

// === CONSTANTS ===

const TOOLTIP_TYPES = {
  info: {
    icon: <Info className="h-4 w-4" />,
    color: 'bg-blue-500',
    label: 'Info',
  },
  tip: {
    icon: <Lightbulb className="h-4 w-4" />,
    color: 'bg-yellow-500',
    label: 'Tip',
  },
  shortcut: {
    icon: <Keyboard className="h-4 w-4" />,
    color: 'bg-purple-500',
    label: 'Shortcut',
  },
  feature: {
    icon: <Mouse className="h-4 w-4" />,
    color: 'bg-green-500',
    label: 'Feature',
  },
};

const DEFAULT_SETTINGS: TooltipSettings = {
  enabled: true,
  showContextualHelp: true,
  animationSpeed: 'normal',
  showShortcuts: true,
  showTips: true,
  showFeatureHighlights: true,
};

// === TOOLTIP DATA ===

const TOOLTIP_REGISTRY: Record<string, TooltipData> = {
  'folder-selector': {
    id: 'folder-selector',
    title: 'Select Workspace',
    content: 'Choose a folder containing your markdown files. This becomes your workspace for editing and organizing documents.',
    type: 'feature',
    contextualHelp: {
      when: 'first-use',
      conditions: ['no-folder-selected'],
    },
  },
  'file-browser': {
    id: 'file-browser',
    title: 'File Browser',
    content: 'Browse and manage your markdown files. Right-click for additional options like rename, delete, and create new files.',
    type: 'feature',
  },
  'editor-modes': {
    id: 'editor-modes',
    title: 'Editor Modes',
    content: 'Switch between different editing experiences: WYSIWYG for visual editing, Source for raw markdown, and Preview for reading.',
    type: 'feature',
  },
  'save-shortcut': {
    id: 'save-shortcut',
    title: 'Save File',
    content: 'Save your current document',
    type: 'shortcut',
  },
  'new-file-shortcut': {
    id: 'new-file-shortcut',
    title: 'New File',
    content: 'Create a new markdown file in the current workspace',
    type: 'shortcut',
  },
  'search-files': {
    id: 'search-files',
    title: 'Search Files',
    content: 'Quickly find files by name. Use the search box to filter your file list in real-time.',
    type: 'tip',
  },
  'auto-save': {
    id: 'auto-save',
    title: 'Auto-Save',
    content: 'Your changes are automatically saved every few seconds. The orange dot indicates unsaved changes.',
    type: 'info',
  },
  'wysiwyg-mode': {
    id: 'wysiwyg-mode',
    title: 'Rich Text Editing',
    content: 'WYSIWYG mode provides visual editing with formatting toolbar. Perfect for users who prefer a word-processor-like experience.',
    type: 'feature',
  },
  'source-mode': {
    id: 'source-mode',
    title: 'Markdown Source',
    content: 'Source mode shows raw markdown with syntax highlighting. Great for users familiar with markdown syntax.',
    type: 'feature',
  },
  'preview-mode': {
    id: 'preview-mode',
    title: 'Preview Mode',
    content: 'Preview mode shows how your markdown will look when rendered. Perfect for reviewing your work.',
    type: 'feature',
  },
  'split-mode': {
    id: 'split-mode',
    title: 'Split View',
    content: 'Split mode shows source and preview side-by-side. Edit on the left, see results on the right.',
    type: 'feature',
  },
};

// === TOOLTIP MANAGER CONTEXT ===

interface TooltipManagerContextType {
  settings: TooltipSettings;
  updateSettings: (newSettings: Partial<TooltipSettings>) => void;
  showTooltip: (id: string) => boolean;
  markTooltipSeen: (id: string) => void;
  getTooltipData: (id: string) => TooltipData | undefined;
}

const TooltipManagerContext = React.createContext<TooltipManagerContextType | null>(null);

export const useTooltipManager = () => {
  const context = React.useContext(TooltipManagerContext);
  if (!context) {
    throw new Error('useTooltipManager must be used within a TooltipManagerProvider');
  }
  return context;
};

// === SMART TOOLTIP COMPONENT ===

/**
 * Smart tooltip that adapts to context and user behavior
 */
export const SmartTooltip: React.FC<SmartTooltipProps> = ({
  id,
  title,
  content,
  type = 'info',
  trigger = 'hover',
  position = 'top',
  shortcut,
  showOnFirstUse = true,
  children,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenSeen, setHasBeenSeen] = useState(false);

  // Load seen status from localStorage
  useEffect(() => {
    const seenTooltips = JSON.parse(localStorage.getItem('seen-tooltips') || '[]');
    setHasBeenSeen(seenTooltips.includes(id));
  }, [id]);

  const handleShow = useCallback(() => {
    if (showOnFirstUse && hasBeenSeen) return;
    setIsVisible(true);
  }, [showOnFirstUse, hasBeenSeen]);

  const handleHide = useCallback(() => {
    setIsVisible(false);
    if (!hasBeenSeen) {
      // Mark as seen
      const seenTooltips = JSON.parse(localStorage.getItem('seen-tooltips') || '[]');
      seenTooltips.push(id);
      localStorage.setItem('seen-tooltips', JSON.stringify(seenTooltips));
      setHasBeenSeen(true);
    }
  }, [id, hasBeenSeen]);

  const typeConfig = TOOLTIP_TYPES[type];

  const tooltipContent = (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <div className={`p-1 rounded ${typeConfig.color} text-white`}>
          {typeConfig.icon}
        </div>
        <div>
          <div className="font-medium text-sm">{title}</div>
          <Badge variant="outline" className="text-xs">
            {typeConfig.label}
          </Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {content}
      </p>
      {shortcut && (
        <div className="flex items-center space-x-1 text-xs">
          <Keyboard className="h-3 w-3" />
          <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
            {shortcut}
          </kbd>
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip open={isVisible} onOpenChange={setIsVisible}>
        <TooltipTrigger 
          asChild
          onMouseEnter={trigger === 'hover' ? handleShow : undefined}
          onMouseLeave={trigger === 'hover' ? handleHide : undefined}
          onClick={trigger === 'click' ? () => setIsVisible(!isVisible) : undefined}
          onFocus={trigger === 'focus' ? handleShow : undefined}
          onBlur={trigger === 'focus' ? handleHide : undefined}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent side={position} className={`max-w-xs ${className}`}>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// === CONTEXTUAL HELP POPUP ===

interface ContextualHelpProps {
  tooltipId: string;
  isVisible: boolean;
  onDismiss: () => void;
}

const ContextualHelp: React.FC<ContextualHelpProps> = ({
  tooltipId,
  isVisible,
  onDismiss,
}) => {
  const tooltipData = TOOLTIP_REGISTRY[tooltipId];

  if (!isVisible || !tooltipData) return null;

  const typeConfig = TOOLTIP_TYPES[tooltipData.type];

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-lg border z-50 animate-in slide-in-from-bottom-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded ${typeConfig.color} text-white`}>
              {typeConfig.icon}
            </div>
            <div>
              <CardTitle className="text-sm">{tooltipData.title}</CardTitle>
              <Badge variant="outline" className="text-xs mt-1">
                {typeConfig.label}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {tooltipData.content}
        </p>
        <div className="flex justify-end mt-4">
          <Button size="sm" onClick={onDismiss}>
            Got it
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// === TOOLTIP MANAGER PROVIDER ===

/**
 * Tooltip manager provider component
 */
export const TooltipManagerProvider: React.FC<{
  children: React.ReactNode;
  initialSettings?: Partial<TooltipSettings>;
}> = ({ children, initialSettings }) => {
  const [settings, setSettings] = useState<TooltipSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  const [seenTooltips, setSeenTooltips] = useState<string[]>([]);
  const [contextualHelpVisible, setContextualHelpVisible] = useState<string | null>(null);

  // Load seen tooltips from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('seen-tooltips');
    if (saved) {
      try {
        setSeenTooltips(JSON.parse(saved));
      } catch (error) {
        console.warn('Failed to parse seen tooltips:', error);
      }
    }
  }, []);

  const updateSettings = useCallback((newSettings: Partial<TooltipSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const showTooltip = useCallback((id: string): boolean => {
    if (!settings.enabled) return false;
    
    const tooltipData = TOOLTIP_REGISTRY[id];
    if (!tooltipData) return false;

    // Check type-specific settings
    switch (tooltipData.type) {
      case 'shortcut':
        return settings.showShortcuts;
      case 'tip':
        return settings.showTips;
      case 'feature':
        return settings.showFeatureHighlights;
      case 'info':
      default:
        return true;
    }
  }, [settings]);

  const markTooltipSeen = useCallback((id: string) => {
    if (!seenTooltips.includes(id)) {
      const updated = [...seenTooltips, id];
      setSeenTooltips(updated);
      localStorage.setItem('seen-tooltips', JSON.stringify(updated));
    }
  }, [seenTooltips]);

  const getTooltipData = useCallback((id: string): TooltipData | undefined => {
    return TOOLTIP_REGISTRY[id];
  }, []);

  const contextValue: TooltipManagerContextType = {
    settings,
    updateSettings,
    showTooltip,
    markTooltipSeen,
    getTooltipData,
  };

  return (
    <TooltipManagerContext.Provider value={contextValue}>
      {children}
      <ContextualHelp
        tooltipId={contextualHelpVisible || ''}
        isVisible={!!contextualHelpVisible}
        onDismiss={() => setContextualHelpVisible(null)}
      />
    </TooltipManagerContext.Provider>
  );
};

// === HELPER FUNCTIONS ===

/**
 * Register a new tooltip in the system
 */
export const registerTooltip = (tooltipData: TooltipData) => {
  TOOLTIP_REGISTRY[tooltipData.id] = tooltipData;
};

/**
 * Get all available tooltips
 */
export const getAllTooltips = (): TooltipData[] => {
  return Object.values(TOOLTIP_REGISTRY);
};

/**
 * Reset all seen tooltips (for testing/debugging)
 */
export const resetSeenTooltips = () => {
  localStorage.removeItem('seen-tooltips');
};

// === EXPORTS ===
export default TooltipManagerProvider;
export { TOOLTIP_REGISTRY, TOOLTIP_TYPES };
export type { TooltipData, TooltipSettings, SmartTooltipProps };