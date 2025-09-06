/**
 * @fileoverview GTD workspace information component
 * @author Development Team
 * @created 2025-01-XX
 */

import React, { useState, useEffect } from 'react';
import {
  Target,
  FolderOpen,
  Layers,
  Info,
  Plus,
  Settings,
  Check,
  FolderTree,
  History
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import type { GTDSpace, GTDProject } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { safeInvoke } from '@/utils/safe-invoke';

/**
 * GTD workspace information display
 */
interface RecentWorkspace {
  path: string;
  name: string;
  lastOpened?: string;
  isDefault?: boolean;
}

interface GTDSettingsProps {
  /** Current GTD space state */
  gtdSpace?: GTDSpace | null;
  /** Function to switch workspace completely */
  switchWorkspace?: (spacePath: string) => Promise<void>;
  /** Function to check if path is valid GTD space */
  checkGTDSpace?: (path: string) => Promise<boolean>;
  /** Function to load projects from a GTD space */
  loadProjects?: (spacePath: string) => Promise<GTDProject[]>;
}

export const GTDSettings: React.FC<GTDSettingsProps> = (props) => {
  // Use props if provided, otherwise fall back to local hook
  const localHook = useGTDSpace();
  const gtdSpace = props.gtdSpace ?? localHook.gtdSpace;
  const switchWorkspace = props.switchWorkspace;
  const checkGTDSpace = props.checkGTDSpace ?? localHook.checkGTDSpace;
  const loadProjects = props.loadProjects ?? localHook.loadProjects;
  const { toast } = useToast();
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const [defaultWorkspace, setDefaultWorkspace] = useState<string | null>(null);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [showManualPathDialog, setShowManualPathDialog] = useState(false);
  const [manualPath, setManualPath] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Dialog state for workspace initialization confirmation
  const [showInitConfirm, setShowInitConfirm] = useState(false);
  const [pendingWorkspacePath, setPendingWorkspacePath] = useState<string | null>(null);
  
  // Dialog state for validation errors
  const [showValidationErrorDialog, setShowValidationErrorDialog] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  // Load recent workspaces from localStorage
  const loadRecentWorkspaces = React.useCallback(async () => {
    try {
      const stored = localStorage.getItem('gtdspace-recent-workspaces');
      if (stored) {
        const workspaces = JSON.parse(stored);
        setRecentWorkspaces(workspaces);
      }
    } catch (error) {
      // Failed to load recent workspaces
    }
  }, []);

  // Load default workspace from settings
  const loadDefaultWorkspace = React.useCallback(async () => {
    try {
      const settings = await safeInvoke<{ default_gtd_space?: string }>('load_settings', undefined, {});
      if (settings?.default_gtd_space) {
        setDefaultWorkspace(settings.default_gtd_space);
      }
    } catch (error) {
      // Failed to load default workspace
    }
  }, []);

  // Load the current workspace if not already loaded
  const loadCurrentWorkspace = React.useCallback(async () => {
    // Check if workspace is already loaded
    if (gtdSpace?.root_path) return;

    // Try to load from localStorage first
    const currentPath = localStorage.getItem('gtdspace-current-path');
    if (currentPath && checkGTDSpace && loadProjects) {
      try {
        const isValid = await checkGTDSpace(currentPath);
        if (isValid) {
          await loadProjects(currentPath);
        }
      } catch (error) {
        // Failed to load current workspace
      }
    }
  }, [gtdSpace?.root_path, checkGTDSpace, loadProjects]);

  // Load all data on mount
  useEffect(() => {
    loadRecentWorkspaces();
    loadDefaultWorkspace();
    loadCurrentWorkspace();
  }, [loadRecentWorkspaces, loadDefaultWorkspace, loadCurrentWorkspace]);

  const handleOpenFolder = async () => {
    if (gtdSpace?.root_path) {
      try {
        await safeInvoke('open_folder_in_explorer', { path: gtdSpace.root_path }, null);
      } catch (error) {
        // Failed to open folder
      }
    }
  };

  /**
   * Handles the workspace initialization confirmation
   */
  const handleConfirmWorkspaceInit = async () => {
    if (!pendingWorkspacePath) return;

    try {
      // Initialize the GTD space with proper error handling
      try {
        await safeInvoke('initialize_gtd_space', { spacePath: pendingWorkspacePath }, null);

        // Add a small delay to ensure file system operations complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify the workspace was created successfully
        const isValid = await safeInvoke<boolean>('check_is_gtd_space', { path: pendingWorkspacePath }, false);

        if (!isValid) {
          throw new Error('Workspace initialization incomplete - GTD structure not detected');
        }
      } catch (initError) {
        toast({
          title: 'Failed to initialize workspace',
          description: `Could not create GTD structure: ${String(initError)}`,
          variant: 'destructive'
        });
        return;
      }

      // Switch to the workspace only after successful initialization
      if (switchWorkspace) {
        await switchWorkspace(pendingWorkspacePath);
        
        // Update recent workspaces
        updateRecentWorkspaces(pendingWorkspacePath);
      }

      toast({
        title: 'Workspace Opened',
        description: `Switched to: ${pendingWorkspacePath}`
      });

    } catch (error) {
      toast({
        title: 'Workspace created but could not switch',
        description: `The workspace was created but could not be opened: ${String(error)}`,
        variant: 'destructive'
      });
    } finally {
      // Reset dialog state
      setShowInitConfirm(false);
      setPendingWorkspacePath(null);
      setIsLoadingWorkspaces(false);
    }
  };

  /**
   * Handles canceling the workspace initialization
   */
  const handleCancelWorkspaceInit = () => {
    setShowInitConfirm(false);
    setPendingWorkspacePath(null);
    setIsLoadingWorkspaces(false); // Reset loading state when cancelled
  };

  const handleOpenWorkspace = async (path?: string) => {
    try {
      const workspacePath = path;

      if (!workspacePath) {
        // Show manual path input dialog as a fallback
        setIsCreatingNew(false);
        setManualPath('');
        setShowManualPathDialog(true);
        return; // Exit here and let the dialog handle the rest
      }

      setIsLoadingWorkspaces(true);

      // Check if it's a valid GTD space
      const isGTDSpace = await safeInvoke<boolean>('check_is_gtd_space', { path: workspacePath }, false);

      if (!isGTDSpace) {
        // Show confirmation dialog instead of using window.confirm
        setPendingWorkspacePath(workspacePath);
        setShowInitConfirm(true);
        // Note: Loading state will be reset by dialog handlers
        return; // Exit early, let the dialog handle the flow
      }

      // Switch to the workspace
      if (switchWorkspace) {
        await switchWorkspace(workspacePath);
        
        // Update recent workspaces
        updateRecentWorkspaces(workspacePath);
      }

      toast({
        title: 'Workspace Opened',
        description: `Switched to: ${workspacePath}`
      });

    } catch (error) {
      toast({
        title: 'Failed to open workspace',
        description: String(error),
        variant: 'destructive'
      });
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  const updateRecentWorkspaces = (path: string) => {
    const name = path.split('/').pop() || path;
    const updated = [
      { path, name, lastOpened: new Date().toISOString() },
      ...recentWorkspaces.filter(w => w.path !== path)
    ].slice(0, 5); // Keep only 5 recent workspaces

    setRecentWorkspaces(updated);
    localStorage.setItem('gtdspace-recent-workspaces', JSON.stringify(updated));
  };

  const handleSetDefault = async (path: string) => {
    try {
      // Save to settings
      await safeInvoke('save_settings', {
        settings: { default_gtd_space: path }
      }, null);

      setDefaultWorkspace(path);

      toast({
        title: 'Default Workspace Set',
        description: `${path} is now your default workspace`
      });
    } catch (error) {
      toast({
        title: 'Failed to set default workspace',
        description: String(error),
        variant: 'destructive'
      });
    }
  };

  const handleCreateNew = async () => {
    // Show manual path input dialog for creating new workspace
    setIsCreatingNew(true);
    setManualPath('');
    setShowManualPathDialog(true);
  };
  
  const handleManualPathSubmit = async () => {
    if (!manualPath.trim()) {
      toast({
        title: 'Invalid path',
        description: 'Please enter a valid folder path',
        variant: 'destructive'
      });
      return;
    }
    
    const selected = manualPath.trim();
    
    setShowManualPathDialog(false);
    setIsLoadingWorkspaces(true);
    
    try {
      if (isCreatingNew) {
        // Creating new workspace logic
        // Initialize as GTD space with proper error handling
        try {
          await safeInvoke('initialize_gtd_space', { spacePath: selected }, null);

          // Add a small delay to ensure file system operations complete
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify the workspace was created successfully
          const isValid = await safeInvoke<boolean>('check_is_gtd_space', { path: selected }, false);

          if (!isValid) {
            throw new Error('Workspace initialization incomplete - GTD structure not detected');
          }

        } catch (initError) {
          toast({
            title: 'Failed to initialize workspace',
            description: `Could not create GTD structure: ${String(initError)}`,
            variant: 'destructive'
          });
          setIsLoadingWorkspaces(false);
          return;
        }

        // Switch to the workspace only after successful initialization
        try {
          await handleOpenWorkspace(selected);

          toast({
            title: 'Workspace Created',
            description: `Successfully created and opened workspace at: ${selected}`
          });
        } catch (switchError) {
          toast({
            title: 'Workspace created but could not switch',
            description: `The workspace was created but could not be opened: ${String(switchError)}`,
            variant: 'destructive'
          });
        }
      } else {
        // Opening existing workspace logic
        // Check if it's a valid GTD space
        let isGTDSpace = false;
        try {
          // First check if the directory exists
          const dirExists = await safeInvoke<boolean>('check_directory_exists', { path: selected }, false);
          
          if (!dirExists) {
            toast({
              title: 'Directory not found',
              description: `The path ${selected} does not exist`,
              variant: 'destructive'
            });
            setIsLoadingWorkspaces(false);
            return;
          }
          
          isGTDSpace = await safeInvoke<boolean>('check_is_gtd_space', { path: selected }, false);
        } catch (error) {
          // If validation fails, show proper dialog instead of native confirm
          setPendingWorkspacePath(selected);
          setValidationError(String(error));
          setShowValidationErrorDialog(true);
          setIsLoadingWorkspaces(false);
          return;
        }

        if (!isGTDSpace) {
          // Show confirmation dialog with more options
          setPendingWorkspacePath(selected);
          setShowInitConfirm(true);
          // Note: Loading state will be reset by dialog handlers
          return; // Exit early, let the dialog handle the flow
        }

        // Switch to the workspace
        if (switchWorkspace) {
          await switchWorkspace(selected);
          
          // Update recent workspaces
          updateRecentWorkspaces(selected);
        }

        toast({
          title: 'Workspace Opened',
          description: `Switched to: ${selected}`
        });
      }
    } catch (error) {
      toast({
        title: 'Failed to process workspace',
        description: String(error),
        variant: 'destructive'
      });
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">GTD Workspace</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Information about your Getting Things Done workspace
        </p>

        {/* Current Workspace */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold">Current Workspace</Label>
          </div>
          <div className="space-y-3">
            {gtdSpace?.root_path ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-2">
                    <p className="text-sm font-mono bg-muted px-3 py-2 rounded truncate">
                      {gtdSpace.root_path}
                    </p>
                    {defaultWorkspace === gtdSpace.root_path && (
                      <Badge variant="secondary" className="mt-2">
                        <Check className="h-3 w-3 mr-1" />
                        Default Workspace
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenFolder}
                      title="Open in file explorer"
                    >
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                    {defaultWorkspace !== gtdSpace.root_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(gtdSpace.root_path)}
                        title="Set as default workspace"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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
                <Button
                  className="mt-3"
                  onClick={handleCreateNew}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Workspace
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Workspace Management */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FolderTree className="h-5 w-5 text-muted-foreground" />
            <Label className="text-base font-semibold">Workspace Management</Label>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenWorkspace()}
                disabled={isLoadingWorkspaces}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Workspace
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCreateNew}
                disabled={isLoadingWorkspaces}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </div>

            {/* Recent Workspaces */}
            {recentWorkspaces.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Recent Workspaces</Label>
                </div>
                <div className="space-y-2">
                  {recentWorkspaces.map((workspace) => (
                    <div
                      key={workspace.path}
                      className="flex items-center justify-between p-2 rounded-md border hover:bg-accent/50 transition-colors"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleOpenWorkspace(workspace.path)}
                      >
                        <p className="text-sm font-medium">{workspace.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{workspace.path}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {workspace.path === defaultWorkspace && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                        {workspace.path === gtdSpace?.root_path && (
                          <Badge variant="default" className="text-xs">
                            Active
                          </Badge>
                        )}
                        {workspace.path !== defaultWorkspace && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefault(workspace.path);
                            }}
                            title="Set as default"
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Default Workspace Info */}
            {defaultWorkspace && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground">
                  <strong>Default workspace:</strong> The workspace that will open automatically when you start the app.
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

      {/* Manual Path Input Dialog */}
      <AlertDialog open={showManualPathDialog} onOpenChange={setShowManualPathDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isCreatingNew ? 'Create New GTD Workspace' : 'Open GTD Workspace'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Enter the full path to the folder where you want to {isCreatingNew ? 'create' : 'open'} your GTD workspace.
              {isCreatingNew && ' A new GTD Space folder will be created at this location.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="text"
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              placeholder="/Users/username/Documents/GTD Space"
              className="w-full"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-2">
              Example: /Users/username/Documents/GTD Space
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowManualPathDialog(false);
              setManualPath('');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleManualPathSubmit}>
              {isCreatingNew ? 'Create' : 'Open'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Workspace Initialization Confirmation Dialog */}
      <AlertDialog open={showInitConfirm} onOpenChange={setShowInitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Workspace Not Recognized</AlertDialogTitle>
            <AlertDialogDescription>
              The folder at <code className="font-mono bg-muted px-1 py-0.5 rounded">{pendingWorkspacePath}</code> was not recognized as a GTD workspace.
              <br/><br/>
              This could be because:
              • The folder doesn't have the required GTD directories (Projects, Areas of Focus)
              • There's an issue with the validation
              <br/><br/>
              You can either:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleCancelWorkspaceInit}>Cancel</AlertDialogCancel>
            <Button 
              variant="secondary"
              onClick={async () => {
                // Force open without initializing
                setShowInitConfirm(false);
                if (pendingWorkspacePath) {
                  try {
                    if (switchWorkspace) {
                      await switchWorkspace(pendingWorkspacePath);
                      updateRecentWorkspaces(pendingWorkspacePath);
                    }
                    
                    toast({
                      title: 'Workspace Opened',
                      description: `Opened: ${pendingWorkspacePath} (validation bypassed)`
                    });
                  } catch (error) {
                    toast({
                      title: 'Failed to open workspace',
                      description: String(error),
                      variant: 'destructive'
                    });
                  } finally {
                    setPendingWorkspacePath(null);
                    setIsLoadingWorkspaces(false);
                  }
                }
              }}
            >
              Open Anyway
            </Button>
            <AlertDialogAction onClick={handleConfirmWorkspaceInit}>Initialize as GTD Space</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Validation Error Dialog */}
      <AlertDialog open={showValidationErrorDialog} onOpenChange={setShowValidationErrorDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Could Not Validate Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Could not validate GTD space at <code className="font-mono bg-muted px-1 py-0.5 rounded">{pendingWorkspacePath}</code>.
              <br/><br/>
              <strong>Error:</strong> {validationError}
              <br/><br/>
              Would you like to try opening it anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowValidationErrorDialog(false);
              setPendingWorkspacePath(null);
              setValidationError('');
              setIsLoadingWorkspaces(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              setShowValidationErrorDialog(false);
              setValidationError('');
              
              if (pendingWorkspacePath && switchWorkspace) {
                try {
                  // Force open the workspace
                  await switchWorkspace(pendingWorkspacePath);
                  updateRecentWorkspaces(pendingWorkspacePath);
                  
                  toast({
                    title: 'Workspace Opened',
                    description: `Switched to: ${pendingWorkspacePath}`
                  });
                } catch (error) {
                  toast({
                    title: 'Failed to open workspace',
                    description: String(error),
                    variant: 'destructive'
                  });
                } finally {
                  setPendingWorkspacePath(null);
                  setIsLoadingWorkspaces(false);
                }
              }
            }}>
              Open Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GTDSettings;