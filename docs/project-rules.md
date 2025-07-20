# Project Rules - Tauri Markdown Editor

> **Purpose:** This document establishes the architectural standards, coding conventions, and development practices for building an AI-first, modular, and scalable Tauri Markdown Editor. All rules prioritize code readability, maintainability, and compatibility with modern AI development tools.

## Core Principles

### AI-First Development Philosophy

1. **Maximum File Length**: 500 lines per file for optimal AI parsing and understanding
2. **Descriptive Naming**: Every file, function, and variable should be self-documenting
3. **Modular Architecture**: Small, focused modules with clear responsibilities
4. **Comprehensive Documentation**: Every file and function documented for AI context understanding
5. **Predictable Structure**: Consistent patterns that AI tools can easily navigate and modify

### Code Quality Standards

- **Single Responsibility**: Each file, function, and component serves one clear purpose
- **High Cohesion**: Related functionality grouped together
- **Loose Coupling**: Minimal dependencies between modules
- **Clear Interfaces**: Well-defined APIs between components
- **Testable Design**: Architecture supports easy unit and integration testing

---

## Directory Structure

### Root Project Structure

```
gtdspace/
├── docs/                           # Project documentation
│   ├── project-overview.md
│   ├── user-flow.md
│   ├── tech-stack.md
│   ├── design-rules.md
│   └── project-rules.md
├── src/                            # Frontend React application
├── src-tauri/                      # Backend Rust application
├── public/                         # Static assets
├── tests/                          # Integration and E2E tests
├── .github/                        # GitHub workflows and templates
├── scripts/                        # Development and build scripts
└── tools/                          # Development tools and utilities
```

### Frontend Structure (`src/`)

Organized by feature and development phase for optimal AI navigation:

```
src/
├── app/                            # Application shell and routing
│   ├── App.tsx                     # Main application component
│   ├── app-providers.tsx           # Context providers wrapper
│   └── app-layout.tsx              # Main layout component
├── components/                     # Reusable UI components
│   ├── ui/                         # shadcn/ui components
│   ├── file-browser/               # File management components (Phase 1)
│   ├── editors/                    # Editor components (Phase 1-2)
│   ├── search/                     # Search components (Phase 1-3)
│   ├── dialogs/                    # Modal and dialog components
│   └── common/                     # Shared utility components
├── features/                       # Feature-based modules
│   ├── file-management/            # Phase 1: File operations
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── markdown-editing/           # Phase 1-2: Editor functionality
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── rich-editing/               # Phase 2: WYSIWYG features
│   └── advanced-features/          # Phase 3: Search, templates, etc.
├── hooks/                          # Global custom hooks
├── services/                       # API and external service integrations
├── types/                          # Global TypeScript type definitions
├── utils/                          # Utility functions and helpers
├── constants/                      # Application constants
├── styles/                         # Global styles and Tailwind config
└── __tests__/                      # Component and unit tests
```

### Backend Structure (`src-tauri/`)

```
src-tauri/
├── src/
│   ├── main.rs                     # Application entry point
│   ├── lib.rs                      # Library exports
│   ├── commands/                   # Tauri command handlers
│   │   ├── mod.rs
│   │   ├── file_commands.rs        # File operations (Phase 1)
│   │   ├── folder_commands.rs      # Folder operations (Phase 1)
│   │   ├── search_commands.rs      # Search functionality (Phase 3)
│   │   └── system_commands.rs      # System integration (Phase 3)
│   ├── services/                   # Business logic services
│   │   ├── mod.rs
│   │   ├── file_service.rs         # File management logic
│   │   ├── watcher_service.rs      # File watching service
│   │   └── search_service.rs       # Search indexing service
│   ├── models/                     # Data models and types
│   │   ├── mod.rs
│   │   ├── file_models.rs
│   │   └── error_models.rs
│   ├── utils/                      # Utility functions
│   │   ├── mod.rs
│   │   ├── file_utils.rs
│   │   └── validation_utils.rs
│   └── __tests__/                  # Unit tests
├── Cargo.toml                      # Rust dependencies
└── tauri.conf.json                 # Tauri configuration
```

---

## File Naming Conventions

