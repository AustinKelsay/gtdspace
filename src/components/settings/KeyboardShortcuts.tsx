/**
 * @fileoverview Keyboard shortcuts settings component
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Keyboard shortcuts UI
 */

import React from 'react';
import { Keyboard, Command } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { BaseComponentProps } from '@/types';

interface ShortcutCategory {
  name: string;
  shortcuts: {
    keys: string[];
    description: string;
    implemented: boolean;
  }[];
}

/**
 * Keyboard shortcuts component for displaying all available shortcuts
 */
export const KeyboardShortcuts: React.FC<BaseComponentProps> = ({ className = '', ...props }) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcutCategories: ShortcutCategory[] = [
    {
      name: 'File Operations',
      shortcuts: [
        { keys: [modKey, 'O'], description: 'Open folder', implemented: true },
        { keys: [modKey, 'S'], description: 'Save current file', implemented: true },
        { keys: [modKey, 'Shift', 'S'], description: 'Save all files', implemented: true },
        { keys: [modKey, 'W'], description: 'Close current tab', implemented: true },
        { keys: [modKey, 'Shift', 'W'], description: 'Close all tabs', implemented: false },
        { keys: [modKey, 'N'], description: 'Create new file', implemented: false },
        { keys: [modKey, 'Shift', 'T'], description: 'Reopen closed tab', implemented: false },
      ],
    },
    {
      name: 'Navigation',
      shortcuts: [
        { keys: [modKey, 'Tab'], description: 'Next tab', implemented: true },
        { keys: [modKey, 'Shift', 'Tab'], description: 'Previous tab', implemented: true },
        { keys: [modKey, '1-9'], description: 'Jump to tab by number', implemented: true },
        { keys: [modKey, 'P'], description: 'Quick file switcher', implemented: false },
        { keys: [modKey, 'Shift', 'P'], description: 'Command palette', implemented: false },
      ],
    },
    {
      name: 'Search',
      shortcuts: [
        { keys: [modKey, 'F'], description: 'Find in file', implemented: true },
        { keys: [modKey, 'H'], description: 'Replace in file', implemented: true },
        { keys: [modKey, 'Shift', 'F'], description: 'Find in all files', implemented: false },
        { keys: [modKey, 'Shift', 'H'], description: 'Replace in all files', implemented: false },
      ],
    },
    {
      name: 'Editor',
      shortcuts: [
        { keys: [modKey, 'B'], description: 'Bold text', implemented: false },
        { keys: [modKey, 'I'], description: 'Italic text', implemented: false },
        { keys: [modKey, 'K'], description: 'Insert link', implemented: false },
        { keys: [modKey, 'Shift', 'M'], description: 'Toggle preview mode', implemented: false },
        { keys: ['F11'], description: 'Toggle distraction-free mode', implemented: false },
      ],
    },
    {
      name: 'View',
      shortcuts: [
        { keys: [modKey, '`'], description: 'Toggle sidebar', implemented: false },
        { keys: [modKey, 'Shift', '`'], description: 'Toggle search panel', implemented: false },
        { keys: [modKey, '+'], description: 'Increase font size', implemented: false },
        { keys: [modKey, '-'], description: 'Decrease font size', implemented: false },
      ],
    },
  ];

  return (
    <div className={`p-6 space-y-6 ${className}`} {...props}>
      <div>
        <h3 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h3>
        
        <div className="mb-4 p-3 bg-muted/50 rounded-md flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Keyboard shortcuts help you work faster. Learn these shortcuts to improve your productivity.
          </p>
        </div>

        {shortcutCategories.map((category) => (
          <Card key={category.name} className="p-4 mb-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Command className="h-4 w-4 text-muted-foreground" />
              {category.name}
            </h4>
            <div className="space-y-2">
              {category.shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between py-1.5 px-2 rounded ${
                    shortcut.implemented ? '' : 'opacity-50'
                  }`}
                >
                  <span className="text-sm">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <React.Fragment key={keyIndex}>
                        {keyIndex > 0 && <span className="text-muted-foreground mx-1">+</span>}
                        <kbd className="px-2 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded">
                          {key}
                        </kbd>
                      </React.Fragment>
                    ))}
                    {!shortcut.implemented && (
                      <span className="ml-2 text-xs text-muted-foreground">(Coming soon)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}

        <div className="mt-6 p-4 bg-muted/30 rounded-md">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Keyboard shortcuts cannot be customized yet. This feature is planned for a future update.
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcuts;