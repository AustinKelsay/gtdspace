/**
 * @fileoverview Keyboard shortcuts reference overlay
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Keyboard shortcuts help system
 */

import React, { useState, useMemo } from 'react';
import { 
  Keyboard, 
  X, 
  Search, 
  Filter, 
  Download, 
  Settings,
  Command
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// === TYPES ===

interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  keys: string[];
  category: 'file' | 'edit' | 'navigation' | 'view' | 'application' | 'advanced';
  platform?: 'all' | 'windows' | 'mac' | 'linux';
  context?: string;
  customizable?: boolean;
}

interface ShortcutCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

interface KeyboardShortcutsReferenceProps {
  /** Whether the shortcuts reference is open */
  isOpen: boolean;
  /** Callback when reference is closed */
  onClose: () => void;
  /** Callback when shortcut customization is requested */
  onCustomizeShortcut?: (shortcutId: string) => void;
  /** Current platform */
  platform?: 'windows' | 'mac' | 'linux';
  /** Optional CSS class name */
  className?: string;
}

// === CONSTANTS ===

const SHORTCUT_CATEGORIES: Record<string, ShortcutCategory> = {
  file: {
    id: 'file',
    name: 'File Operations',
    description: 'Create, open, save, and manage files',
    icon: <Command className="h-4 w-4" />,
    color: 'bg-blue-500',
  },
  edit: {
    id: 'edit',
    name: 'Text Editing',
    description: 'Format text and manipulate content',
    icon: <Keyboard className="h-4 w-4" />,
    color: 'bg-green-500',
  },
  navigation: {
    id: 'navigation',
    name: 'Navigation',
    description: 'Move around files and interface',
    icon: <Search className="h-4 w-4" />,
    color: 'bg-purple-500',
  },
  view: {
    id: 'view',
    name: 'View & Layout',
    description: 'Change editor modes and interface layout',
    icon: <Filter className="h-4 w-4" />,
    color: 'bg-orange-500',
  },
  application: {
    id: 'application',
    name: 'Application',
    description: 'Application-wide commands and settings',
    icon: <Settings className="h-4 w-4" />,
    color: 'bg-gray-500',
  },
  advanced: {
    id: 'advanced',
    name: 'Advanced',
    description: 'Power user shortcuts and development tools',
    icon: <Download className="h-4 w-4" />,
    color: 'bg-red-500',
  },
};

