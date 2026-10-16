import type * as React from "react"

import { Logo } from "@/components/logo"

/** Full-page centered column for public and pre-organization screens (sign in, onboarding, invitations). */
export function CenteredLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4 sm:p-8">
      <Logo className="text-lg" />
      <main className="w-full max-w-sm">{children}</main>
    </div>
  )
}
