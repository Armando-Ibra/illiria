import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router"
import { z } from "zod"

import { ApiError } from "@/api/errors"
import { FormError } from "@/components/form-error"
import { TextField } from "@/components/form-fields"
import { Spinner } from "@/components/states"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useLogin } from "@/features/auth/api"
import { AuthCard } from "@/features/auth/components/auth-card"
import { emailSchema } from "@/features/auth/schemas"
import { applyApiError } from "@/lib/forms"
import { safeReturnTo } from "@/lib/return-to"

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
})

type Values = z.infer<typeof schema>

/** Identity's sign-in failures come back as 401 with the SignInResult in `detail`. */
function loginErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiError) || error.status !== 401) return undefined
  switch (error.problem.detail) {
    case "NotAllowed":
      return "Confirm your email address before signing in."
    case "LockedOut":
      return "Too many failed attempts. Try again in 15 minutes."
    case "RequiresTwoFactor":
      return "This account uses two-factor authentication, which the web app doesn't support yet."
    default:
      return "Invalid email or password."
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get("returnTo"))
  const login = useLogin()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } })

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => navigate(returnTo ?? "/", { replace: true }),
      onError: (error) => {
        const message = loginErrorMessage(error)
        if (message) form.setError("root.server", { message })
        else applyApiError(form, error)
      },
    }),
  )

  const notConfirmed = login.error instanceof ApiError && login.error.problem.detail === "NotAllowed"
  const withReturnTo = (path: string, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra)
    if (returnTo) params.set("returnTo", returnTo)
    return params.size > 0 ? `${path}?${params}` : path
  }

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Sign in to your account."
      footer={
        <p>
          New here?{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" to={withReturnTo("/register")}>
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormError form={form}>
            {notConfirmed && (
              <>
                {" "}
                <Link to={withReturnTo("/check-email", { email: form.getValues("email") })}>Resend the email</Link>
              </>
            )}
          </FormError>
          <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" autoFocus />
          <TextField control={form.control} name="password" label="Password" type="password" autoComplete="current-password" />
          <div className="-mt-2 text-right text-sm">
            <Link className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" to="/forgot-password">
              Forgot your password?
            </Link>
          </div>
          <Button type="submit" disabled={login.isPending}>
            {login.isPending && <Spinner />}
            Sign in
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
