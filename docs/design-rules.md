# Design Rules - Tauri Markdown Editor

> **Purpose:** This document establishes the visual design system, UI guidelines, and interaction patterns for the Tauri Markdown Editor. It leverages shadcn/ui components with minimal customization to create a responsive, minimalist, dark-first interface optimized for productivity and text editing.

## Design Principles

### Core Philosophy
**"Minimal by Design, Powerful by Function"**

1. **Dark-First Approach** - Default to dark mode for reduced eye strain during extended writing sessions
2. **Content-Focused Design** - Every UI element serves the primary goal of markdown editing and file management
3. **Responsive Minimalism** - Clean interfaces that adapt seamlessly across different screen sizes
4. **Cognitive Load Reduction** - Consistent patterns and minimal visual complexity to maintain focus on content
5. **Accessibility-First** - High contrast ratios, keyboard navigation, and screen reader compatibility

### UI Guidelines

#### Information Hierarchy
```
Primary: Markdown content and editor interface
Secondary: File browser and navigation elements
Tertiary: Status indicators and metadata
Quaternary: Settings and configuration options
```

#### Visual Weight Distribution
- **Editor Area**: 70-80% of screen real estate on desktop
- **Sidebar**: 20-25% for file management and navigation
- **Status/Menu**: 5-10% for application controls and feedback

#### Interaction Patterns
- **Progressive Disclosure**: Advanced features hidden behind simple interfaces
- **Contextual Actions**: Right-click menus and hover states for file operations
- **Keyboard-First**: All primary actions accessible via keyboard shortcuts
- **Immediate Feedback**: Visual confirmation for all user actions

---

## Color System

### Base Color Palette (Slate Theme)

We use shadcn's **Slate** color scheme optimized for text editing environments:

```css
/* Light Mode (Secondary) */
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.129 0.042 264.695);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.129 0.042 264.695);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.129 0.042 264.695);
  --primary: oklch(0.208 0.042 265.755);
  --primary-foreground: oklch(0.984 0.003 247.858);
  --secondary: oklch(0.968 0.007 247.896);
  --secondary-foreground: oklch(0.208 0.042 265.755);
  --muted: oklch(0.968 0.007 247.896);
  --muted-foreground: oklch(0.554 0.046 257.417);
  --accent: oklch(0.968 0.007 247.896);
  --accent-foreground: oklch(0.208 0.042 265.755);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.929 0.013 255.508);
  --input: oklch(0.929 0.013 255.508);
  --ring: oklch(0.704 0.04 256.788);
  --sidebar: oklch(0.984 0.003 247.858);
  --sidebar-foreground: oklch(0.129 0.042 264.695);
  --sidebar-primary: oklch(0.208 0.042 265.755);
  --sidebar-primary-foreground: oklch(0.984 0.003 247.858);
  --sidebar-accent: oklch(0.968 0.007 247.896);
  --sidebar-accent-foreground: oklch(0.208 0.042 265.755);
  --sidebar-border: oklch(0.929 0.013 255.508);
  --sidebar-ring: oklch(0.704 0.04 256.788);
}

/* Dark Mode (Primary/Default) */
.dark {
  --background: oklch(0.129 0.042 264.695);
  --foreground: oklch(0.984 0.003 247.858);
  --card: oklch(0.208 0.042 265.755);
  --card-foreground: oklch(0.984 0.003 247.858);
  --popover: oklch(0.208 0.042 265.755);
  --popover-foreground: oklch(0.984 0.003 247.858);
  --primary: oklch(0.929 0.013 255.508);
  --primary-foreground: oklch(0.208 0.042 265.755);
  --secondary: oklch(0.279 0.041 260.031);
  --secondary-foreground: oklch(0.984 0.003 247.858);
  --muted: oklch(0.279 0.041 260.031);
  --muted-foreground: oklch(0.704 0.04 256.788);
  --accent: oklch(0.279 0.041 260.031);
  --accent-foreground: oklch(0.984 0.003 247.858);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.551 0.027 264.364);
  --sidebar: oklch(0.208 0.042 265.755);
  --sidebar-foreground: oklch(0.984 0.003 247.858);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.984 0.003 247.858);
  --sidebar-accent: oklch(0.279 0.041 260.031);
  --sidebar-accent-foreground: oklch(0.984 0.003 247.858);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.551 0.027 264.364);
}
```

### Color Usage Guidelines

#### Semantic Color Application
- **`background`**: Main application background
- **`card`**: File list items, editor panels, dialog backgrounds
- **`sidebar`**: File browser and navigation panel
- **`primary`**: Active states, selected files, primary actions
- **`secondary`**: Toolbar buttons, secondary actions
- **`muted`**: File metadata, timestamps, word counts
- **`accent`**: Hover states, focus indicators
- **`destructive`**: Delete actions, error states

