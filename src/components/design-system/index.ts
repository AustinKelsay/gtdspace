/**
 * @fileoverview Design system component exports
 * @author Development Team  
 * @created 2024-01-XX
 * @phase 4 - Design system documentation
 */

export { DesignSystemShowcase } from './DesignSystemShowcase';

// Re-export core UI components for easy access
export { Button } from '@/components/ui/button';
export { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
export { Badge } from '@/components/ui/badge';
export { Input } from '@/components/ui/input';
export { Label } from '@/components/ui/label';
export { Textarea } from '@/components/ui/textarea';
export { Separator } from '@/components/ui/separator';
export { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
export { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
export { Progress } from '@/components/ui/progress';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
export { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Re-export design system utilities
export type { 
  // Add design system types here as they're created
} from './types';