"use client"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { DEFAULT_TOAST_DURATION_MS, useToast } from "@/hooks/use-toast"
import { CheckCircle, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react"

function getToastIcon(title?: React.ReactNode, variant?: "default" | "destructive") {
  const titleStr = typeof title === 'string' ? title.toLowerCase() : '';

  if (variant === 'destructive' || titleStr === 'error') {
    return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
  }
  if (titleStr === 'success') {
    return <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />;
  }
  if (titleStr === 'warning') {
    return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
  }
  if (titleStr === 'loading') {
    return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin shrink-0" />;
  }
  // Default: info
  return <Info className="h-5 w-5 text-blue-500 shrink-0" />;
}

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, duration, onOpenChange, variant, ...props }) {
        const icon = getToastIcon(title, variant);

        return (
          <Toast
            key={id}
            variant={variant}
            duration={duration ?? DEFAULT_TOAST_DURATION_MS}
            onOpenChange={onOpenChange}
            {...props}
          >
            <div className="flex items-start gap-3">
              {icon}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose onClick={() => dismiss(id)} />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
