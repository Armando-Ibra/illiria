import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { FormError } from "@/components/form-error"
import { TextField } from "@/components/form-fields"
import { Spinner } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { useChangePassword } from "@/features/account/api"
import { useMe } from "@/features/auth/api"
import { newPasswordSchema, passwordHint } from "@/features/auth/schemas"
import { applyApiError } from "@/lib/forms"

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  })

type Values = z.infer<typeof schema>

/** Identity error codes: a wrong current password is `PasswordMismatch`; policy failures are `Password…` too. */
function passwordErrorField(code: string): keyof Values | undefined {
  if (code === "PasswordMismatch" || code === "OldPasswordRequired") return "currentPassword"
  if (code.startsWith("Password")) return "newPassword"
  return undefined
}

export function PasswordCard() {
  const me = useMe()
  const change = useChangePassword()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  const onSubmit = form.handleSubmit(({ currentPassword, newPassword }) =>
    change.mutate(
      { oldPassword: currentPassword, newPassword },
      {
        onSuccess: () => {
          form.reset()
          // The API re-issued this session's cookie: still signed in here, signed out everywhere else.
          toast.success("Password changed. Other devices were signed out.")
        },
        onError: (error) => applyApiError(form, error, passwordErrorField),
      },
    ),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Password</h2>
        </CardTitle>
        <CardDescription>Changing it signs you out on every other device.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          {/* Lets password managers tie the new password to the right account. */}
          <input type="email" name="username" autoComplete="username" value={me.email} readOnly hidden />
          <FieldGroup>
            <FormError form={form} />
            <TextField
              control={form.control}
              name="currentPassword"
              label="Current password"
              type="password"
              autoComplete="current-password"
            />
            <TextField
              control={form.control}
              name="newPassword"
              label="New password"
              type="password"
              autoComplete="new-password"
              description={passwordHint}
            />
            <TextField
              control={form.control}
              name="confirmPassword"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={change.isPending}>
                {change.isPending && <Spinner />}
                Change password
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
