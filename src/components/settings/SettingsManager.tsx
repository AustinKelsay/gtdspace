/**
 * @fileoverview Main settings management component
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Settings UI implementation
 */

import React from 'react';
import { 
  Settings, 
  Target, 
  Palette, 
  Keyboard, 
  Wrench, 
  Info
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { AppearanceSettings } from './AppearanceSettings';
import { GTDSettings } from './GTDSettings';
import { AdvancedSettings } from './AdvancedSettings';
import { AboutSection } from './AboutSection';
import type { BaseComponentProps } from '@/types';

export interface SettingsManagerProps extends BaseComponentProps {
  /** Whether the settings dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
}

type TabId = 'appearance' | 'gtd' | 'shortcuts' | 'advanced' | 'about';

/**
 * Main settings manager component that provides tabbed interface for all settings
 */
export const SettingsManager: React.FC<SettingsManagerProps> = ({
  isOpen,
  onClose,
  className = '',
  ...props
}) => {
  const [activeTab, setActiveTab] = React.useState<TabId>('appearance');

  const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }>; group?: string }> = [
    { id: 'appearance', label: 'Appearance', icon: Palette, group: 'Settings' },
    { id: 'gtd', label: 'GTD Workspace', icon: Target, group: 'Settings' },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, group: 'Reference' },
    { id: 'advanced', label: 'Advanced', icon: Wrench, group: 'Reference' },
    { id: 'about', label: 'About', icon: Info, group: 'Reference' },
  ];

  // Group tabs by category
  const groupedTabs = React.useMemo(() => {
    const groups: Record<string, typeof tabs> = {};
    tabs.forEach(tab => {
      const group = tab.group || 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group].push(tab);
    });
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-5xl max-h-[85vh] p-0 overflow-hidden ${className}`} {...props}>
        <DialogHeader className="px-6 py-4 border-b bg-card rounded-t-lg">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex h-[650px] rounded-b-lg overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 border-r bg-muted/20">
            <ScrollArea className="h-full">
              <nav className="flex flex-col p-3">
                {Object.entries(groupedTabs).map(([group, items], index) => (
                  <div key={group} className="mb-4">
                    {index > 0 && <Separator className="mb-3" />}
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
                      {group}
                    </p>
                    <div className="flex flex-col gap-1">
                      {items.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                              activeTab === tab.id
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                            }`}
                          >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </ScrollArea>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {activeTab === 'appearance' && <AppearanceSettings />}
              {activeTab === 'gtd' && <GTDSettings />}
              {activeTab === 'shortcuts' && <KeyboardShortcuts />}
              {activeTab === 'advanced' && <AdvancedSettings />}
              {activeTab === 'about' && <AboutSection />}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsManager;