import { AlertCircleIcon, Loader2Icon, type LucideIcon } from "lucide-react"
import type * as React from "react"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Spinner({ className }: { className?: string }) {
  return <Loader2Icon aria-hidden className={cn("size-4 animate-spin", className)} />
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground", className)}>
      <Spinner />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 py-12 text-center", className)}>
      <AlertCircleIcon aria-hidden className="size-6 text-destructive" />
      <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
        <Icon aria-hidden className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