#### Markdown Content Colors
```css
/* Additional colors for markdown content styling */
:root {
  --code-bg: var(--muted);
  --code-text: var(--foreground);
  --quote-border: var(--primary);
  --link-color: var(--primary);
  --heading-color: var(--foreground);
}

.dark {
  --code-bg: oklch(0.279 0.041 260.031 / 0.8);
  --code-text: oklch(0.984 0.003 247.858);
  --quote-border: var(--primary);
  --link-color: oklch(0.488 0.243 264.376);
  --heading-color: var(--foreground);
}
```

---

## Typography System

### Font Stack
Using system fonts for optimal performance and native feel:

```css
/* Primary Text (UI and Content) */
--font-sans: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";

/* Monospace (Code and Technical Content) */
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
```

### Type Scale
Following shadcn's typography conventions:

```css
/* Heading Scale */
.h1 { font-size: 2.25rem; line-height: 2.5rem; font-weight: 800; } /* 36px */
.h2 { font-size: 1.875rem; line-height: 2.25rem; font-weight: 700; } /* 30px */
.h3 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; } /* 24px */
.h4 { font-size: 1.25rem; line-height: 1.75rem; font-weight: 600; } /* 20px */

/* Body Scale */
.text-lg { font-size: 1.125rem; line-height: 1.75rem; } /* 18px */
.text-base { font-size: 1rem; line-height: 1.5rem; } /* 16px */
.text-sm { font-size: 0.875rem; line-height: 1.25rem; } /* 14px */
.text-xs { font-size: 0.75rem; line-height: 1rem; } /* 12px */
```

### Typography Usage

#### Application UI
- **Primary Navigation**: `text-sm font-medium`
- **File Names**: `text-sm font-normal`
- **File Metadata**: `text-xs text-muted-foreground`
- **Button Labels**: `text-sm font-medium`
- **Status Text**: `text-xs text-muted-foreground`

#### Editor Content
- **Markdown Source**: `font-mono text-sm`
- **WYSIWYG Content**: `text-base leading-relaxed`
- **Code Blocks**: `font-mono text-sm`
- **Inline Code**: `font-mono text-sm bg-muted px-1 py-0.5 rounded`

#### Accessibility
- **Minimum Line Height**: 1.5 for body text, 1.25 for UI elements
- **Contrast Ratios**: All text meets WCAG AA standards
- **Font Sizes**: Minimum 14px for UI, 16px for content

---

## Component Conventions

### Core Component Usage

#### Shadcn Components by Feature Area

**Phase 1 - Core File Management:**
```typescript
// File Browser Sidebar
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

// File Operations
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogContent, AlertDialogHeader } from "@/components/ui/alert-dialog"

// Basic Editor
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
```

**Phase 2 - Rich Editing:**
```typescript
// WYSIWYG Editor
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Table Editing
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
```

**Phase 3 - Advanced Features:**
```typescript
// Search and Navigation
import { Command, CommandDialog, CommandInput, CommandList } from "@/components/ui/command"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

// Settings and Preferences
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
```

### Component Styling Patterns

#### Button Variants
```typescript
// Primary Actions (Save, Create, Open)
<Button variant="default">Save File</Button>

// Secondary Actions (Cancel, Close)
<Button variant="outline">Cancel</Button>

// Destructive Actions (Delete, Remove)
<Button variant="destructive">Delete File</Button>

// Icon-only Actions
<Button variant="ghost" size="icon">
  <FileIcon className="h-4 w-4" />
</Button>
```

#### Input Patterns
```typescript
// Search Inputs
<Input 
  placeholder="Search files..." 
  className="border-none bg-muted/50 focus:bg-background"
/>

// File Name Inputs
<Input 
  placeholder="Enter filename..." 
  className="font-mono text-sm"
/>
```

#### Card Layouts
```typescript
// File List Items
<Card className="border-none bg-transparent hover:bg-muted/50 transition-colors cursor-pointer">
  <CardContent className="p-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{fileName}</span>
      <span className="text-xs text-muted-foreground">{lastModified}</span>
    </div>
  </CardContent>
</Card>
```

---

## Icon System