const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // File Operations
  {
    id: 'open-folder',
    name: 'Open Folder',
    description: 'Select a workspace folder',
    keys: ['Ctrl', 'O'],
    category: 'file',
    platform: 'all',
    customizable: true,
  },
  {
    id: 'new-file',
    name: 'New File',
    description: 'Create a new markdown file',
    keys: ['Ctrl', 'N'],
    category: 'file',
    platform: 'all',
    customizable: true,
  },
  {
    id: 'save-file',
    name: 'Save File',
    description: 'Save the current file',
    keys: ['Ctrl', 'S'],
    category: 'file',
    platform: 'all',
  },
  {
    id: 'save-all',
    name: 'Save All Files',
    description: 'Save all open files with changes',
    keys: ['Ctrl', 'Shift', 'S'],
    category: 'file',
    platform: 'all',
  },
  {
    id: 'close-tab',
    name: 'Close Tab',
    description: 'Close the current tab',
    keys: ['Ctrl', 'W'],
    category: 'file',
    platform: 'all',
  },
  {
    id: 'close-all-tabs',
    name: 'Close All Tabs',
    description: 'Close all open tabs',
    keys: ['Ctrl', 'Shift', 'W'],
    category: 'file',
    platform: 'all',
  },

  // Text Editing
  {
    id: 'bold',
    name: 'Bold Text',
    description: 'Make selected text bold',
    keys: ['Ctrl', 'B'],
    category: 'edit',
    platform: 'all',
    context: 'WYSIWYG mode',
  },
  {
    id: 'italic',
    name: 'Italic Text',
    description: 'Make selected text italic',
    keys: ['Ctrl', 'I'],
    category: 'edit',
    platform: 'all',
    context: 'WYSIWYG mode',
  },
  {
    id: 'underline',
    name: 'Underline Text',
    description: 'Underline selected text',
    keys: ['Ctrl', 'U'],
    category: 'edit',
    platform: 'all',
    context: 'WYSIWYG mode',
  },
  {
    id: 'insert-link',
    name: 'Insert Link',
    description: 'Insert or edit a hyperlink',
    keys: ['Ctrl', 'K'],
    category: 'edit',
    platform: 'all',
  },
  {
    id: 'code-block',
    name: 'Code Block',
    description: 'Insert a code block',
    keys: ['Ctrl', 'Shift', 'K'],
    category: 'edit',
    platform: 'all',
  },
  {
    id: 'toggle-comment',
    name: 'Toggle Comment',
    description: 'Comment or uncomment selected text',
    keys: ['Ctrl', '/'],
    category: 'edit',
    platform: 'all',
    context: 'Source mode',
  },

  // Navigation
  {
    id: 'switch-tabs',
    name: 'Switch Tabs',
    description: 'Cycle through open tabs',
    keys: ['Ctrl', 'Tab'],
    category: 'navigation',
    platform: 'all',
  },
  {
    id: 'goto-tab',
    name: 'Go to Tab 1-9',
    description: 'Jump to specific tab by number',
    keys: ['Ctrl', '1-9'],
    category: 'navigation',
    platform: 'all',
  },
  {
    id: 'find-file',
    name: 'Find in File',
    description: 'Search within the current file',
    keys: ['Ctrl', 'F'],
    category: 'navigation',
    platform: 'all',
  },
  {
    id: 'find-all-files',
    name: 'Find in All Files',
    description: 'Search across all files in workspace',
    keys: ['Ctrl', 'Shift', 'F'],
    category: 'navigation',
    platform: 'all',
  },
  {
    id: 'goto-line',
    name: 'Go to Line',
    description: 'Jump to a specific line number',
    keys: ['Ctrl', 'G'],
    category: 'navigation',
    platform: 'all',
    context: 'Source mode',
  },
  {
    id: 'quick-switcher',
    name: 'Quick File Switcher',
    description: 'Quickly switch between files',
    keys: ['Ctrl', 'P'],
    category: 'navigation',
    platform: 'all',
  },

  // View & Layout
  {
    id: 'wysiwyg-mode',
    name: 'WYSIWYG Mode',
    description: 'Switch to rich text editing mode',
    keys: ['Ctrl', 'Shift', 'W'],
    category: 'view',
    platform: 'all',
  },
  {
    id: 'source-mode',
    name: 'Source Mode',
    description: 'Switch to markdown source mode',
    keys: ['Ctrl', 'Shift', 'S'],
    category: 'view',
    platform: 'all',
  },
  {
    id: 'split-mode',
    name: 'Split Mode',
    description: 'Switch to split view mode',
    keys: ['Ctrl', 'Shift', 'P'],
    category: 'view',
    platform: 'all',
  },
  {
    id: 'preview-mode',
    name: 'Preview Mode',
    description: 'Switch to preview mode',
    keys: ['Ctrl', 'Shift', 'V'],
    category: 'view',
    platform: 'all',
  },
  {
    id: 'toggle-sidebar',
    name: 'Toggle Sidebar',
    description: 'Show or hide the file browser sidebar',
    keys: ['Ctrl', '`'],
    category: 'view',
    platform: 'all',
  },
  {
    id: 'fullscreen',
    name: 'Toggle Fullscreen',
    description: 'Enter or exit fullscreen mode',
    keys: ['F11'],
    category: 'view',
    platform: 'all',
  },

  // Application
  {
    id: 'settings',
    name: 'Open Settings',
    description: 'Open application settings',
    keys: ['Ctrl', ','],
    category: 'application',
    platform: 'all',
  },
  {
    id: 'command-palette',
    name: 'Command Palette',
    description: 'Open command palette',
    keys: ['Ctrl', 'Shift', 'P'],
    category: 'application',
    platform: 'all',
  },
  {
    id: 'help',
    name: 'Show Help',
    description: 'Open help documentation',
    keys: ['Ctrl', '?'],
    category: 'application',
    platform: 'all',
  },
  {
    id: 'shortcuts',
    name: 'Keyboard Shortcuts',
    description: 'Show this shortcuts reference',
    keys: ['Ctrl', 'Shift', '?'],
    category: 'application',
    platform: 'all',
  },

  // Advanced
  {
    id: 'debug-panel',
    name: 'Debug Panel',
    description: 'Open developer debug panel',
    keys: ['Ctrl', 'Shift', 'D'],
    category: 'advanced',
    platform: 'all',
    context: 'Development mode',
  },
  {
    id: 'reload-app',
    name: 'Reload Application',
    description: 'Reload the entire application',
    keys: ['Ctrl', 'R'],
    category: 'advanced',
    platform: 'all',
  },
  {
    id: 'developer-tools',
    name: 'Developer Tools',
    description: 'Open browser developer tools',
    keys: ['F12'],
    category: 'advanced',
    platform: 'all',
    context: 'Development mode',
  },
];

