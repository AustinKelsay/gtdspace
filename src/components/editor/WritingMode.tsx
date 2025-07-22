/**
 * @fileoverview Distraction-free writing mode component
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Advanced writing experience
 */

import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Settings, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { MarkdownPreview } from './MarkdownPreview';
import type { BaseComponentProps, EditorMode } from '@/types';

export interface WritingModeProps extends BaseComponentProps {
  /** Whether writing mode is active */
  isActive: boolean;
  /** Content to edit */
  content: string;
  /** File name being edited */
  fileName?: string;
  /** Whether there are unsaved changes */
  hasUnsavedChanges?: boolean;
  /** Callback when content changes */
  onChange: (content: string) => void;
  /** Callback when writing mode should exit */
  onExit: () => void;
  /** Callback when save is requested */
  onSave?: () => void;
}

/**
 * Distraction-free writing mode component
 * 
 * Provides a full-screen, minimal editing experience with optional preview
 * and customizable settings for focused writing sessions.
 */
export const WritingMode: React.FC<WritingModeProps> = ({
  isActive,
  content,
  fileName,
  hasUnsavedChanges = false,
  onChange,
  onExit,
  onSave,
  className = '',
  ...props
}) => {
  // === WRITING MODE STATE ===
  
  const [editorMode, setEditorMode] = useState<EditorMode>('source');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showStatusBar] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [typewriterMode] = useState(false);

  // === COMPUTED VALUES ===

  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  const charCount = content.length;
  const charCountNoSpaces = content.replace(/\s/g, '').length;
  const estimatedReadTime = Math.max(1, Math.ceil(wordCount / 200)); // ~200 WPM average reading speed

  // === KEYBOARD SHORTCUTS ===

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // F11 - Toggle fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(prev => !prev);
        return;
      }

      // Escape - Exit writing mode
      if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
        return;
      }

      // Ctrl/Cmd + Enter - Toggle preview
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        setEditorMode(prev => 
          prev === 'source' ? 'split' : 
          prev === 'split' ? 'preview' : 'source'
        );
        return;
      }

      // Ctrl/Cmd + H - Toggle toolbar
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setShowToolbar(prev => !prev);
        return;
      }

      // Ctrl/Cmd + S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Ctrl/Cmd + D - Toggle focus mode
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        setFocusMode(prev => !prev);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onExit, onSave]);

  // === FULLSCREEN EFFECTS ===

  useEffect(() => {
    if (isActive && isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.();
    }
  }, [isActive, isFullscreen]);

  // Clean up fullscreen on unmount or exit
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    };
  }, []);

  // === EVENT HANDLERS ===

  const handleTogglePreview = () => {
    setEditorMode(prev => 
      prev === 'source' ? 'split' : 
      prev === 'split' ? 'preview' : 'source'
    );
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  // === RENDER ===

  if (!isActive) {
    return null;
  }

  return (
    <div 
      className={`
        fixed inset-0 z-50 bg-background
        ${focusMode ? 'bg-gray-50 dark:bg-gray-900' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Toolbar */}
      {showToolbar && (
        <div className={`
          border-b border-border bg-muted/30 px-4 py-2 flex items-center justify-between
          ${focusMode ? 'opacity-20 hover:opacity-100 transition-opacity' : ''}
        `}>
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-lg">
              {fileName ? fileName.replace(/\.(md|markdown)$/i, '') : 'Writing Mode'}
              {hasUnsavedChanges && <span className="text-orange-500 ml-1">•</span>}
            </h2>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTogglePreview}
                title="Toggle Preview (Ctrl+Enter)"
              >
                {editorMode === 'source' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleFullscreen}
                title="Toggle Fullscreen (F11)"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFocusMode(prev => !prev)}
                title="Toggle Focus Mode (Ctrl+D)"
                className={focusMode ? 'bg-accent' : ''}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {onSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSave}
                title="Save (Ctrl+S)"
              >
                Save
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              title="Exit Writing Mode (Escape)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden" style={{ height: showToolbar ? 'calc(100vh - 60px)' : '100vh' }}>
        {editorMode === 'source' && (
          <div className="h-full">
            <CodeMirrorEditor
              content={content}
              onChange={onChange}
              showLineNumbers={!focusMode}
              className={`
                h-full border-none
                ${focusMode ? 'max-w-4xl mx-auto px-8' : ''}
                ${typewriterMode ? 'typewriter-mode' : ''}
              `}
            />
          </div>
        )}

        {editorMode === 'split' && (
          <div className="h-full flex">
            <div className="w-1/2 border-r border-border">
              <CodeMirrorEditor
                content={content}
                onChange={onChange}
                showLineNumbers={!focusMode}
                className="h-full border-none"
              />
            </div>
            <div className="w-1/2 overflow-auto">
              <div className={`p-8 ${focusMode ? 'max-w-none' : 'max-w-4xl mx-auto'}`}>
                <MarkdownPreview content={content} />
              </div>
            </div>
          </div>
        )}

        {editorMode === 'preview' && (
          <div className="h-full overflow-auto">
            <div className={`p-8 ${focusMode ? 'max-w-4xl mx-auto' : 'max-w-5xl mx-auto'}`}>
              <MarkdownPreview content={content} />
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {showStatusBar && (
        <div className={`
          border-t border-border bg-muted/30 px-4 py-1 text-xs text-muted-foreground 
          flex items-center justify-between
          ${focusMode ? 'opacity-20 hover:opacity-100 transition-opacity' : ''}
        `}>
          <div className="flex items-center gap-4">
            <span>{wordCount} words</span>
            <span>{charCount} characters</span>
            <span>{charCountNoSpaces} (no spaces)</span>
            <span>~{estimatedReadTime} min read</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span>Mode: {editorMode}</span>
            {focusMode && <span>Focus Mode</span>}
            {isFullscreen && <span>Fullscreen</span>}
            <span>Press Esc to exit</span>
          </div>
        </div>
      )}

      {/* Floating Mini Toolbar (Focus Mode) */}
      {focusMode && !showToolbar && (
        <div className="absolute top-4 right-4 opacity-20 hover:opacity-100 transition-opacity">
          <Card className="flex items-center gap-1 p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTogglePreview}
              title="Toggle Preview"
            >
              {editorMode === 'source' ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onExit}
              title="Exit Writing Mode"
            >
              <X className="h-3 w-3" />
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WritingMode;