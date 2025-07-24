/**
 * @fileoverview File search component for Phase 1 file filtering
 * @author Development Team
 * @created 2024-01-XX
 * @phase 1 - Real-time file search and filtering
 */

import React, { useEffect } from 'react';
import { Search, X } from 'lucide-react';
// import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ValidatedInput, ValidationRules } from '@/components/validation/ValidationSystem';

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
  // autoFocus = false,
  className = '',
}) => {
  // === KEYBOARD SHORTCUTS ===
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + F to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        // Could focus the validated input if needed
      }
      
      // Escape to clear search
      if (event.key === 'Escape') {
        onChange('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onChange]);

  // === EVENT HANDLERS ===
  
  /**
   * Handle clear button click
   */
  const handleClear = () => {
    onChange('');
    // Could focus the validated input if needed
  };

  // === RENDER ===

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <ValidatedInput
          fieldId="fileSearch"
          rules={[
            ValidationRules.search.minLength(2),
            ValidationRules.search.maxLength(100),
            ValidationRules.search.validRegex(),
          ]}
          initialValue={value}
          placeholder={placeholder}
          type="search"
          className="pl-10 pr-10"
          onValueChange={onChange}
          showValidation={false}
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 hover:bg-muted z-10"
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
          Press Ctrl+F to search • Min 2 characters
        </p>
      )}
    </div>
  );
};

export default FileSearch;