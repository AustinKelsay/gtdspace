# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GTD Space** is a cross-platform desktop markdown editor built with Tauri. It combines a React 18 + TypeScript frontend with a Rust backend to create a local-first markdown editing experience.

**Current Status:**
- **Phase 4 In Progress (90%)**: Polish, performance optimization, and final refinements
  - ✅ Design system implementation with dark-first Slate theme
  - ✅ Performance optimizations with code splitting and lazy loading
  - ✅ Accessibility improvements targeting WCAG 2.1 AA compliance
  - ✅ Enhanced keyboard navigation and screen reader support
  - ✅ Advanced search with regex, case sensitivity, and filter persistence
  - ✅ Error boundaries and comprehensive error handling
  - ✅ File validation system with size limits and extension verification
  - ✅ Onboarding flow with interactive tutorial
  - ✅ Analytics integration for usage insights
  - 🚧 Help documentation and tooltips (partial)
  - 🚧 Video tutorials (planned)
  - 🚧 Feedback widget (planned)

**Previous Phases Complete:**
- **Phase 3**: Advanced WYSIWYG editing, block system, exports, media management
- **Phase 2**: Enhanced multi-file editing with tabbed interface
- **Phase 1**: Full MVP with file management and basic editing

**Key Technologies:**
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Editors**: CodeMirror 6 (source) + Tiptap/ProseMirror (WYSIWYG)
- **State Management**: Custom hooks pattern (no external state library)
- **Rich Content**: KaTeX (math), Mermaid (diagrams), Lowlight (syntax highlighting)
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
```

## Architecture & Structure

### Frontend Architecture (`src/`)

**Application Entry:**
- `main.tsx`: React entry point
- `AppPhase2.tsx`: Main application component with all features integrated
- `global.css`: Tailwind CSS and global styles

**Core Hooks (State Management):**
- `hooks/useFileManager.ts`: Central file operations and folder state
- `hooks/useTabManager.ts`: Multi-file tab management with auto-save
- `hooks/useFileWatcher.ts`: External file change detection with debouncing
- `hooks/useKeyboardShortcuts.ts`: Global keyboard shortcuts management
- `hooks/useModalManager.ts`: Modal state management for dialogs
- `hooks/useSettings.ts`: User settings persistence and management
- `hooks/useCommands.ts`: Command palette integration
- `hooks/useGlobalSearch.ts`: Cross-file search functionality
- `hooks/useErrorHandler.ts`: Centralized error handling and recovery
- `hooks/useOnboarding.ts`: User onboarding flow management
- `hooks/use-toast.tsx`: Toast notification system (shadcn/ui)

**Component Organization:**
```
components/
├── analytics/          # Usage analytics and visualization
├── app/               # Application-level components (AppHeader)
├── blocks/            # Block-based editing system (Phase 3 complete)
├── command-palette/   # Command palette for quick access
├── debug/             # Debug panel and development tools
├── design-system/     # Design system showcase and documentation
├── editor/            # Text editing components (CodeMirror)
├── error-handling/    # Error boundaries and recovery systems
├── export/            # PDF/HTML export functionality
├── file-browser/      # File management and browser UI
├── help/              # Help system, tutorials, and tooltips
├── layout/            # Responsive layout components
├── lazy/              # Code splitting wrappers for performance
├── media/             # Image and attachment handling
├── monitoring/        # Performance monitoring UI
├── navigation/        # Document outline, TOC, stats
├── onboarding/        # User onboarding flow
├── polish/            # UI polish, animations, and micro-interactions
├── search/            # Global search functionality
├── settings/          # Settings management interface
├── tabs/              # Tabbed interface for multi-file editing
├── tutorial/          # Interactive tutorial system
├── ui/                # shadcn/ui base components
├── validation/        # File validation and form handling
├── virtualized/       # Performance optimizations for large lists
└── wysiwyg/           # Rich text editing (Tiptap/ProseMirror)
```

**Services:**
```
services/
├── ErrorManager.ts          # Global error management
├── analytics/
│   └── AnalyticsCollector.ts # Usage analytics collection
├── caching/
│   ├── CacheManager.ts      # Central cache management
│   └── LRUCache.ts          # LRU cache implementation
├── logging/
│   └── LoggingService.ts    # Application logging infrastructure
├── performance/
│   ├── PerformanceMonitor.ts       # Performance tracking
│   ├── memoryMonitor.ts            # Memory usage monitoring
│   ├── benchmarkRunner.ts          # Performance benchmarks
│   └── memoryLeakPrevention.ts     # Memory management
```

### Backend Architecture (`src-tauri/`)

**Command Structure:**
```rust
// All commands in src/commands/mod.rs
// File operations
select_folder, list_markdown_files, read_file, save_file,
create_file, rename_file, delete_file

