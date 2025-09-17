/**
 * Badge variant definitions
 *
 * Adds a new "soft" variant with semantic intents (success, warning, danger, info, neutral, brand)
 * and size controls. This enables subtle, pill-like chips for dashboard UI while
 * remaining backwards-compatible with existing variants.
 */

import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80 px-2.5 py-0.5 text-xs",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 px-2.5 py-0.5 text-xs",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 px-2.5 py-0.5 text-xs",
        outline: "text-foreground px-2.5 py-0.5 text-xs",
        // New subtle chip look
        soft: "",
      },
      intent: {
        neutral: "",
        success: "",
        warning: "",
        danger: "",
        info: "",
        brand: "",
      },
      size: {
        xs: "text-[10px] px-2 py-0.5",
        sm: "text-xs px-2.5 py-0.5",
        md: "text-sm px-3 py-1",
      },
    },
    // Apply classes for the soft + intent combinations
    compoundVariants: [
      { variant: "soft", intent: "neutral", class: "bg-foreground/5 text-foreground/70 border-border" },
      { variant: "soft", intent: "success", class: "bg-green-500/10 text-green-600 border-green-500/20" },
      { variant: "soft", intent: "warning", class: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20" },
      { variant: "soft", intent: "danger", class: "bg-red-500/10 text-red-600 border-red-500/20" },
      { variant: "soft", intent: "info", class: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
      { variant: "soft", intent: "brand", class: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
    ],
    defaultVariants: {
      variant: "default",
      intent: "neutral",
      size: "sm",
    },
  }
);