### General Principles

1. **Descriptive Names**: Clearly indicate file purpose and contents
2. **Consistent Casing**: Use kebab-case for files, PascalCase for components, camelCase for functions
3. **Meaningful Suffixes**: Add suffixes to indicate file type and purpose
4. **No Abbreviations**: Use full words unless the abbreviation is universally understood

### Frontend File Naming

#### Components
```typescript
// ✅ GOOD: Descriptive component names
file-list-item.tsx                  // Individual file list item component
markdown-editor-toolbar.tsx         // Editor toolbar component
file-operation-dialog.tsx           // Dialog for file operations
search-results-panel.tsx            // Search results display panel

// ❌ BAD: Generic or unclear names
item.tsx
toolbar.tsx
dialog.tsx
panel.tsx
```

#### Hooks
```typescript
// ✅ GOOD: Descriptive hook names with use- prefix
use-file-manager.ts                 // File management state and operations
use-markdown-editor.ts              // Markdown editor state and controls
use-keyboard-shortcuts.ts           // Keyboard shortcut handling
use-auto-save.ts                    // Auto-save functionality

// ❌ BAD: Generic hook names
use-files.ts
use-editor.ts
use-shortcuts.ts
use-save.ts
```

#### Services
```typescript
// ✅ GOOD: Service names indicating purpose
file-system-service.ts              // File system operations
markdown-parser-service.ts          // Markdown parsing utilities
search-indexing-service.ts          // Search index management
export-service.ts                   // File export functionality

// ❌ BAD: Vague service names
file-service.ts
parser.ts
search.ts
export.ts
```

#### Types
```typescript
// ✅ GOOD: Descriptive type definitions
file-system-types.ts                // File system related types
editor-state-types.ts               // Editor state interfaces
user-preferences-types.ts           // User preference interfaces
api-response-types.ts               // API response interfaces

// ❌ BAD: Generic type names
types.ts
interfaces.ts
models.ts
api.ts
```

### Backend File Naming (Rust)

```rust
// ✅ GOOD: Descriptive Rust file names
file_operations.rs                  // File CRUD operations
folder_navigation.rs                // Folder browsing functionality
markdown_processing.rs              // Markdown file processing
search_indexing.rs                  // Search index management

// ❌ BAD: Generic Rust file names
files.rs
folders.rs
processing.rs
search.rs
```

---

## Code Organization Standards

### File Structure Template

Every file should follow this standardized structure:

#### TypeScript/React Files

```typescript
/**
 * @fileoverview Brief description of file purpose and main functionality
 * @author Development Team
 * @created 2024-01-XX
 * @updated 2024-01-XX
 * @phase 1|2|3 (corresponding to development phase)
 */

// === IMPORTS ===
// External library imports
import React, { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

// Internal imports - absolute paths with aliases
import { Button } from '@/components/ui/button';
import { useFileManager } from '@/hooks/use-file-manager';
import type { MarkdownFile } from '@/types/file-system-types';

// === TYPES ===
/**
 * Props interface for the component
 */
interface ComponentProps {
  /** Brief description of prop */
  propName: string;
  /** Optional prop with default behavior */
  optionalProp?: boolean;
}

/**
 * Internal state interface
 */
interface ComponentState {
  /** Current loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

// === CONSTANTS ===
/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedExtensions: ['.md', '.markdown']
} as const;

// === MAIN COMPONENT/FUNCTION ===
/**
 * Component description explaining its purpose and behavior
 * 
 * @param props - Component props
 * @returns JSX element or return description
 * 
 * @example
 * ```tsx
 * <ComponentName 
 *   propName="example"
 *   optionalProp={true} 
 * />
 * ```
 */
export const ComponentName: React.FC<ComponentProps> = ({
  propName,
  optionalProp = false
}) => {
  // Implementation here (max 400 lines after header)
};

// === EXPORTS ===
export default ComponentName;
export type { ComponentProps, ComponentState };
```

#### Rust Files

```rust
//! Brief description of module purpose and main functionality
//!
//! This module provides...
//! 
//! # Examples
//! 
//! ```rust
//! use crate::services::file_service::FileService;
//! 
//! let service = FileService::new();
//! let files = service.list_markdown_files("/path/to/folder").await?;
//! ```

