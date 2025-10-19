/**
 * @fileoverview Reusable question mark tooltip for inline help affordances.
 */

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface QuestionMarkTooltipProps {
  content: React.ReactNode;
  /**
   * Accessible label for the trigger button.
   */
  label?: string;
  /**
   * Optional className overrides for the trigger button.
   */
  className?: string;
  /**
   * Optional className overrides for the icon.
   */
  iconClassName?: string;
  /**
   * Optional className overrides for the TooltipContent.
   */
  contentClassName?: string;
  side?: React.ComponentProps<typeof TooltipContent>['side'];
  align?: React.ComponentProps<typeof TooltipContent>['align'];
  sideOffset?: number;
}

export const QuestionMarkTooltip: React.FC<QuestionMarkTooltipProps> = ({
  content,
  label = 'More information',
  className,
  iconClassName,
  contentClassName,
  side = 'top',
  align = 'center',
  sideOffset = 6
}) => {
  return (
    <TooltipProvider delayDuration={150} disableHoverableContent>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
              className
            )}
            aria-label={label}
          >
            <HelpCircle className={cn('h-3.5 w-3.5', iconClassName)} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={cn('max-w-xs text-sm leading-relaxed', contentClassName)}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
