import React from 'react';
import { Folder, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SidebarItemMenuProps = {
  path: string;
  onOpenFileLocation: (path: string) => void | Promise<void>;
  onDelete: () => void;
};

export function SidebarItemMenu({
  path,
  onOpenFileLocation,
  onDelete,
}: SidebarItemMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus-visible:opacity-100 transition-opacity"
          onClick={(event) => event.stopPropagation()}
          aria-label="Open item menu"
        >
          <MoreHorizontal className="h-2.5 w-2.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={async (event) => {
            event.stopPropagation();
            await onOpenFileLocation(path);
          }}
        >
          <Folder className="h-3 w-3 mr-2" />
          Open File Location
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-3 w-3 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
