# GTD Space

A streamlined cross-platform desktop markdown editor built with Tauri, React, and TypeScript. GTD Space provides a local-first markdown editing experience focused on simplicity and core functionality.

![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Tech Stack](https://img.shields.io/badge/Stack-Tauri%202.x%20%7C%20React%2018%20%7C%20Rust-orange)
![Version](https://img.shields.io/badge/Version-0.0.0-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 🚀 Core Features

- **Native File Management** - Browse and manage markdown files with native folder selection
- **Markdown Editor** - Syntax highlighting with CodeMirror 6
- **Preview Mode** - Live markdown preview with source/preview toggle
- **Multi-Tab Editing** - Open multiple files with tab management
- **Auto-Save** - Automatic saving with visual feedback (2s debounce)
- **File Operations** - Create, rename, and delete files
- **Search** - Basic file search within current folder
- **Theme Support** - Light, dark, and auto themes
- **File Watcher** - Real-time detection of external file changes
- **Keyboard Shortcuts** - Essential shortcuts for productivity

## 🛠️ Tech Stack

### Frontend

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality accessible UI components
- **CodeMirror 6** - Advanced code editing for markdown
- **marked** - Markdown parsing for preview
- **React Hotkeys Hook** - Keyboard shortcut management
- **Vite** - Lightning-fast build tool

### Backend

- **Rust** - Performance and memory safety
- **Tauri 2.x** - Native desktop capabilities
- **notify** - File system watching

### State Management

- **Custom Hooks** - No external state libraries (Redux/MobX)
- **Tauri Store** - Persistent settings storage
- **Local State** - Component-level state management

## 📦 Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/) (latest stable)
- Platform-specific dependencies:
  - **Windows**: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libgtk-3-dev`, `libwebkit2gtk-4.0-dev`, `libssl-dev`

### Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/gtdspace.git
cd gtdspace
```

2. Install dependencies
```bash
npm install
```

3. Run development server
```bash
npm run tauri:dev
```

4. Build for production
```bash
npm run tauri:build
```

### Development Commands

```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Frontend-only development
npm run dev

# Build frontend only
npm run build

# Preview production build
npm run preview
```

## 🎯 Usage

1. **Open a Folder**: Click "Open Folder" or use `Ctrl/Cmd+O`
2. **Create Files**: Use the "New File" button or `Ctrl/Cmd+N`
3. **Edit Markdown**: Write in the editor with syntax highlighting
4. **Preview**: Toggle preview mode to see rendered markdown
5. **Save**: Auto-saves after 2 seconds or use `Ctrl/Cmd+S`

### Keyboard Shortcuts

- `Ctrl/Cmd+S` - Save current file
- `Ctrl/Cmd+O` - Open folder
- `Ctrl/Cmd+N` - New file
- `Ctrl/Cmd+W` - Close current tab
- `Ctrl/Cmd+Tab` - Next tab
- `Ctrl/Cmd+Shift+Tab` - Previous tab
- `Ctrl/Cmd+F` - Search files
- `Ctrl/Cmd+,` - Open settings
- `Ctrl/Cmd+/` - Show keyboard shortcuts

## 🏗️ Project Structure

```
gtdspace/
├── src/                    # Frontend source
│   ├── components/         # React components
│   │   ├── app/           # Application header
│   │   ├── editor/        # CodeMirror editor
│   │   ├── file-browser/  # File management UI
│   │   ├── lazy/          # Lazy loaded components
│   │   ├── settings/      # Settings interface
│   │   ├── tabs/          # Tab management
│   │   └── ui/            # shadcn/ui components
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript types
│   ├── styles/            # Global styles
│   └── AppPhase2.tsx      # Main app component
├── src-tauri/             # Backend source
│   ├── src/
│   │   ├── commands/      # Tauri commands
│   │   └── main.rs        # Application entry
│   └── Cargo.toml         # Rust dependencies
├── package.json           # Node dependencies
├── tauri.conf.json        # Tauri configuration
└── CLAUDE.md              # AI assistant guidelines
```

## 🚧 Known Limitations

- **File Size**: Maximum 10MB per file
- **Tab Limit**: Maximum 10 open tabs
- **Search**: Basic text search only (no regex)
- **TypeScript**: Strict mode is currently disabled
- **Testing**: No test suite implemented yet

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Run type checking (`npm run type-check`)
4. Run linting (`npm run lint`)
5. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
6. Push to the branch (`git push origin feature/AmazingFeature`)
7. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

## 🔧 Troubleshooting

### Common Issues

1. **Tauri build fails**: Ensure all platform-specific dependencies are installed
2. **File operations not working**: Run with `npm run tauri:dev` (not `npm run dev`)
3. **TypeScript errors**: Run `npm run type-check` to identify issues
4. **Performance issues**: Close unused tabs (max 10 tabs supported)

---

For bugs and feature requests, please [open an issue on GitHub](https://github.com/yourusername/gtdspace/issues).