# Custom Hooks Architecture

GTD Space uses a custom hooks pattern for state management, avoiding the complexity of Redux or MobX while maintaining clean separation of concerns.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  App.tsx                         │
│         (Orchestrates all hooks)                 │
└────────────────────┬────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│   Domain  │ │Infrastructure│ │Integration │
│   Hooks   │ │    Hooks     │ │   Hooks    │
├───────────┤ ├──────────────┤ ├────────────┤
│FileManager│ │ErrorHandler  │ │FileWatcher │
│TabManager │ │ModalManager  │ │GlobalSearch│
│Settings   │ │KeyboardHooks │ │            │
└───────────┘ └──────────────┘ └────────────┘
```

## Hook Categories

### 1. Domain Hooks
Handle business logic for specific features.

### 2. Infrastructure Hooks
Provide cross-cutting services used by other hooks.

### 3. Integration Hooks
Connect to external systems (Tauri backend).

## Domain Hooks

### useFileManager

Manages file operations and folder state.

```typescript
export const useFileManager = () => {
  const [state, setState] = useState<FileManagerState>({
    currentFolder: null,
    files: [],
    searchQuery: '',
    loading: false,
    error: null,
  });

  const selectFolder = async () => {
    const folderPath = await invoke<string>('select_folder');
    await loadFolder(folderPath);
  };

  const loadFolder = async (folderPath: string) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const files = await invoke<MarkdownFile[]>('list_markdown_files', {
        path: folderPath
      });
      setState(prev => ({
        ...prev,
        currentFolder: folderPath,
        files,
        loading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        loading: false,
      }));
    }
  };

  const handleFileOperation = async (operation: FileOperation) => {
    // Create, rename, delete logic
  };

  return {
    state,
    selectFolder,
    loadFolder,
    handleFileOperation,
    setSearchQuery,
  };
};
```

**Key Features:**
- Folder selection and loading
- File CRUD operations
- Search filtering
- Error handling

### useTabManager

Manages multi-tab editing with auto-save.

```typescript
interface TabManagerState {
  openTabs: FileTab[];
  activeTabId: string | null;
  maxTabs: number;
  recentlyClosed: FileTab[];
}

export const useTabManager = () => {
  const [tabState, setTabState] = useState<TabManagerState>({
    openTabs: [],
    activeTabId: null,
    maxTabs: 10,
    recentlyClosed: [],
  });

  // Auto-save logic
  const debouncedSave = useMemo(
    () => debounce(async (tabId: string, content: string) => {
      const tab = tabState.openTabs.find(t => t.id === tabId);
      if (tab) {
        await invoke('save_file', {
          path: tab.file.path,
          content,
        });
        updateTabSavedState(tabId, true);
      }
    }, 2000),
    [tabState.openTabs]
  );

  const openTab = async (file: MarkdownFile): Promise<string> => {
    // Check if already open
    const existingTab = tabState.openTabs.find(
      tab => tab.file.path === file.path
    );
    
    if (existingTab) {
      activateTab(existingTab.id);
      return existingTab.id;
    }

    // Check tab limit
    if (tabState.openTabs.length >= MAX_TABS) {
      throw new Error(`Maximum ${MAX_TABS} tabs allowed`);
    }

    // Read file content
    const content = await invoke<string>('read_file', {
      path: file.path
    });

    // Create new tab
    const newTab: FileTab = {
      id: generateTabId(),
      file,
      content,
      originalContent: content,
      hasUnsavedChanges: false,
      isActive: false,
    };

    addTab(newTab);
    return newTab.id;
  };

  return {
    tabState,
    activeTab,
    hasUnsavedChanges,
    openTab,
    closeTab,
    activateTab,
    updateTabContent,
    saveTab,
    saveAllTabs,
  };
};
```

**Key Features:**
- Tab lifecycle management
- Auto-save with debouncing
- Duplicate detection
- Tab persistence to localStorage
- Unsaved changes tracking

### useSettings

Manages user preferences with Tauri store persistence.

```typescript
export const useSettings = () => {
  const [settings, setSettingsState] = useState<UserSettings>({
    theme: 'dark',
    font_size: 14,
    tab_size: 2,
    word_wrap: true,
    editor_mode: 'wysiwyg',
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const loaded = await invoke<UserSettings>('load_settings');
      setSettingsState(loaded);
    };
    loadSettings();
  }, []);

  // Save settings helper
  const saveSettings = async (newSettings: UserSettings) => {
    await invoke('save_settings', { settings: newSettings });
    setSettingsState(newSettings);
  };

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    const updated = { ...settings, [key]: value };
    await saveSettings(updated);
  };

  return {
    settings,
    setTheme: (theme: Theme) => updateSetting('theme', theme),
    setFontSize: (size: number) => updateSetting('font_size', size),
    setTabSize: (size: number) => updateSetting('tab_size', size),
    setWordWrap: (wrap: boolean) => updateSetting('word_wrap', wrap),
    setEditorMode: (mode: EditorMode) => updateSetting('editor_mode', mode),
  };
};
```

## Infrastructure Hooks

### useErrorHandler

Provides centralized error handling with toast notifications.

```typescript
export const useErrorHandler = () => {
  const { toast } = useToast();

  const withErrorHandling = async <T>(
    operation: () => Promise<T>,
    userMessage: string,
    category?: string
  ): Promise<T | null> => {
    try {
      return await operation();
    } catch (error) {
      console.error(`[${category || 'general'}] Error:`, error);
      
      toast({
        title: "Error",
        description: userMessage,
        variant: "destructive",
      });
      
      return null;
    }
  };

  const showError = (message: string) => {
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    });
  };

  const showSuccess = (message: string) => {
    toast({
      title: "Success",
      description: message,
    });
  };

  return {
    withErrorHandling,
    showError,
    showSuccess,
  };
};
```

**Usage Pattern:**
```typescript
const { withErrorHandling } = useErrorHandler();

