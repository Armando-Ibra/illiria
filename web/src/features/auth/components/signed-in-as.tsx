import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { useLogout, useMe } from "@/features/auth/api"

/** "Signed in as … · Account · Sign out", for screens outside the app shell. */
export function SignedInAs() {
  const me = useMe()
  const logout = useLogout()
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-1 text-center text-sm text-muted-foreground">
      Signed in as <span className="font-medium text-foreground">{me.email}</span>
      <span aria-hidden>·</span>
      <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/account">
        Account
      </Link>
      <span aria-hidden>·</span>
      <Button variant="link" size="sm" className="h-auto px-0" onClick={() => logout.mutate(undefined)} disabled={logout.isPending}>
        Sign out
      </Button>
    </p>
  )
}
