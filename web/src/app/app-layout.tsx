import { FolderKanbanIcon, UsersIcon, type LucideIcon } from "lucide-react"
import { NavLink, Outlet } from "react-router"

import { Logo } from "@/components/logo"
import { UserMenu } from "@/features/auth/components/user-menu"
import { OrganizationSwitcher } from "@/features/organizations/components/organization-switcher"
import { useCurrentOrganization } from "@/features/organizations/use-current-organization"
import { cn } from "@/lib/utils"

type NavItem = { to: string; label: string; icon: LucideIcon }

/** The signed-in shell for `/orgs/:orgId/*`: top bar, navigation, and the page. */
export function AppLayout() {
  const organization = useCurrentOrganization()
  const nav: NavItem[] = [
    { to: `/orgs/${organization.id}/projects`, label: "Projects", icon: FolderKanbanIcon },
    { to: `/orgs/${organization.id}/members`, label: "Members", icon: UsersIcon },
  ]

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-14 items-center gap-2 px-4">
          <Logo className="mr-1 hidden sm:flex" />
          <span aria-hidden className="hidden text-muted-foreground/50 sm:inline">
            /
          </span>
          <OrganizationSwitcher />
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
        {/* Small screens: navigation as a tab row under the top bar. */}
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {nav.map((item) => (
            <NavItemLink key={item.to} item={item} />
          ))}
        </nav>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r bg-sidebar md:block">
          <nav aria-label="Main" className="sticky top-14 flex flex-col gap-1 p-3">
            {nav.map((item) => (
              <NavItemLink key={item.to} item={item} />
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function NavItemLink({ item: { to, label, icon: Icon } }: { item: NavItem }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        )
      }
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </NavLink>
  )
}
