import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheckIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { FormError } from "@/components/form-error"
import { TextField } from "@/components/form-fields"
import { Spinner } from "@/components/states"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { useChangeEmail } from "@/features/account/api"
import { applyAccountError } from "@/features/account/forms"
import { useMe } from "@/features/auth/api"
import { emailSchema } from "@/features/auth/schemas"

const schema = z.object({
  newEmail: emailSchema,
  currentPassword: z.string().min(1, "Enter your current password."),
})

type Values = z.infer<typeof schema>

export function EmailCard() {
  const me = useMe()
  const change = useChangeEmail()
  const [editing, setEditing] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { newEmail: "", currentPassword: "" } })

  const close = () => {
    setEditing(false)
    form.reset()
  }

  const onSubmit = form.handleSubmit(({ newEmail, currentPassword }) => {
    if (newEmail.toLowerCase() === me.email.toLowerCase()) {
      form.setError("newEmail", { message: "That's already your email address." }, { shouldFocus: true })
      return
    }
    change.mutate(
      { newEmail, currentPassword },
      {
        onSuccess: () => {
          setSentTo(newEmail)
          close()
        },
        onError: (error) =>
          applyAccountError(form, error, "currentPassword", (key) => {
            if (key === "DuplicateEmail" || key === "InvalidEmail") return "newEmail"
            // Usernames are emails here: these repeat DuplicateEmail / InvalidEmail.
            if (key === "DuplicateUserName" || key === "InvalidUserName") return null
            return undefined
          }),
      },
    )
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Email</h2>
        </CardTitle>
        <CardDescription>You sign in with this address, and account emails go to it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium break-all" data-testid="account-email">
            {me.email}
          </span>
          {me.emailConfirmed ? <Badge variant="secondary">Confirmed</Badge> : <Badge variant="outline">Not confirmed</Badge>}
        </div>

        {sentTo && (
          <Alert>
            <MailCheckIcon />
            <AlertTitle>Check your inbox at {sentTo}</AlertTitle>
            <AlertDescription>
              Open the link we sent there to confirm the change. Until then, keep signing in with {me.email}.
            </AlertDescription>
          </Alert>
        )}

        {editing ? (
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <FormError form={form} />
              <TextField control={form.control} name="newEmail" label="New email" type="email" autoComplete="email" autoFocus />
              <TextField
                control={form.control}
                name="currentPassword"
                label="Current password"
                type="password"
                autoComplete="current-password"
                description="To protect your account, confirm it's you."
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" disabled={change.isPending}>
                  {change.isPending && <Spinner />}
                  Send confirmation link
                </Button>
              </div>
            </FieldGroup>
          </form>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setSentTo(null)
              setEditing(true)
            }}
          >
            Change email
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
