import * as React from "react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/lib/button-variants"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-card text-card-foreground rounded-md", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium text-foreground",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-transparent p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "mx-auto",
        weekdays: "grid grid-cols-7",
        weekday: "text-muted-foreground font-normal text-[0.8rem] text-center w-9",
        weeks: "mt-2",
        week: "grid grid-cols-7 mt-2",
        head_row: "grid grid-cols-7",
        head_cell:
          "text-muted-foreground font-normal text-[0.8rem] text-center w-9",
        row: "grid grid-cols-7 mt-2",
        cell: cn(
          "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center",
          "[&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 flex items-center justify-center",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:ring-1 focus-visible:ring-ring"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "!bg-primary !text-primary-foreground hover:!bg-primary/90 hover:!text-primary-foreground focus:!bg-primary focus:!text-primary-foreground",
        day_today: "bg-muted text-foreground font-semibold ring-1 ring-border",
        day_outside:
          "text-muted-foreground/50 opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed hover:bg-transparent",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }