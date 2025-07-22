/**
 * @fileoverview Block renderer component for different content block types
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Check, Square, ChevronDown } from 'lucide-react';
import { createLowlight, common } from 'lowlight';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';

// Additional language imports for lowlight
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import c from 'highlight.js/lib/languages/c';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import html from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import toml from 'highlight.js/lib/languages/ini';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import powershell from 'highlight.js/lib/languages/powershell';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

// Internal imports
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ContentBlock } from '@/types/blocks';

// === TYPES ===
/**
 * Props for the BlockRenderer component
 */
interface BlockRendererProps {
  /** Content block to render */
  block: ContentBlock;
  /** Whether this block is currently selected */
  isSelected: boolean;
  /** Whether the editor is read-only */
  readOnly: boolean;
  /** Callback when block content changes */
  onChange: (content: any) => void;
}

/**
 * Props for individual block type renderers
 */
interface BlockTypeRendererProps {
  /** Block content */
  content: any;
  /** Block attributes */
  attributes: Record<string, any>;
  /** Whether this block is selected */
  isSelected: boolean;
  /** Whether the editor is read-only */
  readOnly: boolean;
  /** Callback when content changes */
  onChange: (content: any) => void;
}

// === CONSTANTS ===

/**
 * Initialize lowlight with common languages plus additional popular ones
 */
const lowlight = createLowlight(common);

// Register additional languages
lowlight.register('javascript', javascript);
lowlight.register('js', javascript);
lowlight.register('typescript', typescript);
lowlight.register('ts', typescript);
lowlight.register('python', python);
lowlight.register('py', python);
lowlight.register('java', java);
lowlight.register('cpp', cpp);
lowlight.register('c++', cpp);
lowlight.register('c', c);
lowlight.register('csharp', csharp);
lowlight.register('cs', csharp);
lowlight.register('go', go);
lowlight.register('golang', go);
lowlight.register('rust', rust);
lowlight.register('rs', rust);
lowlight.register('php', php);
lowlight.register('ruby', ruby);
lowlight.register('rb', ruby);
lowlight.register('html', html);
lowlight.register('css', css);
lowlight.register('scss', scss);
lowlight.register('json', json);
lowlight.register('yaml', yaml);
lowlight.register('yml', yaml);
lowlight.register('toml', toml);
lowlight.register('xml', xml);
lowlight.register('bash', bash);
lowlight.register('sh', bash);
lowlight.register('shell', bash);
lowlight.register('powershell', powershell);
lowlight.register('ps1', powershell);
lowlight.register('sql', sql);
lowlight.register('markdown', markdown);
lowlight.register('md', markdown);
lowlight.register('dockerfile', dockerfile);

/**
 * Supported programming languages for syntax highlighting
 */
const SUPPORTED_LANGUAGES = [
  // Popular Programming Languages
  { id: 'javascript', name: 'JavaScript', aliases: ['js'] },
  { id: 'typescript', name: 'TypeScript', aliases: ['ts'] },
  { id: 'python', name: 'Python', aliases: ['py'] },
  { id: 'java', name: 'Java', aliases: [] },
  { id: 'cpp', name: 'C++', aliases: ['c++', 'cxx'] },
  { id: 'c', name: 'C', aliases: [] },
  { id: 'csharp', name: 'C#', aliases: ['cs'] },
  { id: 'go', name: 'Go', aliases: ['golang'] },
  { id: 'rust', name: 'Rust', aliases: ['rs'] },
  { id: 'php', name: 'PHP', aliases: [] },
  { id: 'ruby', name: 'Ruby', aliases: ['rb'] },

  // Web Technologies
  { id: 'html', name: 'HTML', aliases: [] },
  { id: 'css', name: 'CSS', aliases: [] },
  { id: 'scss', name: 'SCSS', aliases: [] },
  { id: 'less', name: 'LESS', aliases: [] },

  // Configuration Languages
  { id: 'json', name: 'JSON', aliases: [] },
  { id: 'yaml', name: 'YAML', aliases: ['yml'] },
  { id: 'toml', name: 'TOML', aliases: [] },
  { id: 'xml', name: 'XML', aliases: [] },
  { id: 'ini', name: 'INI', aliases: [] },

  // Shell & Scripts
  { id: 'bash', name: 'Bash', aliases: ['sh', 'shell'] },
  { id: 'powershell', name: 'PowerShell', aliases: ['ps1'] },
  { id: 'batch', name: 'Batch', aliases: ['bat', 'cmd'] },

  // Database
  { id: 'sql', name: 'SQL', aliases: [] },
  { id: 'postgresql', name: 'PostgreSQL', aliases: ['postgres'] },
  { id: 'mysql', name: 'MySQL', aliases: [] },

  // Markup & Documentation
  { id: 'markdown', name: 'Markdown', aliases: ['md'] },
  { id: 'latex', name: 'LaTeX', aliases: ['tex'] },

  // Other
  { id: 'dockerfile', name: 'Dockerfile', aliases: [] },
  { id: 'nginx', name: 'NGINX', aliases: [] },
  { id: 'apache', name: 'Apache', aliases: [] },
  { id: 'plaintext', name: 'Plain Text', aliases: ['text', 'txt'] },
];

/**
 * Get language info by ID or alias
 */
function getLanguageInfo(input: string) {
  const normalizedInput = input.toLowerCase().trim();

  return SUPPORTED_LANGUAGES.find(lang =>
    lang.id === normalizedInput ||
    lang.aliases.includes(normalizedInput)
  ) || SUPPORTED_LANGUAGES.find(lang => lang.id === 'plaintext');
}

/**
 * Renders syntax-highlighted code using lowlight
 */
function renderHighlightedCode(code: string, language: string): React.ReactNode {
  try {
    // Check if the language is registered with lowlight
    const registeredLanguages = lowlight.listLanguages();
    const langInfo = getLanguageInfo(language);
    const langId = langInfo?.id || 'plaintext';

    if (!registeredLanguages.includes(langId) && langId !== 'plaintext') {
      // Fallback to plaintext if language is not supported
      return (
        <pre className="font-mono text-sm leading-relaxed">
          <code>{code}</code>
        </pre>
      );
    }

    // Highlight the code
    const tree = lowlight.highlight(langId === 'plaintext' ? 'text' : langId, code);

    // Convert to React JSX
    const highlighted = toJsxRuntime(tree, {
      jsx,
      jsxs,
      Fragment,
      components: {
        // Custom styling for syntax highlighting
        pre: ({ children, ...props }) => (
          <pre className="font-mono text-sm leading-relaxed" {...props}>
            {children}
          </pre>
        ),
        code: ({ children, ...props }) => (
          <code {...props}>
            {children}
          </code>
        ),
      },
    });

    return highlighted;
  } catch (error) {
    // Fallback to plain text on error
    return (
      <pre className="font-mono text-sm leading-relaxed">
        <code>{code}</code>
      </pre>
    );
  }
}

// === BLOCK TYPE RENDERERS ===

/**
 * Paragraph block renderer
 */
const ParagraphBlock: React.FC<BlockTypeRendererProps> = ({
  content,
  isSelected: _isSelected,
  readOnly,
  onChange
}) => {
  const [localContent, setLocalContent] = useState(content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalContent(content || '');
  }, [content]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [localContent]);

  const handleChange = useCallback((value: string) => {
    setLocalContent(value);
    onChange(value);
  }, [onChange]);

  return (
    <textarea
      ref={textareaRef}
      value={localContent}
      onChange={(e) => handleChange(e.target.value)}
      readOnly={readOnly}
      placeholder="Type something..."
      className={cn(
        'w-full resize-none border-none outline-none bg-transparent',
        'text-base leading-relaxed',
        'placeholder:text-muted-foreground'
      )}
      style={{ minHeight: '1.5rem' }}
    />
  );
};

/**
 * Heading block renderer
 */
const HeadingBlock: React.FC<BlockTypeRendererProps & { level: 1 | 2 | 3 }> = ({
  content,
  level,
  isSelected: _isSelected,
  readOnly,
  onChange
}) => {
  const [localContent, setLocalContent] = useState(content || '');

  const headingClasses = {
    1: 'text-2xl font-bold',
    2: 'text-xl font-semibold',
    3: 'text-lg font-medium',
  };

  const handleChange = useCallback((value: string) => {
    setLocalContent(value);
    onChange(value);
  }, [onChange]);

  return (
    <input
      type="text"
      value={localContent}
      onChange={(e) => handleChange(e.target.value)}
      readOnly={readOnly}
      placeholder={`Heading ${level}`}
      className={cn(
        'w-full border-none outline-none bg-transparent',
        headingClasses[level],
        'placeholder:text-muted-foreground placeholder:font-normal'
      )}
    />
  );
};

