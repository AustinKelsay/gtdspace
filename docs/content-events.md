# Content Event System

Updated: March 20, 2026

## Overview
GTD Space uses a centralized event bus system for managing content changes and metadata updates across the application. This ensures real-time synchronization between different UI components without tight coupling.

Authoritative reference:

- This is a focused implementation note for the content event bus.
- The broader runtime contract lives in [`../spec/03-runtime-behavior.md`](../spec/03-runtime-behavior.md).
- If this guide conflicts with code/tests or the `spec/` docs, the code/tests and `spec/` docs win.

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
  changedFields: { status: 'completed' }
});
```

## Integration Points

### TabManager Hook
- `useTabManager` emits content change events when tab content is updated
- It emits metadata change events when specific fields change
- It emits content saved events after successful save and after disk reloads used during conflict resolution
- The app shell currently listens to both `content:saved` and `window.onTabFileSaved` for project markdown reloads
- `useActionsData` and the tab runtime lifecycle both still invoke `window.onTabFileSaved` for compatibility alongside `content:saved`
- `window.applyBacklinkChange` remains a separate window-level integration used for targeted in-editor backlink mutations

### GTD Workspace Sidebar

- `useGTDWorkspaceSidebar` owns the sidebar subscriptions and keeps the render components passive
- Subscribes to metadata changes for real-time status and due-date overlays
- Subscribes to content saved events for title-based project/action/section-file renaming
- Forces targeted section reloads when content events affect flat sections or horizon folders
- Continues to dispatch structural DOM events after successful renames/deletes so tabs and calendar listeners stay in sync

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
- Tab metadata diffing in `useTabManager` uses a 500ms debounce
- Tab content state updates use a 150ms debounce to reduce render churn while typing
- File watcher handling still batches at the consumer level

## Best Practices

1. **Always Unsubscribe**: Store the unsubscribe function and call it in cleanup
2. **Check Changed Fields**: Use `changedFields` to avoid unnecessary updates
3. **Handle Errors**: Wrap callback logic in try-catch blocks
4. **Avoid Heavy Operations**: Keep event handlers lightweight
5. **Use Specific Events**: Subscribe to specific event types when possible
