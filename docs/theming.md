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

/* Transitions */
.transition-colors {
  transition-property: color, background-color, border-color;
  transition-duration: 200ms;
}
```

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