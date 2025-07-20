# Phase 0: Setup - Barebones Application

> **Goal:** Create a minimal Tauri application that opens, displays a window, and demonstrates basic Rust-React communication. This phase establishes the foundation and development environment but is not yet usable for actual markdown editing.

## Phase Overview

**Duration:** 3-5 days  
**Status:** Foundation  
**Value Delivered:** Working development environment and application shell  
**User Experience:** Application opens and displays basic UI, but no real functionality

## Success Criteria

- [x] Tauri application builds and runs on development machine
- [x] Basic React frontend renders inside Tauri window
- [x] Rust backend can receive and respond to frontend commands
- [x] Development hot reload works for frontend changes
- [x] Basic UI layout structure in place (sidebar + main area)

## Core Features

### 1. Project Initialization
**Deliverable:** Configured Tauri project with React frontend

**Steps:**
1. Initialize new Tauri project with React template
2. Configure `tauri.conf.json` with basic app metadata and window settings
3. Set up TypeScript configuration and basic type definitions
4. Install core dependencies (React, Tailwind, Lucide icons)
5. Verify build process works on target development platform

**Files Created:**
- `src-tauri/tauri.conf.json` - Basic app configuration
- `src/main.tsx` - React entry point
- `tailwind.config.js` - Styling configuration
- `package.json` - Dependencies and scripts

### 2. Basic UI Shell
**Deliverable:** Empty but structured user interface layout

**Steps:**
1. Create main application layout with sidebar and content areas
2. Implement basic dark theme using CSS variables
3. Add placeholder components for file browser and editor
4. Set up basic responsive behavior for desktop/mobile
5. Add loading states and empty state placeholders

**Components:**
- `Layout.tsx` - Main application shell
- `Sidebar.tsx` - Empty sidebar component
- `Editor.tsx` - Placeholder editor area
- `EmptyState.tsx` - Placeholder content

### 3. Rust Backend Foundation
**Deliverable:** Basic Rust command structure and error handling

**Steps:**
1. Set up main Rust application structure in `src-tauri/src/main.rs`
2. Create basic command handler functions (placeholder implementations)
3. Implement error handling types and utilities
4. Add logging configuration for development debugging
5. Test frontend-backend communication with simple ping/pong command

**Commands:**
- `ping()` - Test command that returns "pong"
- `get_app_version()` - Returns current application version
- `check_permissions()` - Verifies file system access capabilities

### 4. Development Environment
**Deliverable:** Configured tooling for efficient development

**Steps:**
1. Set up ESLint and Prettier for code formatting
2. Configure VS Code workspace settings and recommended extensions
3. Add development scripts for build, dev, and testing
4. Set up basic error boundaries and development error display
5. Configure Git ignore patterns for build artifacts

**Configuration:**
- `.eslintrc.json` - Code linting rules
- `.prettierrc` - Code formatting rules
- `.vscode/settings.json` - Editor configuration
- `scripts` in package.json for development workflow

### 5. Basic Window Management
**Deliverable:** Proper desktop application window behavior

**Steps:**
1. Configure window properties (size, position, title)
2. Implement basic menu structure (File, Edit, View, Help)
3. Add window state persistence (size/position memory)
4. Set up proper application icon and metadata
5. Test application startup and shutdown behavior

**Features:**
- Default window size: 1200x800px
- Minimum window size: 800x600px
- Window title updates based on current file (placeholder)
- Basic menu structure (non-functional in this phase)

## Technical Requirements

### Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tauri-apps/api": "^2.0.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.2.0",
    "tailwindcss": "^3.3.0",
    "vite": "^4.4.0"
  }
}
```

### File Structure
```
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   └── commands/
│   │       └── mod.rs
│   ├── tauri.conf.json
│   └── Cargo.toml
├── src/
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   └── Editor.tsx
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

## Testing & Validation

### Manual Testing Checklist
- [ ] Application starts without errors
- [ ] Window opens with correct size and title
- [ ] Dark theme is properly applied
- [ ] Sidebar and main content areas are visible
- [ ] Hot reload works when editing React components
- [ ] Frontend can call Rust commands and receive responses
- [ ] Application can be built for production
- [ ] Built application runs independently

### Development Commands
```bash
# Development server
npm run tauri dev

# Production build
npm run tauri build

# Type checking
npm run type-check

# Linting
npm run lint
```

## Known Limitations

- **No File Operations:** Cannot open, save, or manage files yet
- **No Editor Functionality:** Text editing is not implemented
- **Placeholder UI:** All components are empty shells
- **No Persistence:** No settings or state is saved between sessions
- **Single Platform:** Only tested on development platform

## Next Phase Prerequisites

Before moving to Phase 1 (MVP), ensure:
1. All setup phase features are working correctly
2. Development environment is stable and efficient
3. Team members can successfully run the application locally
4. Basic UI structure provides foundation for file management features
5. Rust-React communication is reliable and well-understood

## Success Metrics

- **Build Time:** Development server starts in under 10 seconds
- **Bundle Size:** Initial production build under 15MB
- **Startup Time:** Application window appears within 3 seconds
- **Hot Reload:** Frontend changes reflect within 2 seconds
- **Platform Compatibility:** Builds successfully on target platforms

---

**Next Phase:** [Phase 1: MVP](./phase-1-mvp.md) - Basic markdown file management and editing capability 