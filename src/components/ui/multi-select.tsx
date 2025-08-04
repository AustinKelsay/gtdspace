"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export interface Option {
  value: string
  label: string
  disabled?: boolean
  group?: string
}

export interface MultiSelectProps {
  options: Option[]
  value?: string[]
  onValueChange?: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  maxCount?: number
  disabled?: boolean
  className?: string
  asChild?: boolean
  children?: React.ReactNode
}

/**
 * Renders a single option item with consistent styling and behavior
 */
interface OptionItemProps {
  option: Option
  isSelected: boolean
  isActive: boolean
  isDisabled: boolean
  onSelect: (value: string) => void
  onMouseEnter: () => void
}

function OptionItem({ option, isSelected, isActive, isDisabled, onSelect, onMouseEnter }: OptionItemProps) {
  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
        isDisabled && "pointer-events-none opacity-50",
        isActive && "bg-accent text-accent-foreground"
      )}
      onClick={() => !isDisabled && onSelect(option.value)}
      onMouseEnter={() => !isDisabled && onMouseEnter()}
    >
      <Check
        className={cn(
          "mr-2 h-4 w-4",
          isSelected ? "opacity-100" : "opacity-0"
        )}
      />
      {option.label}
    </div>
  )
}

const MultiSelect = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  MultiSelectProps
>(
  (
    {
      options,
      value = [],
      onValueChange,
      placeholder = "Select items...",
      searchPlaceholder = "Search...",
      maxCount,
      disabled = false,
      className,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const [activeIndex, setActiveIndex] = React.useState(-1)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const selected = React.useMemo(
      () => options.filter((option) => value.includes(option.value)),
      [options, value]
    )

    const filteredOptions = React.useMemo(() => {
      if (!search) return options

      const searchLower = search.toLowerCase()
      return options.filter((option) =>
        option.label.toLowerCase().includes(searchLower)
      )
    }, [options, search])

    const groupedOptions = React.useMemo(() => {
      const groups: Record<string, Option[]> = {}
      const ungrouped: Option[] = []

      filteredOptions.forEach((option) => {
        if (option.group) {
          if (!groups[option.group]) {
            groups[option.group] = []
          }
          groups[option.group].push(option)
        } else {
          ungrouped.push(option)
        }
      })

      return { groups, ungrouped }
    }, [filteredOptions])

    const handleSelect = (optionValue: string) => {
      if (!onValueChange) return

      const newValue = value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : maxCount && value.length >= maxCount
          ? value
          : [...value, optionValue]

      onValueChange(newValue)
    }

    const handleRemove = (optionValue: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!onValueChange) return
      onValueChange(value.filter((v) => v !== optionValue))
    }

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!onValueChange) return
      onValueChange([])
    }

    const handleSelectAll = () => {
      if (!onValueChange) return

      const allValues = filteredOptions
        .filter((option) => !option.disabled)
        .map((option) => option.value)

      if (maxCount) {
        onValueChange(allValues.slice(0, maxCount))
      } else {
        onValueChange(allValues)
      }
    }

    // Get all selectable options in order
    const selectableOptions = React.useMemo(() => {
      const opts: Option[] = []
      opts.push(...groupedOptions.ungrouped.filter(o => !o.disabled))
      Object.values(groupedOptions.groups).forEach(group => {
        opts.push(...group.filter(o => !o.disabled))
      })
      return opts
    }, [groupedOptions])

    // Keyboard navigation
    React.useEffect(() => {
      if (!open) {
        setActiveIndex(-1)
        setSearch("")
      } else {
        inputRef.current?.focus()
      }
    }, [open])

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!open) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setActiveIndex(prev =>
            prev < selectableOptions.length - 1 ? prev + 1 : prev
          )
          break
        case "ArrowUp":
          e.preventDefault()
          setActiveIndex(prev => prev > 0 ? prev - 1 : prev)
          break
        case "Enter":
          e.preventDefault()
          if (activeIndex >= 0 && activeIndex < selectableOptions.length) {
            handleSelect(selectableOptions[activeIndex].value)
          }
          break
        case "Escape":
          e.preventDefault()
          setOpen(false)
          break
        case "Tab":
          // Allow normal tabbing when focus is in the search input
          // Only prevent default when navigating through options
          if (activeIndex >= 0) {
            e.preventDefault()
            // Navigate to next/previous option or close dropdown
            if (e.shiftKey) {
              // Shift+Tab: move to previous option or close
              if (activeIndex > 0) {
                setActiveIndex(activeIndex - 1)
              } else {
                setOpen(false)
              }
            } else {
              // Tab: move to next option or close
              if (activeIndex < selectableOptions.length - 1) {
                setActiveIndex(activeIndex + 1)
              } else {
                setOpen(false)
              }
            }
          }
          // If no option is active, allow normal tabbing
          break
      }
    }

    const triggerContent = asChild ? (
      props.children
    ) : (
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn("w-full justify-between", className)}
        disabled={disabled}
      >
        <div className="flex flex-1 flex-wrap gap-1">
          {selected.length > 0 ? (
            selected.map((option) => (
              <Badge
                key={option.value}
                variant="secondary"
                className="mr-1"
                onClick={(e) => handleRemove(option.value, e)}
              >
                {option.label}
                <X className="ml-1 h-3 w-3 cursor-pointer" />
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <X
              className="h-4 w-4 cursor-pointer opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </Button>
    )

    return (
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger ref={ref} asChild disabled={disabled} {...props}>
          {triggerContent}
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            className="w-full p-0 z-50"
            align="start"
            sideOffset={4}
            style={{
              minWidth: "var(--radix-popover-trigger-width)",
              maxWidth: "var(--radix-popover-trigger-width)",
            }}
          >
            <div className="rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95">
              <div className="flex items-center border-b px-3">
                <input
                  ref={inputRef}
                  className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <ScrollArea className="max-h-60">
                <div className="p-1">
                  {filteredOptions.length > 0 && (
                    <>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-sm"
                        onClick={handleSelectAll}
                      >
                        Select All
                      </Button>
                      <Separator className="my-1" />
                    </>
                  )}

                  {groupedOptions.ungrouped.length > 0 && (
                    <div className="py-1">
                      {groupedOptions.ungrouped.map((option, index) => {
                        const optionIndex = selectableOptions.findIndex(
                          o => o.value === option.value
                        )
                        const isActive = optionIndex === activeIndex

                        return (
                          <OptionItem
                            key={option.value}
                            option={option}
                            isSelected={value.includes(option.value)}
                            isActive={isActive}
                            isDisabled={option.disabled}
                            onSelect={handleSelect}
                            onMouseEnter={() => setActiveIndex(optionIndex)}
                          />
                        )
                      })}
                    </div>
                  )}

                  {Object.entries(groupedOptions.groups).map(([group, groupOptions]) => (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        {group}
                      </div>
                      <div className="py-1">
                        {groupOptions.map((option) => {
                          const optionIndex = selectableOptions.findIndex(
                            o => o.value === option.value
                          )
                          const isActive = optionIndex === activeIndex

                          return (
                            <OptionItem
                              key={option.value}
                              option={option}
                              isSelected={value.includes(option.value)}
                              isActive={isActive}
                              isDisabled={option.disabled}
                              onSelect={handleSelect}
                              onMouseEnter={() => setActiveIndex(optionIndex)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  {filteredOptions.length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No results found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    )
  }
)

MultiSelect.displayName = "MultiSelect"

export { MultiSelect }