/**
 * List block renderer
 */
const ListBlock: React.FC<BlockTypeRendererProps & { ordered: boolean }> = ({
  content,
  ordered,
  isSelected: _isSelected,
  readOnly,
  onChange
}) => {
  const [items, setItems] = useState<string[]>(Array.isArray(content) ? content : [content || '']);

  const handleItemChange = useCallback((index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    setItems(newItems);
    onChange(newItems);
  }, [items, onChange]);

  const addItem = useCallback(() => {
    const newItems = [...items, ''];
    setItems(newItems);
    onChange(newItems);
  }, [items, onChange]);

  const removeItem = useCallback((index: number) => {
    if (items.length <= 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    onChange(newItems);
  }, [items, onChange]);

  return (
    <div className="space-y-1">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="text-muted-foreground mt-1 text-sm font-mono">
            {ordered ? `${index + 1}.` : '•'}
          </span>
          <input
            type="text"
            value={item}
            onChange={(e) => handleItemChange(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !readOnly) {
                e.preventDefault();
                addItem();
              }
              if (e.key === 'Backspace' && !item && items.length > 1) {
                e.preventDefault();
                removeItem(index);
              }
            }}
            readOnly={readOnly}
            placeholder="List item"
            className="flex-1 border-none outline-none bg-transparent placeholder:text-muted-foreground"
          />
        </div>
      ))}
    </div>
  );
};

/**
 * Todo block renderer
 */
const TodoBlock: React.FC<BlockTypeRendererProps> = ({
  content,
  attributes: _attributes,
  isSelected: _isSelected,
  readOnly,
  onChange
}) => {
  const { text = '', completed = false } = content || {};

  const handleTextChange = useCallback((newText: string) => {
    onChange({ text: newText, completed });
  }, [completed, onChange]);

  const handleToggleCompleted = useCallback(() => {
    onChange({ text, completed: !completed });
  }, [text, completed, onChange]);

  return (
    <div className="flex items-start gap-3">
      <button
        onClick={handleToggleCompleted}
        disabled={readOnly}
        className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {completed ? (
          <Check className="w-4 h-4" />
        ) : (
          <Square className="w-4 h-4" />
        )}
      </button>
      <input
        type="text"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        readOnly={readOnly}
        placeholder="To-do item"
        className={cn(
          'flex-1 border-none outline-none bg-transparent',
          'placeholder:text-muted-foreground',
          completed && 'line-through text-muted-foreground'
        )}
      />
    </div>
  );
};

/**
 * Quote block renderer
 */
const QuoteBlock: React.FC<BlockTypeRendererProps> = ({
  content,
  isSelected: _isSelected,
  readOnly,
  onChange
}) => {
  const [localContent, setLocalContent] = useState(content || '');

  const handleChange = useCallback((value: string) => {
    setLocalContent(value);
    onChange(value);
  }, [onChange]);

  return (
    <div className="border-l-4 border-primary/20 pl-4">
      <textarea
        value={localContent}
        onChange={(e) => handleChange(e.target.value)}
        readOnly={readOnly}
        placeholder="Quote text..."
        className={cn(
          'w-full resize-none border-none outline-none bg-transparent',
          'text-base italic text-muted-foreground leading-relaxed',
          'placeholder:text-muted-foreground/60'
        )}
        style={{ minHeight: '1.5rem' }}
      />
    </div>
  );
};

/**
 * Code block renderer
 */
