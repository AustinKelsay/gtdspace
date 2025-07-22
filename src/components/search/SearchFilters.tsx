/**
 * @fileoverview Search filters component for configuring search options
 * @author Development Team
 * @created 2024-01-XX
 * @phase 2 - Search filters UI
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { BaseComponentProps, SearchFilters as SearchFiltersType } from '@/types';

export interface SearchFiltersProps extends BaseComponentProps {
  /** Current search filters */
  filters: SearchFiltersType;
  /** Callback when filters change */
  onChange: (filters: Partial<SearchFiltersType>) => void;
}

/**
 * Component for configuring search filters and options
 */
export const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  onChange,
  className = '',
  ...props
}) => {
  const maxResultsOptions = [50, 100, 200, 500];

  const handleToggle = (key: keyof SearchFiltersType, value: boolean) => {
    onChange({ [key]: value });
  };

  const handleMaxResultsChange = (value: number) => {
    onChange({ max_results: value });
  };

  const resetFilters = () => {
    onChange({
      case_sensitive: false,
      whole_word: false,
      use_regex: false,
      include_file_names: true,
      max_results: 100,
    });
  };

  return (
    <Card className={`p-4 ${className}`} {...props}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Search Options</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-xs"
          >
            Reset
          </Button>
        </div>

        {/* Toggle Options */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.case_sensitive}
              onChange={(e) => handleToggle('case_sensitive', e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm">Case sensitive</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.whole_word}
              onChange={(e) => handleToggle('whole_word', e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm">Whole word</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.use_regex}
              onChange={(e) => handleToggle('use_regex', e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm">Use regex</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.include_file_names}
              onChange={(e) => handleToggle('include_file_names', e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm">Include filenames</span>
          </label>
        </div>

        {/* Max Results */}
        <div className="space-y-2">
          <Label className="text-sm">Max Results</Label>
          <div className="flex gap-2">
            {maxResultsOptions.map((count) => (
              <Button
                key={count}
                variant={filters.max_results === count ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMaxResultsChange(count)}
                className="text-xs"
              >
                {count}
              </Button>
            ))}
          </div>
        </div>

        {/* Help Text */}
        {filters.use_regex && (
          <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded">
            <strong>Regex mode:</strong> Use regular expressions for advanced pattern matching.
            <br />
            Example: <code className="bg-muted px-1 rounded">TODO|FIXME</code> finds either TODO or FIXME.
          </div>
        )}

        {filters.whole_word && (
          <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded">
            <strong>Whole word:</strong> Only matches complete words.
            <br />
            "cat" will not match "category" or "locate".
          </div>
        )}
      </div>
    </Card>
  );
};

export default SearchFilters;