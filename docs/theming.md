# Theming & Styles

GTD Space uses a sophisticated theming system built on CSS variables, Tailwind CSS, and shadcn/ui components.

## Theme Architecture

### CSS Variables System

The theme system is based on CSS custom properties defined in `src/styles/globals.css`:

```css
:root {
  /* Light theme colors */
  --background: 255 255 255;
  --foreground: 23 23 23;
  --card: 255 255 255;
  --card-foreground: 23 23 23;
  --primary: 24 24 27;
  --primary-foreground: 250 250 250;
  --secondary: 244 244 245;
  --secondary-foreground: 39 39 42;
  --muted: 244 244 245;
  --muted-foreground: 113 113 122;
  --accent: 244 244 245;
  --accent-foreground: 39 39 42;
  --border: 228 228 231;
  --input: 228 228 231;
  --ring: 24 24 27;
}
```

### Theme Colors Explained

| Variable | Purpose | Light | Dark |
|----------|---------|-------|------|
| `--background` | Main app background | White | Near black (#090909) |
| `--foreground` | Primary text color | Dark gray | White |
| `--card` | Card/panel backgrounds | White | Near black |
| `--primary` | Primary actions, buttons | Dark gray | White |
| `--secondary` | Secondary UI elements | Light gray | Dark gray |
| `--muted` | Subtle backgrounds | Light gray | Dark gray |
| `--accent` | Hover states, highlights | Light gray | Dark gray |
| `--border` | All borders | Light gray | Dark gray |

### Color Format

Colors use RGB space-separated format for Tailwind opacity modifiers:

```css
/* Format: R G B (0-255) */
--background: 255 255 255;

/* Usage in Tailwind */
.element {
  background-color: rgb(var(--background));
  /* With opacity */
  background-color: rgb(var(--background) / 0.5);
}
```

## Theme Implementation

### 1. Theme Toggle Logic

```typescript
// App.tsx
const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // Auto theme - detect system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
};
```

### 2. Dark Mode Class

Dark mode is controlled by the `.dark` class on the root element:

```css
.dark {
  --background: 9 9 11;
  --foreground: 250 250 250;
  /* ... other dark values */
}
```

### 3. Tailwind Integration

Custom Tailwind utilities using theme variables:

```css
/* Backgrounds */
.bg-background { background-color: rgb(var(--background)); }
.bg-card { background-color: rgb(var(--card)); }

/* Text */
.text-foreground { color: rgb(var(--foreground)); }
.text-muted-foreground { color: rgb(var(--muted-foreground)); }

/* Borders */
.border-border { border-color: rgb(var(--border)); }
```

## BlockNote Theme Integration

BlockNote editor theming is handled in `src/components/editor/blocknote-theme.css`:

### CSS Variable Mapping

```css
.bn-container {
  /* Map BlockNote variables to our theme */
  --bn-colors-editor-background: rgb(var(--background));
  --bn-colors-editor-text: rgb(var(--foreground));
  --bn-colors-menu-background: rgb(var(--card));
  --bn-colors-menu-text: rgb(var(--card-foreground));
  --bn-colors-tooltip-background: rgb(var(--card));
  --bn-colors-hovered-background: rgb(var(--accent));
  --bn-colors-selected-background: rgb(var(--secondary));
  --bn-colors-border: rgb(var(--border));
}
```

### Syntax Highlighting

Code blocks use different colors for light and dark themes:

```css
/* Light mode syntax */
:not(.dark) .bn-code-block .hljs-keyword {
  color: #d73a49; /* Red */
}

/* Dark mode syntax */
.dark .bn-code-block .hljs-keyword {
  color: #ff7b72; /* Brighter red */
}
```

## Component Styling

### shadcn/ui Components

All UI components follow the theme system:

```typescript
// Button variant example
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      }
    }
  }
);
```

### Custom Component Patterns

```css
/* Follow theme patterns */
.custom-component {
  background-color: rgb(var(--card));
  color: rgb(var(--card-foreground));
  border: 1px solid rgb(var(--border));
}

/* Hover states */
.custom-component:hover {
  background-color: rgb(var(--accent));
  color: rgb(var(--accent-foreground));
}
```

## Scrollbar Styling

Custom scrollbar that matches the theme:

```css
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgb(var(--background));
}

::-webkit-scrollbar-thumb {
  background: rgb(var(--border));
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgb(var(--muted-foreground));
}
```

## Animation Classes

Consistent animations across the app:

```css
/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}

## Layout Notes

### Kanban Columns (Projects Dashboard)

The Projects Kanban view uses independent scrolling columns with a sticky header to improve readability and prevent content from being clipped:

- Container: `grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[60vh]`.
- Column: `flex flex-col rounded-lg border bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/60`.
- Header: `sticky top-0 z-10 px-3 py-2 border-b bg-background/80`.
- Body: `ScrollArea` with `max-h-[65vh] lg:max-h-[70vh] xl:max-h-[75vh] p-3 overscroll-contain`.

Use `max-h-*` instead of fixed `h-*` values to let the page scroll when needed. Keep icons at `h-4 w-4` and counts at `text-xs` to reduce visual noise in dark and light themes.

/* Transitions */
.transition-colors {
  transition-property: color, background-color, border-color;
  transition-duration: 200ms;
}
```

### Sidebar Completed Groups

Keep the sidebar focused by tucking finished work into nested collapsibles. First partition the datasets inside `src/components/gtd/GTDWorkspaceSidebar.tsx` so that completed projects and actions are easy to render separately:

```typescript
const [activeProjects, completedProjects] = React.useMemo(() => {
  const buckets = { active: [] as GTDProject[], completed: [] as GTDProject[] };
  filteredProjects.forEach(project => {
    const status = normalizeStatus(projectMetadata[project.path]?.status || project.status || 'in-progress');
    (status === 'completed' ? buckets.completed : buckets.active).push(project);
  });
  return [buckets.active, buckets.completed];
}, [filteredProjects, projectMetadata]);
```

Render the active list as usual, then mount a secondary `Collapsible` that defaults to `open={false}` so completed projects stay hidden until requested. Reuse the same project row renderer to keep styling consistent:

```tsx
{completedProjects.length > 0 && (
  <Collapsible open={false} className="mt-1" data-sidebar-group="completed-projects">
    <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
      <ChevronRight className="h-3 w-3 transition-transform data-[state=open]:rotate-90" />
      <span>Completed Projects ({completedProjects.length})</span>
    </CollapsibleTrigger>
    <CollapsibleContent className="pl-5 space-y-1">
      {completedProjects.map(renderProjectRow)}
    </CollapsibleContent>
  </Collapsible>
)}
```

Inside each expanded project, apply the same pattern to the actions array so finished tasks are tucked under a labelled sub-dropdown:

```tsx
const partitionActions = React.useCallback(
  (
    items: MarkdownFile[],
    metadata: Record<string, { status?: string; currentPath?: string }>,
    statuses: Record<string, string>
  ) =>
    items.reduce(
      (acc, item) => {
        const status = normalizeStatus(metadata[item.path]?.status || statuses[item.path] || 'in-progress');
        (status === 'completed' ? acc.completed : acc.active).push(item);
        return acc;
      },
      { active: [] as MarkdownFile[], completed: [] as MarkdownFile[] }
    ),
  [metadata, statuses]
);

const { active, completed } = partitionActions(actions, actionMetadata, actionStatuses);

{active.map(renderActionRow)}
{completed.length > 0 && (
  <Collapsible open={false} className="mt-0.5" data-sidebar-group="completed-actions">
    <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
      <ChevronRight className="h-2.5 w-2.5 transition-transform data-[state=open]:rotate-90" />
      <span>Completed Actions ({completed.length})</span>
    </CollapsibleTrigger>
    <CollapsibleContent className="pl-4 space-y-0.5">
      {completed.map(renderActionRow)}
    </CollapsibleContent>
  </Collapsible>
)}
```

Style these buckets through the `data-sidebar-group` selector so collapsed rows blend with the rest of the theme:

```css
[data-sidebar-group="completed-projects"],
[data-sidebar-group="completed-actions"] {
  @apply rounded-md bg-muted/30 dark:bg-muted/10 text-muted-foreground;
}

[data-sidebar-group] [data-state="open"] {
  @apply text-foreground;
}
```

This approach keeps the default view uncluttered while allowing contributors to drill into archived work with a single click.

## Theme Best Practices

### 1. Always Use Theme Variables

```css
/* ✅ Good */
.element {
  background-color: rgb(var(--background));
  color: rgb(var(--foreground));
}

/* ❌ Bad */
.element {
  background-color: #ffffff;
  color: #000000;
}
```

### 2. Support Dark Mode

```css
/* Base styles (light mode) */
.component {
  background: rgb(var(--card));
}

/* Dark mode overrides when needed */
.dark .component {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
}
```

### 3. Use Semantic Colors

```css
/* Use semantic variables */
.error { color: rgb(239 68 68); }
.success { color: rgb(34 197 94); }
.warning { color: rgb(245 158 11); }
```

### 4. Maintain Contrast

Ensure sufficient contrast ratios:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- Interactive elements: Clear hover states

## Adding New Theme Variables

1. Add to `:root` in `globals.css`:
```css
:root {
  --custom-color: 100 200 255;
}
```

2. Add dark mode value:
```css
.dark {
  --custom-color: 50 100 200;
}
```

3. Create Tailwind utility (optional):
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'custom': 'rgb(var(--custom-color) / <alpha-value>)'
      }
    }
  }
}
```

## Performance Tips

1. **Use CSS Variables**: Instant theme switching without re-rendering
2. **Avoid Inline Styles**: Use utility classes for better performance
3. **Minimize Specificity**: Use single class selectors when possible
4. **Leverage Tailwind**: JIT compilation only includes used styles