const CodeBlock: React.FC<BlockTypeRendererProps> = ({
  content,
  attributes: _attributes,
  isSelected: _isSelected,
  readOnly,
  onChange
}) => {
  const { code = '', language = 'plaintext' } = content || {};
  const [localCode, setLocalCode] = useState(code);
  const [localLanguage, setLocalLanguage] = useState(language);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalCode(code);
    setLocalLanguage(language);
  }, [code, language]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [localCode]);

  const handleCodeChange = useCallback((newCode: string) => {
    setLocalCode(newCode);
    onChange({ code: newCode, language: localLanguage });
  }, [localLanguage, onChange]);

  const handleLanguageChange = useCallback((newLanguage: string) => {
    setLocalLanguage(newLanguage);
    onChange({ code: localCode, language: newLanguage });
  }, [localCode, onChange]);

  const currentLanguageInfo = getLanguageInfo(localLanguage);

  return (
    <div className="bg-muted rounded-lg overflow-hidden">
      {/* Header with language selector */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-foreground"
              disabled={readOnly}
            >
              {currentLanguageInfo?.name || localLanguage || 'Plain Text'}
              <ChevronDown className="ml-1 w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 max-h-60 overflow-y-auto">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <DropdownMenuItem
                key={lang.id}
                onClick={() => handleLanguageChange(lang.id)}
                className={cn(
                  'text-xs',
                  lang.id === localLanguage && 'bg-accent'
                )}
              >
                <div>
                  <div className="font-medium">{lang.name}</div>
                  {lang.aliases.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {lang.aliases.join(', ')}
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(!isEditing)}
          className="h-6 text-xs text-muted-foreground hover:text-foreground"
          disabled={readOnly}
        >
          {isEditing ? 'Preview' : 'Edit'}
        </Button>
      </div>

      {/* Code content */}
      <div className="relative">
        {isEditing || !localCode ? (
          <textarea
            ref={textareaRef}
            value={localCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            readOnly={readOnly}
            placeholder="Enter code..."
            className={cn(
              'w-full resize-none border-none outline-none bg-transparent',
              'font-mono text-sm p-3',
              'placeholder:text-muted-foreground',
              'min-h-[3rem]'
            )}
            style={{ minHeight: '3rem' }}
          />
        ) : (
          <div
            className="p-3 min-h-[3rem] cursor-text"
            onClick={() => !readOnly && setIsEditing(true)}
          >
            {localCode ? (
              <div className="syntax-highlighted">
                {renderHighlightedCode(localCode, localLanguage)}
              </div>
            ) : (
              <div className="text-muted-foreground font-mono text-sm">
                Click to add code...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Divider block renderer
 */
const DividerBlock: React.FC<BlockTypeRendererProps> = () => {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="w-full h-px bg-border" />
    </div>
  );
};

// === MAIN COMPONENT ===

/**
 * Block renderer component that renders different block types
 * 
 * Acts as a factory component that delegates rendering to specific
 * block type renderers based on the block type.
 * 
 * @param props - Component props
 * @returns JSX element containing the rendered block
 * 
 * @example
 * ```tsx
 * <BlockRenderer
 *   block={contentBlock}
 *   isSelected={true}
 *   readOnly={false}
 *   onChange={handleContentChange}
 * />
 * ```
 */
export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  isSelected,
  readOnly,
  onChange,
}) => {
  const rendererProps = {
    content: block.content,
    attributes: block.attributes,
    isSelected,
    readOnly,
    onChange,
  };

  switch (block.type) {
    case 'paragraph':
      return <ParagraphBlock {...rendererProps} />;

    case 'heading1':
      return <HeadingBlock {...rendererProps} level={1} />;

    case 'heading2':
      return <HeadingBlock {...rendererProps} level={2} />;

    case 'heading3':
      return <HeadingBlock {...rendererProps} level={3} />;

    case 'bulleted-list':
      return <ListBlock {...rendererProps} ordered={false} />;

    case 'numbered-list':
      return <ListBlock {...rendererProps} ordered={true} />;

    case 'todo':
      return <TodoBlock {...rendererProps} />;

    case 'quote':
      return <QuoteBlock {...rendererProps} />;

    case 'code':
      return <CodeBlock {...rendererProps} />;

    case 'divider':
      return <DividerBlock {...rendererProps} />;

    default:
      // Fallback for unknown block types
      return (
        <div className="p-3 border border-dashed border-muted-foreground/30 rounded-lg text-center text-muted-foreground">
          <div className="text-sm">Unknown block type: {block.type}</div>
          <div className="text-xs mt-1">Content: {JSON.stringify(block.content)}</div>
        </div>
      );
  }
};

// === EXPORTS ===
export default BlockRenderer;