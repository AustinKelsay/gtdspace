import React from 'react';
import { Folder, FolderOpen, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function SidebarEmptyFolderState({
  className = '',
  onSelectFolder,
}: {
  className?: string;
  onSelectFolder: () => void | Promise<void>;
}) {
  const [isSelecting, setIsSelecting] = React.useState(false);

  return (
    <Card className={`flex flex-col h-full border-r ${className}`}>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">Welcome to GTD Space</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Select a folder to create or open a GTD workspace
          </p>
          <Button
            onClick={async () => {
              if (isSelecting) return;
              setIsSelecting(true);
              try {
                await onSelectFolder();
              } finally {
                setIsSelecting(false);
              }
            }}
            variant="default"
            size="sm"
            disabled={isSelecting}
          >
            <Folder className="h-4 w-4 mr-2" />
            {isSelecting ? 'Selecting...' : 'Select Folder'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function SidebarNonGtdState({ className = '' }: { className?: string }) {
  return (
    <Card className={`flex flex-col h-full border-r ${className}`}>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>This is not a GTD workspace</p>
          <p className="text-sm mt-2">Initialize from the prompt</p>
        </div>
      </div>
    </Card>
  );
}
