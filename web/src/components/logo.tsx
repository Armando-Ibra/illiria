import { Link } from "react-router"

import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span
        aria-hidden
        className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
      >
        I
      </span>
      Illiria
    </Link>
  )
}
