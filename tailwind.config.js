/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
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
      }
    },
  },
  plugins: [],
}