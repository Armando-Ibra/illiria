import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router"
import { toast } from "sonner"
import { z } from "zod"

import { ApiError } from "@/api/errors"
import { FormError } from "@/components/form-error"
import { TextField } from "@/components/form-fields"
import { Spinner } from "@/components/states"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useResetPassword } from "@/features/auth/api"
import { AuthCard } from "@/features/auth/components/auth-card"
import { newPasswordSchema, passwordHint } from "@/features/auth/schemas"
import { applyApiError } from "@/lib/forms"

const schema = z
  .object({ newPassword: newPasswordSchema, confirmPassword: z.string() })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  })

const requestNewLink = (
  <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/forgot-password">
    Request a new link
  </Link>
)

/** Landing page of the reset email: /reset-password?email=…&code=… */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get("email")
  const code = searchParams.get("code")
  const reset = useResetPassword()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  })

  if (!email || !code) {
    return <AuthCard title="Invalid link" description="This password reset link is incomplete." footer={requestNewLink} />
  }

  const onSubmit = form.handleSubmit(({ newPassword }) =>
    reset.mutate(
      { email, resetCode: code, newPassword },
      {
        onSuccess: () => {
          toast.success("Password changed. Sign in with your new password.")
          navigate("/login", { replace: true })
        },
        // Password policy errors go on the field; InvalidToken (the link is wrong) becomes the form-level error.
        onError: (error) => applyApiError(form, error, (key) => (key.startsWith("Password") ? "newPassword" : undefined)),
      },
    ),
  )

  const invalidToken = reset.error instanceof ApiError && "InvalidToken" in reset.error.errors

  return (
    <AuthCard title="Choose a new password" description={`For ${email}`} footer={requestNewLink}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormError form={form}>{invalidToken && " This link has expired or was already used."}</FormError>
          <TextField
            control={form.control}
            name="newPassword"
            label="New password"
            type="password"
            autoComplete="new-password"
            description={passwordHint}
            autoFocus
          />
          <TextField
            control={form.control}
            name="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
          />
          <Button type="submit" disabled={reset.isPending}>
            {reset.isPending && <Spinner />}
            Change password
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
