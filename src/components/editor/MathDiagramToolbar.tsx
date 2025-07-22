/**
 * @fileoverview Toolbar component for inserting mathematical equations and diagrams
 * @author Development Team
 * @created 2024-01-XX
 * @phase 3 (Advanced Rich Editing Features)
 */

// === IMPORTS ===
// External library imports
import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Calculator, GitBranch, X, Check } from 'lucide-react';

// Internal imports
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// === TYPES ===
/**
 * Props for the MathDiagramToolbar component
 */
interface MathDiagramToolbarProps {
  /** Tiptap editor instance */
  editor: Editor | null;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show as compact buttons */
  compact?: boolean;
}

/**
 * Math equation examples for user guidance
 */
const MATH_EXAMPLES = [
  { name: 'Quadratic Formula', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { name: 'Pythagorean Theorem', latex: 'a^2 + b^2 = c^2' },
  { name: 'Euler\'s Identity', latex: 'e^{i\\pi} + 1 = 0' },
  { name: 'Integral', latex: '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}' },
  { name: 'Sum', latex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}' },
];

/**
 * Mermaid diagram examples for user guidance
 */
const MERMAID_EXAMPLES = [
  {
    name: 'Simple Flowchart',
    code: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[End]
    C --> D`
  },
  {
    name: 'Sequence Diagram',
    code: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B-->>A: Hello Alice!`
  },
  {
    name: 'Class Diagram',
    code: `classDiagram
    class Animal {
        +name: string
        +age: number
        +speak(): void
    }
    Animal <|-- Dog
    Animal <|-- Cat`
  },
];

// === MAIN COMPONENT ===
/**
 * Toolbar component for inserting mathematical equations and Mermaid diagrams
 * 
 * Provides quick access to insert inline/block math and various diagram types
 * with example templates and user-friendly interfaces.
 * 
 * @param props - Component props
 * @returns JSX element containing the math/diagram toolbar
 * 
 * @example
 * ```tsx
 * <MathDiagramToolbar 
 *   editor={editor}
 *   compact={true}
 *   className="border-t pt-2"
 * />
 * ```
 */
export const MathDiagramToolbar: React.FC<MathDiagramToolbarProps> = ({
  editor,
  className,
  compact = false,
}) => {
  // State for dialog management
  const [mathDialogOpen, setMathDialogOpen] = useState(false);
  const [diagramDialogOpen, setDiagramDialogOpen] = useState(false);
  const [mathInput, setMathInput] = useState('');
  const [diagramInput, setDiagramInput] = useState('');
  const [mathType, setMathType] = useState<'inline' | 'block'>('inline');

  /**
   * Inserts a math equation into the editor
   */
  const insertMath = (latex: string, isBlock: boolean = false) => {
    if (!editor || !latex.trim()) return;

    if (isBlock) {
      // editor.commands.insertBlockMath(latex); // Temporarily disabled
      console.log('Insert block math:', latex);
    } else {
      // editor.commands.insertInlineMath(latex); // Temporarily disabled  
      console.log('Insert inline math:', latex);
    }

    setMathInput('');
    setMathDialogOpen(false);
  };

  /**
   * Inserts a Mermaid diagram into the editor
   */
  const insertDiagram = (code: string) => {
    if (!editor || !code.trim()) return;

    // editor.commands.insertMermaidDiagram(code); // Temporarily disabled
    console.log('Insert mermaid diagram:', code);
    setDiagramInput('');
    setDiagramDialogOpen(false);
  };

  /**
   * Uses a math example template
   */
  const useMathExample = (latex: string) => {
    setMathInput(latex);
  };

  /**
   * Uses a diagram example template
   */
  const useDiagramExample = (code: string) => {
    setDiagramInput(code);
  };

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Math Equation Dialog */}
      <Dialog open={mathDialogOpen} onOpenChange={setMathDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            className="flex items-center gap-2"
            title="Insert Math Equation"
          >
            <Calculator className="w-4 h-4" />
            {!compact && "Math"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Insert Mathematical Equation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Math Type Selection */}
            <div className="flex gap-4">
              <Label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="inline"
                  checked={mathType === 'inline'}
                  onChange={(e) => setMathType(e.target.value as 'inline' | 'block')}
                />
                Inline Math
              </Label>
              <Label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="block"
                  checked={mathType === 'block'}
                  onChange={(e) => setMathType(e.target.value as 'inline' | 'block')}
                />
                Block Math
              </Label>
            </div>

            {/* LaTeX Input */}
            <div>
              <Label htmlFor="latex-input">LaTeX Expression:</Label>
              <Input
                id="latex-input"
                value={mathInput}
                onChange={(e) => setMathInput(e.target.value)}
                placeholder="Enter LaTeX expression..."
                className="font-mono"
              />
            </div>

            {/* Preview (simplified) */}
            {mathInput && (
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-sm text-muted-foreground">Preview:</Label>
                <div className="font-mono text-sm mt-1">
                  {mathType === 'block' ? `$$${mathInput}$$` : `$${mathInput}$`}
                </div>
              </div>
            )}

            {/* Examples */}
            <div>
              <Label className="text-sm font-medium">Examples:</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {MATH_EXAMPLES.map((example, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    className="justify-start p-2 h-auto font-mono text-xs"
                    onClick={() => useMathExample(example.latex)}
                  >
                    <div className="text-left">
                      <div className="font-semibold">{example.name}</div>
                      <div className="text-muted-foreground">{example.latex}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMathDialogOpen(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={() => insertMath(mathInput, mathType === 'block')}
                disabled={!mathInput.trim()}
              >
                <Check className="w-4 h-4 mr-2" />
                Insert
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mermaid Diagram Dialog */}
      <Dialog open={diagramDialogOpen} onOpenChange={setDiagramDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size={compact ? "sm" : "default"}
            className="flex items-center gap-2"
            title="Insert Mermaid Diagram"
          >
            <GitBranch className="w-4 h-4" />
            {!compact && "Diagram"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Insert Mermaid Diagram</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Diagram Code Input */}
            <div>
              <Label htmlFor="mermaid-input">Mermaid Code:</Label>
              <textarea
                id="mermaid-input"
                value={diagramInput}
                onChange={(e) => setDiagramInput(e.target.value)}
                placeholder="Enter Mermaid diagram code..."
                className="w-full h-40 p-3 font-mono text-sm border rounded-lg resize-y"
              />
            </div>

            {/* Examples */}
            <div>
              <Label className="text-sm font-medium">Examples:</Label>
              <div className="grid grid-cols-1 gap-3 mt-2 max-h-60 overflow-y-auto">
                {MERMAID_EXAMPLES.map((example, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="justify-start p-3 h-auto"
                    onClick={() => useDiagramExample(example.code)}
                  >
                    <div className="text-left w-full">
                      <div className="font-semibold mb-1">{example.name}</div>
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {example.code}
                      </pre>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDiagramDialogOpen(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={() => insertDiagram(diagramInput)}
                disabled={!diagramInput.trim()}
              >
                <Check className="w-4 h-4 mr-2" />
                Insert
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// === EXPORTS ===
export default MathDiagramToolbar;