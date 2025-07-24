# GTD Space

A cross-platform desktop markdown editor built with Tauri, React, and TypeScript. GTD Space provides a local-first markdown editing experience with a focus on simplicity and performance.

![Status](https://img.shields.io/badge/Phase%204-90%25%20Complete-brightgreen)
![Phase 3](https://img.shields.io/badge/Phase%203-100%25%20Complete-success)
![Phase 2](https://img.shields.io/badge/Phase%202-100%25%20Complete-success)
![Phase 1](https://img.shields.io/badge/Phase%201%20MVP-100%25%20Complete-success)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Tech Stack](https://img.shields.io/badge/Stack-Tauri%202.x%20%7C%20React%2018%20%7C%20Rust-orange)

## 🚀 Features

### Phase 1: MVP (Complete ✅)

- ✅ **Native File Management** - Browse and manage markdown files with native folder selection
- ✅ **Markdown Editor** - Source, preview, and split-view modes
- ✅ **Auto-Save** - Automatic saving with visual feedback
- ✅ **File Operations** - Create, rename, and delete files
- ✅ **Search & Filter** - Real-time file search functionality
- ✅ **Settings Persistence** - Theme, editor preferences, and last folder persist across sessions
- ✅ **Keyboard Shortcuts** - Ctrl/Cmd+S to save, Ctrl/Cmd+O to open folder
- ✅ **Dark Theme** - Beautiful dark mode interface with shadcn/ui components

### Phase 2: Enhanced UX (Complete ✅)

- ✅ **Tabbed Interface** - Multiple files open simultaneously with tab management
- ✅ **Enhanced CodeMirror Editor** - Advanced markdown editing with syntax highlighting
- ✅ **File Watching** - Real-time detection of external file changes
- ✅ **Advanced Editor Modes** - Improved preview synchronization and split-view
- ✅ **Keyboard Shortcuts** - Ctrl+Tab navigation, Ctrl+W close, and more

### Phase 3: Advanced Features (Complete ✅)

- ✅ **WYSIWYG Editor** - Rich text editing with Tiptap integration and ProseMirror backend
- ✅ **Mode Switching** - Seamless switching between WYSIWYG, source, preview, and split modes
- ✅ **Advanced Tables** - Full table creation, editing, and manipulation capabilities
- ✅ **Block-Based Editing** - Notion-style content blocks with drag-and-drop reordering
- ✅ **Mathematical Equations** - LaTeX support with KaTeX rendering and interactive toolbar
- ✅ **Diagrams** - Mermaid.js integration for flowcharts, sequence diagrams, and more
- ✅ **Rich Code Highlighting** - Syntax highlighting for 25+ programming languages
- ✅ **Export System** - PDF and HTML export with multiple themes and styling options
- ✅ **Document Navigation** - Complete outline, table of contents, and document statistics
- ✅ **Media Management** - Advanced image editing, file attachments, and external embeds

### Phase 4: Polish & Performance (90% Complete 🚧)

- ✅ **Visual Polish** - Smooth animations, transitions, and micro-interactions
- ✅ **Error Handling** - Comprehensive error boundaries with user-friendly recovery
- ✅ **Performance Optimization** - Code splitting, lazy loading, and virtualization
- ✅ **Analytics & Monitoring** - Built-in performance monitoring and usage analytics
- ✅ **Responsive Design** - Optimized layouts for different screen sizes
- ✅ **Onboarding System** - Interactive tours and contextual help
- ✅ **Command Palette** - Quick access to all features via keyboard
- ✅ **Debug Tools** - Development and troubleshooting utilities
- 🚧 **Accessibility** - WCAG 2.1 AA compliance (in progress)
- 🚧 **Plugin System** - Extensibility architecture (planned)

## 🛠️ Tech Stack

### Frontend

- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development with comprehensive type definitions
- **Tailwind CSS** - Utility-first styling with custom design system
- **shadcn/ui** - High-quality accessible UI components built on Radix UI
- **Tiptap** - Rich text editor with ProseMirror backend
- **CodeMirror 6** - Advanced code editing with markdown support
- **KaTeX** - Mathematical equation rendering with LaTeX support
- **Mermaid.js** - Diagram and flowchart generation
- **Lowlight** - Syntax highlighting for 25+ programming languages
- **React Beautiful DnD** - Drag-and-drop functionality for blocks and content
- **DnD Kit** - Modern drag-and-drop toolkit for advanced interactions
- **React Window** - Virtualization for large file lists and content
- **React Hotkeys Hook** - Comprehensive keyboard shortcut management
- **Vite** - Lightning-fast build tool with HMR

### Backend

- **Rust** - Performance and memory safety
- **Tauri 2.x** - Native desktop capabilities with web frontend
- **tokio** - Async runtime for file operations
- **notify** - File system watching for real-time updates
- **serde** - Serialization/deserialization for data exchange

### Additional Libraries

- **marked** - Markdown parsing and HTML generation
- **DOMPurify** - XSS protection for user-generated content
- **highlight.js** - Additional syntax highlighting support
- **prosemirror-markdown** - Markdown serialization for WYSIWYG editor
- **lodash.debounce** - Performance optimization for frequent operations

## 📦 Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/) (latest stable)
- Platform-specific dependencies:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Microsoft C++ Build Tools
  - **Linux**: `webkit2gtk`, `libgtk-3-dev`, `libappindicator3-dev`

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/gtdspace.git
cd gtdspace

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

## 🎯 Usage

1. **Select a Folder**: Click "Select Folder" to choose a directory containing markdown files
2. **Browse Files**: View all markdown files in the sidebar with real-time search
3. **Edit Content**: Click any file to open it in a new tab
4. **Switch Modes**: Choose between WYSIWYG, source, preview, and split view
5. **Rich Editing**: Use the WYSIWYG mode for visual editing with tables, math equations, diagrams, and more
6. **Block Editing**: Create Notion-style content blocks and reorder with drag-and-drop
7. **Media Management**: Insert images, attach files, and embed external content
8. **Export Documents**: Export to PDF or HTML with multiple themes and styling options
9. **Auto-Save**: Your changes are automatically saved every 2 seconds
10. **Search Files**: Use the search bar to filter files by name with instant results
11. **Multi-File Editing**: Work with multiple files simultaneously using tabs
12. **Command Palette**: Press Ctrl/Cmd+Shift+P for quick access to all features

### Keyboard Shortcuts

- `Ctrl/Cmd + S` - Save current file
- `Ctrl/Cmd + O` - Open folder selection
- `Ctrl + Tab` - Switch between tabs
- `Ctrl + W` - Close current tab
- `Ctrl + Shift + W` - Switch to WYSIWYG mode
- `Ctrl + Shift + S` - Switch to source mode
- `Ctrl + Shift + P` - Switch to split mode / Open command palette
- `Ctrl + E` - Open export dialog
- `Ctrl + Shift + O` - Toggle document outline
- `Ctrl + F` - Search within file
- `Ctrl + Shift + F` - Global file search
- `Escape` - Close dialogs and modals

## 🏗️ Architecture

```
gtdspace/
├── src/                         # React frontend
│   ├── components/              # UI components
│   │   ├── analytics/           # Usage analytics and performance monitoring
│   │   ├── app/                 # Main application shell components
│   │   ├── blocks/              # Block-based editing system (Notion-style)
│   │   ├── command-palette/     # Quick command access interface
│   │   ├── debug/               # Development and debugging tools
│   │   ├── design-system/       # Design system showcase and components
│   │   ├── editor/              # Text editor components (CodeMirror, WYSIWYG)
│   │   ├── error-handling/      # Error boundaries and recovery systems
│   │   ├── export/              # PDF/HTML export system
│   │   ├── file-browser/        # File management and browser UI
│   │   ├── help/                # Help system, tutorials, and tooltips
│   │   ├── layout/              # Layout and responsive design components
│   │   ├── lazy/                # Lazy-loaded component wrappers
│   │   ├── media/               # Media management and image editing
│   │   ├── monitoring/          # Performance monitoring and benchmarking
│   │   ├── navigation/          # Document outline and navigation
│   │   ├── onboarding/          # User onboarding and tours
│   │   ├── polish/              # Animations, transitions, and micro-interactions
│   │   ├── search/              # Global and local search functionality
│   │   ├── settings/            # Application settings and preferences
│   │   ├── tabs/                # Tab management system
│   │   ├── tutorial/            # Interactive tutorials and guides
│   │   ├── ui/                  # shadcn/ui base components
│   │   ├── validation/          # Input validation and form handling
│   │   ├── virtualized/         # Performance optimization for large lists
│   │   └── wysiwyg/             # WYSIWYG editor components
│   ├── hooks/                   # Custom React hooks
│   │   ├── useCommands.ts       # Command palette and shortcuts
│   │   ├── useErrorHandler.ts   # Error handling and recovery
│   │   ├── useFileManager.ts    # File operations and state management
│   │   ├── useFileWatcher.ts    # File change detection and watching
│   │   ├── useGlobalSearch.ts   # Global search functionality
│   │   ├── useKeyboardShortcuts.ts # Keyboard shortcut management
│   │   ├── useModalManager.ts   # Modal and dialog state management
│   │   ├── useOnboarding.ts     # Onboarding flow management
│   │   ├── useResponsiveUtils.ts # Responsive design utilities
│   │   ├── useSettings.ts       # Settings persistence and management
│   │   ├── useTabManager.ts     # Tab state and navigation
│   │   └── use-toast.tsx        # Toast notification system
│   ├── services/                # Business logic and external services
│   │   ├── analytics/           # Analytics data collection
│   │   ├── caching/             # Caching strategies and implementations
│   │   ├── logging/             # Application logging system
│   │   ├── performance/         # Performance monitoring and optimization
│   │   └── testing/             # Testing utilities and performance tests
│   ├── types/                   # TypeScript type definitions
│   │   ├── blocks.ts            # Block-based editing types
│   │   ├── global.d.ts          # Global type declarations
│   │   └── index.ts             # Type exports
│   └── styles/                  # Global styles and CSS
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── commands/            # Tauri command handlers
│   │   └── lib.rs               # Main application setup
│   └── Cargo.toml               # Rust dependencies
├── docs/                        # Documentation
│   ├── design-system.md         # Comprehensive design system guide
│   ├── phases/                  # Development phase documentation
│   ├── project-overview.md      # Project overview and goals
│   ├── project-rules.md         # Development guidelines
│   ├── tech-stack.md            # Technology decisions and architecture
│   └── user-flow.md             # User experience documentation
└── CLAUDE.md                    # AI assistant development documentation
```

## 🔧 Development

### Commands

```bash
# Frontend only
npm run dev              # Start Vite dev server
npm run build            # Build frontend
npm run type-check       # TypeScript checking
npm run lint             # ESLint
npm run lint:fix         # Fix linting issues

# Full application
npm run tauri:dev        # Development mode with hot reload
npm run tauri:build      # Production build with optimizations
```

### Project Structure

- **Frontend-Backend Communication**: Uses Tauri's `invoke()` system for type-safe communication
- **State Management**: Custom hooks for modular state management across features
- **File Operations**: All file I/O handled by Rust backend with real-time file watching
- **Rich Editing**: Tiptap/ProseMirror for WYSIWYG with bidirectional markdown serialization
- **Block System**: Notion-style content blocks with advanced drag-and-drop functionality
- **Mathematical Content**: KaTeX integration for LaTeX equation rendering
- **Diagrams**: Mermaid.js for flowcharts, sequence diagrams, and data visualizations
- **Export System**: Professional PDF and HTML generation with multiple themes
- **Media Management**: Advanced image editing, file attachments, and external content embedding
- **Multi-File Support**: Tab-based interface with per-tab state isolation
- **Performance**: Code splitting, lazy loading, and virtualization for optimal performance
- **Settings**: Persistent storage using tauri-plugin-store with type-safe serialization

## 📝 Development Phases

### ✅ Phase 0: Setup (Complete)

- Basic Tauri application shell
- React + TypeScript configuration
- Development environment setup

### ✅ Phase 1: MVP (Complete)

- File browser with folder selection
- Basic markdown editor with CodeMirror
- File operations (CRUD)
- Auto-save functionality
- Settings persistence

### ✅ Phase 2: Enhanced UX (Complete)

- Tabbed interface with multi-file editing
- Enhanced CodeMirror editor with syntax highlighting
- File watching service with real-time change detection
- Advanced editor modes (source/preview/split)
- Keyboard shortcuts for tab navigation

### ✅ Phase 3: Advanced Features (Complete)

- ✅ WYSIWYG editor with Tiptap integration and ProseMirror backend
- ✅ Mode switching between WYSIWYG/source/preview/split
- ✅ Advanced table editing and rich text formatting
- ✅ Block-based editing system (Notion-style) with drag-and-drop
- ✅ Mathematical equations with KaTeX rendering and interactive toolbar
- ✅ Diagram creation with Mermaid.js integration
- ✅ Rich syntax highlighting for 25+ programming languages
- ✅ Export system (PDF, HTML) with multiple themes and styling options
- ✅ Document navigation with outline, table of contents, and statistics
- ✅ Advanced media management with image editing, file attachments, and external embeds

### 🚧 Phase 4: Polish & Performance (90% Complete)

- ✅ UI/UX refinements with smooth animations and micro-interactions
- ✅ Comprehensive error handling with user-friendly recovery systems
- ✅ Performance optimizations with code splitting and lazy loading
- ✅ Built-in analytics and performance monitoring systems
- ✅ Responsive design optimized for different screen sizes
- ✅ Interactive onboarding system with contextual help
- ✅ Command palette for quick feature access
- ✅ Debug and development tools integration
- 🚧 Full accessibility compliance (WCAG 2.1 AA)
- 🚧 Plugin system architecture for extensibility

### 📋 Phase 5: Scalability (Planned)

- Plugin architecture and marketplace
- Cloud synchronization capabilities
- Advanced collaboration features
- Mobile companion app
- API for third-party integrations

See [docs/phases/](docs/phases/) for detailed phase specifications.

## 🤝 Contributing

This project is in active development. Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/) - Build smaller, faster, and more secure desktop applications
- UI components from [shadcn/ui](https://ui.shadcn.com/) - Beautifully designed components
- Rich text editing powered by [Tiptap](https://tiptap.dev/) - The headless editor framework
- Code editing with [CodeMirror 6](https://codemirror.net/) - Extensible code editor
- Mathematical rendering with [KaTeX](https://katex.org/) - Fast math typesetting
- Diagrams with [Mermaid.js](https://mermaid.js.org/) - Generation of diagrams and flowcharts
- Export functionality with [marked](https://marked.js.org/) - Markdown parser and compiler
- Icons by [Lucide](https://lucide.dev/) - Beautiful & consistent icons

## 🐛 Known Issues

- Cross-platform testing completed for macOS, Windows and Linux testing in progress
- Bundle size optimized but still substantial due to rich editor dependencies (~3.2MB gzipped)
- Some advanced table features (CSV import/export, advanced sorting) planned for future releases
- Plugin system architecture in development phase
- Performance optimization ongoing for very large files (>10MB)

## 📞 Support

For bugs and feature requests, please open an issue on GitHub.

## 📚 Support & Documentation

**Need Help?** Check our comprehensive support resources:

- **[📖 User Support Hub](docs/user-support/)** - Complete support documentation
- **[❓ FAQ](docs/user-support/FAQ.md)** - Quick answers to common questions  
- **[🔧 Troubleshooting Guide](docs/user-support/troubleshooting-guide.md)** - Step-by-step problem solving
- **[📋 Workflow Guides](docs/user-support/workflows-guide.md)** - Best practices for different use cases
- **[♿ Accessibility Guide](docs/user-support/accessibility-guide.md)** - Using GTD Space with assistive technologies
- **[🆘 Getting Help](docs/user-support/getting-help.md)** - How to report issues and get support

**In-App Help**: Press `F1` in GTD Space for searchable documentation and tutorials.

---

Built with ❤️ using Tauri and React