// === IMPORTS ===
use std::path::Path;
use serde::{Deserialize, Serialize};
use tauri::command;

// === TYPES ===
/// Represents a markdown file with metadata
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarkdownFile {
    /// File name without path
    pub name: String,
    /// Full file path
    pub path: String,
    /// File size in bytes
    pub size: u64,
    /// Last modification timestamp
    pub last_modified: u64,
}

// === CONSTANTS ===
/// Maximum file size allowed for processing (10MB)
const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024;

/// Supported markdown file extensions
const MARKDOWN_EXTENSIONS: &[&str] = &[".md", ".markdown"];

// === FUNCTIONS ===
/// Lists all markdown files in the specified directory
///
/// # Arguments
///
/// * `path` - Directory path to search for markdown files
///
/// # Returns
///
/// * `Result<Vec<MarkdownFile>, String>` - Vector of markdown files or error message
///
/// # Errors
///
/// Returns error if directory doesn't exist or can't be read
///
/// # Examples
///
/// ```rust
/// let files = list_markdown_files("/home/user/documents").await?;
/// println!("Found {} markdown files", files.len());
/// ```
#[command]
pub async fn list_markdown_files(path: String) -> Result<Vec<MarkdownFile>, String> {
    // Implementation here (max 400 lines after header)
}
```

### Function Documentation Standards

#### TypeScript/JSDoc

```typescript
/**
 * Saves markdown content to file with auto-backup functionality
 * 
 * @param filePath - Full path to the target file
 * @param content - Markdown content to save
 * @param options - Save options configuration
 * @param options.createBackup - Whether to create backup before saving
 * @param options.validateContent - Whether to validate markdown syntax
 * 
 * @returns Promise resolving to save operation result
 * 
 * @throws {FileSystemError} When file cannot be written
 * @throws {ValidationError} When content validation fails
 * 
 * @example
 * ```typescript
 * const result = await saveMarkdownFile(
 *   '/path/to/file.md',
 *   '# My Document\n\nContent here...',
 *   { createBackup: true, validateContent: true }
 * );
 * 
 * if (result.success) {
 *   console.log('File saved successfully');
 * }
 * ```
 * 
 * @since 1.0.0
 * @category File Operations
 */
export async function saveMarkdownFile(
  filePath: string,
  content: string,
  options: SaveOptions = {}
): Promise<SaveResult> {
  // Implementation
}
```

#### Rust Documentation

```rust
/// Validates and processes markdown file content
///
/// This function performs comprehensive validation of markdown content including:
/// - Syntax validation
/// - Link checking (internal links only)
/// - Image reference validation
/// - Frontmatter parsing
///
/// # Arguments
///
/// * `content` - Raw markdown content as string slice
/// * `base_path` - Base directory for resolving relative paths
/// * `options` - Validation options and configuration
///
/// # Returns
///
/// * `Ok(ProcessedContent)` - Successfully processed content with metadata
/// * `Err(ValidationError)` - Validation failed with detailed error information
///
/// # Errors
///
/// This function will return an error in the following cases:
/// - Invalid markdown syntax is detected
/// - Referenced images cannot be found
/// - Internal links point to non-existent files
/// - Frontmatter contains invalid YAML
///
/// # Examples
///
/// ```rust
/// use crate::services::markdown_processor::{process_markdown_content, ValidationOptions};
///
/// let content = "# My Document\n\n[Link](./other.md)";
/// let base_path = Path::new("/documents");
/// let options = ValidationOptions::default();
///
/// match process_markdown_content(content, base_path, options) {
///     Ok(processed) => println!("Content processed successfully"),
///     Err(e) => eprintln!("Validation failed: {}", e),
/// }
/// ```
///
/// # Performance
///
/// This function processes content in O(n) time where n is the content length.
/// For files larger than 1MB, consider using the async variant.
///
/// # Safety
///
/// This function is safe to call with any UTF-8 string content.
pub fn process_markdown_content(
    content: &str,
    base_path: &Path,
    options: ValidationOptions,
) -> Result<ProcessedContent, ValidationError> {
    // Implementation
}
```

### Type Definition Standards

```typescript
/**
 * Configuration options for the markdown editor component
 * 
 * @interface EditorConfiguration
 * @category Editor Types
 */
