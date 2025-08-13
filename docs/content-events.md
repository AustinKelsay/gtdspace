# Content Event System

## Overview
GTD Space uses a centralized event bus system for managing content changes and metadata updates across the application. This ensures real-time synchronization between different UI components without tight coupling.

## Architecture

### Event Bus (`src/utils/content-event-bus.ts`)
The `ContentEventBus` class provides:
- Event subscription/unsubscription
- Event emission with automatic propagation
- Metadata caching
- Infinite loop prevention

### Event Types
```typescript
type ContentEventType = 
  | 'content:changed'      // Any content change
  | 'content:saved'        // Content saved to disk
  | 'content:metadata-changed' // Metadata fields changed
  | 'file:created'         // New file created
  | 'file:deleted'         // File deleted
  | 'file:renamed'         // File renamed
```

### Event Structure
```typescript
type ContentChangeEvent = {
  filePath: string;
  fileName: string;
  content: string;
  metadata: FileMetadata;
  changedFields?: Partial<FileMetadata>;
  timestamp: number;
};
```

## Key Features

### Automatic Event Propagation
Specific events automatically emit to the general `content:changed` event:
- This allows components to listen to all changes or specific types
- Prevents need for multiple subscriptions

### Infinite Loop Prevention
The event bus includes a guard against recursive emissions:
```typescript
private isEmitting = false;

emit(eventType: ContentEventType, event: ContentChangeEvent): void {
  if (this.isEmitting && eventType === 'content:changed') {
    return; // Prevent recursive emission
  }
  // ... emit logic
}
```

### Metadata Caching
- The event bus caches file metadata for quick access
- Reduces need for repeated file reads
- Cache can be cleared per-file or globally

## Usage Examples

### Subscribing to Events
```typescript
import { onContentChange, onMetadataChange } from '@/utils/content-event-bus';

// Listen for any content change
const unsubscribe = onContentChange((event) => {
  console.log('Content changed:', event.filePath);
});

// Listen for metadata changes specifically
const unsubMeta = onMetadataChange((event) => {
  if (event.changedFields?.status) {
    console.log('Status changed to:', event.metadata.status);
  }
});
```

### Emitting Events
```typescript
import { emitContentSaved, emitMetadataChange } from '@/utils/content-event-bus';

// Emit when content is saved
emitContentSaved({
  filePath: '/path/to/file.md',
  fileName: 'file.md',
  content: markdownContent,
  metadata: extractedMetadata
});

// Emit when metadata changes
emitMetadataChange({
  filePath: '/path/to/file.md',
  fileName: 'file.md',
  content: markdownContent,
  metadata: newMetadata,
  changedFields: { status: 'complete' }
});
```

## Integration Points

### TabManager Hook
- Emits content change events when tab content is updated
- Emits metadata change events when specific fields change
- Emits content saved events after successful save

### GTD Workspace Sidebar
- Subscribes to metadata changes for real-time status updates
- Subscribes to content saved events for title-based file/folder renaming
- Updates UI immediately without reloading

### Custom Rename Events
The system also uses custom DOM events for specific rename operations:
- `project-renamed` - When a project folder is renamed
- `action-renamed` - When an action file is renamed
- `section-file-renamed` - When a Someday Maybe or Cabinet file is renamed

These events ensure open tabs update their paths when files are renamed.

## Performance Considerations

### Parallel Event Processing
Event callbacks are executed synchronously but operations within can be parallel:
- Status loading for multiple actions uses `Promise.all()`
- Project prefetching loads all projects in parallel

### Debouncing
While the event bus itself doesn't debounce, consumers typically implement debouncing:
- Auto-save has a 2s debounce
- File watcher has a 500ms debounce

## Best Practices

1. **Always Unsubscribe**: Store the unsubscribe function and call it in cleanup
2. **Check Changed Fields**: Use `changedFields` to avoid unnecessary updates
3. **Handle Errors**: Wrap callback logic in try-catch blocks
4. **Avoid Heavy Operations**: Keep event handlers lightweight
5. **Use Specific Events**: Subscribe to specific event types when possible