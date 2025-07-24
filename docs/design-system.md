# GTD Space Design System

> **Comprehensive design system documentation for GTD Space - A professional markdown editor built with React, TypeScript, and Tauri**

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Visual Identity](#visual-identity)
4. [Typography](#typography)
5. [Color System](#color-system)
6. [Spacing & Layout](#spacing--layout)
7. [Components](#components)
8. [Icons & Illustrations](#icons--illustrations)
9. [Animation & Transitions](#animation--transitions)
10. [Interaction Patterns](#interaction-patterns)
11. [Responsive Design](#responsive-design)
12. [Accessibility](#accessibility)
13. [Implementation Guidelines](#implementation-guidelines)

---

## Overview

The GTD Space design system provides a cohesive set of design standards, components, and patterns that ensure consistency across the entire markdown editor application. Built on top of **shadcn/ui** and **Tailwind CSS**, it delivers a modern, professional, and accessible user experience optimized for productivity and text editing.

### Core Philosophy

**"Minimal by Design, Powerful by Function"**

### Key Technologies

- **shadcn/ui**: Component library with Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Unstyled, accessible components
- **Lucide React**: Icon system
- **CSS Variables**: Dynamic theming support
- **Tauri**: Cross-platform desktop framework

### Design System Goals

- **Consistency**: Unified visual language across all interfaces
- **Accessibility**: WCAG 2.1 AA compliance for all users
- **Performance**: Optimized for fast loading and smooth interactions
- **Content-Focused**: Every UI element serves the primary goal of markdown editing
- **Dark-First**: Default to dark mode for reduced eye strain during extended writing sessions
- **Developer Experience**: Easy to use and extend

---

## Design Principles

### 1. **Dark-First Approach**

> _Default to dark mode for reduced eye strain during extended writing sessions_

- Dark mode as the primary interface theme
- High contrast ratios optimized for text editing
- Reduced blue light exposure for comfortable long-term use
- Light mode available as secondary option

### 2. **Content-Focused Design**

> _Every UI element serves the primary goal of markdown editing and file management_

- Editor area takes 70-80% of screen real estate on desktop
- Sidebar limited to 20-25% for file management and navigation
- Status/menu bars consume only 5-10% for application controls
- Progressive disclosure for advanced features

### 3. **Cognitive Load Reduction**

> _Consistent patterns and minimal visual complexity to maintain focus on content_

- Minimize cognitive load with clean, uncluttered interfaces
- Use familiar patterns and conventions
- Provide clear visual hierarchy
- Remove unnecessary decorative elements

### 4. **Accessibility & Inclusion**

> _Design for all users, regardless of their abilities_

- Follow WCAG 2.1 AA guidelines
- Provide keyboard navigation support
- Use sufficient color contrast ratios
- Include proper ARIA labels and semantic markup

### 5. **Performance & Efficiency**

> _Fast, responsive interfaces that don't impede productivity_

- Optimize for quick task completion
- Minimize loading states and delays
- Use progressive disclosure for complex features
- Prioritize content over chrome
- Keyboard-first interactions for power users

### 6. **Professional & Trustworthy**

> _Convey reliability and competence through design_

- Use refined, professional aesthetics
- Maintain high attention to detail
- Ensure error states are helpful and constructive
- Build user confidence through consistent reliability

---

## Visual Identity

### Brand Characteristics

- **Professional**: Clean, modern, and business-appropriate
- **Efficient**: Optimized for productivity and focus
- **Reliable**: Stable, predictable, and trustworthy
- **Minimal**: Content-focused with purposeful design decisions
- **Approachable**: Welcoming without being casual

### Visual Style

- **Minimalist**: Clean layouts with purposeful whitespace
- **Geometric**: Consistent use of geometric shapes and grid systems
- **Subtle**: Refined details that enhance without distraction
- **Modern**: Contemporary design patterns and interactions
- **Responsive**: Seamless adaptation across different screen sizes

### Information Hierarchy

```
Primary: Markdown content and editor interface
Secondary: File browser and navigation elements
Tertiary: Status indicators and metadata
Quaternary: Settings and configuration options
```

---

## Typography

### Font System

We use **system fonts** for optimal performance and native feel, with **Inter** as the preferred web font when available:

```css
/* Primary UI Font */
--font-sans: Inter, ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji',
  'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';

/* Monospace for Code and Technical Content */
--font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas,
  'Liberation Mono', monospace;
```

### Type Scale

Based on a modular scale with consistent rhythm and hierarchy:

| Class       | Size | Weight  | Line Height | Use Case                                 |
| ----------- | ---- | ------- | ----------- | ---------------------------------------- |
| `text-xs`   | 12px | 400     | 16px        | File metadata, timestamps, captions      |
| `text-sm`   | 14px | 400-500 | 20px        | UI labels, file names, body text (small) |
| `text-base` | 16px | 400     | 24px        | Editor content, body text (default)      |
| `text-lg`   | 18px | 500     | 28px        | Subheadings, section titles              |
| `text-xl`   | 20px | 600     | 28px        | Card titles, dialog headers              |
| `text-2xl`  | 24px | 600     | 32px        | Page headings, main titles               |
| `text-3xl`  | 30px | 700     | 36px        | Feature headings                         |
| `text-4xl`  | 36px | 700-800 | 40px        | Display headings, hero text              |

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

#### Accessibility Requirements

- **Minimum Line Height**: 1.5 for body text, 1.25 for UI elements
- **Contrast Ratios**: All text meets WCAG AA standards
- **Font Sizes**: Minimum 14px for UI, 16px for content
- **Semantic HTML**: Proper heading hierarchy (h1, h2, p, etc.)

---

## Color System

### Base Color Palette (Slate Theme)

We use shadcn's **Slate** color scheme optimized for text editing environments with dark-first approach:

```css
/* Light Mode (Secondary) */
:root {
  --radius: 0.625rem;

  /* Core colors */
  --background: oklch(1 0 0); /* Pure white */
  --foreground: oklch(0.129 0.042 264.695); /* Near black */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.129 0.042 264.695);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.129 0.042 264.695);

  /* Primary colors */
  --primary: oklch(0.208 0.042 265.755); /* Slate blue */
  --primary-foreground: oklch(0.984 0.003 247.858);

  /* Secondary colors */
  --secondary: oklch(0.968 0.007 247.896); /* Light gray */
  --secondary-foreground: oklch(0.208 0.042 265.755);

  /* Muted colors */
  --muted: oklch(0.968 0.007 247.896);
  --muted-foreground: oklch(0.554 0.046 257.417);

  /* Accent colors */
  --accent: oklch(0.968 0.007 247.896);
  --accent-foreground: oklch(0.208 0.042 265.755);

  /* Destructive colors */
  --destructive: oklch(0.577 0.245 27.325); /* Red */
  --destructive-foreground: oklch(0.984 0.003 247.858);

  /* Border and input colors */
  --border: oklch(0.929 0.013 255.508);
  --input: oklch(0.929 0.013 255.508);
  --ring: oklch(0.704 0.04 256.788);

  /* Sidebar-specific colors */
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
  --background: oklch(0.129 0.042 264.695); /* Dark background */
  --foreground: oklch(0.984 0.003 247.858); /* Light text */
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
  --destructive-foreground: oklch(0.984 0.003 247.858);

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

### Status Colors

```css
/* Success - Green */
--success: oklch(0.519 0.147 142.495); /* Green */
--success-foreground: oklch(0.984 0.003 247.858);

/* Warning - Orange */
--warning: oklch(0.701 0.129 70.669); /* Orange */
--warning-foreground: oklch(0.129 0.042 264.695);

/* Info - Blue */
--info: oklch(0.569 0.196 231.597); /* Blue */
--info-foreground: oklch(0.984 0.003 247.858);
```

### Markdown Content Colors

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
- **`success`**: Confirmations, completed states
- **`warning`**: Cautions, non-critical alerts
- **`info`**: Informational messages, help text

#### Accessibility Requirements

- **Text Contrast**: Minimum 4.5:1 ratio for normal text, 3:1 for large text
- **Interactive Elements**: Minimum 3:1 contrast ratio
- **Focus Indicators**: Clearly visible focus states for keyboard navigation
- **Color Independence**: Never rely solely on color to convey information

---

## Spacing & Layout

### Spacing Scale

Based on a 4px grid system (following Tailwind conventions) for consistent rhythm and alignment:

| Token | Value | Rem      | Tailwind Class | Use Case          |
| ----- | ----- | -------- | -------------- | ----------------- |
| `0`   | 0px   | 0        | `p-0`, `m-0`   | No spacing        |
| `0.5` | 2px   | 0.125rem | `p-0.5`        | Borders, dividers |
| `1`   | 4px   | 0.25rem  | `p-1`          | Tight spacing     |
| `2`   | 8px   | 0.5rem   | `p-2`          | Small spacing     |
| `3`   | 12px  | 0.75rem  | `p-3`          | Medium spacing    |
| `4`   | 16px  | 1rem     | `p-4`          | Default spacing   |
| `5`   | 20px  | 1.25rem  | `p-5`          | Large spacing     |
| `6`   | 24px  | 1.5rem   | `p-6`          | Section spacing   |
| `8`   | 32px  | 2rem     | `p-8`          | Component spacing |
| `10`  | 40px  | 2.5rem   | `p-10`         | Large sections    |
| `12`  | 48px  | 3rem     | `p-12`         | Page sections     |
| `16`  | 64px  | 4rem     | `p-16`         | Major sections    |
| `20`  | 80px  | 5rem     | `p-20`         | Page margins      |

### Layout Patterns

#### Application Shell (Desktop ≥768px)

```tsx
<div className="flex h-screen">
  {/* Sidebar */}
  <Sidebar className="w-64 border-r border-border">
    <SidebarContent className="p-4" />
  </Sidebar>

  {/* Main Content */}
  <main className="flex-1 flex flex-col">
    {/* Editor Tabs */}
    <Tabs className="flex-1 flex flex-col">
      <TabsList className="border-b border-border px-4">
        {/* File Tabs */}
      </TabsList>
      <TabsContent className="flex-1 p-0">{/* Editor Content */}</TabsContent>
    </Tabs>
  </main>
</div>
```

#### Mobile Layout (≤767px)

```tsx
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
  <main className="flex-1 overflow-hidden">{/* Full-screen editor */}</main>
</div>
```

### Responsive Breakpoints

```css
/* Mobile First Approach */
/* Base: 320px+ (mobile) */
.sidebar {
  display: none;
}

/* Tablet: 768px+ */
@media (min-width: 768px) {
  .sidebar {
    display: block;
    width: 256px;
  }
}

/* Desktop: 1024px+ */
@media (min-width: 1024px) {
  .sidebar {
    width: 280px;
  }
}

/* Large Desktop: 1440px+ */
@media (min-width: 1440px) {
  .sidebar {
    width: 320px;
  }
}
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

---

## Components

### Core Component Usage

#### Shadcn Components by Feature Area

**Phase 1 - Core File Management:**

```typescript
// File Browser Sidebar
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

// File Operations
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';

// Basic Editor
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
```

### Button System

#### Variants

- **Default**: Primary actions, main CTAs
- **Destructive**: Delete, remove, dangerous actions
- **Outline**: Secondary actions, alternatives
- **Secondary**: Supporting actions, less prominent
- **Ghost**: Subtle actions, icon buttons
- **Link**: Text-style buttons, inline actions

#### Sizes

- **Default**: 40px height, standard use
- **SM**: 32px height, compact interfaces
- **LG**: 48px height, prominent actions
- **Icon**: Square dimensions for icon-only buttons

#### Usage Examples

```tsx
// Primary Actions (Save, Create, Open)
<Button variant="default">Save File</Button>

// Secondary Actions (Cancel, Close)
<Button variant="outline">Cancel</Button>

// Destructive Actions (Delete, Remove)
<Button variant="destructive">Delete File</Button>

// Icon-only Actions
<Button variant="ghost" size="icon" aria-label="Toggle bold formatting">
  <Bold className="h-4 w-4" />
</Button>
```

### Input Patterns

```tsx
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

### Card Layouts

```tsx
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

### Form Components

#### States

- **Default**: Normal interactive state
- **Focus**: Keyboard/mouse focus
- **Disabled**: Non-interactive state
- **Error**: Invalid input indication
- **Success**: Valid input confirmation

#### Validation Example

```tsx
// Error state
<div>
  <Label htmlFor="filename">
    Filename
    <span className="text-destructive" aria-label="required">
      *
    </span>
  </Label>
  <Input
    id="filename"
    placeholder="Enter filename"
    className={error ? 'border-destructive' : ''}
    aria-invalid={error ? 'true' : 'false'}
    aria-describedby={error ? 'filename-error' : undefined}
  />
  {error && (
    <p id="filename-error" className="text-sm text-destructive" role="alert">
      {error}
    </p>
  )}
</div>
```

---

## Icons & Illustrations

### Icon System

Using **Lucide React** as the primary icon library (shadcn's recommended choice):

```bash
npm install lucide-react
```

### Icon Sizes

- **Small UI Elements**: `h-4 w-4` (16px)
- **Standard Buttons**: `h-5 w-5` (20px)
- **Large Actions**: `h-6 w-6` (24px)
- **Hero Icons**: `h-8 w-8` (32px)

### Application Icon Map

**File Operations:**

```typescript
import {
  FileText, // .md files
  File, // generic files
  Folder, // directories
  FolderOpen, // expanded directories
  Plus, // create new
  Search, // search functionality
  Filter, // filter controls
} from 'lucide-react';
```

**Editor Actions:**

```typescript
import {
  Bold, // text formatting
  Italic, // text formatting
  List, // bullet lists
  ListOrdered, // numbered lists
  Link, // hyperlinks
  Image, // images
  Code, // code blocks
  Quote, // blockquotes
  Table, // tables
  Eye, // preview mode
  EyeOff, // hide preview
  Edit3, // edit mode
} from 'lucide-react';
```

**Application Controls:**

```typescript
import {
  Menu, // hamburger menu
  X, // close actions
  Settings, // preferences
  Moon, // dark mode
  Sun, // light mode
  Save, // save file
  Download, // export
  Upload, // import
  RefreshCw, // reload
  AlertCircle, // warnings
  CheckCircle, // success states
} from 'lucide-react';
```

### Icon Implementation Pattern

```tsx
// Consistent icon usage with proper accessibility
const FileIcon: React.FC<{ className?: string }> = ({
  className = 'h-4 w-4',
}) => <FileText className={className} aria-hidden="true" />;

// Interactive icons with proper states
<Button variant="ghost" size="icon" aria-label="Toggle bold formatting">
  <Bold className="h-4 w-4" />
</Button>;
```

---

## Animation & Transitions

### Timing & Easing

#### Duration Scale

- **Fast**: 150ms - Micro-interactions, hover states
- **Normal**: 300ms - Component transitions, state changes
- **Slow**: 500ms - Page transitions, complex animations

#### Easing Curves

```css
/* Standard easing functions */
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

/* Custom easing for specific effects */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--ease-back: cubic-bezier(0.175, 0.885, 0.32, 1.275);
```

### Standard Transitions

```css
/* Color and background transitions */
.transition-colors {
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Transform transitions */
.transition-transform {
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
```

### Animation Principles

#### 1. **Purpose-Driven**

- Every animation should have a clear purpose
- Avoid animations that don't add value
- Use motion to guide attention and indicate relationships

#### 2. **Performance-First**

- Prefer CSS transforms over changing layout properties
- Use `transform` and `opacity` for smooth animations
- Avoid animating `width`, `height`, `top`, `left`

#### 3. **Accessibility-Aware**

- Respect `prefers-reduced-motion` settings
- Provide options to disable animations
- Ensure animations don't cause seizures or vestibular disorders

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
.data-\[state\=selected\]\:bg-accent[data-state='selected'] {
  background-color: oklch(var(--accent));
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
const globalShortcuts = {
  'Ctrl+N': 'New File',
  'Ctrl+O': 'Open Folder',
  'Ctrl+S': 'Save File',
  'Ctrl+F': 'Find in File',
  'Ctrl+Shift+F': 'Find in All Files',
  'Ctrl+P': 'Quick File Switch',
  'Ctrl+,': 'Open Settings',
  F11: 'Toggle Full Screen',
  'Ctrl+`': 'Toggle Sidebar',
};

// Editor-specific Shortcuts
const editorShortcuts = {
  'Ctrl+B': 'Bold',
  'Ctrl+I': 'Italic',
  'Ctrl+K': 'Insert Link',
  'Ctrl+Shift+M': 'Toggle Preview',
  'Ctrl+/': 'Toggle Comment',
};
```

### Loading and Error States

#### Loading Patterns

```tsx
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

```tsx
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

## Responsive Design

### Breakpoint Strategy

Following Tailwind CSS's mobile-first approach:

| Breakpoint | Min Width | Max Width | Use Case                    |
| ---------- | --------- | --------- | --------------------------- |
| Base       | 320px     | 639px     | Mobile phones               |
| `sm`       | 640px     | 767px     | Small tablets, large phones |
| `md`       | 768px     | 1023px    | Tablets, small laptops      |
| `lg`       | 1024px    | 1279px    | Laptops, small desktops     |
| `xl`       | 1280px    | 1535px    | Desktops                    |
| `2xl`      | 1536px+   | -         | Large desktops              |

### Adaptive Layouts

- **Mobile (≤767px)**: Single-column layout, collapsible navigation
- **Tablet (768-1023px)**: Two-column layout, sidebar + content
- **Desktop (1024px+)**: Multi-panel layout with sidebar, editor, and optional preview

### Touch Interactions

- **Minimum Touch Target**: 44px × 44px
- **Touch-friendly Spacing**: Increased padding on mobile
- **Swipe Gestures**: File switching, sidebar toggle

### Responsive Patterns

```tsx
// Responsive card layout
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>

// Adaptive navigation
<nav className="block md:hidden">
  <MobileMenu />
</nav>
<nav className="hidden md:block">
  <DesktopMenu />
</nav>

// Responsive typography
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Page Title
</h1>
```

---

## Accessibility

### WCAG 2.1 AA Compliance

#### Color & Contrast

- **Text contrast**: 4.5:1 minimum for normal text
- **Large text contrast**: 3:1 minimum for 18pt+ or 14pt+ bold
- **Non-text contrast**: 3:1 minimum for UI components
- **Color independence**: Don't rely solely on color for meaning

#### Keyboard Navigation

- **Focus indicators**: Visible focus states for all interactive elements
- **Tab order**: Logical tab sequence through content
- **Keyboard shortcuts**: Support standard keyboard interactions
- **Skip links**: Allow users to skip repetitive content

#### Screen Reader Support

- **Semantic HTML**: Use proper heading hierarchy and landmarks
- **ARIA labels**: Provide accessible names for complex components
- **Live regions**: Announce dynamic content changes
- **Alternative text**: Descriptive alt text for images

### Implementation Examples

#### Accessible Form

```tsx
<div>
  <Label htmlFor="email">
    Email Address
    <span className="text-destructive" aria-label="required">
      *
    </span>
  </Label>
  <Input
    id="email"
    type="email"
    required
    aria-describedby={error ? 'email-error' : undefined}
    aria-invalid={error ? 'true' : 'false'}
  />
  {error && (
    <p id="email-error" className="text-sm text-destructive" role="alert">
      {error}
    </p>
  )}
</div>
```

#### Accessible Button

```tsx
<Button onClick={handleSave} disabled={loading} aria-describedby="save-help">
  {loading ? (
    <>
      <Loader className="h-4 w-4 mr-2 animate-spin" />
      <span className="sr-only">Saving...</span>
      Saving
    </>
  ) : (
    'Save Changes'
  )}
</Button>
```

---

## Implementation Guidelines

### Getting Started

#### 1. Install Dependencies

```bash
npm install tailwindcss @tailwindcss/typography
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install lucide-react
npm install class-variance-authority clsx tailwind-merge
```

#### 2. Configure Tailwind

```js
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        // ... other colors from the system
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

#### 3. Set Up CSS Variables

```css
/* globals.css */
@layer base {
  :root {
    /* Light mode variables */
    --background: oklch(1 0 0);
    --foreground: oklch(0.129 0.042 264.695);
    --primary: oklch(0.208 0.042 265.755);
    /* ... other light mode variables */
  }

  .dark {
    /* Dark mode variables */
    --background: oklch(0.129 0.042 264.695);
    --foreground: oklch(0.984 0.003 247.858);
    /* ... other dark mode variables */
  }
}
```

### Component Development

#### 1. Use Composition

```tsx
// Good: Composable button
<Button variant="destructive" size="sm">
  <Trash className="h-4 w-4 mr-2" />
  Delete
</Button>

// Avoid: Monolithic component with many props
<Button
  type="destructive"
  size="small"
  icon="trash"
  iconPosition="left"
>
  Delete
</Button>
```

#### 2. Follow Naming Conventions

```tsx
// Component naming
export const FileManagerSidebar = () => { ... }

// Props interface naming
export interface FileManagerSidebarProps {
  className?: string;
  onFileSelect?: (file: File) => void;
}

// Variant naming using class-variance-authority
const buttonVariants = cva("base-styles", {
  variants: {
    variant: {
      default: "default-styles",
      destructive: "destructive-styles",
    },
    size: {
      default: "default-size",
      sm: "small-size",
    },
  },
});
```

#### 3. Maintain Consistency

- Use consistent spacing tokens (`space-4`, `gap-2`)
- Apply standard color classes (`text-foreground`, `bg-primary`)
- Follow established animation patterns
- Maintain accessible markup structure

### Performance Optimization

#### 1. Bundle Size

- Use tree-shaking to eliminate unused components
- Implement code splitting for large component libraries
- Optimize icon imports: `import { Save } from 'lucide-react'`

#### 2. Runtime Performance

- Use CSS for animations when possible
- Implement virtualization for large lists
- Memoize expensive calculations with `useMemo`

#### 3. Loading Performance

- Lazy load non-critical components
- Preload critical CSS
- Use appropriate image formats and sizes

---

## Resources & Tools

### Design Tools

- **Figma**: UI design and prototyping
- **Figma Tokens**: Design token management
- **Stark**: Accessibility checking in Figma

### Development Tools

- **Storybook**: Component development and documentation
- **Chromatic**: Visual testing and review
- **Jest**: Unit and integration testing
- **Testing Library**: Accessibility-focused testing

### Accessibility Tools

- **axe DevTools**: Automated accessibility testing
- **WAVE**: Web accessibility evaluation
- **Lighthouse**: Performance and accessibility auditing
- **Screen Readers**: NVDA, JAWS, VoiceOver testing

---

## Contributing

### Adding New Components

1. **Design Review**: Ensure design follows system principles
2. **API Design**: Create TypeScript interfaces for props
3. **Implementation**: Build with accessibility in mind
4. **Testing**: Add unit tests and accessibility tests
5. **Documentation**: Update design system docs
6. **Review**: Get design and code review approval

### Updating Existing Components

1. **Impact Assessment**: Evaluate breaking changes
2. **Migration Guide**: Provide upgrade instructions
3. **Backward Compatibility**: Maintain when possible
4. **Testing**: Ensure existing usage still works
5. **Communication**: Announce changes to team

---

## Changelog

### Version 1.0.0 (Current)

- Unified design system documentation combining design rules and comprehensive guidelines
- Complete component library with shadcn/ui and Slate theme
- Dark-first approach with accessible color system
- Comprehensive accessibility guidelines and implementation examples
- Responsive design patterns optimized for markdown editing
- Animation and interaction standards
- Implementation guidelines with practical examples

### Future Roadmap

- Advanced data visualization components
- Enhanced animation library
- Mobile-specific component variants
- Additional accessibility features
- Performance optimization guidelines
- Internationalization support

---

**Last Updated**: January 2024  
**Maintained By**: GTD Space Development Team  
**License**: MIT

This unified design system provides comprehensive guidance for building GTD Space with consistent, accessible, and professional design patterns optimized for markdown editing and productivity workflows.
