/**
 * @fileoverview Comprehensive help documentation with search functionality
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Help system with searchable documentation
 */

import React, { useState, useMemo, useCallback } from 'react';
import { 
  Search, 
  Book, 
  Keyboard, 
  FileText, 
  Settings, 
  Zap, 
  HelpCircle, 
  ArrowRight,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// === TYPES ===

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  category: 'getting-started' | 'editing' | 'features' | 'shortcuts' | 'troubleshooting' | 'advanced';
  tags: string[];
  lastUpdated: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

interface HelpDocumentationProps {
  /** Whether the help panel is open */
  isOpen: boolean;
  /** Callback when help panel is closed */
  onClose: () => void;
  /** Initial search query */
  initialSearch?: string;
  /** Initial category to show */
  initialCategory?: string;
  /** Optional CSS class name */
  className?: string;
}

interface SearchResult {
  article: HelpArticle;
  relevanceScore: number;
  matchedContent: string;
}

// === CONSTANTS ===

const HELP_CATEGORIES: Record<string, HelpCategory> = {
  'getting-started': {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of GTD Space',
    icon: <Book className="h-5 w-5" />,
    color: 'bg-blue-500',
  },
  'editing': {
    id: 'editing',
    title: 'Editing',
    description: 'Master the editor features',
    icon: <FileText className="h-5 w-5" />,
    color: 'bg-green-500',
  },
  'features': {
    id: 'features',
    title: 'Features',
    description: 'Explore advanced capabilities',
    icon: <Zap className="h-5 w-5" />,
    color: 'bg-purple-500',
  },
  'shortcuts': {
    id: 'shortcuts',
    title: 'Shortcuts',
    description: 'Speed up your workflow',
    icon: <Keyboard className="h-5 w-5" />,
    color: 'bg-orange-500',
  },
  'troubleshooting': {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Solve common issues',
    icon: <HelpCircle className="h-5 w-5" />,
    color: 'bg-red-500',
  },
  'advanced': {
    id: 'advanced',
    title: 'Advanced',
    description: 'Power user features',
    icon: <Settings className="h-5 w-5" />,
    color: 'bg-gray-500',
  },
};

const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'getting-started-basics',
    title: 'Getting Started with GTD Space',
    description: 'Learn the basics of using GTD Space for markdown editing',
    content: `# Getting Started with GTD Space

GTD Space is a powerful markdown editor designed for local file management and editing. Here's how to get started:

## 1. Select Your Workspace

First, select a folder containing your markdown files:
- Click the "Select Folder" button in the sidebar
- Choose a folder with .md or .markdown files
- Your selected folder becomes your workspace

## 2. Browse Your Files

Once you've selected a folder:
- All markdown files appear in the sidebar
- Use the search box to filter files by name
- Click any file to open it in the editor

## 3. Start Editing

GTD Space offers multiple editing modes:
- **WYSIWYG Mode**: Visual editing with formatting toolbar
- **Source Mode**: Raw markdown with syntax highlighting
- **Preview Mode**: See how your markdown will look when rendered
- **Split Mode**: Edit and preview side-by-side

## 4. Save Your Work

Your changes are automatically saved every few seconds. You can also:
- Press Ctrl+S to save the current file
- Press Ctrl+Shift+S to save all open files
- Look for the orange dot on tabs to see unsaved changes

## Tips for Success

- Keep your markdown files organized in folders
- Use consistent naming conventions
- Take advantage of keyboard shortcuts for faster editing
- Explore different editor modes to find your preference`,
    category: 'getting-started',
    tags: ['basics', 'setup', 'workspace', 'files'],
    lastUpdated: '2024-01-15',
    difficulty: 'beginner',
  },
  {
    id: 'editor-modes-guide',
    title: 'Understanding Editor Modes',
    description: 'Learn about the different editing modes and when to use them',
    content: `# Understanding Editor Modes

GTD Space offers four different editor modes to suit different editing preferences and workflows.

## WYSIWYG Mode

**What it is**: WYSIWYG (What You See Is What You Get) mode provides visual editing similar to a word processor.

**Best for**:
- Users new to markdown
- Visual learners
- Creating formatted documents
- Editing tables and complex content

**Features**:
- Visual formatting toolbar
- Live text formatting
- Table creation and editing
- Image preview
- Math equation support

## Source Mode

**What it is**: Source mode shows raw markdown with syntax highlighting.

**Best for**:
- Experienced markdown users
- Code-heavy documents
- Precise control over markup
- Large documents

**Features**:
- Syntax highlighting
- Line numbers
- Code folding
- Fast editing
- Full markdown control

## Preview Mode

**What it is**: Preview mode shows how your markdown will look when rendered.

**Best for**:
- Reviewing documents
- Checking formatting
- Reading mode
- Presentations

**Features**:
- Clean, readable layout
- Proper typography
- Image display
- Link functionality
- Print-friendly

## Split Mode

**What it is**: Split mode shows source and preview side-by-side.

**Best for**:
- Learning markdown
- Complex documents
- Real-time feedback
- Collaborative editing

**Features**:
- Synchronized scrolling
- Live preview updates
- Best of both worlds
- Flexible layout

## Switching Between Modes

You can switch between modes using:
- The mode toggle buttons in the toolbar
- Keyboard shortcuts:
  - Ctrl+Shift+W: WYSIWYG mode
  - Ctrl+Shift+S: Source mode
  - Ctrl+Shift+P: Split mode
  - Ctrl+Shift+V: Preview mode`,
    category: 'editing',
    tags: ['modes', 'wysiwyg', 'source', 'preview', 'split'],
    lastUpdated: '2024-01-15',
    difficulty: 'beginner',
  },
  {
    id: 'keyboard-shortcuts-complete',
    title: 'Complete Keyboard Shortcuts Guide',
    description: 'Master all keyboard shortcuts for efficient editing',
    content: `# Complete Keyboard Shortcuts Guide

Master these keyboard shortcuts to work faster and more efficiently in GTD Space.

## File Operations

| Shortcut | Action |
|----------|---------|
| Ctrl+O | Open folder |
| Ctrl+N | Create new file |
| Ctrl+S | Save current file |
| Ctrl+Shift+S | Save all files |
| Ctrl+W | Close current tab |
| Ctrl+Shift+W | Close all tabs |

## Editor Navigation

| Shortcut | Action |
|----------|---------|
| Ctrl+Tab | Switch between tabs |
| Ctrl+1-9 | Switch to tab number |
| Ctrl+F | Find in current file |
| Ctrl+Shift+F | Find in all files |
| Ctrl+G | Go to line |
| Ctrl+P | Quick file switcher |

## Text Editing

| Shortcut | Action |
|----------|---------|
| Ctrl+B | Bold text |
| Ctrl+I | Italic text |
| Ctrl+U | Underline text |
| Ctrl+K | Insert link |
| Ctrl+Shift+K | Insert code block |
| Ctrl+/ | Toggle comment |

## Editor Modes

| Shortcut | Action |
|----------|---------|
| Ctrl+Shift+W | WYSIWYG mode |
| Ctrl+Shift+S | Source mode |
| Ctrl+Shift+P | Split mode |
| Ctrl+Shift+V | Preview mode |

## Application

| Shortcut | Action |
|----------|---------|
| Ctrl+, | Open settings |
| F11 | Toggle fullscreen |
| Ctrl+Shift+D | Open debug panel |
| Ctrl+? | Show help |

## Pro Tips

1. **Custom Shortcuts**: You can customize keyboard shortcuts in Settings
2. **Context Menus**: Right-click for context-specific actions
3. **Quick Actions**: Use Ctrl+Shift+P for command palette
4. **Muscle Memory**: Practice shortcuts regularly to build muscle memory`,
    category: 'shortcuts',
    tags: ['keyboard', 'shortcuts', 'efficiency', 'navigation'],
    lastUpdated: '2024-01-15',
    difficulty: 'intermediate',
  },
  {
    id: 'troubleshooting-common-issues',
    title: 'Troubleshooting Common Issues',
    description: 'Solutions to common problems and error messages',
    content: `# Troubleshooting Common Issues

This guide helps you solve common problems you might encounter while using GTD Space.

## File and Folder Issues

### Problem: "No markdown files found"
**Cause**: The selected folder doesn't contain any .md or .markdown files.
**Solutions**:
1. Select a different folder that contains markdown files
2. Create a new markdown file in the current folder
3. Check that your files have the correct extensions (.md, .markdown)

### Problem: "Permission denied" when accessing files
**Cause**: GTD Space doesn't have permission to access the selected folder.
**Solutions**:
1. Try selecting a folder in your user directory
2. Check folder permissions in your operating system
3. Run GTD Space with appropriate permissions

### Problem: Files not updating after external changes
**Cause**: File watcher may not be working properly.
**Solutions**:
1. Refresh the file list manually
2. Restart GTD Space
3. Check if the folder is on a network drive (may have limitations)

## Editor Issues

### Problem: WYSIWYG mode not showing formatting
**Cause**: Content may contain unsupported markdown syntax.
**Solutions**:
1. Switch to Source mode to check the raw markdown
2. Ensure you're using standard markdown syntax
3. Try switching modes to refresh the display

### Problem: Search not finding expected results
**Cause**: Search may be case-sensitive or limited to file names.
**Solutions**:
1. Try different search terms
2. Use the global search feature (Ctrl+Shift+F)
3. Check spelling and try partial matches

### Problem: Slow performance with large files
**Cause**: Very large markdown files can impact editor performance.
**Solutions**:
1. Break large files into smaller sections
2. Use Source mode for better performance
3. Close unused tabs to free up memory

## Auto-Save Issues

### Problem: Changes not being saved automatically
**Cause**: Auto-save may be disabled or failing.
**Solutions**:
1. Save manually with Ctrl+S
2. Check if the file is read-only
3. Ensure you have write permissions to the folder

### Problem: "Save failed" error message
**Cause**: File system or permission issues.
**Solutions**:
1. Check that the file isn't open in another application
2. Verify folder write permissions
3. Try saving to a different location

## Application Issues

### Problem: GTD Space won't start
**Cause**: Various system or installation issues.
**Solutions**:
1. Check if all dependencies are installed
2. Try running as administrator (Windows)
3. Check system logs for error messages

### Problem: Features not working as expected
**Cause**: Configuration or compatibility issues.
**Solutions**:
1. Reset settings to defaults
2. Clear application cache
3. Check for updates

## Getting More Help

If you're still experiencing issues:
1. Check the debug panel (Ctrl+Shift+D) for error messages
2. Try reproducing the issue with minimal content
3. Consider reporting the issue with specific steps to reproduce`,
    category: 'troubleshooting',
    tags: ['problems', 'errors', 'solutions', 'debugging'],
    lastUpdated: '2024-01-15',
    difficulty: 'beginner',
  },
  {
    id: 'advanced-features',
    title: 'Advanced Features and Power User Tips',
    description: 'Discover advanced features for power users',
    content: `# Advanced Features and Power User Tips

Unlock the full potential of GTD Space with these advanced features and techniques.

## Block-Based Editing

GTD Space supports Notion-style block editing for better content organization:

### Creating Blocks
- Type \`/\` to open the block menu
- Choose from various block types
- Drag blocks to reorder content

### Block Types Available
- Text blocks (paragraphs, headings)
- Code blocks with syntax highlighting
- Quote blocks
- List blocks (ordered/unordered)
- Table blocks
- Math equation blocks

## Advanced Search Features

### Global Search
- Use Ctrl+Shift+F to search across all files
- Supports regex patterns
- Find and replace across multiple files

### Search Operators
- Use quotes for exact phrases: "exact phrase"
- Use wildcards: file*.md
- Use regex for complex patterns

## File Organization

### Workspace Management
- Organize files in nested folders
- Use consistent naming conventions
- Create templates for common document types

### File Linking
- Link between files using \`[text](file.md)\`
- Use relative paths for portability
- Create index files for navigation

## Performance Optimization

### Memory Management
- Close unused tabs regularly
- Use virtual scrolling for large file lists
- Monitor memory usage in debug panel

### Efficient Editing
- Use Source mode for large files
- Disable unnecessary features for better performance
- Use keyboard shortcuts instead of mouse

## Customization Options

### Editor Themes
- Choose from multiple editor themes
- Customize syntax highlighting colors
- Adjust font sizes and families

### Keyboard Shortcuts
- Customize all keyboard shortcuts
- Create macros for repetitive tasks
- Set up vim-style key bindings

## Export and Integration

### Export Options
- Export to PDF with custom styling
- Generate HTML with embedded CSS
- Create standalone documents

### External Tools
- Integrate with git for version control
- Use external image editors
- Connect to cloud storage services

## Developer Features

### Debug Panel
- Monitor performance metrics
- View cache statistics
- Analyze memory usage
- Track user interactions

### Plugin System
- Extend functionality with custom plugins
- Create custom block types
- Add new export formats

## Workflow Optimization

### Daily Workflow Tips
1. Start with a workspace template
2. Use consistent file naming
3. Create daily/weekly note templates
4. Use tags for better organization
5. Automate repetitive tasks

### Team Collaboration
1. Use shared folders for team projects
2. Establish naming conventions
3. Create style guides for consistency
4. Use external tools for version control

## Automation

### Auto-Save Configuration
- Adjust auto-save intervals
- Set up backup locations
- Configure file watching sensitivity

### Template System
- Create reusable document templates
- Set up automatic file structure
- Use variables in templates

## Troubleshooting Advanced Issues

### Performance Problems
- Monitor resource usage
- Optimize large documents
- Clear caches regularly

### Sync Issues
- Check file permissions
- Verify network connectivity
- Monitor file watchers

This guide covers the most important advanced features. Experiment with these techniques to find what works best for your workflow.`,
    category: 'advanced',
    tags: ['power-user', 'optimization', 'workflow', 'customization'],
    lastUpdated: '2024-01-15',
    difficulty: 'advanced',
  },
];

