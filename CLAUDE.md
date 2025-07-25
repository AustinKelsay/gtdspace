# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GTD Space** is a streamlined cross-platform desktop markdown editor built with Tauri. It combines a React 18 + TypeScript frontend with a Rust backend to create a local-first markdown editing experience focused on simplicity and core functionality.

**Current Status:**
- Simplified to core features only
- Removed advanced features to focus on solid foundation
- Clean, maintainable codebase

**Key Technologies:**
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Editor**: CodeMirror 6 for markdown source editing
- **State Management**: Custom hooks pattern
- **Markdown**: marked for preview rendering
- **Backend**: Rust, Tauri 2.x with fs, dialog, and store plugins
- **File Watching**: notify crate for real-time external change detection

## Development Commands

```bash
# Start development server (runs both frontend and Tauri backend)
npm run tauri:dev

# Build for production
npm run tauri:build

# Frontend-only development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Build frontend only
npm run build

# Preview built frontend
npm run preview

# Access Tauri CLI directly
npm run tauri <command>
```

## Core Features

### Kept (Essential Features)
- File browser and management (create, rename, delete, open folder)
- CodeMirror markdown editor with syntax highlighting
- Markdown preview mode
- Multi-tab editing with tab management
- Auto-save functionality (2s debounce)
- Basic file search within current folder
- Theme switching (light/dark/auto)
- File watcher for external changes
- Essential keyboard shortcuts

### Removed (To Reduce Complexity)
- WYSIWYG editor and block system
- Export functionality (PDF/HTML)
- Media management and embeds
- Analytics and monitoring
- Onboarding and tutorials
- Help documentation system
- Command palette
- Debug panel
- Performance monitoring
- Complex error recovery
- Animations and transitions
- Advanced validation

## Architecture

### Frontend Structure (`src/`)

**Application Entry:**
- `main.tsx`: React entry point
- `AppPhase2.tsx`: Main application component (simplified)
- `global.css`: Tailwind CSS and global styles

**Core Hooks:**
- `hooks/useFileManager.ts`: File operations and folder state
- `hooks/useTabManager.ts`: Multi-file tab management with auto-save
- `hooks/useFileWatcher.ts`: External file change detection
- `hooks/useKeyboardShortcuts.ts`: Keyboard shortcuts
- `hooks/useModalManager.ts`: Modal state (settings, search, shortcuts)
- `hooks/useSettings.ts`: User settings persistence
- `hooks/useGlobalSearch.ts`: File search functionality
- `hooks/useErrorHandler.ts`: Basic error handling with toasts

**Component Organization:**
```
components/
├── app/               # Application header
├── editor/            # CodeMirror editor component
├── error-handling/    # Simple error boundary
├── file-browser/      # File management UI
├── lazy/              # Lazy loaded components (search, settings)
├── navigation/        # Document stats
├── search/            # Global search
├── settings/          # Settings interface
├── tabs/              # Tabbed interface
└── ui/                # shadcn/ui base components
```

### Backend Structure (`src-tauri/`)

**Commands:**
```rust
// File operations
select_folder, list_markdown_files, read_file, save_file,
create_file, rename_file, delete_file, copy_file, move_file

// Search
search_files, replace_in_file

// File watching
start_file_watcher, stop_file_watcher

// Settings
load_settings, save_settings

// System
ping, get_app_version, check_permissions
```

### Communication Pattern

```typescript
import { invoke } from '@tauri-apps/api/core';

const files = await invoke<MarkdownFile[]>('list_markdown_files', { 
  folderPath: '/path/to/folder' 
});
```

## Key Implementation Details

### Editor System
- **Single Editor**: CodeMirror 6 for source editing
- **Preview Mode**: Markdown parsed with marked library
- **Modes**: Source view and preview (no WYSIWYG)
- **Syntax Highlighting**: Built-in markdown support

### File Management
- **Tab System**: Maximum 10 tabs with memory management
- **Auto-Save**: Per-tab debounced saving (2s delay)
- **File Watching**: Real-time external change detection
- **Search**: Basic search across files in current folder

### Error Handling
- **Error Boundary**: Simple React error boundary with refresh
- **Toast Notifications**: User feedback via toast messages
- **Console Logging**: Errors logged for debugging

### State Management
- **Custom Hooks**: Each feature has dedicated hook
- **No External Library**: No Redux/MobX/Zustand
- **Local Storage**: Settings persisted via Tauri store

## Development Workflow

### Adding New Features
1. Define types in `src/types/index.ts`
2. Add Rust command if backend needed
3. Create hook in `src/hooks/`
4. Build UI component
5. Add to lazy loading if heavy

### Common Patterns

**Adding a Modal:**
1. Add to `ModalType` in `useModalManager`
2. Create component with shadcn/ui Dialog
3. Add to AppPhase2.tsx modal section
4. Use `openModal('name')` to open

**Adding File Operations:**
1. Add Rust command in `commands/mod.rs`
2. Add TypeScript types
3. Use in hook with error handling
4. Update UI accordingly

## Current Limitations & TODOs

### Known Issues
- TypeScript strict mode disabled (tsconfig.json)
- No comprehensive test suite
- File size limit 10MB (hardcoded)
- Maximum 10 tabs (memory management)
- Basic search only (no advanced filtering)
- No plugin system or extensibility
- Empty `src/services` directory
- `useTabManager.ts` imports non-existent memory leak prevention services

### TODO Items in Codebase
1. **ESLint Configuration**: Fix ESLint configuration issue with @typescript-eslint/recommended
2. **Services Directory**: Either populate or remove empty services directory
3. **Tab Manager Component**: Remove DnD Kit dependencies from TabManager.tsx

## Important Notes

### Development vs Production
- Environment warning shown when not in Tauri
- Development server on port 5173
- Bundle size significantly reduced (~1MB target)

### Platform Notes
- File paths handled by Rust (cross-platform)
- Keyboard shortcuts adapt (Cmd vs Ctrl)
- Native file dialogs via Tauri

### Security
- File paths sanitized in Rust
- No external network requests
- Settings stored locally only

## Common Development Tasks

### Running the Application
```bash
# For development with hot reload
npm run tauri:dev

# This starts both:
# - Vite dev server on http://localhost:5173
# - Tauri backend with file watching
```

### Type Checking & Linting
```bash
# Check TypeScript types without emitting
npm run type-check

# Run ESLint
npm run lint

# Auto-fix ESLint issues
npm run lint:fix
```

### Building for Release
```bash
# Creates platform-specific installer in src-tauri/target/release/bundle/
npm run tauri:build
```

### Frontend-Only Development
```bash
# Useful for UI development without Tauri
npm run dev

# Note: File operations won't work without Tauri backend
```

## Architecture Patterns

### Hook Pattern
All business logic is encapsulated in custom hooks:
- Hooks handle state management
- Components focus on presentation
- No prop drilling - hooks provide direct access

### Lazy Loading
Heavy components are lazy loaded to improve initial load:
```typescript
const SettingsManagerLazy = lazy(() => 
  import('@/components/settings/SettingsManager')
);
```

### Error Handling Pattern
```typescript
const { withErrorHandling } = useErrorHandler();

const result = await withErrorHandling(
  async () => await invoke('command_name', args),
  'User-friendly error message'
);
```

### Modal Management
Centralized modal state prevents multiple modals:
```typescript
const { openModal, closeModal } = useModalManager();
openModal('settings'); // Only one modal at a time
```