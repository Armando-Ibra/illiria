import { LogOutIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLogout, useMe } from "@/features/auth/api"

export function UserMenu() {
  const me = useMe()
  const logout = useLogout()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" />}>
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-medium uppercase"
        >
          {me.email.charAt(0)}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate text-sm font-normal text-foreground">{me.email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout.mutate(undefined)} disabled={logout.isPending}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
