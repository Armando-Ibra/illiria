import { ArrowLeftIcon } from "lucide-react"
import { Link } from "react-router"

import { PageHeader } from "@/components/page-header"
import { EmailCard } from "@/features/account/components/email-card"
import { PasswordCard } from "@/features/account/components/password-card"
import { TwoFactorCard } from "@/features/account/components/two-factor-card"

/** `/account`: the signed-in user's sign-in details and security settings. */
export function AccountPage() {
  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Back to the app
      </Link>
      <PageHeader title="Account" description="Your sign-in details and security settings." />
      <EmailCard />
      <PasswordCard />
      <TwoFactorCard />
    </div>
  )
}
