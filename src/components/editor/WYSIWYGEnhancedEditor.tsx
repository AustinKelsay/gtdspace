/**
 * @fileoverview Enhanced text editor with WYSIWYG support for Phase 3
 * @author Development Team
 * @created 2024-01-XX
 * @updated 2024-01-XX
 * @phase 3 - Advanced WYSIWYG editing with rich text capabilities
 */

// === IMPORTS ===
// External library imports
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Settings, Code } from 'lucide-react';

// Internal imports
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MarkdownPreview } from './MarkdownPreview';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { WYSIWYGEditor, type WYSIWYGEditorRef } from '@/components/wysiwyg/WYSIWYGEditor';
import { EditorModeToggle } from '@/components/wysiwyg/EditorModeToggle';
import type { EditorMode } from '@/components/wysiwyg/EditorModeToggle';
import { MathDiagramToolbar } from './MathDiagramToolbar';
import type { TextEditorProps } from '@/types';
import { cn } from '@/lib/utils';

// === TYPES ===
/**
 * Extended props for WYSIWYG-enabled editor
 */
export interface WYSIWYGEnhancedEditorProps extends TextEditorProps {
  /** Whether to enable WYSIWYG features */
  enableWYSIWYG?: boolean;
  /** Initial mode for the editor */
  initialMode?: EditorMode;
  /** Callback when editor mode changes */
  onModeChange?: (mode: EditorMode) => void;
  /** Whether to show the enhanced toolbar */
  showToolbar?: boolean;
  /** Whether to show status bar */
  showStatusBar?: boolean;
}

// === CONSTANTS ===
/**
 * Available modes for the enhanced editor
 */
const AVAILABLE_MODES: EditorMode[] = ['wysiwyg', 'source', 'preview', 'split'];

// === MAIN COMPONENT ===
/**
 * Enhanced text editor with WYSIWYG support for Phase 3
 * 
 * Provides advanced editing capabilities including:
 * - WYSIWYG rich text editing using Tiptap
 * - Traditional source mode with CodeMirror
 * - Split view with synchronized editing and preview
 * - Seamless mode switching with content preservation
 * - Advanced formatting tools and shortcuts
 * 
 * @param props - Component props
 * @returns Enhanced editor JSX element with WYSIWYG support
 * 
 * @example
 * ```tsx
 * <WYSIWYGEnhancedEditor
 *   content={markdownContent}
 *   onChange={setContent}
 *   initialMode="wysiwyg"
 *   enableWYSIWYG={true}
 *   onModeChange={handleModeChange}
 * />
 * ```
 */
export const WYSIWYGEnhancedEditor: React.FC<WYSIWYGEnhancedEditorProps> = ({
  content,
  onChange,
  mode = 'wysiwyg',
  showLineNumbers = true,
  readOnly = false,
  autoFocus = false,
  className = '',
  enableWYSIWYG = true,
  initialMode = 'wysiwyg',
  onModeChange,
  showToolbar = true,
  showStatusBar = true,
  ...props
}) => {
  // === LOCAL STATE ===
  const [currentMode, setCurrentMode] = useState<EditorMode>(enableWYSIWYG ? initialMode : 'source');
  const [useAdvancedEditor, setUseAdvancedEditor] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [wysiwygEditor, setWysiwygEditor] = useState<any>(null);
  
  // Editor refs for imperative control
  const wysiwygRef = useRef<WYSIWYGEditorRef>(null);
  
  // === EFFECTS ===
  
  /**
   * Detect system theme changes
   */
  useEffect(() => {
    const handleThemeChange = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    handleThemeChange();

    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  /**
   * Update mode when prop changes
   */
  useEffect(() => {
    if (mode !== currentMode) {
      setCurrentMode(enableWYSIWYG ? mode : 'source');
    }
  }, [mode, enableWYSIWYG, currentMode]);

  /**
   * Handle initialization
   */
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // === MODE HANDLING ===
  
  /**
   * Handle mode changes with content synchronization
   */
  const handleModeChange = useCallback((newMode: EditorMode) => {
    // Don't allow WYSIWYG mode if disabled
    if (!enableWYSIWYG && newMode === 'wysiwyg') {
      return;
    }

    setCurrentMode(newMode);
    onModeChange?.(newMode);
  }, [enableWYSIWYG, onModeChange]);

  /**
   * Toggle between simple and advanced source editor
   */
  const toggleAdvancedEditor = useCallback(() => {
    setUseAdvancedEditor(prev => !prev);
  }, []);

  // === CONTENT HANDLERS ===
  
  /**
   * Handle content changes from WYSIWYG editor
   */
  const handleWYSIWYGChange = useCallback((markdown: string) => {
    onChange(markdown);
  }, [onChange]);

  /**
   * Handle content changes from source editor
   */
  const handleSourceChange = useCallback((newContent: string) => {
    onChange(newContent);
  }, [onChange]);

  // === RENDER METHODS ===
  
  /**
   * Render the enhanced toolbar with mode toggle
   */
  const renderToolbar = () => {
    if (!showToolbar) return null;

    const availableModes: EditorMode[] = enableWYSIWYG ? AVAILABLE_MODES : ['source', 'preview', 'split'];

    return (
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        {/* Mode Toggle */}
        <div className="flex items-center space-x-2">
          <EditorModeToggle
            currentMode={currentMode}
            onModeChange={handleModeChange}
            availableModes={availableModes}
            showLabels={false}
            size="sm"
          />
          
          {/* Math & Diagram Toolbar (only for WYSIWYG mode) */}
          {currentMode === 'wysiwyg' && wysiwygEditor && (
            <MathDiagramToolbar
              editor={wysiwygEditor}
              compact={true}
              className="ml-2 pl-2 border-l"
            />
          )}
        </div>

        {/* Editor Options */}
        <div className="flex items-center space-x-2">
          {/* Advanced Editor Toggle (only for source mode) */}
          {currentMode === 'source' && (
            <Button
              variant={useAdvancedEditor ? 'default' : 'ghost'}
              size="sm"
              onClick={toggleAdvancedEditor}
              title={`Switch to ${useAdvancedEditor ? 'simple' : 'advanced'} editor`}
              className="text-xs"
            >
              <Code className="h-3 w-3 mr-1" />
              {useAdvancedEditor ? 'Advanced' : 'Simple'}
            </Button>
          )}

          {/* Settings (placeholder for future enhancement) */}
          <Button
            variant="ghost"
            size="sm"
            title="Editor settings"
            className="text-xs"
            disabled
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  /**
   * Render the source editor (CodeMirror or textarea)
   */
  const renderSourceEditor = () => {
    if (useAdvancedEditor) {
      return (
        <CodeMirrorEditor
          content={content}
          onChange={handleSourceChange}
          darkMode={isDarkMode}
          readOnly={readOnly}
          autoFocus={autoFocus && currentMode === 'source'}
          showLineNumbers={showLineNumbers}
          fontSize={14}
          tabSize={2}
          lineWrapping={true}
          className="h-full"
          placeholder="Start writing your markdown here..."
        />
      );
    }

    // Fallback to simple textarea
    return (
      <textarea
        value={content}
        onChange={(e) => handleSourceChange(e.target.value)}
        readOnly={readOnly}
        autoFocus={autoFocus && currentMode === 'source'}
        placeholder="Start writing your markdown here..."
        className="w-full h-full resize-none border-none outline-none bg-transparent p-4 font-mono text-sm"
        style={{ minHeight: '400px' }}
      />
    );
  };

  /**
   * Render the WYSIWYG editor
   */
  const renderWYSIWYGEditor = () => {
    if (!enableWYSIWYG) return null;

    return (
      <WYSIWYGEditor
        ref={wysiwygRef}
        initialContent={content}
        onChange={handleWYSIWYGChange}
        onEditorCreate={setWysiwygEditor}
        editable={!readOnly}
        autoFocus={autoFocus && currentMode === 'wysiwyg'}
        placeholder="Start writing..."
        className="h-full"
      />
    );
  };

  /**
   * Render the preview component
   */
  const renderPreview = () => (
    <MarkdownPreview 
      content={content}
      className="h-full overflow-auto"
    />
  );

  /**
   * Render the status bar with statistics
   */
  const renderStatusBar = () => {
    if (!showStatusBar) return null;

    const words = content.split(/\s+/).filter(word => word.length > 0);
    const readingTime = Math.ceil(words.length / 200); // Assume 200 words per minute

    return (
      <div className="p-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-4">
          <span>{content.length} characters</span>
          <span>{content.split('\n').length} lines</span>
          <span>{words.length} words</span>
          <span>~{readingTime} min read</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>Mode: {currentMode}</span>
          {currentMode === 'source' && (
            <span>Editor: {useAdvancedEditor ? 'CodeMirror' : 'Simple'}</span>
          )}
        </div>
      </div>
    );
  };

  // === MAIN LAYOUT ===
  
  if (!isInitialized) {
    return (
      <Card className={cn('flex items-center justify-center h-64', className)}>
        <div className="text-sm text-muted-foreground">Initializing editor...</div>
      </Card>
    );
  }

  return (
    <Card className={cn('flex flex-col h-full', className)} {...props}>
      {/* Toolbar */}
      {renderToolbar()}

      {/* Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* WYSIWYG Editor */}
        {currentMode === 'wysiwyg' && (
          <div className="w-full flex flex-col">
            <div className="flex-1 min-h-0">
              {renderWYSIWYGEditor()}
            </div>
          </div>
        )}

        {/* Source Editor */}
        {(currentMode === 'source' || currentMode === 'split') && (
          <div className={cn(
            'flex flex-col',
            currentMode === 'split' ? 'w-1/2 border-r border-border' : 'w-full'
          )}>
            {currentMode === 'split' && (
              <div className="p-2 border-b border-border bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground">EDITOR</span>
              </div>
            )}
            <div className="flex-1 min-h-0">
              {renderSourceEditor()}
            </div>
          </div>
        )}

        {/* Preview */}
        {(currentMode === 'preview' || currentMode === 'split') && (
          <div className={cn(
            'flex flex-col',
            currentMode === 'split' ? 'w-1/2' : 'w-full'
          )}>
            {currentMode === 'split' && (
              <div className="p-2 border-b border-border bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground">PREVIEW</span>
              </div>
            )}
            <div className="flex-1 min-h-0">
              {renderPreview()}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {renderStatusBar()}
    </Card>
  );
};

// === EXPORTS ===
export default WYSIWYGEnhancedEditor;