# GTD Space

A GTD-first productivity system with integrated markdown editing, built with Tauri, React, and TypeScript.

![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Tech Stack](https://img.shields.io/badge/Stack-Tauri%202.x%20%7C%20React%2018%20%7C%20Rust-orange)
![Version](https://img.shields.io/badge/Version-0.0.0-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

### GTD-First Design

- **Getting Things Done at the Core** - Not just an editor with GTD features, but a GTD system with editing capabilities
- **Complete Horizons of Focus** - All 6 GTD levels from runway actions to 50,000 ft purpose
- **Automatic GTD Space Detection** - Recognizes and adapts to GTD workspace structure
- **Project & Action Management** - Full GTD workflow with projects, actions, and organization
- **Smart Navigation** - Click projects to view README, expand to see all actions
- **Quick Actions** - Floating action button for rapid project/action creation

### Productivity Features

- **WYSIWYG Markdown Editing** - BlockNote editor with rich text formatting
- **Multi-Tab Interface** - Work with multiple files simultaneously with drag-and-drop reordering
- **Auto-Save** - Never lose your work (2s debounce with parallel save optimization)
- **Persistent Sidebar** - GTD workspace stays loaded even when collapsed
- **Action List in Sidebar** - See all project actions at a glance with real-time status updates
- **Real-time Updates** - File watcher detects external changes
- **Smart Notifications** - Deduped alerts for file changes
- **Interactive Single/MultiSelect Fields** - Notion-like dropdowns for Status, Effort, and Tags that can't be accidentally overwritten
- **Beautiful Date & Time Pickers** - Visual calendar and time selection for due dates, focus dates, and scheduling
- **Bidirectional Title Sync** - Document titles automatically rename files/folders and vice versa
- **Content Event System** - Real-time metadata updates across the UI

### Technical Features

- **Code Syntax Highlighting** - Supports 100+ languages with Shiki
- **Theme Support** - Light/dark/auto themes
- **Global Search** - Find text across all markdown files
- **Native File Operations** - Create, rename, delete with OS dialogs

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

# Run development server (auto-creates your GTD Space at ~/GTD Space on first run)
npm run tauri:dev

# Build for production
npm run tauri:build
```

## Documentation

- [Installation Guide](docs/installation.md) - Detailed setup instructions
- [Architecture Overview](docs/architecture.md) - System design and patterns
- [GTD Implementation](docs/GTD_IMPLEMENTATION.md) - Getting Things Done methodology integration
- [MultiSelect Fields](docs/multiselect-fields.md) - Interactive dropdown fields for Status and Effort
- [DateTime Fields](docs/datetime-fields.md) - Beautiful date and time pickers for deadlines and planning
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

## GTD (Getting Things Done) System

GTD Space is designed from the ground up around David Allen's Getting Things Done methodology:

### GTD Structure

- **Horizons of Focus** - Higher-level perspectives for life planning (NEW!)
  - **Areas of Focus** (20,000 ft) - Ongoing responsibilities and roles you maintain
  - **Goals** (30,000 ft) - 1-2 year objectives that guide your projects
  - **Vision** (40,000 ft) - 3-5 year aspirational picture of where you're heading
  - **Purpose & Principles** (50,000 ft) - Core values and life mission that drive everything
- **Projects** - Outcome-focused goals with multiple actions
  - Each project is a folder with README.md for metadata
  - Actions are individual markdown files within project folders
  - See all actions directly in the sidebar
  - Example content is created on first run to help you get started
- **Actions** - Concrete next steps within projects
  - Interactive Status tracking (In Progress, Waiting, Complete) via single-select dropdowns
  - Interactive Effort estimates (Small <30min, Medium 30-90min, Large >90min, Extra Large >3hr) via single-select dropdowns
  - Optional focus dates (when to work on) and due dates (deadlines)
- **Habits** - Recurring routines with automatic tracking
  - Interactive checkbox for status (To Do / Complete) with real-time updates
  - Smart frequency options (Daily, Every Other Day, Twice Weekly, Weekly, Weekdays, Biweekly, Monthly)
  - Automatic status reset based on frequency intervals
  - Self-documenting history log with timestamps
  - Backfills missed periods when app was offline
  - Toast notifications and visual feedback on status changes
- **Someday Maybe** - Ideas for future consideration with full page creation support
- **Cabinet** - Reference materials with organized document storage

### Getting Started with GTD

On first launch, GTD Space automatically initializes your workspace at `~/GTD Space` (macOS/Linux) or `%USERPROFILE%\\GTD Space` (Windows). It also seeds example projects and actions to demonstrate statuses, focus dates, due dates, and effort fields.

1. The default space is created or loaded automatically
2. Explore the seeded projects in `Projects/`
3. Create your own projects with clear outcomes and optional due dates
4. Add actions to projects - they appear instantly in the sidebar
5. Track progress with status updates

See [GTD Implementation](docs/GTD_IMPLEMENTATION.md) for detailed usage.

## Keyboard Shortcuts

| Action                | Shortcut           |
| --------------------- | ------------------ |
| Save                  | `Ctrl/Cmd+S`       |
| New File              | `Ctrl/Cmd+N`       |
| Open Folder           | `Ctrl/Cmd+O`       |
| Close Tab             | `Ctrl/Cmd+W`       |
| Search                | `Ctrl/Cmd+F`       |
| Settings              | `Ctrl/Cmd+,`       |
| Insert Status Field   | `Ctrl/Cmd+Alt+S`   |
| Insert Effort Field   | `Ctrl/Cmd+Alt+E`   |
| Insert Project Status | `Ctrl/Cmd+Alt+P`   |
| Insert Habit Frequency| `Ctrl/Cmd+Alt+F`   |
| Insert Habit Status   | `Ctrl/Cmd+Alt+H`   |
| Insert Due Date       | `Ctrl/Cmd+Alt+D`   |
| Insert Focus DateTime | `Ctrl/Cmd+Alt+T`   |
| Insert Created Date   | `Ctrl/Cmd+Alt+C`   |
| Next Tab              | `Ctrl/Cmd+Tab`     |
| Previous Tab          | `Ctrl/Cmd+Shift+Tab`|
| Tab by Number         | `Ctrl/Cmd+1-9`     |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with [Tauri](https://tauri.app/), [React](https://react.dev/), [BlockNote](https://www.blocknotejs.org/), and [shadcn/ui](https://ui.shadcn.com/).
