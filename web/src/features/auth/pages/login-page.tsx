import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router"
import { z } from "zod"

import { ApiError } from "@/api/errors"
import { FormError } from "@/components/form-error"
import { TextField } from "@/components/form-fields"
import { Spinner } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldGroup } from "@/components/ui/field"
import { configQueryOptions, useLogin } from "@/features/auth/api"
import { AuthCard } from "@/features/auth/components/auth-card"
import { emailSchema } from "@/features/auth/schemas"
import { applyApiError } from "@/lib/forms"
import { safeReturnTo } from "@/lib/return-to"

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
})

type Values = z.infer<typeof schema>
type Credentials = Values

/** Identity's sign-in failures come back as 401 with the SignInResult (`Failed`, `NotAllowed`…) in `detail`. */
function signInResult(error: unknown): string | undefined {
  return error instanceof ApiError && error.status === 401 ? (error.problem.detail ?? "Failed").toLowerCase() : undefined
}

function loginErrorMessage(error: unknown): string | undefined {
  switch (signInResult(error)) {
    case undefined:
      return undefined
    case "notallowed":
      return "Confirm your email address before signing in."
    case "lockedout":
      return "Too many failed attempts. Try again in 15 minutes."
    default:
      return "Invalid email or password."
  }
}

/** Sign in: email and password, then (for accounts with two-factor authentication) a code. */
export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get("returnTo"))
  // Step 2 needs the password again (the API re-checks it with the code): kept in memory only, never stored.
  const [twoFactor, setTwoFactor] = useState<Credentials | null>(null)

  const onSignedIn = () => navigate(returnTo ?? "/", { replace: true })

  if (twoFactor) {
    return <TwoFactorStep credentials={twoFactor} onSignedIn={onSignedIn} onBack={() => setTwoFactor(null)} />
  }
  return <PasswordStep returnTo={returnTo} onSignedIn={onSignedIn} onTwoFactorRequired={setTwoFactor} />
}

function PasswordStep({
  returnTo,
  onSignedIn,
  onTwoFactorRequired,
}: {
  returnTo: string | null
  onSignedIn: () => void
  onTwoFactorRequired: (credentials: Credentials) => void
}) {
  const login = useLogin()
  const config = useQuery(configQueryOptions)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } })

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: onSignedIn,
      onError: (error) => {
        if (signInResult(error) === "requirestwofactor") {
          onTwoFactorRequired(values)
          return
        }
        const message = loginErrorMessage(error)
        if (message) form.setError("root.server", { message })
        else applyApiError(form, error)
      },
    }),
  )

  const notConfirmed = signInResult(login.error) === "notallowed"
  const withReturnTo = (path: string, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra)
    if (returnTo) params.set("returnTo", returnTo)
    return params.size > 0 ? `${path}?${params}` : path
  }

  // Until the config is known, show neither: a closed sign-up would only flash the link.
  // Invite-only apps still let someone who followed an invitation link create their account.
  const fromInvitation = returnTo?.startsWith("/invitations/accept") ?? false
  const registrationEnabled = config.isError || config.data?.registrationEnabled === true || fromInvitation

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Sign in to your account."
      footer={
        config.isPending ? undefined : registrationEnabled ? (
          <p>
            New here?{" "}
            <Link className="font-medium text-foreground underline-offset-4 hover:underline" to={withReturnTo("/register")}>
              Create an account
            </Link>
          </p>
        ) : (
          <p>New here? Ask your administrator for an invitation.</p>
        )
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormError form={form}>
            {notConfirmed && (
              <>
                {" "}
                <Link to={withReturnTo("/check-email", { email: form.getValues("email") })}>Send a new link</Link>
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

const codeSchema = z.object({ code: z.string() })

function TwoFactorStep({
  credentials,
  onSignedIn,
  onBack,
}: {
  credentials: Credentials
  onSignedIn: () => void
  onBack: () => void
}) {
  const login = useLogin()
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const form = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: "" } })

  const onSubmit = form.handleSubmit(({ code }) => {
    // Authenticator codes are often shown as "123 456"; recovery codes are upper case ("ABCDE-12345").
    const value = useRecoveryCode ? code.trim().toUpperCase() : code.replace(/\s/g, "")
    const valid = useRecoveryCode ? /^[A-Z0-9-]{6,}$/.test(value) : /^\d{6}$/.test(value)
    if (!valid) {
      form.setError("code", {
        message: useRecoveryCode ? "Enter one of your recovery codes." : "Enter the 6-digit code from your app.",
      }, { shouldFocus: true })
      return
    }
    login.mutate(
      { ...credentials, rememberDevice, ...(useRecoveryCode ? { twoFactorRecoveryCode: value } : { twoFactorCode: value }) },
      {
        onSuccess: onSignedIn,
        onError: (error) => {
          const result = signInResult(error)
          if (result === "failed") {
            form.setError(
              "code",
              {
                message: useRecoveryCode
                  ? "That recovery code isn't valid or was already used."
                  : "That code isn't valid. Check your app and try again.",
              },
              { shouldFocus: true },
            )
          } else if (result) {
            form.setError("root.server", { message: loginErrorMessage(error) })
          } else {
            applyApiError(form, error)
          }
        },
      },
    )
  })

  const toggle = () => {
    setUseRecoveryCode((current) => !current)
    form.reset({ code: "" })
    form.setFocus("code")
  }

  return (
    <AuthCard
      title="Two-factor authentication"
      description={
        useRecoveryCode
          ? "Enter one of the recovery codes you saved when you set up two-factor authentication."
          : "Enter the 6-digit code from your authenticator app."
      }
      footer={
        <Button variant="link" size="sm" className="h-auto px-0 text-muted-foreground" onClick={onBack}>
          Back to sign in
        </Button>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormError form={form} />
          {useRecoveryCode ? (
            <TextField
              key="recovery"
              control={form.control}
              name="code"
              label="Recovery code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
            />
          ) : (
            <TextField
              key="authenticator"
              control={form.control}
              name="code"
              label="Authentication code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={rememberDevice} onCheckedChange={setRememberDevice} />
            Don&apos;t ask again on this browser
          </label>
          <Button type="submit" disabled={login.isPending}>
            {login.isPending && <Spinner />}
            Verify
          </Button>
          <Button type="button" variant="ghost" onClick={toggle}>
            {useRecoveryCode ? "Use your authenticator app instead" : "Use a recovery code instead"}
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
