# GTD Space

A streamlined cross-platform desktop markdown editor built with Tauri, React, and TypeScript.

![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Tech Stack](https://img.shields.io/badge/Stack-Tauri%202.x%20%7C%20React%2018%20%7C%20Rust-orange)
![Version](https://img.shields.io/badge/Version-0.0.0-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **WYSIWYG Markdown Editing** - BlockNote editor with rich text formatting
- **Multi-Tab Interface** - Work with multiple files simultaneously
- **Auto-Save** - Never lose your work (2s debounce)
- **File Management** - Native file browser with create, rename, delete
- **Code Syntax Highlighting** - Supports 100+ languages with Shiki
- **Theme Support** - Light/dark/auto themes
- **Search** - Find text across all markdown files
- **File Watching** - Real-time external change detection

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://www.rust-lang.org/) (latest stable)
- Platform-specific requirements in [docs/installation.md](docs/installation.md)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/gtdspace.git
cd gtdspace

# Install dependencies
npm install

# Run development server
npm run tauri:dev

# Build for production
npm run tauri:build
```

## Documentation

- [Installation Guide](docs/installation.md) - Detailed setup instructions
- [Architecture Overview](docs/architecture.md) - System design and patterns
- [Theming & Styles](docs/theming.md) - CSS variables and theme system
- [Tauri Integration](docs/tauri.md) - Backend commands and IPC
- [BlockNote Editor](docs/blocknote.md) - Editor configuration and extensions
- [Custom Hooks](docs/hooks.md) - State management patterns
- [Settings System](docs/settings.md) - User preferences and persistence
- [Markdown Processing](docs/markdown.md) - How markdown is handled internally

## Development

```bash
npm run tauri:dev    # Full development environment
npm run type-check   # TypeScript checking
npm run lint         # ESLint
npm run lint:fix     # Auto-fix linting issues
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Save | `Ctrl/Cmd+S` |
| New File | `Ctrl/Cmd+N` |
| Open Folder | `Ctrl/Cmd+O` |
| Close Tab | `Ctrl/Cmd+W` |
| Search | `Ctrl/Cmd+F` |
| Settings | `Ctrl/Cmd+,` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with [Tauri](https://tauri.app/), [React](https://react.dev/), [BlockNote](https://www.blocknotejs.org/), and [shadcn/ui](https://ui.shadcn.com/).