# GTD Space

A cross-platform desktop markdown editor built with Tauri, React, and TypeScript. GTD Space provides a local-first markdown editing experience with a focus on simplicity and performance.

![Status](https://img.shields.io/badge/Phase%201%20MVP-100%25%20Complete-success)
![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Tech Stack](https://img.shields.io/badge/Stack-Tauri%202.x%20%7C%20React%2018%20%7C%20Rust-orange)

## 🚀 Features

### Current (Phase 1 MVP - Complete)
- ✅ **Native File Management** - Browse and manage markdown files with native folder selection
- ✅ **Markdown Editor** - Source, preview, and split-view modes
- ✅ **Auto-Save** - Automatic saving with visual feedback
- ✅ **File Operations** - Create, rename, and delete files
- ✅ **Search & Filter** - Real-time file search functionality
- ✅ **Settings Persistence** - Theme, editor preferences, and last folder persist across sessions
- ✅ **Keyboard Shortcuts** - Ctrl/Cmd+S to save, Ctrl/Cmd+O to open folder
- ✅ **Dark Theme** - Beautiful dark mode interface with shadcn/ui components

### Coming Soon (Phase 2)
- 🔄 Rich WYSIWYG editing with Tiptap
- 🔄 Syntax highlighting for code blocks
- 🔄 Advanced search and replace
- 🔄 File templates and snippets

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality UI components
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
3. **Edit Content**: Click any file to open it in the editor
4. **Switch Modes**: Toggle between source, preview, and split view
5. **Auto-Save**: Your changes are automatically saved every 2 seconds
6. **Search Files**: Use the search bar to filter files by name

### Keyboard Shortcuts
- `Ctrl/Cmd + S` - Save current file
- `Ctrl/Cmd + O` - Open folder selection
- `Escape` - Close dialogs

## 🏗️ Architecture

```
gtdspace/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── file-browser/   # File management UI
│   │   ├── editor/         # Text editor components
│   │   └── ui/             # shadcn/ui components
│   ├── hooks/              # Custom React hooks
│   │   ├── useFileManager.ts
│   │   └── useSettings.ts
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
- **State Management**: Custom hooks for file and settings management
- **File Operations**: All file I/O handled by Rust backend
- **Settings**: Persistent storage using tauri-plugin-store

## 📝 Development Phases

### ✅ Phase 0: Setup (Complete)
- Basic Tauri application shell
- React + TypeScript configuration
- Development environment setup

### ✅ Phase 1: MVP (Complete)
- File browser with folder selection
- Basic markdown editor
- File operations (CRUD)
- Auto-save functionality
- Settings persistence

### 🔄 Phase 2: Enhancement (Planned)
- Rich text editing with Tiptap
- Advanced editor features
- Global search across files
- Templates and snippets

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
- Icons by [Lucide](https://lucide.dev/) - Beautiful & consistent icons

## 🐛 Known Issues

- File watching not implemented - external changes require manual refresh
- Cross-platform testing pending for Windows and Linux

## 📞 Support

For bugs and feature requests, please open an issue on GitHub.

---

Built with ❤️ using Tauri and React