### Lucide Icons
Using Lucide React as the primary icon library (shadcn's recommended choice):

```bash
npm install lucide-react
```

### Icon Usage Guidelines

#### Icon Sizes
- **Small UI Elements**: `h-4 w-4` (16px)
- **Standard Buttons**: `h-5 w-5` (20px)
- **Large Actions**: `h-6 w-6` (24px)
- **Hero Icons**: `h-8 w-8` (32px)

#### Application Icon Map

**File Operations:**
```typescript
import { 
  FileText,      // .md files
  File,          // generic files
  Folder,        // directories
  FolderOpen,    // expanded directories
  Plus,          // create new
  Search,        // search functionality
  Filter,        // filter controls
} from "lucide-react"
```

**Editor Actions:**
```typescript
import { 
  Bold,          // text formatting
  Italic,        // text formatting
  List,          // bullet lists
  ListOrdered,   // numbered lists
  Link,          // hyperlinks
  Image,         // images
  Code,          // code blocks
  Quote,         // blockquotes
  Table,         // tables
  Eye,           // preview mode
  EyeOff,        // hide preview
  Edit3,         // edit mode
} from "lucide-react"
```

**Application Controls:**
```typescript
import { 
  Menu,          // hamburger menu
  X,             // close actions
  Settings,      // preferences
  Moon,          // dark mode
  Sun,           // light mode
  Save,          // save file
  Download,      // export
  Upload,        // import
  RefreshCw,     // reload
  AlertCircle,   // warnings
  CheckCircle,   // success states
} from "lucide-react"
```

#### Icon Implementation Pattern
```typescript
// Consistent icon usage with proper accessibility
const FileIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <FileText className={className} aria-hidden="true" />
);

// Interactive icons with proper states
<Button variant="ghost" size="icon" aria-label="Toggle bold formatting">
  <Bold className="h-4 w-4" />
</Button>
```

---

## Spacing & Layout System

### Spacing Scale
Following Tailwind/shadcn spacing conventions:

```css
/* Base spacing unit: 0.25rem (4px) */
--spacing-1: 0.25rem;   /* 4px */
--spacing-2: 0.5rem;    /* 8px */
--spacing-3: 0.75rem;   /* 12px */
--spacing-4: 1rem;      /* 16px */
--spacing-5: 1.25rem;   /* 20px */
--spacing-6: 1.5rem;    /* 24px */
--spacing-8: 2rem;      /* 32px */
--spacing-10: 2.5rem;   /* 40px */
--spacing-12: 3rem;     /* 48px */
```

### Layout Patterns

#### Application Shell
```typescript
// Desktop Layout (≥768px)
<div className="flex h-screen">
  {/* Sidebar */}
  <Sidebar className="w-64 border-r border-border">
    {/* Sidebar Content */}
  </Sidebar>
  
  {/* Main Content */}
  <main className="flex-1 flex flex-col">
    {/* Editor Tabs */}
    <Tabs className="flex-1 flex flex-col">
      <TabsList className="border-b border-border px-4">
        {/* File Tabs */}
      </TabsList>
      <TabsContent className="flex-1 p-0">
        {/* Editor Content */}
      </TabsContent>
    </Tabs>
  </main>
</div>
```

#### Mobile Layout (≤767px)
```typescript
// Mobile-first responsive layout
<div className="flex flex-col h-screen">
  {/* Mobile Header */}
  <header className="flex items-center justify-between p-4 border-b border-border">
    <Button variant="ghost" size="icon">
      <Menu className="h-5 w-5" />
    </Button>
    <h1 className="text-sm font-medium">Current File</h1>
    <Button variant="ghost" size="icon">
      <Search className="h-5 w-5" />
    </Button>
  </header>
  
  {/* Editor Content */}
  <main className="flex-1 overflow-hidden">
    {/* Full-screen editor */}
  </main>
</div>
```

### Component Spacing

#### Internal Padding
- **Cards**: `p-4` (16px)
- **Dialogs**: `p-6` (24px)
- **Buttons**: `px-4 py-2` (16px horizontal, 8px vertical)
- **Inputs**: `px-3 py-2` (12px horizontal, 8px vertical)
- **List Items**: `p-3` (12px)

#### Margins and Gaps
- **Component Separation**: `gap-4` (16px)
- **Section Separation**: `gap-6` (24px)
- **Page Margins**: `p-6` (24px)
- **Form Element Spacing**: `space-y-4` (16px vertical)

#### Responsive Breakpoints
```css
/* Mobile First */
.container {
  padding: 1rem; /* 16px */
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .container {
    padding: 1.5rem; /* 24px */
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .container {
    padding: 2rem; /* 32px */
  }
}
```

---

## Interaction Patterns

### State Management

#### Interactive States
```css
/* Hover States */
.hover\:bg-muted\/50:hover {
  background-color: oklch(var(--muted) / 0.5);
}

/* Focus States */
.focus\:ring-2:focus {
  ring-width: 2px;
  ring-color: oklch(var(--ring));
}

/* Active States */
.active\:bg-muted:active {
  background-color: oklch(var(--muted));
}

/* Selected States */
.data-\[state\=selected\]\:bg-accent[data-state="selected"] {
  background-color: oklch(var(--accent));
}
```

#### Animation and Transitions
```css
/* Standard Transitions */
.transition-colors {
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Loading States */
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Micro-interactions */
.transition-transform {
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
```

### Keyboard Navigation

#### Focus Management
- **Tab Order**: Logical left-to-right, top-to-bottom
- **Focus Indicators**: Visible ring around focused elements
- **Skip Links**: Jump to main content for screen readers

#### Keyboard Shortcuts
```typescript
// Global Application Shortcuts
const shortcuts = {
  'Ctrl+N': 'New File',
  'Ctrl+O': 'Open Folder',
  'Ctrl+S': 'Save File',
  'Ctrl+F': 'Find in File',
  'Ctrl+Shift+F': 'Find in All Files',
  'Ctrl+P': 'Quick File Switch',
  'Ctrl+,': 'Open Settings',
  'F11': 'Toggle Full Screen',
  'Ctrl+`': 'Toggle Sidebar',
}

