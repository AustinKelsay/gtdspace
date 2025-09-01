/**
 * @fileoverview GTD Tag Selector component using MultiSelect
 * @author Development Team
 * @created 2024-01-XX
 */

import React from 'react';
import { MultiSelect, Option } from '@/components/ui/multi-select';

// Predefined GTD contexts
const GTD_CONTEXTS: Option[] = [
  { value: '@computer', label: 'Computer', group: 'Contexts' },
  { value: '@phone', label: 'Phone', group: 'Contexts' },
  { value: '@home', label: 'Home', group: 'Contexts' },
  { value: '@office', label: 'Office', group: 'Contexts' },
  { value: '@errands', label: 'Errands', group: 'Contexts' },
  { value: '@anywhere', label: 'Anywhere', group: 'Contexts' },
];

// Predefined GTD energy levels
const GTD_ENERGY_LEVELS: Option[] = [
  { value: 'high-energy', label: 'High Energy', group: 'Energy Level' },
  { value: 'medium-energy', label: 'Medium Energy', group: 'Energy Level' },
  { value: 'low-energy', label: 'Low Energy', group: 'Energy Level' },
];

// Predefined GTD time estimates
const GTD_TIME_ESTIMATES: Option[] = [
  { value: '5min', label: '< 5 minutes', group: 'Time Required' },
  { value: '15min', label: '15 minutes', group: 'Time Required' },
  { value: '30min', label: '30 minutes', group: 'Time Required' },
  { value: '1hour', label: '1 hour', group: 'Time Required' },
  { value: '2hours', label: '2+ hours', group: 'Time Required' },
];

// Project categories
const GTD_CATEGORIES: Option[] = [
  { value: 'personal', label: 'Personal', group: 'Categories' },
  { value: 'work', label: 'Work', group: 'Categories' },
  { value: 'health', label: 'Health & Fitness', group: 'Categories' },
  { value: 'finance', label: 'Finance', group: 'Categories' },
  { value: 'learning', label: 'Learning', group: 'Categories' },
  { value: 'creative', label: 'Creative', group: 'Categories' },
  { value: 'family', label: 'Family', group: 'Categories' },
  { value: 'home-garden', label: 'Home & Garden', group: 'Categories' },
];

export interface GTDTagSelectorProps {
  type: 'contexts' | 'energy' | 'time' | 'categories' | 'all';
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  maxCount?: number;
  className?: string;
  customOptions?: Option[];
}

export const GTDTagSelector: React.FC<GTDTagSelectorProps> = ({
  type,
  value = [],
  onValueChange,
  placeholder,
  maxCount,
  className,
  customOptions = []
}) => {
  // Determine which options to show based on type
  const getOptions = (): Option[] => {
    switch (type) {
      case 'contexts':
        return [...GTD_CONTEXTS, ...customOptions];
      case 'energy':
        return [...GTD_ENERGY_LEVELS, ...customOptions];
      case 'time':
        return [...GTD_TIME_ESTIMATES, ...customOptions];
      case 'categories':
        return [...GTD_CATEGORIES, ...customOptions];
      case 'all':
        return [
          ...GTD_CONTEXTS,
          ...GTD_ENERGY_LEVELS,
          ...GTD_TIME_ESTIMATES,
          ...GTD_CATEGORIES,
          ...customOptions
        ];
      default:
        return customOptions;
    }
  };

  // Get appropriate placeholder
  const getPlaceholder = (): string => {
    if (placeholder) return placeholder;

    switch (type) {
      case 'contexts':
        return 'Select contexts...';
      case 'energy':
        return 'Select energy levels...';
      case 'time':
        return 'Select time estimates...';
      case 'categories':
        return 'Select categories...';
      case 'all':
        return 'Select tags...';
      default:
        return 'Select items...';
    }
  };

  // For contexts and 'all' type, ensure the UI receives '@'-prefixed values for matching options,
  // but propagate normalized values without '@' to callers.
  const displayValue = React.useMemo(() => {
    if (type !== 'contexts' && type !== 'all') return value;
    // Include both predefined contexts and custom context options
    const allContextOptions = type === 'contexts' 
      ? [...GTD_CONTEXTS, ...customOptions.filter(o => o.group === 'Contexts' || o.value.startsWith('@'))]
      : GTD_CONTEXTS;
    const contextSet = new Set(allContextOptions.map(o => o.value)); // includes values like '@computer'
    return (value || []).map(v => {
      // Normalize only if this is a context tag (with/without @)
      const hasAt = v.startsWith('@');
      const normalized = hasAt ? v : `@${v}`;
      return contextSet.has(normalized) ? normalized : v; // leave non-contexts untouched
    });
  }, [type, value, customOptions]);

  const handleChange = React.useCallback((newValue: string[]) => {
    if (!onValueChange) return;
    if (type !== 'contexts' && type !== 'all') {
      onValueChange(newValue);
      return;
    }
    // Strip '@' only for values that are recognized contexts
    const options = getOptions();
    const contextSet = new Set(
      options
        .filter(o => o.group === 'Contexts' || o.value.startsWith('@'))
        .map(o => (o.value.startsWith('@') ? o.value : `@${o.value}`))
    );
    const withoutAt = newValue.map(v => {
      const normalized = v.startsWith('@') ? v : `@${v}`;
      return contextSet.has(normalized) ? normalized.slice(1) : v;
    });
    onValueChange(withoutAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onValueChange, type, customOptions]);

  // For display options, contexts options include '@' values already
  return (
    <MultiSelect
      options={getOptions()}
      value={(type === 'contexts' || type === 'all') ? displayValue : value}
      onValueChange={(type === 'contexts' || type === 'all') ? handleChange : onValueChange}
      placeholder={getPlaceholder()}
      searchPlaceholder="Search tags..."
      maxCount={maxCount}
      className={className}
    />
  );
};

// Example usage component for demonstration
export const GTDTagExample: React.FC = () => {
  const [contexts, setContexts] = React.useState<string[]>(['@computer', '@home']);
  const [categories, setCategories] = React.useState<string[]>(['personal']);

  return (
    <div className="space-y-4 p-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Action Contexts</label>
        <GTDTagSelector
          type="contexts"
          value={contexts}
          onValueChange={setContexts}
        />
        <p className="text-sm text-muted-foreground mt-1">
          Selected: {contexts.join(', ')}
        </p>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Project Categories</label>
        <GTDTagSelector
          type="categories"
          value={categories}
          onValueChange={setCategories}
          maxCount={3}
        />
        <p className="text-sm text-muted-foreground mt-1">
          Selected: {categories.join(', ')} (max 3)
        </p>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">All Tags</label>
        <GTDTagSelector
          type="all"
          value={[]}
          onValueChange={(val) => console.log('Selected tags:', val)}
          customOptions={[
            { value: 'urgent', label: 'Urgent', group: 'Priority' },
            { value: 'important', label: 'Important', group: 'Priority' }
          ]}
        />
      </div>
    </div>
  );
};