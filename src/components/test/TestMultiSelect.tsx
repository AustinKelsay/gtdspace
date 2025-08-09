import React from 'react';
import { MultiSelect } from '@/components/ui/multi-select';

export const TestMultiSelect: React.FC = () => {
  const [value, setValue] = React.useState<string[]>(['not-started']);
  
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Test MultiSelect Component</h2>
      <MultiSelect
        options={[
          { value: 'not-started', label: 'Not Started' },
          { value: 'in-progress', label: 'In Progress' },
          { value: 'complete', label: 'Complete' }
        ]}
        value={value}
        onValueChange={setValue}
        placeholder="Select status..."
      />
      <p className="mt-2 text-sm">Selected: {value.join(', ')}</p>
    </div>
  );
};