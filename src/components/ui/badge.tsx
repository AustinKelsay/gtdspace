/**
 * @fileoverview Badge component for status indicators and labels
 *
 * Supports classic variants (default, secondary, destructive, outline)
 * and the new soft chips using `variant="soft"` with `intent` and `size`.
 */

import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { badgeVariants } from "@/lib/badge-variants";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, intent, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, intent, size }), className)} {...props} />
  );
}

export { Badge };