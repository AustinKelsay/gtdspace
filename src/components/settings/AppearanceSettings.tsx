/**
 * @fileoverview Appearance settings component for theme preferences
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import { 
  Moon, 
  Sun, 
  Monitor, 
  Palette
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useSettings } from '@/hooks/useSettings';
import type { Theme } from '@/types';

/**
 * Appearance settings component - simplified to only include working features
 */
export const AppearanceSettings: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  
  // Apply theme immediately when changed
  const handleThemeChange = React.useCallback((value: string) => {
    const newTheme = value as Theme;
    console.log('[AppearanceSettings] Changing theme from', settings.theme, 'to', newTheme);
    
    // Apply theme immediately to document
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    
    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else if (newTheme === 'light') {
      root.classList.add('light');
      root.style.colorScheme = 'light';
    } else {
      // Auto theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.add('light');
        root.style.colorScheme = 'light';
      }
    }
    
    // Update settings
    updateSettings({ theme: newTheme });
  }, [settings.theme, updateSettings]);

  const themes: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
    { value: 'light', label: 'Light', icon: Sun, description: 'Bright theme for daytime use' },
    { value: 'dark', label: 'Dark', icon: Moon, description: 'Dark theme for reduced eye strain' },
    { value: 'auto', label: 'System', icon: Monitor, description: 'Follow system preference' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Appearance</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Customize the visual appearance of GTD Space
        </p>
        
        {/* Theme Selection - The only appearance setting that actually works */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold">Theme</Label>
          </div>
          <RadioGroup 
            value={settings.theme} 
            onValueChange={handleThemeChange}
            className="space-y-3"
          >
            {themes.map(({ value, label, icon: Icon, description }) => (
              <div key={value} className="flex items-start space-x-3">
                <RadioGroupItem value={value} id={value} className="mt-1" />
                <label
                  htmlFor={value}
                  className="flex-1 cursor-pointer space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </label>
              </div>
            ))}
          </RadioGroup>
        </Card>

        {/* Preview */}
        <Card className="p-6 bg-muted/30 mt-6">
          <Label className="text-sm text-muted-foreground mb-3 block">Preview</Label>
          <div className="space-y-3">
            <div className="bg-background border rounded-lg p-4">
              <h4 className="font-semibold mb-2">Sample Content</h4>
              <p className="text-sm text-muted-foreground mb-3">
                This preview shows how content will appear with your selected theme.
              </p>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm">
                  Primary Button
                </button>
                <button className="px-3 py-1 border border-input bg-background rounded-md text-sm">
                  Secondary Button
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Theme changes are applied immediately across the application
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AppearanceSettings;