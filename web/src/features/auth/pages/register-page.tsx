import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router"
import { z } from "zod"

import { FormError } from "@/components/form-error"
import { TextField } from "@/components/form-fields"
import { Spinner } from "@/components/states"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { useRegister } from "@/features/auth/api"
import { AuthCard } from "@/features/auth/components/auth-card"
import { emailSchema, identityErrorField, newPasswordSchema, passwordHint } from "@/features/auth/schemas"
import { applyApiError } from "@/lib/forms"
import { safeReturnTo } from "@/lib/return-to"

const schema = z
  .object({
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  })

type Values = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get("returnTo"))
  const register = useRegister()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  })

  const onSubmit = form.handleSubmit(({ email, password }) =>
    register.mutate(
      { email, password },
      {
        onSuccess: () => {
          const params = new URLSearchParams({ email, registered: "1" })
          if (returnTo) params.set("returnTo", returnTo)
          navigate(`/check-email?${params}`, { replace: true })
        },
        onError: (error) => applyApiError(form, error, identityErrorField("password")),
      },
    ),
  )

  return (
    <AuthCard
      title="Create an account"
      description="Start with your email address and a password."
      footer={
        <p>
          Already have an account?{" "}
          <Link
            className="font-medium text-foreground underline-offset-4 hover:underline"
            to={returnTo ? `/login?${new URLSearchParams({ returnTo })}` : "/login"}
          >
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <FormError form={form} />
          <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" autoFocus />
          <TextField
            control={form.control}
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            description={passwordHint}
          />
          <TextField
            control={form.control}
            name="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
          />
          <Button type="submit" disabled={register.isPending}>
            {register.isPending && <Spinner />}
            Create account
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
