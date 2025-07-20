# Tech Stack Guide - Tauri Markdown Editor

> **Purpose:** This document outlines best practices, limitations, conventions, and common pitfalls for the selected technologies in the Tauri Markdown Editor project. It serves as a technical reference for maintaining code quality and avoiding common issues during development.

## Technology Overview

The tech stack is designed for **cross-platform desktop development** with **native performance** and **modern web technologies**. Each technology serves specific purposes in the three-phase development approach outlined in the project plan.

---

## Core Framework - Tauri 2.x

### Overview
**Purpose:** Cross-platform desktop application framework using Rust backend with web frontend
**Role in Project:** Application shell, file system operations, native desktop integration

### Best Practices

#### Security Model
```javascript
// ✅ GOOD: Always validate inputs before Rust calls
const safeFilePath = sanitizeFilePath(userInput);
await invoke('read_file', { path: safeFilePath });

// ❌ BAD: Direct user input to Rust functions
await invoke('read_file', { path: userInput });
```

#### Permission Management
```json
// tauri.conf.json - Be explicit about permissions
{
  "permissions": [
    "fs:allow-read-dir",
    "fs:allow-write-file", 
    "dialog:allow-open",
    "dialog:allow-save"
  ]
}
```

#### Command Structure
```rust
// ✅ GOOD: Structured command with proper error handling
#[tauri::command]
async fn read_markdown_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

// ❌ BAD: Unstructured command without error handling
#[tauri::command]
fn read_file(path: String) -> String {
    std::fs::read_to_string(path).unwrap() // Will crash on error
}
```

### Limitations & Considerations

1. **File System Access:** Tauri's security model restricts file access - plan permission scope carefully
2. **Bundle Size:** Rust backend adds ~10-15MB to final bundle
3. **Platform Differences:** Some APIs behave differently across Windows/macOS/Linux
4. **Development Complexity:** Requires Rust knowledge for backend modifications
5. **Hot Reload Limitations:** Rust changes require full rebuild

### Common Pitfalls

- **Over-requesting permissions:** Request minimal permissions needed for functionality
- **Blocking UI with heavy operations:** Use async/await for all file operations
- **Inconsistent error handling:** Always handle Rust command errors gracefully
- **Platform assumptions:** Test file path handling on all target platforms

---

## Frontend Framework - React 18 + TypeScript

### Overview
**Purpose:** Component-based UI framework with type safety
**Role in Project:** All user interface components, state management, user interactions

### Best Practices

#### Component Structure
```typescript
// ✅ GOOD: Functional component with proper typing
interface FileListProps {
  files: MarkdownFile[];
  onFileSelect: (file: MarkdownFile) => void;
  selectedFile?: MarkdownFile;
}

const FileList: React.FC<FileListProps> = ({ 
  files, 
  onFileSelect, 
  selectedFile 
}) => {
  // Component implementation
};
```

#### State Management Patterns
```typescript
// ✅ GOOD: Custom hook for complex state
const useFileManager = () => {
  const [files, setFiles] = useState<MarkdownFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadFiles = useCallback(async (folderPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const fileList = await invoke('list_markdown_files', { path: folderPath });
      setFiles(fileList);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { files, loading, error, loadFiles };
};
```

#### Performance Optimization
```typescript
// ✅ GOOD: Memoization for expensive operations
const FileListItem = React.memo<FileListItemProps>(({ file, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(file);
  }, [file, onSelect]);
  
  return (
    <div onClick={handleClick} className="file-item">
      {file.name}
    </div>
  );
});

// ✅ GOOD: Virtual scrolling for large file lists (Phase 3)
import { FixedSizeList as List } from 'react-window';

const VirtualizedFileList: React.FC<Props> = ({ files }) => (
  <List
    height={400}
    itemCount={files.length}
    itemSize={32}
    itemData={files}
  >
    {FileListItem}
  </List>
);
```

### TypeScript Conventions

#### Type Definitions
```typescript
// ✅ GOOD: Comprehensive type definitions
interface MarkdownFile {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly size: number;
  readonly lastModified: Date;
  readonly content?: string; // Lazy loaded
}

interface EditorState {
  readonly currentFile: MarkdownFile | null;
  readonly unsavedChanges: boolean;
  readonly editorMode: 'wysiwyg' | 'source' | 'split';
  readonly searchQuery: string;
}

// ✅ GOOD: Union types for specific states
type FileOperation = 
  | { type: 'create'; name: string }
  | { type: 'rename'; oldName: string; newName: string }
  | { type: 'delete'; name: string };
```