export interface EditorConfiguration {
  /** Editor mode selection */
  mode: 'wysiwyg' | 'source' | 'split';
  
  /** Theme preference for the editor */
  theme: 'light' | 'dark' | 'auto';
  
  /** Font size in pixels (min: 12, max: 24) */
  fontSize: number;
  
  /** Whether to show line numbers in source mode */
  showLineNumbers: boolean;
  
  /** Auto-save interval in milliseconds (0 to disable) */
  autoSaveInterval: number;
  
  /** Keyboard shortcuts configuration */
  shortcuts: KeyboardShortcuts;
  
  /** Extension configuration for rich editing features */
  extensions?: {
    /** Enable table editing extension */
    tables?: boolean;
    /** Enable math equation support */
    math?: boolean;
    /** Enable mermaid diagram support */
    diagrams?: boolean;
  };
}

/**
 * Keyboard shortcuts mapping
 * 
 * @interface KeyboardShortcuts
 * @category Editor Types
 */
export interface KeyboardShortcuts {
  /** Save current file */
  save: string;
  /** Create new file */
  newFile: string;
  /** Toggle bold formatting */
  bold: string;
  /** Toggle italic formatting */
  italic: string;
  /** Insert link */
  insertLink: string;
  /** Toggle preview mode */
  togglePreview: string;
}

/**
 * Result type for file operations
 * 
 * @template T - Type of successful operation data
 * @category File System Types
 */
export type FileOperationResult<T = unknown> = 
  | { success: true; data: T; message?: string }
  | { success: false; error: string; code?: string };

/**
 * Union type for supported file operations
 * 
 * @category File System Types
 */
export type FileOperation = 
  | { type: 'create'; fileName: string; content?: string }
  | { type: 'rename'; oldName: string; newName: string }
  | { type: 'delete'; fileName: string; permanent?: boolean }
  | { type: 'copy'; fileName: string; destination: string };
```

---

## Development Workflow Standards

### Phase-Based Development

#### Phase 1: Core File Management (Weeks 1-2)

**Directory Focus:**
```
src/features/file-management/
src/components/file-browser/
src-tauri/src/commands/file_commands.rs
src-tauri/src/commands/folder_commands.rs
```

**File Size Targets:**
- Components: 200-300 lines max
- Hooks: 150-200 lines max
- Services: 250-350 lines max
- Command handlers: 200-300 lines max

**Documentation Requirements:**
- All file operations must have comprehensive examples
- Error handling patterns documented
- User flow integration points clearly marked

#### Phase 2: Rich Editing (Weeks 3-4)

**Directory Focus:**
```
src/features/rich-editing/
src/components/editors/
```

**File Size Targets:**
- Editor components: 300-400 lines max (split if needed)
- Tiptap extensions: 150-250 lines max
- Editor state management: 200-300 lines max

#### Phase 3: Advanced Features (Weeks 5-6)

**Directory Focus:**
```
src/features/advanced-features/
src/components/search/
src-tauri/src/commands/search_commands.rs
```

### Code Review Standards

#### Pre-Review Checklist

- [ ] File length under 500 lines
- [ ] File header documentation complete
- [ ] All functions have JSDoc/TSDoc documentation
- [ ] Type definitions include descriptions
- [ ] Examples provided for complex functions
- [ ] Error handling properly documented
- [ ] Imports organized and aliased correctly
- [ ] No hardcoded values (use constants)
- [ ] Consistent naming conventions followed

#### Review Focus Areas

1. **AI Readability**: Can an AI tool easily understand the code's purpose?
2. **Modularity**: Is the code properly separated into focused modules?
3. **Documentation**: Are all functions and types adequately documented?
4. **Error Handling**: Are errors properly typed and handled?
5. **Performance**: Are there any obvious performance issues?
6. **Security**: Are user inputs properly validated?

### Testing Standards

#### Unit Test Organization

```
src/__tests__/
├── components/
│   ├── file-browser/
│   │   ├── file-list-item.test.tsx
│   │   └── file-browser-sidebar.test.tsx
│   └── editors/
│       ├── markdown-editor.test.tsx
│       └── wysiwyg-editor.test.tsx
├── hooks/
│   ├── use-file-manager.test.ts
│   └── use-markdown-editor.test.ts
├── services/
│   ├── file-system-service.test.ts
│   └── markdown-parser-service.test.ts
└── utils/
    ├── file-validation.test.ts
    └── markdown-utils.test.ts
