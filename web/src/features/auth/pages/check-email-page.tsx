import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheckIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"
import { z } from "zod"

import { FormError } from "@/components/form-error"
import { TextField } from "@/components/form-fields"
import { Spinner } from "@/components/states"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useResendConfirmationEmail } from "@/features/auth/api"
import { AuthCard } from "@/features/auth/components/auth-card"
import { emailSchema } from "@/features/auth/schemas"
import { applyApiError } from "@/lib/forms"
import { loginPath } from "@/lib/return-to"

const schema = z.object({ email: emailSchema })

/**
 * After sign-up (or a sign-in blocked by an unconfirmed email): explains the confirmation email and offers a new
 * link. For an unconfirmed account the API answers with a "finish setting up your account" email, whose link
 * (/reset-password) sets a password and confirms the address in one step.
 */
export function CheckEmailPage() {
  const [searchParams] = useSearchParams()
  const registered = searchParams.has("registered")
  const resend = useResendConfirmationEmail()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: searchParams.get("email") ?? "" },
  })

  const onSubmit = form.handleSubmit(({ email }) =>
    resend.mutate(email, {
      // The API answers 200 whether or not the account exists, so this reveals nothing.
      onSuccess: () =>
        toast.success(`If ${email} has an unconfirmed account, we sent it a link to finish setting up your account.`),
      onError: (error) => applyApiError(form, error),
    }),
  )

  return (
    <AuthCard
      title={registered ? "Check your email" : "Confirm your email"}
      description={
        registered
          ? "We sent you a link to confirm your email address. Open it to activate your account."
          : "Your email address isn't confirmed yet. We can send you a link to finish setting up your account."
      }
      footer={
        <p>
          Confirmed already?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            to={loginPath(searchParams.get("returnTo"))}
          >
            Sign in
          </Link>
        </p>
      }
    >
      <div className="mb-4 flex items-center gap-3 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
        <MailCheckIcon aria-hidden className="size-5 shrink-0" />
        <p>Didn't get it? Check your spam folder, or ask for a new link: we'll email you a link to finish setting up your account.</p>
      </div>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormError form={form} />
          <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" />
          <Button type="submit" variant="outline" disabled={resend.isPending}>
            {resend.isPending && <Spinner />}
            Send a new link
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