// File watching
start_file_watcher, stop_file_watcher

// Settings
load_settings, save_settings

// System
ping, get_app_version, check_permissions
```

**Key Patterns:**
- All commands return `Result<T, String>` for error handling
- File operations use `FileOperationResult` type
- Settings persisted with `tauri-plugin-store`
- File watching with debounced events

### Communication Pattern

Frontend → Backend:
```typescript
import { invoke } from '@tauri-apps/api/core';

// Example usage
const files = await invoke<MarkdownFile[]>('list_markdown_files', { 
  folderPath: '/path/to/folder' 
});
```

## Key Implementation Details

### Design System
- **Theme**: Dark-first Slate theme with light mode support
- **Colors**: Consistent palette defined in `tailwind.config.js`
- **Typography**: System font stack with responsive sizing
- **Spacing**: 4px base unit system
- **Components**: All UI components follow shadcn/ui patterns
- **Accessibility**: WCAG 2.1 AA compliance target with screen reader support

### Editor System
- **Dual Editors**: CodeMirror 6 for source, Tiptap/ProseMirror for WYSIWYG
- **Mode Switching**: Seamless content sync via markdown serialization
- **Four Modes**: WYSIWYG, source, preview, split-view
- **Rich Features**: Tables, math (KaTeX), diagrams (Mermaid), syntax highlighting
- **Block System**: Complete Notion-style blocks with drag-and-drop (Phase 3 complete)
- **Content Types**: Text, headers, lists, tables, code blocks, math equations, images

### Performance Architecture
- **Code Splitting**: Lazy loading for heavy components with React.lazy
- **Virtualization**: Large file lists use react-window for windowing
- **Caching**: LRU caching system for optimal performance
- **Memory Management**: Built-in memory leak prevention and monitoring
- **Debouncing**: Auto-save, search, and file watching operations
- **Memoization**: React.memo and useMemo for expensive renders
- **Bundle Optimization**: Target <2MB initial bundle with ongoing optimization

### File Management
- **Tab System**: Maximum 10 tabs with intelligent memory management
- **Auto-Save**: Per-tab debounced saving (2s delay) with visual indicators
- **File Watching**: Real-time external change detection with notify crate
- **Validation**: File size limits (10MB), extension verification, content validation
- **Search**: Global search across files with regex and case sensitivity support

### Error Handling & Monitoring
- **Error Boundaries**: Component-level error recovery with fallback UI
- **Error Manager**: Central error management service with context tracking
- **User Feedback**: Toast notifications for all operations with severity levels
- **Logging**: Comprehensive logging service for development and debugging
- **Recovery**: Graceful degradation with automatic retry mechanisms
- **Performance Monitoring**: Real-time performance metrics and benchmarking

## Development Workflow

### Adding New Features
1. Define TypeScript types in `src/types/index.ts`
2. Add Rust commands if backend work needed
3. Create/extend hooks for state management
4. Build components using shadcn/ui patterns
5. Add keyboard shortcuts if applicable
6. Update CLAUDE.md documentation

### Code Style Guidelines
- Use TypeScript strict mode (currently disabled, but aim for type safety)
- Follow existing component patterns
- Use absolute imports (@/) for all imports
- Implement error handling for all async operations
- Add proper TypeScript types (avoid `any`)
- Use semantic HTML for accessibility

### Current Limitations
- TypeScript strict mode disabled due to legacy code patterns
- Bundle size management requires ongoing optimization
- File watcher debouncing can delay rapid successive changes
- Some components still need performance optimization
- Testing infrastructure exists but comprehensive test suite not complete

## Important Notes

### Phase 4 Completion Status
Phase 4 is approximately 90% complete with the following status:
- ✅ Performance monitoring and metrics tracking implemented
- ✅ Error handling and recovery systems complete
- ✅ Analytics and usage tracking integrated
- ✅ Memory management and leak prevention active
- ✅ Command palette and keyboard shortcuts complete
- ✅ Onboarding flow and tutorial system functional
- 🚧 Help documentation system (partial implementation)
- 🚧 Final accessibility compliance (WCAG 2.1 AA)
- 🚧 Video tutorial integration (planned)
- 🚧 Feedback widget system (planned)

### Known Issues
- TypeScript strict mode disabled requiring gradual migration
- File watcher debouncing can delay rapid successive updates
- Memory usage optimization ongoing for very large files (>10MB)
- Search performance requires optimization for large file sets (>1000 files)
- Bundle size management due to rich editor dependencies
- Some advanced accessibility features still in development

### Future Considerations
- **Phase 5**: Plugin system and extensibility framework
- **Testing**: Implement comprehensive test suite
- **CI/CD**: Automated build and release pipeline
- **Internationalization**: Multi-language support
- **Cloud Sync**: Optional cloud backup feature