const result = await withErrorHandling(
  async () => await invoke('read_file', { path }),
  'Failed to read file',
  'file_operation'
);
```

### useModalManager

Centralized modal state management.

```typescript
type ModalType = 'settings' | 'globalSearch' | 'keyboardShortcuts';

export const useModalManager = () => {
  const [openModals, setOpenModals] = useState<Set<ModalType>>(new Set());

  const openModal = (modal: ModalType) => {
    setOpenModals(prev => new Set(prev).add(modal));
  };

  const closeModal = (modal?: ModalType) => {
    if (modal) {
      setOpenModals(prev => {
        const next = new Set(prev);
        next.delete(modal);
        return next;
      });
    } else {
      // Close all modals
      setOpenModals(new Set());
    }
  };

  const isModalOpen = (modal: ModalType) => openModals.has(modal);

  return {
    openModal,
    closeModal,
    isModalOpen,
    closeAllModals: () => closeModal(),
  };
};
```

### useKeyboardShortcuts

Platform-aware keyboard shortcut management.

```typescript
interface KeyboardHandlers {
  onSave?: () => void;
  onOpenFolder?: () => void;
  onNewFile?: () => void;
  onCloseTab?: () => void;
  onNextTab?: () => void;
  onPreviousTab?: () => void;
  onToggleSearch?: () => void;
  onShowKeyboardShortcuts?: () => void;
}

