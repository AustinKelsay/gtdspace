/**
 * @fileoverview Design system component showcase and documentation
 * @author Development Team
 * @created 2024-01-XX
 * @phase 4 - Comprehensive design system documentation
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Palette, 
  Type, 
  Layout, 
  Layers3, 
  Sparkles,
  Save,
  Download,
  Star,
  Heart,
  AlertCircle,
  CheckCircle,
  Copy,
  Check,
  Moon,
  Sun
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// === TYPES ===

interface ColorSwatch {
  name: string;
  value: string;
  description: string;
  usage: string[];
}

interface TypographyExample {
  class: string;
  size: string;
  weight: string;
  lineHeight: string;
  usage: string;
}

interface ComponentExample {
  name: string;
  description: string;
  component: React.ReactNode;
  code: string;
}

// === DATA ===

const COLOR_SWATCHES: ColorSwatch[] = [
  {
    name: 'Primary',
    value: 'hsl(221.2 83.2% 53.3%)',
    description: 'Main brand color for primary actions',
    usage: ['Buttons', 'Links', 'Active states', 'Brand elements']
  },
  {
    name: 'Secondary',
    value: 'hsl(210 40% 96%)',
    description: 'Supporting color for secondary actions',
    usage: ['Secondary buttons', 'Backgrounds', 'Cards']
  },
  {
    name: 'Destructive',
    value: 'hsl(0 84.2% 60.2%)',
    description: 'Color for destructive actions and errors',
    usage: ['Delete buttons', 'Error messages', 'Warnings']
  },
  {
    name: 'Success',
    value: 'hsl(142.1 76.2% 36.3%)',
    description: 'Color for success states and confirmations',
    usage: ['Success messages', 'Completed states', 'Positive feedback']
  },
  {
    name: 'Warning',
    value: 'hsl(32.7 94.6% 54.3%)',
    description: 'Color for warnings and caution states',
    usage: ['Warning messages', 'Caution states', 'Pending actions']
  }
];

const TYPOGRAPHY_EXAMPLES: TypographyExample[] = [
  { class: 'text-4xl', size: '36px', weight: '700', lineHeight: '40px', usage: 'Display headings' },
  { class: 'text-3xl', size: '30px', weight: '700', lineHeight: '36px', usage: 'Page titles' },
  { class: 'text-2xl', size: '24px', weight: '600', lineHeight: '32px', usage: 'Section headings' },
  { class: 'text-xl', size: '20px', weight: '600', lineHeight: '28px', usage: 'Card titles' },
  { class: 'text-lg', size: '18px', weight: '500', lineHeight: '28px', usage: 'Subheadings' },
  { class: 'text-base', size: '16px', weight: '400', lineHeight: '24px', usage: 'Body text (default)' },
  { class: 'text-sm', size: '14px', weight: '400', lineHeight: '20px', usage: 'Body text (small)' },
  { class: 'text-xs', size: '12px', weight: '400', lineHeight: '16px', usage: 'Captions, metadata' }
];

const COMPONENT_EXAMPLES: ComponentExample[] = [
  {
    name: 'Buttons',
    description: 'Various button styles and states',
    component: (
      <div className="flex flex-wrap gap-2">
        <Button>Default</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button disabled>Disabled</Button>
      </div>
    ),
    code: `<Button>Default</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>`
  },
  {
    name: 'Form Controls',
    description: 'Input fields and form elements',
    component: (
      <div className="space-y-4 max-w-sm">
        <div>
          <Label htmlFor="example-input">Email</Label>
          <Input id="example-input" type="email" placeholder="Enter your email" />
        </div>
        <div>
          <Label htmlFor="example-textarea">Message</Label>
          <Textarea id="example-textarea" placeholder="Type your message here" />
        </div>
      </div>
    ),
    code: `<Label htmlFor="email">Email</Label>
<Input id="email" type="email" placeholder="Enter your email" />

<Label htmlFor="message">Message</Label>
<Textarea id="message" placeholder="Type your message here" />`
  },
  {
    name: 'Cards',
    description: 'Content containers with various layouts',
    component: (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Simple Card</CardTitle>
            <CardDescription>
              A basic card with header and content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>This is the main content area of the card.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Featured Card
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>This card includes an icon in the title.</p>
            <div className="mt-4">
              <Button size="sm">Learn More</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    ),
    code: `<Card>
  <CardHeader>
    <CardTitle>Simple Card</CardTitle>
    <CardDescription>A basic card with header and content</CardDescription>
  </CardHeader>
  <CardContent>
    <p>This is the main content area of the card.</p>
  </CardContent>
</Card>`
  },
  {
    name: 'Badges',
    description: 'Status indicators and labels',
    component: (
      <div className="flex flex-wrap gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Success</Badge>
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Warning</Badge>
      </div>
    ),
    code: `<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>`
  }
];

const SPACING_EXAMPLES = [
  { token: '0', value: '0px', usage: 'No spacing' },
  { token: '1', value: '4px', usage: 'Tight spacing' },
  { token: '2', value: '8px', usage: 'Small spacing' },
  { token: '3', value: '12px', usage: 'Medium spacing' },
  { token: '4', value: '16px', usage: 'Default spacing' },
  { token: '6', value: '24px', usage: 'Section spacing' },
  { token: '8', value: '32px', usage: 'Component spacing' },
  { token: '12', value: '48px', usage: 'Page sections' }
];

// === DESIGN SYSTEM SHOWCASE ===

export function DesignSystemShowcase() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { toast } = useToast();

  /**
   * Copy code to clipboard
   */
  const copyCode = async (code: string, name: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(name);
      toast({
        title: "Code Copied",
        description: `${name} code copied to clipboard`,
      });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy code to clipboard",
        variant: "destructive"
      });
    }
  };

  /**
   * Toggle dark mode for demonstration
   */
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={`min-h-screen bg-background text-foreground ${isDarkMode ? 'dark' : ''}`}>
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Palette className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">GTD Space Design System</h1>
                <p className="text-muted-foreground">
                  Comprehensive design standards and components
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleDarkMode}
              className="flex items-center gap-2"
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDarkMode ? 'Light' : 'Dark'} Mode
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Type className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-semibold">Typography</p>
                    <p className="text-sm text-muted-foreground">8 text scales</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-semibold">Colors</p>
                    <p className="text-sm text-muted-foreground">Semantic palette</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Layout className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-semibold">Spacing</p>
                    <p className="text-sm text-muted-foreground">4px grid system</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-semibold">Components</p>
                    <p className="text-sm text-muted-foreground">50+ components</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="colors" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="typography">Typography</TabsTrigger>
            <TabsTrigger value="spacing">Spacing</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
          </TabsList>

          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Color System</CardTitle>
                <CardDescription>
                  Semantic color palette designed for accessibility and consistency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6">
                  {COLOR_SWATCHES.map((swatch) => (
                    <div key={swatch.name} className="flex items-start gap-4">
                      <div
                        className="w-16 h-16 rounded-lg border shadow-sm"
                        style={{ backgroundColor: swatch.value }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{swatch.name}</h3>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {swatch.value}
                          </code>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {swatch.description}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {swatch.usage.map((usage) => (
                            <Badge key={usage} variant="outline" className="text-xs">
                              {usage}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Color Accessibility */}
            <Card>
              <CardHeader>
                <CardTitle>Accessibility Guidelines</CardTitle>
                <CardDescription>
                  All colors meet WCAG 2.1 AA contrast requirements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-medium">Contrast Ratios</h4>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Normal text: 4.5:1 minimum
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Large text: 3:1 minimum
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        UI components: 3:1 minimum
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Color Usage</h4>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        Never rely solely on color for meaning
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        Provide additional context with icons or text
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        Test with color blindness simulators
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Typography Tab */}
          <TabsContent value="typography" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Typography Scale</CardTitle>
                <CardDescription>
                  Consistent text sizing based on a modular scale
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {TYPOGRAPHY_EXAMPLES.map((example) => (
                    <div key={example.class} className="flex items-start gap-6">
                      <div className="w-32 text-sm text-muted-foreground space-y-1">
                        <div><code>{example.class}</code></div>
                        <div>{example.size}</div>
                        <div>Weight: {example.weight}</div>
                        <div>LH: {example.lineHeight}</div>
                      </div>
                      <div className="flex-1">
                        <div className={`${example.class} font-[${example.weight}] mb-2`}>
                          The quick brown fox jumps over the lazy dog
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {example.usage}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Font Guidelines */}
            <Card>
              <CardHeader>
                <CardTitle>Typography Guidelines</CardTitle>
                <CardDescription>
                  Best practices for readable and accessible text
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-3">Font Weights</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-normal w-20">Regular</span>
                        <span className="text-sm text-muted-foreground">Body text, descriptions</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium w-20">Medium</span>
                        <span className="text-sm text-muted-foreground">Emphasis, labels</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold w-20">Semibold</span>
                        <span className="text-sm text-muted-foreground">Subheadings, buttons</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold w-20">Bold</span>
                        <span className="text-sm text-muted-foreground">Headings, important text</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Line Length</h4>
                    <div className="space-y-2 text-sm">
                      <p className="max-w-prose">
                        <strong>Optimal:</strong> 45-75 characters per line for best readability. 
                        This paragraph demonstrates the optimal line length for comfortable reading.
                      </p>
                      <p className="text-muted-foreground">
                        Use <code>max-w-prose</code> class to maintain readable line lengths.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Spacing Tab */}
          <TabsContent value="spacing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Spacing System</CardTitle>
                <CardDescription>
                  4px grid-based spacing for consistent layouts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {SPACING_EXAMPLES.map((spacing) => (
                    <div key={spacing.token} className="flex items-center gap-4">
                      <div className="w-16 text-sm">
                        <code>space-{spacing.token}</code>
                      </div>
                      <div className="w-16 text-sm text-muted-foreground">
                        {spacing.value}
                      </div>
                      <div 
                        className="bg-primary/20 border-l-2 border-primary"
                        style={{ height: '20px', width: spacing.value }}
                      />
                      <div className="text-sm text-muted-foreground">
                        {spacing.usage}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Layout Examples */}
            <Card>
              <CardHeader>
                <CardTitle>Layout Patterns</CardTitle>
                <CardDescription>
                  Common spacing patterns for different layouts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Stack Layout</h4>
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                      <div className="h-8 bg-primary/20 rounded"></div>
                      <div className="h-8 bg-primary/20 rounded"></div>
                      <div className="h-8 bg-primary/20 rounded"></div>
                    </div>
                    <code className="text-xs text-muted-foreground">space-y-4</code>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Grid Layout</h4>
                    <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
                      <div className="h-16 bg-primary/20 rounded"></div>
                      <div className="h-16 bg-primary/20 rounded"></div>
                      <div className="h-16 bg-primary/20 rounded"></div>
                    </div>
                    <code className="text-xs text-muted-foreground">gap-4</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Components Tab */}
          <TabsContent value="components" className="space-y-6">
            {COMPONENT_EXAMPLES.map((example) => (
              <Card key={example.name}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{example.name}</CardTitle>
                      <CardDescription>{example.description}</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyCode(example.code, example.name)}
                      className="flex items-center gap-2"
                    >
                      {copiedCode === example.name ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-6 border rounded-lg bg-background">
                      {example.component}
                    </div>
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                        View Code
                      </summary>
                      <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-x-auto">
                        <code>{example.code}</code>
                      </pre>
                    </details>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Common Patterns</CardTitle>
                <CardDescription>
                  Reusable interface patterns and layouts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Form Pattern */}
                  <div>
                    <h4 className="font-medium mb-4">Form Layout</h4>
                    <div className="max-w-md space-y-4 p-4 border rounded-lg">
                      <div>
                        <Label htmlFor="form-name">Full Name</Label>
                        <Input id="form-name" placeholder="Enter your full name" />
                      </div>
                      <div>
                        <Label htmlFor="form-email">Email Address</Label>
                        <Input id="form-email" type="email" placeholder="Enter your email" />
                      </div>
                      <div>
                        <Label htmlFor="form-message">Message</Label>
                        <Textarea id="form-message" placeholder="Type your message here" />
                      </div>
                      <div className="flex gap-2">
                        <Button>Submit</Button>
                        <Button variant="outline">Cancel</Button>
                      </div>
                    </div>
                  </div>

                  {/* Status Pattern */}
                  <div>
                    <h4 className="font-medium mb-4">Status Indicators</h4>
                    <div className="space-y-3 p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Operation completed successfully</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Information message</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm">Warning message</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm">Error message</span>
                      </div>
                    </div>
                  </div>

                  {/* Loading Pattern */}
                  <div>
                    <h4 className="font-medium mb-4">Loading States</h4>
                    <div className="space-y-4 p-4 border rounded-lg">
                      <div>
                        <p className="text-sm mb-2">Progress Bar</p>
                        <Progress value={65} className="h-2" />
                      </div>
                      <div>
                        <p className="text-sm mb-2">Skeleton Loading</p>
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded animate-pulse"></div>
                          <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
                          <div className="h-4 bg-muted rounded animate-pulse w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Accessibility Patterns */}
            <Card>
              <CardHeader>
                <CardTitle>Accessibility Patterns</CardTitle>
                <CardDescription>
                  Examples of accessible component implementation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Focus Management</h4>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button>Open Dialog</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Accessible Dialog</DialogTitle>
                            <DialogDescription>
                              Focus is automatically managed and trapped within this dialog.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Input placeholder="Focus starts here" />
                            <Button>Action Button</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Keyboard Navigation</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      All interactive elements support keyboard navigation:
                    </p>
                    <ul className="text-sm space-y-1">
                      <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Tab</kbd> - Navigate forward</li>
                      <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Shift + Tab</kbd> - Navigate backward</li>
                      <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd> - Activate buttons and links</li>
                      <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Space</kbd> - Activate buttons and checkboxes</li>
                      <li><kbd className="px-2 py-1 bg-muted rounded text-xs">Esc</kbd> - Close dialogs and dropdowns</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default DesignSystemShowcase;