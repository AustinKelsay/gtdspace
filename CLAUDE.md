# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Tauri Markdown Editor** project - a cross-platform desktop application for viewing, editing, and managing Markdown files. The project combines a Rust backend with a React TypeScript frontend to create a Notion-like experience for local markdown file management.

**Key Characteristics:**
- Desktop application using Tauri framework
- React 18 + TypeScript frontend
- Rust backend for file operations
- Local-first approach (no cloud dependencies)
- Currently in planning/documentation phase (no code yet)

## Development Commands

Since this project is in the planning phase, no build commands exist yet. Based on the tech stack documentation, the expected commands will be:

```bash
# Development server (when implemented)
npm run tauri dev

# Production build (when implemented)  
npm run tauri build

# Type checking (when implemented)
npm run type-check

# Linting (when implemented)
npm run lint
```

## Architecture & Structure

### Phase-Based Development Approach

The project follows a structured 3-phase development approach:

1. **Phase 0 (Setup)**: Barebones Tauri app with basic UI shell - establishes foundation
2. **Phase 1 (MVP)**: Core file management and basic markdown editing
3. **Phase 2**: Rich WYSIWYG editing with Tiptap integration
4. **Phase 3**: Advanced features (search, templates, system integration)

### Planned Directory Structure

**Frontend (`src/`):**
```
src/
├── app/                     # Application shell and routing
├── components/              # Reusable UI components
│   ├── ui/                  # shadcn/ui components
│   ├── file-browser/        # File management components
│   ├── editors/             # Editor components
│   └── search/              # Search components
├── features/                # Feature-based modules by phase
│   ├── file-management/     # Phase 1: File operations
│   ├── markdown-editing/    # Phase 1-2: Editor functionality
│   ├── rich-editing/        # Phase 2: WYSIWYG features
│   └── advanced-features/   # Phase 3: Search, templates, etc.
├── hooks/                   # Custom React hooks
├── services/                # API and external service integrations
├── types/                   # TypeScript type definitions
└── utils/                   # Utility functions
```

**Backend (`src-tauri/`):**
```
src-tauri/src/
├── commands/                # Tauri command handlers by feature
├── services/                # Business logic services
├── models/                  # Data models and types
└── utils/                   # Utility functions
```

### Core Technologies

- **Framework**: Tauri 2.x for cross-platform desktop
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Rich Editor**: Tiptap (ProseMirror-based) for WYSIWYG editing
- **Build System**: Vite for development and production builds
- **Backend**: Rust for file system operations

### Key Design Principles

1. **AI-First Development**: 500-line file limit, comprehensive documentation
2. **Modular Architecture**: Feature-based organization, clear separation of concerns
3. **Local-First**: All files remain on user's machine, no cloud dependencies
4. **Cross-Platform**: Native performance on Windows, macOS, and Linux
5. **Privacy-Focused**: No data collection or external dependencies

## Development Workflow

### File Organization Standards

- **File Naming**: Descriptive kebab-case names (e.g., `file-list-item.tsx`, `use-file-manager.ts`)
- **Documentation**: Every file must have purpose description and comprehensive JSDoc/TSDoc
- **Type Safety**: Explicit TypeScript interfaces and types for all data structures
- **Import Organization**: Structured imports with absolute paths using aliases

### Code Quality Standards

- **Single Responsibility**: Each file serves one clear purpose
- **Comprehensive Documentation**: All functions documented with examples
- **Error Handling**: Proper error types and handling patterns
- **Performance**: Bundle size targets and memory management considerations

### Testing Approach

- Component tests using standard React testing patterns
- Unit tests for hooks and utilities
- Integration tests for Tauri commands
- E2E tests for critical user workflows

## Important Notes

⚠️ **Current Status**: This project is in the documentation/planning phase. No actual code implementation exists yet.

When development begins:
1. Start with Phase 0 (Setup) - basic Tauri app with empty UI shell
2. Focus on file system permissions and basic Rust-React communication
3. Implement core file management before moving to rich editing features
4. Follow the established directory structure and naming conventions

## Key Files to Reference

- `docs/project-overview.md` - Comprehensive project goals and features
- `docs/tech-stack.md` - Detailed technology choices and best practices
- `docs/project-rules.md` - Complete coding standards and conventions
- `docs/phases/phase-0-setup.md` - Initial development phase plan
- `docs/design-rules.md` - UI/UX guidelines and styling conventions

This project emphasizes thorough planning and documentation before implementation, ensuring a solid foundation for building a professional-grade markdown editor.