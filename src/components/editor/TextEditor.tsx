/**
 * @fileoverview Basic text editor component for Phase 1 markdown editing
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - Simple textarea-based editor with markdown preview
 */

import React, { useEffect, useRef, useState } from 'react';
import { Eye, Edit3, Columns2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MarkdownPreview } from './MarkdownPreview';
import type { TextEditorProps, EditorMode } from '@/types';

/**
 * Basic text editor component for Phase 1
 * 
 * Provides a simple textarea-based editor with markdown preview functionality.
 * Supports three modes: source (editing only), preview (preview only), and 
 * split (side-by-side editing and preview).
 * 
 * @param props - Component props
 * @returns Text editor JSX element
 * 
 * @example
 * ```tsx
 * <TextEditor 
 *   content="# My Document\n\nContent here..."
 *   onChange={(content) => setFileContent(content)}
 *   mode="split"
 *   showLineNumbers={true}
 *   autoFocus={true}
 * />
 * ```
 */
export const TextEditor: React.FC<TextEditorProps> = ({
  content,
  onChange,
  mode = 'source',
  showLineNumbers = false,
  readOnly = false,
  autoFocus = false,
  className = '',
  ...props
}) => {
  // === REFS ===
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // === LOCAL STATE ===
  
  const [currentMode, setCurrentMode] = useState<EditorMode>(mode);

  // === EFFECTS ===
  
  /**
   * Auto-focus textarea when enabled
   */
  useEffect(() => {
    if (autoFocus && textareaRef.current && currentMode !== 'preview') {
      textareaRef.current.focus();
    }
  }, [autoFocus, currentMode]);

  /**
   * Update mode when prop changes
   */
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // === EVENT HANDLERS ===
  
  /**
   * Handle textarea content change
   */
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!readOnly) {
      onChange(event.target.value);
    }
  };

  /**
   * Handle tab key in textarea for proper indentation
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      
      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // Insert tab character
      const newValue = content.substring(0, start) + '\t' + content.substring(end);
      onChange(newValue);
      
      // Restore cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      });
    }
  };

  /**
   * Toggle editor mode
   */
  const toggleMode = (newMode: EditorMode) => {
    setCurrentMode(newMode);
  };

  // === RENDER HELPERS ===
  
  /**
   * Get line numbers for display
   */
  const getLineNumbers = (): number[] => {
    const lines = content.split('\n');
    return Array.from({ length: lines.length }, (_, i) => i + 1);
  };

  /**
   * Render mode toggle toolbar
   */
  const renderToolbar = () => (
    <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
      <div className="flex items-center space-x-1">
        <Button
          variant={currentMode === 'source' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => toggleMode('source')}
          disabled={readOnly}
          aria-label="Source mode"
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Edit
        </Button>
        <Button
          variant={currentMode === 'preview' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => toggleMode('preview')}
          aria-label="Preview mode"
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <Button
          variant={currentMode === 'split' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => toggleMode('split')}
          aria-label="Split mode"
        >
          <Columns2 className="h-4 w-4 mr-2" />
          Split
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground">
        {content.length} characters
      </div>
    </div>
  );

  /**
   * Render the editor textarea
   */
  const renderEditor = (className?: string) => (
    <div className={`relative flex-1 ${className || ''}`}>
      {showLineNumbers && (
        <div className="absolute left-0 top-0 z-10 p-4 text-xs text-muted-foreground font-mono select-none pointer-events-none border-r border-border bg-muted/20">
          {getLineNumbers().map(num => (
            <div key={num} className="leading-6">
              {num}
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={`
          w-full h-full resize-none border-none bg-transparent p-4 text-sm font-mono
          focus:outline-none focus:ring-0
          ${showLineNumbers ? 'pl-12' : ''}
          ${readOnly ? 'cursor-default' : 'cursor-text'}
        `}
        placeholder={readOnly ? '' : 'Start writing your markdown...'}
        readOnly={readOnly}
        spellCheck={false}
        aria-label="Markdown editor"
      />
    </div>
  );

  /**
   * Render the preview panel
   */
  const renderPreview = (className?: string) => (
    <div className={`flex-1 ${className || ''}`}>
      <MarkdownPreview content={content} />
    </div>
  );

  // === MAIN RENDER ===

  return (
    <Card className={`flex flex-col h-full ${className}`} {...props}>
      {renderToolbar()}
      
      <div className="flex-1 min-h-0 flex">
        {currentMode === 'source' && renderEditor()}
        
        {currentMode === 'preview' && renderPreview()}
        
        {currentMode === 'split' && (
          <>
            {renderEditor('border-r border-border')}
            {renderPreview()}
          </>
        )}
      </div>
    </Card>
  );
};

export default TextEditor;