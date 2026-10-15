import { useQuery } from "@tanstack/react-query"
import { CircleCheckIcon, CircleXIcon } from "lucide-react"
import { Link, useSearchParams } from "react-router"

import { LoadingState } from "@/components/states"
import { buttonVariants } from "@/components/ui/button"
import { confirmEmailQueryOptions, type ConfirmEmailParams } from "@/features/auth/api"
import { AuthCard } from "@/features/auth/components/auth-card"

/** Landing page of the confirmation email: /confirm-email?userId=…&code=…[&changedEmail=…] */
export function ConfirmEmailPage() {
  const [searchParams] = useSearchParams()
  const userId = searchParams.get("userId")
  const code = searchParams.get("code")

  if (!userId || !code) {
    return <ConfirmationFailed />
  }

  const changedEmail = searchParams.get("changedEmail")
  return <Confirmation params={{ userId, code, ...(changedEmail ? { changedEmail } : {}) }} />
}

function Confirmation({ params }: { params: ConfirmEmailParams }) {
  const confirmation = useQuery(confirmEmailQueryOptions(params))

  if (confirmation.isPending) {
    return (
      <AuthCard title="Confirming your email">
        <LoadingState label="One moment…" className="py-4" />
      </AuthCard>
    )
  }

  if (confirmation.isError) {
    return <ConfirmationFailed />
  }

  return (
    <AuthCard
      title="Email confirmed"
      description={params.changedEmail ? "Your new email address is confirmed." : "Your account is ready."}
    >
      <div className="flex flex-col items-center gap-4">
        <CircleCheckIcon aria-hidden className="size-10 text-emerald-600 dark:text-emerald-400" />
        <Link className={buttonVariants({ className: "w-full" })} to="/">
          Continue
        </Link>
      </div>
    </AuthCard>
  )
}

function ConfirmationFailed() {
  return (
    <AuthCard
      title="Link not valid"
      description="This confirmation link is invalid or has expired. Request a new one below."
    >
      <div className="flex flex-col items-center gap-4">
        <CircleXIcon aria-hidden className="size-10 text-destructive" />
        <Link className={buttonVariants({ variant: "outline", className: "w-full" })} to="/check-email">
          Send a new link
        </Link>
      </div>
    </AuthCard>
  )
}
