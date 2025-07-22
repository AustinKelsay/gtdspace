/**
 * @fileoverview Editor settings component
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Editor settings UI
 */

import React from 'react';
import { Moon, Sun, Monitor, Type, AlignLeft, Palette } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSettings } from '@/hooks/useSettings';
import type { Theme, EditorMode } from '@/types';

/**
 * Editor settings component for customizing editor preferences
 */
export const EditorSettings: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  const themes: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'auto', label: 'System', icon: Monitor },
  ];

  const editorModes: { value: EditorMode; label: string }[] = [
    { value: 'source', label: 'Source Only' },
    { value: 'preview', label: 'Preview Only' },
    { value: 'split', label: 'Split View' },
  ];

  const fontSizes = [12, 13, 14, 15, 16, 18, 20];
  const tabSizes = [2, 4];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Editor Settings</h3>
        
        {/* Theme Selection */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-medium">Theme</Label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={settings.theme === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSettings({ theme: value })}
                className="justify-start"
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </Button>
            ))}
          </div>
        </Card>

        {/* Editor Mode */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlignLeft className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-medium">Default Editor Mode</Label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {editorModes.map(({ value, label }) => (
              <Button
                key={value}
                variant={settings.editor_mode === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSettings({ editor_mode: value })}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>

        {/* Font Settings */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Type className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-medium">Font Settings</Label>
          </div>
          
          {/* Font Size */}
          <div className="mb-4">
            <Label className="text-sm text-muted-foreground mb-2 block">Font Size</Label>
            <div className="flex gap-2 flex-wrap">
              {fontSizes.map((size) => (
                <Button
                  key={size}
                  variant={settings.font_size === size ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSettings({ font_size: size })}
                  className="w-12"
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>

          {/* Tab Size */}
          <div className="mb-4">
            <Label className="text-sm text-muted-foreground mb-2 block">Tab Size</Label>
            <div className="flex gap-2">
              {tabSizes.map((size) => (
                <Button
                  key={size}
                  variant={settings.tab_size === size ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSettings({ tab_size: size })}
                  className="w-16"
                >
                  {size} spaces
                </Button>
              ))}
            </div>
          </div>

          {/* Word Wrap */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Word Wrap</Label>
            <div className="flex gap-2">
              <Button
                variant={settings.word_wrap ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSettings({ word_wrap: true })}
              >
                On
              </Button>
              <Button
                variant={!settings.word_wrap ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSettings({ word_wrap: false })}
              >
                Off
              </Button>
            </div>
          </div>
        </Card>

        {/* Preview */}
        <Card className="p-4 bg-muted/30">
          <Label className="text-sm text-muted-foreground mb-2 block">Preview</Label>
          <div 
            className="bg-background border rounded p-3 font-mono text-sm"
            style={{ fontSize: `${settings.font_size}px` }}
          >
            <div className="text-muted-foreground"># Sample Markdown</div>
            <div>
              {settings.word_wrap ? (
                <span>This is a long line of text that will wrap when word wrap is enabled, demonstrating how your text will appear in the editor.</span>
              ) : (
                <span>This is a long line of text that won't wrap when word wrap is disabled.</span>
              )}
            </div>
            <div className="mt-2">
              <span style={{ marginLeft: `${settings.tab_size * 0.5}rem` }}>Indented with {settings.tab_size} spaces</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EditorSettings;