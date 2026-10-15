import { ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { useLocation, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMe } from "@/features/auth/api"
import { useCurrentOrganization } from "@/features/organizations/use-current-organization"

export function OrganizationSwitcher() {
  const me = useMe()
  const current = useCurrentOrganization()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Stay on the same page (projects, members…) in the other organization.
  const switchTo = (orgId: string) => {
    const section = pathname.split("/")[3] ?? "projects"
    navigate(`/orgs/${orgId}/${section}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="max-w-56 justify-between gap-2 px-2" aria-label="Switch organization" />}
      >
        <span className="truncate">{current.name}</span>
        <ChevronsUpDownIcon className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuRadioGroup value={current.id} onValueChange={(value: string) => switchTo(value)}>
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          {me.organizations.map((organization) => (
            <DropdownMenuRadioItem key={organization.id} value={organization.id}>
              <span className="truncate">{organization.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{organization.role}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {me.tenancyMode === "Multi" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate("/onboarding")}>
                <PlusIcon />
                New organization
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
