import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link } from "react-router"
import { z } from "zod"

import { FormError } from "@/components/form-error"
import { TextField } from "@/components/form-fields"
import { Spinner } from "@/components/states"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useForgotPassword } from "@/features/auth/api"
import { AuthCard } from "@/features/auth/components/auth-card"
import { emailSchema } from "@/features/auth/schemas"
import { applyApiError } from "@/lib/forms"

const schema = z.object({ email: emailSchema })

export function ForgotPasswordPage() {
  const forgot = useForgotPassword()
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: "" } })

  const onSubmit = form.handleSubmit(({ email }) => forgot.mutate(email, { onError: (error) => applyApiError(form, error) }))

  const backToSignIn = (
    <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/login">
      Back to sign in
    </Link>
  )

  if (forgot.isSuccess) {
    return (
      <AuthCard
        title="Check your email"
        description={`If an account exists for ${forgot.variables}, we sent it a link to reset the password.`}
        footer={backToSignIn}
      />
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to choose a new password."
      footer={backToSignIn}
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormError form={form} />
          <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" autoFocus />
          <Button type="submit" disabled={forgot.isPending}>
            {forgot.isPending && <Spinner />}
            Send reset link
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
