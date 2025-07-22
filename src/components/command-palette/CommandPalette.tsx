/**
 * @fileoverview Command palette for quick access to all application commands
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Command palette UI
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Command, ChevronRight, File, Settings, Search as SearchIcon } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BaseComponentProps } from '@/types';

export interface Command {
  /** Unique command ID */
  id: string;
  /** Display name for the command */
  name: string;
  /** Command description */
  description: string;
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Command category */
  category: 'file' | 'edit' | 'view' | 'search' | 'navigation' | 'settings';
  /** Whether the command is currently available */
  enabled: boolean;
  /** Command execution function */
  execute: () => void | Promise<void>;
}

export interface CommandPaletteProps extends BaseComponentProps {
  /** Whether the command palette is open */
  isOpen: boolean;
  /** Callback when the palette should close */
  onClose: () => void;
  /** Available commands */
  commands: Command[];
}

/**
 * Command palette component for quick command access
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
  className = '',
  ...props
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands.filter(cmd => cmd.enabled);
    }

    const searchTerm = query.toLowerCase();
    return commands
      .filter(cmd => cmd.enabled)
      .filter(cmd => 
        cmd.name.toLowerCase().includes(searchTerm) ||
        cmd.description.toLowerCase().includes(searchTerm) ||
        cmd.category.toLowerCase().includes(searchTerm)
      )
      .sort((a, b) => {
        // Prioritize exact name matches
        const aNameMatch = a.name.toLowerCase().startsWith(searchTerm);
        const bNameMatch = b.name.toLowerCase().startsWith(searchTerm);
        
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        
        return a.name.localeCompare(b.name);
      });
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: { [key: string]: Command[] } = {};
    
    filteredCommands.forEach(command => {
      if (!groups[command.category]) {
        groups[command.category] = [];
      }
      groups[command.category].push(command);
    });
    
    return groups;
  }, [filteredCommands]);

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  const executeCommand = async (command: Command) => {
    try {
      await command.execute();
      onClose();
    } catch (error) {
      console.error('Failed to execute command:', command.id, error);
    }
  };

  const getCategoryDisplayName = (category: string) => {
    const categoryNames = {
      file: 'File Operations',
      edit: 'Editor',
      view: 'View',
      search: 'Search',
      navigation: 'Navigation',
      settings: 'Settings',
    };
    return categoryNames[category as keyof typeof categoryNames] || category;
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      file: File,
      edit: Command,
      view: Command,
      search: SearchIcon,
      navigation: ChevronRight,
      settings: Settings,
    };
    return icons[category as keyof typeof icons] || Command;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-2xl max-h-[80vh] p-0 ${className}`} {...props}>
        {/* Search Bar */}
        <div className="border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command or search..."
              className="pl-10 pr-4 border-none bg-transparent focus:ring-0 text-base"
              autoFocus
            />
          </div>
        </div>

        {/* Command List */}
        <ScrollArea className="flex-1 max-h-[400px]">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center">
              <Command className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {query ? `No commands found for "${query}"` : 'No commands available'}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {Object.entries(groupedCommands).map(([category, categoryCommands]) => {
                const CategoryIcon = getCategoryIcon(category);
                return (
                  <div key={category} className="mb-4">
                    {/* Category Header */}
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <CategoryIcon className="h-3 w-3" />
                      {getCategoryDisplayName(category)}
                    </div>
                    
                    {/* Commands in Category */}
                    <div className="space-y-1">
                      {categoryCommands.map((command) => {
                        const globalIndex = filteredCommands.indexOf(command);
                        const isSelected = globalIndex === selectedIndex;
                        const CommandIcon = command.icon;
                        
                        return (
                          <button
                            key={command.id}
                            onClick={() => executeCommand(command)}
                            className={`w-full text-left px-3 py-2 rounded-md transition-colors focus:outline-none ${
                              isSelected 
                                ? 'bg-accent text-accent-foreground' 
                                : 'hover:bg-accent/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <CommandIcon className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium text-sm">
                                    {command.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {command.description}
                                  </div>
                                </div>
                              </div>
                              {command.shortcut && (
                                <div className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                  {command.shortcut}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>↑↓ Navigate</span>
              <span>↵ Execute</span>
              <span>Esc Close</span>
            </div>
            <div>
              {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;