/**
 * @fileoverview Enhanced text editor component for Phase 2
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Block-based WYSIWYG editor with BlockNote
 */

import React from 'react';
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
export const EnhancedTextEditor: React.FC<TextEditorProps & { frame?: 'card' | 'bare'; showStatusBar?: boolean }> = ({
  content,
  onChange,
  readOnly = false,
  autoFocus = false,
  className = '',
  filePath,
  frame = 'card',
  showStatusBar = true,
}) => {
  // === LOCAL STATE ===

  // === MAIN LAYOUT ===

  const EditorShell = frame === 'card' ? Card : 'div';
  return (
    <EditorShell className={`flex flex-col h-full ${frame === 'card' ? '' : ''} ${className}`}>
      {/* BlockNote Editor */}
      <div className={`flex-1 overflow-y-auto overflow-x-visible ${frame === 'bare' ? '' : ''}`}>
        <BlockNoteEditor
          content={content}
          onChange={onChange}
          readOnly={readOnly}
          autoFocus={autoFocus}
          filePath={filePath}
        />
      </div>

      {showStatusBar && (
        <div className="p-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>{content.length} characters</span>
            <span>{content.split(/\s+/).filter(word => word.length > 0).length} words</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>WYSIWYG Editor</span>
          </div>
        </div>
      )}
    </EditorShell>
  );
};

export default EnhancedTextEditor;
