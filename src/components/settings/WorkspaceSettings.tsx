/**
 * @fileoverview Workspace settings component
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Workspace settings UI
 */

import React from 'react';
import { Folder, FileText, Clock, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSettings } from '@/hooks/useSettings';

/**
 * Workspace settings component for customizing workspace preferences
 */
export const WorkspaceSettings: React.FC = () => {
  const { settings, updateSettings, setLastFolder } = useSettings();

  const maxTabOptions = [5, 10, 15, 20, 25];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Workspace Settings</h3>
        
        {/* Tab Management */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-medium">Tab Management</Label>
          </div>
          
          {/* Max Tabs */}
          <div className="mb-4">
            <Label className="text-sm text-muted-foreground mb-2 block">Maximum Open Tabs</Label>
            <div className="flex gap-2 flex-wrap">
              {maxTabOptions.map((count) => (
                <Button
                  key={count}
                  variant={settings.max_tabs === count ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateSettings({ max_tabs: count })}
                  className="w-12"
                >
                  {count}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              When the limit is reached, the oldest inactive tab will be closed automatically
            </p>
          </div>

          {/* Restore Tabs */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Restore Tabs on Startup</Label>
            <div className="flex gap-2">
              <Button
                variant={settings.restore_tabs ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSettings({ restore_tabs: true })}
              >
                Yes
              </Button>
              <Button
                variant={!settings.restore_tabs ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSettings({ restore_tabs: false })}
              >
                No
              </Button>
            </div>
          </div>
        </Card>

        {/* Auto-Save Settings */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-medium">Auto-Save</Label>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Files are automatically saved 2 seconds after you stop typing
            </p>
            <div className="flex items-center gap-2 text-sm">
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Auto-save is always enabled for data safety</span>
            </div>
          </div>
        </Card>

        {/* Default Folder */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Folder className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-medium">Default Folder</Label>
          </div>
          {settings.last_folder ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1 mr-2 truncate">
                  {settings.last_folder}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLastFolder(null)}
                >
                  Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This folder will be opened automatically on startup
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No default folder set. The last opened folder will be remembered.
            </p>
          )}
        </Card>

        {/* File Extensions */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-medium">File Extensions</Label>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Files with these extensions will be shown in the file browser:
            </p>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-muted rounded text-sm font-mono">.md</span>
              <span className="px-2 py-1 bg-muted rounded text-sm font-mono">.markdown</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default WorkspaceSettings;