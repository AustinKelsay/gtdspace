/**
 * @fileoverview Advanced settings component for data management
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import { 
  Database,
  Download,
  Upload,
  RotateCcw,
  HardDrive,
  AlertTriangle
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';

/**
 * Advanced settings component - simplified to only include working features
 */
export const AdvancedSettings: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);

  const handleExportSettings = async () => {
    setIsExporting(true);
    try {
      const settingsJson = JSON.stringify(settings, null, 2);
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gtdspace-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Settings Exported',
        description: 'Your settings have been exported successfully',
      });
    } catch (_error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export settings',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const importedSettings = JSON.parse(text);
      
      // Validate the imported settings have required fields
      if (!importedSettings.theme || !importedSettings.font_size) {
        throw new Error('Invalid settings file');
      }

      await updateSettings(importedSettings);
      
      toast({
        title: 'Settings Imported',
        description: 'Your settings have been imported successfully',
      });
      
      // Reset the input
      event.target.value = '';
    } catch (_error) {
      toast({
        title: 'Import Failed',
        description: 'Failed to import settings. Please check the file format.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetSettings = async () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      await updateSettings({
        theme: 'dark',
        font_size: 14,
        tab_size: 2,
        word_wrap: true,
        editor_mode: 'split',
      });
      
      toast({
        title: 'Settings Reset',
        description: 'All settings have been reset to defaults',
      });
    }
  };

  const handleClearCache = async () => {
    try {
      // Clear localStorage except for essential items
      const essentialKeys = ['gtdspace-current-path', 'gtdspace-tabs', 'gtdspace-sidebar-width'];
      const keysToKeep: Record<string, string> = {};
      
      essentialKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) keysToKeep[key] = value;
      });
      
      localStorage.clear();
      
      // Restore essential items
      Object.entries(keysToKeep).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      toast({
        title: 'Cache Cleared',
        description: 'Application cache has been cleared successfully',
      });
    } catch (_error) {
      toast({
        title: 'Clear Failed',
        description: 'Failed to clear cache',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Advanced</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Data management and maintenance options
        </p>

        {/* Import/Export */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold">Settings Backup</Label>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Export your settings for backup or import them on another device
          </p>
          
          <div className="space-y-3">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleExportSettings}
                disabled={isExporting}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export Settings'}
              </Button>
              
              <div className="flex-1">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                  disabled={isImporting}
                  className="hidden"
                  id="import-settings"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('import-settings')?.click()}
                  disabled={isImporting}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isImporting ? 'Importing...' : 'Import Settings'}
                </Button>
              </div>
            </div>
            
            <Button
              variant="destructive"
              onClick={handleResetSettings}
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>
        </Card>

        {/* Cache Management */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold">Cache & Storage</Label>
          </div>
          
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Clearing cache will remove temporary browser data while preserving essential application state.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={handleClearCache}
              className="w-full"
            >
              <HardDrive className="h-4 w-4 mr-2" />
              Clear Application Cache
            </Button>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>What will be cleared:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• Search history and saved searches</li>
                <li>• Temporary browser cache data</li>
                <li>• Other non-essential cached information</li>
              </ul>
              <p className="mt-3"><strong>What will be preserved:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• Current workspace path</li>
                <li>• Open tabs and their content</li>
                <li>• Sidebar width preference</li>
                <li>• User settings (theme, preferences)</li>
                <li>• All files on disk (unchanged)</li>
              </ul>
              <p className="mt-2 text-muted-foreground/80 italic">
                This only affects browser storage, not your files or app settings.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdvancedSettings;