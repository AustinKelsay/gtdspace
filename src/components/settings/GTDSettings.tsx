/**
 * @fileoverview GTD workspace information component
 * @author Development Team
 * @created 2025-01-XX
 */

import React from 'react';
import { 
  Target, 
  FolderOpen,
  Layers,
  Info
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { invoke } from '@tauri-apps/api/core';

/**
 * GTD workspace information display
 */
export const GTDSettings: React.FC = () => {
  const { gtdSpace } = useGTDSpace();

  const handleOpenFolder = async () => {
    if (gtdSpace?.root_path) {
      try {
        await invoke('open_folder_in_explorer', { path: gtdSpace.root_path });
      } catch (error) {
        console.error('Failed to open folder:', error);
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">GTD Workspace</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Information about your Getting Things Done workspace
        </p>

        {/* GTD Space Location */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold">Workspace Location</Label>
          </div>
          <div className="space-y-3">
            {gtdSpace?.root_path ? (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-mono bg-muted px-3 py-2 rounded flex-1 mr-2 truncate">
                    {gtdSpace.root_path}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenFolder}
                  >
                    Open
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This is your active GTD workspace containing all horizons, projects, and actions
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No GTD workspace currently active
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Open a folder from the sidebar to initialize it as a GTD space
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* GTD Structure Info */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold">How GTD Space Works</Label>
          </div>
          
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              GTD Space automatically organizes your workspace according to the Getting Things Done® methodology:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong>Habits</strong> automatically reset based on their frequency (daily, weekly, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong>Projects</strong> are folders containing a README.md and related actions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong>Actions</strong> track status, effort level, and due dates</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong>Auto-save</strong> preserves your work 2 seconds after you stop typing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong>File watching</strong> keeps everything in sync when files change externally</span>
              </li>
            </ul>
          </div>
        </Card>

        {/* Horizons of Focus */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold">Horizons of Focus</Label>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-3">
              Your GTD workspace is organized into six horizons:
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-20 justify-center">50,000 ft</Badge>
                <span className="text-sm">Purpose & Principles - Your life mission and values</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-20 justify-center">40,000 ft</Badge>
                <span className="text-sm">Vision - 3-5 year aspirations</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-20 justify-center">30,000 ft</Badge>
                <span className="text-sm">Goals - 1-2 year objectives</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-20 justify-center">20,000 ft</Badge>
                <span className="text-sm">Areas of Focus - Ongoing responsibilities</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-20 justify-center">10,000 ft</Badge>
                <span className="text-sm">Projects - Multi-step outcomes</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="w-20 justify-center">Runway</Badge>
                <span className="text-sm">Actions - Next steps to take</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default GTDSettings;