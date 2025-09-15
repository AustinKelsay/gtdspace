# Markdown Processing

GTD Space handles markdown through BlockNote's WYSIWYG editor, which provides real-time editing and automatic conversion between markdown and rich text blocks.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Markdown      │────▶│   BlockNote     │────▶│   Markdown      │
│   File (.md)    │     │   Blocks        │     │   Output        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                                                │
        │                                                │
        └────────────────────────────────────────────────┘
                         Save Cycle
```

## Markdown → BlockNote Conversion

When opening a markdown file, it's converted to BlockNote blocks:

```typescript
// In BlockNoteEditor.tsx
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
```

### Supported Markdown Elements

BlockNote handles standard markdown syntax:

| Markdown | BlockNote Block | Example |
|----------|----------------|---------|
| `# Heading` | Heading 1 | `# Title` |
| `## Heading` | Heading 2 | `## Section` |
| `### Heading` | Heading 3 | `### Subsection` |
| `**bold**` | Bold text | `**important**` |
| `*italic*` | Italic text | `*emphasis*` |
| `` `code` `` | Inline code | `` `variable` `` |
| ` ```lang ` | Code block | ` ```js\ncode\n``` ` |
| `- item` | Bullet list | `- First item` |
| `1. item` | Numbered list | `1. First step` |
| `> quote` | Blockquote | `> Citation` |
| `[text](url)` | Link | `[GitHub](https://github.com)` |
| `![alt](url)` | Image | `![Logo](./logo.png)` |

## BlockNote → Markdown Conversion

When saving, BlockNote blocks are converted back to markdown:

```typescript
// In BlockNoteEditor.tsx
const handleUpdate = async () => {
  try {
    const markdown = await editor.blocksToMarkdownLossy(editor.document);
    onChange(markdown);
  } catch (error) {
    console.error('Error converting to markdown:', error);
  }
};
```

### Lossy Conversion

The `blocksToMarkdownLossy` method means some BlockNote features may not have exact markdown equivalents:

- Complex formatting combinations
- Custom block types
- Nested structures beyond standard markdown

## Preview Mode (Not Currently Implemented)

**Note:** GTD Space currently uses BlockNote's WYSIWYG editor exclusively. There is no separate preview mode. The editor settings show options for `source`, `preview`, and `split` modes, but these are not functional in the current implementation.

### Current Reality
- All editing is done in WYSIWYG mode using BlockNote
- The `marked` library is not installed or used
- The `editor_mode` setting in preferences has no effect
- BlockNote provides real-time visual editing, eliminating the need for a separate preview

## File Storage Format

### Standard Markdown

Files are saved as standard markdown text files:

```markdown
# Document Title

This is a paragraph with **bold** and *italic* text.

## Section

- Bullet point 1
- Bullet point 2

```javascript
// Code block with syntax highlighting
const example = "Hello, World!";
```

### File Metadata

Metadata is stored in the file system, not in the markdown:

```typescript
interface MarkdownFile {
  id: string;              // Hash of file path
  name: string;            // filename.md
  path: string;            // /full/path/to/file.md
  size: number;            // Bytes
  last_modified: number;   // Unix timestamp (seconds)
  extension: string;       // "md" or "markdown"
}
```

## Syntax Highlighting

### In Editor (BlockNote)

BlockNote uses Shiki for syntax highlighting:

```typescript
import { codeBlock } from "@blocknote/code-block";

const editor = useCreateBlockNote({
  codeBlock, // Enables syntax highlighting
});
```

Supported languages include:
- JavaScript/TypeScript
- Python
- Rust
- Go
- Java
- C/C++
- HTML/CSS
- JSON
- YAML
- And 100+ more

### Syntax Highlighting in BlockNote

All syntax highlighting is handled by BlockNote's code block extension using Shiki. The `highlight.js` package is installed but not used in the current implementation.

## Markdown Extensions

### GitHub Flavored Markdown (GFM)

GTD Space supports GFM extensions:

```markdown
~~Strikethrough~~

| Table | Header |
|-------|--------|
| Cell  | Cell   |

- [x] Checked task
- [ ] Unchecked task

```

### Future Extensions

Potential markdown extensions to add:

1. **Math Support**
   ```markdown
   $$ E = mc^2 $$
   ```

2. **Mermaid Diagrams**
   ```markdown
   ```mermaid
   graph TD
     A --> B
   ```

3. **Footnotes**
   ```markdown
   Text with footnote[^1]
   [^1]: Footnote content
   ```

## Import/Export

### Import Formats

Currently supports:
- `.md` files
- `.markdown` files

Future considerations:
- `.txt` with markdown content
- `.docx` conversion
- HTML import

### Export Formats

Currently markdown-only. Future options:
- PDF export
- HTML export
- DOCX export

## Performance Optimization

### Large File Handling

For files approaching the 10MB limit:

```typescript
// Check file size before reading
if (file.size > MAX_FILE_SIZE) {
  throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
}
```

### Parsing Performance

- BlockNote parsing is async to avoid blocking
- Debounced conversion on typing (2s delay)
- Virtual scrolling for long documents

### Memory Management

```typescript
// Clear editor content when tab closes
const cleanup = () => {
  if (editor) {
    editor.replaceBlocks(editor.document, []);
  }
};
```

## Markdown Processing Pipeline

### 1. File Read
```typescript
const content = await invoke<string>('read_file', { 
  path: file.path 
});
```

### 2. Parse to Blocks
```typescript
const blocks = await editor.tryParseMarkdownToBlocks(content);
```

### 3. Edit in BlockNote
User edits with WYSIWYG interface

### 4. Convert to Markdown
```typescript
const markdown = await editor.blocksToMarkdownLossy(editor.document);
```

### 5. Auto-save
```typescript
await invoke('save_file', { 
  path: file.path, 
  content: markdown 
});
```

## Error Handling

### Parse Errors

Handle invalid markdown gracefully:

```typescript
try {
  const blocks = await editor.tryParseMarkdownToBlocks(content);
  editor.replaceBlocks(editor.document, blocks);
} catch (error) {
  console.error('Parse error:', error);
  // Show error to user
  showError('Failed to parse markdown file');
  // Fallback: show raw content
}
```

### Conversion Errors

```typescript
try {
  const markdown = await editor.blocksToMarkdownLossy(editor.document);
  onChange(markdown);
} catch (error) {
  console.error('Conversion error:', error);
  showError('Failed to convert to markdown');
}
```

## Best Practices

### 1. Preserve Formatting

Maintain original formatting where possible:
- Indentation
- Line breaks
- List markers
- Code fence style

### 2. Handle Edge Cases

```typescript
// Empty content
if (!content || content.trim() === '') {
  return;
}

// Very large content
if (content.length > MAX_CONTENT_LENGTH) {
  showWarning('File content truncated');
}
```

### 3. Validate Output

Ensure valid markdown output:
```typescript
// Basic validation
const isValidMarkdown = (content: string) => {
  // Check for common issues
  return !content.includes('\0') && // No null bytes
         content.length > 0 &&
         content.length < MAX_FILE_SIZE;
};
```

### 4. User Feedback

Provide clear feedback during processing:
```typescript
// Show loading state
setLoading(true);

// Process markdown
await processMarkdown();

// Clear loading state
setLoading(false);
```

## Testing Markdown Processing

### Test Cases

1. **Basic Elements**
   - Headers (all levels)
   - Lists (ordered/unordered)
   - Emphasis (bold/italic)
   - Links and images

2. **Complex Content**
   - Nested lists
   - Code blocks with languages
   - Tables
   - Mixed content

3. **Edge Cases**
   - Empty files
   - Large files (near 10MB)
   - Invalid markdown
   - Special characters

### Example Test

```typescript
test('converts markdown to blocks and back', async () => {
  const markdown = `# Test
  
- Item 1
- Item 2

\`\`\`js
console.log('test');
\`\`\``;

  const blocks = await editor.tryParseMarkdownToBlocks(markdown);
  const result = await editor.blocksToMarkdownLossy(blocks);
  
  expect(result).toContain('# Test');
  expect(result).toContain('- Item 1');
  expect(result).toContain('console.log');
});
```