#### Error Handling Patterns
```typescript
// ✅ GOOD: Discriminated union for error states
type AsyncState<T> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

const useAsyncOperation = <T>() => {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' });
  
  const execute = async (operation: () => Promise<T>) => {
    setState({ status: 'loading' });
    try {
      const data = await operation();
      setState({ status: 'success', data });
    } catch (error) {
      setState({ status: 'error', error: error.message });
    }
  };
  
  return [state, execute] as const;
};
```

### Limitations & Considerations

1. **Bundle Size:** React adds ~100KB to bundle; consider code splitting for Phase 2/3
2. **Re-render Performance:** Large file lists may cause performance issues without virtualization
3. **Memory Usage:** Be careful with editor content in memory for multiple open files
4. **Type Safety:** TypeScript doesn't guarantee runtime type safety with external data

### Common Pitfalls

- **Missing dependencies in useEffect:** Always include all dependencies
- **Direct state mutation:** Use immutable update patterns
- **Prop drilling:** Use Context API or custom hooks for deeply nested props
- **Unnecessary re-renders:** Use React.memo and useCallback appropriately

---

## Styling Framework - Tailwind CSS

### Overview
**Purpose:** Utility-first CSS framework for rapid UI development
**Role in Project:** All styling, responsive design, theming system

### Best Practices

#### Configuration Setup
```javascript
// tailwind.config.js - Project-specific configuration
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class', // Enable manual dark mode switching
  theme: {
    extend: {
      colors: {
        // Custom color palette for markdown editor
        editor: {
          bg: '#1e1e1e',
          text: '#d4d4d4',
          accent: '#007acc'
        },
        sidebar: {
          bg: '#252526',
          hover: '#2a2d2e'
        }
      },
      typography: {
        // Custom typography for markdown content
        markdown: {
          css: {
            maxWidth: 'none',
            color: 'var(--tw-prose-body)',
            h1: { fontSize: '2rem' },
            h2: { fontSize: '1.5rem' },
            code: {
              backgroundColor: 'var(--tw-prose-pre-bg)',
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem'
            }
          }
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography') // For markdown content styling
  ]
};
```

#### Component Styling Patterns
```typescript
// ✅ GOOD: Reusable component classes
const buttonStyles = {
  base: "px-4 py-2 rounded-lg font-medium transition-colors",
  variants: {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-gray-200 hover:bg-gray-300 text-gray-900",
    ghost: "hover:bg-gray-100 text-gray-700"
  }
};

const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, ...props }) => (
  <button 
    className={`${buttonStyles.base} ${buttonStyles.variants[variant]}`}
    {...props}
  >
    {children}
  </button>
);
```

#### Responsive Design
```typescript
// ✅ GOOD: Mobile-first responsive layout
const Layout: React.FC = ({ children }) => (
  <div className="flex flex-col md:flex-row h-screen">
    {/* Sidebar - collapsible on mobile */}
    <aside className="w-full md:w-64 bg-sidebar-bg border-r border-gray-300 dark:border-gray-600">
      <div className="hidden md:block">
        {/* Desktop sidebar content */}
      </div>
      <div className="md:hidden">
        {/* Mobile hamburger menu */}
      </div>
    </aside>
    
    {/* Main content area */}
    <main className="flex-1 overflow-hidden">
      {children}
    </main>
  </div>
);
```

#### Dark Mode Implementation
```typescript
// ✅ GOOD: Theme context with Tailwind classes
const ThemeContext = createContext<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>({
  theme: 'light',
  toggleTheme: () => {}
});

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    // Apply theme class to document root
    document.documentElement.className = theme;
  }, [theme]);
  
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {children}
      </div>
    </ThemeContext.Provider>
  );
};
```

### Limitations & Considerations

1. **Learning Curve:** Utility-first approach requires different mental model
2. **Class Name Length:** Complex components can have very long className strings
3. **Design System Consistency:** Need discipline to maintain consistent spacing/sizing
4. **Build Size:** Unused classes can bloat CSS if not properly purged

### Common Pitfalls

- **Not using purge/content configuration:** Results in large CSS bundles
- **Inconsistent spacing:** Use systematic spacing scale (4px, 8px, 16px, etc.)
- **Overriding with custom CSS:** Defeats the purpose of utility-first approach
- **Missing responsive breakpoints:** Always consider mobile-first design

---

## Rich Text Editor - Tiptap/ProseMirror

### Overview
**Purpose:** WYSIWYG markdown editor with extensible architecture
**Role in Project:** Phase 2 rich editing, block-based content creation, markdown serialization

### Best Practices

#### Editor Setup & Configuration
```typescript
// ✅ GOOD: Modular editor configuration
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { lowlight } from 'lowlight';

const useMarkdownEditor = (initialContent: string, onChange: (content: string) => void) => {
  return useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      // Convert to markdown and trigger save
      const markdownContent = editor.storage.markdown.getMarkdown();
      onChange(markdownContent);
    },
  });
};
```