export const useKeyboardShortcuts = (handlers: KeyboardHandlers) => {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const mod = isMac ? 'cmd' : 'ctrl';

  // Save
  useHotkeys(`${mod}+s`, (e) => {
    e.preventDefault();
    handlers.onSave?.();
  });

  // Open folder
  useHotkeys(`${mod}+o`, (e) => {
    e.preventDefault();
    handlers.onOpenFolder?.();
  });

  // New file
  useHotkeys(`${mod}+n`, (e) => {
    e.preventDefault();
    handlers.onNewFile?.();
  });

  // Tab navigation
  useHotkeys(`${mod}+tab`, handlers.onNextTab);
  useHotkeys(`${mod}+shift+tab`, handlers.onPreviousTab);

  // Show shortcuts
  useHotkeys(`${mod}+/`, handlers.onShowKeyboardShortcuts);
};
```

## Integration Hooks

### useFileWatcher

Monitors file system changes.

```typescript
export const useFileWatcher = () => {
  const [state, setState] = useState<FileWatcherState>({
    isWatching: false,
    recentEvents: [],
  });

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<FileChangeEvent>('file-changed', (event) => {
        setState(prev => ({
          ...prev,
          recentEvents: [...prev.recentEvents, event.payload].slice(-10),
        }));
      });
    };

    if (state.isWatching) {
      setupListener();
    }

    return () => {
      unlisten?.();
    };
  }, [state.isWatching]);

  const startWatching = async (folderPath: string) => {
    await invoke('start_file_watcher', { folder_path: folderPath });
    setState(prev => ({ ...prev, isWatching: true }));
  };

  const stopWatching = async () => {
    await invoke('stop_file_watcher');
    setState(prev => ({ 
      ...prev, 
      isWatching: false,
      recentEvents: [] 
    }));
  };

  return {
    state,
    startWatching,
    stopWatching,
  };
};
```

### useGlobalSearch

File search functionality.

```typescript
export const useGlobalSearch = (currentFolder: string | null) => {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    results: [],
    isSearching: false,
    filters: {
      case_sensitive: false,
      whole_word: false,
      use_regex: false,
      include_file_names: true,
      max_results: 100,
    },
  });

  const performSearch = async () => {
    if (!currentFolder || !searchState.query.trim()) return;

    setSearchState(prev => ({ ...prev, isSearching: true }));

    const response = await invoke<SearchResponse>('search_files', {
      query: searchState.query,
      directory: currentFolder,
      filters: searchState.filters,
    });

    setSearchState(prev => ({
      ...prev,
      results: response.results,
      isSearching: false,
    }));
  };

  const debouncedSearch = useMemo(
    () => debounce(performSearch, 300),
    [currentFolder, searchState.query, searchState.filters]
  );

  return {
    searchState,
    setQuery,
    updateFilter,
    performSearch: debouncedSearch,
    clearResults,
  };
};
```

## Hook Composition

Hooks can compose other hooks for complex functionality:

```typescript
// useTabManager uses useFileManager and useErrorHandler
export const useTabManager = () => {
  const { withErrorHandling } = useErrorHandler();
  
  const openTab = async (file: MarkdownFile) => {
    const content = await withErrorHandling(
      async () => await invoke<string>('read_file', { path: file.path }),
      `Failed to open ${file.name}`
    );
    
    if (!content) return null;
    // ... rest of logic
  };
};
```

## Best Practices

### 1. Single Responsibility
Each hook should handle one specific domain or concern.

### 2. Error Handling
Always use `withErrorHandling` for async operations:
```typescript
const result = await withErrorHandling(
  async () => await riskyOperation(),
  'User-friendly error message'
);
```

### 3. State Updates
Use functional updates to avoid stale closures:
```typescript
setState(prev => ({ ...prev, loading: true }));
```

### 4. Cleanup
Always cleanup subscriptions and timers:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {}, 1000);
  return () => clearTimeout(timer);
}, []);
```

### 5. Memoization
Memoize expensive operations and callbacks:
```typescript
const expensiveValue = useMemo(
  () => computeExpensive(deps),
  [deps]
);

const stableCallback = useCallback(
  () => doSomething(deps),
  [deps]
);
```

## Testing Hooks

### Testing Pattern
```typescript
import { renderHook, act } from '@testing-library/react-hooks';

test('useFileManager loads files', async () => {
  const { result } = renderHook(() => useFileManager());
  
  await act(async () => {
    await result.current.loadFolder('/test/path');
  });
  
  expect(result.current.state.files).toHaveLength(3);
});
```

### Mocking Tauri
```typescript
// Mock invoke for tests
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn((cmd, args) => {
    if (cmd === 'list_markdown_files') {
      return Promise.resolve(mockFiles);
    }
  }),
}));
```

## Performance Tips

1. **Debounce Expensive Operations**
   ```typescript
   const debouncedSave = useMemo(
     () => debounce(save, 2000),
     []
   );
   ```

2. **Limit State Updates**
   ```typescript
   // Batch multiple updates
   setState(prev => ({
     ...prev,
     field1: value1,
     field2: value2,
   }));
   ```

3. **Avoid Unnecessary Re-renders**
   ```typescript
   // Split state when parts update independently
   const [files, setFiles] = useState([]);
   const [loading, setLoading] = useState(false);
   ```

4. **Use React.memo for Components**
   ```typescript
   export const ExpensiveComponent = React.memo(({ data }) => {
     // Component logic
   });
   ```