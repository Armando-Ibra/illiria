import { Outlet } from "react-router"

import { Logo } from "@/components/logo"
import { UserMenu } from "@/features/auth/components/user-menu"

/** The signed-in shell outside any organization (the account page): top bar and a narrow page column. */
export function AccountLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-14 items-center gap-2 px-4">
          <Logo />
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
