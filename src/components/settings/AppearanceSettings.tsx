/**
 * @fileoverview Appearance settings component - dark mode only
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import {
  Moon,
  Palette
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

/**
 * Appearance settings component - dark mode is the only theme
 */
export const AppearanceSettings: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Appearance</h3>
        <p className="text-sm text-muted-foreground mb-6">
          GTD Space uses a fixed dark theme. Appearance customization is not available.
        </p>

        {/* Theme - Dark Mode Only */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold">Current Theme</Label>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
            <Moon className="h-5 w-5 text-muted-foreground" />
            <div>
              <span className="font-medium">Dark Theme</span>
              <p className="text-sm text-muted-foreground">
                The app always runs in dark mode for a consistent interface.
              </p>
            </div>
          </div>
        </Card>

        {/* Preview */}
        <Card className="p-6 bg-muted/30 mt-6">
          <Label className="text-sm text-muted-foreground mb-3 block">Preview</Label>
          <div className="space-y-3">
            <div className="bg-background border rounded-lg p-4">
              <h4 className="font-semibold mb-2">Sample Content</h4>
              <p className="text-sm text-muted-foreground mb-3">
                This preview shows how content will appear with the dark theme.
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
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AppearanceSettings;
