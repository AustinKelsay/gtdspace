/**
 * @fileoverview Main settings management component
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Settings UI implementation
 */

import React from 'react';
import { Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EditorSettings } from './EditorSettings';
import { WorkspaceSettings } from './WorkspaceSettings';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import type { BaseComponentProps } from '@/types';

export interface SettingsManagerProps extends BaseComponentProps {
  /** Whether the settings dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
}

/**
 * Main settings manager component that provides tabbed interface for all settings
 */
export const SettingsManager: React.FC<SettingsManagerProps> = ({
  isOpen,
  onClose,
  className = '',
  ...props
}) => {
  const [activeTab, setActiveTab] = React.useState<'editor' | 'workspace' | 'shortcuts'>('editor');

  const tabs = [
    { id: 'editor' as const, label: 'Editor', icon: Settings },
    { id: 'workspace' as const, label: 'Workspace', icon: Settings },
    { id: 'shortcuts' as const, label: 'Keyboard Shortcuts', icon: Settings },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-4xl max-h-[80vh] p-0 ${className}`} {...props}>
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xl font-semibold">Settings</DialogTitle>
        </DialogHeader>

        <div className="flex h-[600px]">
          {/* Sidebar */}
          <div className="w-48 border-r bg-muted/30 p-2">
            <nav className="flex flex-col gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === tab.id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'editor' && <EditorSettings />}
            {activeTab === 'workspace' && <WorkspaceSettings />}
            {activeTab === 'shortcuts' && <KeyboardShortcuts />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsManager;