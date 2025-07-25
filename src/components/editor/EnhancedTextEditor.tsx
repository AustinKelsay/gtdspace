/**
 * @fileoverview Enhanced text editor component for Phase 2
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Advanced editor with CodeMirror integration and synchronized preview
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Eye, Edit3, Columns2, Settings, Code, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MarkdownPreview } from './MarkdownPreview';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { 
  DocumentStatsLazy
} from '@/components/lazy';
import type { TextEditorProps, EditorMode } from '@/types';

/**
 * Enhanced text editor component for Phase 2
 * 
 * Provides advanced editing capabilities with CodeMirror integration,
 * synchronized preview, markdown shortcuts, and improved workflow.
 * Supports switching between simple textarea and advanced CodeMirror.
 * 
 * @param props - Component props
 * @returns Enhanced text editor JSX element
 */
export const EnhancedTextEditor: React.FC<TextEditorProps> = ({
  content,
  onChange,
  mode = 'source',
  showLineNumbers = true,
  readOnly = false,
  autoFocus = false,
  className = '',
  ...props
}) => {
  // === LOCAL STATE ===
  
  const [currentMode, setCurrentMode] = useState<EditorMode>(mode);
  const [useAdvancedEditor, setUseAdvancedEditor] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showNavigation, setShowNavigation] = useState(false);

  // === EFFECTS ===
  
  /**
   * Detect system theme
   */
  useEffect(() => {
    const handleThemeChange = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    // Initial detection
    handleThemeChange();

    // Listen for theme changes
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  /**
   * Update mode when prop changes
   */
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // === MODE SWITCHER ===
  
  const handleModeChange = useCallback((newMode: EditorMode) => {
    setCurrentMode(newMode);
  }, []);

  const toggleAdvancedEditor = useCallback(() => {
    setUseAdvancedEditor(prev => !prev);
  }, []);

  /**
   * Toggle navigation panel
   */
  const toggleNavigation = useCallback(() => {
    setShowNavigation(prev => !prev);
  }, []);


  // === TOOLBAR ===
  
  const renderToolbar = () => (
    <div className="flex items-center justify-between p-2 border-b bg-muted">
      {/* Mode Switcher */}
      <div className="flex items-center space-x-1">
        <Button
          variant={currentMode === 'source' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('source')}
          className="text-xs"
        >
          <Edit3 className="h-3 w-3 mr-1" />
          Edit
        </Button>
        <Button
          variant={currentMode === 'preview' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('preview')}
          className="text-xs"
        >
          <Eye className="h-3 w-3 mr-1" />
          Preview
        </Button>
        <Button
          variant={currentMode === 'split' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('split')}
          className="text-xs"
        >
          <Columns2 className="h-3 w-3 mr-1" />
          Split
        </Button>
      </div>

      {/* Editor Options */}
      <div className="flex items-center space-x-2">
        {/* Advanced Editor Toggle */}
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

        {/* Navigation Toggle */}
        <Button
          variant={showNavigation ? 'default' : 'ghost'}
          size="sm"
          onClick={toggleNavigation}
          title="Toggle navigation panel"
          className="text-xs"
        >
          <Navigation className="h-3 w-3 mr-1" />
          Nav
        </Button>


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

  // === EDITOR COMPONENT ===
  
  const renderEditor = () => {
    if (useAdvancedEditor) {
      return (
        <CodeMirrorEditor
          content={content}
          onChange={onChange}
          darkMode={isDarkMode}
          readOnly={readOnly}
          autoFocus={autoFocus}
          showLineNumbers={showLineNumbers}
          fontSize={14}
          tabSize={2}
          lineWrapping={true}
          className="h-full"
          placeholder="Start writing your markdown here..."
          onFocus={() => {}}
          onBlur={() => {}}
        />
      );
    }

    // Fallback to simple textarea
    return (
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        autoFocus={autoFocus}
        placeholder="Start writing your markdown here..."
        className="w-full h-full resize-none border-none outline-none bg-transparent p-4 font-mono text-sm"
        style={{ minHeight: '400px' }}
      />
    );
  };

  // === NAVIGATION PANEL ===
  
  const renderNavigationPanel = () => {
    if (!showNavigation) return null;

    return (
      <div className="w-80 border-l border-border bg-card flex flex-col">
        {/* Navigation Header */}
        <div className="p-2 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">DOCUMENT STATISTICS</span>
          </div>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 min-h-0">
          <DocumentStatsLazy
            content={content}
            showDetailed={true}
            showAnalytics={true}
            compact={false}
          />
        </div>
      </div>
    );
  };

  // === MAIN LAYOUT ===
  
  return (
    <Card className={`flex flex-col h-full ${className}`} {...props}>
      {/* Toolbar */}
      {renderToolbar()}

      {/* Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Main Editor Area */}
        <div className="flex-1 flex min-h-0">
        {/* Source Editor */}
        {(currentMode === 'source' || currentMode === 'split') && (
          <div className={`${currentMode === 'split' ? 'w-1/2 border-r border-border' : 'w-full'} flex flex-col`}>
            {currentMode === 'split' && (
              <div className="p-2 border-b border-border bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground">EDITOR</span>
              </div>
            )}
            <div className="flex-1 min-h-0">
              {renderEditor()}
            </div>
          </div>
        )}

        {/* Preview */}
        {(currentMode === 'preview' || currentMode === 'split') && (
          <div className={`${currentMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col`}>
            {currentMode === 'split' && (
              <div className="p-2 border-b border-border bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground">PREVIEW</span>
              </div>
            )}
            <div className="flex-1 min-h-0">
              <MarkdownPreview 
                content={content}
                className="h-full overflow-auto"
              />
            </div>
          </div>
        )}
        </div>
        
        {/* Navigation Panel */}
        {renderNavigationPanel()}
      </div>


      {/* Status Bar */}
      <div className="p-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-4">
          <span>{content.length} characters</span>
          <span>{content.split('\n').length} lines</span>
          <span>{content.split(/\s+/).filter(word => word.length > 0).length} words</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>Mode: {currentMode}</span>
          <span>Editor: {useAdvancedEditor ? 'CodeMirror' : 'Simple'}</span>
        </div>
      </div>
    </Card>
  );
};

export default EnhancedTextEditor;