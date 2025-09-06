import React from 'react';
import { MultiSelect } from '@/components/ui/multi-select';

export const TestMultiSelect: React.FC = () => {
  const [value, setValue] = React.useState<string[]>(['example-tag']);
  
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Test MultiSelect Component</h2>
      <MultiSelect
        options={[
          { value: 'example-tag', label: 'Example Tag' },
          { value: 'another-tag', label: 'Another Tag' },
          { value: 'third-tag', label: 'Third Tag' }
        ]}
        value={value}
        onValueChange={setValue}
        placeholder="Select tags..."
      />
      <p className="mt-2 text-sm">Selected: {value.join(', ')}</p>
    </div>
  );
};