// Editor-specific Shortcuts
const editorShortcuts = {
  'Ctrl+B': 'Bold',
  'Ctrl+I': 'Italic',
  'Ctrl+K': 'Insert Link',
  'Ctrl+Shift+M': 'Toggle Preview',
  'Ctrl+/': 'Toggle Comment',
}
```

### Loading and Error States

#### Loading Patterns
```typescript
// File Loading Skeleton
<div className="space-y-2">
  {Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="flex items-center space-x-3 p-3">
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  ))}
</div>

// Content Loading
<div className="flex items-center justify-center h-full">
  <div className="flex items-center space-x-2 text-muted-foreground">
    <RefreshCw className="h-4 w-4 animate-spin" />
    <span className="text-sm">Loading file...</span>
  </div>
</div>
```

#### Error States
```typescript
// File Operation Errors
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Failed to save file. Please check permissions and try again.
  </AlertDescription>
</Alert>

// Empty States
<div className="flex flex-col items-center justify-center h-full text-center p-8">
  <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
  <h3 className="text-lg font-medium mb-2">No files found</h3>
  <p className="text-sm text-muted-foreground mb-4">
    Select a folder to start editing markdown files
  </p>
  <Button variant="outline">
    <Folder className="h-4 w-4 mr-2" />
    Select Folder
  </Button>
</div>
```

---

## Responsive Design Guidelines

### Breakpoint Strategy
```css
/* Mobile First Approach */
/* Base: 320px+ (mobile) */
.sidebar { display: none; }

/* Tablet: 768px+ */
@media (min-width: 768px) {
  .sidebar { display: block; width: 256px; }
}

/* Desktop: 1024px+ */
@media (min-width: 1024px) {
  .sidebar { width: 280px; }
}

/* Large Desktop: 1440px+ */
@media (min-width: 1440px) {
  .sidebar { width: 320px; }
}
```

### Adaptive Layouts
- **Mobile (≤767px)**: Single-column layout, collapsible navigation
- **Tablet (768-1023px)**: Two-column layout, sidebar + content
- **Desktop (1024px+)**: Multi-panel layout with sidebar, editor, and optional preview

### Touch Interactions
- **Minimum Touch Target**: 44px × 44px
- **Touch-friendly Spacing**: Increased padding on mobile
- **Swipe Gestures**: File switching, sidebar toggle

---

## Accessibility Standards

### WCAG 2.1 AA Compliance
- **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Keyboard Navigation**: All functionality accessible via keyboard
- **Screen Reader Support**: Proper ARIA labels and semantic HTML
- **Focus Management**: Visible focus indicators and logical tab order

### Implementation Guidelines
```typescript
// Proper ARIA Labeling
<Button aria-label="Create new file" variant="ghost" size="icon">
  <Plus className="h-4 w-4" />
</Button>

// Semantic HTML Structure
<nav aria-label="File browser">
  <ul role="list">
    <li role="listitem">
      <button role="button" aria-pressed={isSelected}>
        File name
      </button>
    </li>
  </ul>
</nav>

// Screen Reader Announcements
<div aria-live="polite" className="sr-only">
  {statusMessage}
</div>
```

This design system provides a comprehensive foundation for building the Tauri Markdown Editor with consistent, accessible, and minimal design patterns that prioritize content creation and file management workflows. 