#### Custom Extensions
```typescript
// ✅ GOOD: Custom extension for markdown-specific features
import { Node, mergeAttributes } from '@tiptap/core';

const MarkdownFrontmatter = Node.create({
  name: 'frontmatter',
  
  group: 'block',
  
  atom: true,
  
  addAttributes() {
    return {
      content: {
        default: '',
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'div[data-type="frontmatter"]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'frontmatter' }), 0];
  },
  
  addCommands() {
    return {
      setFrontmatter: (content: string) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { content },
        });
      },
    };
  },
});
```

#### Content Synchronization
```typescript
// ✅ GOOD: Bidirectional markdown sync
const EditorWithSync: React.FC<Props> = ({ 
  initialContent, 
  mode, 
  onContentChange 
}) => {
  const [content, setContent] = useState(initialContent);
  const [markdownSource, setMarkdownSource] = useState('');
  
  const editor = useEditor({
    extensions: [/* extensions */],
    content,
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown();
      setMarkdownSource(markdown);
      onContentChange(markdown);
    },
  });
  
  // Handle mode switching
  useEffect(() => {
    if (mode === 'source' && editor) {
      const currentMarkdown = editor.storage.markdown.getMarkdown();
      setMarkdownSource(currentMarkdown);
    } else if (mode === 'wysiwyg' && editor && markdownSource !== content) {
      editor.commands.setContent(markdownSource);
    }
  }, [mode, editor, markdownSource, content]);
  
  return (
    <div className="editor-container">
      {mode === 'wysiwyg' && (
        <EditorContent editor={editor} className="prose dark:prose-invert" />
      )}
      {mode === 'source' && (
        <textarea
          value={markdownSource}
          onChange={(e) => setMarkdownSource(e.target.value)}
          className="font-mono text-sm"
        />
      )}
    </div>
  );
};
```

### Limitations & Considerations

1. **Bundle Size:** Tiptap with extensions adds ~200-300KB to bundle
2. **Complex State Management:** ProseMirror state can be complex to debug
3. **Markdown Fidelity:** Some markdown features may not have perfect WYSIWYG representation
4. **Performance:** Large documents can impact editor performance
5. **Mobile Support:** Touch interactions need careful handling

### Common Pitfalls

- **Uncontrolled editor state:** Always manage editor lifecycle properly
- **Memory leaks:** Destroy editor instances when components unmount
- **Extension conflicts:** Some extensions may interfere with each other
- **Markdown serialization loss:** Test round-trip conversion thoroughly
- **Custom styling conflicts:** CSS specificity issues with editor content

---

## Build System - Vite

### Overview
**Purpose:** Fast development server and optimized production builds
**Role in Project:** Development experience, asset bundling, build optimization

### Best Practices

#### Configuration
```typescript
// vite.config.ts - Optimized for Tauri development
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  
  // Prevent vite from obscuring rust errors
  clearScreen: false,
  
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
  },
  
  // Environment variables with VITE_ prefix will be exposed to client-side code
  envPrefix: ['VITE_', 'TAURI_'],
  
  build: {
    // Tauri supports es2021
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
});
```

#### Code Splitting Strategy
```typescript
// ✅ GOOD: Lazy load heavy components for Phase 2/3
const WYSIWYGEditor = lazy(() => import('@/components/editors/WYSIWYGEditor'));
const AdvancedSearch = lazy(() => import('@/components/search/AdvancedSearch'));

const EditorContainer: React.FC = () => (
  <Suspense fallback={<EditorSkeleton />}>
    <WYSIWYGEditor />
  </Suspense>
);
```

### Limitations & Considerations

1. **ES Module Only:** Some older libraries may not work without configuration
2. **Development vs Production:** Behavior differences between dev and build modes
3. **Asset Handling:** File paths work differently in development vs production
4. **HMR Limitations:** Some changes require full page reload

### Common Pitfalls

- **Import path case sensitivity:** Linux builds are case-sensitive
- **Large bundle chunks:** Monitor bundle analyzer for optimization opportunities
- **Environment variable exposure:** Only VITE_ prefixed variables are exposed to client
- **Asset reference issues:** Use proper import statements for assets

---

## Backend Runtime - Rust

### Overview
**Purpose:** Native backend for file operations, performance-critical tasks, system integration
**Role in Project:** File I/O, file watching, native desktop APIs, security layer

### Best Practices

