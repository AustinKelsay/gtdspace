/**
 * @fileoverview File search component for Phase 1 file filtering
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - Real-time file search and filtering
 */

import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Props for the file search component
 */
interface FileSearchProps {
  /** Current search query */
  value: string;
  /** Callback when search query changes */
  onChange: (query: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Optional CSS class name */
  className?: string;
}

/**
 * File search component with real-time filtering
 * 
 * Provides a search input with clear functionality and keyboard shortcuts.
 * Supports real-time filtering as the user types.
 * 
 * @param props - Component props
 * @returns Search input JSX element
 * 
 * @example
 * ```tsx
 * <FileSearch 
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 *   placeholder="Search files..."
 *   autoFocus={false}
 * />
 * ```
 */
export const FileSearch: React.FC<FileSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search files...',
  autoFocus = false,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // === KEYBOARD SHORTCUTS ===
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + F to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        inputRef.current?.focus();
      }
      
      // Escape to clear search and blur
      if (event.key === 'Escape' && document.activeElement === inputRef.current) {
        onChange('');
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onChange]);

  // === EVENT HANDLERS ===
  
  /**
   * Handle input change
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  /**
   * Handle clear button click
   */
  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  // === RENDER ===

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          className="pl-10 pr-10 border-none bg-muted/50 focus:bg-background"
          autoFocus={autoFocus}
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 hover:bg-muted"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      {/* Search hint */}
      {!value && (
        <p className="mt-1 text-xs text-muted-foreground px-3">
          Press Ctrl+F to search
        </p>
      )}
    </div>
  );
};

export default FileSearch;