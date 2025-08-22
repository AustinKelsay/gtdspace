/**
 * @fileoverview Enhanced text editor component for Phase 2
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Block-based WYSIWYG editor with BlockNote
 */

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { BlockNoteEditor } from './BlockNoteEditor';
import type { TextEditorProps } from '@/types';

/**
 * Enhanced text editor component for Phase 2
 * 
 * Provides a Notion-like block-based WYSIWYG editing experience
 * using BlockNote for rich text editing and markdown support.
 * 
 * @param props - Component props
 * @returns Enhanced text editor JSX element
 */
export const EnhancedTextEditor: React.FC<TextEditorProps> = ({
  content,
  onChange,
  readOnly = false,
  autoFocus = false,
  className = '',
  filePath,
}) => {
  // === LOCAL STATE ===

  const [isDarkMode, setIsDarkMode] = useState(false);

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

  // === MAIN LAYOUT ===

  return (
    <Card className={`flex flex-col h-full ${className}`}>
      {/* BlockNote Editor */}
      <div className="flex-1 overflow-y-auto overflow-x-visible">
        <BlockNoteEditor
          content={content}
          onChange={onChange}
          darkMode={isDarkMode}
          readOnly={readOnly}
          autoFocus={autoFocus}
          filePath={filePath}
        />
      </div>

      {/* Simple Status Bar */}
      <div className="p-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-4">
          <span>{content.length} characters</span>
          <span>{content.split(/\s+/).filter(word => word.length > 0).length} words</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>WYSIWYG Editor</span>
        </div>
      </div>
    </Card>
  );
};

export default EnhancedTextEditor;