// Platform-specific key mappings
const PLATFORM_KEYS: Record<string, Record<string, string>> = {
  mac: {
    'Ctrl': '⌘',
    'Alt': '⌥',
    'Shift': '⇧',
    'Enter': '↩',
    'Backspace': '⌫',
    'Delete': '⌦',
    'Tab': '⇥',
    'Esc': '⎋',
  },
  windows: {
    'Ctrl': 'Ctrl',
    'Alt': 'Alt',
    'Shift': 'Shift',
    'Enter': 'Enter',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'Tab': 'Tab',
    'Esc': 'Esc',
  },
  linux: {
    'Ctrl': 'Ctrl',
    'Alt': 'Alt',
    'Shift': 'Shift',
    'Enter': 'Enter',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'Tab': 'Tab',
    'Esc': 'Esc',
  },
};

// === KEYBOARD SHORTCUTS REFERENCE COMPONENT ===

/**
 * Keyboard shortcuts reference overlay component
 * 
 * Displays a comprehensive, searchable reference of all keyboard shortcuts
 * organized by category with platform-specific key representations.
 */
export const KeyboardShortcutsReference: React.FC<KeyboardShortcutsReferenceProps> = ({
  isOpen,
  onClose,
  onCustomizeShortcut,
  platform = 'windows',
  className = '',
}) => {
  // === STATE ===
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('by-category');

  // === DERIVED STATE ===
  const platformKeys = PLATFORM_KEYS[platform] || PLATFORM_KEYS.windows;

  const filteredShortcuts = useMemo(() => {
    let shortcuts = KEYBOARD_SHORTCUTS;

    // Filter by category
    if (selectedCategory !== 'all') {
      shortcuts = shortcuts.filter(shortcut => shortcut.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      shortcuts = shortcuts.filter(shortcut => 
        shortcut.name.toLowerCase().includes(query) ||
        shortcut.description.toLowerCase().includes(query) ||
        shortcut.keys.some(key => key.toLowerCase().includes(query))
      );
    }

    return shortcuts;
  }, [searchQuery, selectedCategory]);

  const shortcutsByCategory = useMemo(() => {
    const grouped: Record<string, KeyboardShortcut[]> = {};
    
    Object.keys(SHORTCUT_CATEGORIES).forEach(categoryId => {
      grouped[categoryId] = KEYBOARD_SHORTCUTS.filter(
        shortcut => shortcut.category === categoryId
      );
    });

    return grouped;
  }, []);

  // === HANDLERS ===
  const handleExportShortcuts = () => {
    const shortcutsText = KEYBOARD_SHORTCUTS
      .map(shortcut => `${shortcut.name}: ${shortcut.keys.join(' + ')}`)
      .join('\n');
    
    const blob = new Blob([shortcutsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'keyboard-shortcuts.txt';
    a.click();
    URL.revokeObjectURL(url);
  };


  // === RENDER HELPERS ===
  const formatKeys = (keys: string[]): React.ReactNode => {
    return keys.map((key, index) => (
      <React.Fragment key={key}>
        {index > 0 && <span className="mx-1 text-muted-foreground">+</span>}
        <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border">
          {platformKeys[key] || key}
        </kbd>
      </React.Fragment>
    ));
  };

  const renderShortcutItem = (shortcut: KeyboardShortcut) => (
    <div key={shortcut.id} className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-1">
          <h4 className="font-medium text-sm">{shortcut.name}</h4>
          {shortcut.context && (
            <Badge variant="outline" className="text-xs">
              {shortcut.context}
            </Badge>
          )}
          {shortcut.customizable && (
            <Badge variant="secondary" className="text-xs">
              Customizable
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{shortcut.description}</p>
      </div>
      <div className="flex items-center space-x-2">
        <div className="flex items-center">
          {formatKeys(shortcut.keys)}
        </div>
        {shortcut.customizable && onCustomizeShortcut && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCustomizeShortcut(shortcut.id)}
          >
            <Settings className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );

  const renderCategoryView = () => (
    <div className="space-y-6">
      {Object.entries(shortcutsByCategory).map(([categoryId, shortcuts]) => {
        const category = SHORTCUT_CATEGORIES[categoryId];
        
        return (
          <Card key={categoryId}>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <div className={`p-2 rounded ${category.color} text-white`}>
                  {category.icon}
                </div>
                <div>
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {category.description} • {shortcuts.length} shortcuts
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {shortcuts.map(renderShortcutItem)}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-2">
      {filteredShortcuts.map(renderShortcutItem)}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 bg-black/80 ${className}`}>
      <div className="fixed inset-4 bg-background rounded-lg shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Keyboard className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
            <Badge variant="outline" className="text-xs">
              {filteredShortcuts.length} shortcuts
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={handleExportShortcuts}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shortcuts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.values(SHORTCUT_CATEGORIES).map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="by-category">By Category</TabsTrigger>
              <TabsTrigger value="list">List View</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          <Tabs value={activeTab} className="w-full">
            <TabsContent value="by-category" className="mt-0">
              {renderCategoryView()}
            </TabsContent>
            <TabsContent value="list" className="mt-0">
              {renderListView()}
            </TabsContent>
          </Tabs>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span>Platform: {platform}</span>
              <span>
                Customizable shortcuts: {KEYBOARD_SHORTCUTS.filter(s => s.customizable).length}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span>Press</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border">
                {platformKeys['Ctrl'] || 'Ctrl'}
              </kbd>
              <span>+</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border">
                ?
              </kbd>
              <span>to show help</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// === UTILITY FUNCTIONS ===

/**
 * Get all keyboard shortcuts for a specific category
 */
export const getShortcutsByCategory = (category: string): KeyboardShortcut[] => {
  return KEYBOARD_SHORTCUTS.filter(shortcut => shortcut.category === category);
};

/**
 * Get a keyboard shortcut by ID
 */
export const getShortcutById = (id: string): KeyboardShortcut | undefined => {
  return KEYBOARD_SHORTCUTS.find(shortcut => shortcut.id === id);
};

/**
 * Format keyboard shortcut for display
 */
export const formatShortcut = (keys: string[], platform: string = 'windows'): string => {
  const platformKeys = PLATFORM_KEYS[platform] || PLATFORM_KEYS.windows;
  return keys.map(key => platformKeys[key] || key).join(' + ');
};

// === EXPORTS ===
export default KeyboardShortcutsReference;
export { KEYBOARD_SHORTCUTS, SHORTCUT_CATEGORIES, PLATFORM_KEYS };
export type { KeyboardShortcut, ShortcutCategory, KeyboardShortcutsReferenceProps };