// === HELP DOCUMENTATION COMPONENT ===

/**
 * Comprehensive help documentation component with search functionality
 * 
 * Provides searchable help documentation covering all aspects of the application.
 * Features categorized articles, full-text search, and progressive disclosure.
 */
export const HelpDocumentation: React.FC<HelpDocumentationProps> = ({
  isOpen,
  onClose,
  initialSearch = '',
  initialCategory = 'getting-started',
  className = '',
}) => {
  // === STATE ===
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCategory] = useState(initialCategory);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set([initialCategory])
  );

  // === SEARCH FUNCTIONALITY ===
  const searchResults = useMemo((): SearchResult[] => {
    if (!searchQuery.trim()) {
      return HELP_ARTICLES.map(article => ({ 
        article, 
        relevanceScore: 1, 
        matchedContent: article.description 
      }));
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    HELP_ARTICLES.forEach(article => {
      let relevanceScore = 0;
      let matchedContent = '';

      // Title match (highest weight)
      if (article.title.toLowerCase().includes(query)) {
        relevanceScore += 10;
        matchedContent = article.title;
      }

      // Description match
      if (article.description.toLowerCase().includes(query)) {
        relevanceScore += 5;
        if (!matchedContent) matchedContent = article.description;
      }

      // Content match
      if (article.content.toLowerCase().includes(query)) {
        relevanceScore += 3;
        if (!matchedContent) {
          // Extract surrounding context
          const contentLower = article.content.toLowerCase();
          const index = contentLower.indexOf(query);
          const start = Math.max(0, index - 50);
          const end = Math.min(article.content.length, index + query.length + 50);
          matchedContent = '...' + article.content.slice(start, end) + '...';
        }
      }

      // Tags match
      article.tags.forEach(tag => {
        if (tag.toLowerCase().includes(query)) {
          relevanceScore += 2;
          if (!matchedContent) matchedContent = `Tagged: ${tag}`;
        }
      });

      if (relevanceScore > 0) {
        results.push({ article, relevanceScore, matchedContent });
      }
    });

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }, [searchQuery]);

  const filteredArticles = useMemo(() => {
    if (searchQuery.trim()) {
      return searchResults.map(result => result.article);
    }
    return HELP_ARTICLES.filter(article => 
      selectedCategory ? article.category === selectedCategory : true
    );
  }, [searchQuery, searchResults, selectedCategory]);

  // === HANDLERS ===
  const handleCategoryToggle = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  const handleArticleSelect = useCallback((articleId: string) => {
    setSelectedArticle(articleId);
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    setSelectedArticle(null);
  }, []);

  // === RENDER HELPERS ===
  const renderCategoryList = () => {
    const categorizedArticles = Object.keys(HELP_CATEGORIES).map(categoryId => ({
      category: HELP_CATEGORIES[categoryId],
      articles: HELP_ARTICLES.filter(article => article.category === categoryId),
    }));

    return (
      <div className="space-y-2">
        {categorizedArticles.map(({ category, articles }) => (
          <Collapsible
            key={category.id}
            open={expandedCategories.has(category.id)}
            onOpenChange={() => handleCategoryToggle(category.id)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start p-2 h-auto"
              >
                {expandedCategories.has(category.id) ? (
                  <ChevronDown className="h-4 w-4 mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                <div className={`p-1 rounded mr-2 ${category.color} text-white`}>
                  {category.icon}
                </div>
                <div className="text-left flex-1">
                  <div className="font-medium text-sm">{category.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {articles.length} article{articles.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="ml-6 space-y-1">
              {articles.map(article => (
                <Button
                  key={article.id}
                  variant="ghost"
                  className="w-full justify-start p-2 h-auto text-left"
                  onClick={() => handleArticleSelect(article.id)}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{article.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {article.description}
                    </div>
                    <div className="flex items-center mt-1 space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {article.difficulty}
                      </Badge>
                      {article.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Button>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  const renderSearchResults = () => {
    if (searchResults.length === 0) {
      return (
        <div className="text-center py-8">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No results found</h3>
          <p className="text-muted-foreground mb-4">
            Try different search terms or browse categories
          </p>
          <Button onClick={handleSearchClear}>
            Clear Search
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {searchResults.map(({ article, relevanceScore, matchedContent }) => (
          <Card 
            key={article.id} 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleArticleSelect(article.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium">{article.title}</h3>
                <Badge variant="outline" className="text-xs">
                  {relevanceScore} pts
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {matchedContent}
              </p>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="text-xs">
                  {HELP_CATEGORIES[article.category].title}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {article.difficulty}
                </Badge>
                {article.tags.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderArticleContent = () => {
    const article = HELP_ARTICLES.find(a => a.id === selectedArticle);
    if (!article) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedArticle(null)}
            className="mb-4"
          >
            <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
            Back to {searchQuery ? 'search results' : 'categories'}
          </Button>
        </div>
        
        <div>
          <h1 className="text-2xl font-bold mb-2">{article.title}</h1>
          <div className="flex items-center space-x-2 mb-4">
            <Badge variant="secondary">
              {HELP_CATEGORIES[article.category].title}
            </Badge>
            <Badge variant="outline">
              {article.difficulty}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Updated {article.lastUpdated}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mb-6">
            {article.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="prose prose-sm max-w-none dark:prose-invert">
          <div dangerouslySetInnerHTML={{ 
            __html: article.content.replace(/\n/g, '<br />') 
          }} />
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 bg-black/80 ${className}`}>
      <div className="fixed inset-4 bg-background rounded-lg shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Book className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Help & Documentation</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                onClick={handleSearchClear}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {selectedArticle ? (
            <ScrollArea className="h-full p-4">
              {renderArticleContent()}
            </ScrollArea>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
              {/* Sidebar */}
              {!searchQuery && (
                <div className="border-r">
                  <ScrollArea className="h-full p-4">
                    <h3 className="font-medium mb-4">Categories</h3>
                    {renderCategoryList()}
                  </ScrollArea>
                </div>
              )}
              
              {/* Main Content */}
              <div className={searchQuery ? 'col-span-3' : 'col-span-2'}>
                <ScrollArea className="h-full p-4">
                  {searchQuery ? renderSearchResults() : (
                    <div className="space-y-3">
                      {filteredArticles.map(article => (
                        <Card 
                          key={article.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleArticleSelect(article.id)}
                        >
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">{article.title}</CardTitle>
                            <CardDescription>{article.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                {article.difficulty}
                              </Badge>
                              {article.tags.slice(0, 3).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// === EXPORTS ===
export default HelpDocumentation;
export { HELP_ARTICLES, HELP_CATEGORIES };
export type { HelpArticle, HelpCategory, HelpDocumentationProps };