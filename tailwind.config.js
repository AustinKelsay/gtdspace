/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
        xl: '2.5rem',
        '2xl': '3rem',
      },
      screens: {
        sm: '100%',
        md: '100%',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1400px',
      '3xl': '1600px',
      // Custom breakpoints for editor layout
      'editor-sm': '768px',
      'editor-md': '1024px',
      'editor-lg': '1280px',
      'editor-xl': '1440px',
    },
    extend: {
      colors: {
        // shadcn/ui color system
        background: "rgb(var(--background))",
        foreground: "rgb(var(--foreground))",
        card: "rgb(var(--card))",
        "card-foreground": "rgb(var(--card-foreground))",
        primary: "rgb(var(--primary))",
        "primary-foreground": "rgb(var(--primary-foreground))",
        secondary: "rgb(var(--secondary))",
        "secondary-foreground": "rgb(var(--secondary-foreground))",
        muted: "rgb(var(--muted))",
        "muted-foreground": "rgb(var(--muted-foreground))",
        accent: "rgb(var(--accent))",
        "accent-foreground": "rgb(var(--accent-foreground))",
        border: "rgb(var(--border))",
        input: "rgb(var(--input))",
        ring: "rgb(var(--ring))",
        popover: "rgb(var(--popover))",
        "popover-foreground": "rgb(var(--popover-foreground))",
        destructive: "rgb(var(--destructive))",
        "destructive-foreground": "rgb(var(--destructive-foreground))",
        // Custom color palette for markdown editor
        editor: {
          bg: '#1e1e1e',
          text: '#d4d4d4',
          accent: '#007acc'
        },
        sidebar: {
          bg: '#252526',
          hover: '#2a2d2e'
        }
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
        'sidebar': '280px',
        'sidebar-sm': '256px',
        'sidebar-lg': '320px',
      },
      maxWidth: {
        'prose': '65ch',
        'prose-sm': '55ch',
        'prose-lg': '75ch',
        'editor': '1200px',
        'content': '1400px',
      },
      minHeight: {
        'editor': '400px',
        'sidebar': '600px',
      },
      typography: {
        // Custom typography for markdown content
        markdown: {
          css: {
            maxWidth: 'none',
            color: 'var(--tw-prose-body)',
            h1: { fontSize: '2rem' },
            h2: { fontSize: '1.5rem' },
            code: {
              backgroundColor: 'var(--tw-prose-pre-bg)',
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem'
            }
          }
        }
      },
      animation: {
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
        '400': '400ms',
        '500': '500ms',
        '600': '600ms',
        '700': '700ms',
        '800': '800ms',
        '900': '900ms',
        '1000': '1000ms',
      }
    },
  },
  plugins: [],
}