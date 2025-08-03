/**
 * @fileoverview GTD Quick Actions component for fast project/action creation
 * @author Development Team
 * @created 2024-01-XX
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Plus,
  Briefcase,
  FileText,
  Calendar,
  Clock,
  Lightbulb,
  Target,
  CheckSquare
} from 'lucide-react';
import { useGTDSpace } from '@/hooks/useGTDSpace';
import { GTDProjectDialog, GTDActionDialog } from '@/components/gtd';
import type { GTDProject } from '@/types';

interface GTDQuickActionsProps {
  currentFolder: string | null;
  currentProject?: GTDProject | null;
  variant?: 'floating' | 'inline';
  className?: string;
}

export const GTDQuickActions: React.FC<GTDQuickActionsProps> = ({
  currentFolder,
  currentProject,
  variant = 'floating',
  className = ''
}) => {
  const { gtdSpace } = useGTDSpace();
  const [showProjectDialog, setShowProjectDialog] = React.useState(false);
  const [showActionDialog, setShowActionDialog] = React.useState(false);

  // Don't show if not in a GTD space
  if (!currentFolder || !gtdSpace?.isGTDSpace) {
    return null;
  }

  const handleQuickProject = (_type: string) => {
    setShowProjectDialog(true);
  };

  const handleQuickAction = () => {
    if (currentProject) {
      setShowActionDialog(true);
    }
  };

  const isInProjectsFolder = currentFolder?.includes('/Projects');
  const isInProject = currentProject !== null;

  if (variant === 'floating') {
    return (
      <>
        <div className={`fixed bottom-6 right-6 flex flex-col gap-2 z-50 ${className}`}>
          {/* Main FAB */}
          <div className="relative group">
            <Button
              size="icon"
              className="h-14 w-14 rounded-full shadow-lg"
              onClick={() => {
                if (isInProject) {
                  handleQuickAction();
                } else {
                  handleQuickProject('general');
                }
              }}
            >
              <Plus className="h-6 w-6" />
            </Button>
            
            {/* Quick action menu */}
            <div className="absolute bottom-16 right-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="bg-card border rounded-lg shadow-lg p-2 space-y-1 min-w-[200px]">
                <h3 className="text-xs font-semibold text-muted-foreground px-2 py-1">Quick Create</h3>
                
                {!isInProject && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleQuickProject('project')}
                    >
                      <Briefcase className="h-4 w-4 mr-2" />
                      New Project
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleQuickProject('goal')}
                    >
                      <Target className="h-4 w-4 mr-2" />
                      New Goal
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleQuickProject('idea')}
                    >
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Capture Idea
                    </Button>
                  </>
                )}
                
                {isInProject && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={handleQuickAction}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      New Action
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        handleQuickAction();
                      }}
                    >
                      <Clock className="h-4 w-4 mr-2 text-red-500" />
                      Urgent Action
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        handleQuickAction();
                      }}
                    >
                      <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                      Scheduled Action
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick access shortcuts */}
          {isInProjectsFolder && (
            <div className="flex flex-col gap-2">
              <Button
                size="icon"
                variant="secondary"
                className="h-10 w-10 rounded-full shadow-md"
                onClick={() => handleQuickProject('project')}
                title="New Project"
              >
                <Briefcase className="h-4 w-4" />
              </Button>
              
              {currentProject && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-10 w-10 rounded-full shadow-md"
                  onClick={handleQuickAction}
                  title="New Action"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Dialogs */}
        {currentFolder && (
          <>
            <GTDProjectDialog
              isOpen={showProjectDialog}
              onClose={() => {
                setShowProjectDialog(false);
              }}
              spacePath={currentFolder.split('/Projects')[0]}
            />
            
            {currentProject && (
              <GTDActionDialog
                isOpen={showActionDialog}
                onClose={() => {
                  setShowActionDialog(false);
                }}
                projectPath={currentProject.path}
                projectName={currentProject.name}
              />
            )}
          </>
        )}
      </>
    );
  }

  // Inline variant for embedding in other components
  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {!isInProject && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleQuickProject('project')}
            >
              <Briefcase className="h-4 w-4 mr-2" />
              New Project
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleQuickProject('idea')}
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Capture Idea
            </Button>
          </>
        )}
        
        {isInProject && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={handleQuickAction}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Action
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                handleQuickAction();
              }}
            >
              <Clock className="h-4 w-4 mr-2" />
              Urgent
            </Button>
          </>
        )}
      </div>

      {/* Dialogs */}
      {currentFolder && (
        <>
          <GTDProjectDialog
            isOpen={showProjectDialog}
            onClose={() => {
              setShowProjectDialog(false);
            }}
            spacePath={currentFolder.split('/Projects')[0]}
          />
          
          {currentProject && (
            <GTDActionDialog
              isOpen={showActionDialog}
              onClose={() => {
                setShowActionDialog(false);
              }}
              projectPath={currentProject.path}
              projectName={currentProject.name}
            />
          )}
        </>
      )}
    </>
  );
};

export default GTDQuickActions;