#### Error Handling
```rust
// ✅ GOOD: Comprehensive error handling
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct MarkdownFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub last_modified: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum FileError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid path: {path}")]
    InvalidPath { path: String },
    #[error("Permission denied: {path}")]
    PermissionDenied { path: String },
}

#[tauri::command]
pub async fn list_markdown_files(path: String) -> Result<Vec<MarkdownFile>, String> {
    let dir_path = Path::new(&path);
    
    if !dir_path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    if !dir_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    let mut files = Vec::new();
    
    match fs::read_dir(dir_path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if let Some(extension) = path.extension() {
                        if extension == "md" {
                            if let Ok(metadata) = entry.metadata() {
                                files.push(MarkdownFile {
                                    name: path.file_name()
                                        .unwrap_or_default()
                                        .to_string_lossy()
                                        .to_string(),
                                    path: path.to_string_lossy().to_string(),
                                    size: metadata.len(),
                                    last_modified: metadata
                                        .modified()
                                        .unwrap_or(std::time::UNIX_EPOCH)
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .unwrap_or_default()
                                        .as_secs(),
                                });
                            }
                        }
                    }
                }
            }
        }
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }
    
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(files)
}
```

#### File Watching
```rust
// ✅ GOOD: Efficient file watching system
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc;
use std::time::Duration;
use tauri::Window;

#[tauri::command]
pub async fn start_file_watching(
    window: Window,
    path: String,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel();
    
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                tx.send(event).unwrap();
            }
        },
        Config::default(),
    ).map_err(|e| format!("Failed to create watcher: {}", e))?;
    
    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch path: {}", e))?;
    
    // Handle events in separate thread
    tokio::spawn(async move {
        for event in rx {
            if event.kind.is_modify() {
                // Emit to frontend
                window.emit("file-changed", &event.paths).unwrap();
            }
        }
    });
    
    Ok(())
}
```

### Limitations & Considerations

1. **Learning Curve:** Rust's ownership model requires significant investment
2. **Compilation Time:** Rust compilation can be slow for large projects
3. **Platform Dependencies:** Some crates may not work on all platforms
4. **Async Complexity:** Mixing async and sync code requires careful planning

### Common Pitfalls

- **Blocking operations:** Always use async for I/O operations in commands
- **Memory safety assumptions:** Don't assume memory is managed like in other languages
- **Cross-platform paths:** Use Path and PathBuf instead of string manipulation
- **Error propagation:** Use proper error types instead of String errors

---

## Development Dependencies & Tooling

### Essential Dependencies

#### Core Development Tools
```json
{
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@typescript-eslint/eslint-plugin": "^5.57.1",
    "@typescript-eslint/parser": "^5.57.1",
    "eslint": "^8.38.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "prettier": "^2.8.7",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.0.2",
    "vite": "^4.3.2"
  }
}
```

#### Code Quality Configuration
```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "react-hooks/exhaustive-deps": "warn",
    "prefer-const": "error"
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### Project Structure Conventions

```
src/
├── components/           # Reusable UI components
│   ├── editors/         # Editor-related components
│   ├── file-browser/    # File management components
│   ├── search/          # Search components
│   └── ui/              # Basic UI elements
├── hooks/               # Custom React hooks
├── services/            # API calls and business logic
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── styles/              # Global styles and Tailwind config
```

---

## Performance Considerations

### Memory Management
- **File Content Caching:** Only keep active files in memory
- **Virtual Scrolling:** Implement for large file lists (>100 files)
- **Image Optimization:** Compress and lazy-load images in markdown
- **Editor Instance Management:** Destroy unused editor instances

### Bundle Optimization
- **Code Splitting:** Split by feature (Phase 1, 2, 3)
- **Tree Shaking:** Ensure all imports are tree-shakeable
- **Dynamic Imports:** Lazy load heavy dependencies
- **Asset Optimization:** Optimize images and fonts

### Runtime Performance
- **File I/O Batching:** Batch multiple file operations
- **Search Indexing:** Pre-index content for fast search
- **Debounced Operations:** Debounce auto-save and search
- **Efficient Renders:** Use React.memo and useMemo appropriately

---

## Security Considerations

### File System Security
- **Path Validation:** Always validate and sanitize file paths
- **Permission Scoping:** Use minimal necessary permissions
- **User Input Sanitization:** Sanitize all user inputs before file operations
- **Secure Defaults:** Fail securely when permissions are denied

### Data Privacy
- **Local-Only Storage:** Ensure no data leaves the user's machine
- **Secure File Handling:** Use secure file deletion for sensitive content
- **Error Information:** Don't expose file system structure in error messages

This tech stack guide provides the foundation for building a robust, performant, and maintainable Tauri markdown editor. Each technology choice supports the three-phase development approach while ensuring scalability and code quality throughout the project lifecycle. 