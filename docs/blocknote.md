# BlockNote Editor

GTD Space uses BlockNote as its WYSIWYG markdown editor, providing a Notion-like editing experience with rich formatting capabilities.

## Overview

BlockNote is a block-based editor that allows users to create rich documents with various content types while maintaining markdown compatibility.

## Installation & Setup

### Required Packages

```json
{
  "dependencies": {
    "@blocknote/core": "^0.35.0",
    "@blocknote/react": "^0.35.0",
    "@blocknote/mantine": "^0.35.0",
    "@blocknote/code-block": "^0.35.0"
  }
}
```

### Basic Configuration

```typescript
// BlockNoteEditor.tsx
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { codeBlock } from "@blocknote/code-block";
import "@blocknote/mantine/style.css";
import "./blocknote-theme.css";

const editor = useCreateBlockNote({
  codeBlock, // Enable syntax highlighting
});
```

## Component Implementation

### Editor Component

```typescript
export interface BlockNoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  darkMode?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export const BlockNoteEditor: React.FC<BlockNoteEditorProps> = ({
  content,
  onChange,
  darkMode = false,
  readOnly = false,
  className = '',
}) => {
  const editor = useCreateBlockNote({
    codeBlock,
  });

  // Handle initial content
  useEffect(() => {
    const loadContent = async () => {
      if (content && editor && content.trim() !== '') {
        try {
          const blocks = await editor.tryParseMarkdownToBlocks(content);
          editor.replaceBlocks(editor.document, blocks);
        } catch (error) {
          console.error('Error parsing initial content:', error);
        }
      }
    };
    loadContent();
  }, [content, editor]);

  // Handle content changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = async () => {
      try {
        const markdown = await editor.blocksToMarkdownLossy(editor.document);
        onChange(markdown);
      } catch (error) {
        console.error('Error converting to markdown:', error);
      }
    };

    editor.onChange(handleUpdate);
  }, [editor, onChange]);

  return (
    <div className={`w-full ${className} ${darkMode ? 'dark' : ''}`}>
      <BlockNoteView
        editor={editor}
        theme={darkMode ? "dark" : "light"}
        editable={!readOnly}
        data-theming-css-variables={false}
      />
    </div>
  );
};
```

## Block Types

BlockNote supports various block types out of the box:

### Text Blocks
- **Paragraph** - Regular text content
- **Heading** - H1, H2, H3 levels
- **Bullet List** - Unordered lists
- **Numbered List** - Ordered lists
- **Checkbox** - Task lists

### Media Blocks
- **Image** - Image uploads and embeds
- **Video** - Video embeds
- **File** - File attachments

### Code Blocks
With `@blocknote/code-block` extension:
- Syntax highlighting via Shiki
- Multiple language support
- Automatic language detection

## Markdown Conversion

### Blocks to Markdown

BlockNote provides built-in markdown conversion:

```typescript
// Convert blocks to markdown
const markdown = await editor.blocksToMarkdownLossy(editor.document);
```

### Markdown to Blocks

```typescript
// Parse markdown to blocks
const blocks = await editor.tryParseMarkdownToBlocks(markdownContent);
editor.replaceBlocks(editor.document, blocks);
```

### Conversion Limitations

- Some BlockNote features don't have markdown equivalents
- Complex formatting may be simplified
- Custom blocks need custom conversion logic

## Theme Integration

### CSS Variable Mapping

BlockNote theme variables are mapped to our app theme in `blocknote-theme.css`:

```css
.bn-container {
  /* Editor colors */
  --bn-colors-editor-background: rgb(var(--background));
  --bn-colors-editor-text: rgb(var(--foreground));
  
  /* Menu colors */
  --bn-colors-menu-background: rgb(var(--card));
  --bn-colors-menu-text: rgb(var(--card-foreground));
  
  /* Interactive states */
  --bn-colors-hovered-background: rgb(var(--accent));
  --bn-colors-selected-background: rgb(var(--secondary));
  
  /* Borders and shadows */
  --bn-colors-border: rgb(var(--border));
  --bn-colors-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

### Dark Mode Support

```css
.dark .bn-container {
  --bn-colors-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  /* Dark-specific overrides */
}
```

## Code Block Syntax Highlighting

### Enabling Code Blocks

```typescript
import { codeBlock } from "@blocknote/code-block";

const editor = useCreateBlockNote({
  codeBlock, // Pass the extension
});
```

### Supported Languages

The code block extension supports 100+ languages via Shiki:
- JavaScript/TypeScript
- Python
- Rust
- Go
- HTML/CSS
- Markdown
- JSON
- And many more...

### Theme Colors

Syntax highlighting colors are customized for light/dark themes:

```css
/* Light mode syntax colors */
:not(.dark) .bn-code-block .hljs-keyword {
  color: #d73a49;
}

/* Dark mode syntax colors */
.dark .bn-code-block .hljs-keyword {
  color: #ff7b72;
}
```

## Keyboard Shortcuts

BlockNote provides standard keyboard shortcuts:

| Action | Shortcut |
|--------|----------|
| Bold | `Ctrl/Cmd+B` |
| Italic | `Ctrl/Cmd+I` |
| Underline | `Ctrl/Cmd+U` |
| Code | `Ctrl/Cmd+E` |
| Link | `Ctrl/Cmd+K` |
| Heading 1 | `Ctrl/Cmd+Alt+1` |
| Heading 2 | `Ctrl/Cmd+Alt+2` |
| Heading 3 | `Ctrl/Cmd+Alt+3` |
| Bullet List | `Ctrl/Cmd+Shift+8` |
| Numbered List | `Ctrl/Cmd+Shift+7` |

### Slash Commands

Type `/` to access the block menu:
- `/h1` - Heading 1
- `/h2` - Heading 2
- `/h3` - Heading 3
- `/bullet` - Bullet list
- `/number` - Numbered list
- `/check` - Checkbox
- `/code` - Code block
- `/quote` - Blockquote

## Customization

### Custom Styles

Override BlockNote styles in `blocknote-theme.css`:

```css
/* Custom block spacing */
.bn-block-content {
  padding: 0.375rem 0;
  line-height: 1.75;
}

/* Custom heading styles */
.bn-block-content h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

/* Custom link styles */
.bn-inline-content a {
  color: rgb(59, 130, 246);
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

### Slash Menu Styling

```css
.bn-slash-menu {
  background: rgb(var(--card)) !important;
  border: 1px solid rgb(var(--border)) !important;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.bn-slash-menu-item:hover {
  background: rgb(var(--accent)) !important;
  color: rgb(var(--accent-foreground)) !important;
}
```

## Performance Considerations

### Debounced Updates

Content changes are debounced to prevent excessive updates:

```typescript
// In useTabManager
const debouncedSave = useMemo(
  () => debounce(async (tabId: string, content: string) => {
    await saveTabContent(tabId, content);
  }, 2000),
  []
);
```

### Large Documents

- BlockNote handles large documents efficiently
- Virtual scrolling for long documents
- Lazy loading of media content

### Memory Management

- Dispose editor instances when unmounting
- Clear undo/redo history for closed tabs
- Limit number of open editors (10 tab limit)

## Troubleshooting

### Common Issues

1. **Syntax highlighting not working**
   - Ensure `@blocknote/code-block` is installed
   - Pass `codeBlock` to `useCreateBlockNote`

2. **Theme not applying**
   - Check CSS import order
   - Verify theme variables are defined
   - Ensure `data-theming-css-variables={false}`

3. **Content not saving**
   - Check onChange handler
   - Verify markdown conversion
   - Look for console errors

4. **Performance issues**
   - Reduce number of open tabs
   - Check for memory leaks
   - Monitor editor disposal

### Debug Mode

Enable BlockNote debug logging:

```typescript
const editor = useCreateBlockNote({
  codeBlock,
  // Add debug options if needed
});

// Log editor state
console.log('Editor blocks:', editor.document);
console.log('Editor selection:', editor.selection);
```

## Future Enhancements

Potential improvements for BlockNote integration:

1. **Custom Blocks**
   - Math equations
   - Mermaid diagrams
   - Tables with advanced features

2. **Collaboration**
   - Real-time collaboration
   - Comments and annotations
   - Version history

3. **Export Options**
   - PDF export
   - HTML export
   - Docx export

4. **Advanced Features**
   - Find and replace in editor
   - Table of contents generation
   - Word count and reading time