```

#### Test Documentation Standards

```typescript
/**
 * Test suite for FileListItem component
 * 
 * @fileoverview Tests the rendering and interaction behavior of individual file list items
 * including selection states, context menus, and metadata display.
 */

describe('FileListItem Component', () => {
  /**
   * Test group for basic rendering functionality
   */
  describe('Rendering', () => {
    /**
     * Verifies component renders with minimal required props
     * 
     * @test Renders file name and basic metadata
     */
    it('should render file name and metadata correctly', () => {
      // Test implementation
    });
  });
});
```

### Git Workflow Standards

#### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build system or auxiliary tool changes

**Scopes by Phase:**
- Phase 1: `file-mgmt`, `core`, `ui-basic`
- Phase 2: `editor`, `wysiwyg`, `rich-text`
- Phase 3: `search`, `advanced`, `system`

**Examples:**
```
feat(file-mgmt): add file creation dialog with template selection

- Implement file creation modal using shadcn Dialog
- Add template selection for common markdown types
- Include file name validation and error handling
- Update file list after successful creation

Closes #23
```

#### Branch Naming

```
<type>/<phase>-<description>
```

**Examples:**
- `feature/phase1-file-browser-sidebar`
- `fix/phase1-auto-save-timing`
- `refactor/phase2-editor-state-management`
- `docs/update-api-documentation`

### AI Tool Compatibility Guidelines

#### Code Structure for AI Parsing

1. **Consistent Patterns**: Use identical patterns for similar functionality
2. **Clear Hierarchies**: Maintain consistent indentation and nesting
3. **Explicit Types**: Always provide explicit type annotations
4. **Descriptive Variables**: Use full words instead of abbreviations
5. **Logical Grouping**: Group related functionality in predictable locations

#### File Organization for AI Understanding

```typescript
// ✅ GOOD: AI can easily parse this structure
/**
 * @fileoverview File browser sidebar component for Phase 1 development
 */

// Clear import sections
import { /* external imports */ } from 'external-lib';
import { /* internal imports */ } from '@/internal/path';

// Explicit type definitions
export interface ComponentProps {
  /** Clear property descriptions */
  property: string;
}

// Well-documented main function
export const Component: React.FC<ComponentProps> = (props) => {
  // Clear implementation
};

// Explicit exports
export default Component;
export type { ComponentProps };
```

#### Documentation for AI Context

- **File Purpose**: Always explain what the file does at the top
- **Function Purpose**: Explain why the function exists, not just what it does
- **Type Context**: Explain when and how types should be used
- **Example Usage**: Provide realistic examples for complex functions
- **Cross-References**: Link related files and components

### Performance Standards

#### Bundle Size Targets

- **Phase 1**: < 2MB total bundle size
- **Phase 2**: < 3MB total bundle size (with Tiptap)
- **Phase 3**: < 4MB total bundle size

#### Code Splitting Strategy

```typescript
// ✅ GOOD: Lazy load phase-specific features
const WYSIWYGEditor = lazy(() => import('@/features/rich-editing/wysiwyg-editor'));
const AdvancedSearch = lazy(() => import('@/features/advanced-features/advanced-search'));

// Group related functionality for optimal chunking
const FileManagement = lazy(() => import('@/features/file-management'));
```

#### Memory Management

- **Component Cleanup**: Always cleanup event listeners and subscriptions
- **File Content Caching**: Implement LRU cache for file contents
- **Editor Instance Management**: Properly destroy unused editor instances
- **Search Index Optimization**: Use efficient data structures for search

This project rules document establishes the foundation for building a maintainable, AI-friendly codebase that scales effectively across the three development phases while maintaining high code quality and developer experience standards. 