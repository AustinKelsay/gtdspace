# GTD Space

A cross-platform desktop markdown editor built with Tauri, React, and TypeScript. GTD Space provides a local-first markdown editing experience with a focus on simplicity and performance.

![Status](https://img.shields.io/badge/Phase%203-100%25%20Complete-success)
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

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality UI components
- **Tiptap** - Rich text editor with ProseMirror backend
- **CodeMirror 6** - Advanced code editing with markdown support
- **KaTeX** - Mathematical equation rendering
- **Mermaid.js** - Diagram and flowchart generation
- **Lowlight** - Syntax highlighting for code blocks
- **Vite** - Lightning-fast build tool

### Backend
- **Rust** - Performance and safety
- **Tauri 2.x** - Native desktop capabilities
- **tokio** - Async runtime

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
2. **Browse Files**: View all markdown files in the sidebar
3. **Edit Content**: Click any file to open it in a new tab
4. **Switch Modes**: Choose between WYSIWYG, source, preview, and split view
5. **Rich Editing**: Use the WYSIWYG mode for visual editing with tables, math equations, diagrams, and more
6. **Block Editing**: Create Notion-style content blocks and reorder with drag-and-drop
7. **Media Management**: Insert images, attach files, and embed external content
8. **Export Documents**: Export to PDF or HTML with multiple themes and styling options
9. **Auto-Save**: Your changes are automatically saved every 2 seconds
10. **Search Files**: Use the search bar to filter files by name
11. **Multi-File Editing**: Work with multiple files simultaneously using tabs

### Keyboard Shortcuts
- `Ctrl/Cmd + S` - Save current file
- `Ctrl/Cmd + O` - Open folder selection
- `Ctrl + Tab` - Switch between tabs
- `Ctrl + W` - Close current tab
- `Ctrl + Shift + W` - Switch to WYSIWYG mode
- `Ctrl + Shift + S` - Switch to source mode
- `Ctrl + Shift + P` - Switch to split mode
- `Ctrl + E` - Open export dialog
- `Ctrl + Shift + O` - Toggle document outline
- `Escape` - Close dialogs

## 🏗️ Architecture

```
gtdspace/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── file-browser/   # File management UI
│   │   ├── editor/         # Text editor components
│   │   ├── wysiwyg/        # WYSIWYG editor components
│   │   ├── blocks/         # Block-based editing system
│   │   ├── navigation/     # Document outline and navigation
│   │   ├── export/         # Export system (PDF, HTML)
│   │   ├── media/          # Media management and image editing
│   │   ├── tabs/           # Tab management
│   │   └── ui/             # shadcn/ui components
│   ├── hooks/              # Custom React hooks
│   │   ├── useFileManager.ts    # File operations & state
│   │   ├── useTabManager.ts     # Tab management (Phase 2)
│   │   ├── useFileWatcher.ts    # File change detection (Phase 2)
│   │   └── useSettings.ts       # Settings persistence
│   └── types/              # TypeScript definitions
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   └── lib.rs          # Main application setup
│   └── Cargo.toml
├── docs/phases/            # Development roadmap
└── CLAUDE.md               # AI assistant documentation
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
npm run tauri:dev        # Development mode
npm run tauri:build      # Production build
```

### Project Structure
- **Frontend-Backend Communication**: Uses Tauri's `invoke()` system
- **State Management**: Custom hooks for file, tab, and settings management
- **File Operations**: All file I/O handled by Rust backend with file watching
- **Rich Editing**: Tiptap/ProseMirror for WYSIWYG with markdown serialization
- **Block System**: Notion-style content blocks with drag-and-drop functionality
- **Mathematical Content**: KaTeX integration for LaTeX equation rendering
- **Diagrams**: Mermaid.js for flowcharts, sequence diagrams, and visualizations
- **Export System**: PDF and HTML generation with multiple themes
- **Media Management**: Advanced image editing and file attachment system
- **Multi-File Support**: Tab-based interface with per-tab state management
- **Settings**: Persistent storage using tauri-plugin-store

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

### 📋 Phase 4: Polish & Performance (Planned)
- UI/UX refinements and animations
- Performance optimizations
- Accessibility improvements
- Plugin system architecture

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

- Cross-platform testing pending for Windows and Linux builds
- Bundle size increased due to rich editor dependencies (~2.5MB gzipped)
- Some advanced table features (CSV import/export, sorting) not yet implemented
- Focus mode and batch export features planned for future releases

## 📞 Support

For bugs and feature requests, please open an issue on GitHub.

---

Built with ❤️ using Tauri and React